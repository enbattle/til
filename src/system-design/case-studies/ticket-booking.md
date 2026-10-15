---
title: Design a Ticket Booking System (like Ticketmaster)
summary: Selling 50,000 seats to two million fans in one minute, with a waiting room that meters entry, conditional seat writes, and a payment step that survives retries and crashes.
date: 2026-10-05
order: 10
template: 3
---

You're asked to design a service like Ticketmaster. A fan picks seats for a concert and has ten minutes to pay for them. The hard part is the **on-sale**, the moment a popular event opens: 50,000 seats at 10:00 and two million people waiting, all wanting the same few thousand seats.

The interview is about **contention**, many people wanting the same seat: who gets to write it, and what everyone else sees meanwhile. The design lets fans in at a controlled rate, and each seat goes to whichever write reaches it first. This page starts with the obvious design and shows where it breaks, follows one fan through the replacement, sizes its parts, and makes three decisions: how the crowd is admitted, how a seat is claimed, and how a payment keeps its seats while the card is charged.

## Requirements

- Fans **hold** up to 8 seats per account for 10 minutes, taking them off sale for everyone else; unpaid holds go back on sale.
- Never sell a seat twice. A charged user gets tickets or, rarely, a refund.
- The largest on-sale: 50,000 seats, 2 million people in the first minute, up to 5 such on-sales at once.
- A **waiting room**, a queue fans join before they may book, admits people at a controlled rate: early arrivals in random order, later ones in arrival order, one place per account.
- A hold answers in under 500 ms at p99 (99% of requests are faster) once admitted. The **seat map**, the picture of which seats are free, may be up to 10 seconds stale.

Out of scope: resale, pricing and the payment service itself, an outside service that charges cards.

## Start simple

The obvious design has every fan talk straight to a **booking service**, a program that checks seats and takes payment. It sits in front of one database with a row for each seat.

A fan opens the event, sees which seats are free and picks two, and the service marks them held. A **sweeper**, a job that wakes every 5 seconds, puts seats back on sale when their 10 minutes lapse. Paying marks the seats sold.

For a small event that's fine. Say 2,000 fans arrive in the first minute, each makes one hold attempt on arrival, and one database server handles about 2,000 holds a second:

```text
arrivals a second:
  2,000 ÷ 60 s ≈ 33 a second
share of one server:
  33 ÷ 2,000 ≈ 2%
```

Now run the same steps on the big on-sale of 2 million fans:

```text
arrivals a second:
  2,000,000 ÷ 60 s ≈ 33,000 a second
against one server:
  33,000 ÷ 2,000 ≈ 17 times too much
```

The database is 17 times over, and the overload feeds itself: a fan whose request fails or times out simply tries again, so the retries add to the load. Even at a pace the database could take, two fans would still reach for the same seat.

So the crowd has to be metered before it reaches the database, and two fans reaching for one seat must not both win.

## High-level architecture

![Architecture of the ticket booking system. The browser sends layout, availability and queue status requests to a CDN that caches near users, join and admission token requests to a waiting room, and holds and confirms to an API gateway that checks the admission token and rate limits. The CDN fetches availability from the seat map service on a miss, cached for 1 s, and queue status from the waiting room on a miss. The gateway passes requests to the booking service, which claims seats in the inventory database, one slice per event, charges the payment service with the hold ID as the key, and reports load and seats left to the waiting room. The seat map service reads a copy of the database once a second per event. The hold sweeper releases expired holds in the database and asks the payment service about the status of stuck payments. The database sends outbox rows to an outbox relay, which sends them to an order events queue for tickets and email.](/diagrams/ticket-booking/architecture.svg)

Follow Priya, who wants seats 114-K-11 and 114-K-12. At 09:50 she joins the waiting room and gets a numbered place. While she waits, her browser keeps asking for the seating layout, the seat map and the waiting room's "now serving" number. A **CDN**, caching servers near users ([caching](/systems-and-infrastructure/caching)), answers all three and goes to the waiting room or the seat map service only on a miss, when it has no fresh copy. Once a second per event, the seat map service reads a copy of the database ([read replicas](/systems-and-infrastructure/read-replicas)).

When her turn comes, the waiting room gives her an **admission token**, a signed pass. Her hold request goes through the API gateway, a [reverse proxy](/systems-and-infrastructure/forward-vs-reverse-proxy) that checks the token and applies rate limits, to the booking service. The booking service tries to claim her two seats in the event's part of the inventory database (the second decision), and tells the waiting room its load and how many seats are left, so the room can slow admission. The sweeper from "Start simple" releases holds that lapse. She pays, and the booking service charges the payment service, labelling the charge with the hold ID so a retry charges once. The third decision covers what the charge does to the hold.

