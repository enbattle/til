---
title: Design a URL Shortener (like TinyURL)
summary: Seven-character codes from pre-allocated ID ranges, a cache that answers nine redirects in ten, and click counting kept off the redirect, for 40,000 redirects a second at peak.
date: 2026-10-05
order: 1
---

You're asked to design a service like TinyURL. It takes a long link, hands back
`https://sho.rt/x7Kp2Qa`, and sends anyone who opens that on to the original
with a **redirect**, an HTTP response in the 300s whose `Location` header names
the destination. The product fits in a sentence, so the design turns on what
it forces: minting **short codes** (the `x7Kp2Qa` part) that no two links
share, answering tens of thousands of redirects a second, and counting clicks
without making anyone wait.

## Requirements

- Shorten a long URL to a code of at most 7 characters that can't be guessed
  in sequence. The same URL shortened twice gives two links, each with its own
  owner and click count.
- Redirect to the long URL unless it has expired or been disabled for abuse.
  Custom aliases (`sho.rt/spring-sale`) and expiry
  dates are optional.
- Count clicks per link per minute.
- 100 million new links a month, 100 redirects each, kept five years.
- A redirect adds under 20 ms at p99 (99% of requests are faster) and is up
  99.99% of the time; creates need 99.9%.

Out of scope: sign-up and billing (an API key on each request names the
owner), editing a link's destination, and dashboards.

## Key numbers

Size the service: requests its servers must answer, data its database
must hold, memory a cache would need. Rounded, with peak at ten times average
([numbers every engineer should know](/engineering-practices/numbers-every-engineer-should-know)):

- **Writes: about 400 creates a second at peak.** 100 million a month ÷ 2.6
  million seconds ≈ 40 a second on average.
- **Reads: about 40,000 redirects a second at peak.** 100 per link, so about
  4,000 a second, or 333 million a day, on average.
- **Database: 3 TB of links, 9 TB in three copies.** 6 billion links over five
  years × 500 bytes, with room for the URL, timestamps and index.
- **Cache: about 35 GB of memory.** Assume 20% of a day's 333 million
  redirects × 500 bytes ≈ 33 GB.
- **Codes: 3.5 trillion possible.** 62⁷ in **base62** (`0-9`, `a-z`, `A-Z`);
  6 billion links use about 0.17% of them.

## High-level architecture

![Architecture of the URL shortener. A browser or API client sends POST /urls and GET /{code} to a load balancer, which passes them to identical app servers. The app servers read the cache first, read the URL store on a miss and insert new links into it, claim IDs from an ID range allocator, and send click events to a click queue. Analytics workers take events off the queue and make batched writes to an analytics store.](/diagrams/url-shortener/architecture.svg)

Follow a click on `sho.rt/x7Kp2Qa`. It reaches the **load balancer**, a
[reverse proxy](/systems-and-infrastructure/forward-vs-reverse-proxy) that
spreads requests across identical app servers, and one app server reads the
cache first. Nine times in ten the long URL is there; on a miss, the server
reads the URL store and caches the answer. It sends a click event to the click
queue without waiting and answers with the redirect; analytics workers count
those events later. A create takes
the other branch: an ID from a block claimed from the ID range allocator
becomes the code, and the row is inserted into the URL store.

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

Every query is one lookup by
`code`, which suits a key-value
store ([SQL vs. NoSQL](/systems-and-infrastructure/sql-vs-nosql)). The redirect
is a `302`, not a `301`: browsers may cache a `301` and stop asking, which
breaks expiry, disabling and click counts.

## Decision: pre-allocated ID ranges

Each app server claims a block of 10,000 IDs from the allocator, a counter row
bumped by 10,000 in one atomic step, and hands them out from memory. With ten
servers sharing 400 creates a second, one asks about every 25 seconds. Before encoding in base62, each ID is encrypted over the 62⁷
range with a key only the app servers hold, a one-to-one mapping, so
`x7Kp2Qa`'s neighbors look unrelated and two generated codes can't collide.
Inserts are conditional: a second request for a taken alias gets `409`, and a
generated code that matches an alias takes the next ID.

Why not random codes, retrying on a clash? At 0.17% full it rarely does: about
one create in 600 retries by year five. Ranges are more predictable: no
generated code ever retries, however full the space gets. Hashing the URL is
worse, since one URL always gets one code and the two-links requirement rules
that out.

**Rule of thumb.** If you can hand out unique numbers cheaply, do that instead
of generating random ones and handling collisions.

## Decision: cache in front of the store

That gets `x7Kp2Qa` minted. Serving it 40,000 times a second is harder, and
the [cache](/systems-and-infrastructure/caching) does most of the work. Clicks bunch up on popular
links, so 35 GB can plausibly answer 90% of lookups in under a millisecond,
leaving the URL store 4,000 reads a second at peak. Links can't be edited, so a
24-hour TTL (how long the cache keeps an entry) costs little: each entry
carries its link's expiry, and disabling a link deletes its entry
([cache invalidation](/systems-and-infrastructure/cache-invalidation)).

Why not just read from the store's three copies, as
[read replicas](/systems-and-infrastructure/read-replicas)? A database read
costs far more per request than a cache lookup, so 40,000 a second means many
more store servers, and a lagging copy can answer `404` for a link created a
second ago.

**Rule of thumb.** Read-heavy, a small hot set, data that rarely changes: put a
cache in front and size it to the hot set, not the dataset.

## Decision: count clicks through a queue

The **hot path** is the code
every redirect runs, and anything you add there costs you 40,000 times a
second. So the redirect hands a small event to a
[message queue](/systems-and-infrastructure/message-queues), which holds it for
a worker, and answers without waiting. Workers sum events per code per minute
and write totals in batches: 100 clicks on `x7Kp2Qa` in a minute become one
write ([batching](/systems-and-infrastructure/batching-and-asynchronous-writes)).
An analytics outage lengthens the queue instead of failing redirects.

Why not increment a counter in the cache you already call? It roughly doubles
the cache's load at peak, and counts held in memory vanish when the cache
drops an entry or restarts, with no raw events to rebuild from. The queue's price: counts lag a
minute, and a redelivered event counts twice unless workers skip repeated event
IDs.

**Rule of thumb.** Work the user isn't waiting for comes off the hot path:
record an event and do it later.

## Likely follow-ups

- **What if `x7Kp2Qa` goes viral?** When its cache entry expires, hundreds of
  requests miss at once, a
  [thundering herd](/systems-and-infrastructure/thundering-herd-problem). Let
  one request per code on each server read the store while the rest wait.
- **What if the ID allocator goes down?** Each server claims its next block at
  half used, so it still holds at least 5,000 IDs, about two minutes at its
  peak share of 40 creates a second. Redirects don't touch it.
- **Could this run on PostgreSQL?** Yes: 3 TB and 400 writes a second fit one
  primary (the server taking writes) for years, and rows split cleanly by code
  later
  ([sharding](/systems-and-infrastructure/partitioning-vs-sharding)).
- **How do you stop spammers?** Limit creates per API key across all servers
  ([rate limiting](/systems-and-infrastructure/rate-limiting)) and check new
  links against a blocklist. Disabling a flagged link deletes its cache entry
  (the 24-hour TTL catches a missed delete).
