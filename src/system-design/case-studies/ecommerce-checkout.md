---
title: Design an E-Commerce Checkout (like Amazon)
summary: Stock reserved with a conditional update before the card is touched, a saga that undoes what it started, and an idempotency key so a retried press doesn't charge twice, at 1,200 orders a second.
date: 2026-10-05
order: 9
template: 2
---

You're asked to design the checkout for a store like Amazon. Browsing is a
caching problem; the hard part is that one "Place order" press changes three
systems that share no database: the **inventory service** counts stock, the
**payment service** talks to the card networks, and the **order service**
records the sale. Any of them can fail, time out or answer twice. The bank
**authorizes** a card first, setting the amount aside; an unwanted
authorization is **voided**.

## Requirements

- One press gives a confirmed order authorized for exactly the total shown, or
  a clean failure with nothing charged or held. A retried press must not
  charge twice.
- 10 million orders a day, 2.5 **lines** each (a **SKU**, one sellable item
  such as "blue kettle", and a quantity).
- 1 billion product page views a day, under 100 ms at p99 (99% of requests are
  faster) and up to a minute stale; the price charged never comes from a page.
- Placing an order takes under 3 s at p99, mostly the bank. Ordering is up
  99.95%; with the payment service down, orders fail cleanly with `503`.
- A cart that follows a signed-in shopper across devices, and cancellation
  before an order ships.
- The warehouse and the confirmation email hear about every confirmed or
  cancelled order.

Out of scope: search, promotions, fraud checks and returns.

## Key numbers

These size the product-page servers, the cache and the databases. Peak is ten times average
([numbers every engineer should know](/engineering-practices/numbers-every-engineer-should-know)):

- **Product pages:** about 120,000 reads a second at peak. 1 billion ÷ 86,400
  ≈ 12,000 on average.
- **Catalog cache:** about 100 GB. Assume the top 10% of 100 million products,
  at 10 KB each, draw 95% of views, leaving the catalog database 6,000 reads a
  second.
- **Orders:** about 1,200 a second at peak. 10 million ÷ 86,400 ≈ 120 on
  average, so 3,000 lines a second at peak.
- **Inventory database:** about 9,000 writes a second at peak. 3,000 lines × 3
  writes (reserve, commit, ship).
- **Order database:** 18 TB a year. 10 million orders × 5 KB = 50 GB a day.

## High-level architecture

![Architecture of the e-commerce checkout. A browser or app sends HTTPS API calls to an API gateway. The gateway routes product pages to the catalog service, cart calls to the cart service, and orders to the order service. The catalog service reads the catalog cache first. The order service reads the cart from the cart service, gets current prices from the catalog service, writes state and outbox rows to the order database, calls the inventory service to reserve, commit and release, and calls the payment service to authorize and void. An outbox relay publishes from the order database to the order event stream, which sends clear ordered items to the cart service and order events to email and fulfilment.](/diagrams/ecommerce-checkout/architecture.svg)

Follow a shopper buying two blue kettles. The **API gateway**, a
[reverse proxy](/systems-and-infrastructure/forward-vs-reverse-proxy), sends
product pages to the catalog service, which reads the
[cache](/systems-and-infrastructure/caching) first; price and availability
entries expire after 60 seconds. "Place order" goes to the
order service, the **orchestrator**: it reads the cart and current prices,
recomputes the total, inserts order `o_5521`, reserves stock, has the payment
service authorize $81.20, commits the stock, then marks the order `CONFIRMED` and writes an **outbox** row, an event waiting to be published, in one order-database transaction
([outbox pattern](/systems-and-infrastructure/outbox-pattern)). A relay sends
it to the stream, where the cart, email and fulfilment pick it up.

## API and data model

```http
POST /orders
Idempotency-Key: 5b0e2c1a-8d7f-4f3e-9a61-2c4d7e9b1f03
{ "cart_version": 16, "address_id": "addr_2", "payment_method_id": "pm_visa_4242", "expected_total_cents": 8120 }
-> 201 { "order_id": "o_5521", "status": "CONFIRMED" }
-> 202 PENDING if the bank is still answering after about 3 s (poll GET /orders/o_5521)
-> 409 with a fresh total if the total or the cart changed
-> 422 out_of_stock or payment_declined; the order is CANCELLED

GET  /orders/o_5521
POST /orders/o_5521/cancel     (only before it ships)
```

