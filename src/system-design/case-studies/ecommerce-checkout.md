---
title: Design an E-Commerce Checkout (like Amazon)
summary: Getting from a cart to a placed order across inventory, payment and order services, with stock reservations that expire, a saga that undoes what it started, and idempotency keys so a double click never charges twice.
date: 2026-09-28
order: 9
---

An online store looks like one application to the shopper: browse, add to
cart, press "Place order", get a confirmation. Behind that button sit three
systems. The **inventory service** knows what is in stock, the **payment
service** talks to the card networks and banks, and the **order service**
records what was bought, at what price, and where it goes. Placing one order
changes all three, and any of them can fail, time out, or answer twice.

Browsing is a caching problem of the kind the
[URL shortener](/system-design/url-shortener) works through, and gets a short
treatment. The hard part is a write across services that don't share a
database, where getting it wrong charges someone for an item that isn't
there, or twice. This is one plausible design for a large store like Amazon,
not how any company built theirs.

A **SKU** (stock keeping unit) is one specific sellable item, such as "blue
kettle, 1.7 litres", the unit inventory is counted in. A card payment usually
has two stages: an **authorization** asks the bank to set the amount aside,
and a **capture**, often days later when the item ships, moves the money. An
unwanted authorization can be **voided**, releasing the hold without a charge.

## At a glance

**Requirements.**

- One press of "Place order": a confirmed order authorized for exactly the
  total shown, or a clean failure with nothing charged or held.
- 50 million daily shoppers, 1 billion product page views and 10 million
  orders a day, 2.5 lines per order.
- At p99: product page data under 100 ms, a cart change under 200 ms, placing
  an order under 3 seconds.
- Never charge twice for one order; confirmed orders later cancelled for lack
  of stock stay below 1 in 10,000.
- Product pages may be a minute stale; the price charged never comes from
  them.

**Key numbers.** From the estimates:

- About 120,000 product page reads a second at peak (1 billion ÷ 86,400 ≈
  12,000, times ten).
- 6,000 catalog database reads a second at peak (120,000 × the 5% that miss
  the 100 GB cache).
- About 1,200 orders a second at peak (10 million ÷ 86,400 ≈ 120, times ten).
- 9,000 inventory writes a second at peak (3,000 order lines × 3: reserve,
  then commit or release, then ship).
- About 18 TB of orders a year (10 million × 5 KB = 50 GB a day).

**Key decisions.**

