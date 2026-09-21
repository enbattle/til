---
title: Optimistic vs. Pessimistic Locking
summary: Locking a row up front vs. checking for a conflict at write time — which fits high-contention writes vs. mostly-independent ones.
date: 2026-09-15
---

Two strategies for handling concurrent writes to the same data without
corrupting it. **Pessimistic locking** assumes conflicts are likely and
prevents them up front: acquire a lock before touching the data, so no
one else can write to it until you're done. **Optimistic locking**
assumes conflicts are rare — let everyone proceed without locking, but
detect a conflict at write time and reject (or retry) whichever write
loses the race.

## Pessimistic locking: prevent the conflict up front

```sql
BEGIN;
SELECT * FROM inventory WHERE product_id = 42 FOR UPDATE; -- blocks other writers
UPDATE inventory SET quantity = quantity - 1 WHERE product_id = 42;
COMMIT;
```

`SELECT ... FOR UPDATE` holds a row lock until the transaction commits.
Any other transaction trying to update — or even lock — the same row
blocks until this one finishes. This is safe by construction, but a
slow or stuck transaction holds up everyone waiting behind it, and it
doesn't work at all across services that don't share a database.

## Optimistic locking: detect the conflict at write time

Instead of locking, add a version column and check that it hasn't
changed since it was read:

```sql
UPDATE inventory
SET quantity = quantity - 1, version = version + 1
WHERE product_id = 42 AND version = 7; -- the version we read

-- 0 rows affected → someone else updated it first; re-read and retry
```

No lock is ever held, so throughput under low contention is much
better. But under high contention, many writers can end up retrying
repeatedly — each one's write invalidated by the next one landing first —
which can be worse in practice than simply queuing behind a lock in the
first place.

## Sometimes a single statement is enough

Before reaching for either strategy, check whether the database can make the
change atomically on its own, meaning as one indivisible step. A decrement
guarded by a condition does the check and the write together:

```sql
UPDATE inventory
SET quantity = quantity - 1
WHERE product_id = 42 AND quantity > 0;

-- 0 rows affected → sold out; nothing was written
```

Two buyers racing for the last unit can't both succeed. A database's
isolation level is a setting for how much concurrent transactions can see of
each other's work, and at the defaults of Postgres (read committed) and
MySQL's InnoDB (repeatable read) the second statement waits for the first
transaction to finish, then evaluates its condition against the updated
quantity, finds zero, and matches no row. In Postgres at repeatable read or
serializable, the second transaction instead fails with a serialization error
and has to be retried. There's no version column to maintain, and no lock is
held while application code runs, as long as the statement commits promptly
instead of sitting inside a long transaction. It only covers a change that
fits in one statement; a flow that reads a row, decides something in
application code, and then writes still needs one of the two strategies
above.

## When one row is the bottleneck

Neither strategy makes a hot row faster; they only decide who waits. If
thousands of requests update the same row (the stock of a flash-sale item, a
global counter), they all queue behind that row's lock, and throughput is
capped by how fast transactions that touch that row can commit one after
another, even while the database has plenty of CPU and disk to spare.

The cheapest relief is a shorter transaction. A row lock is held from the
moment the row is locked until the transaction commits or rolls back, so slow
work that doesn't depend on that row, such as calling a payment API or sending
an email, belongs outside the transaction, and the statement that touches the
hot row belongs as late in it as possible.

Past that, a counter can be split across several rows: each request updates
one at random, and reading the total means adding them up. Writers collide far
less often because they're spread across rows, at the price of more expensive
reads. For stock that must not oversell, the randomly chosen row can be empty
while others still hold units, so a request that lands on an empty row has to
try another before reporting sold out. Checking the summed total first and
then decrementing is the same read-then-write race as before: two requests can
both see one unit left and both take it.

The most drastic option is to queue the writes and let a single worker, one
process that drains the queue and is the only writer to that row, apply them.
Because it is the only writer, contention disappears, and the worker can
combine many requests into one statement, which cuts the per-transaction
overhead, while the waiting requests sit in the queue instead of holding
scarce database connections. The catch is that the worker has to decide in its
own logic which requests get units, since a blind decrement of the whole batch
would reject all of it whenever fewer units remain than requested. The caller
also learns that its write was accepted, not that it was applied. The queue
needs protection from growing without limit, which is what
[backpressure](/systems-and-infrastructure/backpressure) is for, and because
queues usually deliver a message at least once, a crashed worker can replay
work, so the work has to be
[idempotent](/systems-and-infrastructure/idempotency).

## Betting on how often conflicts actually happen

Locking is fundamentally a bet about conflict frequency, and the two
strategies pay for that bet differently: pessimistic locking pays a
guaranteed cost on every single write to buy safety up front; optimistic
locking pays nothing on the common case but a real, escalating cost the
moment contention turns out higher than assumed.

Pessimistic locking wins when conflicts are genuinely frequent and
retrying is expensive — a multi-step checkout flow that's costly to redo
from scratch. Optimistic locking wins when conflicts are rare and most
attempts succeed on the first try, which describes the majority of
real-world write patterns — part of why optimistic locking (or a
database's own **MVCC** — multi-version concurrency control, where the
database keeps multiple versions of a row around so readers never block
writers or vice versa) tends to be the more common default — though note
that write-write conflicts on the same row under MVCC typically still
block or serialize, closer to pessimistic behavior than to lock-free
optimistic locking.

This applies to any concurrent update to shared state: inventory
counts, seat reservations, account balances, collaborative document
edits. It's also the same underlying concern
[idempotency](/systems-and-infrastructure/idempotency) addresses from a
different angle: idempotency makes a _retried_ request safe, while a
locking strategy determines what happens when two _different,
concurrent_ requests touch the same data at the same time. Guess wrong
about which strategy fits, and either throughput suffers for no reason,
or retries pile up under load.
