---
title: Design a Ride-Sharing Service (like Uber)
summary: Driver locations kept only in memory, offers made to one driver at a time with a conditional write, and positions pushed to riders over WebSockets, for 750,000 location updates a second at peak.
date: 2026-10-05
order: 8
---

You're asked to design a ride-sharing service like Uber. Rita taps "Request ride", and a couple of seconds later a driver's phone buzzes with her pickup. Two very different jobs sit behind that tap. One is a firehose: every online driver's phone reports a position every few seconds, and each report is stale by the next. The other is small and strict: Rita's request must end with one driver, and a driver with one ride, even when another rider a block away wants the same car in the same second.

In short: latest positions live in memory, each ride is offered to one driver at a time and claimed with a write that succeeds only if he is still free, and positions are pushed to the rider over a connection that stays open. This page starts with the obvious single-database design and shows where it breaks, then follows a ride through the design that replaces it and sizes its parts. It walks one offer through its states, one step at a time, and makes three decisions: where positions live, how a driver is offered a ride, and how Rita sees the car move.

## Requirements

- Online drivers report their position every 4 seconds, up to 3 million at once.
- A rider gets a quote (a price and a pickup time), then requests a ride, offered to nearby drivers one after another until one accepts. 25 million requests a day. Either side can cancel before the trip starts.
- The first offer reaches a driver's phone within 2 seconds at p99 (99% of requests are faster), using positions at most 5 seconds old.
- The rider sees the car move within 2 seconds of each update (p99).
- A driver holds at most one trip and a request gets at most one driver; trips are 99.99% available.

Out of scope: payments, maps, pooling, fraud and the routing service's internals.

## Start simple

The obvious design is one database. A **drivers table** has a row per driver: a position, and whether the driver is free. Each position report, called a **ping**, overwrites that driver's row. When Rita requests a ride, a server reads every row, keeps the free drivers near her pickup, picks the closest and marks that row busy.

For a city of 1,000 drivers and 10,000 rides a day, that's fine. Peak traffic is ten times the average ([numbers every engineer should know](/engineering-practices/numbers-every-engineer-should-know)):

```text
average:
  10,000 ÷ 86,400 s ≈ 0.12 a second
peak:
  0.12 × 10 = 1.2 a second
rows checked at peak:
  1.2 × 1,000 = 1,200 a second
```

Now use this service's numbers, and assume one server checks 10 million rows a second:

```text
average:
  25,000,000 ÷ 86,400 s ≈ 289 a second
peak:
  289 × 10 ≈ 2,900 a second
rows checked at peak:
  2,900 × 3,000,000 = 8,700,000,000 a second
servers:
  8,700,000,000 ÷ 10,000,000 = 870
```

That's 870 servers just to find nearby cars. So look drivers up by area: a **geospatial index** keeps drivers sorted by place, and "who is near?" reads only the few areas around the pickup. Reads get cheap, but now every ping from every moving driver rewrites the index too.

## High-level architecture