- Reserve stock before payment, with a 10-minute TTL: a stock failure happens
  before the card is touched ([reserving inventory](#deep-dive-reserving-inventory)).
- A saga orchestrated by the order service, not two-phase commit: the payment
  service can't take part in 2PC, and 2PC would lock a SKU for a whole payment
  call ([the checkout saga](#deep-dive-the-checkout-saga)).
- The idempotency key stored on the order row: one transaction writes both, so
  the key never exists without its order, and a retry finds that order or
  safely creates it
  ([idempotency](#deep-dive-idempotency-and-order-events)).

**Likely follow-ups.**

- What if two shoppers buy the last unit? A conditional `UPDATE` on the stock
  row lets only one reservation succeed
  ([reserving inventory](#deep-dive-reserving-inventory)).
- What if the order service crashes mid-checkout? A recovery sweeper resumes
  each order from its recorded status; every step is safe to repeat
  ([the checkout saga](#deep-dive-the-checkout-saga)).
- How does the warehouse hear about an order? Through an outbox row written in
  the confirming transaction; consumers deduplicate by event ID
  ([order events](#deep-dive-idempotency-and-order-events)).
- What happens when the payment service is down? A circuit breaker refuses new
  orders with `503` before any stock is reserved
  ([failure modes](#failure-modes-and-bottlenecks)).

The services and the steps of one order are in
[High-level architecture](#high-level-architecture).

## Requirements

Functional requirements:

- **Browse products.** A product page shows the description, pictures, the
  current price and a rough availability ("In stock", "Only 3 left", "Out of
  stock").
- **Cart.** A shopper can add, change and remove items. A signed-in shopper's
  cart follows them across devices; a guest (not signed in) also has a cart,
  merged into their account's cart when they sign in.
- **Checkout review.** The server computes the final line prices, shipping,
  tax and total.
- **Place order.** One press either produces a confirmed order with the card
  authorized for exactly the total shown, or a clear failure (out of stock,
  payment declined, price changed) with nothing charged or held.
- **Order status.** See an order's state, and cancel it before it ships.
- **Order events.** The email, the warehouse and analytics learn about every
  confirmed, cancelled and shipped order.

Out of scope: search and recommendations; the payment service's internals (a
later case study covers payments); warehouses and shipping; returns; promotion
rules; fraud checks; and outside sellers. Thousands of people fighting over a
few hundred units in the same second is a later ticket-booking case study's
problem; this design is for ordinary retail, where most items have more stock
than anyone is trying to buy at once.

Non-functional requirements:

- **Scale.** 50 million daily active shoppers, 100 million SKUs, 1 billion
  product page views a day, 20 million cart changes a day, and 10 million
  orders a day averaging 2.5 SKUs (**lines**) each.
- **Latency**, at the 99th percentile (p99, the time 99% of requests beat):
  a product page's data under 100 ms; a cart change under 200 ms; placing an
  order under 3 seconds, most of which is the payment authorization, which
  this design doesn't control.
- **Availability.** Browsing and the cart 99.99%; placing orders 99.95% for
  the parts this design runs. With the payment service down, new orders fail
  cleanly with `503`, and orders waiting on payment hold stock for at most the
  10-minute reservation TTL.
- **Correctness.** Never charged twice for one order, or for an order that
  doesn't exist; the authorized amount is exactly the review page's total, or
  the order is refused. Confirmed orders later cancelled for lack of stock
  stay below 1 in 10,000.
- **Staleness.** A product page may be up to a minute old; the price charged
  never comes from it.

## Back-of-the-envelope estimates

The estimates use two rules of thumb from
[numbers every engineer should know](/engineering-practices/numbers-every-engineer-should-know):
a day is 86,400 seconds, and plan for a peak of about ten times the average.

**Product page reads.**

- Average: 1,000,000,000 ÷ 86,400 ≈ 11,600, call it **12,000 reads a second**.
- Peak: **about 120,000 a second**.

**Cart writes.**

- Average: 20,000,000 ÷ 86,400 ≈ 230 a second.
- Peak: **about 2,300 a second**. Small for any key-value store.

**Orders.**

- Average: 10,000,000 ÷ 86,400 ≈ 116, call it **120 orders a second**.
- Peak: **about 1,200 orders a second**, so 1,200 payment authorizations a
  second at peak.
- Lines: 1,200 × 2.5 = **3,000 order lines a second** at peak.

**Inventory writes.** Each line is reserved once, then either committed or
released, and a committed line is written a third time when it ships (or is
cancelled): 3,000 × 3 = **9,000 inventory writes a second** at peak, counting
the shipping write at the checkout rate, which overstates it slightly.

**Order database writes.** Checkout moves each order through four recorded
steps (created, stock reserved, payment authorized, confirmed), each one
database transaction: 1,200 × 4 = **4,800 transactions a second** at peak.

**Order storage.** An order with its lines, addresses and price breakdown is
about 5 KB.

- Per day: 10,000,000 × 5 KB = 50 GB.
- Per year: 50 GB × 365 ≈ **18 TB**. Keeping two years in the live order
  database is about 36.5 TB; older orders move to cheaper archive storage for
  the seven years tax records are commonly kept.

**Catalog storage.** 100 million products at about 10 KB each (images live in
object storage) is **1 TB**.

**Catalog cache.** Assume the most-viewed 10% of products (10 million) take
about 95% of page views. Caching those: 10,000,000 × 10 KB = **100 GB**,
spread over several cache servers. At a 95%
hit rate, the 120,000-a-second peak leaves 120,000 × 0.05 = **6,000 reads a
second** for the catalog database.

**Carts.** Assume 100 million carts exist at any time (signed-in carts kept
indefinitely, guest carts expiring after 30 days), each about 2 KB:
100,000,000 × 2 KB = **200 GB**.

**Inventory.** 100 million SKUs × about 100 bytes of counters = **10 GB**.
Reservation records, kept seven days after they finish for debugging:
25 million lines a day × 7 = 175 million rows × 100 bytes ≈ 17.5 GB.

**Order events.** About three per order (confirmed or cancelled, shipped,
delivered): 30 million a day, **350 a second** on average and **3,500 at
peak**, about 30 GB a day at 1 KB each.

The order path is modest in volume but touches three services and a payment
call of a second or two per order, so design effort goes there.

## Data model

Each service owns its data, and no service reads another's database, so no
single database transaction can cover the order, the stock and the payment.

**Catalog** (a relational database, 1 TB, with read-only copies for reads):

```text
products
  product_id    string, primary key
  title, description, attributes, image_urls
  updated_at    timestamp
prices
  sku           string, primary key
  price_cents   integer            1999 means $19.99
  currency      string
  updated_at    timestamp
```

Money is stored as an integer count of cents, never as a floating-point
number, because binary floating point can't represent 0.10 exactly and
rounding errors add up across millions of orders.

**Carts** (a key-value store, which keeps each record under one key and finds
it only by that key; 200 GB), one record per cart:

```text
carts
  cart_id     string, key           "user:u_4821" or "guest:9f1c..."
  items       list of { sku, quantity, added_at, price_seen_cents }
  version     integer               incremented on every write
  expires_at  timestamp, nullable   set for guest carts only
  merged_guest_ids   list           guest carts already merged in
  applied_event_ids  list           order events already applied
```

Carts live on the server: one in a browser cookie wouldn't follow the shopper
to their phone and is lost with the site data, while server-side carts cost
only the 200 GB and 2,300 writes a second from the estimates. Adding to the
cart holds no stock, since most carts never become orders.
`price_seen_cents` only tells the shopper "the price dropped since you added
this"; checkout never charges it.

Each write carries the `version` it read and applies only if that is still
current, otherwise `409` and the current cart: optimistic locking
([optimistic vs. pessimistic locking](/systems-and-infrastructure/optimistic-vs-pessimistic-locking)),
which suits a cart because one shopper's devices rarely conflict. At sign-in
the guest cart is merged in as a union, taking the larger quantity for SKUs in
both: keeping only the account cart would drop what the guest just added, and
summing would turn one kettle added on two devices into two. The merge is two
writes (the account cart, then deleting the guest cart), and repeating it
after a crash between them could restore an item since removed, so the
account-cart write also records the guest cart's ID in `merged_guest_ids`, and
a merge that finds it there only deletes the guest cart. `applied_event_ids`
does the same for order events. Entries older than 30 days, the guest-cart
lifetime, are dropped.

**Inventory** (a relational database split by SKU into four **shards**,
independent parts each with its own **primary**, the one server that takes its
writes; four put about 2,250 of the peak 9,000 writes a second on each, with
room for bursts):

```text
stock
  sku          string, primary key
  on_hand      integer     units physically in the warehouses
  reserved     integer     units promised to orders not yet shipped
reservations
  order_id, sku      primary key (together)
  quantity           integer
  state              HELD | COMMITTED | RELEASED
  expires_at         timestamp   when a HELD reservation lapses
```

Units available to sell are `on_hand − reserved`.

**Orders** (a relational database, sharded by user ID into 16 shards):

```text
orders
  order_id          string, primary key (encodes the shard)
  user_id           string
  idempotency_key   string       unique together with user_id
  status            see the order state machine
  version           integer      incremented on every status change
  subtotal_cents, shipping_cents, tax_cents, total_cents
  payment_auth_id   string, nullable
  shipping_address, created_at, updated_at
order_lines
  order_id, sku, quantity, unit_price_cents, tax_cents
outbox
  event_id          string, primary key
  order_id, type, payload, created_at
  published_at      timestamp, nullable
```

Sharding by user puts "my orders" in one shard and lets an ordinary unique
index on that shard enforce `(user_id, idempotency_key)`. At 4,800
transactions a second at peak, 16 shards take about 300 each, and two years of
orders come to about 2.3 TB per shard, both comfortably inside what one
relational primary handles.

Inventory and orders are relational because both need **conditional
updates** ("reserve 2 units only if at least 2 are available", "move to
CONFIRMED only if the status is still AUTHORIZED") and transactions over
several rows (an order, its lines and its outbox event), which a
single-primary relational database does cheaply
([SQL vs. NoSQL](/systems-and-infrastructure/sql-vs-nosql)). The cart needs
neither.

## API design

**Product page**

```http
GET /products/p_7731
```

Returns the product content, a display price and an availability hint, built
from caches and up to a minute old.

**Cart**

```http
GET    /cart
PUT    /cart/items/sku_kettle_blue      { "quantity": 2, "cart_version": 14 }
DELETE /cart/items/sku_kettle_blue?cart_version=15
```

The cart is found from the session (a user ID, or a guest cart ID in a
cookie); a `cart_version` mismatch returns `409 Conflict` with the current
cart.

**Checkout review (a quote)**

```http
POST /checkout/quote
{ "cart_version": 16, "address_id": "addr_2", "shipping": "standard" }

200 OK
{ "lines": [ { "sku": "sku_kettle_blue", "quantity": 2, "unit_price_cents": 3499 } ],
  "subtotal_cents": 6998, "shipping_cents": 499, "tax_cents": 623,
  "total_cents": 8120 }
```

Everything in the quote is computed on the server from the authoritative price
table (read from the catalog's primary, not the cache), the shipping address
and each product's tax category. Nothing the browser sends about money is
trusted: a price in a request is just a number someone typed.

**Place order**

```http
POST /orders
Idempotency-Key: 5b0e2c1a-8d7f-4f3e-9a61-2c4d7e9b1f03

{ "cart_version": 16, "address_id": "addr_2", "shipping": "standard",
  "payment_method_id": "pm_visa_4242", "expected_total_cents": 8120 }
```

An **idempotency key** is a unique string the client generates once per intent
to buy (when the review page loads) and sends with every attempt, so the
server can recognize a retry. If the server's recomputed total differs from
`expected_total_cents`, it refuses rather than charge a different amount.

- `201 Created` with the order and `"status": "CONFIRMED"`.
- `202 Accepted` with `"status": "PENDING"` if the order hasn't finished
  within about 3 seconds (a slow payment); the page then polls
  `GET /orders/{order_id}`.
- `409 Conflict` with a fresh quote if the total changed or the cart changed;
  no order is created.
- `422 Unprocessable Content` with `"error": "out_of_stock"` (naming the SKUs)
  or `"payment_declined"`, and the order ID, now `CANCELLED`.
- The same `Idempotency-Key` again returns the same order's current state,
  whatever the first attempt returned.

**Order status and cancel**

```http
GET  /orders/o_5521
POST /orders/o_5521/cancel
```

Cancel succeeds only before the order ships.

## High-level architecture

![Architecture of the e-commerce checkout. A browser or app loads images and scripts from a CDN and sends API calls over HTTPS to an API gateway. The gateway routes product pages to the catalog service, which reads the catalog cache first; cart calls to the cart service; and quotes and orders to the order service. The order service reads the cart from the cart service and current prices from the catalog service, writes order state and outbox rows to the order database, calls the inventory service to reserve, commit and release stock, and calls the payment service to authorize and void. An outbox relay publishes from the order database to the order event stream, which feeds the cart service, email and fulfilment.](/diagrams/ecommerce-checkout/architecture.svg)

From the top:

- The **CDN** (content delivery network), caching servers close to shoppers,
  serves images, scripts and style sheets.
- The **API gateway**, a reverse proxy
  ([forward vs. reverse proxy](/systems-and-infrastructure/forward-vs-reverse-proxy)),
  routes each call, spreads requests across a service's servers (the job of a
  **load balancer**), checks the session, and applies per-client limits like
  the [rate limiter](/system-design/rate-limiter) case study's.
- The **catalog service** answers product pages from the **catalog cache**
  (an in-memory key-value store), falling back to read-only database copies.
- The **cart service** keeps carts in its key-value store.
- The **order service** computes quotes and, as the checkout's
  **orchestrator**, runs each order's steps, storing progress in the **order
  database** with an **outbox** table of events waiting to be published.
- The **inventory service** holds stock counts and reservations.
- The **payment service** authorizes, captures and voids card payments, a
  black box that accepts its own idempotency keys.
- The **order event stream** is a durable, ordered log (Kafka is a common
  choice), fed by an **outbox relay** and read by the cart service, the
  confirmation email (via the
  [notification system](/system-design/notification-system)) and fulfilment.

Placing an order, in outline:

1. The order service reads the cart at the given version and current prices,
   computes the total, and compares it with `expected_total_cents`.
2. In one transaction on the order database it inserts the order (status
   `PENDING`) with its lines and the idempotency key.
3. It asks the inventory service to reserve every line.
4. It asks the payment service to authorize the total, and records the order
   as `AUTHORIZED`.
5. It asks the inventory service to commit the reservations, then marks the
   order `CONFIRMED` and writes an `OrderConfirmed` event to the outbox in the
   same transaction.
6. The outbox relay publishes the event; the cart service removes the ordered
   items from the cart, the email goes out and the warehouse starts picking.

If step 3 or 4 fails, the order service undoes the earlier steps: a saga, the
subject of the checkout deep dive.

**The catalog read path.** At 120,000 reads a second, read replicas alone
would be a large fleet doing a cache's work, and a precomputed read model
([CQRS](/systems-and-infrastructure/cqrs)) would rewrite a 10 KB document on
every price or stock change. So the catalog uses a cache filled on a miss
([caching](/systems-and-infrastructure/caching)): the 100 GB of hot products
leaves 6,000 reads a second for the
[read replicas](/systems-and-infrastructure/read-replicas). Content is cached
for 10 minutes; price and availability are small separate entries with a
60-second **TTL** (time to live: how long the cache keeps an entry), the
requirements' "up to a minute old", with availability as a bucket ("only 3
left"). An edit commits with an outbox row, from which a relay deletes the
cache entry, so the delete survives a crash
([cache invalidation](/systems-and-infrastructure/cache-invalidation)).
Staleness is safe because nothing here decides money: the quote and the order
read prices from the catalog's primary.

## Deep dive: reserving inventory

Two customers buying the last kettle can both see "1 available" and both
succeed, the check-then-act bug
[race conditions](/systems-and-infrastructure/race-conditions) describes.
Three common answers differ in how often an order fails and at which moment.

To compare them, assume that 100,000 times a day some SKU's available stock
reaches zero (a **sell-out**), and that orders for it arrive at about one a
minute. An order fails when it arrives inside the window between the stock
reaching zero and the system refusing orders for it, so each sell-out causes
arrival rate × window failed orders.

**Oversell and apologize.** Accept any order the cached availability allows,
let the count go negative, then cancel the extras and apologize. The window is
the cache's age, up to 60 seconds, 30 on average: (1 ÷ 60) × 30 = 0.5 per
sell-out, so 100,000 × 0.5 = **50,000 confirmed orders a day cancelled
afterwards**, 0.5% of all orders, fifty times the 1-in-10,000 target, each
reaching a customer who already has a confirmation email.

**Check, then decrement after payment.** The window shrinks to the payment
authorization, about 2 seconds: (1 ÷ 60) × 2 ≈ 0.033 per sell-out, about
**3,300 orders a day** (0.03%) whose card was authorized before the decrement
found nothing left. They fail before confirmation, so they don't count against
the target, but each leaves an authorization to void, which some banks show as
a pending charge for several days.

**Reserve before payment, with a TTL.** Before any payment, reserve the units
in one conditional statement:

```sql
UPDATE stock SET reserved = reserved + 2
WHERE sku = 'sku_kettle_blue' AND on_hand - reserved >= 2;
-- and, in the same transaction:
INSERT INTO reservations (order_id, sku, quantity, state, expires_at)
VALUES ('o_5521', 'sku_kettle_blue', 2, 'HELD', now() + interval '10 minutes');
```

If the update matches no row, the order fails before anything is charged, and
two orders racing for the last unit can't both succeed, because the database
applies the updates one after the other. After authorization the reservation
moves from `HELD` to `COMMITTED`; if payment fails it is `RELEASED` and
`reserved` drops again. A committed reservation ends when the item ships
(`on_hand` and `reserved` both drop) or the customer cancels first. An order's
lines can sit on different shards, so they are reserved one at a time, and if
any fails the ones already reserved are released before answering "out of
stock".

No order then fails after payment for lack of stock. Instead a unit held for
a declined payment is unavailable for those 2 seconds: assuming
5% of authorizations are declined, about 100,000 × 0.05 × (1 ÷ 60) × 2 ≈
**170 shoppers a day** get an "out of stock" that would have cleared seconds
later. It also costs the second write per line (commit or release) in the
9,000 inventory writes a second.

**This design reserves before payment.** Its failures come before the card is
charged, as an ordinary "out of stock". Confirmed-then-cancelled orders fall to
the warehouse's counting errors (a unit dropped, miscounted or stolen), which
still need the apologize path but at the warehouse's error rate: that is how
the 1-in-10,000 target is met.

**The TTL.** The `expires_at` on a `HELD` reservation is a **lease**: a claim
that lapses on its own if its holder never comes back. It is for an order that
crashes halfway and is never resumed, whose units a sweeper in the inventory
service releases. Ten minutes outlasts any normal checkout, including a slow
payment retried a few times, and returns a stuck unit before much sales time
is lost.

A lease can expire while its holder is alive: the order service might stall
for 11 minutes on a payment that eventually succeeds. So the commit and the
sweeper's release are both conditional on `state = 'HELD'` (the release also
on `expires_at < now()`, returning the units in the same transaction), and
exactly one matches. `RELEASED` is terminal and the sweeper never touches a
`COMMITTED` row; a repeated commit that matches nothing reads the row, where
`COMMITTED` means success and `RELEASED` means expired. If the sweeper won,
the order service voids the authorization and cancels the order ("sold out
while payment was pending"); reserving again would hit the saga's late-reserve
guard, and at a 10-minute TTL expiries should be near zero. The state column
does the job of a fencing token from
[distributed locks](/systems-and-infrastructure/distributed-locks), at no
extra cost on a single-primary database.

**Hot items.** Every reservation for one SKU updates one row, about a
millisecond each, so a row manages several hundred reservations a second, far
more than an ordinary bestseller sees. Thousands arriving in the same second
for a few hundred units is the ticket-booking case study's subject.

## Deep dive: the checkout saga

Placing an order records the order, reserves stock and authorizes the card:
all three, or none.

**Why not one transaction across all three?** **Two-phase commit** (2PC) has a
coordinator ask every participant to **prepare** (do the work, hold its locks,
promise it can commit), and only when all say yes tells them to commit. It
fails here twice. The payment service and the card networks behind it offer an
HTTP API, not a prepare/commit protocol. And the inventory row would stay
locked from prepare until commit, which waits for payment at about 2 seconds:
one SKU could sell at most 0.5 orders a second, where a reservation holds the
row for about a millisecond. A coordinator that crashes after prepare also
leaves every participant holding its locks.

A **saga** gives up that all-at-once guarantee: each step is its own local
transaction, paired with a **compensation** that undoes it, run in reverse if
a later step fails ([saga pattern](/systems-and-infrastructure/saga-pattern)):

| Step | Service   | Action                            | Compensation                  |
| ---- | --------- | --------------------------------- | ----------------------------- |
| 1    | Order     | Insert order as `PENDING`         | Mark it `CANCELLED`           |
| 2    | Inventory | Reserve every line (`HELD`)       | Release the reservations      |
| 3    | Payment   | Authorize the total               | Void the authorization        |
| 4    | Inventory | Commit the reservations           | (none: see below)             |
| 5    | Order     | Mark `CONFIRMED`, outbox an event | (a later cancel, not an undo) |

Once payment is authorized, the saga only goes forward: if the inventory
service is down at step 4, the order service retries the commit until it
succeeds (the TTL leaves room) rather than unwinding an authorized order. The
one way back is a lease that expired first, and then the order is cancelled
and its authorization voided. A customer cancelling a confirmed order later is
a new business action (void or refund, return the units), not a compensation.
The saga's price is visible middle states: between steps 2 and 3 another
shopper may briefly see "Only 1 left" where there were 2, the 170 early "out
of stock" answers a day counted above.

![Sequence of one checkout through the saga, order o_5521. The client sends POST /orders with its idempotency key to the order service, which inserts the order as PENDING with the key, asks the inventory service to reserve the lines with a 10-minute TTL, gets back reserved, and records RESERVED. It then asks the payment service to authorize $81.20 with key o_5521:auth-1. If payment is approved, the payment service returns an authorization ID, the order service records AUTHORIZED, asks the inventory service to commit the reservation, records CONFIRMED with an OrderConfirmed outbox row, answers the client 201 with status CONFIRMED, and the outbox relay later publishes OrderConfirmed to the event stream. If payment is declined, the order service records CANCELLING, asks the inventory service to release the reservation, gets back released, records CANCELLED with an OrderCancelled outbox row, answers the client 422 payment declined, and the relay later publishes OrderCancelled.](/diagrams/ecommerce-checkout/checkout-saga.svg)

**Orchestration or choreography.** In **choreography**, each service reacts to
the previous one's event (`OrderCreated`, `StockReserved`, `PaymentAuthorized`
or `PaymentDeclined`) and no one is in charge. But the flow then exists only
as four services' event handlers: "why is o_5521 stuck?" means reading three
services' logs, each hop adds the stream's delay to the 3-second budget, and
the payment service, owned by another team, would have to know about stock. In
**orchestration**, one component calls each step and decides what's next: the
flow is in one place and the payment service keeps a plain "authorize this"
API, at the cost of one more thing every order depends on.

This design orchestrates, from the order service: the flow is short, has one
owner and a hard latency budget. The orchestrator's memory is the order row:
`status` records the last completed step, so the order's **state machine** and
the saga's progress are the same thing.

```text
Forward:   PENDING ─▶ RESERVED ─▶ AUTHORIZED ─▶ CONFIRMED ─▶ SHIPPED ─▶ DELIVERED

Undo:      PENDING    ── out of stock ───────────────▶ CANCELLING ─▶ CANCELLED
           RESERVED   ── payment declined ───────────▶ CANCELLING
           AUTHORIZED ── reservation expired ────────▶ CANCELLING
           CONFIRMED  ── customer cancels ───────────▶ CANCELLING
```

`CANCELLING` means compensations are running, so a crash while undoing is
resumed like a crash while doing. `DELIVERED` and `CANCELLED` are terminal.
Every transition is one conditional update naming the status and `version` it
expects (`WHERE status = 'RESERVED' AND version = 3`); if it matches no row,
someone else moved the order on, and this worker stops.

**Surviving crashes.** Each step is recorded only after its call returns, and
each call is safe to repeat: a reserve that finds its `(order_id, sku)` row already `HELD` reports success without adding to `reserved` again, the
authorization carries the key `o_5521:auth-1`, and commits and releases are
conditional on state. A **recovery sweeper** in the order service finds orders
in a non-final state not updated for 30 seconds and repeats the next step from
the recorded state. The crash to get right is one while waiting for payment:
the sweeper repeats the authorization with the same key, and the payment
service returns the first attempt's result instead of authorizing again. The
sweeper and a slow original request can work one order at once without a
lock, because repeated calls return identical results and the conditional
update lets only one record each transition.

One ordering problem needs its own guard: a reserve that timed out may reach
the inventory service after the order service gave up and sent a release,
which found nothing; the late reserve would then hold stock for a cancelled
order until its TTL. So a release with no reservation writes a `RELEASED` row
anyway, and a reserve that finds a `RELEASED` row for its order refuses.

A [workflow engine](/systems-and-infrastructure/workflow-engines) would record
each step durably and handle resumption, retries and timers for us. It wins
once the flow grows branches (split payments, gift cards, pre-orders that wait
weeks for stock); for five steps whose state already lives in the order row, a
status column and a sweeper are less to run.

## Deep dive: idempotency and order events

**One press, one order.** "Place order" gets sent twice by a double click, a
phone that retries after losing signal, or a shopper pressing again because
nothing seemed to happen. Three defences:

- **Disabling the button** stops the double click, but not a retry by the
  network layer or the app after a timeout, where the first request arrived
  and only the response was lost.
- **Deduplicating by content** (refuse an order identical to one from the last
  few minutes) catches retries but refuses a shopper who meant to order the
  same thing twice, and needs a rule for "identical".
- **An idempotency key** generated once per checkout and sent with every
  attempt, which [idempotency](/systems-and-infrastructure/idempotency) covers
  in general.

This design uses the key, and disables the button too. The server looks the
key up among the user's orders before recomputing anything, because a retry
must get the first attempt's answer even if a price has changed since. A new
key goes into the step-1 order insert, and the unique index on
`(user_id, idempotency_key)` makes the second of two simultaneous first
attempts fail. Either way the server returns the existing order's current
state: `CONFIRMED`, `CANCELLED`, or `PENDING` for the client to poll. Because
the order and its key are inserted in one transaction, neither exists without
the other: a crash before the commit leaves nothing and the retry creates the
order; a crash after it leaves an order the retry finds. The key costs about
36 bytes a row and no separate store. The same key with a different body
(another address or card) gets `422` rather than a guess.

**One order, one charge.** The order service retries the payment call after a
timeout too, so every authorization carries a key made from the order ID and
an attempt number, `o_5521:auth-1`, and the payment service promises one
authorization per key. A timeout is ambiguous, so a retry always reuses the
key. A decline cancels the order, so trying another card is a new checkout
with a new idempotency key and its own authorization key; the attempt number
stays at 1 here, and is in the key so a later flow retrying within one order
could take a fresh one.

What can still double: two tabs on two review pages have two keys, and
pressing both creates two orders. To the server those are two intents; the
order page shows a "you placed a similar order two minutes ago" notice rather
than blocking it.

**Telling everyone else.** A confirmed order must reach the warehouse, the
confirmation email and the cart. Writing the order and then publishing as a
separate step is a dual write: a crash between the two confirms an order the
warehouse never hears of. The
[outbox pattern](/systems-and-infrastructure/outbox-pattern) closes that gap:
`OrderConfirmed` is an `outbox` row inserted in the transaction that sets
`CONFIRMED`, and a relay publishes rows whose `published_at` is empty, then
sets it, keyed by order ID so an order's events stay in order.

A relay crash between publishing and setting `published_at` publishes again,
so delivery is at least once and each consumer deduplicates on `event_id`. The
cart service removes the order's lines (each SKU's quantity reduced by what
was ordered), not the whole cart, so items added in another tab survive, and
records the event ID in `applied_event_ids` in the same conditional write. The
email consumer records the IDs it has sent for, but sending and recording are
two writes, so a crash between them sends twice. The
[notification system](/system-design/notification-system) takes the event ID
as its idempotency key, which narrows that gap but can't close it: the email
provider may have sent a message whose answer was lost.

A consumer that keeps failing on one event (a malformed address the warehouse
rejects) moves it to a
[dead-letter queue](/systems-and-infrastructure/dead-letter-queue) after a few
retries and carries on. The stream is the
[message queue](/systems-and-infrastructure/message-queues) that lets the
warehouse be down for an hour without checkout noticing: at 3,500 events a
second at peak and about 1 KB each, an hour's backlog is about 12.6 GB, well
inside a log sized for 30 GB a day.

## Failure modes and bottlenecks

**The payment service is slow or down.** Authorizations time out after 10
seconds and are retried with the same key. If failures pile up, a
[circuit breaker](/systems-and-infrastructure/circuit-breaker) in the order
service stops new authorizations for a while, and new orders get
`503 Service Unavailable` before stock is reserved. Orders already
mid-payment stay `RESERVED` while the sweeper asks for their key's result with
[exponential backoff](/systems-and-infrastructure/exponential-backoff); an
answer later than the 10-minute TTL may find the reservation expired, and the
order is cancelled and its authorization voided.

**The inventory service is down.** New orders fail with `503`. Authorized
orders wait at step 4 while the sweeper retries the commit; an outage longer
than the TTL expires their reservations, and they are cancelled and voided.

**A compensation keeps failing.** A void the payment service keeps rejecting
leaves the order `CANCELLING`, and after retries it goes to a person. An
authorization never captured lapses on its own after some days (the limit
depends on the card network), but a human looks well before that.

**An order database shard fails.** Its up-to-date copy is promoted; that
shard's users can't order for the tens of seconds it takes, the other 15
shards are unaffected, and the sweeper resumes interrupted sagas.

**The outbox relay stops.** Orders still confirm; emails and picking lag while
the outbox grows by 12.6 GB an hour at peak. The age of the oldest unpublished
row is the alarm.

**A cache node is lost.** Its products fall through to the replicas. Many
simultaneous misses on one popular product are a
[thundering herd](/systems-and-infrastructure/thundering-herd-problem), so one
request per key refills the cache while the others wait.

**Bots at a sale** race to the reservation step; per-account and per-IP limits
at the API gateway blunt them.

**Knowing it's happening.** Watch place-order p99 split by step, cancellations
by reason, orders in a non-final state older than a minute, reservations
expired by the sweeper (near zero), payment timeouts and outbox lag
([observability](/systems-and-infrastructure/observability)).

## Trade-offs

- **Reserving before payment** turns "sold you something we don't have" into
  an ordinary "out of stock" before the card is touched, at the cost of a
  second inventory write per line and about 170 shoppers a day turned away by
  a unit held for someone whose card was then declined.
- **A saga over two-phase commit.** The payment service couldn't take part in
  2PC anyway, and 2PC would have locked each SKU for a payment call. The price
  is visible in-between states and a compensation per step, each made safe to
  repeat.
- **Orchestrating from the order service** gives one place to debug the flow
  and keeps the payment API plain, but every checkout depends on the order
  service.
- **Keys on the order row** instead of a separate idempotency store: one
  transaction covers the key and the order, so they can't disagree. Two tabs
  can still produce two orders.
- **The outbox** gets every confirmed order to the warehouse and the email
  pipeline across crashes, but only at least once, so every consumer
  deduplicates by event ID.
- **A minute of staleness on product pages** lets 95% of reads come from
  memory, affordable because the price charged is always recomputed from the
  catalog's primary and checked against what the shopper saw.

What would change the design: selling scarce items in bursts, where fairness
becomes a requirement, which is where ticket booking picks up. Outside sellers
would split one order into several shipments with their own stock, and the
saga would grow a step per seller, the point at which a workflow engine earns
its place.
