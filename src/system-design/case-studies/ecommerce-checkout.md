---
title: Design an E-Commerce Checkout (like Amazon)
summary: Getting from a cart to a placed order across inventory, payment and order services, with stock reservations that expire, a saga that undoes what it started, and idempotency keys so a double click never charges twice.
date: 2026-09-28
order: 9
---

An online store looks like one application to the shopper: browse a product,
add it to the cart, press "Place order", get a confirmation. Behind that last
button sit at least three separate systems that each own part of the answer.
The **inventory service** knows how many of each item are in stock. The
**payment service** talks to the card networks and banks and knows whether the
customer's card will pay. The **order service** records what was bought, at
what price, and where it goes. Placing one order means changing all three, and
any of them can fail, time out, or answer twice.

That is what makes checkout a good design exercise. Browsing is a read-heavy
caching problem of the kind the [URL shortener](/system-design/url-shortener)
already works through, and it gets a short treatment here. The hard part is a
write that spans services that don't share a database, where getting it wrong
means charging someone for an item that isn't there, or charging them twice.
What follows is one plausible design for a large online store like Amazon, not
a description of how any particular company built theirs.

A few words recur throughout. A **SKU** (stock keeping unit) is one specific
sellable item, such as "blue kettle, 1.7 litres": the thing inventory is
counted in. A card payment usually happens in two stages: an
**authorization** asks the customer's bank to set the amount aside, and a
**capture**, often days later when the item ships, actually moves the money.
An authorization that is no longer wanted can be **voided**, which releases
the held amount without the customer ever being charged.

## Requirements

Functional requirements say what the system does:

