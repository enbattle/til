---
title: Design a Ticket Booking System (like Ticketmaster)
summary: Selling 50,000 seats to two million fans in one minute, with a waiting room that meters entry, ten-minute holds taken by conditional writes, and a confirm that is safe to retry.
date: 2026-09-28
order: 10
---

A ticket booking system sells seats for concerts, sports and theater. A fan
opens an event, sees a map of the venue with the free seats marked, picks two
seats, and gets a few minutes to pay before those seats go back on sale. On
most days that is a small, quiet workload: a few orders a second spread over
thousands of events.

The hard day is the **on-sale**, the announced moment when tickets for a
popular event first become available. A stadium tour puts 50,000 seats on sale
at 10:00, and two million people are there at 10:00, all wanting the same
few thousand best seats, each of which can be sold exactly once. The design is
mostly about contention: who gets to write a seat, how fast, and what everyone
else sees while they wait.

What follows is one plausible design for a service like Ticketmaster, not a
description of how any particular company built theirs.

## At a glance

**Requirements.**

- Hold up to 8 seats, or a general-admission quantity, for one user for 10
  minutes; unpaid holds go back on sale.
- Never sell a seat twice; a charged user gets tickets or, rarely, a refund.
- The largest on-sale: 50,000 seats, 2 million people in the first minute, up
  to 5 at once.
- A waiting room admits at a controlled rate: early arrivals in random order,
  later ones in arrival order, one place per account.
- Holds answer in under 500 ms at p99 once admitted; the seat map may be up to
  10 seconds stale.

**Key numbers.** From the estimates:

- About 33,000 new visitors a second in the first minute (2,000,000 ÷ 60).
- 20,000 orders can succeed, 1% of arrivals (50,000 seats ÷ 2.5 per order).
- About 33,000 admitted shoppers are enough (20,000 orders ÷ the 60% who buy),
  about 133 seconds at 250 a second.
- About 500 holds a second behind the waiting room (250 admitted a second × 2
  attempts).
- About 500 changes a second is one row's ceiling (1 ÷ a 2 ms commit).

**Key decisions.**

