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
position every few seconds, millions of times a minute, and almost every one
of those reports is worthless four seconds later. The other is small and
strict: each ride request has to end with exactly one driver, and each driver
can carry only one ride at a time, even when two riders a block apart ask for
the same car in the same second.

This case study designs both, plus the trip itself as it moves from request to
drop-off. It is one plausible design for a service like Uber or Lyft, not a
description of how any company built theirs. Routing on the road network,
which turns two points into a driving time, is its own later case study, and
here it is simply a service that answers "how long from A to B?". Payments are
also a later case study: a finished trip hands off to them in one step.

## Requirements

Functional requirements:

- **Drivers go online and report their location.** While online, a driver's
  app sends its position every 4 seconds.
- **Quote.** Given a pickup and a destination, show the rider a price and an
  estimated pickup time before they commit.
- **Request and match.** A ride request is offered to a nearby available
  driver, who can accept or decline; declines and silence move on to the next
  driver until someone accepts or the request gives up.
- **Track the trip.** Rider and driver both see the trip's state (driver on
  the way, arrived, on trip, finished), and the rider sees the driver's car
  move on the map, from match until drop-off.
- **Cancel.** Either side can cancel before the trip starts.
- **Surge pricing (optional).** Where demand outruns available drivers, prices
  rise by a multiplier for that area.

Out of scope: payments beyond handing a finished trip to a payments service,
map rendering and turn-by-turn directions, the routing service's internals,
ride pooling (several riders sharing one car), scheduled rides, ratings, driver
onboarding and document checks, fraud, and the home screen's map of cars
before a request, which reads the same location data in a cheaper, cached
form. Each is a real feature; none changes the core of location, matching and
trip state.

Non-functional requirements:

- **Scale:** 25 million ride requests a day, and up to 3 million drivers
  online at the busiest moment (the estimates check that these two agree).
- **Location freshness:** a driver's position used for matching is at most
  about 5 seconds old, and the rider sees their driver's car update within
  2 seconds of the driver's phone sending it, at the 99th percentile (p99, the
  time 99% of updates beat). An occasional lost position update is acceptable,
  since another follows 4 seconds later.
- **Matching latency:** from request to the first offer on a driver's phone,
  under 2 seconds at p99. How long the driver then takes to answer is theirs,
  not the system's.
- **Correctness:** a driver is never assigned two trips at once, and a request
  never ends up with two drivers. This one is absolute: a double-booked driver
  is two stranded riders.
- **Availability:** requesting and running trips 99.99% (about 4.3 minutes of
  downtime in a 30-day month). The location path can drop individual updates
  but must not stop.

The requirements split the data cleanly. Locations are enormous in volume and
nearly worthless individually. Trip and driver state is modest in volume and
must never be wrong. Most of the design follows from treating those two
differently.

## Back-of-the-envelope estimates

Two rules of thumb from
[numbers every engineer should know](/engineering-practices/numbers-every-engineer-should-know)
set the peaks: a day is 86,400 seconds, and a request rate is planned for a
peak of about ten times its average. Counts of things that last many minutes,
such as drivers online or trips in progress, don't swing that far; this design
assumes the busiest hour of those is three times the daily average. Figures
are rounded, and the roundings are stated.

**Ride requests.**

- Average: 25,000,000 Ã· 86,400 â‰ˆ 289 a second.
- Peak, at ten times average: about **2,900 requests a second**, which also
  covers a concert or a football match letting out in one city.

**Drivers online.** The requirement of 3 million at the busiest moment should
agree with the ride count. Assume a trip occupies its driver for 25 minutes
(5 to reach the pickup, 20 with the rider), and that drivers spend half their
online time on trips.

- Driver time on trips: 25,000,000 Ã— 25 = 625 million driver-minutes a day.
- Online time, at half busy: 1.25 billion driver-minutes a day.
- Average online: 1,250,000,000 Ã· 1,440 minutes â‰ˆ 868,000 drivers.
- Busiest hour, at three times average: about 2.6 million, so planning for
  **3 million** leaves some room.

**Location updates.** One every 4 seconds per online driver:

- Peak: 3,000,000 Ã· 4 = **750,000 updates a second**.
- Average: 868,000 Ã· 4 â‰ˆ 217,000 a second.
- On the wire, an update is about 100 bytes of payload (driver, time, latitude,
  longitude, heading, speed, accuracy, sequence number), call it 200 bytes with
  framing and encryption. At peak: 750,000 Ã— 200 = 150 MB a second, about
  1.2 gigabits a second arriving at the gateways.

**Latest positions in memory.** One entry per online driver, about 200 bytes
with the index structures around it: 3,000,000 Ã— 200 = **600 MB**. That fits
in one machine's memory many times over. What doesn't fit on one machine is
the write rate. Assume one in-memory index node applies about 200,000 updates
a second, and plan it at half that to leave headroom: 750,000 Ã· 100,000 = 7.5,
so at least 8 nodes. The index is split by area (the geospatial deep dive
explains why), and areas are uneven, so plan **12 index shards** and move
areas between them as load shifts.

**Location history.** Every update is also appended to a log, kept 3 days for
the batch jobs that read it:

- Per day: 217,000 Ã— 86,400 â‰ˆ 18.7 billion updates.
- At 100 bytes stored each: about 1.9 TB a day, 5.6 TB for 3 days, and about
  17 TB with three copies.

The updates sent during a trip are also archived for good, as the trip's route
(for receipts, disputes and safety reviews). A 25-minute trip at one update
every 4 seconds is 25 Ã— 60 Ã· 4 = 375 updates, 37.5 KB. Across 25 million
trips that is about 0.94 TB a day, **about 340 TB a year** before compression,
in cheap object storage.

