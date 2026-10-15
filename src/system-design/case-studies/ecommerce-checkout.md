---
title: Design an E-Commerce Checkout (like Amazon)
summary: Stock reserved with a conditional update before the card is touched, a saga that undoes what it started, and an idempotency key so a retried press doesn't charge twice, at 1,200 orders a second.
date: 2026-10-05
order: 9
template: 3
---

You're asked to design the checkout for a store like Amazon. A shopper has two blue kettles in the cart and presses "Place order". Browsing is a caching problem; the hard part is what one press has to change.

The store splits that work across three **services**, programs that each own their data: the inventory service counts stock, the payment service talks to the card networks, and the order service records the sale. They share no database, and any of them can fail, time out or answer twice. So the question is how one press ends in one of two states, a confirmed order for the total shown or nothing charged and nothing held, even when the press is sent twice.

The design sets the stock aside first, then asks the bank to hold the money, and undoes whatever it did if a later step fails. This page starts with a one-database version and shows where it breaks, follows one order through the replacement, sizes its parts, and makes three decisions: how stock is reserved, how an order stays all-or-nothing, and how a repeated press avoids a second charge.

## Requirements

- One press gives a confirmed order whose card is **authorized** (the bank sets the total aside) for the total shown, or a clean failure with nothing charged or held. A retried press must not charge twice.
- 10 million orders a day, 2.5 **lines** each (a **SKU**, one sellable item such as "blue kettle", and a quantity).
- 1 billion product page views a day, under 100 ms at p99 (99% of requests are faster) and up to a minute stale; the price charged never comes from a page.
- Placing an order takes under 3 s at p99, mostly the bank. Ordering is up 99.95%; with the payment service down, orders fail cleanly with `503` (service unavailable).
- A cart that follows a signed-in shopper across devices, and cancellation before an order ships.
- The warehouse and the confirmation email hear about every confirmed or cancelled order.

Out of scope: search, promotions, fraud checks and returns.

## Start simple

The obvious design keeps everything in one relational database: a `stock` table with a count for each SKU, and an `orders` table. One server handles "Place order" inside a **transaction**, a group of changes the database applies all together or not at all:

1. Read the cart and the prices, and add up the total: $81.20 for two kettles.
2. Subtract 2 from the kettle's stock, but only if at least 2 are left.
3. Ask the bank to authorize $81.20 on the card.
4. Insert order `o_5521` as `CONFIRMED`, and commit.

If any step fails, the database undoes the earlier ones, so stock isn't taken without an order. For a small shop, that's fine. Say it takes 1,000 orders a day, and peak traffic is ten times the average ([numbers every engineer should know](/engineering-practices/numbers-every-engineer-should-know)):

```text
average:
  1,000 ÷ 86,400 s ≈ 0.012 a second
peak:
  0.012 × 10 ≈ 0.12 a second
```

Nobody waits at that rate. Now run the same steps on this shop's 10 million orders a day, assuming the bank takes 2 seconds to answer and a flash deal draws 20 orders a second to one SKU:

```text
average:
  10,000,000 ÷ 86,400 s ≈ 120 a second
peak:
  120 × 10 = 1,200 a second
orders a second one SKU can sell
while its row is locked for the bank:
  1 ÷ 2 s = 0.5
deal demand against that:
  20 ÷ 0.5 = 40 times too much
```

Step 2 locks the kettle's stock row until the commit, so the 2-second bank call keeps the row locked, and the deal's orders queue behind one another. The bank is also outside the database, and a rollback can't un-authorize a card. A crash after step 3 leaves money held for an order that doesn't exist, and a retry after a lost answer could authorize twice. An unwanted authorization needs a separate **void** call.

So the steps can't live in one transaction. They have to be separate, in a careful order, each with its own undo.

## High-level architecture

![Architecture of the e-commerce checkout. A browser or app sends HTTPS API calls to an API gateway. The gateway routes product pages to the catalog service, cart calls to the cart service, and orders to the order service. The catalog service reads the catalog cache first. The order service reads the cart from the cart service, gets current prices from the catalog service, writes state and outbox rows to the order database, calls the inventory service to reserve, commit and release, and calls the payment service to authorize and void. An outbox relay publishes from the order database to the order event stream, which sends clear ordered items to the cart service and order events to email and fulfillment.](/diagrams/ecommerce-checkout/architecture.svg)

