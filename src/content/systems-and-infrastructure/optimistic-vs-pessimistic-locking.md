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
database keeps multiple versions of a row around so readers and writers
don't block each other, a built-in form of the same optimistic idea)
tends to be the more common default.

This applies to any concurrent update to shared state: inventory
counts, seat reservations, account balances, collaborative document
edits. It's also the same underlying concern
[idempotency](/systems-and-infrastructure/idempotency) addresses from a
different angle: idempotency makes a _retried_ request safe, while a
locking strategy determines what happens when two _different,
concurrent_ requests touch the same data at the same time. Guess wrong
about which strategy fits, and either throughput suffers for no reason,
or retries pile up under load.