**Trips in progress and live tracking.**

- Average concurrent trips: 25,000,000 Ã— 25 minutes Ã· 1,440 â‰ˆ 434,000.
- Busiest hour, three times that: about 1.3 million.
- Each rider on a trip gets their driver's position every 4 seconds:
  1,300,000 Ã· 4 = **325,000 pushes a second** at peak.

**Open connections.** Every online driver holds a persistent connection (it
carries offers), and so does every rider with a trip under way:
3,000,000 + 1,300,000 = 4.3 million at peak. Assume a gateway server holds
200,000 connections and plan at half: 4,300,000 Ã· 100,000 = 43, so about
**45 gateway servers**.

**Trip and driver state writes.** A trip's row is written about six times over
its life (created, one or two offers recorded, matched, arrived, started,
finished), and its driver's row about four (claimed for an offer, then
accepted or released, and freed at the end, with 1.43 offers per request as
worked out below).

- Trip rows: 25,000,000 Ã— 6 = 150 million writes a day, 1,736 a second on
  average, about **17,400 a second** at the ten-times peak.
- Driver rows: 25,000,000 Ã— 4 = 100 million a day, about **11,600 a second**
  at peak.
- Outbox rows, on the trip shards: about five events per trip (two at
  request, three at completion; a cancellation writes its own instead), each
  inserted and later marked sent by the relay, so 10 writes. 25,000,000 Ã— 10
  = 250 million a day, about **29,000 a second** at peak.
- Together 17,400 + 11,600 + 29,000 = 58,000 writes a second at peak. Assume
  one database primary (defined in the data model) handles 5,000 such
  single-row writes a second with headroom: 58,000 Ã· 5,000 â‰ˆ 12, so plan
  **16 shards**.
- Stored trips: at 2 KB a row, 25,000,000 Ã— 2 KB = 50 GB a day, about 18 TB a
  year.

**Offers.** Assume 70% of offers are accepted and the rest are declined or
ignored. The number of offers until one is accepted then averages
1 Ã· 0.7 â‰ˆ 1.43, so about 2,900 Ã— 1.43 â‰ˆ **4,100 offers a second** at peak. A
request needs three or more failed offers 0.3 Ã— 0.3 Ã— 0.3 â‰ˆ 2.7% of the time.

What the estimates say: the location path is a write-heavy stream about 260
times the size of the ride path (750,000 against 2,900 a second), made of
data that goes stale in seconds. The trip path is small enough for a sharded
relational database, but it carries the one requirement that can't bend. The
design should keep the two apart.

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

cell â†’ set of driver_ids currently in that cell
```

`status_hint` is only a filter for choosing candidates. The authoritative
driver state is in the store below.

**Trips and drivers** live in a relational database, sharded. A **shard** is
one slice of the rows on its own machine, here chosen by hashing the row's key
with [consistent hashing](/systems-and-infrastructure/consistent-hashing), so
each ID has exactly one home and adding a shard later moves only a share of
the rows; each shard has a **primary**, the one
machine that takes its writes, and two **replicas**, copies kept up to date,
either of which can take over. [Partitioning vs. sharding](/systems-and-infrastructure/partitioning-vs-sharding)
covers what splitting a table this way involves. Trips are sharded by
`trip_id` and drivers by `driver_id`, so a trip and its driver usually sit on
different shards, which matters in the matching deep dive.

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
state I expect," which such a database runs as a single statement on the
shard's primary. The outbox table holds events (a trip completed, a match job
to start) written in the same transaction as the trip row that caused them;
the high-level architecture explains why.

**Location history** is not in either store. Every update goes to the
**event log** (a message queue, described under the architecture), and a
batch job copies each trip's updates, which carry the trip's ID, into one
object per trip in object storage once the trip's updates stop.

## API design

Drivers and riders each keep a **WebSocket**, a long-lived two-way connection
opened over HTTPS, to a gateway. [WebSockets vs. SSE vs. long polling](/systems-and-infrastructure/websockets-vs-sse-vs-long-polling)
compares it with the alternatives; the ingest deep dive says why it wins here.
Everything else is ordinary HTTPS.

**Driver app, over its WebSocket:**

```text
â†’ location  { "lat": 51.5033, "lng": -0.1196, "heading": 270, "speed": 8.3,
              "accuracy": 6, "device_time": "2026-09-28T18:04:12.200Z",
              "session": 81, "seq": 5213, "status": "on_trip",
              "trip_id": "t-9" }
â† offer     { "offer_id": "t-9#2", "pickup": {...}, "pickup_eta_s": 240,
              "expires_in_s": 15 }
â†’ accept    { "offer_id": "t-9#2" }       or  decline { "offer_id": "t-9#2" }
â† offer_result { "offer_id": "t-9#2", "result": "matched" | "expired" | "cancelled" }
```

Going online and offline is `POST /v1/drivers/me/status` with
`{ "status": "online" }`, and the driver's trip actions are
`POST /v1/trips/{id}/arrive`, `/start`, `/complete` and `/cancel`.

**Rider app:**

```http
POST /v1/quotes
{ "pickup": {"lat": 51.5007, "lng": -0.1246}, "dropoff": {...}, "product": "standard" }

200 OK
{ "quote": "eyJwcmljZSI6...", "price": "Â£14.20", "surge": 1.3,
  "pickup_eta_s": 300, "expires_at": "2026-09-28T18:09:00Z" }
