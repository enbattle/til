---
title: Design a URL Shortener (like TinyURL)
summary: Turning long links into seven-character codes, and the ID scheme, read path and click pipeline that let one small service answer tens of thousands of redirects a second.
date: 2026-09-28
order: 1
---

A URL shortener takes a long address, say a 90-character link to a blog post
with tracking parameters on the end, and gives back a short one,
`https://sho.rt/x7Kp2Qa`. Anyone who opens the
short link is sent on to the long one. The part after the slash, `x7Kp2Qa`, is
the **short code**, and sending a browser from one address to another is a
**redirect**: the server answers with an HTTP status code in the 300s and a
`Location` header naming where to go next, and the browser follows it.

It is a common first system design exercise because the product fits in one
sentence, yet it touches most of the standard decisions: how to mint unique
IDs, how to serve a read-heavy workload from memory, and how to record events
without slowing the thing users are waiting for. What follows is one plausible
design for a service like TinyURL or Bitly, not a description of how any
particular company built theirs.

## Requirements

Functional requirements say what the system does:

- **Shorten.** Given a long URL, return a short link. Creating the same long
  URL twice returns two different short links; each creation is its own link
  with its own owner, expiry and click count.
- **Redirect.** Opening a short link sends the browser to the long URL.
- **Custom alias (optional).** A user can ask for a specific code, such as
  `sho.rt/spring-sale`, and gets an error if someone already has it.
- **Expiry (optional).** A link can carry an expiry date, after which it stops
  redirecting.
- **Analytics (stretch goal).** Count clicks per link, minute by minute, which
  add up to totals for any hour or day.

Out of scope, to keep the design honest about what it covers: user sign-up
and billing (assume each request carries an **API key**, a secret string the
service issued to one customer, which it can look up to tell which owner is
asking), editing a link's destination after creation, link previews, a web
dashboard, and click breakdowns by country or referring site. Each of these is
a real product feature, but none changes the core architecture; the click
events below already carry a country and a referrer, so breakdowns could be
added later from them.

Non-functional requirements say how well it must do it, with numbers so they
can be checked:

- **Scale:** 100 million new links a month, and 100 redirects for every link
  created, so 10 billion redirects a month. Links are kept for five years
  unless they expire sooner.
- **Latency:** a redirect should add less than 20 ms at the 99th percentile,
  measured at our servers. The 99th percentile (p99) is the time that 99% of
  requests beat; it matters more than the average because one slow redirect in
  a hundred is still 100 million slow redirects a month.
- **Availability:** redirects 99.99% (about 4.3 minutes of downtime in a
  30-day month, since 30 × 24 × 60 = 43,200 minutes and 0.01% of that is 4.32).
  Creating links can be less strict, 99.9%. A broken redirect breaks every
  page and email that ever used the link; a failed create only affects the
  person trying it, who can retry.
- **Codes:** generated codes are at most 7 characters, and not trivially
  guessable one after another. A custom alias is chosen to be read, so it has
  its own limit: 4 to 30 characters of letters, digits and hyphens.

Two of those numbers pull in different directions, and it helps to name them
now. Latency is how long one request takes; throughput is how many requests
the system finishes per second. Tuning for one can cost the other, a trade
that [latency vs. throughput](/systems-and-infrastructure/latency-vs-throughput)
covers. Here the redirect path needs both at once, and the click-counting path
needs throughput but can accept minutes of delay, which is what lets the
design move analytics off to the side later on.

## Back-of-the-envelope estimates

The point of estimating is to find out which parts are hard before designing
them. Rounded figures are fine; the ratios between them are what matter. Two
rules of thumb from
[numbers every engineer should know](/engineering-practices/numbers-every-engineer-should-know)
are used below: one million requests a day is about 12 a second, and a
system should be planned for a peak of about ten times its average. The rest is
arithmetic, starting from a day of 24 × 60 × 60 = 86,400 seconds.

**Writes (links created).** A 30-day month is 30 × 86,400 = 2,592,000
seconds, about 2.6 million.

- Average: 100,000,000 ÷ 2,592,000 ≈ 39, call it **40 writes per second**.
- Peak, at ten times average: **about 400 writes per second**.

