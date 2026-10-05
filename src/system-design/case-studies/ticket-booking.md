---
title: Design a Ticket Booking System (like Ticketmaster)
summary: Selling 50,000 seats to two million fans in one minute, with a waiting room that meters entry, conditional seat writes, and a payment step that survives retries and crashes.
date: 2026-10-05
order: 10
template: 2
---

You're asked to design a service like Ticketmaster. A fan picks seats and has ten minutes to pay. The hard part is the **on-sale**, the moment a popular event
opens: 50,000 seats at 10:00 and two million people waiting, all wanting the same few thousand seats. The interview is about
contention: who gets to write a seat, and what everyone else sees meanwhile.

## Requirements

- Hold up to 8 seats per account for 10 minutes; unpaid holds go back on sale.
- Never sell a seat twice. A charged user gets tickets or, rarely, a refund.
- The largest on-sale: 50,000 seats, 2 million people in the first minute, up
  to 5 such on-sales at once.
- A waiting room admits people at a controlled rate: early arrivals in random
  order, later ones in arrival order, one place per account.
- A hold answers in under 500 ms at p99 (99% of requests are faster) once
  admitted. The seat map may be up to 10 seconds stale.

Out of scope: resale, pricing, and the payment service itself, which honors an
idempotency key and can void one that has no charge yet.

## Key numbers

These size the front door, the shoppers admitted, the database taking holds
and the seat map. Assume 2.5 tickets an order, two hold attempts per order (a
seat is often just gone), 60% of admitted shoppers buying, admission at 250 a second, and 100,000 events of 2,000 seats at 100 bytes a row:

- **Front door:** 2,000,000 ÷ 60 s ≈ 33,000 arrivals a second. "Is it my turn?"
  every 20 seconds adds 100,000 status checks a second, all with one answer.
- **Shoppers admitted:** 50,000 seats ÷ 2.5 = 20,000 orders; ÷ 0.6 ≈ 33,000
  shoppers, or 133 seconds at 250 a second.
- **Database:** 250 admitted × 2 attempts ≈ 500 holds a second on one event's
  shard. All inventory is 100,000 events × 2,000 seats × 100 bytes = 20 GB.
- **Seat map:** 50,000 seats ÷ 8 bits ≈ 6 KB, rebuilt once a second.

The waiting room turns 33,000 requests a second into 500.

## High-level architecture

![Architecture of the ticket booking system. The browser sends layout, availability and queue status requests to a CDN, join and admit requests to a waiting room, and holds and confirms to an API gateway that checks admission tokens and rate limits. The CDN fetches availability from the seat map service on a miss, with a 1 s TTL, and queue status from the waiting room on a miss. The gateway passes requests to the booking service, which makes conditional writes to the inventory DB (sharded by event, with primary, standby and replicas), charges the payment service with the hold ID as key, and reports load and seats left to the waiting room. The seat map service makes a replica read of the DB once a second per event. The hold sweeper releases expired holds in the DB and asks the payment service about the status of stuck payments. The DB sends outbox rows to an outbox relay, which sends them to an order events queue for tickets and email.](/diagrams/ticket-booking/architecture.svg)

Follow Priya, who wants seats 114-K-11 and 114-K-12. At 09:50 she joins the
waiting room. The layout, the availability **bitmap**
(one bit per seat) and the waiting-room status come from a **CDN**, caching
servers near users ([caching](/systems-and-infrastructure/caching)), which asks the seat map service or the waiting room only on a miss. When her turn comes she gets an admission token. Her hold goes through the API
gateway, which checks it, to the booking service, which writes to the event's
shard of the inventory database. She pays; the booking service charges the
payment service and records the order plus an **outbox** row, a to-do note
saved in the same transaction
([outbox pattern](/systems-and-infrastructure/outbox-pattern)). The relay
publishes it so tickets and email
([notifications](/system-design/notification-system)) follow.

## API and data model

```http
GET  /events/ev_8812/availability            -> bitmap, cached 1 s
POST /events/ev_8812/holds   Idempotency-Key: 3f1c...
     { "seat_ids": ["114-K-11", "114-K-12"] }
     -> 201 { "hold_id": "h_51c0", "expires_at": "..." }, 409 if a seat is taken, 422 over 8 tickets
POST /holds/h_51c0/confirm   { "payment_method": "pm_..." }
     -> 200 order, 402 declined, 409 hold expired, 202 payment result not known yet
```