```

The quote is **signed**: the trip service computes a code over its contents
with a secret key only it holds, so it can later check that the price, places
and expiry came back unaltered, without having stored the quote anywhere.

```http
POST /v1/rides
{ "trip_id": "t-9", "quote": "eyJwcmljZSI6..." }

201 Created
{ "trip_id": "t-9", "state": "requested" }
```

The app generates `trip_id` (a random UUID; `t-9` is short for it here) when
the rider taps Request, and reuses it if it has to retry. The trip service
inserts the row only if that ID is new; a retry finds the row, checks that it
belongs to the same rider, and returns it unchanged, so a timeout and retry
never creates two trips. That ID doubles as the **idempotency key** the
[idempotency](/systems-and-infrastructure/idempotency) topic describes: a
client-chosen ID that lets the server recognise a repeat. An expired or
tampered quote gets `400`, and the app asks for a fresh one.

`GET /v1/rides/{id}` returns the trip, and `POST /v1/rides/{id}/cancel` cancels
it. Over its WebSocket the rider receives `trip_state` frames on every state
change and, from match to drop-off, `driver_location` frames.

## High-level architecture

![Architecture of the ride-sharing service. Rider and driver apps reach a load balancer, which sends WebSockets to the connection gateways and HTTPS to the trip service. Gateways pass driver pings to the location service, which writes the latest position into the in-memory location index, appends every ping to the event log, and sends on-trip positions back through the gateways to riders. The surge and archive jobs read the event log and give surge multipliers to the trip service. The trip service receives accepts and declines from the gateways, makes conditional writes to the trip and driver store, sends match jobs to the matching workers, sends trip updates through the gateways, and asks the routing service for quote ETAs. Matching workers ask the location index who is near, get ETAs from the routing service, claim drivers in the store, and send offers through the gateways.](/diagrams/ride-sharing/architecture.svg)

The pieces:

- The **load balancer** spreads incoming connections across servers. It hands
  each WebSocket to one gateway, where it stays until it closes, and sends
  HTTPS requests to the trip service.
- The **connection gateways** hold the 4.3 million open WebSockets. They pass
  location frames to the location service and accept and decline frames to the
  trip service, and push offers, trip updates and driver positions down to
  phones. Finding which gateway holds a given phone is done with a session
  registry, exactly as in the [chat app](/system-design/messaging), whose
  deep dive covers holding and routing connections at scale; it is part of the
  gateway tier in the diagram.
- The **location service** takes each position update, updates the driver's
  entry in the **location index** (in memory, split by area), and appends the
  update to the **event log**, a message queue kept for 3 days. For a
  driver on a trip it also forwards the position to that trip's rider.
- The **surge and archive jobs** read the event log, which also carries one
  small event per ride request from the trip service, relayed from its outbox
  (step 3 below). The surge job computes
  a price multiplier per area every minute and sends the table to the trip
  service; the archive job writes each finished trip's route to object
  storage.
- The **trip service** handles quotes, ride requests, driver answers and trip
  actions, and owns every state change in the **trip and driver store**.
- The **matching workers** turn a new request into offers: they ask the index
  for nearby drivers, rank them by driving time from the **routing service**,
  claim one driver at a time in the store, and send the offer.

Following one ride from request to drop-off:

1. The rider asks for a quote. The trip service gets the driving time and
   distance from the routing service, applies the pickup area's current surge
   multiplier, and returns a signed quote.
2. The rider requests the ride. In one transaction on the trip's shard, the
   trip service inserts the trip as `requested` and writes two rows to that
   shard's outbox, "match t-9" and a `ride_requested` event with the pickup,
   then answers `201`.
3. A relay reads new outbox rows and puts each where it belongs, the match
   job on the match queue and the request event on the event log; a matching
   worker takes "match t-9" and runs the offer loop in the matching deep dive
   until a driver accepts.
4. On acceptance the trip becomes `matched`. The rider's app gets a
   `trip_state` frame, and from now on the location service forwards the
   driver's positions to it.
5. The driver's app moves the trip to `arriving` near the pickup, to
   `in_progress` when the rider gets in, and to `completed` at the destination,
   each a conditional write described in the trip state machine deep dive.
6. Completing the trip writes a `trip_completed` event to the outbox in the
   same transaction. The relay delivers it to the payments service, which
   charges the quoted price and deduplicates by `trip_id`.

Steps 2 and 6 are why the outbox exists. Writing the trip and then, as a
separate step, publishing to a queue is two writes to two systems, and a
server that dies between them leaves a trip nobody tries to match or a
completed trip nobody charges. With the event row committed in the same
transaction as the trip row, either both exist or neither does, and the relay
retries until the queue accepts the event. The cost is that an event can be
delivered twice (the relay can crash after publishing but before marking the
row sent), so every consumer copes with duplicates: matching because each of
its steps is a conditional write keyed by the offer's attempt number, payments
by deduplicating on `trip_id`, and surge by tolerating a rare double-counted
request. That is the trade the [outbox pattern](/systems-and-infrastructure/outbox-pattern)
describes.

**Pricing and ETA, briefly.** A quote is a base fare, from the routing
service's distance and driving time, times the surge multiplier of the pickup's
area. Surge could be computed per request, by counting available drivers and
recent requests around each pickup at quote time: exact, but 2,900 requests a
second (and more quotes than that) each scanning several cells, and two
riders a block apart could see different prices a second apart. Instead the
surge job, once a minute, counts for each area the `ride_requested` events of
the last five minutes (demand) and the drivers whose latest update says
available (supply), both from the event log, turns the ratio into a
multiplier with smoothing and a cap, and sends the table to the trip service,
which keeps it in memory. A price that lags demand by a minute is the
cost, and the quote's expiry keeps a rider from holding an old price for
long. The areas are cells of the same hexagonal grid the index uses, at a
coarser size, as the geospatial deep dive describes.

## Deep dive: ingesting driver locations

750,000 updates a second arrive at peak, and the only question anyone asks of
most of them is "where is this driver now?". Three decisions shape the path:
how updates travel, where they are kept, and what happens when they pile up.

**How updates travel.** The phone could send each update as its own HTTPS
request. That works through any network, but each request carries headers
larger than the 100-byte update, and a phone that sends one every 4 seconds
keeps its radio awake regardless. Sending over UDP, a transport with no
connection and no delivery guarantee, suits data where a lost packet doesn't
matter, but some networks and firewalls block or throttle it, and it needs
its own encryption. The driver already needs a WebSocket, because offers must
reach a phone that hasn't asked for anything, so updates go up the same
connection at a few bytes of framing each. The cost is the gateway tier: 45
servers holding 4.3 million connections, with the reconnect storms the
failure modes cover.

**Where updates are kept.** There are three options, and they differ by what a
lost update costs.

- _Write each update to a database row._ The latest position would be durable
  and queryable. But 750,000 durable writes a second, at the 5,000 a second
  per primary assumed above, is 150 database shards, to protect data that is
  stale four seconds later.
- _Keep the latest position only in memory, and append every update to a
  log._ The index answers "who is near?" from memory, and the log keeps the
  history for anything that wants it later. If an index shard dies, its
  positions are gone, but every driver it held sends a new one within 4
  seconds, so a replacement shard is full again in one reporting cycle. This
  is the choice.
- _Keep the latest position in memory and snapshot it to disk every few
  seconds._ A restarted shard could load the snapshot, but a snapshot a few
  seconds old is no better than waiting 4 seconds for fresh updates, so the
  snapshots would be written and never usefully read.

The event log is a partitioned message queue, split by driver ID so each
driver's updates stay in order within a partition, as [message queues](/systems-and-infrastructure/message-queues)
explains. Its consumers (surge, route archive, analytics) read at their own
pace, and the 3 days of retention let a broken job be fixed and rerun. The
index and the log are two separate writes, and a location service that dies
between them leaves one update missing from one of them. Here that is
acceptable on both sides: the index gets a newer position 4 seconds later, and
a route missing one point in 375 is still the same route.

**Latest wins, and old updates lose.** Updates can arrive out of order: a
phone that loses signal in a tunnel and reconnects to a different gateway may
have an old update still in flight on the first connection. Each update
carries a session number, which the server hands out (one higher each time)
when the driver goes online, and a sequence number that the app increases by
one per update. The index keeps an entry's position only if the incoming
update is from the same session with a higher sequence number, or from a
higher session. Using the phone's own counter instead of its clock avoids trusting a
phone's time, which can be off by minutes. An update that arrives out of order
is dropped, since a newer one is already there.

The index also drops entries that go quiet. A driver whose last update is more
than 30 seconds old has probably lost signal or closed the app, so the entry is
removed and the driver stops appearing as a candidate. Matching ignores
positions more than about 6 seconds old (one 4-second reporting interval plus
delivery lag) even before that, which is what keeps the positions it uses
within the 5-second freshness target.

**When the index falls behind.** If an index shard slows down (a long garbage
collection pause, a noisy neighbour on the machine), updates queue up in the
location service. Holding all of them would only deliver stale positions late,
and blocking the gateways would stall offers on the same connections. So the
location service keeps at most one pending update per driver for each shard,
replacing it when a newer one arrives: the buffer can never exceed the number
of drivers, and a shard that catches up applies only the latest position. It
is the "drop" side of [backpressure](/systems-and-infrastructure/backpressure),
made safe by the fact that an older position is worth nothing once a newer one
exists. The log is written separately and keeps every update.

**Live location to the rider.** During a trip, the rider's map needs the same
updates. The rider's app could poll, `GET /v1/rides/t-9/driver-location` every
4 seconds: simple, but 325,000 requests a second at peak, each with HTTPS
headers, and each position waits on average 2 seconds (up to 4) for the next
poll, which alone breaks the 2-second target. Pushing over the rider's
WebSocket costs nothing per update beyond the frame, and the position leaves
as soon as it arrives. So when a trip is matched, the gateway holding the
rider's connection subscribes to a channel named for the trip on a
publish-subscribe broker that runs inside the location tier, after checking
with the trip service that the rider belongs to that trip. Each driver update
carries its `trip_id`, and the location service publishes it to that trip's
channel, having checked once per trip with the trip service that this driver
is assigned to it, so a driver's app can't send positions into someone else's
trip. The gateway unsubscribes when the trip ends.

A pushed update that is lost (a gateway restart, a full buffer) is not
resent; the next arrives 4 seconds later, and the app animates the car
smoothly between points so gaps don't show as jumps. When the rider's app
goes to the background, the operating system suspends it and its connection
goes quiet, and state changes such as "your driver has arrived" reach the
phone as push notifications through the
[notification system](/system-design/notification-system). Position updates
are not pushed that way; the map resumes when the app is opened.

## Deep dive: finding nearby drivers

A matching worker asks "which available drivers are near this pickup?" about
2,900 times a second, while the answers change 750,000 times a second. The
index has to make both cheap. Checking the distance to all 3 million drivers
per request is out, so the index groups drivers by area. Three ways to draw
the areas are common.

**Geohash cells.** A **geohash** cuts the world into a grid of rectangles by
repeatedly halving longitude and latitude, and names each cell with a short
string; each extra character splits a cell into 32 smaller ones. At the
equator, 5 characters is a cell of about 4.9 Ã— 4.9 km, 6 characters about
1.2 km wide by 0.61 km tall, and 7 characters about 153 Ã— 153 m. Points in the
same cell share a prefix, so "nearby" becomes "same prefix," which ordinary
sorted structures handle well; Redis's geospatial commands, for instance, keep
members in a sorted set scored by a 52-bit geohash and answer radius queries
from it.

It has two costs. The first is the **boundary problem**: two points a few
metres apart on either side of a cell edge can have unrelated names. Just
west of the Greenwich meridian in London, geohashes start `gcp`; a few metres
east, they start `u10`. So a query has to search the pickup's cell and its 8
neighbours, and four of those neighbours touch only at a corner, so their
centres are about 1.4 times farther away than the other four: the search area
is a lumpy square, not a circle. The second is that the cells are fixed in
degrees, so they narrow as latitude rises. A 6-character cell is 1.2 km wide at
the equator, about 0.92 km in New York and about 0.6 km at 60Â° north. A
per-area count (such as surge's supply and demand) then compares areas of
different sizes from city to city.

**A quadtree.** Start with the whole map as one square, and split any square
holding more than, say, 100 drivers into four, recursively. Dense downtown
areas end up with small squares and empty countryside with huge ones, so each
leaf holds a similar number of drivers and a search reads a similar amount of
data anywhere. That adaptivity is its strength for data that stays put (shops,
restaurants). Here the points move: with 750,000 updates a second, drivers
keep crossing leaf boundaries, leaves have to split and merge as rush hour
fills and empties downtown, and all of that happens under concurrent reads.
Typical answers are rebuilding the tree every few seconds or locking parts of
it, and either costs more than a fixed grid. And a leaf's boundaries change
with density, so there's no stable area to attach a surge price to.

**A hexagonal grid (H3-style).** H3 is an open-source system that tiles the
globe with hexagons at 16 resolutions, each resolution's cells about one
seventh the area of the one above. Resolution 8 cells average about 0.74 kmÂ²
(roughly 0.9 km across), and resolution 7 cells about 5.2 kmÂ². A hexagon has
six neighbours, every one sharing a full edge and every one's centre the same
distance away, so "this cell and its neighbours" is a much rounder area than a
3 Ã— 3 block of squares. The cells are close to equal in area everywhere, which
makes counts per cell comparable across cities. The costs: converting a
latitude and longitude to a cell is more arithmetic than a geohash (still
trivial next to a network round trip), there is a library to depend on, and hexagons don't
nest perfectly, so a resolution-7 cell is only approximately made of its
seven resolution-8 children. Each resolution also has 12 pentagons, placed
in the oceans, which a road-bound service can ignore.

**The choice** is the hexagonal grid at resolution 8 for matching, and
resolution 7 for surge areas. The index is a map from each cell to the set of
drivers in it, plus each driver's entry. An update recomputes the driver's
cell; if it's unchanged, only the entry is rewritten, and if it changed, the
driver moves from one set to another. At 50 km/h a car covers about 56 m
between updates, so it crosses a 0.9 km cell about every 16 updates, and at
most about one update in 16 (roughly 45,000 a second at peak, fewer since
many drivers are parked) touches two sets.

A search starts with the pickup's cell and the ring around it, 7 cells,
about 5.2 kmÂ². If that yields fewer than 10 available drivers, it widens to
the next ring, 19 cells and about 14 kmÂ², and so on up to a limit. The
candidates are sorted by straight-line distance and the closest 10 go to the
routing service for driving times in one call, because 300 m across a river
with no bridge can be a 10-minute drive. At 2,900 requests a second that's
2,900 routing calls a second covering 29,000 driver-to-pickup pairs.

Geohash was a close second: its costs here are the lumpier search area and
unequal cells, both manageable, while the quadtree's costs come from the
movement itself.

**Splitting the index across shards.** The 12 shards could divide drivers by
driver ID, which spreads updates perfectly evenly, but then every search has
to ask all 12 shards and merge the answers. Or they could divide by area: each
resolution-4 cell (about 1,770 kmÂ², a few tens of kilometres across) is
assigned to one shard, and a driver's updates go to the shard owning the
area they're in. A search then usually touches one shard, or two near an area
edge. The cost of splitting by area is hot spots: the shard holding central
London takes far more updates than one holding rural Wales, and a driver
crossing an area edge has to be removed from one shard and added to another.
This design splits by area, because each search then stays on one machine,
and deals with the hot spots by assignment: the busiest areas get a shard to
themselves, and the assignment table can move an area to another shard. A
single area with 100,000 drivers online sends 25,000 updates a second, a
quarter of one shard's planned capacity. If the removal from the old shard is
ever lost, the 30-second expiry clears the stale entry.

## Deep dive: matching without double-booking

Matching runs as a loop per request: find candidates, pick one, offer, wait,
and repeat until someone accepts. The loop has two design questions: how many
drivers see an offer at once, and how to make sure no driver ends up with two
trips.

![Sequence of one ride request through matching. The rider app sends POST /rides t-9 to the trip service, which inserts trip t-9 with a match job in the trip and driver store and answers 201 requested. The match job reaches a matching worker through the outbox and queue. The worker gets d-17, d-42 and d-8 from the location index and ranks them by ETA as d-42, d-17, d-8. It records offer 1 to d-42 on trip t-9, claims d-42 if available, and sends offer t-9#1 with 15 seconds to answer. With no answer in 15 seconds, it releases d-42 if the driver still holds t-9#1, records offer 2 to d-17, claims d-17 if available, and sends offer t-9#2. d-17 accepts t-9#2 to the trip service, which sets d-17 on trip if offer t-9#2 is still live, sets t-9 matched if offer 2 is still current, and tells the rider app it is matched with d-17.](/diagrams/ride-sharing/match-sequence.svg)

**One driver at a time, or several at once.** The sequence shows one at a
time: the best-ranked driver gets the offer and 15 seconds to answer, and
only a decline or the timeout moves it on. The alternative is to broadcast to
the top three and give the ride to whoever accepts first.

- _One at a time_ gives the closest driver the ride, and every driver who
  accepts gets the ride they accepted. It's slow when drivers don't answer:
  with 70% acceptance, 30% of requests wait for at least one decline or
  timeout, and the 2.7% that need a fourth offer can wait up to 45 seconds
  before it is sent.
- _Broadcasting to three_ matches faster, since the first of three answers
  wins. But two of the three drivers who tap Accept are told "taken," which
  drivers learn to resent; the ride often goes to the fastest tapper rather
  than the closest car; and the three are held out of other offers while it
  plays out, or aren't held and then collide with other broadcasts.

This design offers to one driver at a time, with a 15-second timeout, even
where few drivers are available: one live offer per trip is what lets the
writes below settle every accept and timeout with a single `offer_id`. A
third option, collecting
requests for a second or two and assigning drivers to all of them together so
the total pickup time is lowest, gives better matches in a crowded area (one
driver isn't grabbed by the first request when they're the only good option
for the second), at the cost of that wait. It's a later refinement; the
conditional writes below stay the same either way.

**The double-booking race.** Two riders a block apart request at the same
moment. Two matching workers query the index, and both see driver d-42 as
available and closest. Each decides to offer d-42 a ride. If each just
recorded "d-42 is offered my trip," d-42 would get two offers, or accept one
while the other rider waits on an offer that can never succeed. It's the
check-then-act race [race conditions](/systems-and-infrastructure/race-conditions)
describes: both checked "available" before either acted.

Two ways to close it:

- _Lock the driver first._ A worker takes a lock on d-42 (a row lock, or a
  lock in a separate lock service), checks, offers, and releases. It works,
  but every claim now holds a lock for the length of a network round trip or
  more, and a lock service is one more system on the critical path.
- _Claim with a conditional write._ One statement that succeeds only if the
  driver is still available:

```sql
UPDATE drivers
SET state = 'offered', offer_id = 't-9#1',
    offer_expires = now() + interval '15 seconds', version = version + 1