**Reads (redirects).** 100 times the writes:

- Average: 10,000,000,000 ÷ 2,592,000 ≈ 3,860, call it **4,000 redirects per
  second**. The rule of thumb agrees: that is about 333 million a day, and 333
  × 12 ≈ 4,000.
- Peak: **about 40,000 redirects per second**. A single viral link can add a
  sharp spike on top of this, which the read path deep dive deals with.

**Storage over five years.** 100 million links a month for 60 months is
**6 billion links**. Each stored link holds the code (7 bytes), the long URL
(allow up to 2,048 characters, but most are around 100), two timestamps, an
owner ID, and the storage engine's own overhead for indexes and bookkeeping.
Rounding that generously up to 500 bytes per link:

- 6,000,000,000 × 500 bytes = 3,000,000,000,000 bytes = **3 TB**.
- Keeping three copies for durability makes it about 9 TB of disk.

**Cache memory.** Redirects are lopsided: a small share of links gets most of
the clicks. A common starting rule is to keep enough memory for 20% of a day's
requests.

- A day's redirects: 10,000,000,000 ÷ 30 ≈ 333 million.
- 20% of those: about 67 million entries.
- At 500 bytes each: 67,000,000 × 500 = 33.5 GB, so **about 35 GB of cache**.

That is an upper bound, since many of those 67 million requests are for the
same popular links. It fits in the memory of one large server, but spreading
it over a few smaller ones gives headroom and survives losing one.

**How many codes are needed.** A short code is written in **base62**, the 62
characters `0-9`, `a-z` and `A-Z` (10 + 26 + 26), all of which are safe in a
URL. Each character multiplies the number of possible codes by 62:

- 6 characters: 62⁶ = 56,800,235,584, about 57 billion.
- 7 characters: 62⁷ = 3,521,614,606,208, about **3.5 trillion**.

Six characters would already cover the 6 billion links of the five-year plan
almost ten times over. Seven buys enormous headroom and, more usefully, makes
the codes in use a sparse scattering (under 0.2%) across the space of possible
codes, so a random guess almost never lands on a real link.

What the estimates say: writes are trivial (400 a second is nothing for any
database), storage is modest, and the whole difficulty is serving 40,000 small
reads a second quickly and reliably. Design effort should go to the read path.

## Data model

Every redirect asks the same question, "what long URL belongs to this code?",
and every create asks "is this code free?" Both are lookups of one record by
one key. There are no joins, no queries across links, and no transaction that
touches two links at once. That shapes the storage choice more than anything
else.

One table, keyed by code:

```text
links
  code        string, primary key   "x7Kp2Qa" or a custom alias
  long_url    string                up to 2,048 characters
  owner_id    string                the owner the creating API key belongs to
  created_at  timestamp
  expires_at  timestamp, nullable   null means it never expires
```

`owner_id` is the ID of whoever the API key belongs to, looked up from the key
when the link is created, not the key itself. A key is a credential: copied
into 6 billion rows, it would sit in every copy and backup of the store, where
anyone who can read the data could use it, and replacing a leaked key would
mean rewriting every link it ever made.

The code is the primary key, so the store keeps an **index** on it: a lookup
structure from each code to where its row is stored, like the index at the
back of a book. Each lookup goes straight to its row through it instead of
scanning 6 billion rows. The index does not, on its own, stop two links from
sharing a code: in the store chosen below, writing a row under a code that
already exists simply replaces the old row. Uniqueness comes from the
conditional insert described under "Deep dive: generating short codes".

A single access pattern by key is what a **key-value store** is built for: it
keeps each row under one key, finds it only by that key, and spreads rows
across machines by key without any extra work. DynamoDB is a well-known
example. A **wide-column store** such as Cassandra is a close relative whose
rows can hold many named columns but are still found by key, and it would fit
too. [SQL vs. NoSQL](/systems-and-infrastructure/sql-vs-nosql) walks through
why these suit this data, which never needs the joins or multi-row
transactions a relational database is good at. A key-value store is the choice
here. It is not the only defensible one: 3 TB and
400 writes a second fit comfortably for years in a single PostgreSQL server
that takes every write (the **primary**), with a few read-only copies of it
answering reads, and a relational database would be a sound pick for a
team that already runs one. If it ever outgrew one machine, the data splits
cleanly by code, because no query ever needs two codes at once. Each code
would be run through a **hash function**, which turns any input into a number
that looks random but is always the same for the same input, and that number
would pick its machine;
[partitioning vs. sharding](/systems-and-infrastructure/partitioning-vs-sharding)
covers what that step involves.

