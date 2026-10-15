---
title: Design a URL Shortener (like TinyURL)
summary: Seven-character codes from pre-allocated ID ranges, a cache that answers nine redirects in ten, and click counting kept off the redirect, for 40,000 redirects a second at peak.
date: 2026-10-05
order: 1
template: 3
---

You're asked to design a service like TinyURL. You give it a long link and it hands back `https://sho.rt/x7Kp2Qa`. Anyone who opens that is sent on to the original with a **redirect**, an HTTP response in the 300s whose `Location` header names the destination.

The product fits in a sentence, so the design turns on what it forces: minting **short codes** (the `x7Kp2Qa` part) that no two links share, answering tens of thousands of redirects a second, and counting clicks without making anyone wait. Here, each server mints codes from blocks of numbers it claims ahead of time, fast memory answers most redirects, and clicks are counted off to the side. The page starts with the obvious one-database design and shows where it breaks, then follows a create and a click through the design that replaces it, sizes its parts, and makes three decisions: how codes are minted, what answers most redirects, and how clicks are counted.

## Requirements

- Shorten a long URL to a code of at most 7 characters that can't be guessed in sequence. The same URL shortened twice gives two links, each with its own owner and click count.
- Redirect to the long URL unless it has expired or been disabled for abuse. Custom aliases (`sho.rt/spring-sale`) and expiry dates are optional.
- Count clicks per link per minute.
- 100 million new links a month, 100 redirects each, kept five years.
- A redirect adds under 20 ms at p99 (99% of requests are faster) and is up 99.99% of the time; creates need 99.9%.

Out of scope: sign-up and billing (an API key on each request names the owner), editing a link's destination, and dashboards.

## Start simple

The obvious design has one **app server**, a program that answers requests, and one database, the **URL store**, with a row per link. A create takes the next number from a counter in the database and stores the row under it. A redirect looks the code up, adds one to that link's click count and answers.

The number becomes the code by writing it in **base62**: digits `0-9`, then `a-z`, then `A-Z`, 62 symbols in all.

For a small service that's fine. Now run this service's numbers. A month is about 2.6 million seconds (30 days × 86,400), and peak traffic is ten times the average ([numbers every engineer should know](/engineering-practices/numbers-every-engineer-should-know)). Assume one database server handles about 10,000 operations a second, a lookup or an update alike:

```text
redirects a month:
  100,000,000 links × 100 = 10,000,000,000
average:
  10,000,000,000 ÷ 2,600,000 s ≈ 3,850, call it 4,000 a second
peak:
  4,000 × 10 = 40,000 a second
database operations at peak:
  40,000 lookups + 40,000 click updates = 80,000 a second
servers:
  80,000 ÷ 10,000 = 8
```

That's eight database servers just to answer redirects and count them, and a viral link's single count row has to take its updates one at a time. The counter has a second flaw: codes come out in order, and the requirements rule that out.

Three fixes follow. A **cache**, fast memory that keeps recent answers, takes most lookups off the database. A **click queue** takes the counting off the redirect. And the codes need a different source than one shared counter.

## High-level architecture

![Architecture of the URL shortener. A browser or API client sends POST /urls and GET /{code} to a load balancer, which spreads them across identical app servers. The app servers read the cache first, read the URL store on a miss and insert new links into it, claim blocks of IDs from an ID range allocator, and send click events to a click queue. Analytics workers, which count the events, take them off the queue and make batched writes to an analytics store.](/diagrams/url-shortener/architecture.svg)

Follow a create. The request reaches the **load balancer**, a server that spreads requests across identical app servers ([reverse proxy](/systems-and-infrastructure/forward-vs-reverse-proxy)). The app server takes the next ID from a block it claimed earlier from the **ID range allocator**, which hands out blocks of numbers. That ID becomes the code, and the row is inserted into the URL store.

