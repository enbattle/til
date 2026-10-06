---
title: Optimistic vs. Pessimistic Locking
summary: Two ways to stop concurrent writes corrupting a row, locking it first or checking for a conflict when you write, and which fits your contention.
date: 2026-09-15
---

Your shop has one ticket left, and two buyers click "buy" in the same instant. Each request reads the stock, sees 1, and decides the sale can go ahead. Each then writes 0 and takes payment, and you have sold one ticket twice. That is a [race condition](/systems-and-infrastructure/race-conditions): the result depends on how two operations happen to interleave.

The fix is to make the two requests take turns on that row. There are two broad ways to do it, and the difference is when you pay for safety.

## Lock first: pessimistic locking

**Pessimistic locking** assumes a conflict is likely, so it prevents one. You take a lock on the row before you read it, and anyone else who wants to change it waits until you finish.

```sql
BEGIN;
SELECT quantity FROM inventory WHERE product_id = 42 FOR UPDATE; -- blocks other writers
-- the application checks quantity > 0 before going on
UPDATE inventory SET quantity = quantity - 1 WHERE product_id = 42;
COMMIT;
```

`FOR UPDATE` locks the row until the transaction (a group of statements that succeed or fail together) commits or rolls back. The second buyer's `SELECT ... FOR UPDATE` waits, then reads the stock after the first buyer has written it, and sees 0.

The price is that every writer pays for the lock, conflict or not, and a slow transaction holds up everyone queued behind it. A row lock also protects only writers who go through that database; across services that don't share one, you need a [distributed lock](/systems-and-infrastructure/distributed-locks).

## Check at write time: optimistic locking

**Optimistic locking** assumes a conflict is rare. Nobody holds a lock while reading and deciding. Instead the row carries a version number, and your write succeeds only if the version is still the one you read.

```sql
UPDATE inventory
SET quantity = quantity - 1, version = version + 1
WHERE product_id = 42 AND version = 7; -- the version we read

-- 0 rows affected: someone else wrote first; re-read and retry
```

Both buyers read version 7. The first update matches and moves the row to version 8. The second finds no row at version 7, affects zero rows, and knows it lost. It re-reads, sees the stock is now 0, and tells the buyer it is sold out.

When conflicts are rare, this is cheaper: no lock is held, and almost every write succeeds on the first try. When they are frequent, it degrades. With many writers on one row, each one's write is invalidated by whichever lands first, so the losers retry and mostly lose again, and the wasted work can exceed what simply queuing behind a lock would have cost.

## Do you need either one?

Often not. If the whole change fits in one statement, let the database check and write together:

```sql
UPDATE inventory
SET quantity = quantity - 1
WHERE product_id = 42 AND quantity > 0;

-- 0 rows affected: sold out, nothing written
```

A database's **isolation level** sets how much concurrent transactions see of each other's work. At the default level of Postgres (read committed) and of MySQL's InnoDB (repeatable read), the second buyer's statement waits for the first transaction to finish, re-evaluates `quantity > 0` against the new value, and matches nothing. In Postgres at repeatable read or serializable, the second transaction instead fails with an error saying it conflicted and must be retried.

If the flow reads the ticket, applies a pricing rule in application code, and then writes, you are back to one of the two strategies above.

## When the ticket goes viral

Now suppose the ticket is the last of a flash sale and thousands of buyers hit that one row. Neither strategy makes it faster; they only decide who waits, and the sales per second are capped by how quickly transactions on that row can commit one after another.

The cheapest relief is a shorter transaction. Move slow work that doesn't need the row, such as the payment call or an email, outside the transaction, and put the statement that touches the hot row as late as you can.

Past that, you can split the stock across several rows, say ten rows holding a tenth each, and have each request pick one at random. Writers collide less often, at the cost of summing ten rows to read the total. A request that lands on an empty row must try another before it reports sold out, because checking the total first and then decrementing is the same read-then-write race again.

The most drastic option is to queue the writes and let one worker be the only writer to that row. The worker can fold many requests into one statement, but it must decide which requests get units, since one blind decrement of the whole batch would reject all of them when stock runs short, and the buyer learns the request was accepted, not that it was applied. The queue needs [backpressure](/systems-and-infrastructure/backpressure) so it can't grow without limit. Queues usually deliver a message at least once, so a replayed request must be [idempotent](/systems-and-infrastructure/idempotency), meaning applying it twice has the same effect as once.

## Picking one

Pessimistic locking fits when conflicts are frequent or redoing the work is expensive, like a multi-step checkout that is costly to repeat. Optimistic locking fits when most writes touch different rows and succeed on the first try.

**Rule of thumb.** First see whether a single guarded statement does the job. If it doesn't, use a version check when conflicts are rare and a row lock when they are common or a retry is expensive, and if one row is the bottleneck, shorten the transaction before you split the row or queue its writes.

## Where you'll meet this

In payments, an account balance is the contested row, and a transfer that debits one account and credits another locks both rows, always in the same order, so two opposite transfers can't each wait on the other. A news feed meets the hot-row problem instead: the like counter on a viral post is one row with thousands of writers, so spreading the counter or queuing the updates matters more than which lock you pick.
