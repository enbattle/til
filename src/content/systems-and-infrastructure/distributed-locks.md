---
title: Distributed Locks
summary: A lock that works across machines can still be held by two workers at once, so the protected resource has to check a fencing token itself.
date: 2026-09-15
---

Suppose your billing service runs on three machines, and a customer's refund for invoice 42 must be issued once. A [race condition](/systems-and-infrastructure/race-conditions) is waiting here: if two machines both see the refund as unissued, both send it. Inside one process you would put a mutex around the check and the refund. A mutex lives in one process's memory, though, and these three machines share none. You need a **distributed lock**: a lock kept somewhere all three can reach, so that at most one of them is working on invoice 42 at a time. It is [pessimistic locking](/systems-and-infrastructure/optimistic-vs-pessimistic-locking) for the case where the workers don't share a database transaction.

## Taking the lock

Where do you keep the lock? In a small, fast shared store that can do a conditional write atomically. In Redis, for example:

```
SET lock:invoice-42 <unique-token> NX EX 30
```

`NX` means "only if the key doesn't exist". The store runs the check and the write as one step, so when three machines run this at the same moment, exactly one gets a success. The other two see a failure and either wait or move on.

Now the question that shapes everything else: what if the winner crashes? Nobody would ever release the lock. That is what `EX 30` is for. The lock is a **lease**, a lock with an expiry, so it disappears after 30 seconds on its own.

Releasing takes care too. Before deleting the key, the holder checks that the stored token is still its own; otherwise a worker whose lease already expired could delete a lock another worker now holds. The compare and the delete must run as one atomic operation, usually a short server-side script, or another worker could take the lock in the gap between them.

## The lease can expire while you work

Here is the part that surprises people. Machine A takes the lock for invoice 42 and starts the refund. Then a long [garbage-collection](/computing-fundamentals/stack-heap-and-garbage-collection#tracing-garbage-collection) pause (the runtime freezing your program while it reclaims memory) stalls A for 45 seconds. At 30 seconds the lease expires. Machine B takes the lock and starts the same refund. At 45 seconds A wakes up. It never noticed the time pass, still believes it holds the lock, and finishes its refund. The customer is refunded twice.

Can you fix this with a longer lease, say 10 minutes? A longer lease only moves the failure out. A pause, a slow disk or a stalled network call can be longer than any number you pick, and a long lease also makes every crash cost you that many minutes of waiting. Can A check "do I still hold the lock?" just before it writes? That check can pass and the lease can expire a moment later, before the write lands, so the gap is shorter but still there.

## Fencing tokens

The workable fix moves the check to the one place that cannot be fooled by a pause: the resource being written. Every time the lock is granted, it comes with a **fencing token**, a number that goes up with each grant. A got token 33, and B, who took the lock after A's lease expired, got token 34. The resource remembers the highest token it has seen and rejects anything older:

```
if incoming_token < resource.highest_seen_token:
    reject()  # this holder's lease had expired
resource.highest_seen_token = incoming_token
apply(write)
```

B's refund arrives with token 34, so the resource records 34 and applies it. When A wakes up and sends its refund with token 33, the resource sees 33 < 34 and refuses. Notice that A is still confused about the lock. It doesn't matter, because the safety no longer depends on A's belief.

Where does the token come from? The lock service has to issue it. A bare `SET NX` gives you no counter, so you would increment one in the same atomic script, and the counter itself must not go backward, which a failover can make it do. Coordination services built on a consensus protocol (their copies of the data agree on one order of events) hand out such numbers as part of their locks.

## What the lock does and doesn't guarantee

Without fencing, a distributed lock is meant to stop two workers from _acquiring_ the lock together, and under a lease that is all it promises. It does not stop two workers from _acting_ together, because a worker can outlive its lease without knowing. Fencing only helps if the resource can compare tokens, which a database row with a version column can and a third-party payment API usually cannot. For a resource like that, make the operation safe to repeat instead: send the refund with an [idempotency key](/systems-and-infrastructure/idempotency) such as the invoice number, so the second attempt is recognized and ignored.

A Redis primary with replicas (copies that take over if it dies) adds a second weakness. Replicas are updated a moment later, so if the primary dies and a replica that hadn't yet received your lock key takes over, a second worker can be granted the same lock. That is another reason to let the resource, not the lock, have the last word.

**Rule of thumb.** Use a distributed lock to cut down duplicate work, and don't trust it alone to protect data: when a stale write would do harm, make the resource check a fencing token or make the write safe to repeat.

## Where you'll meet this

In a notification or email pipeline, a scheduled job such as a nightly digest runs on every instance of the service, and a lock lets only one of them send it. Payments and checkout use the same idea for work like settling a batch of orders, where the write that moves the money still needs a fencing token or an idempotency key. Choosing which one copy of a service acts as the leader is another common use.