```text
orders
  order_id         primary key, "o_5521"
  user_id
  idempotency_key  unique together with user_id
  status           PENDING, RESERVED, AUTHORIZED, CONFIRMED, CANCELLING,
                   CANCELLED, SHIPPED or DELIVERED
  version          +1 on every status change
  total_cents      8120 means $81.20
  payment_auth_id  nullable
stock
  sku              primary key
  on_hand          units in the warehouses
  reserved         units promised to orders that haven't shipped
reservations
  order_id, sku    primary key together
  quantity
  state            HELD, COMMITTED or RELEASED
  expires_at       when a HELD reservation lapses
```

The server recomputes the total from the catalog's primary, not the cache, and
answers `409` rather than charge an amount the shopper didn't see. Orders are
sharded by user, so one shard's unique index can enforce
`(user_id, idempotency_key)`. Both databases are relational, for conditional
updates ([SQL vs. NoSQL](/systems-and-infrastructure/sql-vs-nosql)).

## Decision: reserve stock before payment

Two shoppers can both see "1 left" and press the button, the check-then-act bug in [race conditions](/systems-and-infrastructure/race-conditions). So
before any card is touched, the order service reserves each line with one
conditional update, adding 2 to `reserved` only where `on_hand - reserved >= 2`,
and inserts a `HELD` reservation in the same transaction. Two orders racing for
the last unit can't both match: the database applies updates one at a time. The
reservation's `expires_at` is 10 minutes out, a **lease**: a
claim that lapses on its own, so the inventory service's expiry sweeper frees units an order never came back for.

Why not decrement after payment? It works, but assume 1 order in 1,000 meets a
sell-out: 10,000 orders a day whose card was authorized before the stock check
failed, each needing a void, and some banks show an authorization as a pending
charge for days. Reserving turns them into "out of stock" before the card is
touched.

**Rule of thumb.** When requests compete for a counted resource, claim it with
one conditional update before the slow, hard-to-undo step.

## Decision: a saga run by the order service

Placing an order must record it, reserve stock and authorize the card: all
three or none. The order service runs a **saga**
([saga pattern](/systems-and-infrastructure/saga-pattern)): each step is a
local transaction with a **compensation** that undoes it (release the
reservation, void the authorization), run in reverse if a later step fails. The
order's `status` records the last finished step, so a recovery sweeper in the order service resumes one stuck for 30 seconds (the lease is the backstop), and each change is a conditional update naming the
`version` it expects, so it can't clash with a slow worker.

Why not one transaction, with **two-phase commit**, where a coordinator has
every participant prepare (hold its locks, promise to commit) before telling
them to commit? The payment service offers an HTTP API, not prepare and commit.
And the stock row would stay locked through a roughly
2-second authorization, so one SKU could sell 0.5 orders a second; a
reservation holds it for about a millisecond. The saga's price: while `o_5521`
waits on the bank, another shopper sees "1 left" where there were 3.

**Rule of thumb.** When an operation spans services that can't share a
transaction, break it into steps that each have an undo, and keep its progress
in one durable record.

## Decision: an idempotency key on the order

"Place order" gets sent twice: a double click, or a retry after a lost
response. So the client makes an **idempotency key**, a unique
string, when the review page loads and sends it with every attempt
([idempotency](/systems-and-infrastructure/idempotency)). The order service
inserts the order and the key in one transaction, and the unique index on
`(user_id, idempotency_key)` makes the second of two simultaneous attempts fail.
Either way the retry gets the first order's state. The bank call
carries its own key, `o_5521:auth-1`, so a retry returns the first result
instead of authorizing again.

Why not refuse an order identical to one from the last few minutes? It blocks a
shopper who wants a second kettle, and "identical" needs a rule.

**Rule of thumb.** When a client may retry a request that moves money, have it
send a key, and store the key in the same transaction as the write.

## Likely follow-ups

- **What if the lease expires while the bank is slow?** Commit and the expiry sweeper's release both require `state = 'HELD'`, so one wins; if the release did, the order is voided.
- **What if the payment service is down?** A
  [circuit breaker](/systems-and-infrastructure/circuit-breaker) refuses new
  orders with `503` before any stock is reserved.
- **How does the warehouse hear?** From the outbox row, relayed at least once,
  so consumers skip event IDs already applied.
- **How does cancel work?** `CONFIRMED` becomes `CANCELLING`; the order service
  voids the authorization (or refunds) and releases the units. Once the order
  ships, it refuses.