Then one transaction marks the order and saves an **outbox** row in the database, a to-do note stored beside the data ([outbox pattern](/systems-and-infrastructure/outbox-pattern)). A **relay**, a small process that forwards stored notes, publishes it to the order events queue, so tickets and email ([notifications](/system-design/notification-system)) follow.

That's every part. Now to size them.

## Key numbers

These size the waiting room, the CDN, the booking service, the inventory database and the seat map. A minute is 60 seconds, and figures are rounded.

- **Waiting room:** about 33,000 arrivals a second, as worked out in "Start simple": 2,000,000 ÷ 60 s ≈ 33,000.
- **CDN:** about 100,000 status checks a second. Assume every waiting fan asks "is it my turn?" every 20 seconds: 2,000,000 ÷ 20 s = 100,000. All of them get the same now-serving number, so the CDN answers them and the waiting room sees only misses.
- **Booking service:** about 33,000 shoppers admitted, over 133 seconds. Assume 2.5 tickets an order and 60% of admitted shoppers buying: 50,000 seats ÷ 2.5 = 20,000 orders, and 20,000 ÷ 0.6 ≈ 33,300 shoppers. At an assumed admission rate of 250 a second, 33,300 ÷ 250 ≈ 133 s.
- **Inventory database:** about 500 holds a second on one event, a quarter of the 2,000 one server takes (500 ÷ 2,000 = 25%). Assume two hold attempts per admitted shopper, since a seat is often just gone: 250 × 2 = 500. All the inventory is small. Assume 100,000 events of 2,000 seats at 100 bytes a row: 100,000 × 2,000 = 200,000,000 rows, and 200,000,000 × 100 B = 20 GB.
- **Seat map:** about 6 KB, rebuilt once a second as a **bitmap**, one bit per seat. 50,000 seats ÷ 8 bits per byte = 6,250 bytes.

The database carries only 500 holds a second, an amount one server takes comfortably, once the waiting room has done its job. Next, what those requests carry and where it lands.

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

An event's rows share one **shard**, a database holding a slice of the events, so a hold never spans two ([sharding](/systems-and-infrastructure/partitioning-vs-sharding)). Eight shards are for isolation, not size: the 20 GB fits one server, but each of up to 5 on-sales gets its own, so a crowd on one can't slow another.

`client_key` makes a retried hold return the first one, and the unique `hold_id` on orders rejects a second order for one hold. Now the first problem: 33,000 fans a second at a door that lets 500 through.

## Decision: a waiting room in front

The simpler way to protect the database is a [rate limit](/system-design/rate-limiter): the gateway passes 500 holds a second, the load we want one event to carry, and answers the rest `429` (too many requests). It breaks on who gets through. A rejected request carries no memory, so every refused fan retries:

```text
arrivals:
  2,000,000 ÷ 60 s ≈ 33,000 a second
let through:
  500 a second
turned away, retrying:
  33,000 − 500 = 32,500 a second, at least
```

The limiter still absorbs at least 32,500 requests a second, growing as refused fans retry, and whoever retries hardest wins; bots retry better than people.

So the fans wait in a room that remembers them. Each visitor gets a numbered place and waits to be called, sending no booking requests, and a called fan gets an admission token. Early arrivals get random places, so 09:59:59 is no worse than 09:40; later arrivals queue in arrival order, one place per account. The room admits 250 a second and slows when the booking service reports rising p99 hold latency ([backpressure](/systems-and-infrastructure/backpressure)).

The cost is a visible wait and a component that must be up. It also takes the 33,000 joins a second itself, cheap because a join only writes a place. Admitted fans now arrive at a pace the database can take, but two of them can still click the same seat.

**Rule of thumb.** When demand far exceeds supply, queue people by a rule you chose instead of rejecting requests and letting retries decide.

## Decision: conditional updates on seat rows