WHERE driver_id = 'd-42' AND state = 'available';
```

The database runs it atomically on d-42's row, so of two concurrent claims
exactly one changes a row; the other sees zero rows updated and moves to its
next candidate. No lock is held between steps, and conflicts are rare (two
workers want the same driver in the same instant only in dense, busy areas),
so the occasional failed claim is cheap. That's the optimistic side of
[optimistic vs. pessimistic locking](/systems-and-infrastructure/optimistic-vs-pessimistic-locking),
reduced to a single statement. This design uses it.

**The offer is a lease.** A claimed driver belongs to one offer for 15
seconds and then, if nothing happens, is released. That's a **lease**: a
claim that expires on its own, so a worker that dies can't hold a driver
forever. The known hazard of a lease is that it can expire while its holder
is still alive: a worker that pauses for 20 seconds (a long garbage
collection, a slow network call) wakes up believing it still owns the offer.
The fix is the one [distributed locks](/systems-and-infrastructure/distributed-locks)
gives, a fencing token checked by the resource itself. Here the token is the
`offer_id`. Every later write about the offer names it, and the database
rejects the write if the driver's row now holds a different offer.

- **Accept**, from the driver's phone, through the trip service:
  `SET state='on_trip', trip_id='t-9' WHERE driver_id='d-17' AND
