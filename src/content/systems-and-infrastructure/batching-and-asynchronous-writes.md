---
title: Batching and Asynchronous Writes
summary: Grouping many small writes into one, and confirming a write before it is applied, raise write throughput in exchange for latency, ordering, and error-handling complications.
date: 2026-09-21
---

Every write carries a fixed cost that doesn't depend on how much data
it holds: a network round trip to the database, and a commit that
typically waits for the change to be flushed to disk before the database
says it's safe. Writing 1,000 rows one at a time pays that cost 1,000
times. **Batching** groups many writes into one operation so the cost
is paid once:

```sql
-- 1,000 round trips, and typically 1,000 commits
INSERT INTO page_views (page_id, viewed_at) VALUES (7, now());
INSERT INTO page_views (page_id, viewed_at) VALUES (9, now());
-- ...

-- one round trip, one commit
INSERT INTO page_views (page_id, viewed_at)
VALUES (7, now()), (9, now()), (7, now()); -- ...and so on
```

The price is that a write can no longer go out the moment it arrives.
Something has to collect writes until a batch is full, and a common rule
is to flush at a maximum size or a maximum wait, whichever comes first,
say 500 rows or 100 milliseconds. The first write into a batch waits for
the others, which is the trade described in
[Latency vs. Throughput](/systems-and-infrastructure/latency-vs-throughput):
throughput goes up and the latency of individual writes goes up with it.

## Acknowledging before applying

**Asynchronous writes** go a step further and separate accepting a write
from applying it. The caller's request is answered as soon as the write
is safely stored in a
[queue](/systems-and-infrastructure/message-queues) or log, and a
background consumer writes it to the real database afterward. Batching
pairs well with this, since the consumer can pull hundreds of queued
writes at once and apply them together. It can also combine them: ten
thousand "add one view" messages for the same page can become a single
`UPDATE` that adds 10,000, which sidesteps the contention on a hot row
(one row that many writers all try to update at once) described in
[Optimistic vs. Pessimistic
Locking](/systems-and-infrastructure/optimistic-vs-pessimistic-locking).

Acknowledging before applying changes what a successful response
means, and two of the consequences below apply only to it. Plain
batching acknowledges after the batch commits, so those don't arise.

**Durability window (asynchronous writes).** "Safely stored" has to mean
stored somewhere that survives a crash. If the application acknowledges
after putting a write in its own memory buffer, a crash loses every
write still in the buffer, even though callers were told they succeeded.
Acknowledging only after the queue has durably stored the write closes
that window, at the cost of some latency; what "durably" means depends
on how the queue is configured.

**Visibility (asynchronous writes).** Between the acknowledgment and the
consumer's write, the data doesn't exist in the database, so a user who
submits something and immediately reloads may not see it. The interface
has to cope, for example by showing the pending item locally.

**Ordering (both).** A batch is applied together, and if several
consumers process different batches, they can finish in a different
order than the writes arrived. A later update to a row can be
overwritten by an earlier one. Where order matters, the usual approach
is to route all the writes for one key (one user, one conversation) to
the same consumer, which keeps the order within each key while giving up
ordering between keys.

**Failure handling (both).** In a batch of 500, one row may violate a
constraint. Depending on how it was applied, the whole batch fails or
part of it lands, and with asynchronous writes the caller was already
told yes. A consumer typically retries, and since a retry can replay
writes that already succeeded, each write has to be
[idempotent](/systems-and-infrastructure/idempotency). A write that can
never succeed is set aside in a [dead-letter
queue](/systems-and-infrastructure/dead-letter-queue) instead of being
retried forever. Validating before acknowledging catches many bad writes
while the caller can still hear about them.

The queue itself needs a limit. If writes arrive faster than the
consumer can apply them, the queue grows without bound and the delay
between acknowledgment and application grows with it; see
[Backpressure](/systems-and-infrastructure/backpressure).

## Where the trade fits

Both techniques suit writes where the caller doesn't need to know the
outcome right away and slightly out-of-order or delayed application is
tolerable: counters, analytics events, activity logs. They suit an
operation like charging a card poorly, because the caller needs the
result now, and the result is sometimes a refusal.

## Where you'll meet this

A large news feed may count likes and views this way: at those volumes,
updating a row for each event could swamp the database, so the events
are queued and applied as periodic batched updates, and the count shown
runs a little behind. A notification pipeline batches on the way out,
since grouping sends to a provider that accepts many recipients per
request costs less than one call per recipient. In chat,
per-conversation ordering means any batching must never reorder messages
within a conversation.