- **Browse products.** A product page shows the description, pictures, the
  current price and a rough availability ("In stock", "Only 3 left", "Out of
  stock").
- **Cart.** A shopper can add, change and remove items. A signed-in shopper's
  cart follows them across devices. A guest (not signed in) also has a cart,
  and when the guest signs in, the guest cart is merged into their account's
  cart.
- **Checkout review.** Before paying, the shopper sees the final line prices,
  shipping, tax and total, all computed by the server.
- **Place order.** One press of "Place order" either produces a confirmed
  order with the card authorized for exactly the total the shopper saw, or a
  clear failure (out of stock, payment declined, price changed) with nothing
  charged and nothing held.
- **Order status.** The shopper can see an order's state and cancel it before
  it ships.
- **Order events.** Other systems (confirmation email, the warehouse,
  analytics) learn about every confirmed, cancelled and shipped order.

Out of scope: product search and recommendations; the payment service's
internals, its ledger of money movements and refunds (a later case study
covers payments); warehouses, picking and shipping; returns; promotions and
coupon rules beyond "the server applies them"; fraud checks; and sellers
other than the store itself. Contention for scarce items, where thousands of
people fight over a few hundred units in the same second (concert tickets, a
limited sneaker release), is a different problem, and a later case study on
ticket booking takes it on. This design is for ordinary retail, where most
items have more stock than anyone is trying to buy at once.

Non-functional requirements, with numbers:

- **Scale.** 50 million daily active shoppers, 100 million SKUs, 1 billion
  product page views a day, 20 million cart changes a day, and 10 million
  orders a day averaging 2.5 SKUs (**lines**) each.
- **Latency**, at the 99th percentile (p99, the time 99% of requests beat):
  a product page's data under 100 ms; a cart change under 200 ms; placing an
  order under 3 seconds, most of which is the payment authorization, which
  this design doesn't control.
- **Availability.** Browsing and the cart 99.99%; placing orders 99.95% for
  the parts this design runs. When the payment service is down, new orders
  fail cleanly with `503` rather than hang, and orders already waiting on
  payment hold their stock for at most the 10-minute reservation TTL.
- **Correctness.** A customer is never charged twice for one order, and never
  charged for an order that doesn't exist. The authorized amount is exactly
  the total shown on the review page, or the order is refused. Confirmed
  orders later cancelled for lack of stock stay below 1 in 10,000, a target
  the inventory deep dive puts numbers against.
- **Staleness.** A product page may show a price or availability up to a
  minute old. The price charged is never taken from that page.

## Back-of-the-envelope estimates

The estimates use two rules of thumb from
[numbers every engineer should know](/engineering-practices/numbers-every-engineer-should-know):
a day is 86,400 seconds, and plan for a peak of about ten times the average.
Figures are rounded, and the rounding is said where it happens.

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

**Catalog storage.** 100 million products at about 10 KB each (title,
description, attributes, image addresses; the images themselves live in
object storage) is **1 TB**.

**Catalog cache.** Assume, as is typical of retail, that the most-viewed 10%
of products (10 million) take about 95% of page views. Caching those:
10,000,000 × 10 KB = **100 GB**, spread over several cache servers. At a 95%
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

What the estimates say: the catalog is a caching problem at 120,000 reads a
second; the cart is small; and the order path, at 1,200 orders a second, is
modest in volume but touches three services per order and a payment call that
takes a second or two. Design effort goes to that path.

## Data model

Each service owns its data, and no service reads another's database. That
rule is what makes checkout a distributed problem in the first place: the
order, the stock count and the payment live in different stores, so no single
database transaction can cover all three.

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

Money is stored as an integer count of the smallest unit (cents), never as a
floating-point number, because binary floating point can't represent 0.10
exactly and rounding errors add up across millions of orders.

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

`price_seen_cents` is there only to tell the shopper "the price dropped since
you added this". Checkout never charges it. The two ID lists make a repeated
merge or order event harmless, as the cart and idempotency deep dives explain;
entries older than 30 days, the guest-cart lifetime, are dropped.

**Inventory** (a relational database, split by SKU into four independent
parts called **shards**, each with its own **primary**, the one server that
takes that shard's writes; four shards put about 2,250 of the peak 9,000
writes a second on each, short single-row transactions that leave one primary
room for bursts above the planned peak, and a fifth shard can be split off if
they don't):

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

Sharding by user puts "my orders" in one shard and lets the uniqueness of
`(user_id, idempotency_key)` be enforced by an ordinary unique index on that
shard, no cross-shard check needed. At 4,800 transactions a second at peak,
16 shards take about 300 each, and two years of orders come to about 2.3 TB
per shard, both comfortably inside what one relational primary handles.

Why relational for inventory and orders, when the URL shortener chose a
key-value store? Both need **conditional updates** that check one or more
columns and change others in the same step ("reserve 2 units only if at least
2 are available", "move to CONFIRMED only if the status is still
AUTHORIZED"), and transactions that write several rows together (an order,
its lines and its outbox event). A single-primary relational database does
both cheaply. [SQL vs. NoSQL](/systems-and-infrastructure/sql-vs-nosql) covers
the general trade. The cart has none of those needs: it is read and written
whole, by one key.

## API design

**Product page**

```http
GET /products/p_7731
```

Returns the product content, a display price and an availability hint. The
response is built from caches and may be up to a minute old.

**Cart**

```http
GET    /cart
PUT    /cart/items/sku_kettle_blue      { "quantity": 2, "cart_version": 14 }
DELETE /cart/items/sku_kettle_blue?cart_version=15
```

The cart is found from the session: a signed-in user's ID, or a guest cart ID
kept in a cookie. `cart_version` makes a write conditional on the cart not
having changed since the client last read it; a mismatch returns
`409 Conflict` with the current cart. Merging a guest cart happens inside
sign-in, not through its own endpoint.

**Checkout review (a quote)**

```http
POST /checkout/quote
{ "cart_version": 16, "address_id": "addr_2", "shipping": "standard" }

200 OK
{ "lines": [ { "sku": "sku_kettle_blue", "quantity": 2, "unit_price_cents": 3499 } ],
  "subtotal_cents": 6998, "shipping_cents": 499, "tax_cents": 623,
  "total_cents": 8120 }
```

Everything in the quote is computed on the server from the authoritative
price table (read from the catalog's primary, not the cache), the shipping
address and each product's tax category. Nothing the browser sends about money
is trusted: a client can be edited, and a price in a request is just a
number someone typed.

**Place order**

```http
POST /orders
Idempotency-Key: 5b0e2c1a-8d7f-4f3e-9a61-2c4d7e9b1f03

{ "cart_version": 16, "address_id": "addr_2", "shipping": "standard",
  "payment_method_id": "pm_visa_4242", "expected_total_cents": 8120 }
```

An **idempotency key** is a unique string the client generates once per
intent to buy (when the review page loads) and sends with every attempt at
that request, so the server can recognize a retry of a request it has already
seen; the idempotency deep dive covers it. `expected_total_cents` is the total
the shopper saw. The server recomputes the total, and if it differs (a price
changed in between), refuses rather than charging a different amount.

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

- The **CDN** (content delivery network) is a set of caching servers close to
  shoppers that serves product images, scripts and style sheets, so none of
  that traffic reaches the servers behind it.
- The **API gateway** receives every API call and sends it to the right
  service. It is a reverse proxy in the sense
  [forward vs. reverse proxy](/systems-and-infrastructure/forward-vs-reverse-proxy)
  describes, and it also spreads requests across each service's identical
  servers (the job of a **load balancer**), checks the session, and applies
  per-client rate limits of the kind the
  [rate limiter](/system-design/rate-limiter) case study builds.
- The **catalog service** answers product pages from the **catalog cache**
  (an in-memory key-value store), falling back to read-only copies of the
  catalog database.
- The **cart service** keeps carts in its key-value store.
- The **order service** computes quotes, and for each order runs the checkout
  steps in order: it is the **orchestrator** of the checkout. It stores each
  order's progress in the **order database**, along with an **outbox** table
  of events waiting to be published.
- The **inventory service** holds stock counts and reservations.
- The **payment service** authorizes, captures and voids card payments. Here
  it is a black box that accepts its own idempotency keys.
- The **order event stream** is a durable, ordered log of order events
  (Kafka is a common choice for this kind of log), fed by an **outbox relay**
  and read by the cart service, the confirmation email (sent through a
  notification system like the one in the
  [notification system](/system-design/notification-system) case study) and
  fulfilment.

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
   items from the cart,
   the email goes out and the warehouse starts picking.

If step 3 or 4 fails, the order service undoes what earlier steps did. That
sequence of steps, each with an undo, is a saga, and the checkout deep dive is
about it.

## Deep dive: the catalog read path

The catalog takes 120,000 reads a second at peak, and each needs to come back
in under 100 ms. The data changes rarely: a product's description or photos
change perhaps a few times a year, while its price and stock move far more
often. Three ways to serve it:

**Read replicas alone.** Send every page read to read-only copies of the
catalog database. [Read replicas](/systems-and-infrastructure/read-replicas)
scale reads by adding copies, but at 120,000 reads a second that means a large
fleet of database servers doing work a cache does more cheaply, and every page
pays a database query's latency.

**A cache in front, filled on a miss.** The catalog service looks in the
cache, and on a miss reads a replica and stores the result with a **TTL**
(time to live: how long the cache keeps an entry before discarding it). The
100 GB of hot products from the estimates gives a 95% hit rate, leaving 6,000
reads a second for the replicas, a handful of servers.
[Caching](/systems-and-infrastructure/caching) covers how hit rate follows
from what's cached and how it's evicted.

**A precomputed read model.** Render each product into one ready-to-serve
document (content, price, availability) in a separate store, updated whenever
any source changes: the read/write split of
[CQRS](/systems-and-infrastructure/cqrs). Reads become one key lookup, but
every price or stock change now rewrites a 10 KB document, and a product page
is only as fresh as the pipeline that rebuilds it.

This design uses the cache, with the content and the fast-changing parts kept
apart. Product content is cached for 10 minutes. Price and availability are
separate, small entries cached for 60 seconds, which is where the "up to a
minute old" in the requirements comes from. Availability is cached as a
bucket ("in stock", "only 3 left", "out of stock") rather than an exact count,
so it only needs refreshing when the bucket changes.

When a merchandiser edits a product, the catalog database commits the change
together with an outbox row in the same transaction, and a relay deletes the
cache entry from that row. Deleting the entry straight after the commit would
be a second, separate write, lost if the process died between the two; the
outbox makes the delete survive a crash, and the TTL covers anything that
still slips through. [Cache invalidation](/systems-and-infrastructure/cache-invalidation)
explains why deleting beats rewriting here.

Staleness is safe because nothing on this path decides money. The price on
the product page is a display; the quote and the order read prices from the
catalog's primary. If a price rose since the shopper saw it, the review page
shows the new one, and `expected_total_cents` stops an order at a total the
shopper didn't see.

## Deep dive: the cart and merging a guest cart

**Where the cart lives.** The cheapest place is the client: keep the cart in
the browser's local storage or a cookie, and the servers store nothing. It
fails the requirements, though. A cart in one browser doesn't follow the
shopper to their phone, clearing site data loses it, and cookies are limited
to about 4 KB each. Keeping every cart on the server, in a key-value store
keyed by cart ID, costs the 200 GB and 2,300 writes a second from the
estimates, which is small, and makes the cart the same on every device. That
is the choice here. A guest gets a random cart ID in a cookie; a signed-in
shopper's cart is keyed by their user ID.

**Adding to the cart doesn't hold stock.** Most carts never become orders, and
100 million carts holding units would leave shelves looking empty while the
stock sat in abandoned carts. Stock is held only once "Place order" is
pressed, as the next deep dive explains.

**Two devices writing at once.** A shopper changes the quantity on a laptop
while the phone, with an older copy, removes an item. With a plain overwrite,
whichever write lands second silently undoes the first. Each write carries
the `version` it read, and the store applies it only if the version is still
current, incrementing it; otherwise the client gets `409` and the current
cart, and reapplies its change. This is optimistic locking, as
[optimistic vs. pessimistic locking](/systems-and-infrastructure/optimistic-vs-pessimistic-locking)
describes, and it suits a cart because conflicts are rare: one shopper, a few
devices.

**Merging at sign-in.** A shopper who added a kettle to their account's cart
on a laptop yesterday browses as a guest on their phone today, adds a kettle
and a teapot, and signs in. There are two carts, and three ways to combine
them:

- **Keep the account cart** and drop the guest cart. The teapot the shopper
  added a minute ago disappears, the worst surprise of the three.
- **Sum the quantities.** Kettle 2, teapot 1. The shopper who added the same
  kettle on two devices meant one kettle, and now may buy two without
  noticing.
- **Union, taking the larger quantity for SKUs in both.** Kettle 1, teapot 1.

This design takes the union with the larger quantity, and tells the shopper
"items from your earlier visit were added to your cart". The merge is two
writes to two records (write the merged account cart, then delete the guest
cart), and a crash between them leaves the guest cart behind for the next
sign-in to find. Merging it again isn't safe on its own: if the shopper has
since removed the teapot, a second merge puts it back, and with "sum" every
item would double. So the write to the account cart also adds the guest cart's
ID to `merged_guest_ids`, and a merge that finds the ID already there skips
straight to deleting the guest cart. The write to the account cart is conditional on its version
like any other cart write, so a merge racing a change from another device
retries rather than overwriting it.

## Deep dive: reserving inventory

When the order is placed, something has to make sure the units the customer
is buying are still there and aren't also sold to someone else. The problem
is a race: two customers buying the last kettle both see "1 available" and
both succeed, the kind of check-then-act bug
[race conditions](/systems-and-infrastructure/race-conditions) describes.
There are three common answers, and they differ in how often an order fails
and at which moment.

To compare them with numbers, assume that 100,000 times a day some SKU's
available stock reaches zero (a **sell-out**), and that at that moment orders
for it arrive at about one a minute. An order fails whenever it arrives inside
the window between the stock actually reaching zero and the system refusing
new orders for it, so each sell-out causes, on average, arrival rate × window
failed orders.

**Oversell and apologize.** Accept any order the product page's availability
allows, decrement the count afterwards, and let it go negative. When it does,
cancel the extra orders and email an apology. The window is the age of the
cached availability, up to 60 seconds, 30 on average: (1 ÷ 60) × 30 = 0.5
failed orders per sell-out, so 100,000 × 0.5 = **50,000 confirmed orders a day
cancelled afterwards**, 0.5% of all orders. It is simple and never slows
checkout, but it misses the 1-in-10,000 target by a factor of fifty, and each
failure reaches a customer who already has a confirmation email.

**Check, then decrement after payment.** At "Place order", check the live
count, authorize the payment, then decrement. The window is now the payment
authorization, about 2 seconds: (1 ÷ 60) × 2 ≈ 0.033 per sell-out, so about
**3,300 orders a day** where the card was authorized and the decrement then
found nothing left, 0.03% of orders. They fail before a confirmation is sent,
so they don't count against the 1-in-10,000 target, but every one leaves a
card authorization to void. A voided authorization costs the
customer nothing, but depending on their bank it can show on their statement
as a pending charge for several days, which reads as "they charged me for
something they didn't send".

**Reserve before payment, with a TTL.** At "Place order", before any payment,
reserve the units in one conditional statement:

```sql
UPDATE stock SET reserved = reserved + 2
WHERE sku = 'sku_kettle_blue' AND on_hand - reserved >= 2;
-- and, in the same transaction:
INSERT INTO reservations (order_id, sku, quantity, state, expires_at)
VALUES ('o_5521', 'sku_kettle_blue', 2, 'HELD', now() + interval '10 minutes');
```

If the update matches no row, there isn't enough stock and the order fails
straight away, before anything is charged. Two orders racing for the last unit
can't both succeed, because the database applies the two updates one after
the other and the second finds nothing left. After payment is authorized, the
reservation moves from `HELD` to `COMMITTED`; if payment fails, it is
`RELEASED` and `reserved` drops by 2 again. A `COMMITTED` reservation ends when
the item ships (`on_hand` and `reserved` both drop) or when the customer
cancels before shipping (`reserved` drops and the row becomes `RELEASED`).

An order's lines can sit on different inventory shards, so the inventory
service reserves them one at a time, and if any line fails it releases the
lines it already reserved for that order before answering "out of stock".

No order fails after payment for lack of stock. The cost moves elsewhere: a
unit held by an order whose payment is then declined is unavailable to others
for those 2 seconds. Assuming 5% of authorizations are declined, that turns
away about 100,000 × 0.05 × (1 ÷ 60) × 2 ≈ **170 shoppers a day** with "out of
stock" who would have succeeded a few seconds later, and the page tells them
to try again shortly. It also costs a second write per line (commit or
release) before the third at shipping, which together make the 9,000 inventory
writes a second in the estimates.

The one kind of oversell this can't prevent is a count that was wrong to
begin with: a unit dropped, miscounted or stolen in the warehouse. That still
needs the apologize path, but at the warehouse's error rate, not the design's.

**This design reserves before payment.** The failures it keeps happen before
the customer is charged and are shown as an ordinary "out of stock", and the
confirmed-then-cancelled rate falls to what the warehouse's counting errors
cause, which is how the 1-in-10,000 target is meant to be met.

**The TTL, and what it guards against.** The `expires_at` on a `HELD`
reservation is a **lease**: a claim that lapses on its own if its holder never
comes back. A normal checkout commits or releases its reservation within
seconds. The TTL is for the order that crashes halfway and is never resumed
(a bug, say): without it, those units would be held forever. A sweeper in the
inventory service releases `HELD` reservations past their expiry.

Ten minutes is long enough to outlast any normal checkout, including a slow
payment retried a few times, and short enough that a stuck unit comes back
before much sales time is lost. The lease can still expire while its holder is
alive: the order service might stall for 11 minutes on a payment that
eventually succeeds. Both the commit and the sweeper's release are therefore
conditional on the reservation's state, in the inventory database:

```sql
-- commit (order service, after payment is authorized)
UPDATE reservations SET state = 'COMMITTED'
WHERE order_id = 'o_5521' AND sku = 'sku_kettle_blue' AND state = 'HELD';

-- expire (sweeper), which also returns the units, in one transaction
UPDATE reservations SET state = 'RELEASED'
WHERE order_id = 'o_5521' AND sku = 'sku_kettle_blue'
  AND state = 'HELD' AND expires_at < now();
```

Exactly one of them matches. If the sweeper won, the commit reports
"expired", and the order service voids the authorization and cancels the order;
the shopper is told the item sold out while payment was pending. Reserving
again is tempting, but the released row still holds the `(order_id, sku)` key,
and the late-reserve guard in the saga deep dive refuses exactly that, so a
second try would need an attempt number in the key. With a 10-minute TTL,
expiries should be close to zero, and cancelling keeps the rule simple. The
state column does the
job that a fencing token does for the leases described in
[distributed locks](/systems-and-infrastructure/distributed-locks), and on a
single-primary database the check costs nothing extra. `RELEASED` is
terminal, and the sweeper never touches a `COMMITTED` row. A repeated commit
that matches nothing reads the row: already `COMMITTED` means success,
`RELEASED` means expired.

**Hot items.** Every reservation for one SKU updates the same row, so a SKU's
reservations run one after another. Each takes about a millisecond, so one
row manages several hundred reservations a second, far more than an ordinary
bestseller sees. A launch where thousands arrive in the same second for a few
hundred units needs queueing and holds of a different kind, which is the
ticket-booking case study's subject.

## Deep dive: the checkout saga

Placing an order changes three services: the order is recorded, stock is
reserved, and the card is authorized. They all have to happen, or none of them.

**Why not one transaction across all three?** **Two-phase commit** (2PC) is
the classic protocol for that: a coordinator asks every participant to
**prepare** (do the work, hold its locks, and promise it can commit), and only
when all have said yes tells them all to commit. It fails this design twice.
The payment service, and the card networks behind it, don't take part in a
prepare/commit protocol run by our coordinator; they offer an HTTP API.
And even if it could, the inventory row would stay locked from its prepare
until the commit, which can't come before the slowest participant, payment at
about 2 seconds, has prepared too. One SKU could then sell at most one order
every 2 seconds, 0.5 a second, where the reservation above holds the row for
about a millisecond. A coordinator
that crashes after the prepare leaves every participant holding its locks
until it recovers.

A **saga** gives up that all-at-once guarantee. It runs each step as its own
local transaction and pairs each with a **compensation** that undoes it, run
in reverse order if a later step fails.
[Saga pattern](/systems-and-infrastructure/saga-pattern) covers the idea; the
checkout's steps are:

| Step | Service   | Action                            | Compensation                  |
| ---- | --------- | --------------------------------- | ----------------------------- |
| 1    | Order     | Insert order as `PENDING`         | Mark it `CANCELLED`           |
| 2    | Inventory | Reserve every line (`HELD`)       | Release the reservations      |
| 3    | Payment   | Authorize the total               | Void the authorization        |
| 4    | Inventory | Commit the reservations           | (none: see below)             |
| 5    | Order     | Mark `CONFIRMED`, outbox an event | (a later cancel, not an undo) |

Step 4 is where the saga stops being able to go backwards on its own. Once
payment is authorized and the stock committed, the saga only goes forward: if
the inventory service is down at step 4, the order service retries the commit
until it succeeds (the reservation is still held, and the TTL is long enough
for that), rather than unwinding an authorized order. The one way back is a
lease that expired first: the commit then reports "expired", and the order is
cancelled and its authorization voided. A customer cancelling a
confirmed order later is a new business action (void or refund, return the
units to stock), not a compensation.

The price of a saga is that its middle states are visible. Between steps 2 and
3, units are reserved for an order that may never be paid, so another shopper
may briefly see "Only 1 left" where there were 2. The inventory deep dive
counted what that costs: about 170 early "out of stock" answers a day.

![Sequence of one checkout through the saga, order o_5521. The client sends POST /orders with its idempotency key to the order service, which inserts the order as PENDING with the key, asks the inventory service to reserve the lines with a 10-minute TTL, gets back reserved, and records RESERVED. It then asks the payment service to authorize $81.20 with key o_5521:auth-1. If payment is approved, the payment service returns an authorization ID, the order service records AUTHORIZED, asks the inventory service to commit the reservation, records CONFIRMED with an OrderConfirmed outbox row, answers the client 201 with status CONFIRMED, and the outbox relay later publishes OrderConfirmed to the event stream. If payment is declined, the order service records CANCELLING, asks the inventory service to release the reservation, gets back released, records CANCELLED with an OrderCancelled outbox row, answers the client 422 payment declined, and the relay later publishes OrderCancelled.](/diagrams/ecommerce-checkout/checkout-saga.svg)

**Orchestration or choreography.** There are two ways to drive the steps.

In **choreography**, no one is in charge: each service reacts to the previous
one's event. The order service publishes `OrderCreated`; the inventory service
consumes it, reserves, and publishes `StockReserved`; the payment service
consumes that, authorizes, and publishes `PaymentAuthorized` or
`PaymentDeclined`; the inventory service consumes `PaymentDeclined` and
releases. No central component is needed, but the checkout flow exists only as
the sum of four services' event handlers. Answering "why is order o_5521 stuck?"
means reading three services' logs, each hop adds the event stream's delivery
delay to the 3-second budget, and the payment service, owned by another team,
would have to consume the store's order events and know about stock.

In **orchestration**, one component calls each step and decides what happens
next. The flow is in one place, the payment service keeps a plain
"authorize this" API, and the cost is that the orchestrator becomes one more
thing every order depends on.

This design orchestrates, from the order service. The flow is short, it has
one owner, and it has a hard latency budget. The orchestrator's memory is the
order row itself: the `status` column records the last step that completed,
so the order's **state machine** and the saga's progress are the same thing.

```text
Forward:   PENDING ─▶ RESERVED ─▶ AUTHORIZED ─▶ CONFIRMED ─▶ SHIPPED ─▶ DELIVERED

Undo:      PENDING    ── out of stock ───────────────▶ CANCELLING ─▶ CANCELLED
           RESERVED   ── payment declined ───────────▶ CANCELLING
           AUTHORIZED ── reservation expired ────────▶ CANCELLING
           CONFIRMED  ── customer cancels ───────────▶ CANCELLING
```

`CANCELLING` is the state in which compensations are running; it exists so a
crash in the middle of undoing is resumed like a crash in the middle of doing.
`DELIVERED` and `CANCELLED` are terminal. Every transition is one conditional
update that names the state it expects:

```sql
UPDATE orders SET status = 'AUTHORIZED', payment_auth_id = 'au_77f',
                  version = version + 1, updated_at = now()
WHERE order_id = 'o_5521' AND status = 'RESERVED' AND version = 3;
```

If it matches no row, someone else already moved the order on, and this
worker stops.

**Crashes at every step.** The order service can die at any point, so each
step is recorded only after its call returns, and each call is safe to
repeat: reservations are keyed by `(order_id, sku)`, the payment authorization
carries the idempotency key `o_5521:auth-1`, and commits and releases are
conditional on state. A **recovery sweeper** in the order service looks every
few seconds for orders in a non-final state not updated for 30 seconds, and
resumes each one from its recorded state by repeating the next step.

- Crash before the order insert commits: nothing happened; the client's retry
  with the same idempotency key starts afresh.
- Crash after `PENDING`, before or after the reserve call: the sweeper repeats
  the reserve, which finds the existing `HELD` rows and reports success
  without reserving twice.
- Crash while waiting for payment: the sweeper repeats the authorization with
  the same key, and the payment service returns the first attempt's result
  rather than authorizing again.
- Crash after the commit, before `CONFIRMED` is recorded: the commit repeats
  as a no-op, and the order is confirmed.
- Crash during compensation: the order is in `CANCELLING`, and the sweeper
  repeats the release and the void, both harmless to repeat.

The sweeper and a slow original request can end up working on the same order
at once. No lock is needed to keep that safe, because every decision is a
function of results that repeated calls return identically (the same key gets
the same authorization answer), and the conditional update lets only one of
them record each transition.

One ordering problem needs a specific guard: a reserve call that times out
may still arrive at the inventory service after the order service has given
up and sent a release. The release finds nothing and does nothing; the late
reserve then holds stock for a cancelled order until its TTL. So a release
for an `(order_id, sku)` with no reservation writes a `RELEASED` row anyway,
and a reserve that finds a `RELEASED` row for its order refuses.

**A workflow engine instead?** A
[workflow engine](/systems-and-infrastructure/workflow-engines) would run this
orchestrator for us: it records each step's result durably, resumes after
crashes, and handles retries and timers. It is the better choice once the
flow grows branches (split payments, gift cards, pre-orders that wait weeks
for stock). For five steps whose state already lives in the order row, a
status column and a sweeper are less to run, and it is the choice here.

## Deep dive: idempotency and order events

**One press, one order.** "Place order" gets sent twice more often than one
might expect: a double click, a phone that loses signal and retries, a
shopper who presses again because nothing seemed to happen. Three ways to stop
the second press creating a second order:

- **Disable the button after the first press.** Worth doing, and it stops the
  double click. It does nothing for a request retried by the network layer or
  by the app after a timeout, where the first request did arrive and the
  response was lost.
- **Deduplicate by content**: refuse an order identical to one placed by the
  same user in the last few minutes. It catches retries, but also refuses the
  shopper who meant to order the same thing twice, and it needs a rule for
  "identical".
- **An idempotency key** generated by the client once per checkout and sent
  with every attempt, which [idempotency](/systems-and-infrastructure/idempotency)
  covers in general.

This design uses the key (and disables the button too). The server first looks
the key up among the user's orders, before recomputing anything, because a
retry must get the first attempt's answer even if a price has changed since.
If the key is new, the order insert in step 1 includes it, and the unique
index on `(user_id, idempotency_key)` makes the second of two simultaneous
first attempts fail. Either way the server ends up reading the existing order
and returning its current state: `CONFIRMED`, `CANCELLED`, or `PENDING` for a
checkout still in progress, which the client then polls. No separate key
store is needed; the key lives on the order, costing about 36 bytes a row. If
the same key arrives with a different body (another address, another card),
the server answers `422` instead of guessing which one was meant.

Because the insert of the order and the key is one transaction, there's no
moment where the key is recorded without its order or the other way round.
A crash before that commit leaves nothing, and the retry creates the order; a
crash after it leaves an order the retry finds.

**One order, one charge.** The client's key protects the order; the order
service needs the same protection one level down, because it too retries the
payment call after a timeout. Every authorization it sends carries a key made
from the order ID and an attempt number, `o_5521:auth-1`, and the payment
service promises one authorization per key. A timeout is ambiguous (the
authorization may or may not have happened), so the order service always
retries with the same key and never a new one. A decline cancels the order
and releases its stock, so trying another card is a new checkout: the review
page reloads with a new idempotency key, and the new order gets its own
authorization key. The attempt number therefore stays at 1 here; it is in the
key so that a later flow retrying within one order could take a fresh key
without reusing one.

What can still double: a shopper with two tabs open on two review pages gets
two keys, and pressing both creates two orders. That is two intents as far as
the server can tell; the order page shows a "you placed a similar order two
minutes ago" notice rather than blocking it.

**Telling everyone else.** When an order is confirmed, the warehouse must
start picking, the confirmation email must go out, and the ordered items must
leave the cart. Writing the order and then publishing to the event stream as a
separate step is a dual write: if the order service dies between the two, the
order is confirmed and the warehouse never hears of it. The
[outbox pattern](/systems-and-infrastructure/outbox-pattern) closes that gap:
the `OrderConfirmed` event is a row in the `outbox` table, inserted in the same
transaction that sets `CONFIRMED`, and a relay publishes rows whose
`published_at` is empty, then sets it.

A crash in the relay between publishing and setting `published_at` publishes
the event again, so delivery is at least once, and duplicates are expected.
Every event carries its `event_id`, and each consumer deduplicates on it. The
cart service removes the order's lines from the cart (each SKU's quantity
reduced by what was ordered), not the whole cart, so items added in another
tab since then survive; the same conditional write records the event ID in
the cart's `applied_event_ids`, and a duplicate that finds it there does
nothing. The email consumer records the IDs it has sent for, but sending and
recording are two writes, and a crash between them sends the email twice. The
[notification system](/system-design/notification-system) takes the event ID
as its own idempotency key, which narrows that gap; it can't close it, because
the email provider at the far end may have sent a message whose answer was
lost. The relay publishes each order's events keyed by order ID, so
an order's events stay in order within the stream.

Consumers that keep failing on one event (a malformed address the warehouse
system rejects, say) shouldn't hold up every order behind it. After a few
retries the event goes to a
[dead-letter queue](/systems-and-infrastructure/dead-letter-queue) for a
person to look at, and the consumer moves on. The stream itself is the
[message queue](/systems-and-infrastructure/message-queues) that lets the
warehouse be slow or down for an hour without the checkout noticing: at 3,500
events a second at peak and about 1 KB each, an hour's backlog is about
12.6 GB, which a log sized for 30 GB a day holds easily.

## Failure modes and bottlenecks

**The payment service is slow or down.** Authorizations time out after 10
seconds and are retried with the same key. If failures pile up, a
[circuit breaker](/systems-and-infrastructure/circuit-breaker) in the order
service stops sending new authorizations for a short while, and new orders
are refused with `503 Service Unavailable` before stock is reserved, so
nothing is held for orders that can't be paid. Orders already mid-payment stay
`RESERVED` and the sweeper keeps asking the payment service for the result of
their key, backing off between tries as
[exponential backoff](/systems-and-infrastructure/exponential-backoff)
describes. If an answer takes longer than the 10-minute TTL, the commit may
find the reservation expired, and the order is cancelled with the
authorization voided, as the inventory deep dive describes.

**The inventory service is down.** New orders can't reserve and fail with
`503`. Orders whose payment is already authorized wait at step 4, and the
sweeper retries the commit until it succeeds; their reservations are held
through the outage, up to the TTL. An outage longer than that lets the sweeper
expire them when the service returns, and those orders are cancelled with
their authorizations voided.

**A compensation keeps failing.** A void that the payment service rejects
again and again leaves the order in `CANCELLING`. After retries with backoff,
the order goes onto a queue for a person to resolve. The customer is not left
charged: an authorization that is never captured lapses on its own after some
days, the exact limit depending on the card network, but a human looks well
before that.

**An order database shard fails.** Each shard's primary has a copy kept up to
date that is promoted when the primary dies. Orders for the users on that
shard fail for the tens of seconds that takes, and the other 15 shards are
unaffected. Sagas interrupted by the failover are resumed by the sweeper from
their recorded state.

**The outbox relay stops.** Orders still confirm, because the relay isn't on
the checkout path. Emails and warehouse picking lag, and the outbox table
grows by 12.6 GB an hour at peak until the relay catches up. The age of the
oldest unpublished outbox row is the alarm.

**A cache node is lost.** The products it held miss and fall through to the
replicas until they're cached again. For a very popular product, many
simultaneous misses can hit the replicas at once, the
[thundering herd problem](/systems-and-infrastructure/thundering-herd-problem);
letting one request per key refill the cache while the others wait for it
keeps that to a single read.

**Bots at a sale.** Scripts adding items and checking out as fast as they can
reach the reservation step first. Per-account and per-IP limits at the API
gateway blunt that; true scarcity events are the ticket-booking case study's
territory.

**Knowing it's happening.** The numbers worth watching: place-order p99 and
its split by step, the share of orders ending `CANCELLED` by reason, the count
of orders in a non-final state older than a minute, reservations expired by
the sweeper (should be near zero), payment timeouts, and outbox lag.
[Observability](/systems-and-infrastructure/observability) covers how
metrics, logs and traces divide that work.

## Trade-offs

Each choice above bought something at a price.

- **Reserving before payment** turns "sold you something we don't have" into
  an ordinary "out of stock" before the card is touched, at the cost of a
  second inventory write per line and about 170 shoppers a day turned away by
  a unit held for someone whose card was then declined.
- **A saga over two-phase commit.** The payment service couldn't take part in
  2PC anyway, and 2PC would have locked each SKU for the length of a payment
  call. The saga's price is visible in-between states and a compensation for
  every step that has to be written, tested and made safe to repeat.
- **Orchestrating from the order service.** One place to see and debug the
  flow, and the payment service keeps a plain API. The order service becomes
  a dependency of every checkout, and a longer, branchier flow would push the
  design toward a workflow engine.
- **Keys on the order row** instead of a separate idempotency store: one
  transaction covers the key and the order, so they can't disagree. Two tabs
  can still produce two orders.
- **The outbox** makes every confirmed order reach the warehouse and the
  email pipeline even across crashes, but only at least once, so every
  consumer deduplicates by event ID.
- **A minute of staleness on product pages** lets 95% of reads come from
  memory. It's affordable because the price charged is always recomputed from
  the catalog's primary and checked against what the shopper saw.

What would change the design: selling scarce items in bursts, where holding a
unit during the few minutes a shopper types an address matters and fairness
becomes a requirement, which is where ticket booking picks up. Letting outside
sellers list items would split one order into several shipments with their
own stock, and the saga would grow a step per seller, the point at which a
workflow engine earns its place.