state='offered' AND offer_id='t-9#2' AND offer_expires > now()`.
- **Release** on timeout, decline or cancellation:
  `SET state='available', offer_id=NULL WHERE driver_id='d-42' AND
state='offered' AND offer_id='t-9#1'`.

Accept and release for the same offer are decided by the same row, so exactly
one of them wins. A driver who taps Accept at 15.2 seconds, after the release,
is told the offer expired. A paused worker that wakes up and tries to release
or re-offer with an old `offer_id` changes nothing. The expiry is compared
with the database's own clock (`now()` on the shard's primary), not the
worker's or the phone's, so no two machines' clocks are ever compared; the
phone's 15-second countdown is only a display.

On a single-primary relational shard, this conditional write is a local
operation on one row, about the cost of any other update. On a leaderless store
(one where several replicas each accept writes), the same compare-and-set
needs the replicas to agree first, a consensus round of several extra round
trips, which is part of why the store here is relational. Each shard's two
replicas are kept up to date with a quorum commit: the primary sends every
write to both and confirms it once either one has it. A claim confirmed just
before a failover is therefore on at least one replica, the failover promotes
a replica that has it, and a driver isn't claimed twice across it. Waiting for
one of two, not both, means a replica that fails or slows down doesn't stall
writes. That adds about one in-datacentre round trip, around half a
millisecond, to every write.

**Two rows, two shards.** A match changes two rows: the driver's and the
trip's, on different shards, with no transaction across them. The loop orders
its writes so that a crash between any two leaves something a retry can
finish. The matching worker takes a "match t-9" job from the queue and
acknowledges it only when the step is done, so a crashed worker's job is
redelivered to another worker. Each step:

1. Record the offer on the trip first: `SET attempt=2, offer_driver='d-17',
offer_id='t-9#2', tried_drivers=... WHERE trip_id='t-9' AND
state='requested' AND attempt=1`. The attempt number makes the offer ID
   deterministic, so a redelivered job can't mint a different offer for the
   same step. A crash after this write leaves the trip saying "offer 2 went to
   d-17," which the next worker reads and continues from.
2. Claim the driver with the conditional write above, which also succeeds if
   d-17's row already holds `t-9#2` (the claim happened before a crash). If
   the claim fails because d-17 is taken, the worker adds d-17 to
   `tried_drivers` and goes back to step 1 with the next candidate.
