---
title: How do I keep data correct when many users or services change it at once?
summary: Which mechanism fits when writers collide, a job runs twice, or one change has to reach several systems reliably.
date: 2026-09-20
order: 5
---

Two customers buy the last item. An order is saved but the message announcing it
never goes out. A booking is half-finished when a later step fails. A scheduled
job runs on two machines at once. Sometimes the symptom is wrong data, and
sometimes it's slowness, as writers queue behind each other on the same rows.
Which fix fits depends on where the writers are and what they need from each
other.

## Confirm which case you're in

Reproduce it with concurrent requests, because these bugs rarely show up in
single-user testing. Then sort it into one of four cases. Writers that share one
database and collide on the same rows are a locking question. Processes that
don't share a database but need exclusive access to something are a
distributed-lock question. A change in your database that has to reach another
system is an outbox question. A multi-step operation spread across services is a
saga.

## Same database: lock, or detect the conflict

A transaction is a group of changes the database applies all together or not at
all. For the last-item example, the simplest fix is often a single conditional
update, one that only decrements the quantity while it's above zero and reports
whether it changed a row, since the database applies it atomically, as one
indivisible step.

Beyond that there are two strategies, and the difference is a bet on how often
conflicts happen.
[Pessimistic locking](/systems-and-infrastructure/optimistic-vs-pessimistic-locking)
locks the row before touching it, so nobody else can write until you finish. It
prevents conflicts up front, at the price of waiting, and a slow transaction
holds up everyone behind it. Optimistic locking lets everyone proceed and checks
at write time whether the row changed since it was read, rejecting the loser. It
adds little when conflicts are rare and turns into repeated retries when they
aren't. Choose pessimistic when conflicts are frequent and redoing work is
expensive, and optimistic otherwise.

If the symptom is slowness on a hot row, the locking strategy only decides who
waits. Shorter transactions hold locks for less time. A counter that every
request updates can be split across several rows and added up when read. Or the
writes can go through a queue so they apply one at a time.

## Separate processes needing exclusive access

Only one instance of a scheduled job should run, or two workers must not process
the same item, and the processes don't share a database. A
[distributed lock](/systems-and-infrastructure/distributed-locks) lets one
process at a time proceed, usually through a shared store, with a time limit
called a lease so a crashed holder can't block everyone forever. A lease can run
out while its holder is still working, leaving two processes each convinced they
hold the lock, and a longer lease only delays that. A fencing token, a number
that grows with each acquisition, closes the gap, but only if the protected
resource can check it and reject older ones; otherwise the lock is advisory. For
a job that might run twice, making the job idempotent is often the cheaper
answer.

## One change that has to reach another system

Saving to a database and sending a message about it are two separate steps with
no shared guarantee, so a crash between them loses the message or duplicates the
work. The [outbox pattern](/systems-and-infrastructure/outbox-pattern) writes
the message to a table in the same transaction as the data, and a separate
process sends it afterward. Delivery is then at-least-once: a message is never
lost, but it can arrive twice. Receivers therefore have to be
[idempotent](/systems-and-infrastructure/idempotency).

## One operation across several services

There's no practical way to wrap steps owned by different services in one
transaction without a serious cost to availability. A
[saga](/systems-and-infrastructure/saga-pattern) runs them as a sequence of local
transactions, each with a compensating action that undoes it if a later step
fails. Other parts of the system can see the in-between states, so each step
needs a defined way back out. Sagas are usually built on the outbox pattern.

## The tradeoff underneath

Once data is copied across machines, the
[CAP theorem](/systems-and-infrastructure/cap-theorem) applies. During a network
partition, a period when some machines can't reach each other (unrelated to
splitting a table into partitions), a system has to choose between answering with
possibly stale data and refusing to answer until it's sure. Partitions happen at
any real scale, so it's a decision to make during design.

## How they combine

The saga, the outbox and idempotent receivers work as a stack: a saga's steps are
triggered by reliably sent messages, so it leans on the outbox, and the outbox
forces receivers to be idempotent. The two locking strategies are alternatives,
so pick one per case. Use the simplest mechanism that covers your case, and reach
for the distributed ones only when the processes don't share a database.

## When it isn't this problem

If the wrong data is an out-of-date cached copy, look at the caching material in
[What do I do when my database can't keep up with reads?](/system-design/database-cant-keep-up-with-reads).
If duplicates and half-finished work come from retries against a failing
dependency, start with
[How do I stop one failing service from taking everything else down?](/system-design/one-failing-service-taking-down-others).
