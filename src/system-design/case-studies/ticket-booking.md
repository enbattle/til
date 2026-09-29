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
few thousand best seats, each of which can be sold exactly once. Most systems
in this series scale by spreading independent work across machines; here the
work is not independent, and the design is mostly about contention: who gets to
write a seat, how fast, and what everyone else sees while they wait.

What follows is one plausible design for a service like Ticketmaster, not a
description of how any particular company built theirs.

## Requirements

Functional requirements:

- **Browse and view the seat map.** An event page shows the venue's layout
  with each seat marked available or not, and the prices.
- **Hold seats.** For **reserved seating** (every ticket is a specific seat,
  such as section 114, row K, seat 12), a user picks up to 8 seats, or asks for
  "best available" in a price tier and lets the system choose. For **general
  admission** (GA, a standing floor where tickets are interchangeable), a user
  asks for a quantity. Either way the tickets are held for that user alone for
  10 minutes.
- **Pay and confirm.** Within the hold, the user pays and the hold becomes an
  order with tickets. A hold that isn't paid for in time expires and its seats
  go back on sale.
- **A waiting room for high-demand on-sales.** When an event is expected to
  draw far more people than it has seats, visitors queue before they reach the
  seat map and are let in at a controlled rate.
- **A per-account limit.** One account can hold or buy at most 8 tickets per
  event, to make buying for resale harder.

Out of scope: the resale marketplace and ticket transfers, dynamic pricing,
the tools venues use to set up layouts and events, refunds for cancelled
events, scanning tickets at the gate, search and recommendations, and how the
payment service itself works. Payment is a call to a separate payment service
that charges a card and honors an **idempotency key** (a unique ID the caller
attaches so that a repeated request with the same key is carried out only
once) and can **void** a key that has no charge yet, so that any later charge
with it is refused; a later case study designs that service. Sending the confirmation
email is handed to a notification system like the one in
[Design a Notification System](/system-design/notification-system).

Non-functional requirements:

- **Everyday scale.** About 100,000 events are on sale at any time, averaging
  2,000 seats each. 500,000 tickets are sold a day, in orders of 2.5 tickets
  on average, and event pages with seat maps are viewed 20 million times a day.
- **On-sale scale.** The largest on-sales are 50,000 seats with 2 million
  people arriving in the first minute, and up to 5 of them may open at the same
  time.
- **Never sell a seat twice.** This is the one requirement with no tolerance
  at all. A user who is charged ends up with their tickets or, in a rare case
  described below, a refund.
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

The everyday workload and the on-sale are estimated separately, because they
differ by two orders of magnitude and it's the second that shapes the design.
The rules of thumb are from
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
- Tickets sold: 500,000 a day × 365 ≈ 183 million a year. At about 200 bytes
  per ticket with its order, that is about 37 GB a year, 183 GB over five
  years.

None of this is large. The everyday load would fit on one database server with
room to spare.

**The on-sale, if nothing stands in front of the booking system.**

- Arrivals: 2,000,000 ÷ 60 ≈ **33,000 new visitors a second** for one event.
- Requests: loading the event page, the seat map and its availability, then
  trying a hold, is about 5 requests per visitor, so about 167,000 requests a
  second for one event, and five times that, about 830,000 a second, with five
  on-sales at once. The whole site's everyday peak is 2,300 a second: one
  on-sale is about 72 times that.
- Availability refreshes: a seat map that re-fetches availability every 5
  seconds, open in 2 million browsers, is 2,000,000 ÷ 5 = **400,000 reads a
  second** of the same data.
- Hold attempts: at least one per arrival, so around 33,000 a second in the
  first minute, nearly all aimed at the best few thousand seats.
- Who can succeed: 50,000 seats ÷ 2.5 per order = 20,000 orders. That is 1% of
  the 2 million. Ninety-nine of every hundred people will fail, and each
  failure invites a retry.

**The on-sale with a waiting room in front.** Only the people who can
plausibly buy need to be inside at once.

- Assume 60% of the people let in end up buying (the others don't like the
  seats left, abandon, or have a card declined). Selling 20,000 orders then
  takes 20,000 ÷ 0.6 ≈ **33,000 admitted shoppers**.
- Admitting 250 a second gets through them in 33,333 ÷ 250 ≈ 133 seconds,
  a little over two minutes.
- Hold attempts: 250 shoppers a second × 2 attempts ≈ **500 holds a second**.
- Confirms: 20,000 orders over those ~133 seconds ≈ 150 a second.
- Availability refreshes: at most 33,000 shoppers inside, every 5 seconds, is
  about 6,700 reads a second, served from a cache.
- Waiting-room status checks: 2 million people asking "is it my turn?" every
  20 seconds is 100,000 requests a second, but every one of them gets the same
  answer, which makes it cacheable.