3. Send the offer through the gateway, and schedule a timeout check for 15
   seconds later as a delayed message on the match queue (many brokers can
   delay delivery; otherwise a small table of due times, polled every second,
   does it). A crash here means the offer is sent again on redelivery, and the
   phone ignores an `offer_id` it has already shown.

A redelivered job starts by reading the trip. If step 1 already happened, its
conditional write finds `attempt=2` and changes nothing, and the worker carries
on from the recorded offer rather than starting a new one. After step 3 the
worker acknowledges the job, and the loop waits for one of two things: the
timeout check, or a decline. A decline reaches the trip service, which
releases the driver with the release write below and puts a "continue t-9"
job on the match queue so the next offer goes out at once. If it dies between
those two, the timeout check continues the loop 15 seconds later instead.

When the driver accepts, the trip service writes the driver row first (the
accept above), then the trip: `SET state='matched', driver_id='d-17' WHERE
trip_id='t-9' AND state='requested' AND offer_id='t-9#2'`. A crash between the
two leaves d-17 on trip t-9 while t-9 still says `requested`. The timeout check
for `t-9#2`, which runs for every offer whatever happened, is what repairs it.
It reads both rows and moves them to agree:

- driver still `offered` with this offer: release the driver, record the
  driver as tried, and continue the loop;