Now follow a click on `sho.rt/x7Kp2Qa`. The same load balancer picks an app server, which reads the cache first. Nine times in ten the long URL is there; on a miss, the server reads the URL store and caches the answer. It then sends a **click event**, a small record that the link was opened, and answers with the redirect without waiting.

The events go to the click queue, where **analytics workers** take them off later and count them. So a redirect costs one lookup and one hand-off. But how big is each part?

## Key numbers

These size the app servers, the URL store, the cache and the pool of codes. The redirect rate is from "Start simple"; all figures are rounded.

- **Creates, app servers and allocator:** about 400 a second at peak. 100,000,000 links ÷ 2,600,000 s ≈ 38, call it 40 a second on average; 40 × 10 = 400.
- **Redirects, app servers and cache:** about 40,000 a second at peak, and about 333 million a day. 10,000,000,000 redirects a month ÷ 30 days ≈ 333,000,000.
- **URL store:** 3 TB of links, 9 TB in three copies (on separate machines, in case one fails). 100,000,000 × 12 months × 5 years = 6 billion links; 6 billion × 500 bytes, with room for the URL, timestamps and index, = 3 TB; 3 TB × 3 = 9 TB.
- **Cache:** about 35 GB of memory. Assume the hot links are 20% of a day's redirects: 0.2 × 333,000,000 ≈ 67 million entries; 67 million × 500 bytes ≈ 33 GB, so plan 35 GB.
- **Codes:** 3.5 trillion possible. 62⁷ = 3,521,614,606,208; 6 billion links ÷ 3.5 trillion ≈ 0.17% of them used.

## API and data model

```http
POST /urls
Authorization: Bearer <api-key>
{ "long_url": "https://example.com/blog/...", "custom_alias": "spring-sale", "expires_at": "2027-01-01T00:00:00Z" }
   (custom_alias and expires_at are optional)
-> 201 { "code": "spring-sale", "short_url": "https://sho.rt/spring-sale" }, or 409 if the alias is taken

GET /x7Kp2Qa
-> 302 Found, Location: <long_url>   (404 if unknown or disabled, 410 if expired)
```

```text
links
  code        string, primary key   "x7Kp2Qa" or a custom alias
  long_url    string                up to 2,048 characters
  owner_id    string                looked up from the API key
  created_at  timestamp
  expires_at  timestamp, nullable
  disabled    boolean               set when a link is flagged for abuse
```

Every query is one lookup by `code`, which suits a key-value store ([SQL vs. NoSQL](/systems-and-infrastructure/sql-vs-nosql)). The redirect is a `302`, not a `301`: browsers may cache a `301` and stop asking, which breaks expiry, disabling and click counts.

## Decision: pre-allocated ID ranges

The simplest source of codes is the counter from "Start simple": each create adds 1 to one row and encodes the result. It breaks twice. The next link after `x7Kp2Qa` gets the next code, which anyone can type. And every create waits on that row. If an update holds it for about 2 ms, it takes at most 1,000 ÷ 2 = 500 updates a second, and creates peak at 400, leaving 20% headroom on the one row every create touches.

So each app server claims a block of 10,000 IDs from the allocator, a counter row bumped by 10,000 in one atomic step (all or nothing), and hands them out from memory. Assume ten servers share the peak:

```text
creates per server:
  400 ÷ 10 servers = 40 a second
a block lasts, per server:
  10,000 IDs ÷ 40 = 250 seconds
claims across the fleet:
  250 ÷ 10 servers = one every 25 seconds
```

The counter row sees one update every 25 seconds, not 400 a second. Before encoding in base62, each ID is encrypted over the 62⁷ range with a key only the app servers hold. The mapping is one-to-one, so `x7Kp2Qa`'s neighbors look unrelated and two generated codes can't collide. Inserts are conditional: a second request for a taken alias gets `409`, and a generated code that matches an alias takes the next ID.

The cost is a secret key every app server must share, and a crashed server's unused IDs are lost, which 3.5 trillion codes can spare. Random codes, retried on a clash, also work: at 0.17% full, about one create in 600 retries by year five, but blocks retry only on an alias match. Hashing the URL is worse, since one URL always gets one code and the two-links requirement rules that out.

