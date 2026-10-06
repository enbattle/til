---
title: Design a Ride-Sharing Service (like Uber)
summary: Driver locations kept only in memory, offers made to one driver at a time with a conditional write, and positions pushed to riders over WebSockets, for 750,000 location updates a second at peak.
date: 2026-10-05
order: 8
template: 2
---

You're asked to design a service like Uber. A rider taps "Request ride" and two workloads sit behind that tap. One is a firehose:
every online driver's phone reports a position every few seconds, and each
report is stale by the next. The other is small and strict: a request must end
with one driver and a driver with one ride, even when two riders a block apart
want the same car in the same second.

## Requirements

- Online drivers report their position every 4 seconds, up to 3 million at once.
- A rider gets a quote, then requests a ride, offered to nearby drivers one
  after another until one accepts. 25 million requests a day.
- The first offer reaches a driver's phone within 2 seconds at p99 (99% of
  requests are faster), using positions at most 5 seconds old.
- The rider sees the car move within 2 seconds of each update (p99). Either
  side can cancel before the trip starts.
- A driver never holds two trips and a request never gets two drivers; trips
  are 99.99% available.

Out of scope: payments, maps, pooling, fraud and the routing service's internals.

## Key numbers

These size the location path, the matching work, the connections and the trip
store; request rates peak at ten times their average
([numbers every engineer should know](/engineering-practices/numbers-every-engineer-should-know)):

- **Location updates: 750,000 a second at peak.** 3 million drivers ÷ 4
  seconds.
- **Location index: 600 MB, 12 shards.** 3 million × 200 bytes is 600 MB, which one node holds;
  the writes are the problem. At an assumed 100,000 updates a second per node with
  headroom, 750,000 needs 8, plus room for uneven areas.
- **Matching: about 2,900 requests and 4,100 offers a second at peak.** 25
  million ÷ 86,400 ≈ 289, × 10; at an assumed 70% acceptance, 1.43 offers a
  ride.
- **Connections: 4.3 million WebSockets, about 45 gateways.** 3 million
  drivers plus 1.3 million riders on trips (25 million × 25 minutes ÷ 1,440 ≈
  434,000, tripled for the busiest hour; the 10× peak lasts seconds), at an assumed 100,000 a server with
  headroom. Riders get **325,000 position pushes a second** (1.3 million ÷ 4).
- **Trip and driver store: about 58,000 writes a second, 16 shards.** About 10
  row writes a ride give 29,000; outbox rows double it. At an assumed 5,000 a primary, that is 12, plus headroom.

## High-level architecture

![Architecture of the ride-sharing service. Rider and driver apps reach a load balancer, which sends WebSockets to the connection gateways and HTTPS to the trip service. Gateways pass driver pings to the location service, which writes the latest position into the in-memory location index, appends every ping to the event log, and sends on-trip positions back through the gateways to riders. The trip service tells the location service which rider follows which driver and logs ride requests to the event log. The surge and archive jobs read the event log and give surge multipliers to the trip service. The trip service receives accepts and declines from the gateways, makes conditional writes to the trip and driver store, sends match jobs to the matching workers, sends trip updates through the gateways, and asks the routing service for quote ETAs. Matching workers ask the location index who is near, get ETAs from the routing service, claim drivers in the store, and send offers through the gateways.](/diagrams/ride-sharing/architecture.svg)

Phones hold WebSockets, long-lived two-way connections, to the **connection
gateways**; the **load balancer** sends HTTPS to the **trip service**. A
driver's pings go through a gateway to the **location service**,
which overwrites the driver's entry in the **location index** and appends the
ping to the **event log**, a
[message queue](/systems-and-infrastructure/message-queues) the surge and
archive jobs read. A rider's request reaches the trip service, which inserts
the trip and, in the same transaction, a match job in an
[outbox](/systems-and-infrastructure/outbox-pattern), so a crash between them
loses neither. **Matching workers** take the job, ask the index who is near,
rank candidates by the routing service's driving times, and offer the ride
through a gateway. On accept, the trip service tells the location service which rider follows which driver, and it sends that driver's positions to the rider's gateway.

## API and data model

