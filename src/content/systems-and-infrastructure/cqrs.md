---
title: Command Query Responsibility Segregation (CQRS)
summary: Keep one model for accepting changes and a separate, query-shaped model for answering reads, and accept that the two are briefly out of step.
date: 2026-09-21
---

Picture an online shop. Customers place orders, and they open a "My orders" page to see them. Both jobs run against the same database tables, written by the same code. That works until the two jobs start wanting different things from the data.

**CQRS**, short for Command Query Responsibility Segregation, splits the one model in two. A **command** is a request to change something ("place this order"). A **query** is a request to look something up ("show me my orders"). Commands go to a **write model**, whose job is to validate changes and store them correctly. Queries go to a **read model**, built only to answer questions quickly.

## Why would you want two models?

Because the shape that makes writes safe is rarely the shape that makes reads cheap. A write model usually keeps data **normalized**: each fact is stored once, so there is one place to update and no copies to contradict each other. The customer's name lives in a customers table, the product name in a products table, and an order refers to both by ID.

Now look at the "My orders" page. Each row wants the order date, the item names, the total and the shipping status, all gathered together. Building that from normalized tables means joining several of them on every page view, and orders get viewed far more often than they get placed. The read side wants the opposite design: **denormalized**, with those facts copied into one ready-made row per order.

With a single model you compromise, and one side loses. With CQRS, each side gets the design it wants, even different storage. The write side might be a relational database, and the read side a denormalized table, a key-value store or a search index.

## How does the read model get its data?

Someone has to copy changes from the write side to the read side. The usual mechanism is events. When a command succeeds, the write side records that something happened (`OrderPlaced`). A **projection**, a small piece of code that listens for those events, updates the read model to match:

```python
def on_order_placed(event):
    current = read_db.get("order_summaries", event.order_id)
    if current and current["version"] >= event.version:
        return  # already applied this event or a newer one
    read_db.upsert("order_summaries", {
        "order_id": event.order_id,
        "customer_id": event.customer_id,
        "total": event.total,
        "status": "placed",
        "version": event.version,
    })
```

Three things can go wrong here. First, an event can be lost between the write and the publish, which is the dual-write trap the [outbox pattern](/systems-and-infrastructure/outbox-pattern) exists to solve. Second, delivery from a [message queue](/systems-and-infrastructure/message-queues) is commonly at-least-once, so the projection may see the same event twice and must be [idempotent](/systems-and-infrastructure/idempotency): handling it twice leaves the same result as handling it once.

Third, an older event can arrive after a newer one. An upsert (insert the row, or update it if it exists) alone would let a late redelivery of `OrderPlaced`, arriving after `OrderShipped`, set the status back to "placed". That is what the version check at the top of the projection is for: each event carries a version number per order, and the projection skips any event no newer than the one it already holds. (In production the check and the write should be one conditional statement, or two projections can race between them.)

## What does it cost you?

Copying takes time, so the read model lags the write model. Usually that is milliseconds to seconds, and it can be longer when the projection falls behind. This is **eventual consistency**: readers see the latest state eventually, not instantly. It is the same kind of lag as on [read replicas](/systems-and-infrastructure/read-replicas): a choice to copy asynchronously, present even when the network is healthy.

In the shop, a customer places an order, gets redirected to "My orders", and the new order isn't there yet. They place it again. Two common patches avoid that. The command's response can return the new state directly, so the page shows it without asking the read side. Or the page can read from the write side for a short while after that customer's write. Either way, the lag stays; you are only hiding it.

You also now run a second data store and a projection to maintain.

## Is this the same as event sourcing?

No, though they are often mentioned together. **Event sourcing** stores the log of events itself as the truth, and recomputes current state from it. The two combine well, since the log can feed the projections and a read model can be rebuilt by replaying it. Neither requires the other: a CQRS system can keep an ordinary database as its write side.

## When is it worth it?

Be skeptical before adopting it. For a typical create-read-update-delete application, a single model works fine. If reads are slow, try cheaper things first. A [database index](/systems-and-infrastructure/database-indexing) may fix the slow query. [Read replicas](/systems-and-infrastructure/read-replicas) keep the same schema but spread the read load, and [scaling reads vs. scaling writes](/systems-and-infrastructure/scaling-reads-vs-scaling-writes) shows how to tell which side is the bottleneck.

CQRS earns its cost when the read shape and the write shape have diverged, as with our order history page, or when read traffic so dwarfs writes that the read side should be stored and scaled on its own.

**Rule of thumb.** Split reads from writes only when their shapes or their load have diverged enough that one model hurts both, and only if you can live with readers seeing slightly old data.

## Where you'll meet this

A news feed is a common fit. Each reader's timeline is a precomputed read model, so opening the app is one lookup instead of a merge across everyone they follow. Chat has a milder version: the inbox screen (last message, unread count per conversation) is a read model kept up to date apart from the message history.