- driver `on_trip` for t-9 and the trip still `requested` with this offer:
  finish the match on the trip;
- driver `on_trip` for t-9 but the trip `cancelled` (the rider cancelled
  during the offer): release the driver and tell their app;
- anything else: the offer is settled, and there's nothing to do.

Each of these is a conditional write, so a check that runs twice, or races
the trip service finishing the same match, does no harm. Worst case, a crash
leaves the two rows disagreeing for 15 seconds, and the rider waits that much
longer for "matched."

The index's `status_hint` never enters into correctness: a driver shown as
available who has just been claimed simply fails the conditional write, and
the worker moves on. That's why the hint can come from the driver's own pings,
lag by up to 4 seconds, and cost nothing to keep.

**Giving up.** If no driver accepts within a limit (say 5 offers or 2 minutes),
the trip moves to `cancelled` with reason `no_drivers`, and the rider is asked
to try again.

## Deep dive: the trip state machine

After matching, a trip moves through a fixed set of states, and each move is
started by a phone on a mobile network, which may time out, retry, or send the
same tap twice.

```text
requested   â†’ matched, cancelled
matched     â†’ arriving, in_progress, cancelled
arriving    â†’ in_progress, cancelled
in_progress â†’ completed
completed   (terminal)
cancelled   (terminal)
```

`matched` means the driver has accepted and is driving to the pickup.
`arriving` means the driver is within about 200 m of the pickup or has
tapped "I'm here," which tells the rider to come out and starts any waiting
time. `in_progress` starts when the driver taps "Start trip" with the rider
aboard, and `completed` when they tap "End trip." `matched` can go straight to
`in_progress` for a driver who never taps "I'm here." A trip in progress can't
be cancelled; one cut short ends as `completed` with the shorter route. The
terminal states never change again.

There are two ways to enforce this.

- _Read, check, write._ Load the trip, check the transition is allowed in
  application code, write the new state. Between the read and the write,
  another request can change the trip: the rider cancels while the driver
  taps Start, both read `arriving`, both pass the check, and the later write
  wins, leaving a trip that is both cancelled and started depending on which
  side you ask.
- _A conditional write per transition._ Each transition is one statement whose
  condition is the allowed source states:

```sql
UPDATE trips SET state = 'in_progress', started_at = now(), version = version + 1
WHERE trip_id = 't-9' AND driver_id = 'd-17' AND state IN ('matched', 'arriving');
```

