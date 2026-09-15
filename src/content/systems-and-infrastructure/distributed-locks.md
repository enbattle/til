---
title: Distributed Locks
summary: Coordinating exclusive access across machines when a single-process mutex no longer applies — and why every such lock needs a lease.
date: 2026-09-15
---

A mechanism for ensuring only one process, across multiple machines, can
hold a given lock at a time — the multi-process equivalent of a mutex,
needed whenever [pessimistic locking](/systems-and-infrastructure/optimistic-vs-pessimistic-locking)
has to work across services that don't share a database or a single
process's memory.

## The basic mechanism: atomic acquisition with a lease

A common building block, using a shared, fast external store:

```
SET lock:invoice-42 <unique-token> NX EX 30
```

`NX` ("set if not exists") makes acquisition atomic — only the first
caller to run this succeeds. `EX 30` gives the lock a time-to-live, so
it's automatically released if the holder crashes before explicitly
unlocking it. Releasing the lock checks that the stored token matches
before deleting it, so a process can't accidentally release a lock it
no longer actually holds — for example, after its own lock already
expired and a different process has since acquired it. That check and
that delete have to run as one atomic operation on the store — typically
a small server-side script — rather than two separate round trips (fetch
the token, compare it, then delete). Split into two steps, the gap
between them reopens exactly the race this mechanism is supposed to
close: another process can acquire the lock in between.

## The central hard problem: a lease can expire mid-work

Concretely: Process A acquires the lock with a 30-second lease. A long
garbage-collection pause, a slow disk, or simply underestimating how
long the work takes causes A to run for 45 seconds instead. At the
30-second mark, the lease expires — A is still working, believing it
holds the lock. Process B now acquires the same lock successfully. For
the next 15 seconds, both A and B believe they exclusively hold it, and
both may act on that belief.

A longer lease doesn't fix this — it just delays the same failure to a
later point, since there's no lease duration long enough to rule out
every possible pause or slowdown.

## Fencing tokens: moving the safety check to the resource itself

The actual fix is giving every acquisition a monotonically increasing
**fencing token**, and having the _protected resource itself_ reject any
write that arrives with a stale token:

```
if incoming_token < resource.highest_seen_token:
    reject()  # this holder's lock had already expired
resource.highest_seen_token = incoming_token
apply(write)
```

This moves the actual safety guarantee onto the resource being
protected, rather than trusting that merely holding the lock implies
exclusivity. It's the fully correct fix, not a workaround layered on top
of the same broken assumption.

## What this actually coordinates in practice

Coordinating exclusive access across services: ensuring only one
instance of a scheduled job runs at a time, preventing two workers from
processing the same queue item twice, leader election among a set of
replicas. The common implementations lean on either a fast key-value
store with atomic conditional writes (the mechanism shown above), or a
consensus-based coordination service built specifically for this kind of
guarantee.

## Treat possession as advisory

Without fencing tokens, a distributed lock only prevents concurrent
_acquisition_ — not concurrent _access_ — once a lease can expire
mid-operation. Treat mere lock possession as advisory, not a guarantee,
unless the protected resource itself is actually capable of rejecting a
stale write.