Click analytics do not live in this table. A click is an event, not a property
of the link, and writing one per redirect into the links table would put 4,000
writes a second on the store that serves redirects. Clicks go to a separate
analytics store, covered in the last deep dive.

## API design

Two endpoints carry the product.

**Create a short link**

```http
POST /urls
Authorization: Bearer <api-key>
Content-Type: application/json

{
  "long_url": "https://example.com/blog/2026/09/an-article-with-a-very-long-title",
  "custom_alias": "spring-sale",
  "expires_at": "2027-01-01T00:00:00Z"
}
```

The `Authorization` header carries the caller's API key. `Bearer` is the
standard word in front of it, and means the request is allowed for whoever
holds (bears) that key. `custom_alias` and `expires_at` are optional. The
responses:

- `201 Created` with `{ "code": "spring-sale", "short_url": "https://sho.rt/spring-sale", "expires_at": "2027-01-01T00:00:00Z" }`.
- `400 Bad Request` if `long_url` isn't a valid `http` or `https` URL, or the
  alias isn't 4 to 30 characters of base62 and `-`.
- `409 Conflict` if the alias is taken.
- `429 Too Many Requests` if the API key is over its creation limit (see
  failure modes).

A client that times out and retries a `POST` can end up creating two links for
one intent. Accepting an optional `Idempotency-Key` header, and returning the
original response when the same key is seen again, makes the retry safe; that
technique is the subject of [idempotency](/systems-and-infrastructure/idempotency).

**Follow a short link**

```http
GET /x7Kp2Qa

HTTP/1.1 302 Found
Location: https://example.com/blog/2026/09/an-article-with-a-very-long-title
```

An unknown code gets `404 Not Found`, and an expired one `410 Gone`, which
tells the client the link existed but was retired on purpose.

**301 or 302.** Both status codes redirect, and the difference is caching.
`301 Moved Permanently` says the move is permanent, so browsers may cache it,
and a browser that has cached it goes straight to the long URL next time
without asking us. `302 Found` is treated as temporary and is not cached unless
the response explicitly says it may be. A 301 therefore saves traffic and makes
repeat visits faster, but those repeat clicks become invisible to us, and if a
link has to be disabled (it turned out to point at a phishing page) or reaches
its expiry, browsers that cached the 301 keep following it.

A 301 can be kept out of caches: sent with `Cache-Control: no-store`, it must
not be stored by any cache, the browser's included (RFC 9111, the HTTP caching
standard, says so for every response carrying that directive), so every click
still reaches us. But a 301 that is never cached saves nothing over a 302.
This design uses **302**: expiry and disabling are requirements, and so is
counting clicks, and the extra traffic is exactly the load the read path is
built for.

## High-level architecture

![Architecture of the URL shortener. A browser or API client sends POST /urls and GET /{code} to a load balancer, which spreads them across identical app servers. The app servers read the cache first, read the URL store on a cache miss and insert new links into it, claim blocks of IDs from an ID range allocator, and publish click events to a click queue. Analytics workers consume the queue and write batched results to an analytics store.](/diagrams/url-shortener/architecture.svg)

The pieces, from the top:

- The **load balancer** receives every request and spreads them across the
  app servers. It is a reverse proxy, in the sense
  [forward vs. reverse proxy](/systems-and-infrastructure/forward-vs-reverse-proxy)
  describes. It can also terminate TLS, the encryption behind `https://`: it
  decrypts each connection itself, so the app servers behind it speak plain
  HTTP on the private network.
- The **app servers** are identical and keep no state of their own between
  requests, so any server can handle any request and adding servers adds
  capacity.