The rider's cancel is `... WHERE state IN ('requested', 'matched',
'arriving')`. Whichever reaches the row first wins, and the other updates no
rows. This is the choice; it costs nothing extra, since each transition is
one write either way.

**Retries become no-ops.** A driver's phone that sends Start, loses the
response, and sends Start again finds its second write matching no rows,
because the trip is already `in_progress`. The trip service then reads the
row: if it is already in the requested target state with the same driver, the
retry gets `200` with the current trip, as if it had just happened; if it is
in some other state (the rider cancelled first), it gets `409 Conflict` with
that state, and the app shows it. The transition itself is the idempotency
key, because a trip can enter each state only once, so no separate key table
is needed. That doesn't extend to side effects outside the row, which is
where the outbox comes in.

**Side effects go through the outbox.** Completing a trip frees the driver,
tells the rider, and starts payment. Each of those is in another system: the
driver's row is on another shard, the rider is behind a gateway, and payments
is another service. So the completing transaction writes, alongside the trip
row, outbox events `release_driver`, `notify_rider` and `trip_completed`. The
relay delivers each at least once:

- `release_driver` becomes `SET state='available', trip_id=NULL WHERE
driver_id='d-17' AND state='on_trip' AND trip_id='t-9'`. Run twice, the
  second changes nothing; run after the driver has already taken another trip,
  its condition on `trip_id` stops it from freeing the wrong one. The trip
  service also runs this write straight away, so the driver doesn't wait for
  the relay; the outbox event is there in case that direct write is lost.
- `notify_rider` pushes a `trip_state` frame, and a push notification if the
  app is in the background. A duplicate shows the same receipt twice, which
  the app hides by trip ID and state.
- `trip_completed` goes to payments, which charges each `trip_id` once. What
  payments does with a duplicate, and how a charge survives a failed card, is
  the payments case study's problem.

A cancellation after matching writes `release_driver` and `notify_rider` the
same way (and a cancellation fee event, if the rules call for one).

## Failure modes and bottlenecks

**An index shard dies.** Its areas show no drivers until a standby takes them
over and the next round of updates fills it, 4 to 8 seconds in all. Requests
in those areas find no candidates; the matching worker waits a few seconds and
searches again before widening, so riders see a slower match, not an error.
There's no replica to keep in sync, because the data rebuilds itself faster
than a failover would run. Surge for those areas reads the log, not the index,
so it's unaffected.

**A gateway dies.** Its 100,000 phones reconnect at once. The load balancer
spreads them over the other gateways, and each app waits a random delay before
reconnecting, so the burst is spread over several seconds instead of
hitting in one; [exponential backoff](/systems-and-infrastructure/exponential-backoff)
covers the pattern. A driver's position goes stale during those seconds, and
an offer sent to a dead connection is simply not answered, so the 15-second
timeout moves on. The chat app's failure modes cover the rest of a reconnect
storm.

**A store shard fails over.** For the seconds a replica takes to become
primary, trips and drivers on that shard can't change state: new requests
hashed there fail and the app retries with the same `trip_id`, drivers there
can't be claimed (matching skips them), and taps on trips there retry. With
every confirmed write on at least one replica, and the failover promoting a
replica that has it, nothing already confirmed is lost. 16 shards means a
failover touches a sixteenth of trips and drivers, not all of them. Losing a
replica rather than the primary stops nothing: the primary keeps confirming
writes as the other replica receives them while a replacement is built.

**The routing service is slow.** Matching can't rank by driving time. A
[circuit breaker](/systems-and-infrastructure/circuit-breaker) on routing calls
stops waiting on it after a run of timeouts, and matching falls back to
straight-line distance, which picks a worse driver sometimes (the river) but
keeps matching. Quotes fall back to a distance-based price estimate on the
same terms.

**A crowd in one cell.** A stadium empties and 20,000 requests arrive in a few
resolution-8 cells within ten minutes, against a few hundred drivers. Matching
workers for neighbouring requests keep picking the same closest drivers, and
many claims fail; each failure only costs a retry, but the lost time adds up.
Surge raises the price within a minute, which trims demand and draws drivers
in, and batched assignment is the tool for exactly this case when it's built.
The single index shard for that area sees more searches but not more updates,
since the drivers were already reporting.

**Phones that lie or glitch.** GPS in a city of tall buildings can jump
hundreds of metres. The location service drops an update that implies an
impossible speed (say over 200 km/h since the last one) and lets the next one
confirm the move. Deliberate spoofing is a fraud problem and out of scope.

**Knowing any of this is happening.** The signals worth watching are update
lag (time from the phone's reading to the index), the share of index entries
older than 6 seconds, request-to-first-offer time at p99, the claim failure
rate, offer acceptance rate by area, match queue depth, store write latency
per shard, and rider-visible position lag. A rising claim failure rate in one
area is usually the first sign of a crowd.
[Observability](/systems-and-infrastructure/observability) covers how metrics,
logs and traces split that work.

## Trade-offs

Latest positions live only in memory. That saves around 150 database shards'
worth of durable writes and makes an index shard failure a few seconds of
blindness in one region, in exchange for accepting that a crash loses
positions. It works only because every driver repeats themselves every 4
seconds; data that isn't resent (a trip's state) gets a durable store.

The hexagonal grid beats geohash on search shape and cell size consistency,
and beats a quadtree on handling constant movement. It costs a library
dependency and hexagons that don't nest exactly, which matters little when the
coarse cells are only used for surge.

- **Splitting the index by area over by driver.** A search usually hits one
  shard, but busy cities need their own shards and an assignment table, and
  drivers crossing area edges move between shards.
- **Offering one driver at a time.** Riders wait longer when drivers decline
  or ignore offers, up to 15 seconds per failed offer, but the closest driver
  gets first refusal and no driver accepts a ride they then lose.
- **Conditional writes over locks.** No lock is held across a network call,
  and a failed claim costs one retry. The price is that every transition must
  be written as a compare-and-set against named states and an `offer_id`, and
  that the store must be one where a compare-and-set is cheap, which rules out
  leaderless stores for this data.
- **Two rows on two shards without a transaction.** Trips and drivers scale
  independently, but a crash between the two writes of a match leaves them
  disagreeing until the offer's timeout check repairs it, up to 15 seconds.
- **Batched surge.** Stable, cheap prices at the cost of a price that lags a
  sudden crowd by about a minute.

What would change the design: pooled rides would turn matching from "one
driver per request" into fitting several requests into one car's route, which
makes batched assignment the default rather than a refinement. And if drivers
reported every second instead of every 4 seconds, the location path (index
shards, log, gateways) would grow fourfold while nothing on the trip path
changed, which is the point of keeping the two apart.