Follow the shopper buying the two kettles. Browsing comes first: the **API gateway**, a [reverse proxy](/systems-and-infrastructure/forward-vs-reverse-proxy), sends product pages to the catalog service, which reads the [catalog cache](/systems-and-infrastructure/caching) before the catalog database. Cached price and availability entries expire after 60 seconds, which is why a page can be a minute stale.

"Place order" goes to the order service, which runs the steps in order, so it is the **orchestrator**. It reads the cart from the cart service, which keeps a signed-in shopper's cart on the server so it follows them across devices. It also gets current prices from the catalog service, recomputes the total and inserts order `o_5521`. It then asks the inventory service to **reserve** two kettles, setting them aside so nobody else can buy them (the inventory service keeps stock in its own database), and only then asks the payment service to authorize $81.20. The first decision is why reserving comes first.

When the bank agrees, the order service tells the inventory service to commit the reservation, turning it into a permanent stock decrease, and then marks the order `CONFIRMED`. That status change and an **outbox** row, a note that the order is confirmed, go into the order database in one transaction, so the note and the status land together or not at all ([outbox pattern](/systems-and-infrastructure/outbox-pattern)).

A **relay**, a small process that forwards stored notes, publishes the row to the order event stream, a [message queue](/systems-and-infrastructure/message-queues) where the cart service, email and fulfillment pick it up. If a step fails, the steps before it need undoing; the second decision builds that.

That is every part. Now to size them.

## Key numbers

These size the catalog service, the catalog cache, the inventory service's database and the order database. A day is 86,400 seconds, peak is ten times the average, and figures are rounded.

- **Product pages:** about 120,000 reads a second at peak, the load on the catalog service. 1 billion ÷ 86,400 ≈ 12,000 on average, and 12,000 × 10 = 120,000.
- **Catalog cache:** about 100 GB. Assume the top 10% of 100 million products draw 95% of views: 100 million × 10% = 10 million products, × 10 KB each = 100 GB. The other 5% of views miss the cache and reach the catalog database: 120,000 × 5% = 6,000 reads a second.
- **Orders:** about 1,200 a second at peak, the load on the order service. 10 million ÷ 86,400 ≈ 120 on average, and 120 × 10 = 1,200. At 2.5 lines each, that is 1,200 × 2.5 = 3,000 lines a second.
- **Inventory database:** about 9,000 writes a second at peak. Each line writes 3 times over an order's life (reserve, commit, ship): 3,000 × 3 = 9,000.
- **Order database:** 18 TB a year. 10 million orders × 5 KB = 50 GB a day, and 50 GB × 365 ≈ 18 TB.

The first decision protects the stock rows that take those 9,000 writes.

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

The client picks the `Idempotency-Key`, a label it reuses on every retry of one press so the server can recognize a repeat; the third decision uses it. The server recomputes the total from the catalog's primary database, not the cache, and answers `409` rather than charge an amount the shopper didn't see.

Orders are [sharded](/systems-and-infrastructure/partitioning-vs-sharding) by user, split across databases that each hold some users' orders, so one shard's unique index can enforce `(user_id, idempotency_key)`. The order and inventory databases are relational, because the decisions below need **conditional updates**, writes that apply only if a check still holds ([SQL vs. NoSQL](/systems-and-infrastructure/sql-vs-nosql)).

## Decision: reserve stock before payment

The simpler order of steps is to authorize the card first and take the stock after. Assume 1 order in 1,000 meets a sell-out, where the last units go to someone else while the card is being authorized:

```text
orders a day that meet a sell-out:
  10,000,000 ÷ 1,000 = 10,000
```

That is 10,000 authorizations a day with nothing to sell, each needing a void, and some banks show an authorization as a pending charge for days. Checking the count first doesn't help: two shoppers can both see "1 left" and press the button, the check-then-act bug in [race conditions](/systems-and-infrastructure/race-conditions).

