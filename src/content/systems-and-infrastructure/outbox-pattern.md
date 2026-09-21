---
title: Outbox Pattern
summary: Writing an event to a table in the same transaction as your data, so the database write and the publish can't succeed independently of each other.
date: 2026-09-15
---

The **outbox pattern** reliably publishes an event as part of a database
change, by writing the event to an "outbox" table in the _same_
transaction as the business data, then relaying it to a real
[message broker](/systems-and-infrastructure/message-queues) as a separate
step afterward.

## The dual-write problem this solves

Say an order service needs to both save an order to its database _and_
publish an `OrderCreated` event to a message broker. Doing that as two
separate steps — commit to the database, then publish to the broker —
has no atomic guarantee across the two different systems. If the
process crashes between the two steps, either the event is lost (a
crash before publishing), or, if the whole operation is retried, a
duplicate order risks being created. This is the **dual-write problem**. Distributed transactions (XA,
two-phase commit) exist in principle for coordinating a database commit
and a message-broker publish together, but there's no practical way to
lean on them here: XA is operationally painful, kills availability
under a partition, and modern brokers like Kafka don't support it at
all.

## Writing the event in the same transaction as the data

Instead of publishing directly, the event is written to an outbox table
alongside the business data, inside the same database transaction:

```sql
BEGIN;
INSERT INTO orders (id, customer_id, total) VALUES ('o1', 'c1', 42.00);
INSERT INTO outbox (id, event_type, payload, sent)
  VALUES ('e1', 'OrderCreated', '{"order_id": "o1"}', false);
COMMIT;
```

A separate relay process — polling the outbox table, or tailing the
database's own change log — reads unsent outbox rows, publishes each one
to the real broker, and marks it sent. Because the event and the
business data commit atomically as one transaction, the event can never
be silently lost, and it can never be published before the data it
describes actually exists.

## What the safety actually costs: at-least-once, not exactly-once

The outbox pattern swaps an unsafe dual-write for a safe single write
plus a relay — but that safety arrives as **at-least-once** delivery,
not exactly-once: the relay can crash after successfully publishing an
event but before marking its row as sent, and will publish it again on
restart. Consumers of these events need to be
[idempotent](/systems-and-infrastructure/idempotency) for exactly this
reason — the reliability the outbox buys on the publishing side only
pays off if the receiving side can safely handle the same event arriving
twice.

## Where you'll meet this

In payments and checkout, saving an order and telling inventory and
shipping about it have to happen together, and an outbox row committed
alongside the order means a crash in between can't leave a saved order
nobody hears about, or an announcement for an order that was never
saved. A notification or email pipeline is often the consuming end of
that same event: the confirmation email is triggered by the event the
relay publishes from the outbox and, since delivery is at-least-once,
has to cope with seeing it twice or the customer gets two emails. The
same shape fits many event-driven systems built on a relational store.