- The **cache** is an in-memory key-value store (Redis or Memcached, say)
  holding code → long URL for the links being clicked right now.
- The **URL store** is the key-value database from the data model, the source
  of truth for every link.
- The **ID range allocator** hands out blocks of unique numbers that become
  short codes (the first deep dive).
- The **click queue**, **analytics workers** and **analytics store** record
  clicks without the redirect waiting for them (the last deep dive).

Following one redirect, `GET https://sho.rt/x7Kp2Qa`, through it:

1. The browser looks up `sho.rt` in DNS, the internet's directory from domain
   names to server addresses, gets the load balancer's address, and connects
   to it. The load balancer forwards the request to one of the app servers.
2. The app server asks the cache for `x7Kp2Qa`. About nine times in ten it's
   there, and the answer comes back in well under a millisecond.
3. On a miss, the app server reads the row from the URL store, checks that the
   link hasn't expired, and puts the result in the cache for next time.
4. The app server hands a click event (code, time, referrer, country) to the
   click queue without waiting for it to be stored.
5. It answers `302 Found` with the long URL in `Location`, and the browser goes
   there.

Creating a link, `POST /urls`, takes a different route through the same
servers: check the API key's rate limit, validate the URL, take the next
number from the server's current block of IDs, turn it into a code, insert
the row into the URL store only if that code is not already taken, and write
the new entry into the cache as well, so the first click finds it there.

## Deep dive: generating short codes

Every new link needs a code that no other link has, and it has to be decided
quickly on whichever app server happens to take the request. Three approaches
are common.