What the estimates say: storage and everyday traffic are small; the whole
difficulty is one minute in which 2 million people arrive for 20,000 orders.
The waiting room turns 33,000 arrivals a second into 250 admissions a second,
and everything behind it can then be sized for 500 holds a second on one
event instead of 33,000.

## Data model

A hold has to change several seats at once (all four seats, or none), check a
condition on each, and record who holds them, and a confirm has to change the
seats, the hold and the order together. Those are multi-row transactions with
conditions on them, which is what a relational database does well, so the
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

Every table is split across eight database servers by `event_id`. Each piece is a
**shard**: a separate database holding its share of the events. Each shard has
a **primary** that takes all its writes, a **standby** in another
**availability zone** (a separate data center in the same region, with its own
power and network) that receives every write before the primary confirms it,
and one or more read-only **replicas** for reads that can be a moment behind.
All of one event's rows live on the same shard, so a hold or a confirm never
spans two databases.
[Partitioning vs. sharding](/systems-and-infrastructure/partitioning-vs-sharding)
covers the mechanics.

The sizes above would fit on one server, so why eight shards? Isolation. One
event mid on-sale keeps a primary busy with close to a thousand transactions a
second (500 hold attempts, two transactions per confirm, and the releases), and
it should not slow down the other 99,999 events. Hashing `event_id` to pick a
shard could put two big on-sales on the same one, so the mapping from event
to shard is a small lookup table instead, and events with a protected on-sale
are placed on a shard with no other on-sale that hour; eight shards leave room
for the five that can run at once.

Three details matter later. `holds.client_key` is unique per account, which is
what makes hold creation safe to retry. `orders.hold_id` is unique, which is
what makes confirm safe to retry. And the `outbox` table is how the system
announces a confirmed order to the rest of the world without a second write
that could be lost; it's covered in the third deep dive.

The venue's layout (the position, section, row and label of each seat) is
stored as a file per layout version, not in the database. It never changes
during a sale, so it can be cached anywhere for as long as anyone likes.

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

The `Idempotency-Key` header matters because a hold is not naturally safe to
repeat: a client that times out and retries would otherwise end up with two
holds, twice the seats, and half its ticket limit gone.
[Idempotency](/systems-and-infrastructure/idempotency) covers the pattern; here
the key is stored as `holds.client_key`, and a retry with the same key returns
the hold it already made. The hold transaction writes the hold row first, so a
retry finds its own hold before it touches a single seat (the second deep dive
shows the statement).

**Releasing and confirming:**

```http
DELETE /holds/h_51c0...
POST /holds/h_51c0.../confirm   { "payment_method": "pm_..." }
```

Confirm answers `200 OK` with the order, `402 Payment Required` if the card was
declined (the hold stays active until it expires, so the user can try another
card), `409 Conflict` if the hold has expired, or `202 Accepted` if the payment
result isn't known yet, in which case the client polls `GET /holds/{id}`.
Confirm needs no separate idempotency key: the hold ID already is one, as the
third deep dive explains. Release and confirm don't need the admission token,
only a hold that belongs to the caller's account, so a confirm retried after
the token has lapsed still works.

## High-level architecture