**Rule of thumb.** If you can hand out unique numbers cheaply, do that instead of generating random ones and handling collisions, and claim them in blocks so no shared counter sits in every request.

## Decision: cache in front of the store

That gets `x7Kp2Qa` minted. Serving it 40,000 times a second is harder. The simpler option is to read straight from the store's three copies, as [read replicas](/systems-and-infrastructure/read-replicas), each taking a share of the lookups:

```text
reads per copy:
  40,000 ÷ 3 ≈ 13,300 a second
against 10,000 each:
  13,300 ÷ 10,000 = 1.3 times capacity
```

Three copies can't keep up. Adding two more would, at 5 × 10,000 = 50,000 a second, but that is five full 3 TB copies, 15 TB, each answering its share of redirects from disk. One 35 GB cache can answer 90% of them in under a millisecond. A lagging copy can also answer `404` for a link created a second ago.

So the [cache](/systems-and-infrastructure/caching) goes in front. Clicks bunch up on popular links, so assume the 35 GB of hot links answer 90% of lookups in under a millisecond:

```text
misses at peak:
  40,000 × (1 − 0.9) = 4,000 a second
```

One **primary**, the server that takes writes, answers those 4,000, under half its 10,000 a second, with current rows. Links can't be edited, so a 24-hour TTL (how long the cache keeps an entry) costs little: each entry carries its link's expiry, and disabling a link deletes its entry ([cache invalidation](/systems-and-infrastructure/cache-invalidation)). The cost is 35 GB of memory to run, and a disabled link whose delete is missed keeps redirecting for up to 24 hours.

**Rule of thumb.** Read-heavy, a small hot set, data that rarely changes: put a cache in front and size it to the hot set, not the dataset.

## Decision: count clicks through a queue

The simpler option is the one from "Start simple": add one to the link's count in the store on every redirect, which is 40,000 more writes a second. The next idea is to increment a counter in the cache you already call, but that doubles its work at peak:

```text
cache operations at peak:
  40,000 reads + 40,000 increments = 80,000 a second
```

Counts held in memory also vanish when the cache drops an entry or restarts, with no raw events to rebuild from.

The **hot path** is the code every redirect runs, and anything you add there costs you 40,000 times a second. So the redirect hands a small event to a [message queue](/systems-and-infrastructure/message-queues), which holds it for a worker, and answers without waiting. Workers sum events per code per minute and write totals in batches: 100 clicks on `x7Kp2Qa` in a minute become one write ([batching](/systems-and-infrastructure/batching-and-asynchronous-writes)). An analytics outage lengthens the queue instead of failing redirects: a redirect never waits on, or fails because of, counting.

The price is that counts lag a minute, and a redelivered event counts twice unless workers skip repeated event IDs.

**Rule of thumb.** Work the user isn't waiting for comes off the hot path: record an event and do it later.

## Likely follow-ups

- **What if `x7Kp2Qa` goes viral?** When its cache entry expires, hundreds of requests miss at once, a [thundering herd](/systems-and-infrastructure/thundering-herd-problem). Let one request per code on each server read the store while the rest wait.
- **What if the ID allocator goes down?** Each server claims its next block at half used, so it still holds at least 5,000 IDs, about two minutes at its peak share of 40 creates a second (5,000 ÷ 40 = 125 seconds). Redirects don't touch it.
- **Could this run on PostgreSQL?** Yes: 3 TB and 400 writes a second fit one primary for years, and rows split cleanly by code later ([sharding](/systems-and-infrastructure/partitioning-vs-sharding), splitting rows across servers).
- **How do you stop spammers?** Limit creates per API key across all servers ([rate limiting](/systems-and-infrastructure/rate-limiting)) and check new links against a blocklist of known-bad destinations. Disabling a flagged link deletes its cache entry (the 24-hour TTL catches a missed delete).