```text
seats    (event_id, seat_id) primary key, status available|held|sold,
         hold_id, held_until
holds    hold_id, event_id, account_id, client_key (unique per account),
         status active|paying|confirmed|expired, expires_at, pay_deadline
orders   order_id, hold_id (unique), amount, payment_ref
```

An event's rows share one **shard**, a database holding a slice of the events,
so a hold never spans two
([sharding](/systems-and-infrastructure/partitioning-vs-sharding)). Eight shards are for isolation, not size: each on-sale gets its own. `client_key` makes a retried hold return the first one
([idempotency](/systems-and-infrastructure/idempotency)), and the unique
`hold_id` on orders rejects a second order for one hold.

## Decision: a waiting room in front

Each visitor gets a numbered place in a signed token and waits to be called,
sending no booking requests. The room slows admission when the booking service
reports rising p99 hold latency
([backpressure](/systems-and-infrastructure/backpressure)). Early arrivals get
random places, so 09:59:59 is no worse than 09:40.

Why not a [rate limit](/system-design/rate-limiter) of 500 holds a second,
answering the rest `429`? But a rejected
request carries no memory, so the limiter still absorbs 33,000 retries a
second, and whoever retries hardest wins; bots retry better than people. The
waiting room costs a visible wait and a component that must be up.

**Rule of thumb.** When demand far exceeds supply, queue people by a rule you
chose instead of rejecting requests and letting retries decide.

## Decision: conditional updates on seat rows

Two shoppers click 114-K-12 together. One transaction per hold updates
each seat in seat-ID order, only where it is `available` or its old hold has
lapsed (`held_until < now()`). If any seat changes no row, the transaction
rolls back and answers `409`. At PostgreSQL's default isolation level the
second writer waits for the first's commit, re-checks, finds `held` and
changes nothing, so the loser learns in milliseconds. A click on a stale map is safe because the hold is the check.

Why not lock the rows with `SELECT ... FOR UPDATE`
([pessimistic locking](/systems-and-infrastructure/optimistic-vs-pessimistic-locking))?
That is correct and fast enough at 500 holds a second. It loses on lock time: read, decide and write are separate round trips, so a stalled server keeps seats locked until a timeout. The conditional update holds locks for a few quick statements and the commit, never while application code decides.

**Rule of thumb.** Put the check inside the write, so there's no gap for a [race](/systems-and-infrastructure/race-conditions) and no lock waits on application code.

## Decision: pay through a `paying` state

A hold is a **lease**, a claim that lapses at a set time, and a sweeper every
5 seconds releases lapsed ones so the seats reappear on the map. Priya's hold
lapses at 10:12:40 and her charge starts at 10:12:38. Charging takes seconds,
so the sweeper could resell her seats mid-charge. Confirm first moves the
hold `active` to `paying`, only if still active and unexpired, with a
three-minute `pay_deadline` the sweeper respects. It then charges with the hold
ID as the idempotency key, so a retry charges once, and one transaction marks
the hold `confirmed` and the seats `sold` and writes the order and outbox row.

Why not charge without the state, and refund if the seats were resold? Then
two people can pay for one seat, and refunds cost fees and trust. Our cost: a
slow payment ties up seats for three minutes, and if the payment service still hasn't answered by then, the sweeper releases them and refunds if the charge
landed.

**Rule of thumb.** Move a lease into a state its reaper leaves alone before
doing something slow and irreversible.

## Likely follow-ups

- **How do you handle a general-admission floor?** Its tickets are one counter,
  and a row takes about 500 changes a second (1 ÷ a 2 ms commit that waits for the standby), which is all
  500 holds a second. Split it into 10 buckets, about 50 each.
- **What if the booking server crashes mid-payment?** The hold stays `paying`.
  A retried confirm repeats the charge with the same key. Otherwise the sweeper
  asks the payment service to void the key, which works only if no charge
  exists, and finishes the confirm if one does.
- **When would you use one writer per event?** When one event needs thousands of holds a second; it costs routing, log replay and [fencing](/systems-and-infrastructure/distributed-locks).
- **What if the primary fails mid-sale?** The standby, in another availability zone, is written synchronously, so it has every committed write. Holds fail with `503` while it is promoted.