- A virtual waiting room over a rate limit: a rejected request just retries,
  while a place in line serves people in a chosen order
  ([the waiting room](#deep-dive-the-on-sale-spike-and-the-waiting-room)).
- Conditional updates on per-seat rows, with general-admission counters split
  into 10 buckets: the check sits inside the write, and no row nears its
  ceiling ([holding a seat](#deep-dive-holding-a-seat-without-selling-it-twice)).
- Confirm moves the hold to `paying` before charging, keyed by the hold ID: the
  sweeper leaves a paying hold's seats alone until its payment deadline, and a
  retried confirm charges once
  ([confirm](#deep-dive-hold-expiry-payment-and-an-idempotent-confirm)).

**Likely follow-ups.**

- How do lapsed holds go back on sale? A new hold can take over a lapsed
  hold's seat, and a per-shard sweeper releases lapsed holds every 5 seconds
  so the seats reappear on the map
  ([hold expiry](#deep-dive-hold-expiry-payment-and-an-idempotent-confirm)).
- How do 2 million browsers read the seat map? A per-event bitmap, rebuilt and
  cached on the CDN each second
  ([the seat map](#high-level-architecture)).
- What if someone clicks a seat that's already taken? The conditional update
  refuses it, and the `409` carries a fresh bitmap
  ([holding a seat](#deep-dive-holding-a-seat-without-selling-it-twice)).
- When would you switch to a single writer per event? When one event must take
  many thousands of holds a second, such as without the waiting room
  ([holding a seat](#deep-dive-holding-a-seat-without-selling-it-twice)).

How the pieces fit together is in
[High-level architecture](#high-level-architecture).

## Requirements

Functional requirements:

- **View the seat map**: the venue's layout, each seat marked available or
  not, and prices.
- **Hold seats.** For **reserved seating** (every ticket is a specific seat,
  such as section 114, row K, seat 12), a user picks up to 8 seats, or asks for
  "best available" in a price tier. For **general admission** (GA, a standing
  floor where tickets are interchangeable), a user asks for a quantity. Either
  way the tickets are held for that user alone for 10 minutes.
- **Pay and confirm** within the hold, turning it into an order with tickets;
  an unpaid hold expires and its seats go back on sale.
- **A waiting room** for on-sales expected to draw far more people than
  seats: visitors queue before the seat map and are let in at a controlled
  rate.
- **A per-account limit** of 8 tickets held or bought per event, to make
  buying for resale harder.

Out of scope: resale and transfers, dynamic pricing, venue setup tools,
refunds for cancelled events, gate scanning, search, and the payment service
itself. Payment is a call to a separate service that charges a card, honors an
**idempotency key** (a unique ID the caller attaches so that a repeated
request with the same key is carried out only once), and can **void** a key
that has no charge yet, so that any later charge with it is refused.
Confirmation emails go through a notification system like the one in
[Design a Notification System](/system-design/notification-system).

Non-functional requirements:

- **Everyday scale.** About 100,000 events are on sale at any time, averaging
  2,000 seats each. 500,000 tickets are sold a day, in orders of 2.5 tickets
  on average, and event pages with seat maps are viewed 20 million times a day.
- **On-sale scale.** The largest on-sales are 50,000 seats with 2 million
  people arriving in the first minute, and up to 5 of them may open at the same
  time.
- **Never sell a seat twice**, with no tolerance at all. A user who is charged
  ends up with their tickets or, in a rare case described below, a refund.
- **Latency.** Once a user is past the waiting room, a hold request answers in
  under 500 ms at the 99th percentile (p99, the time 99% of requests beat). The
  seat map's availability may be up to 10 seconds out of date, as long as a
  hold is never granted on a seat that is already taken.
- **Availability.** 99.95% for browsing and booking (about 22 minutes of
  downtime in a 30-day month: 43,200 minutes × 0.05%). The waiting room, the
  front door on the worst day, is held to 99.99%.
- **Fairness.** People who arrive before the on-sale opens are let in in random
  order; people who arrive after are let in in arrival order; one account gets
  one place in the queue.

## Back-of-the-envelope estimates

The everyday workload and the on-sale differ by two orders of magnitude, so
they are estimated separately. The rules of thumb are from
[numbers every engineer should know](/engineering-practices/numbers-every-engineer-should-know):
a day is 86,400 seconds, and a peak of ten times the average is a reasonable
planning figure for ordinary traffic.

**An ordinary day.**

- Orders: 500,000 tickets ÷ 2.5 per order = 200,000 orders a day, and
  200,000 ÷ 86,400 ≈ **2.3 orders a second**, about 23 a second at peak.
- Hold attempts: assume two per order (some holds fail because a seat was
  just taken, some are abandoned), so about 5 a second, 46 at peak.
- Seat map views: 20,000,000 ÷ 86,400 ≈ 231 a second, **about 2,300 a second
  at peak**.

**Storage.**

- Seats on sale: 100,000 events × 2,000 seats = 200 million seat rows. At
  about 100 bytes each that is 20 GB, about 40 GB with indexes.
- Tickets sold: 500,000 a day × 365 ≈ 183 million a year; at about 200 bytes
  each with its order, about 37 GB a year, 183 GB over five years.

The everyday load would fit on one database server.

**The on-sale, if nothing stands in front of the booking system.**

- Arrivals: 2,000,000 ÷ 60 ≈ **33,000 new visitors a second** for one event.
- Requests: loading the event page, the seat map and its availability, then
  trying a hold, is about 5 requests per visitor, so about 167,000 requests a
  second for one event, and about 830,000 a second with five on-sales at once.
  One on-sale is about 72 times the whole site's everyday peak of 2,300.
- Availability refreshes: a seat map that re-fetches availability every 5
  seconds, open in 2 million browsers, is 2,000,000 ÷ 5 = **400,000 reads a
  second** of the same data.
- Hold attempts: at least one per arrival, so around 33,000 a second in the
  first minute, nearly all aimed at the best few thousand seats.
- Who can succeed: 50,000 seats ÷ 2.5 per order = 20,000 orders, 1% of the 2
  million. Every failure invites a retry.

**The on-sale with a waiting room in front.** Only the people who can
plausibly buy need to be inside at once.

- Assume 60% of the people let in end up buying (the rest dislike the seats
  left, abandon, or are declined). Selling 20,000 orders then takes
  20,000 ÷ 0.6 ≈ **33,000 admitted shoppers**.
- Admitting 250 a second gets through them in 33,333 ÷ 250 ≈ 133 seconds,
  a little over two minutes.
- Hold attempts: 250 shoppers a second × 2 attempts ≈ **500 holds a second**.
- Confirms: 20,000 orders over those ~133 seconds ≈ 150 a second.
- Availability refreshes: at most 33,000 shoppers inside, every 5 seconds, is
  about 6,700 reads a second, served from a cache.
- Waiting-room status checks: 2 million people asking "is it my turn?" every
  20 seconds is 100,000 requests a second, all with the same answer, so
  cacheable.

The waiting room turns 33,000 arrivals a second into 250 admissions a second,
and everything behind it can be sized for 500 holds a second on one event
instead of 33,000.

## Data model

A hold changes several seats at once, all or none, with a condition on each;
a confirm changes the seats, the hold and the order together. Multi-row
conditional transactions are what a relational database does well, so the
inventory lives in one (PostgreSQL, say).

```text
events
  event_id       primary key
  venue_id, name, starts_at, on_sale_at
  layout_version  which seat layout this event uses
  seating         reserved | ga | mixed
  protected       whether a waiting room guards the on-sale

seats              one row per sellable seat per event
  event_id, seat_id   primary key together; seat_id like "114-K-12"
  seat_index          position of the seat in the availability bitmap
  price_tier
  status              available | held | sold
  hold_id             which hold has it, when held
  held_until          when that hold lapses, when held
  order_id            when sold

ga_buckets         GA inventory as counters, split into buckets (see below)
  event_id, section_id, bucket   primary key together
  available           tickets left in this bucket

holds
  hold_id         primary key, a random UUID
  event_id, account_id
  client_key      unique per account: the client's idempotency key
  seats           the seat IDs, or GA section, bucket(s) and quantity
  status          active | paying | payment_unresolved | confirmed | expired
                  | released | refund_due
  expires_at      created_at + 10 minutes
  pay_deadline    set when payment starts

account_event_tickets   tickets held or bought per account per event
  event_id, account_id  primary key together
  tickets               held + sold, never above 8

orders
  order_id        primary key
  hold_id         unique: one hold becomes at most one order
  event_id, account_id, amount, payment_ref, created_at

tickets
  ticket_id, order_id, event_id, seat_id, barcode
  event_id, seat_id   unique for reserved seats: a backstop against selling
                      a seat twice

outbox
  id, event_id, type, payload, created_at, published_at
```

Every table is split by `event_id` across eight **shards**, separate
databases each holding a share of the events. Each shard has a **primary**
that takes all its writes, a **standby** in another **availability zone** (a
separate data center in the same region) that receives every write before the
primary confirms it, and read-only **replicas** for reads that can be a moment
behind. One event's rows share a shard, so a hold or confirm never spans two
databases
([partitioning vs. sharding](/systems-and-infrastructure/partitioning-vs-sharding)).

The sizes above would fit on one server; eight shards are for isolation. One
event mid on-sale keeps a primary busy with close to a thousand transactions a
second (500 hold attempts, two transactions per confirm, and the releases),
and it should not slow down the other 99,999 events. Hashing `event_id` could
put two big on-sales on the same shard, so the mapping is a small lookup
table instead, and each protected on-sale gets a shard with no other on-sale
that hour; eight shards leave room for the five that can run at once.

`holds.client_key` (unique per account) makes hold creation safe to retry,
`orders.hold_id` (unique) makes confirm safe to retry, and the `outbox` table
announces a confirmed order without a second write that could be lost. The
venue's layout (each seat's position, section, row and label) is a file per
layout version, not in the database; it never changes during a sale, so it
can be cached anywhere.

## API design

**Joining the waiting room** (only for protected events):

```http
POST /waiting-room/ev_8812/join
→ 200 { "queue_token": "...", "position": 184213 }

GET /waiting-room/ev_8812/status
→ 200 { "admitted_up_to": 170000, "rate_per_second": 250, "state": "admitting" }

POST /waiting-room/ev_8812/admit
{ "queue_token": "..." }
→ 200 { "admission_token": "..." }   or 403 if it isn't this token's turn yet
```

The status response is the same for everyone and is cached for a second. The
client compares its own position against `admitted_up_to` and shows an
estimated wait, (184,213 − 170,000) ÷ 250 ≈ 57 seconds here.

**Reading the seat map:**

```http
GET /layouts/v31.json               → the static layout, cached for a year
GET /events/ev_8812/availability    → a bitmap of free seats, cached for 1 s
```

**Holding seats** (for a protected event, the request carries the admission
token):

```http
POST /events/ev_8812/holds
Idempotency-Key: 3f1c...
{ "seat_ids": ["114-K-11", "114-K-12"] }
```

or `{ "section": "floor", "quantity": 2 }` for GA, or
`{ "best_available": { "price_tier": "B", "quantity": 2 } }`.

- `201 Created` with `{ "hold_id": "h_51c0...", "expires_at": "2026-10-03T10:12:40Z" }`.
- `409 Conflict` if any requested seat is taken, with the seats that were
  and the current availability of that section, so the map can update.
- `403 Forbidden` without a valid admission token for a protected event.
- `422 Unprocessable Content` if the hold would take the account over 8
  tickets for the event.

A hold is not naturally safe to repeat: a client that times out and retries
would otherwise end up with two holds, twice the seats, and half its ticket
limit gone. The `Idempotency-Key` is stored as `holds.client_key`, and a retry
with the same key returns the hold it already made
([idempotency](/systems-and-infrastructure/idempotency)).

**Releasing and confirming:**

```http
DELETE /holds/h_51c0...
POST /holds/h_51c0.../confirm   { "payment_method": "pm_..." }
```

Confirm answers `200 OK` with the order, `402 Payment Required` if the card was
declined (the user can try another while the hold lasts), `409 Conflict` if
the hold has expired, or `202 Accepted` if the payment result isn't known yet,
and the client polls `GET /holds/{id}`. The hold ID serves as confirm's
idempotency key. Release and confirm need only a hold owned by the caller's
account, not the admission token, so a confirm retried after the token lapses
still works.

## High-level architecture

![Architecture of the ticket booking system. The browser fetches the static layout, availability bitmaps and waiting-room status through a CDN, which fetches availability from the seat map service on a miss. The browser joins and is admitted through the waiting room, then sends holds and confirms to the API gateway, which checks admission tokens and rate limits and passes them to the booking service. The booking service makes conditional writes to the inventory database, which is sharded by event with a primary, a standby and replicas, calls the payment service to charge with the hold ID as idempotency key, and reports load and remaining seats back to the waiting room. The seat map service reads replicas once a second per event. The hold sweeper releases expired holds in the inventory database and asks the payment service about stuck payments. An outbox relay reads confirmed orders from the database's outbox table and publishes them to an order events queue, which feeds ticket issuing and email.](/diagrams/ticket-booking/architecture.svg)

The pieces:

- The **CDN** (content delivery network), caching servers close to users,
  serves the layout, the availability bitmap and the waiting-room status, all
  the same for every viewer, so the 100,000 status checks a second barely
  reach our servers.
- The **waiting room** gives each visitor a place in line and, in turn, an
  admission token (the first deep dive).
- The **API gateway** checks the admission token and applies per-account and
  per-IP rate limits.
- The **booking service**, stateless on many servers, turns a hold or confirm
  into a short conditional transaction on the event's shard (the second deep
  dive) and calls the payment service.
- The **inventory database** is the sharded PostgreSQL from the data model,
  the one source of truth for who holds or owns each seat.
- The **seat map service** builds each event's availability bitmap from a
  replica once a second.
- The **hold sweeper** releases holds past their expiry (the third deep dive).
- The **outbox relay** and **order events queue** carry confirmed orders to
  ticket issuing and email.

The sequence below follows one shopper on a protected on-sale, including a
hold that runs out. (The sweeper's release is drawn on the database's
lifeline, to keep the diagram narrow.)

![Sequence of one shopper across the user, waiting room, booking service, inventory database and payment service. The user joins and gets a queue token with position 184,213, sees admitted_up_to 184,500 in the cached status, and is given an admission token. The booking service holds seats 114-K-11 and 114-K-12 for hold h1 with a conditional update, expiring in 10 minutes. In the group "The user walks away for 10 minutes", the hold sweeper releases h1 (drawn on the database's lifeline); the user's confirm of h1 fails to move it from active to paying and gets 409 hold expired. The user holds the same seats as h2 and confirms: the booking service moves h2 from active to paying and extends its deadline, charges through the payment service with key h2, then marks h2 confirmed and the seats sold, writes the order and an outbox row, and answers 200 with the order.](/diagrams/ticket-booking/shopper-sequence.svg)

**The seat map.** The layout is served from the CDN under a versioned URL
(`/layouts/v31.json`) and cached for a year; a new version gets a new URL.
Availability is a **bitmap**, one bit per seat in `seat_index` order:
50,000 ÷ 8 = 6,250 bytes, about 7 KB with per-section counts and prices.
Querying the database per request would be 6,700 reads a second each scanning
50,000 rows; pushing changes to browsers
([WebSockets vs. SSE vs. long polling](/systems-and-infrastructure/websockets-vs-sse-vs-long-polling))
would need 33,000 held-open connections, for a map that only has to be roughly
right. Instead the seat map service rebuilds each hot event's bitmap from a
replica once a second and serves it with a one-second **TTL** (time to live:
how long a cache may keep it), and browsers poll every 5 seconds. The origin
sees about one request a second per event per CDN location, and **request
coalescing** (the first request after expiry fetches while the others wait)
avoids the stampede [caching](/systems-and-infrastructure/caching) warns
about. A view is at worst about 8 seconds old (5 since the last poll, 1 in the
CDN, 1 since the rebuild, about 1 of replica lag), inside the 10-second
requirement, and a stale click is safe because the hold is the check.

## Deep dive: the on-sale spike and the waiting room

**Autoscaling** (adding servers automatically as load rises) takes minutes;
the spike takes seconds. Even with enough servers, 33,000 hold attempts a
second would reach the database, concentrated on the front sections. Losers
click the next seat or time out and retry, so every failure adds a request,
latency climbs, and clients retry harder: the
[thundering herd problem](/systems-and-infrastructure/thundering-herd-problem)
across a whole site. Who gets tickets is then decided by whose retries land,
which favors scripts. The fix is to keep most of the 2 million out of the
booking system and decide their order somewhere cheap.

**Option 1: rate-limit the booking endpoints.** Allow, say, 500 hold
requests a second on the event and answer the rest with `429 Too Many
Requests`, as a [rate limiter](/system-design/rate-limiter) would. This
protects the database with existing machinery, but a rejected request carries
no memory: the limiter absorbs 33,000 retries a second, and whoever retries
most gets through. Bots retry better than people.

**Option 2: a virtual waiting room.** Defer the excess instead: each visitor
gets a numbered place, stops sending booking requests, and waits to be called.
The admission rate is a single global rate limit
([rate limiting](/systems-and-infrastructure/rate-limiting)) applied to people
entering, in order rather than by luck. The costs: a new component on the
critical path of every on-sale, a visible wait, and admission tokens the
gateway has to check.

The waiting room is the choice, with the gateway's ordinary rate limits kept
behind it. How it works:

**Places in line.** Visitors who open the event page in the 30 minutes before
the on-sale go into a **lobby**, and at 10:00 each gets a random position, so
arriving at 09:59:59.9 is no better than at 09:40. The lobby is a sorted set
in Redis (an in-memory data store), scored by a random number drawn at join
and added with `ZADD NX` so rejoining can't re-roll it. Later arrivals take
the next number from a counter that starts at the lobby's size (`INCR`), stored under the account ID with
`SET NX`, so an account keeps its first position and the unused number is a
gap admission passes over. At the peak that is about 33,000 joins a second,
two commands each, about 66,000 commands a second. A single Redis instance
commonly handles on the order of 100,000 simple commands a second, so each
protected event gets two instances, counter and positions, each taking about
33,000 a second with about three times headroom.

**Tokens instead of sessions.** The position goes into a **queue token**
(event, account, position, time issued) signed with a key only the waiting
room and gateway hold; a [JWT](/security/jwt) is a common format. Nobody can
change the position without breaking the signature, and checking it needs no
lookup, so the 2 million waiting clients hold their own state, and the cached
status turns 100,000 checks a second into one origin fetch a second per CDN
location. When `admitted_up_to` passes a client's position, it trades the
queue token for an **admission token**, bound to the account and valid for 20
minutes (time to pick seats, plus a 10-minute hold); trading the same queue
token twice returns the same admission.

**Choosing the rate.** Too slow leaves seats unsold; too fast recreates the
stampede. The booking service reports hold latency, error rate, and remaining
and held tickets every few seconds, and the waiting room backs off when p99
hold latency rises ([backpressure](/systems-and-infrastructure/backpressure)
at the front door) and slows as inventory runs out. When everything left is
held, admission trickles on as holds expire; when nothing is left, 1.9 million
people are told sold out instead of watching a spinner.

**Bots.** Several measures raise the cost: a signed-in account to join, one
place per account, a CAPTCHA or device check when signals look automated, the
8-ticket limit enforced in the database, and a random lobby order. An
operation with many real accounts still gets through.

## Deep dive: holding a seat without selling it twice

A hold must check that every requested seat is free and mark them all held,
as one indivisible step. If two users both see seat 114-K-12 free and both
mark it held, it's sold twice: the check-then-act bug
[race conditions](/systems-and-infrastructure/race-conditions) describes.

**The hot-row number.** A transaction that changes a row locks it until it
commits, and here a commit waits for the log to reach disk and for the
standby in another availability zone to confirm it. Call that 2 ms. Two
transactions that change the same row go one after another, so a change made
as the last statement before `COMMIT` lets a row take at most about
1 ÷ 0.002 s = **500 changes a second**, however many CPUs the server has;
every statement after the change lowers that
([optimistic vs. pessimistic locking](/systems-and-infrastructure/optimistic-vs-pessimistic-locking)).

**Option 1: pessimistic row locks.** Read the seat rows with
`SELECT ... FOR UPDATE`, which locks them, check in application code that all
are available, update them, insert the hold, commit. Locking in seat-ID order
avoids a **deadlock** (two holds waiting on each other in a circle). It is
correct, but locks are held across several round trips, so a booking server
that stalls mid-transaction keeps other shoppers waiting on those seats.

**Option 2: conditional updates.** Put the check inside the write. The
transaction first inserts the hold row, with
`ON CONFLICT (account_id, client_key) DO NOTHING`; if that inserts nothing,
it's a retry, and it rolls back and returns the existing hold. Then, once per
seat in seat-ID order:

```sql
UPDATE seats
SET status = 'held', hold_id = 'h_51c0', held_until = now() + interval '10 minutes'
WHERE event_id = 'ev_8812' AND seat_id = '114-K-11'
  AND (status = 'available'
       OR (status = 'held' AND held_until < now()));
-- 0 rows changed → ROLLBACK and answer 409 with this seat as taken
```

Last, it adds the tickets to `account_event_tickets` only where the total
stays at or under 8 (an insert-or-update for an account's first hold), and
answers `422` if not.

The hold row goes first so a retry never reaches the seats (with the seats
first, a retried hold would find its own seats taken, or pick others). The
database checks the condition against the latest committed row at the moment
of the write: at PostgreSQL's default isolation level, a second transaction
that reaches a row another has just changed waits for its commit, re-checks,
finds `status = 'held'`, and changes nothing. The loser learns in
milliseconds, and its `409` carries a fresh bitmap for that section read from
the primary. The `held_until < now()` clause lets a hold take over a lapsed
hold's seat before the sweeper gets to it, using the database's clock. Locks
last a few quick statements plus the commit, about 4 ms for the first seat of
a two-seat hold (about 250 changes a second for a seat row), and never while
application code decides anything.

**Option 3: a single writer per event.** Route every command for one event to
one single-threaded process, an **actor**, that keeps the 50,000 seats in
memory and appends commands to a replicated log in batches, answering once a
batch is durable. One 2 ms log write carries hundreds of commands, so one
owner can handle tens of thousands of holds a second. The costs are in running
it: mapping events to owners and moving them when a machine dies, replaying
the log before a new owner can take holds, and fencing an old owner that
paused rather than died, for instance with an epoch number the log checks on
every append (the fencing token from
[distributed locks](/systems-and-infrastructure/distributed-locks)).

**Reserved seating vs. general admission.** With reserved seating, 500 holds
a second over 50,000 rows means a row almost never has two writers. Twenty
thousand interchangeable GA floor tickets are naturally one counter,
decremented conditionally as the last statement; on an all-GA event about
500 holds a second hit that row, 100% of what it can take (without the waiting
room, 33,000 a second, 66 times over). So the counter is split into
10 bucket rows of 2,000 tickets (`ga_buckets`). Each hold picks a bucket at
random and decrements it conditionally, trying another if it's short, so each
row sees about 50 changes a second, a tenth of its limit. The price comes at
the end: with 3 tickets left, one per bucket, a request for 2 fails in every
bucket, so the booking service takes from two buckets in one transaction, in
bucket order to avoid deadlock. "Best available" spreads reserved-seat
requests the same way, picking different free seats from the latest bitmap.

**The choice** is conditional updates on per-seat rows, and on bucketed
counters for GA. With the waiting room holding one event to about 500 holds a
second, they are fast, correct and need nothing the team doesn't already run;
row locks are also correct but hold locks across round trips for no benefit.
The single writer is the better design when one event must take many
thousands of holds a second, such as if the waiting room were dropped or
admitted far faster.

## Deep dive: hold expiry, payment and an idempotent confirm

A hold is a **lease**: a claim that lapses on its own at a set time, so a user
who wanders off doesn't keep seats forever. Two questions follow: how lapsed
holds go back on sale, and what happens when a user is paying as the lease
runs out.

**Releasing lapsed holds.** Three ways:

- **Lazy expiry.** Treat a hold past its `held_until` as gone, as the hold
  statement's `held_until < now()` clause already does. Correctness never
  depends on a background job, but the map keeps showing the seat taken, so
  nobody tries it; GA counters can't tell which missing tickets are in lapsed
  holds; and the account's ticket count never comes back down.
- **A timer per hold**, a delayed queue message at each hold's expiry. Prompt,
  but 250 new timers a second during an on-sale, and a lost timer is a seat
  that never comes back.
- **A sweeper** on each shard, every 5 seconds, releases active holds past
  `expires_at` in one transaction each: hold `active` → `expired` only if
  still active and past expiry, then its seats back to `available` where
  `hold_id` is still this hold, plus the GA tickets and the account's count. A
  hold that has moved on to `paying`, or seats another hold has taken, don't
  match, so it's safe to run twice or alongside a confirm.

The design uses **both**: the lazy check keeps a seat from being blocked past
10 minutes even if the sweeper stalls, and the sweeper puts seats back on the
map and the GA counters within 5 seconds. Of 500 hold attempts a second, at
most about 250 succeed and 150 are paid for, so under 100 a second are
released: a few hundred rows per sweep. One sweeper per shard is chosen with a
lease, and since every release is conditional, two at once would only waste
work.

**The race with payment.** Charging a card takes seconds and sometimes much
longer. If the hold lapses at 10:12:40 while a charge started at 10:12:38 is in
flight, the sweeper could release the seats to someone else before the charge
succeeds. So confirm moves the hold into a state the sweeper leaves alone
before any money moves:

1. **Start payment.** One transaction: `active` → `paying`, only if still
   `active` and `expires_at` is in the future; set `pay_deadline` three minutes
   out and extend the seats' `held_until` to match. No row changed: `409`.
2. **Charge**, with the hold ID as the idempotency key, so however often this
   step repeats, the hold is charged once (if the payment service keeps keys
   longer than a hold can live).
3. **Confirm.** One transaction: `paying` → `confirmed`; seats `sold` where
   `hold_id` is this hold and status is `held`; insert the order, its tickets
   and an `order_confirmed` outbox row. If fewer seats change than the hold
   has, roll back.

A confirm that finds the hold already `paying` skips to step 2; one that finds it `confirmed` returns the order `orders.hold_id` points at, so a client whose `200` was lost gets its order, not a `409`.

A declined card moves the hold back to `active` with its original expiry.

The crash cases an interviewer probes:

- **Crash before the charge is sent.** Within 30 seconds of `pay_deadline` the
  sweeper asks the payment service to void the hold's key, which succeeds only
  if no charge exists and refuses any later one, so it can expire the hold and
  release its seats. Asking "is there a charge?" would not do: a stalled
  booking server could charge a moment after the "no".
- **Crash after the charge, before step 3.** A retried confirm finds the hold
  `paying`, repeats step 2 with the same key (no second charge) and does step 3. If nobody retries, the sweeper's void is refused because the charge
  exists, and it does step 3 itself; nothing releases a `paying` hold's seats
  before its deadline.
- **Two confirms racing**, such as a retry and the sweeper: step 3's
  conditions let exactly one commit, and the unique `orders.hold_id` rejects a
  second order regardless.

That is one charge and one order per hold; two browser tabs can still make
two paid holds, capped by the 8-ticket limit.

**When the payment service can't answer.** The deadline is itself a lease. If
the payment service can neither confirm a charge nor void the key, the sweeper
extends the deadline, and the seats' `held_until`, once more by three minutes.
After that it moves the hold to `payment_unresolved` and releases the seats,
rather than stall the sale for an outage elsewhere, and keeps polling until
the payment service answers (a retried confirm meanwhile gets `202`). If the
key can now be voided, the hold becomes `expired`. If the charge went through,
step 3's conditions are the fence: the hold is no longer `paying` and its
seats may carry another `hold_id`, so step 3 rolls back, and a separate
transaction marks the hold `refund_due` and writes a refund request to the
outbox. That is the "rare case" from the requirements.

**Telling everyone else.** Publishing to a queue after writing the order would
be a second write a crash could lose. Instead step 3's outbox row commits with
the order, and the outbox relay publishes new rows to the order events queue,
marking each published once the queue accepts it
([outbox pattern](/systems-and-infrastructure/outbox-pattern)). A relay crash
between publishing and marking publishes again, so consumers make a repeat
harmless: ticket issuing sets a barcode only where it's still null, and the
notification system drops a repeated event ID.

## Failure modes and bottlenecks

**A shard's primary fails during an on-sale.** The standby has every
committed write, so no hold or order is lost; promoting it takes on the order
of tens of seconds. Meanwhile that shard's holds and confirms fail with `503`,
clients retry with the same idempotency keys, and the waiting room pauses
admission. Afterwards every active hold on the shard, and its seats'
`held_until`, is extended by the outage's length.

**The waiting room's counter is lost.** A Redis failover that loses its last
few increments may hand out duplicate positions (those visitors are simply
admitted together) or give an account a second place. `admitted_up_to` is
written to durable storage every second, so a restart resumes where it was.
If the waiting room is down entirely, the gateway keeps refusing
protected-event bookings without an admission token, so the on-sale pauses
instead of becoming a stampede.

**The payment service is slow or down.** Holds wait in `paying`, confirms
answer `202`, and the waiting room slows admission as fewer seats come back;
past the deadline and one extension, the `payment_unresolved` rule applies. A
[circuit breaker](/systems-and-infrastructure/circuit-breaker) on payment calls
fails confirms quickly instead of tying up booking servers on timeouts.

**The sweeper stops.** Correctness holds, because of the lazy check, but an
on-sale can look sold out with thousands of tickets in dead holds. The alarm is
the age of the oldest active hold past its expiry, normally under 5 seconds.

**An unexpected hot event.** A sale nobody protected can draw far more than planned. Turning the waiting room on mid-sale needs no data to move, and the gateway starts requiring admission tokens; the event-to-shard table can move it off a busy shard only between sales.

**Holds as a weapon.** A bot that holds seats and never pays takes them off
sale 10 minutes at a time. Because the 8-ticket count includes held tickets
and each account gets one place in line, blocking a large share of an event
takes many accounts: expensive, not impossible.

**Knowing any of this is happening.** Per event: hold p99 and error rate,
the share of `409`s, admission rate and queue length, remaining and held
tickets, the oldest lapsed hold, holds stuck in `paying` or
`payment_unresolved`, and unpublished outbox rows
([observability](/systems-and-infrastructure/observability)).

## Trade-offs

The waiting room is the decision everything else rests on. It makes 2 million
people wait, and adds a component that has to be up whenever a big sale is.
In return the booking path is sized for 500 holds a second instead of 33,000,
the order people are served in is decided on purpose, and 1.9 million people
are told "sold out" instead of timing out.

Conditional updates in a relational database were chosen over a single
writer per event, and that choice only works because of the waiting room.
They need nothing new to operate, but cap one row at about 500 changes a
second, which is why GA counters are split into buckets. Dropping the waiting
room, or admitting much faster, would make the single writer the next design,
with its routing, replay and fencing to build.

Ten minutes is a guess at checkout time: longer holds leave seats idle behind
people who walked away, shorter ones fail people typing their card number. The
payment deadline keeps a charge in progress from being cut off at the mark.

Releasing seats when a payment's result is unknown means someone is, very
rarely, charged and refunded without tickets; refusing would tie seats to
another service's outage.

The seat map is allowed to be seconds out of date, which is what lets 33,000
shoppers read it for one query a second; the price is clicks on seats that are
already gone, each answered with a `409` and fresh data.

What would change the design: holds across several events at once (season
tickets, festival passes) would span shards, which needs a
[saga](/systems-and-infrastructure/saga-pattern) or a different partitioning.