So before any card is touched, the order service asks the inventory service to reserve each line with one conditional update, adding 2 to `reserved` only where `on_hand - reserved >= 2`, and inserts a `HELD` reservation in the same transaction. Two orders racing for the last unit can't both match, because the database applies updates to a row one at a time. The reservation's `expires_at` is 10 minutes out, a **lease**: a claim that lapses on its own, so the inventory service's expiry sweeper frees units an order never came back for.

The cost is more writes and some held stock. A reservation adds a write per line: without it a line writes twice (decrement, then ship), so 3 writes per line, not 2, makes 9,000 a second instead of 6,000. A crashed order service can also leave units held for up to 10 minutes.

**Rule of thumb.** When requests compete for a counted resource, claim it with one conditional update before the slow, hard-to-undo step.

## Decision: a saga run by the order service

Placing an order must record it, reserve stock and authorize the card: all three or none. The simpler way is one transaction across all of them, using **two-phase commit**, where a coordinator has every participant prepare (hold its locks, promise to commit) before telling them to commit. That breaks twice here. The payment service offers an HTTP API, not prepare and commit. And the stock row would stay locked through the 2-second authorization, as in Start simple. Against the deal's 20 orders a second on one SKU:

```text
locked for the bank call:
  1 ÷ 2 s = 0.5 orders a second, 40 times too few
locked for a reservation (about 1 ms):
  1 ÷ 0.001 s = 1,000 orders a second, enough
```

So the order service runs a **saga** ([saga pattern](/systems-and-infrastructure/saga-pattern)): each step is a local transaction with a **compensation** that undoes it, run in reverse if a later step fails. The compensations are to release the reservation and to void the authorization. [Design a Payment System](/system-design/payment-system) uses the same idea for transfers, with a queue driving the steps.

The order's `status` records the last finished step, so a recovery sweeper in the order service resumes one stuck for 30 seconds, and the lease is the backstop. Each change is a conditional update naming the `version` it expects, so a slow worker's late write can't overwrite a newer status.

The saga's price: while `o_5521` waits on the bank, another shopper sees "1 left" where there were 3.

**Rule of thumb.** When an operation spans services that can't share a transaction, break it into steps that each have an undo, and keep its progress in one durable record.

## Decision: an idempotency key on the order

"Place order" gets sent twice: a double click, or a retry after a lost response. The simpler guard is to refuse an order identical to one from the last few minutes. Assume 1 order in 500 is a real repeat, such as a second kettle for a friend:

```text
legitimate orders refused a day:
  10,000,000 ÷ 500 = 20,000
```

That turns away 20,000 real orders a day, and "identical" needs a rule for every field.

So the client makes an **idempotency key**, a unique string, when the review page loads and sends it with every attempt ([idempotency](/systems-and-infrastructure/idempotency)). The order service inserts the order and the key in one transaction. The unique index on `(user_id, idempotency_key)` fails the second of two simultaneous attempts, a later retry finds the key, and both get the first order's state.

The call to the payment service carries its own key, `o_5521:auth-1`, so a retry returns the first result instead of authorizing again. The payment service stores that key with its payment and passes keys derived from it to the card processor, as in [Design a Payment System](/system-design/payment-system).

The cost is a stored key on every order, and a limit: it covers repeats of one press. A shopper who reloads the review page gets a new key, so a press after the reload is a new order.

**Rule of thumb.** When a client may retry a request that moves money, have it send a key, and store the key in the same transaction as the write.

## Likely follow-ups

- **What if the lease expires while the bank is slow?** Commit and the expiry sweeper's release both require `state = 'HELD'`, so one wins; if the release did, the order is voided.
- **What if the payment service is down?** A [circuit breaker](/systems-and-infrastructure/circuit-breaker), which stops calling a failing service for a while, refuses new orders with `503` before any stock is reserved.
- **How does the warehouse hear?** From the outbox row, relayed at least once, meaning an event can arrive twice, so consumers skip event IDs already applied.
- **How does cancel work?** `CONFIRMED` becomes `CANCELLING`; the order service voids the authorization and releases the units. Capture, when the money actually moves, happens at shipping. Once the goods have left, cancel is refused, and getting money back is a return, which is out of scope.
- **What if the bank is still answering after 3 seconds?** The order service answers `202 PENDING` and the shopper polls `GET /orders/o_5521`. The payment service keeps retrying with the same keys, and the sweeper finishes or undoes the order.
