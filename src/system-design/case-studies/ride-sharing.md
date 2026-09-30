---
title: Design a Ride-Sharing Service (like Uber)
summary: Taking in 750,000 driver locations a second, finding the nearest free drivers on a hexagonal grid, and offering each ride to one driver at a time without ever booking a driver twice.
date: 2026-09-28
order: 8
---

A rider opens the app, sets a pickup point and a destination, sees a price,
and taps Request. Within seconds a nearby driver has accepted, and the rider
watches a small car crawl across the map towards them. Behind that are two
very different workloads. One is a firehose: every driver's phone reports its
position every few seconds, and almost every report is worthless four seconds
later. The other is small and strict: each ride request has to end with
exactly one driver, and each driver can carry only one ride at a time, even
when two riders a block apart ask for the same car in the same second.

This is one plausible design for a service like Uber or Lyft, not a
description of how any company built theirs. Routing is a service that
answers "how long from A to B?", and payments take a finished trip in one
hand-off; both are later case studies.

## At a glance

**Requirements.**

- Take a position from every online driver every 4 seconds, up to 3 million
  drivers at peak.
- Quote a price, then offer each of 25 million daily requests to nearby drivers
  until one accepts.
- First offer on a driver's phone within 2 seconds at p99, from positions at
  most about 5 seconds old.
- The rider sees the car move within 2 seconds of each update (p99).
- Never two trips for a driver or two drivers for a request; trips 99.99%
  available.

**Key numbers.** From the estimates:

- 750,000 location updates a second at peak (3 million drivers ÷ 4 seconds).
- About 2,900 ride requests a second at peak (25 million ÷ 86,400 ≈ 289, × 10).
- 600 MB of latest positions (3 million × 200 bytes), over 12 in-memory index
  shards (750,000 ÷ 100,000 planned per node ≈ 8, plus room for uneven areas).
- 4.3 million open WebSockets at peak (3 million drivers + 1.3 million riders
  on trips), about 45 gateway servers.
- 58,000 store writes a second at peak (17,400 trip + 11,600 driver + 29,000
  outbox), over 16 shards.

**Key decisions.**

