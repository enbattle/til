---
title: Outbox Pattern
summary: Writing an event to a table in the same transaction as your data, so the database write and the publish can't succeed independently of each other.
date: 2026-09-15
---

The **outbox pattern** reliably publishes an event as part of a database
change, by writing the event to an "outbox" table in the _same_
transaction as the business data, then relaying it to a real message
broker as a separate step afterward.

## The dual-write problem this solves

Say an order service needs to both save an order to its database _and_
publish an `OrderCreated` event to a message broker. Doing that as two
separate steps — commit to the database, then publish to the broker —
has no atomic guarantee across the two different systems. If the
process crashes between the two steps, either the event is lost (a
crash before publishing), or, if the whole operation is retried, a
duplicate order risks being created. This is the **dual-write problem**,
and there's no way to wrap a database commit and a message-broker
publish in one shared transaction — they're different systems with no
common coordinator between them.

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

## Any place a database write and a notification have to survive together

Any service that needs "change the database" and "notify the rest of
the system" to happen together and survive a crash in between — order
processing, inventory updates, and generally any event-driven system
built on top of a relational store.