```text
driver, over its WebSocket:
  -> location { lat, lng, device_time, session, seq }
  <- offer    { offer_id: "t-9#2", pickup, expires_in_s: 15 }
  -> accept   { offer_id }   or   decline { offer_id }

POST /v1/quotes  { pickup, dropoff }  -> { quote: <signed>, price, pickup_eta_s }
POST /v1/rides   { trip_id: "t-9", quote }  -> 201 { trip_id, state: "requested" }
POST /v1/rides/{id}/cancel
```

```text
trips    (sharded by trip_id)    trip_id, rider_id, state, quote, offer_id, driver_id
drivers  (sharded by driver_id)  driver_id, state, offer_id, offer_expires, trip_id
  trip state:   requested -> matched -> arriving -> in_progress -> completed (or cancelled)
  driver state: offline | available | offered | on_trip
```

The quote is **signed** with a key only the trip service holds, so it can
check the price later without storing it. The app invents `trip_id` and reuses
it on a retry, an
[idempotency key](/systems-and-infrastructure/idempotency): a timeout can't
book two trips. A trip and its driver usually sit on different
[shards](/systems-and-infrastructure/partitioning-vs-sharding), so every
write that matters is a **conditional write** ([optimistic locking](/systems-and-infrastructure/optimistic-vs-pessimistic-locking)) on one row, "change this only if
it still says what I expect".

## Decision: latest positions only, in memory

A ping overwrites the driver's entry in the index, which maps each hexagonal
grid cell to its drivers. "Who is near?" reads the pickup's cell and the ring around it. A lost ping is
replaced 4 seconds later, and history lives in the event log, kept three days.

Why not write every ping to a database with a geospatial index? Here 750,000 durable writes a second at 5,000 per primary means
150 shards, to store positions that are wrong within seconds. The log's
batched appends cost far less per update.

**Rule of thumb.** Data that goes stale in seconds belongs in memory, with a
cheap log for history.

## Decision: one offer at a time, claimed with a conditional write

The worker claims the closest candidate with a conditional write that turns
the driver's row from `available` to `offered`, with an `offer_id` and an
expiry 15 seconds out. Two workers after the same driver both try; one matches
the row and the other moves to its next candidate. On accept, the driver row must still hold this `offer_id`, unexpired, so a late tap loses. Then the trip row moves `requested` to `matched` (unless a cancel got there first) and the driver row to `on_trip`. A decline or expiry frees the driver and the worker
tries the next.

Why not offer to the three closest at once? The requirement covers only the first offer, which one at a time doesn't delay.
Two drivers who accept are told "taken", and the quickest tapper beats the
closest car. The price: about 9% of rides (0.3²) need three or more offers, each up to 15 seconds.

**Rule of thumb.** When a resource can be given to one party only, let a
conditional write on its row decide, not a check followed by a write.

## Decision: push positions over WebSockets

Offers need a push anyway, so every online driver already holds a WebSocket,
and each rider on a trip gets one for the car's positions: 325,000 frames a
second at peak
([WebSockets vs. SSE vs. long polling](/systems-and-infrastructure/websockets-vs-sse-vs-long-polling)).
The gateways work as in the [chat app](/system-design/messaging).

Why not have riders poll? To see the car within 2 seconds at p99 a rider must
poll about every second: 1.3 million requests a second, three in four
returning nothing new. Rider sockets cost about 13 more stateful servers (1.3 million ÷ 100,000).

**Rule of thumb.** When the server learns something first and delay matters,
push it; polling spends requests on answers that haven't changed.

## Likely follow-ups

- **What if the rider cancels while an offer is out?** Cancel is a conditional
  write on the trip row, allowed before the trip starts. The same transaction
  puts a release in the outbox, which frees the driver only if still offered
  or on that trip.
- **What if a crash lands between the trip and driver rows?** The offer's
  expiry check reads both and makes them agree within 15 seconds.
- **What if an index shard dies?** Its areas show no drivers until a standby
  takes over and fresh pings fill it, a few seconds.
- **How would you add surge pricing?** A job on the event log, which carries ride requests and pings, turns each area's requests per available driver into a capped multiplier every minute;
  the signed quote locks it in.
