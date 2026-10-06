---
title: Outbox Pattern
summary: Write the event to a table in the same transaction as your data, and let a separate relay publish it, so a crash can't leave the two out of step.
date: 2026-09-15
---

Picture an order service. A customer hits "buy", and the service has two jobs:
save order `o1` in its database, and publish an `OrderCreated` event to a
[message broker](/systems-and-infrastructure/message-queues) so inventory and
shipping hear about it. Both must happen, or neither. The **outbox pattern** is
how you get that, and this page follows `o1` through it.

## Why not just do both?

The obvious code commits to the database, then publishes. Between those two
lines sits a crash. If the process dies after the commit, the order exists and
nobody was told, so inventory never reserves the stock. Flip the order of the
steps and the failure flips too: publish first, crash before the commit, and
the world hears about an order that was never saved.

This is the **dual-write problem**: two separate systems, and no single moment
at which both change together. Can't you wrap them in one transaction? A
distributed transaction (XA, built on two-phase commit) is designed for that,
but it is operationally painful, it stalls when a participant or the network
goes down, and many modern brokers, Kafka among them, don't support XA.

## Make it one write

The fix is to stop writing to two systems. The event goes into an `outbox`
table in the same database, in the same transaction as the order:

```sql
BEGIN;
INSERT INTO orders (id, customer_id, total) VALUES ('o1', 'c1', 42.00);
INSERT INTO outbox (id, event_type, payload, sent)
  VALUES ('e1', 'OrderCreated', '{"order_id": "o1"}', false);
COMMIT;
```

A transaction is all-or-nothing, so after a crash you find both rows or neither.
There is no state where `o1` exists without `e1`, and no state where `e1`
exists without `o1`. The event also can't reach anyone before the order is
durable, because nothing publishes it until a separate process, the **relay**,
reads it from the table and sends it to the broker. The order service itself
never talks to the broker.

How does the relay find new rows? There are two common answers.

## Polling versus change data capture

**Polling** is the simple one. The relay runs a query on a timer, something like
`SELECT ... FROM outbox WHERE sent = false ORDER BY id LIMIT 100`, publishes
each row, then sets `sent = true`. You need nothing beyond the database you
already run. The costs are latency (an event waits up to one polling interval),
steady query load on the database even when nothing is happening, and care when
you run several relays at once so they don't grab the same rows. Locking the
rows you claim, for example with `FOR UPDATE SKIP LOCKED` in PostgreSQL, handles
that last one.

**Change data capture (CDC)** reads the database's own change log instead, the
log the database already keeps to feed replicas (PostgreSQL's write-ahead log,
MySQL's binlog). A CDC tool such as Debezium tails that log, sees the committed
`INSERT INTO outbox` as it appears, and publishes it. Events leave within moments
of the commit, and there is no polling query and no `sent` column to update. The
price is another moving part to run, plus database settings that expose the log
(logical replication, in PostgreSQL's case).

Start with polling. Move to CDC when polling's latency or load starts to hurt.

## The price: at-least-once delivery

Now the relay crashes after publishing `e1` but before marking it sent. On
restart it sees an unsent row and publishes `e1` again. A CDC relay has the same
gap: it can publish an event and die before it records how far into the log it
has read. Either way the broker receives `OrderCreated` twice.

In general the relay can't close that gap on its own, because the relay and the
broker are two systems again, which is the original problem one level down. Some
brokers drop a repeat within a time window, but you can't count on that. So
the outbox gives you **at-least-once** delivery: an event is never lost, and it
may arrive more than once. The cure lives with the consumer. If shipping
handles `OrderCreated` twice, it ships two boxes, unless the consumer is
[idempotent](/systems-and-infrastructure/idempotency), meaning a repeat has no
further effect. A common way is to record each event's `id` (here `e1`) as it is
processed and skip any id it has already seen. A failed publish, meanwhile, is
just retried later with
[backoff](/systems-and-infrastructure/exponential-backoff).

## When not to use it

Two things limit the outbox. The first is that it needs the data and the event
in the same database, since the shared transaction is the whole trick. If your
state lives in a store with no multi-row transactions, you can't write both
atomically. The second is cost: you now run a table, a relay and idempotent
consumers. If losing the occasional event is harmless, say a best-effort
analytics ping, a plain publish after the commit is simpler and fine.

Also note what the outbox does not do. It makes one service's write and publish
agree. A workflow spanning several services, where a failure must undo earlier
steps, is a job for a [saga](/systems-and-infrastructure/saga-pattern), which
often uses an outbox in each step.

**Rule of thumb.** When a database change must be announced, commit the
announcement in the same transaction and publish it from a relay, then make
every consumer safe against seeing it twice.

## Where you'll meet this

In payments and checkout, saving an order and telling inventory and shipping
about it have to happen together, and an outbox row committed alongside the
order means a crash in between can't leave a saved order nobody hears about, or
an announcement for an order that was never saved. A notification or email
pipeline is often the consuming end of that same event: the confirmation email
is triggered by what the relay publishes and, since delivery is at-least-once,
has to cope with seeing it twice or the customer gets two emails.