- Latest positions only in memory, every update also logged: a lost position
  is replaced 4 seconds later, and durable writes would need about 150 shards
  ([ingesting locations](#deep-dive-ingesting-driver-locations)).
- A hexagonal grid for the index: neighbours share full edges, cells are
  near-equal in area, and nothing restructures as drivers move
  ([finding nearby drivers](#deep-dive-finding-nearby-drivers)).
- One offer at a time, claimed with a conditional write: the closest driver
  gets first refusal, and of two concurrent claims exactly one succeeds
  ([matching](#deep-dive-matching-without-double-booking)).

**Likely follow-ups.**

- Why not offer to three drivers at once? Faster, but two who accept are told
  "taken", and the fastest tapper beats the closest car
  ([matching](#deep-dive-matching-without-double-booking)).
- A match writes rows on two shards; what if it crashes between them? The
  offer's timeout check reads both rows and makes them agree within 15 seconds
  ([two rows, two shards](#deep-dive-matching-without-double-booking)).
- How is surge priced? Once a minute a job turns each coarse hexagon's recent
  requests over available drivers, read from the event log, into a smoothed,
  capped multiplier that the signed quote locks in
  ([pricing](#high-level-architecture)).
- What if an index shard dies? Its areas show no drivers for 4 to 8 seconds,
  until a standby takes over and fresh updates fill it
  ([failure modes](#failure-modes-and-bottlenecks)).

The [high-level architecture](#high-level-architecture) follows one ride from quote to drop-off.

## Requirements

Functional requirements:

- **Drivers go online and report their location** every 4 seconds while
  online.
- **Quote.** Given a pickup and a destination, show the rider a price and an
  estimated pickup time before they commit.
- **Request and match.** A ride request is offered to a nearby available
  driver, who can accept or decline; declines and silence move on to the next
  driver until someone accepts or the request gives up.
- **Track the trip.** Both sides see the trip's state, and the rider sees
  the driver's car move on the map from match until drop-off.
- **Cancel.** Either side can cancel before the trip starts.
- **Surge pricing (optional).** Where demand outruns available drivers, prices
  rise by a multiplier for that area.

Out of scope: payments beyond the hand-off, maps and turn-by-turn directions,
the routing service's internals, ride pooling, scheduled rides, ratings,
driver onboarding, fraud, and the home screen's map of cars before a request,
which reads the same location data in a cheaper, cached form.

Non-functional requirements:

- **Scale:** 25 million ride requests a day, and up to 3 million drivers
  online at the busiest moment (the estimates check that these two agree).
- **Location freshness:** a driver's position used for matching is at most
  about 5 seconds old, and the rider sees their driver's car update within
  2 seconds of the driver's phone sending it, at the 99th percentile (p99, the
  time 99% of updates beat). An occasional lost update is acceptable, since
  another follows 4 seconds later.
- **Matching latency:** from request to the first offer on a driver's phone,
  under 2 seconds at p99.
- **Correctness:** a driver is never assigned two trips at once, and a request
  never ends up with two drivers.
- **Availability:** requesting and running trips 99.99% (about 4.3 minutes of
  downtime in a 30-day month). The location path can drop individual updates
  but must not stop.

Locations are enormous in volume and nearly worthless individually; trip and
driver state is modest in volume and must never be wrong. Most of the design
follows from treating those two differently.

## Back-of-the-envelope estimates

Two rules of thumb from
[numbers every engineer should know](/engineering-practices/numbers-every-engineer-should-know)
set the peaks: a day is 86,400 seconds, and a request rate is planned for a
peak of about ten times its average. Counts of things that last many minutes,
such as drivers online, don't swing that far; assume their busiest hour is
three times the daily average.

**Ride requests.** 25,000,000 ÷ 86,400 ≈ 289 a second on average, so about
**2,900 requests a second** at peak.

**Drivers online.** The requirement of 3 million at the busiest moment should
agree with the ride count. Assume a trip occupies its driver for 25 minutes
(5 to reach the pickup, 20 with the rider), and that drivers spend half their
online time on trips.

- Driver time on trips: 25,000,000 × 25 = 625 million driver-minutes a day.
- Online time, at half busy: 1.25 billion driver-minutes a day.
- Average online: 1,250,000,000 ÷ 1,440 minutes ≈ 868,000 drivers.
- Busiest hour, at three times average: about 2.6 million, so planning for
  **3 million** leaves some room.

**Location updates.** One every 4 seconds per online driver: 3,000,000 ÷ 4 =
**750,000 updates a second** at peak, 868,000 ÷ 4 ≈ 217,000 on average. An
update is about 100 bytes of payload, 200 bytes with framing and encryption:
150 MB a second at peak, about 1.2 gigabits a second.

**Latest positions in memory.** About 200 bytes per online driver with the
index structures: 3,000,000 × 200 = **600 MB**, which fits in one machine
many times over. The write rate doesn't. Assume one in-memory index node
applies about 200,000 updates a second, planned at half for headroom:
750,000 ÷ 100,000 = 7.5, so at least 8 nodes. The index is split by area,
and areas are uneven, so plan **12 index shards**.

**Location history.** Every update is also appended to a log kept 3 days:
217,000 × 86,400 ≈ 18.7 billion updates a day, at 100 bytes about 1.9 TB a
day, about 17 TB for 3 days with three copies. Updates during a trip are
archived for good as its route (for receipts and disputes): 25 × 60 ÷ 4 =
375 updates, 37.5 KB a trip, about 0.94 TB a day or **about 340 TB a year**
in object storage.

**Trips in progress and live tracking.** 25,000,000 × 25 minutes ÷ 1,440 ≈
434,000 concurrent trips on average, about 1.3 million in the busiest hour.
Each of those riders gets their driver's position every 4 seconds:
1,300,000 ÷ 4 = **325,000 pushes a second** at peak.

**Open connections.** Every online driver and every rider on a trip holds a
persistent connection: 3,000,000 + 1,300,000 = 4.3 million at peak. Assume a
gateway server holds
200,000 connections and plan at half: 4,300,000 ÷ 100,000 = 43, so about
**45 gateway servers**.

**Trip and driver state writes.** A trip's row is written about six times
(created, one or two offers, matched, arrived, started, finished), and its
driver's row about four (claims, accept or release, freed at the end, at
1.43 offers per request as below).

- Trip rows: 25,000,000 × 6 = 150 million writes a day, 1,736 a second on
  average, about **17,400 a second** at peak.
- Driver rows: 25,000,000 × 4 = 100 million a day, about **11,600 a second**
  at peak.
- Outbox rows: about five events per trip (two at request, three at
  completion), each inserted and later marked sent, so 10 writes:
  250 million a day, about **29,000 a second** at peak.
- Together 58,000 writes a second at peak. Assume one database primary
  (defined in the data model) handles 5,000 such single-row writes a second
  with headroom: 58,000 ÷ 5,000 ≈ 12, so plan **16 shards**.
- Stored trips: at 2 KB a row, 50 GB a day, about 18 TB a year.

**Offers.** Assume 70% of offers are accepted. Offers until one is accepted
then average 1 ÷ 0.7 ≈ 1.43, so about 2,900 × 1.43 ≈ **4,100 offers a
second** at peak. A request needs three or more failed offers
0.3 × 0.3 × 0.3 ≈ 2.7% of the time.

The location path is a write-heavy stream about 260 times the size of the
ride path (750,000 against 2,900 a second), of data stale in seconds. The
trip path is small enough for a sharded relational database, but carries the
one requirement that can't bend.

## Data model

**Latest positions** live only in memory, in the location index:

```text
driver entry (one per online driver)
  driver_id     "d-42"
  lat, lng      51.5033, -0.1196
  heading       270 (degrees), speed 8.3 (metres a second)
  device_time   when the phone took the reading
  session, seq  the online session and its update counter (see the ingest deep dive)
  status_hint   available | offered | on_trip, as the phone last reported
  trip_id       the trip the phone says it is on, if any
  cell          the grid cell the position falls in

cell → set of driver_ids currently in that cell
```

`status_hint` is only a filter for choosing candidates; the authoritative
driver state is in the store below.

**Trips and drivers** live in a sharded relational database. A **shard** is
one slice of the rows on its own machine, chosen here by
[consistent hashing](/systems-and-infrastructure/consistent-hashing) of the
row's key, so adding a shard moves only a share of the rows
([partitioning vs. sharding](/systems-and-infrastructure/partitioning-vs-sharding)).
Each shard has a **primary**, the one machine that takes its writes, and two
**replicas**, copies kept up to date, either of which can take over. Trips
are sharded by `trip_id` and drivers by `driver_id`, so a trip and its driver
usually sit on different shards.

```text
trips (sharded by trip_id)
  trip_id         "t-9", chosen by the rider's app (see API design)
  rider_id
  state           requested | matched | arriving | in_progress | completed | cancelled
  pickup, dropoff latitude and longitude of each
  quote           the signed price quote the rider accepted
  attempt         number of offers made so far
  offer_driver    the driver the current offer went to
  offer_id        "t-9#2": trip ID and attempt number
  tried_drivers   drivers already offered this trip
  driver_id       set when matched
  state times     requested_at, matched_at, ..., cancel_reason
  version         raised by every write

drivers (sharded by driver_id)
  driver_id
  state           offline | available | offered | on_trip
  offer_id        the offer this driver holds, when offered
  offer_expires   when that offer lapses, by the database's own clock
  trip_id         when on_trip
  session         raised by one each time the driver goes online
  vehicle, product, city
  version

outbox (one per trip shard)
  event_id, trip_id, type, payload, created_at
```

A relational database fits because every write that matters is a
**conditional write** on one row: "change this row only if it is still in the
state I expect," a single statement on the shard's primary. **Location
history** is in neither store: every update goes to the **event log**, and a
batch job copies each trip's updates into one object in object storage.

## API design

Drivers and riders each keep a **WebSocket**, a long-lived two-way connection
opened over HTTPS, to a gateway
([WebSockets vs. SSE vs. long polling](/systems-and-infrastructure/websockets-vs-sse-vs-long-polling)).
Everything else is ordinary HTTPS.

**Driver app, over its WebSocket:**

```text
→ location  { "lat": 51.5033, "lng": -0.1196, "heading": 270, "speed": 8.3,
              "accuracy": 6, "device_time": "2026-09-28T18:04:12.200Z",
              "session": 81, "seq": 5213, "status": "on_trip",
              "trip_id": "t-9" }
← offer     { "offer_id": "t-9#2", "pickup": {...}, "pickup_eta_s": 240,
              "expires_in_s": 15 }
→ accept    { "offer_id": "t-9#2" }       or  decline { "offer_id": "t-9#2" }
← offer_result { "offer_id": "t-9#2", "result": "matched" | "expired" | "cancelled" }
```

Going online is `POST /v1/drivers/me/status` with `{ "status": "online" }`,
and the driver's trip actions are `POST /v1/trips/{id}/arrive`, `/start`,
`/complete` and `/cancel`.

**Rider app:**

```http
POST /v1/quotes
{ "pickup": {"lat": 51.5007, "lng": -0.1246}, "dropoff": {...}, "product": "standard" }

200 OK
{ "quote": "eyJwcmljZSI6...", "price": "£14.20", "surge": 1.3,
  "pickup_eta_s": 300, "expires_at": "2026-09-28T18:09:00Z" }
```

The quote is **signed**: the trip service computes a code over its contents
with a secret key only it holds, so it can later check that the price, places
and expiry came back unaltered without having stored the quote.

```http
POST /v1/rides
{ "trip_id": "t-9", "quote": "eyJwcmljZSI6..." }

201 Created
{ "trip_id": "t-9", "state": "requested" }
```

The app generates `trip_id` (a random UUID; `t-9` is short for it here) when
the rider taps Request, and reuses it on retry. The trip service inserts the
row only if that ID is new; a retry finds the row, checks it belongs to the
same rider, and returns it, so a timeout and retry never creates two trips.
That ID is the **idempotency key**, a client-chosen ID that lets the server
recognise a repeat ([idempotency](/systems-and-infrastructure/idempotency)).
An expired or tampered quote gets `400`.

`GET /v1/rides/{id}` returns the trip, and `POST /v1/rides/{id}/cancel` cancels
it. Over its WebSocket the rider receives `trip_state` frames on every state
change and, from match to drop-off, `driver_location` frames.

## High-level architecture

![Architecture of the ride-sharing service. Rider and driver apps reach a load balancer, which sends WebSockets to the connection gateways and HTTPS to the trip service. Gateways pass driver pings to the location service, which writes the latest position into the in-memory location index, appends every ping to the event log, and sends on-trip positions back through the gateways to riders. The surge and archive jobs read the event log and give surge multipliers to the trip service. The trip service receives accepts and declines from the gateways, makes conditional writes to the trip and driver store, sends match jobs to the matching workers, sends trip updates through the gateways, and asks the routing service for quote ETAs. Matching workers ask the location index who is near, get ETAs from the routing service, claim drivers in the store, and send offers through the gateways.](/diagrams/ride-sharing/architecture.svg)

The pieces:

- The **load balancer** hands each WebSocket to one gateway and sends HTTPS
  requests to the trip service.
- The **connection gateways** hold the 4.3 million open WebSockets, pass
  location frames to the location service and answers to the trip service,
  and push offers, trip updates and driver positions down to phones. A
  session registry records which gateway holds each phone, as in the
  [chat app](/system-design/messaging).
- The **location service** updates the driver's entry in the **location
  index** (in memory, split by area), appends the update to the **event
  log**, a message queue kept for 3 days, and forwards on-trip positions to
  riders.
- The **surge and archive jobs** read the event log: surge sends the trip
  service a multiplier per area every minute, and archive writes each
  finished trip's route to object storage.
- The **trip service** handles quotes, requests, driver answers and trip
  actions, and owns every state change in the **trip and driver store**.
- The **matching workers** find nearby drivers, rank them by driving time
  from the **routing service**, and claim and offer one at a time.

Following one ride:

1. The rider asks for a quote: routing's driving time and distance, times
   the pickup area's surge multiplier, returned signed.
2. The rider requests the ride. In one transaction on the trip's shard, the
   trip service inserts the trip as `requested` and writes two outbox rows,
   "match t-9" and a `ride_requested` event, then answers `201`.
3. A relay puts the match job on the match queue and the event on the event
   log; a matching worker runs the offer loop until a driver accepts.
4. The trip becomes `matched`, the rider's app gets a `trip_state` frame, and
   the driver's positions start flowing to it.
5. The driver's app moves the trip to `arriving`, `in_progress` and
   `completed`, each a conditional write.
6. Completing the trip writes a `trip_completed` event to the outbox in the
   same transaction, which the relay delivers to payments, deduplicated there
   by `trip_id`.

Steps 2 and 6 are why the outbox exists: a server that dies between writing
the trip and publishing to a queue leaves a trip nobody matches or a
completed trip nobody charges. With the event in the same transaction as the
trip row, both exist or neither does, and the relay retries. An event can
still be delivered twice (the relay can crash after publishing but before
marking the row sent), so every consumer copes: matching because each step is
a conditional write keyed by the offer's attempt number, payments by
deduplicating on `trip_id`, and surge by tolerating a rare double-counted
request ([outbox pattern](/systems-and-infrastructure/outbox-pattern)).

**Trip states.** After matching, each move is started by a phone on a mobile
network that may time out and retry:

```text
requested   → matched, cancelled
matched     → arriving, in_progress, cancelled
arriving    → in_progress, cancelled
in_progress → completed
completed, cancelled   (terminal)
```

Reading the trip, checking the move in code and writing it back would let a
rider's cancel and a driver's Start both read `arriving` and both succeed.
Instead each transition is one conditional write on its allowed source
states (Start is `WHERE state IN ('matched','arriving')`), so whichever
reaches the row first wins. A retried Start matches no rows; the trip service
reads the row and returns `200` if it is already in the target state with
the same driver, or `409 Conflict` otherwise. A trip enters each state once,
so the transition is its own idempotency key. Completing or cancelling after
a match writes `release_driver` and `notify_rider` to the outbox with the
trip row; `release_driver` is conditional on the driver being `on_trip` for
t-9, so a duplicate can never free the driver from a later trip. The trip
service also runs it at once, so the driver doesn't wait for the relay.

**Pricing.** A quote is a base fare, from the routing service's distance and
driving time, times the pickup area's surge multiplier. Computing surge per
quote would mean thousands of scans a second, and riders a block apart seeing
different prices. Instead the surge job, once a minute, counts for each area
the `ride_requested` events of the last five minutes and the drivers whose
latest update says available, both from the event log, and turns the ratio
into a smoothed, capped multiplier the trip service keeps in memory. The
price lags demand by a minute, and the quote's expiry keeps a rider from
holding an old one. The areas are coarse cells of the index's grid.

## Deep dive: ingesting driver locations

750,000 updates a second arrive at peak, and the only question anyone asks of
most of them is "where is this driver now?".

**How updates travel.** Each update as its own HTTPS request carries headers
larger than the 100-byte update, and UDP is blocked or throttled on some
networks. The driver already needs a WebSocket, because offers must reach a
phone that hasn't asked for anything, so updates go up the same connection
at a few bytes of framing each. The cost is the gateway tier: 45 servers
holding 4.3 million connections.

**Where updates are kept.** The options differ by what a lost update costs.

- _Write each update to a database row._ Durable and queryable, but 750,000
  durable writes a second, at 5,000 a second per primary, is 150 database
  shards, to protect data that is stale four seconds later.
- _Keep the latest position only in memory, and append every update to a
  log._ The index answers "who is near?" from memory, and the log keeps the
  history. If an index shard dies, its positions are gone, but every driver it
  held sends a new one within 4 seconds, so a replacement is full again in one
  reporting cycle. A snapshot to disk every few seconds would add nothing: a
  snapshot a few seconds old is no better than waiting 4 seconds.

The second is the choice. The event log is a partitioned message queue, split
by driver ID so each driver's updates stay in order
([message queues](/systems-and-infrastructure/message-queues)), and 3 days of
retention let a broken consumer be rerun. The index and the log are two
separate writes, and a location service that dies between them loses one
update from one of them. Both tolerate that: the index gets a newer position
4 seconds later, and a route missing one point in 375 is the same route.

**Latest wins.** A phone that reconnects to a different gateway after a
tunnel may still have an old update in flight on the first connection. Each
update carries a session number, raised by the server each time the driver
goes online, and a sequence number the app increases per update; the index
keeps an update only if it is newer by those, never trusting the phone's
clock. Matching ignores positions more than about 6 seconds old (one
4-second interval plus delivery lag), and an entry silent for 30 seconds is
removed.

**When the index falls behind.** If an index shard slows down (a long garbage
collection pause), holding every queued update would only deliver stale
positions late, and blocking the gateways would stall offers on the same
connections. So the location service keeps at most one pending update per
driver for each shard, replacing it when a newer one arrives: the buffer
never exceeds the number of drivers. It is the "drop" side of
[backpressure](/systems-and-infrastructure/backpressure), safe because an
older position is worth nothing once a newer one exists. The log still gets
every update.

**Live location to the rider.** Polling every 4 seconds would be 325,000
requests a second at peak, and each position would wait on average 2 seconds
for the next poll, which alone breaks the 2-second target. Pushing over the
rider's WebSocket costs only the frame. When a trip is matched, the rider's
gateway subscribes to a channel for the trip on a publish-subscribe broker
in the location tier, after checking that the rider belongs to it, and the
location service publishes each update to its trip's channel, having checked
once per trip that the driver is assigned to it. A lost push is not resent;
the next arrives 4 seconds later. With the app in the background, state
changes arrive as push notifications through the
[notification system](/system-design/notification-system).

## Deep dive: finding nearby drivers

A matching worker asks "which available drivers are near this pickup?" about
2,900 times a second, while the answers change 750,000 times a second.
Checking all 3 million drivers per request is out, so the index groups
drivers by area. Three ways to draw the areas are common.

**Geohash cells.** A **geohash** cuts the world into rectangles by repeatedly
halving longitude and latitude, and names each cell with a short string; each
extra character splits a cell into 32. At the equator, 6 characters is a cell
about 1.2 km wide by 0.61 km tall. Points in the same cell share a prefix,
which sorted structures handle well. It has two costs. Two points a few
metres apart across a cell edge can have unrelated names, so a query
searches the cell and its 8 neighbours, four of which touch only at a
corner: a lumpy square, not a circle. And cells narrow with latitude: a
6-character cell is about 0.92 km wide in New York and 0.6 km at 60° north,
so surge's per-area counts would compare areas of different sizes.

**A quadtree.** Split any square holding more than, say, 100 drivers into
four, recursively, so each leaf holds a similar number. That suits data that
stays put, such as shops. Here drivers keep crossing leaf boundaries, and
leaves split and merge as rush hour fills downtown, all under concurrent
reads, which costs a rebuild every few seconds or locking; and leaves that
change with density give surge no stable area.

**A hexagonal grid (H3-style).** H3 is an open-source system that tiles the
globe with hexagons at 16 resolutions, each about one seventh the area of the
one above. Resolution 8 cells average about 0.74 km² (roughly 0.9 km
across), and resolution 7 cells about 5.2 km². A hexagon's six neighbours
each share a full edge and sit at the same distance, so "this cell and its
neighbours" is much rounder than a 3 × 3 block of squares, and cells are
close to equal in area everywhere, so counts per cell compare across cities.
The costs: a library to depend on, and hexagons that don't nest exactly, so a
resolution-7 cell is only approximately its seven children.

**The choice** is the hexagonal grid at resolution 8 for matching, and
resolution 7 for surge areas. Geohash was a close second, its costs here
manageable, while the quadtree's come from the movement itself. The index
maps each cell to the set of drivers in it. An update recomputes the driver's
cell and, only if it changed, moves the driver between sets. At 50 km/h a car
covers about 56 m between updates, crossing a 0.9 km cell about every 16
updates, so at most one update in 16 (roughly 45,000 a second at peak, fewer
since many drivers are parked) touches two sets.

A search reads the pickup's cell and the ring around it, 7 cells, about
5.2 km², widening to 19 cells and about 14 km² if that yields fewer than 10
available drivers. The closest 10 go to the routing service for driving
times in one call, since 300 m across a river can be a 10-minute drive:
2,900 routing calls a second covering 29,000 driver-to-pickup pairs.

**Splitting the index across shards.** Dividing the 12 shards by driver ID
spreads updates evenly, but every search then asks all 12. Dividing by area
(each resolution-4 cell, about 1,770 km², assigned to one shard) keeps a
search on one shard, or two near an edge, at the cost of hot spots (central
London against rural Wales) and drivers moving between shards at area edges.
This design splits by area, gives the busiest areas a shard to themselves,
and moves areas with an assignment table. Even an area with 100,000 drivers
online sends only 25,000 updates a second, a quarter of one shard's planned
capacity. If a removal from the old shard is lost, the 30-second expiry
clears the stale entry.

## Deep dive: matching without double-booking

Matching runs as a loop per request: find candidates, pick one, offer, wait,
and repeat until someone accepts. It has two questions: how many drivers see
an offer at once, and how no driver ends up with two trips.

![Sequence of one ride request through matching. The rider app sends POST /rides t-9 to the trip service, which inserts trip t-9 with a match job in the trip and driver store and answers 201 requested. The match job reaches a matching worker through the outbox and queue. The worker gets d-17, d-42 and d-8 from the location index and ranks them by ETA as d-42, d-17, d-8. It records offer 1 to d-42 on trip t-9, claims d-42 if available, and sends offer t-9#1 with 15 seconds to answer. With no answer in 15 seconds, it releases d-42 if the driver still holds t-9#1, records offer 2 to d-17, claims d-17 if available, and sends offer t-9#2. d-17 accepts t-9#2 to the trip service, which sets d-17 on trip if offer t-9#2 is still live, sets t-9 matched if offer 2 is still current, and tells the rider app it is matched with d-17.](/diagrams/ride-sharing/match-sequence.svg)

**One driver at a time, or several at once.** The sequence shows one at a
time: the best-ranked driver gets the offer and 15 seconds to answer, and
only a decline or the timeout moves it on.

- _One at a time_ gives the closest driver the ride, and every driver who
  accepts gets it. It's slow when drivers don't answer: with 70% acceptance,
  30% of requests wait for at least one decline or timeout, and the 2.7%
  that need a fourth offer can wait up to 45 seconds before it is sent.
- _Broadcasting to the top three_ matches faster, since the first of three
  answers wins. But two drivers who tap Accept are told "taken," which drivers
  learn to resent; the fastest tapper beats the closest car; and the three are
  held out of other offers meanwhile, or aren't and collide with other
  broadcasts.

This design offers to one driver at a time: one live offer per trip is what
lets the writes below settle every accept and timeout with a single
`offer_id`. Assigning a second or two of requests together is a later
refinement for crowds.

**The double-booking race.** Two riders a block apart request at once, and
two matching workers both see driver d-42 as available and closest: the
check-then-act race
[race conditions](/systems-and-infrastructure/race-conditions) describes.
Locking the driver first works, but holds a lock across a network round trip
and adds a lock service to the critical path. Instead the claim is one
conditional write:

```sql
UPDATE drivers
SET state = 'offered', offer_id = 't-9#1',
    offer_expires = now() + interval '15 seconds', version = version + 1
WHERE driver_id = 'd-42' AND state = 'available';
```

The database runs it atomically on d-42's row, so of two concurrent claims
exactly one changes a row; the other sees zero rows updated and moves to its
next candidate. Conflicts are rare outside dense, busy areas, so a failed
claim is cheap: the optimistic side of
[optimistic vs. pessimistic locking](/systems-and-infrastructure/optimistic-vs-pessimistic-locking).

**The offer is a lease**: a claim that expires on its own after 15 seconds,
so a worker that dies can't hold a driver forever. A lease can expire while
its holder is still alive, such as a worker paused 20 seconds by garbage
collection that wakes believing it owns the offer. The fix
[distributed locks](/systems-and-infrastructure/distributed-locks) gives is a
fencing token checked by the resource itself, here the `offer_id`, which
every later write about the offer names:

```sql
-- accept, from the driver's phone through the trip service
UPDATE drivers SET state = 'on_trip', trip_id = 't-9'
WHERE driver_id = 'd-17' AND state = 'offered' AND offer_id = 't-9#2'
  AND offer_expires > now();

-- release, on timeout, decline or cancellation
UPDATE drivers SET state = 'available', offer_id = NULL
WHERE driver_id = 'd-42' AND state = 'offered' AND offer_id = 't-9#1';
```

Accept and release for one offer are decided by the same row, so exactly one
wins; a driver who taps Accept at 15.2 seconds is told the offer expired, and
a paused worker with an old `offer_id` changes nothing. The expiry uses the
database's own clock (`now()` on the shard's primary), so no two machines'
clocks are compared.

On a single-primary shard this conditional write costs about what any update
does. On a leaderless store (where several replicas each accept writes), a
compare-and-set needs a consensus round of several extra round trips, which
is part of why the store is relational. Each shard's primary confirms a write
once either of its two replicas has it, so a claim confirmed before a failover is on at least one replica, and the failover promotes a replica that has it, so a driver isn't claimed twice across it; that adds about half a millisecond to every write.

**Two rows, two shards.** A match changes the driver's row and the trip's, on
different shards, with no transaction across them. The worker acknowledges a
"match t-9" job only when its step is done, so a crashed worker's job is
redelivered, and each step can be safely retried:

1. Record the offer on the trip (`attempt=2`, `offer_driver='d-17'`,
   `offer_id='t-9#2'`), conditional on `attempt=1`. The attempt number makes
   the offer ID deterministic, so a redelivered job continues from the
   recorded offer instead of minting another.
2. Claim the driver, a write that also succeeds if d-17 already holds
   `t-9#2`. If d-17 is taken, add it to `tried_drivers` and go back to step
   1 with the next candidate.
3. Send the offer and schedule a timeout check 15 seconds later as a delayed
   message on the match queue. The phone ignores a resent `offer_id`.

A decline releases the driver and queues a "continue t-9" job; if the trip service dies between the two, the timeout check continues the loop 15 seconds later instead. On acceptance
the trip service writes the driver row first, then sets the trip `matched`
on condition that it is still `requested` with offer `t-9#2`. A crash between
them leaves d-17 on trip t-9 while t-9 still says `requested`. The timeout
check, which runs for every offer, reads both rows and makes them agree: a driver still `offered` with this offer is released and recorded as tried, and the loop continues; a driver already released while the trip still shows this offer continues the loop; a driver
`on_trip` for a still-`requested` trip gets the match finished; a driver
`on_trip` for a cancelled trip is released. Each is a conditional write, so
a check that runs twice does no harm, and the worst case is a rider waiting
15 seconds longer for "matched."

The index's `status_hint` never enters into correctness: a driver just
claimed but still shown as available fails the claim, and the worker moves
on. If no driver accepts within a limit (say 5 offers or 2 minutes), the trip
moves to `cancelled` with reason `no_drivers`.

## Failure modes and bottlenecks

**An index shard dies.** Its areas show no drivers until a standby takes them
over and the next round of updates fills it, 4 to 8 seconds in all. Matching
waits a few seconds and searches again, so riders see a slower match, not an
error. No replica is kept, because the data rebuilds itself faster than a
failover would run, and surge reads the log, so it's unaffected.

**A gateway dies.** Its 100,000 phones reconnect after random delays
([exponential backoff](/systems-and-infrastructure/exponential-backoff)), and
an offer sent to the dead connection times out and moves on.

**A store shard fails over.** For the seconds a replica takes to become
primary, a sixteenth of trips and drivers can't change state: requests retry
with the same `trip_id`, and those drivers can't be claimed. Every confirmed write is on at least one replica, and the failover promotes one that has it, so nothing confirmed is lost.

**The routing service is slow.** A
[circuit breaker](/systems-and-infrastructure/circuit-breaker) stops waiting
on it, and matching and quotes fall back to straight-line distance, which
sometimes picks a worse driver (the river) but keeps working.

**A crowd in one cell.** A stadium empties and 20,000 requests arrive in a few
resolution-8 cells within ten minutes, against a few hundred drivers. Workers
keep picking the same closest drivers, and many claims fail, each costing a
retry. Surge raises the price within a minute, which trims demand and draws
drivers in; batched assignment is the tool for this case when it's built.

**Phones that glitch.** GPS among tall buildings can jump hundreds of metres,
so the location service drops an update that implies over 200 km/h since the
last one and lets the next confirm the move.

**What to watch.** Update lag from phone to index, request-to-first-offer
time at p99, claim failure rate (a rise in one area is usually the first sign
of a crowd), acceptance rate by area, and store write latency per shard
([observability](/systems-and-infrastructure/observability)).

## Trade-offs

Latest positions live only in memory. That saves around 150 database shards'
worth of durable writes, for a few seconds of blindness in one region when an
index shard fails. It works only because every driver repeats themselves
every 4 seconds; a trip's state isn't resent, so it gets a durable store.

The hexagonal grid beats geohash on search shape and cell size, and a
quadtree on constant movement, for a library dependency.

- **Splitting the index by area.** A search usually hits one shard, but busy
  cities need their own shards and an assignment table.
- **Offering one driver at a time.** Riders wait up to 15 seconds per failed
  offer, but the closest driver gets first refusal and no driver accepts a
  ride they then lose.
- **Conditional writes over locks.** No lock is held across a network call,
  but every transition is a compare-and-set, which rules out leaderless
  stores for this data.
- **Two rows on two shards without a transaction.** Trips and drivers scale
  independently, but a crash mid-match leaves them disagreeing for up to
  15 seconds.
- **Batched surge.** Stable, cheap prices that lag a sudden crowd by about a
  minute.

What would change the design: pooled rides would turn matching into fitting
several requests into one car's route, making batched assignment the default.
And if drivers reported every second instead of every 4, the location path
would grow fourfold while nothing on the trip path changed, which is the
point of keeping the two apart.