Whichever one is used, the insert into the URL store is conditional ("insert
only if this code is free"), because custom aliases need that check anyway.
What differs is how often that check fails and forces a retry.

**Hash the long URL.** Run the long URL through a hash function such as
SHA-256, whose output is a fixed-size number (256 bits for SHA-256). Divide that number by 62⁷ and keep the
remainder (the **modulo** operation), which always lands between 0 and
62⁷ − 1, then write it in base62. It needs no coordination between servers.
Its cost is collisions: two different URLs can land on the same 7-character
code, and that happens far sooner than 3.5 trillion possible codes suggests.

The reason is the **birthday problem**. In a room of just 23 people, the odds
are better than even that two of them share a birthday, although there are
365 to choose from. What matters is not the number of people but the number
of pairs of people, any of which could match: 23 people make
23 × 22 ÷ 2 = 253 pairs, and the count of pairs grows with the square of the
number of people. So with N equally likely values, the first shared value
becomes likely once the count reaches about √N, not somewhere near N. (The
50% point is 1.18 × √N; for birthdays that's 1.18 × √365 ≈ 22.5, hence 23.)
For codes, N = 62⁷ ≈ 3.5 × 10¹², √N ≈ 1.9 million, and the odds that some
two links share a code pass 50% at about 1.18 × 1.9 million ≈ 2.2 million
links, less than a day of traffic here.

Over five years, with n = 6 billion links, there are about n² ÷ 2 pairs of
links, and each pair has a 1-in-N chance of sharing a code, so about
n² ÷ (2N) = (6 × 10⁹)² ÷ (2 × 3.52 × 10¹²) ≈ 5 million collisions. Each one
means appending a few extra characters (a salt) to the URL, hashing again and
retrying the insert. As a share of inserts that's small: by the five-year
mark, a new code has a 6 billion ÷ 3.5 trillion ≈ 0.17% chance of hitting one
already taken. Hashing also gives the same URL the same code, which would
deduplicate links for free, but that contradicts the requirement that two
creations give two links with separate owners and counts.

**A global counter in base62.** Keep one counter; each new link takes the next
number and writes it in base62. Every number is used once, so two generated
codes never collide and the conditional insert only ever fails on a clash with
a custom alias. To make every code exactly 7 characters, start the
counter at 62⁶: that number is `1000000` in base62, and counting up to
62⁷ − 1 (`ZZZZZZZ`) leaves 62⁷ − 62⁶ ≈ 3.46 trillion codes. The costs are two.
Every create now needs a round trip to one counter, which becomes a single
point of failure. And consecutive links get consecutive codes (`1000000`,
`1000001`, …), so anyone can walk through them and find links that were meant
to be shared privately.

**Pre-allocated ranges.** Keep the counter, but let each app server claim a
block of IDs at a time, say 10,000, and hand them out from memory. The
allocator can be one row in a **strongly consistent** database, one where
every read sees the latest committed write (a single relational primary is),
advanced **atomically**, meaning the read and the increment happen as one step
so two servers can never be handed the same block:

```sql
UPDATE id_ranges SET next_id = next_id + 10000
WHERE name = 'links'
RETURNING next_id - 10000 AS block_start;
```

Each server claims its next block when its current one is half used, so it
always holds at least 5,000 unused IDs. With, say, ten app servers sharing the
400-a-second peak, each mints 40 a second, so the allocator sees at most
400 ÷ 10,000 = 0.04 block requests a second. If the allocator is briefly down,
servers keep minting from what they hold: at least 5,000 ÷ 40 = 125 seconds,
about two minutes, at peak, and at the 40-a-second average (4 a second each)
at least 5,000 ÷ 4 = 1,250 seconds, over 20 minutes. The costs: unused IDs are
lost if their server crashes (at most 15,000 per crash, harmless with 3.46
trillion to spare), codes are no longer in exact creation order across
servers, and they are still sequential within a block.

**The choice** here is pre-allocated ranges, with one extra step for
guessability: before encoding, pass the ID through a fixed, reversible
scramble, so neighboring IDs produce unrelated-looking codes. A simple one is
to multiply by a constant and keep the remainder. On a toy range of the ten
numbers 0 to 9, multiplying by 3 and keeping the remainder after dividing by
10 sends 0, 1, 2, … 9 to 0, 3, 6, 9, 2, 5, 8, 1, 4, 7. Every input lands on a
different output, which holds because 3 and 10 share no factor other than 1.
It can also be undone: 3 × 7 = 21 leaves a remainder of 1 after dividing by
10, so multiplying an output by 7 and keeping the remainder gives the input
back (4 went to 2, and 2 × 7 = 14 leaves 4). A mapping that is one-to-one and
reversible like this is a **bijection**.

The real range works the same way. Subtract 62⁶ from the ID so the range
starts at 0; it then holds 62⁷ − 62⁶ = 3,464,814,370,624 numbers, which is
62⁶ × 61 = 2⁶ × 31⁶ × 61. Multiply by a constant divisible by none of 2, 31
and 61, such as 2,141,318,506,867, keep the remainder after dividing by the
range size, add 62⁶ back and encode. The IDs 56,801,235,584, 56,801,235,585
and 56,801,235,586, which would be the codes `1004c92`, `1004c93` and
`1004c94`, come out as `g7Ov7l6`, `RP9TlN9` and `uwvhAfc`, and multiplying by
2,899,935,470,459 (the constant's inverse for this range size) turns each one
back into its ID. This hides the order from a casual look, not from someone
who collects a few codes and solves for the constant; the stronger version replaces
the multiplication with an encryption step over the same range that depends on
a secret key. It is still one-to-one and reversible for whoever holds the key,
but a pile of collected codes no longer gives the pattern away. It costs more
code. Because
the scramble is one-to-one, uniqueness is preserved, and generated codes still
never collide with each other. The conditional insert is there for custom
aliases: two requests for `spring-sale` at the same moment both see it as
free, and the conditional insert turns that into one success and one `409`, the
pattern [race conditions](/systems-and-infrastructure/race-conditions)
describes. A generated code that happens to equal an existing 7-character
alias fails the same way and simply takes the next ID.

## Deep dive: the read path

Forty thousand redirects a second at peak, each under 20 ms, is the problem
the estimates pointed at. The answer is to serve almost all of them from
memory and make sure the few that aren't do not pile onto the database. In
the sequence below, each cached entry has a **TTL** (time to live): how long
the cache keeps it before discarding it, 24 hours here, for the reasons under
"Staleness".

![Sequence of one redirect, GET /x7Kp2Qa. The browser sends the request to the app server, which asks the cache for x7Kp2Qa. On a cache hit, the cache returns the long URL. On a cache miss, the cache returns not found, the app server reads row x7Kp2Qa from the URL store, gets back the long URL and expiry, and sets x7Kp2Qa in the cache with a 24-hour TTL. Either way, the app server then sends a click event to the click queue without waiting, and answers the browser with 302 Found and the long URL in the Location header.](/diagrams/url-shortener/redirect-sequence.svg)

**Cache-aside, sized for the popular links.** The app server reads through the
cache and fills it on a miss, the cache-aside pattern. How much this buys
depends on the **hit rate**, the share of lookups the cache answers, and
[caching](/systems-and-infrastructure/caching) covers how placement, working
set and eviction set it. Click traffic is concentrated, so a hit rate around
90% is a reasonable planning figure for the 35 GB from the estimates, evicting
the least recently used entries when full. At the 40,000-a-second peak that
leaves about 4,000 reads a second for the URL store, a tenth of the traffic.

**Staleness.** A cached entry can go out of date when its link expires or is
disabled for abuse. Each entry's 24-hour TTL is cut short to the link's own
`expires_at` when that comes sooner. Disabling a link
deletes its cache entry at the same time as updating the store, with the TTL
as a backstop if that delete is ever missed. Deleting rather than rewriting
the entry, and keeping a TTL anyway, are the reasons
[cache invalidation](/systems-and-infrastructure/cache-invalidation) gives.
Because links are never edited, only disabled or expired, a long TTL costs
little here.

**A viral link.** When a link is being clicked 20,000 times a second, its cache
entry expiring is an event. If refilling it from the store takes 20 ms, about
400 requests arrive in that window, all miss, and all read the same row. That
stampede is the [thundering herd problem](/systems-and-infrastructure/thundering-herd-problem),
and the fix used here is request coalescing: on a miss, one request per key
goes to the store and the others wait for its answer. Adding a little random
jitter to each TTL also stops many popular entries from expiring in the same
second.

**Copies of the store.** The remaining 4,000 reads a second can be spread over
extra read-only copies of the store, and
[read replicas](/systems-and-infrastructure/read-replicas) explains the catch:
a copy can trail the original by a moment. A link is often clicked seconds
after it's created, and a copy that hasn't caught up would answer `404` for a
link that exists. Writing each new link into the cache at creation time, as the
architecture does, covers most of that window. For the rest, a "not found"
from a copy is retried once as a read that must see the latest write (most
stores offer one, at some extra cost) before the redirect answers `404`.

## Deep dive: analytics off the hot path

The **hot path** is the code every redirect runs through, where anything added
is paid up to 40,000 times a second. Counting clicks is a stretch goal, and it
must not cost the redirect anything.
The naive version, writing a row to a database inside every redirect, fails
that on three counts: it adds a database write to the latency of every redirect,
puts 40,000 writes a second at peak on some database, and turns an analytics
outage into a redirect outage.

There are three reasonable ways to do it.

**Increment a counter in the cache.** Each redirect sends one increment for
its code to the cache, which is fast and already in the path. It gives exact
totals cheaply, but only running totals: no counts per minute or per day
without one counter per code per time slot, and a cache is not durable, so a
node restart loses counts.

**Write each click synchronously to a database.** Complete and simple, but it
is the naive version above, with its latency and coupling.

**Publish click events to a queue, and aggregate them in the background.** The
redirect hands a small event (code, timestamp, referrer, country from the IP
address) to a message queue and returns without waiting for it to be stored.
A [message queue](/systems-and-infrastructure/message-queues) holds the events
durably until a consumer takes them, so a slow or failed analytics store only
makes the queue longer, while redirects carry on. Analytics workers read events
off the queue, add them up in memory per code and per minute, and write the
totals in batches. At 4,000 events a second, a link clicked 100 times in a
minute becomes one database write instead of 100; that exchange of freshness
for write volume is what
[batching and asynchronous writes](/systems-and-infrastructure/batching-and-asynchronous-writes)
covers. Raw events are about 200 bytes each, so 4,000 a second is roughly
69 GB a day (4,000 × 200 × 86,400); they can be kept for 30 days for
reprocessing (or for adding the country and referrer breakdowns later), while
the per-minute totals are kept for good.

This design uses the queue. What it costs: counts lag by a minute or so; there
are more moving parts to run; and a queue that redelivers an event after a
worker crash can count a click twice unless each event carries an ID the
workers deduplicate on. Events handed to the queue client but not yet sent can
also be lost if an app server dies, which is acceptable for click statistics
and would not be for anything involving money.

## Failure modes and bottlenecks

**Abuse of link creation.** Anyone can call `POST /urls`, which makes the
service attractive for spam and phishing, since a short link hides where it
goes. Each API key gets a creation limit, enforced across all app servers
rather than per server, as [rate limiting](/systems-and-infrastructure/rate-limiting)
explains; the redirect endpoint gets a much higher per-IP ceiling to blunt
scraping. New links are also checked against a blocklist of known bad domains
in the background, and a flagged link is disabled; because of the 302, that takes
effect as soon as its cache entry is deleted, or within one TTL if the delete
is missed.

**Scanning for codes.** Someone requesting random codes gets `404`s, and every
`404` is a cache miss that reaches the store. The scrambled IDs make scanning
unproductive (under 0.2% of codes exist), per-IP limits on the redirect path
cap it, and caching a "not found" answer for a minute keeps repeated misses
off the store.

**Losing a cache node.** The cache is spread across several nodes by code. If
one fails, the links it held miss until they're refilled, and the store sees a
burst of extra reads. With [consistent hashing](/systems-and-infrastructure/consistent-hashing)
choosing each code's node, a lost node moves only its own share of codes to
the others, rather than reshuffling nearly all of them.

**The URL store is slow or down.** Redirects for links in the cache keep
working, roughly nine in ten at the hit rate above. Everything else fails with
`503 Service Unavailable` until the store recovers, and creates fail too. This
is why the store is replicated across machines, and why the cache is sized
generously rather than tightly.

**The ID allocator is down.** Only creates are affected, and not right away:
each server keeps minting codes from the IDs it already holds, for at least
two minutes at peak and over 20 minutes at average load, as worked out in the
first deep dive. That is the window for restarting or failing over the
allocator's one row before creates start returning `503`.

**Knowing any of this is happening.** The signals worth watching are redirect
latency at p99, cache hit rate, the rate of `404`s, the store's read rate,
how far behind the analytics workers are on the queue, and creates per API key.
A falling hit rate usually explains a rising p99 before anything else does.
[Observability](/systems-and-infrastructure/observability) covers how metrics,
logs and traces split that work.

## Trade-offs

The design above is one set of choices, and each one has a price:

- **302 over 301.** Every click reaches the servers, so expiry, disabling and
  analytics work, at the cost of serving repeat visits a 301 would have sent
  straight from the browser's cache.
- **Pre-allocated ranges over hashing.** Both insert conditionally, since
  custom aliases need it, but a code from a range never collides with another
  generated code, so the insert retries only on a clash with a custom alias.
  The price is running an allocator and scrambling IDs so the codes aren't
  sequential. Hashing would avoid the allocator, but retries on collisions
  (rare, about 0.17% of inserts by the five-year mark, but a path that has to
  be built and tested), and it gives identical URLs the same code, a free
  deduplication these requirements rule out.
- **A key-value store over a relational database.** Scaling out by key is
  built in, at the cost of the ad hoc queries and constraints a relational
  database offers, which this workload barely uses. At today's size, either
  works.
- **Asynchronous analytics.** Redirects never wait on analytics, and
  analytics can fail without taking redirects down, in exchange for counts
  that lag by a minute and can be slightly off after a crash.
- **A 24-hour cache TTL.** Fewer store reads, in exchange for a disabled link
  possibly redirecting for up to a day if its explicit cache delete is
  missed.

What would change the design: if redirects grew another tenfold, the next
step would be caching the most popular redirects at the load balancer or a CDN
(a network of caching servers close to users), so they never reach an app
server at all. If link destinations became editable, the TTL and the 302
would matter more, since every stale cache entry would then be a wrong
redirect rather than a late one.