![Architecture of the ticket booking system. The browser fetches the static layout, availability bitmaps and waiting-room status through a CDN, which fetches availability from the seat map service on a miss. The browser joins and is admitted through the waiting room, then sends holds and confirms to the API gateway, which checks admission tokens and rate limits and passes them to the booking service. The booking service makes conditional writes to the inventory database, which is sharded by event with a primary, a standby and replicas, calls the payment service to charge with the hold ID as idempotency key, and reports load and remaining seats back to the waiting room. The seat map service reads replicas once a second per event. The hold sweeper releases expired holds in the inventory database and asks the payment service about stuck payments. An outbox relay reads confirmed orders from the database's outbox table and publishes them to an order events queue, which feeds ticket issuing and email.](/diagrams/ticket-booking/architecture.svg)

The pieces:

- The **CDN** (content delivery network) is a large set of caching servers
  close to users. It serves the static layout, the availability bitmap and the
  waiting-room status, all of which are the same for every viewer, so the
  100,000 status checks and thousands of availability reads a second during an
  on-sale barely reach our servers.
- The **waiting room** gives each arriving visitor a place in line and, when
  their turn comes, an admission token. It decides how fast to admit from what
  the booking service reports (the first deep dive).
- The **API gateway** is the entry point for booking calls: it checks the
  admission token and applies ordinary per-account and per-IP rate limits
  before anything reaches the booking service.
- The **booking service** is stateless and runs on many servers. It turns a
  hold or confirm request into a short conditional transaction on the event's
  shard (the second deep dive) and calls the payment service.
- The **inventory database** is the sharded PostgreSQL from the data model,
  the one source of truth for who holds or owns each seat.
- The **seat map service** builds each event's availability bitmap from a
  replica once a second (the last deep dive).
- The **hold sweeper** finds holds past their expiry and releases their seats
  (the third deep dive).
- The **outbox relay** and **order events queue** carry confirmed orders to
  the parts of the system that issue tickets and send emails.

A shopper's path on a protected on-sale: join the waiting room, wait while
polling the cached status, get admitted, load the seat map from the CDN,
pick seats and hold them, pay, confirm. The sequence below follows one user
through all of it, including a hold that runs out. (The hold sweeper's release
is drawn on the database's lifeline, to keep the diagram narrow.)

![Sequence of one shopper across the user, waiting room, booking service, inventory database and payment service. The user joins and gets a queue token with position 184,213, sees admitted_up_to 184,500 in the cached status, and is given an admission token. The booking service holds seats 114-K-11 and 114-K-12 for hold h1 with a conditional update, expiring in 10 minutes. In the group "The user walks away for 10 minutes", the hold sweeper releases h1 (drawn on the database's lifeline); the user's confirm of h1 fails to move it from active to paying and gets 409 hold expired. The user holds the same seats as h2 and confirms: the booking service moves h2 from active to paying and extends its deadline, charges through the payment service with key h2, then marks h2 confirmed and the seats sold, writes the order and an outbox row, and answers 200 with the order.](/diagrams/ticket-booking/shopper-sequence.svg)

## Deep dive: the on-sale spike and the waiting room

The estimates show why an ordinary design breaks at 10:00. It is worth
following the failure through, because each part of it points at something the
waiting room fixes.

The front-end servers **autoscale** (add servers automatically as load
rises), but adding servers takes minutes and the
spike takes seconds, so the first minute runs on whatever was provisioned.
Suppose enough was provisioned. The 33,000 hold attempts a second then reach
the database, and they aren't spread evenly: the front sections are what
everyone clicks first. The losers get "seat taken" and click the next seat
over, or their request times out and the browser retries, so every failure
adds another request. Connection pools fill, latency climbs past the point
where clients give up, and they retry harder. That self-feeding pile-up is the
[thundering herd problem](/systems-and-infrastructure/thundering-herd-problem)
at the scale of a whole site. When it settles, who got tickets was decided by
whose retries happened to land, which favors scripts that retry fastest, the
opposite of the fairness requirement.

The fix is to keep most of the 2 million people out of the booking system and
decide the order they come in, somewhere cheap.

**Option 1: rate-limit the booking endpoints.** Put a global limit of, say,
500 hold requests a second on the event and answer the rest with `429 Too Many
Requests`, as a [rate limiter](/system-design/rate-limiter) would. This
protects the database, and the machinery exists already. But a rejected
request carries no memory: the person just retries, so the limiter is now
absorbing 33,000 requests a second of retries instead of the database doing
so, and whoever retries most often is most likely to get through. It protects
the backend and does nothing for fairness, and bots retry better than people.

**Option 2: a virtual waiting room.** Instead of rejecting the excess,
defer it. Each visitor gets a numbered place, stops sending booking requests,
and waits to be called. The admission rate is a rate limit too, a single
global one (the same "N per second" idea
[rate limiting](/systems-and-infrastructure/rate-limiting) describes), but
applied to people entering rather than to requests, and in order rather than
by luck. The costs: a new component that sits on the critical path of every
on-sale, a user experience of waiting (with a visible position and estimate,
which is easier to accept than a stream of errors), and admission tokens that the
gateway has to check.

The waiting room is the choice, with the gateway's ordinary rate limits kept
behind it for the traffic it doesn't cover. How it works:

**Places in line.** Visitors who open the event page in the 30 minutes before
the on-sale are put in a **lobby**. At 10:00 each lobby member is given a
random position, so arriving at 09:59:59.9 is no better than arriving at 09:40
and there's nothing to gain from hammering the page at the exact second. The
waiting room keeps the lobby in Redis, an in-memory data store, as a sorted
set of account IDs scored by a random number drawn at join time. It adds
members with `ZADD NX`, which leaves an existing member alone, so rejoining
can't re-roll an account's score; at 10:00 a member's position is its rank in
that set. Visitors who arrive after 10:00 get the next number from a counter
that starts at the lobby's size (`INCR`), and the waiting room then stores it
under the account ID with `SET NX`. If the account already had a position,
`SET NX` changes nothing and the join returns the stored position; the unused
number is a gap in the line that admission passes over. At the peak that is
about 33,000 joins a second for one event, each two commands, so about 66,000
commands a second. A single Redis instance commonly handles on the order of
100,000 simple commands a second, so each protected event gets two instances,
one for the counter and one for the account positions, each taking about
33,000 a second with about three times headroom.

**Tokens instead of sessions.** The position goes into a **queue token**, a
small record (event, account, position, time issued) signed with a key only
the waiting room and gateway hold; a [JWT](/security/jwt) is a common format.
Anyone can read it, nobody can change the position without breaking the
signature, and checking it needs no lookup. So the 2 million waiting clients
hold their own state, and beyond the lobby set the waiting room keeps little
per event: the next position to hand out, each account's position,
`admitted_up_to`, and the IDs of tokens it has already admitted.

**Waiting costs almost nothing.** The status endpoint returns
`admitted_up_to` and the current rate, identical for everyone, and the CDN
caches it for one second. The 100,000 status checks a second become one origin
fetch a second per CDN location.

**Admission.** When `admitted_up_to` passes a client's position, it trades its
queue token for an **admission token**: signed, bound to the account, valid for
20 minutes (time to pick seats, plus a 10-minute hold). The gateway rejects
hold requests for a protected event without one. The waiting room records
each queue token it has admitted, so trading the same token twice returns the
same admission instead of a second one.

**Choosing the rate.** Admitting too slowly leaves seats unsold while people
wait; admitting too quickly recreates the stampede and admits people who will
find nothing left. Every few seconds the booking service reports hold latency,
error rate, and the event's remaining and held tickets, and the waiting room
adjusts the rate: it backs off when p99 hold latency rises, which is
[backpressure](/systems-and-infrastructure/backpressure) applied at the front
door, and it slows down as inventory runs out, aiming to keep the number of
shoppers inside at about what the remaining tickets can serve. When nothing is
available but tickets are still held, the status changes to "all tickets are
currently held; some may be released", and admission trickles on as holds
expire. When nothing is available or held, it says sold out, and 1.9 million
people get a clear answer instead of a spinner.

**Bots, at a high level.** No single measure stops them, so there are
several, each raising the cost: joining a protected queue needs a signed-in
account, and one account gets one place; joining may require a challenge (a
CAPTCHA or a device check) when signals look automated; the per-account limit
of 8 tickets is enforced at hold time in the database, not only at the edge;
and the random lobby order removes the payoff of being fastest at 10:00. None
of this makes buying for resale impossible, and a determined operation with
many real accounts still gets through.

## Deep dive: holding a seat without selling it twice

A hold must check that every requested seat is free and mark them all held,
as one indivisible step. If two users check seat 114-K-12 at the same moment,
both see it free, and both mark it held, the seat is sold twice; that's the
check-then-act bug [race conditions](/systems-and-infrastructure/race-conditions)
describes. There are three reasonable ways to prevent it, and one number
decides much of the comparison.

**The hot-row number.** A transaction that changes a row locks it until it
commits, and here a commit waits for the database's log to be written to disk
and for the standby in another availability zone to confirm it has the write.
Call that 2 ms. Two transactions that change the same row therefore go one
after another, so one row can take at most 1 ÷ (the time it stays locked)
changes a second, however many CPUs the server has. A change made as the last
statement before `COMMIT` keeps the row locked for about the commit alone, so
the best a row can do is about 1 ÷ 0.002 s = **500 changes a second**; every
statement that runs after the change lowers that.
[Optimistic vs. pessimistic locking](/systems-and-infrastructure/optimistic-vs-pessimistic-locking)
explains the locking behind this; the number is what matters here.

**Option 1: pessimistic row locks.** In one transaction, read the requested
seat rows with `SELECT ... FOR UPDATE`, which locks them; check in application
code that all are available; update them; insert the hold; commit. Locking the
rows in seat-ID order means two overlapping holds never wait on each other in
a circle (a **deadlock**). It is correct and easy to reason about. The costs:
locks are held across several round trips between the booking service and the
database, so a booking server that stalls mid-transaction (a garbage
collection pause, say) keeps other shoppers waiting on those seats until its
transaction ends or a timeout ends it, and users who click a seat someone
else is mid-way through holding queue behind the lock only to learn it's gone.

**Option 2: conditional updates.** Put the check inside the write:

```sql
BEGIN;
INSERT INTO holds (hold_id, event_id, account_id, client_key, ...)
VALUES ('h_51c0', 'ev_8812', 'acct_77', '3f1c...', ...)
ON CONFLICT (account_id, client_key) DO NOTHING
RETURNING hold_id;
-- no row returned → ROLLBACK, read the existing hold and return it
-- once per requested seat, in seat_id order
UPDATE seats
SET status = 'held', hold_id = 'h_51c0', held_until = now() + interval '10 minutes'
WHERE event_id = 'ev_8812' AND seat_id = '114-K-11'
  AND (status = 'available'
       OR (status = 'held' AND held_until < now()));
-- 0 rows changed → ROLLBACK and answer 409 with this seat as taken
...
UPDATE account_event_tickets SET tickets = tickets + 2
WHERE event_id = 'ev_8812' AND account_id = 'acct_77' AND tickets + 2 <= 8;
-- 0 rows changed → ROLLBACK and answer 422
COMMIT;
```

The hold row goes in first so that a retry never reaches the seats. If the
original request already committed, the insert does nothing and the retry
returns that hold; if the original is still in flight, the insert waits for it
on the unique key and then does the same. Were the seat updates first, a retry
of a committed hold would find its own seats taken and answer `409`, and a
retried "best available" or GA request would pick other seats and make a
second hold. (An account's first hold for an event has no
`account_event_tickets` row to update yet; an `INSERT ... ON CONFLICT DO
UPDATE` with the same condition covers that case and two first holds racing.)
The condition is checked
by the database against the latest committed version of the row, at the
moment of the write, so there is no window between checking and writing. At
PostgreSQL's default isolation level, a second transaction that reaches a row
another one has just changed waits for that one to commit, re-checks the
condition against the new value, finds `status = 'held'`, and changes nothing.
The loser learns in milliseconds. The `held_until < now()` clause lets a hold
take over a seat whose previous hold has lapsed even if the sweeper hasn't
released it yet, which comes up again in the next deep dive. `now()` is the
database server's clock, so booking servers with slightly wrong clocks can't
disagree about whether a hold has lapsed. Locks are held for a few quick
statements plus the commit, about 4 ms for the first seat of a two-seat hold
(so about 250 changes a second for a seat row), and never while application
code decides anything.

**Option 3: a single writer per event.** Route every hold, release and
confirm for one event to one process that owns that event's inventory, an
**actor**: a single-threaded owner of some state that handles one message at
a time. The owner keeps the 50,000 seats in memory (a few hundred kilobytes),
checks and applies each command in microseconds, and appends the commands to a
replicated log in batches, answering each request once its batch is durable.
There are no row locks at all, and one 2 ms log write can carry hundreds of
commands, so one owner can handle tens of thousands of holds a second. The
costs are all in running it. Every request for the event has to reach its
owner, so something has to map events to owners and move them when a machine
dies. The new owner rebuilds state by replaying the log, and the event can't
take holds meanwhile. And an old owner that paused rather than died may wake
up still believing it owns the event; the log has to reject its writes, for
instance by stamping each owner with an increasing epoch number that the log
checks on every append. That is the fencing token from
[distributed locks](/systems-and-infrastructure/distributed-locks), and it's
infrastructure this team would have to build and trust.

**Reserved seating vs. general admission.** With reserved seating, each seat
is its own row, so contention is per seat: 500 holds a second spread over
50,000 rows means a given row almost never has two writers at once, and a
seat row's limit of about 250 changes a second is far away even for the most
popular seat. GA is different. Twenty thousand interchangeable floor tickets
are naturally one counter, and kept in a single row, decremented as the last
statement before `COMMIT` so the row is locked only for the commit, a hold
would look like this:

```sql
UPDATE ga_inventory SET available = available - 2
WHERE event_id = 'ev_8812' AND section_id = 'floor' AND available >= 2;
```

That is one row. With the waiting room admitting 250 shoppers a second to an
all-GA event, about 500 holds a second hit it, which is 100% of what one row
can take; without the waiting room it would be 33,000 a second, 66 times over.
Rows that are fully busy queue without bound, so the counter is split: 10
bucket rows of 2,000 tickets each (the `ga_buckets` table). Each hold picks a
bucket at random and decrements it conditionally, again as its last
statement, trying another if it's short, so each row sees about 50 changes a second, a tenth of its limit. The
price is at the end of the sale: with 3 tickets left in total, spread one per
bucket, a request for 2 fails in every single bucket. The booking service
then takes from two buckets in one transaction, in bucket order so two such
requests can't deadlock, and only answers sold out when the buckets together
are short.

"Best available" spreads reserved-seat requests the same way: the booking
service picks seats that were free in the latest availability bitmap, giving
concurrent requests different candidates, instead of everyone colliding on the
same front-row pair.

**The choice** is conditional updates on per-seat rows, and on bucketed
counters for GA. With the waiting room holding one event to about 500 holds a
second, a single-row conditional update is fast, correct and needs nothing the
team doesn't already run; the pessimistic version is also correct but keeps
locks open across round trips for no benefit. The single writer is the better
design when one event must take many thousands of holds a second, for
instance if the waiting room were dropped or admitted far faster, and it's the
step to take if that ever becomes a requirement.

## Deep dive: hold expiry, payment and an idempotent confirm

A hold is a **lease**: a claim that lapses on its own at a set time unless
renewed, so a user who wanders off doesn't keep seats forever. Two questions
follow. How do lapsed holds actually go back on sale? And what happens when a
user is paying at the moment the lease runs out?

**Releasing lapsed holds.** Three ways to do it:

- **Lazy expiry.** Don't release anything; treat a hold past its `held_until`
  as if it were gone, which the `held_until < now()` clause in the hold
  statement already does. No background job, and correctness never depends on
  one running. But nothing updates the seat row until someone tries to hold
  that seat, so the seat map keeps showing it taken and nobody tries: seats
  sit unsold behind lapsed holds. GA counters are worse off, since a counter
  doesn't know which of its missing tickets belong to lapsed holds. And the
  account's ticket count never comes back down.
- **A timer per hold.** Schedule a message for each hold's expiry time, on a
  queue with delayed delivery, and release the hold when it arrives. Releases
  are prompt, but it means 250 new timers a second during an on-sale and a
  delivery system that must not lose them; a lost timer is a seat that never
  comes back.
- **A sweeper.** A job on each shard runs every 5 seconds, finds active holds
  past `expires_at` (through an index on status and expiry time), and releases
  each one:

  ```sql
  UPDATE holds SET status = 'expired'
  WHERE hold_id = 'h_51c0' AND status = 'active' AND expires_at < now();
  -- then, only if that changed a row, in the same transaction:
  UPDATE seats SET status = 'available', hold_id = NULL, held_until = NULL
  WHERE event_id = 'ev_8812' AND hold_id = 'h_51c0' AND status = 'held';
  -- and give the GA tickets and the account's ticket count back
  ```

  The conditions make it safe to run twice or alongside a confirm: a hold
  that has moved on to `paying` or `confirmed` doesn't match, and seats that
  another hold has since taken over carry a different `hold_id`.

The design uses **lazy expiry and a sweeper together**: the lazy check keeps
seats from being blocked a moment longer than 10 minutes even if the sweeper
stalls, and the sweeper puts them back on the map and the GA counters within
5 seconds. At 500 hold attempts a second, at most about 250 succeed, 150 are
paid for, and so under 100 a second end up released or expired: a few hundred
rows per sweep. One sweeper per shard is enough, chosen with a lease so two
don't run at once, but because every release is conditional, two sweepers
running at once would waste work, not corrupt anything.

**The race with payment.** Charging a card takes a few seconds and sometimes
much longer. If the hold lapses at 10:12:40 while a charge started at
10:12:38 is still in flight, the sweeper could release the seats, someone else
could hold them, and then the charge succeeds for seats the first user no
longer has. So confirm moves the hold into a state the sweeper leaves alone,
before any money moves:

1. **Start payment.** One transaction: change the hold from `active` to
   `paying`, only if it is still `active` and `expires_at` is still in the
   future, set `pay_deadline` three minutes out, and extend its seats'
   `held_until` to the same time. If no row changes, the hold has lapsed:
   answer `409`.
2. **Charge.** Call the payment service with the hold ID as the idempotency
   key. However many times this step is repeated, for this hold, the payment
   service charges once, as long as it keeps keys longer than the few minutes
   a hold can live.
3. **Confirm.** One transaction: change the hold from `paying` to
   `confirmed`; mark its seats `sold` where `hold_id` is this hold and status
   is `held`; insert the order and its tickets; insert an `order_confirmed`
   row into the outbox. If the seat update changes fewer rows than the hold
   has seats, roll back (see below). Answer `200` with the order.

If the card is declined, the hold goes back from `paying` to `active`, and
it and its seats go back to the original expiry, so the user can try another
card in whatever time is left.

**What happens on a crash at each step:**

- After step 1, before the charge is sent: the hold sits in `paying`. The
  sweeper also looks at `paying` holds within 30 seconds of `pay_deadline`
  and asks the payment service to void that hold's key. Voiding succeeds only
  if no charge with the key exists, and from then on a charge with it is
  refused, so the sweeper can expire the hold and release its seats safely.
  Asking "is there a charge?" and releasing on "no" would not be enough: a
  booking server that stalled after step 1 (a garbage collection pause, say)
  could send its charge a moment after the answer, then crash, leaving a
  customer charged for released seats with nothing left to notice. With the
  key void, that late charge is refused and the server answers `409`.
- After the charge, before step 3: the client's confirm times out and it
  retries. The hold is `paying`, so the booking service repeats step 2 with
  the same key, gets the original result without a second charge, and does
  step 3. If the client never retries, the sweeper reaches the hold 30 seconds
  before its deadline, has its void refused because the charge exists, and
  does step 3 itself. The seats are still held for this hold, because
  nothing releases a `paying` hold before its deadline and the lazy-expiry
  clause doesn't match seats whose `held_until` hasn't passed.
- After step 3 commits: a retry finds the hold `confirmed` and returns the
  order that `orders.hold_id` points at. Two confirms racing (a retry and the
  sweeper, say) both try step 3; its conditions let exactly one commit, and
  the unique `orders.hold_id` would reject a second order even if they didn't.

This is idempotency built from states the confirm can safely re-enter. What
it guarantees is one charge and one order per hold. It doesn't stop a user
with two browser tabs from making two holds and paying for both, which is two
real orders, capped by the 8-ticket limit.

**When the lease lapses on a live holder.** The deadline is itself a lease,
and the payment service can be slower than any deadline. If it can't say
whether a charge happened and can't void the key, the sweeper extends the
deadline, and the seats' `held_until`, once more by three minutes. If it
still can't, the sweeper moves the hold to `payment_unresolved` and releases
the seats, because holding them indefinitely for an outage elsewhere would
stall the sale. `payment_unresolved` is not a final state: the sweeper polls
every hold in it until the payment service gives a final answer, and because
the state is a row in `holds`, a sweeper that restarts or hands over to
another still finds it. A retried confirm on such a hold answers `202` and
leaves the answer to the sweeper. If the key can now be voided, no money
moved and the hold becomes `expired`. If the charge turns out to have
succeeded, the sweeper runs step 3, and step 3's conditions are the fence: the
hold is no longer `paying`, and its seats may now carry another shopper's
`hold_id`, so it changes fewer rows than it needs and rolls back. A separate
transaction then marks the hold `refund_due` and writes a refund request to
the outbox. That user is charged and then refunded without tickets, the "rare
case" from the requirements. The alternative, never releasing seats while a
payment is unknown, would leave them locked for as long as the
payment service is down.

**Telling everyone else.** A confirmed order has to reach ticket issuing
(generating barcodes) and email. Writing the order to the database and then
publishing to a queue is two writes, and a crash between them loses the
second: an order whose tickets never get barcodes and whose buyer never hears
about it. Instead, step 3 inserts an outbox row in the
same transaction as the order, and the outbox relay reads new rows and
publishes them to the order events queue, marking each one published after
the queue accepts it. That is the
[outbox pattern](/systems-and-infrastructure/outbox-pattern), and a relay that
crashes after publishing but before marking will publish the same row again,
so delivery is at least once. Consumers make a repeat harmless: ticket issuing
sets each ticket's barcode only where it is still null, so a redelivered
`order_confirmed` changes nothing, and the notification system drops a
repeated event ID.
[Message queues](/systems-and-infrastructure/message-queues) covers why
redelivery is normal.

## Deep dive: reading the seat map under load

Every shopper looks at the seat map, repeatedly. The map is two things with
very different lifetimes: the layout, which never changes during a sale, and
availability, which changes hundreds of times a second.

**The layout** is served from the CDN under a versioned URL
(`/layouts/v31.json`) and cached for a year; a new version gets a new URL, so
nothing ever has to be purged. For a 50,000-seat stadium it is a couple of
megabytes before compression, fetched once per browser.

**Availability** is a **bitmap**: one bit per seat, in `seat_index` order, 1
for available. 50,000 seats is 50,000 ÷ 8 = 6,250 bytes, about 7 KB with
per-section counts and prices added. There are three ways to keep browsers
current:

- **Query the database on every request.** Always fresh. But 6,700 reads a
  second from admitted shoppers, each reading 50,000 rows, is hundreds of
  millions of rows a second on the shard doing the event's holds. Even on
  replicas that's many machines to answer a question whose answer changes
  far less often than it is asked.
- **Push changes to open browsers**, over the kind of long-lived connection
  [WebSockets vs. SSE vs. long polling](/systems-and-infrastructure/websockets-vs-sse-vs-long-polling)
  compares. Very fresh. But at 500 holds a second and 33,000 viewers, sending
  each change individually would be 16.5 million messages a second; batching
  into one update per second per viewer brings it to 33,000 a second, over
  33,000 held-open connections that need their own fleet of connection
  servers, like the gateways in [Design a Chat App](/system-design/messaging).
  That is a lot of machinery for a map that only has to be roughly right.
- **A snapshot with a short TTL.** The seat map service rebuilds each hot
  event's bitmap from a replica once a second and serves it with a one-second
  **TTL** (time to live: how long a cache may keep it before fetching again);
  the CDN caches it for that second. Browsers poll every 5 seconds while the
  map is open.

The design uses the snapshot. It is the same for every viewer, which is what
makes it cacheable, and the origin sees about one request a second per event
per CDN location however many people are looking. The replica read is one
indexed scan of one event's seats per second. When a cached bitmap expires,
the first request for it fetches a new one and the others wait for it rather
than all going to the origin (**request coalescing**, which many CDNs offer
and the seat map service does too), so the snapshot's expiry doesn't cause the
stampede [caching](/systems-and-infrastructure/caching) warns about.

**What staleness costs.** A browser's view can be about 8 seconds old at
worst: up to 5 seconds since its last poll, up to a second in the CDN, up to a
second since the seat map service rebuilt the bitmap, and about a second for
the replica to catch up on a busy shard. That is inside the 10-second
requirement. At 500 holds a second,
a few thousand seats may change in that time, and they are the popular ones
people are clicking. Some users will click a seat that is already gone. That
is acceptable because the map is advice and the hold is the check: the
conditional update never grants a taken seat. The `409` names the taken seats
and carries a fresh bitmap for that section straight from the primary, so
the user's next click is on current data. "Best available" sidesteps most of
it, since the server picks.

Deleting the cached bitmap after every hold would make it fresher, but at 500
holds a second the cache would be emptied constantly, the trade-off
[cache invalidation](/systems-and-infrastructure/cache-invalidation) walks
through. A fixed short TTL bounds staleness without that churn.

## Failure modes and bottlenecks

**A shard's primary fails during an on-sale.** The standby has every
committed write, because the primary waited for it on each commit, so no hold
or order is lost; promoting it takes on the order of tens of seconds. Until
then holds and confirms for events on that shard fail with `503`, clients
retry with the same idempotency keys, and the waiting room sees the error rate
and pauses admission rather than letting people in to a broken sale. Hold
timers keep running during the outage, so once the shard is back every active
hold on it, and its seats' `held_until`, is extended by the outage's length;
a user shouldn't lose seats because the system was down.

**The waiting room's counter is lost.** If a Redis node fails over and loses
its last few increments, a handful of visitors may get positions already
issued, and an account whose stored position was lost may get a second place.
Two people with the same position are simply admitted together.
`admitted_up_to` is written to durable storage every second, so a restart
resumes from where it was, not from zero. If the waiting room is down
entirely, the gateway keeps refusing protected-event bookings without an
admission token, so the on-sale pauses instead of falling back to a stampede.

**The payment service is slow or down.** Holds move to `paying` and wait
there; confirms answer `202` and clients poll. Fewer holds end, so fewer
seats come back, and the waiting room slows admission as remaining inventory
stops moving. Past the deadline and one extension, the rule from the third
deep dive applies: mark the hold `payment_unresolved`, release the seats, and
refund if the charge later turns out to have gone through. The booking service also wraps payment calls in a
[circuit breaker](/systems-and-infrastructure/circuit-breaker), so a payment
outage fails confirms quickly instead of tying up booking servers waiting on
timeouts.

**The sweeper stops.** Correctness holds, because of the lazy check in the
hold statement. What breaks is freshness: lapsed holds keep showing as taken,
GA tickets in lapsed holds aren't returned, and an on-sale can look sold out
with thousands of tickets sitting in dead holds. The metric to alarm on is the
age of the oldest active hold past its expiry; normally it's under 5 seconds.

**Holds as a weapon.** A bot that holds seats and never pays takes them off
sale 10 minutes at a time. Because the 8-ticket count includes held tickets
and each account gets one place in the queue, blocking a large share of an
event takes many accounts that each passed the join checks: expensive, not
impossible.

**An unexpected hot event.** A sale nobody protected can turn out far more
popular than planned. Turning the waiting room on for it mid-sale needs no
data to move; the event-to-shard table can move it off a busy shard only
between sales.

**Knowing any of this is happening.** Per event: hold p99 and error rate,
the share of holds answered `409`, admission rate and queue length, remaining
and held tickets, the oldest lapsed hold, holds stuck in `paying` or
`payment_unresolved`, and the
outbox's unpublished row count. [Observability](/systems-and-infrastructure/observability)
covers how metrics, logs and traces divide that work.

## Trade-offs

The waiting room is the decision everything else rests on. It makes 2 million
people wait to protect a system that on an ordinary day would not notice
them, and it adds a component that has to be up whenever a big sale is. In
return the booking path is sized for 500 holds a
second instead of 33,000, the order people are served in is decided on
purpose, and 1.9 million people are told "sold out" instead of timing out.

Conditional updates in a relational database were chosen over a single
writer per event, and that choice only works because of the waiting room.
They need nothing new to operate, and they cap one row at about 500 changes a
second even when the change is the last thing before the commit, which is why
GA counters are split into buckets. If the business ever
wants to drop the waiting room, or admit much faster, the single writer is the
next design, with its routing, replay and fencing to build.

Ten minutes is a guess at how long checkout takes, and it trades two kinds of
waste. Longer holds leave seats idle behind people who walked away; shorter
ones fail people who are typing their card number. The payment deadline sits
on top of it, so a charge in progress isn't cut off at the ten-minute mark.

Releasing seats when a payment's result is unknown means that, very rarely,
someone is charged and refunded without tickets. Refusing to release would
tie seats to another service's outage; the design takes the refund.

The seat map is allowed to be seconds out of date, which is what lets 33,000
shoppers read it for one query a second; the price is clicks on seats that are
already gone, each answered with a `409` and fresh data.

What would change the design: reserved seating across several events at once
(season tickets, festival passes) would put one hold across several shards,
which needs a [saga](/systems-and-infrastructure/saga-pattern) or a different
partitioning. Global on-sales across regions would raise the question of where
a seat's single source of truth lives, and the answer would still be one place
per event.
