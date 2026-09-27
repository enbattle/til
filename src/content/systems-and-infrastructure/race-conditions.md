---
title: Race Conditions
summary: Why code that is correct when one request runs it can corrupt data when two run it at once, and how to close the gap.
date: 2026-09-26
---

A **race condition** is a bug where the result depends on the timing of two or
more things running at the same time. Each one is correct on its own. Run them
together and their steps can interleave in an order nobody planned for, and
some of those orders produce the wrong answer. The name comes from the two
operations racing each other: whichever reaches a certain step first changes
what the other one sees.

## The lost update

Take a page-view counter stored in a database row, and say the application
updates it by reading the count into a variable, adding one, and writing the
result back. The
line `views = views + 1` looks like one step, but it is three, and another
request can run between any of them. Here is one possible interleaving when
the counter starts at 5:

| Time | Request A          | Request B          | Stored value |
| ---- | ------------------ | ------------------ | ------------ |
| 1    | reads 5            |                    | 5            |
| 2    |                    | reads 5            | 5            |
| 3    | computes 6, writes |                    | 6            |
| 4    |                    | computes 6, writes | 6            |

Two increments ran and the counter went up by one. B's write overwrote A's
because B read before A wrote. This shape is called **read-modify-write**, and
the result is a **lost update**. Nothing crashed and nothing logged an error;
the data is quietly wrong.

## Check-then-act

The second common shape is deciding based on something you just looked at,
when that thing can change between the look and the decision:

```python
if account.balance >= amount:      # check
    account.balance -= amount      # act
```

Two withdrawals of 80 from a balance of 100 can both pass the check before
either subtracts, so 160 goes out of an account that held 100. The same
pattern shows up as "is this username free? then create it," "is there stock
left? then sell it," and, in security, "is this file safe to open? then open
it," where an attacker swaps the file in the gap. The general pattern is also
called **time-of-check to time-of-use (TOCTOU)**, a name that comes from
security bugs like that last one.

## Why they slip through testing

The window between the read and the write is often a millisecond or less, so the bad
interleaving needs two requests for the same record to land inside it. With
one person clicking through a test environment, that almost never happens.
Under production load, when many requests hit the same record, it can happen
regularly. Race bugs also tend to vanish when you add logging or attach a
debugger, because both change the timing. The dependable way to reproduce one is
to force the interleaving: add a short delay between the check and the act,
then send two requests at once. Firing many concurrent requests at the same
record also works, just less predictably.

## Closing the gap

Every fix makes the check and the act, or the read and the write, happen as
one indivisible step that nothing else can interleave with. Such a step is
called **atomic**. Which tool does that depends on where the shared data lives.

**Inside one process.** A server often handles several requests at once on
separate **threads**, independent lines of execution within one running
program that all see the same memory. A language's atomic operations handle
simple cases like incrementing a counter, in a step the hardware guarantees
nothing can interleave with. For anything bigger, a **mutex** (mutual
exclusion lock) lets only one thread at a time run the code between acquiring
and releasing it, a stretch called the **critical section**. The catch is that
the lock has to cover the check and the act together. Guarding each with its
own separate lock still leaves the gap between them open.

**In a shared database**, a mutex in application code doesn't help, because
the requests usually run in different processes or on different servers. The
cheapest fix is to move the check into the write, so the database does both in
one statement: subtract 80 only where the balance is at least 80, and treat
"zero rows changed" as a refusal. A unique constraint does the same for "create
it if it doesn't exist": the second insert fails instead of making a
duplicate. The guarded update, and what to use when the logic is too involved
for one statement, are in
[Optimistic vs. Pessimistic Locking](/systems-and-infrastructure/optimistic-vs-pessimistic-locking).

**Across machines with no shared database**, a
[distributed lock](/systems-and-infrastructure/distributed-locks) plays the
mutex's role, with extra failure modes of its own.

## Race condition vs. data race

A **data race** is narrower: two threads touching the same memory at once, at
least one of them writing, with no synchronization at all. In C and C++ the
language makes no promise about what a program with a data race does. Code can
be free of data races and still have a race condition; the separately locked
check and subtraction above are an example.

## Where you'll meet this

Payments and checkout are where race conditions cost money, beyond the
last-unit-in-stock case. A customer who double-clicks "Pay" can send two
requests that each see the order as unpaid, and if both go on to charge the
card, marking the order paid afterward is too late. The check-then-act has to
happen before the charge: move the order from unpaid to processing only if it
is still unpaid, so the second request changes zero rows and never reaches the
card. A URL
shortener hits the same pattern when two people request the same custom alias
at the same moment and both see it as free, which a unique constraint on the
alias column turns into one success and one clean rejection.
