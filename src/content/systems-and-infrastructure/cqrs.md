---
title: 'CQRS: Separating Reads from Writes'
summary: Using one model to accept changes and a different, query-shaped model to answer reads, at the price of the two being briefly out of step.
date: 2026-09-21
---

Most applications start with one model of their data: a set of tables,
plus code that both changes those tables and reads from them. **CQRS**,
short for Command Query Responsibility Segregation, splits that in two.
A **command** is a request to change something ("place this order"), and
a **query** is a request to look something up ("show me my orders").
Under CQRS, commands go to a **write model** whose job is to validate
changes and store them correctly, and queries go to one or more **read
models** built only to answer questions quickly.

## Why the two sides pull in different directions

The shape that makes writes safe is rarely the shape that makes reads
cheap. A write model usually wants normalized data: each fact stored
once, so there is one place to update and no copies to contradict each
other. A screen showing an order history wants the opposite: the order,
its items, product names and the shipping status already gathered into
one row, because joining five tables on every page view is slow at
volume.

With a single model you compromise, and one side usually loses. CQRS
lets each side have the design it wants, including different storage
altogether: a relational database for the write side, and for the read
side perhaps a denormalized table, a key-value store, or a search index.

## How the read model stays current

Someone has to copy changes from the write side to the read side, and
the usual mechanism is events. When a command succeeds, the write side
records that something happened (`OrderPlaced`), and a **projection**, a
small piece of code that listens for those events, updates the read
model to match:

```python
def on_order_placed(event):
    read_db.upsert("order_summaries", {
        "order_id": event.order_id,
        "customer_id": event.customer_id,
        "total": event.total,
        "status": "placed",
    })
```

The hard part is not losing events between the write and the publish,
which is the same dual-write trap the [outbox
pattern](/systems-and-infrastructure/outbox-pattern) exists to solve.
Delivery is normally at-least-once, so a projection may see the same
event twice and should produce the same result both times. An upsert
like the one above does that for a repeated event, but not when an older
event is redelivered after a newer one, which would overwrite fresh
state with stale. A projection should ignore an event older than what it
has already applied, for example by comparing version numbers.

## The price: eventual consistency

That copying takes time, so the read model lags the write model, usually
by milliseconds to seconds, sometimes longer when the projection falls
behind. A user who submits a change and is redirected to a page served
by the read model may not see their own change yet. Common patches are
returning the new state directly from the command's response, or reading
from the write side for a short while after a write. Either way, you are
accepting eventual consistency (readers see the latest state
"eventually," not instantly) as a permanent feature of the system.

## Not the same as event sourcing, and often not worth it

CQRS is frequently mentioned alongside **event sourcing**, where the
stored truth is the log of events itself and current state is
recomputed from it. The two combine well, since the event log feeds the
projections, but neither requires the other. A CQRS system can keep an
ordinary database as its write side.

Be skeptical before adopting it. For a typical create-read-update-delete
application, a single model works fine, and CQRS adds a second data
store, a projection to maintain, and lag to explain to users. There is a
cheaper first step when reads are the problem: point them at [read
replicas](/systems-and-infrastructure/read-replicas), which keep the
same schema but spread the load, and see [scaling reads vs. scaling
writes](/systems-and-infrastructure/scaling-reads-vs-scaling-writes) for
how to tell which side is the bottleneck. CQRS earns its complexity when
the read shape and the write shape genuinely diverge, or when read
traffic dwarfs writes so much that the read side should scale and be
stored on its own.

## Where you'll meet this

A news feed is one common fit: posts are written once into a normalized
store, while each reader's timeline is a precomputed, denormalized read
model rebuilt as new posts arrive, so opening the app is a single lookup
instead of a merge across everyone the reader follows. Chat has a milder
version, where message history is kept in write order but the inbox
screen (last message, unread count per conversation) is a read model
kept up to date separately.