Two shoppers click 114-K-12 together. The simpler way to pick the winner is to lock the seat's row first with `SELECT ... FOR UPDATE` ([pessimistic locking](/systems-and-infrastructure/optimistic-vs-pessimistic-locking)): read the seat, decide in application code, then write. That is correct, and fast enough at 500 holds a second. It breaks on a stall. Read, decide and write are separate round trips, so a server that stalls in the middle keeps its seats locked until the database's lock timeout. Assume we configure 5 seconds (PostgreSQL's default is no timeout, so waiters wait forever):

```text
lock timeout against the p99 target:
  5 s ÷ 0.5 s = 10 times too slow
```

Every other hold that wants one of those seats waits that long, and a crowd after the same front rows will.

So make the write the check. One statement per hold, `UPDATE seats ... WHERE seat_id IN (...)`, changes only the seats that are `available` or whose old hold has lapsed (`held_until < now()`). That is a **conditional update**, a write that applies only if a check still holds, the technique [Design an E-Commerce Checkout](/system-design/ecommerce-checkout) uses on a stock count. If the row count is less than the seats asked for, the transaction rolls back and answers `409`.

At PostgreSQL's default settings the second writer waits for the first's commit, re-checks, finds the seat `held` and changes nothing, so the loser learns in milliseconds. A click on a stale seat map is safe because the hold is the check. The update still locks each row, but only for one statement, a count comparison and the commit, not for a decision. If two holds ever wait on each other, PostgreSQL aborts one, and the booking service retries it.

The cost is wasted work: a hold of 8 seats with one taken changes the other 7 rows and then rolls them back, and the fan must pick again. A hold is safe now, but it lapses, and paying takes seconds.

**Rule of thumb.** Put the check inside the write, so there's no gap for a [race](/systems-and-infrastructure/race-conditions) and a lock lasts one statement, not a decision.

## Decision: pay through a `paying` state

A hold is a **lease**, a claim that lapses at a set time ([distributed locks](/systems-and-infrastructure/distributed-locks)), and the sweeper releases lapsed ones every 5 seconds. The simpler design charges the card, then marks the seats sold, and leaves the holds alone. It breaks when a charge outlasts the lease. Priya's hold lapses at 10:12:40 and her charge starts at 10:12:38. Assume a charge takes 4 seconds:

```text
charge ends:
  10:12:38 + 4 s = 10:12:42
seconds past the lapse:
  10:12:42 − 10:12:40 = 2 s
chance a sweep lands in them:
  2 s ÷ 5 s = 40%
```

From 10:12:40 on, decision 2's rule lets another fan claim her seats, with no sweep needed, and a sweep in that window (40%) frees them too. Refunding one of the two buyers afterwards is possible, but that is two people who paid for one seat, and refunds cost fees and trust.

So extend the claim before charging. Confirm first moves the hold `active` to `paying`, only if it is still active and unexpired, and in the same transaction sets `held_until` on its seats to a three-minute `pay_deadline`. Decision 2's check now fails for other fans, and the sweeper skips `paying` holds until the deadline. Confirm then charges with the hold ID as the **idempotency key**, a label that lets the payment service recognize a retry ([idempotency](/systems-and-infrastructure/idempotency)), so a retry charges once. One transaction marks the hold `confirmed` and the seats `sold` and writes the order and outbox row.

The cost: a slow payment ties up the seats for three minutes, after which the sweeper settles the hold from the payment's status. [Design an E-Commerce Checkout](/system-design/ecommerce-checkout) can let the release win, because it only authorizes the card (the bank sets the total aside) and undoing that is a free **void**. Here the card is charged, so undoing it is a refund, and the seat can't be replaced. If 1 order in 1,000 hit the window, that is 20,000 ÷ 1,000 = 20 refunds on a 20,000-order sale.

**Rule of thumb.** Before doing something slow and hard to undo, extend the claim, on the hold and on the rows others check, so neither another fan nor the cleanup job can take it.

## Likely follow-ups

- **How do you handle a general-admission floor, where tickets have no seat number?** Its tickets are one counter, and a row takes about 500 changes a second (1 ÷ 0.002 s, a 2 ms commit that waits for the **standby**, a second copy kept ready to take over), which is the whole 500 holds a second with no headroom. Split the counter into 10 buckets, about 50 holds each, and add them up when reading.
- **What if the booking server crashes mid-payment?** The hold stays `paying`. A retried confirm repeats the charge with the same key. Otherwise the sweeper asks the payment service for the key's status, voiding it if no charge exists: charged, it finishes the confirm; voided, it releases the seats; unknown, it releases them and refunds later if a charge lands.
- **When would you use one writer per event?** When one event needs thousands of holds a second. It costs routing, replaying a log after a crash, and [fencing](/systems-and-infrastructure/distributed-locks), which makes the database reject a writer whose turn has passed.
- **What if the primary fails mid-sale?** The standby, in another availability zone (a separate data center), is written synchronously, so a write is acknowledged only once it is there too and the standby has every committed write ([read replicas](/systems-and-infrastructure/read-replicas)). Holds fail with `503` while it is promoted.