![Architecture of the ride-sharing service. Rider and driver apps keep long-lived connections (WebSockets) to the connection gateways, servers that each hold many phones' connections, and send HTTPS requests to the trip service. Gateways pass driver pings to the location service, which writes the latest position into the in-memory location index, appends every ping to the event log, a queue of records, and sends on-trip positions back through the gateways to riders. The trip service tells the location service which rider follows which driver, logs ride requests to the event log, receives accepts and declines from the gateways, sends trip updates through the gateways, writes to the trip and driver store, sends match jobs to the matching workers, and asks the routing service for pickup times. Matching workers ask the location index who is near, get driving times from the routing service, claim (reserve) drivers in the store, and send offers through the gateways.](/diagrams/ride-sharing/architecture.svg)

Follow Dev, a driver. His phone holds a **WebSocket** open, a long-lived two-way connection, to a **gateway**, a server that holds many such connections. Each ping goes through the gateway to the location service, which keeps only Dev's latest position, in memory.

Now Rita's request. It reaches the trip service, which inserts her trip and, in the same all-or-nothing write, a match job in an [outbox](/systems-and-infrastructure/outbox-pattern), so a crash between them loses neither. A matching worker takes the job, asks the **location index**, an in-memory map from each area of the city to the drivers in it, who is near, ranks the candidates by the routing service's driving times, claims one driver (reserves him, so no other worker can offer him a ride) and sends him an offer through a gateway.

When Dev accepts, the trip service updates the trip and driver rows in the store and tells the location service that Rita follows Dev, which then sends his positions through her gateway. Beside this path, the location service and the trip service append every ping and ride request to the **event log**, a [message queue](/systems-and-infrastructure/message-queues) that holds history for jobs that run later, such as surge pricing. Those appends aren't made atomic with the other writes, because the jobs that read the log tolerate a gap; a missed one only thins that history.

Next, how big each part has to be.

## Key numbers

These size the location index's nodes, the matching workers' load, the gateways' connections and the trip and driver store's shards. Peak request rates are ten times the average.

- **Location index:** 600 MB of entries in 12 **shards**, slices of the data that each live on their own server ([partitioning vs. sharding](/systems-and-infrastructure/partitioning-vs-sharding)), because the writes are the problem. 3,000,000 drivers × 200 bytes = 600 MB, which one node holds. Pings arrive at 3,000,000 ÷ 4 s = 750,000 a second. At an assumed 100,000 updates a second per node, 750,000 ÷ 100,000 = 7.5, so 8 nodes, and half again for uneven busy areas gives 8 × 1.5 = 12.
- **Matching workers:** about 2,900 requests and 4,100 offers a second at peak. 25,000,000 ÷ 86,400 ≈ 289 requests a second on average, × 10 ≈ 2,900. At an assumed 70% acceptance, a ride needs 1 ÷ 0.7 ≈ 1.43 offers, and 2,900 × 1.43 ≈ 4,100.
- **Gateways:** 4.3 million WebSockets, about 60 servers. Riders on a trip: 25,000,000 × 25 minutes ÷ 1,440 minutes a day ≈ 434,000 on average, × 3 for the busiest hour ≈ 1,300,000 (the 10× peak lasts seconds). Add the 3,000,000 drivers for 4,300,000. At an assumed limit of 100,000 a server, run at 70% for headroom: 4,300,000 ÷ 70,000 ≈ 61. Each of the 1,300,000 riders gets a position every 4 seconds, 325,000 pushes a second.
- **Trip and driver store:** about 58,000 writes a second, in 16 shards. At an assumed 10 row writes a ride, 2,900 × 10 = 29,000 a second, and outbox rows double it to 58,000. At an assumed 5,000 writes a second per primary (the server that takes a shard's writes), 58,000 ÷ 5,000 ≈ 12, and a third more for headroom is 12 × 4 ÷ 3 = 16.

The store's rows carry the strict half of the problem, so they come next.

## API and data model

```text
driver, over its WebSocket:
  -> location { lat, lng, device_time, session, seq }
  <- offer    { offer_id: "t-9#1", pickup, expires_in_s: 15 }
  -> accept   { offer_id }   or   decline { offer_id }

POST /v1/quotes  { pickup, dropoff }  -> { quote: <signed>, price, pickup_eta_s }
POST /v1/rides   { trip_id: "t-9", quote }  -> 201 { trip_id, state: "requested" }
POST /v1/rides/{id}/cancel
```

```text
trips    (sharded by trip_id)    trip_id, rider_id, state, quote, offer_id, driver_id
drivers  (sharded by driver_id)  driver_id, state, offer_id, offer_expires, trip_id
  trip state:   requested -> matched -> arriving -> in_progress -> completed (or cancelled)
```

The quote is **signed** with a key only the trip service holds, so it can check the price later without storing it. The app invents `trip_id` and reuses it on a retry, an [idempotency key](/systems-and-infrastructure/idempotency): a timeout can't book two trips.

A trip and its driver usually sit on different shards, so every write that matters is a **conditional write** ([optimistic locking](/systems-and-infrastructure/optimistic-vs-pessimistic-locking)) on one row: "change this only if it still says what I expect."

Both rows are small state machines, so look at the states before the steps. A trip is `requested` (no driver yet), `matched` (a driver accepted), `arriving` (the driver is heading to the pickup), `in_progress` (Rita is in the car) and `completed`. It becomes `cancelled` if either side cancels before `in_progress`. A driver's row is in one of four states:

| Driver state | Means                                | Row also holds              |
| ------------ | ------------------------------------ | --------------------------- |
| `offline`    | not taking rides                     | nothing                     |
| `available`  | online and free                      | nothing                     |
| `offered`    | holding one offer, waiting for a tap | `offer_id`, `offer_expires` |
| `on_trip`    | accepted a ride                      | `trip_id`                   |

Now one offer, step by step. Rita's trip `t-9` is `requested`, and Dev is `available`.

1. **Claim.** A worker picks Dev as the closest candidate and writes his row only if it still says `available`, setting `offered`, `offer_id` `t-9#1` and `offer_expires` 15 seconds out. If another worker claimed Dev a moment earlier, the condition fails and this worker tries its next candidate. The worker also writes `t-9#1` on Rita's trip row.
2. **Offer.** A gateway pushes the offer to Dev's phone. He can accept, decline or ignore it.
3. **Decline or expiry.** A decline, or 15 seconds of silence, sets Dev back to `available` if his row still holds `t-9#1`. The worker then offers `t-9#2` to its next candidate. Expiry needs no timer: any write compares `offer_expires` with the clock. Before offering `t-9#2`, the worker reads Dev's row: if it already says `on_trip` for `t-9`, an accept got through, so the worker finishes the trip write instead.
4. **Accept.** The trip service writes Dev's row to `on_trip`, with `trip_id` `t-9`, only if it is `offered`, holds `t-9#1` and hasn't expired. A tap after 15 seconds, or after the offer moved on, fails here: a late tap loses. Next it writes Rita's trip to `matched`, with Dev's id, only if it is still `requested` and still names `t-9#1`. If this write fails because Rita cancelled or the trip moved on to another offer, the accept releases its own driver: Dev goes back to `available` if his row still says `on_trip` for `t-9`. If it fails because the trip is already `matched` to Dev, the worker finished it, and nothing more is done.

So a row changes only if it is still in the state the writer saw. The trip and driver rows are on different shards, so a crash between steps can leave them disagreeing; the follow-ups cover how they are brought back in line.

## Decision: latest positions only, in memory

The simpler option is where Start simple ended: keep the drivers table, add the geospatial index, and store every ping durably. Run the writes:

```text
pings at peak:
  3,000,000 ÷ 4 s = 750,000 a second
shards, at 5,000 durable writes each:
  750,000 ÷ 5,000 = 150
```

That's 150 shards to store positions that are wrong within seconds. So the location index holds only the latest position per driver, in memory. A ping overwrites the driver's entry in a map from each hexagonal grid cell to its drivers, and "who is near?" reads the pickup's cell and the ring around it. History goes to the event log in batched appends, kept three days, which cost far less per update than a durable row.

The price: a node that dies takes its entries with it, and the index and log writes can disagree. Neither matters, because the next ping, 4 seconds later, replaces a lost entry, and nothing needs the two copies to match.

**Rule of thumb.** Data that goes stale in seconds belongs in memory, with a cheap log for history.

## Decision: one offer at a time, claimed with a conditional write

The simpler option is to offer Rita's ride to the three closest drivers at once and give it to the first to accept. Count the offers at peak:

```text
one at a time:
  2,900 × 1.43 ≈ 4,100 a second
three at once:
  2,900 × 3 = 8,700 a second
```

That's about twice the offers. Two drivers who both tap are told "taken", and the quickest tapper beats the closest car. The 2-second requirement covers only the first offer, which one at a time doesn't delay.

So offer to one driver at a time, and claim him first with the conditional write from the steps above. Two workers after Dev both try, and one wins. A check followed by a write couldn't do this, because both workers could read `available` before either writes. The price is time:

```text
chance a driver declines or lets it expire:
  1 − 0.7 = 0.3
chance the first two offers both fail:
  0.3 × 0.3 = 0.09
```

About 9% of rides need three or more offers, each up to 15 seconds.

**Rule of thumb.** When a resource can be given to one party only, let a conditional write on its row decide, not a check followed by a write.

## Decision: push positions over WebSockets

The simpler option is for Rita's app to poll, asking the server for the car's position again and again. To see the car within 2 seconds at p99, she must ask about every second:

```text
polls at the busiest hour:
  1,300,000 riders × 1 a second = 1,300,000 a second
polls with nothing new (Dev reports every 4 s):
  3 of every 4
```

That's 1.3 million requests a second, three in four returning nothing.

Offers need a push anyway, so every online driver already holds a WebSocket. Each rider on a trip gets one too for the car's positions: 325,000 frames a second at peak ([WebSockets vs. SSE vs. long polling](/systems-and-infrastructure/websockets-vs-sse-vs-long-polling)). The gateways work as in the [chat app](/system-design/messaging). The price is more stateful servers, which remember which phone is attached: 1,300,000 ÷ 70,000 ≈ 19 more gateways.

**Rule of thumb.** When the server learns something first and delay matters, push it; polling spends requests on answers that haven't changed.

## Likely follow-ups

- **What if the rider cancels while an offer is out?** Cancel is a conditional write on the trip row, allowed before the trip starts. The same transaction puts a release in the outbox, which frees the driver only if still offered or on that trip.
- **What if a crash lands between the trip and driver rows?** Say Dev's row reached `on_trip` but the trip is still `requested`. The worker waiting on the offer reads Dev's row first; seeing `on_trip` for `t-9`, it finishes the trip write instead of offering `t-9#2`. If the crash came before Dev's row changed, the offer simply expires after 15 seconds.
- **What if an index shard dies?** Its areas show no drivers until a standby takes over and fresh pings fill it, a few seconds.
- **How would you add surge pricing?** That's a higher price where requests outnumber available drivers. A job on the event log, which carries ride requests and pings, turns each area's requests per available driver into a capped multiplier every minute; the signed quote locks it in.
