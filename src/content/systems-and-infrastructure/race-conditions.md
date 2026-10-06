---
title: Race Conditions
summary: Code that is correct for one request can corrupt data when two run at once, and the fix is to make each read-then-write step indivisible.
date: 2026-09-26
---

Picture a shop selling a limited print, with one row in a database holding the
number left in stock. A buyer clicks "Buy," and the server runs three steps:
read the stock, check that it is above zero, then write back the stock minus
one. Tested alone, this works every time. So how can it sell the same print
twice?

When two buyers click at nearly the same moment, the server handles both
requests at once, and their steps can interleave. A **race condition** is a bug
whose result depends on that timing: each request is correct on its own, but
some orders of their steps produce the wrong answer. The name comes from the
two requests racing to a step, where whoever gets there first changes what the
other sees.

## The lost update

Say the stock is 5 and two buyers each take one. The code reads the stock into
a variable, subtracts one, and writes the result back. The line `stock - 1`
looks like a single step, but it is three, and another request can run between
any two of them:

| Time | Request A          | Request B          | Stored stock |
| ---- | ------------------ | ------------------ | ------------ |
| 1    | reads 5            |                    | 5            |
| 2    |                    | reads 5            | 5            |
| 3    | computes 4, writes |                    | 4            |
| 4    |                    | computes 4, writes | 4            |

Two prints sold and the stock fell by one. B's write overwrote A's because B
read before A wrote. This shape is called **read-modify-write**, and the
result is a **lost update**. Nothing crashed and nothing logged an error; the
data is quietly wrong.

## Check-then-act

The second shape is deciding based on something you just looked at, when it can
change between the look and the decision. Now the stock is 1 and the code is:

```python
if item.stock >= 1:       # check
    item.stock -= 1       # act: sell it
```

Both buyers can pass the check before either subtracts, so two prints are sold
and only one exists. The same pattern shows up as "is this username free? then
create it," and, in security, as "is this file safe to open? then open it,"
where an attacker swaps the file in the gap. That general form is called
**time-of-check to time-of-use (TOCTOU)**.

## Why testing misses it

The gap between the read and the write is often a millisecond or less, so the
bad interleaving needs two requests for the same item to land inside it. One
person clicking through a test environment almost never does that. Under
production load, with many buyers after the same print, it can happen
regularly. Adding logging or attaching a debugger can also hide the bug,
because both change the timing. To reproduce it on purpose, force the
interleaving: put a short delay between the check and the act, then send two
requests at once.

## Closing the gap

Every fix makes the check and the act, or the read and the write, happen as one
step that nothing else can interleave with. Such a step is **atomic**. Which
tool gives you that depends on where the shared data lives.

**Inside one process.** Suppose the stock count lived in one server's memory. A server often handles requests on separate
**threads**, independent lines of execution within one program that share its
memory. For a simple counter, many languages offer atomic operations that the
hardware runs as one step. For anything bigger, a **mutex** (mutual exclusion
lock) lets only one thread at a time run the code between acquiring and
releasing it, a stretch called the **critical section**. The lock has to cover
the check and the act together. Guarding each with its own lock leaves the gap
between them open.

**In a shared database.** Requests usually run in different processes or on
different servers, so a mutex in your application code protects nothing. The
cheapest fix is to move the check into the write, so the database does both in
one statement: subtract one from the stock only where the stock is at least
one, then treat "zero rows changed" as "sold out." Databases typically lock a row they
change until the transaction commits, so a second buyer's update waits, then
checks against the new stock. A unique constraint does the same
for "create it if it doesn't exist": the second insert fails instead of
producing a duplicate. When the logic is too involved for one statement, see
[Optimistic vs. Pessimistic Locking](/systems-and-infrastructure/optimistic-vs-pessimistic-locking).

**Across machines with no shared database,** a
[distributed lock](/systems-and-infrastructure/distributed-locks) plays the
mutex's role, with failure modes of its own.

## Race condition vs. data race

A **data race** is narrower: two threads touching the same memory at once, at
least one of them writing, with no synchronization. In C and C++ the language
sets no rules at all for what such a program does. Code can be free of data
races and still have a race condition. Our shop is an example if the check and
the subtraction each take their own lock: no memory is touched unsafely, yet
the last print still sells twice.

**Rule of thumb.** Whenever the answer to "what happens if two of these run at
the same moment?" is "I'm not sure," find the read-then-write, and fold it into
one atomic step: a single guarded statement, a unique constraint, or a lock
that covers both halves.

## Where you'll meet this

Payments and checkout are where a race costs money. A customer who
double-clicks "Pay" can send two requests that each see the order as unpaid,
and marking it paid after the charge is too late. Move the order from unpaid to
processing in one guarded update before charging, and the second request
changes zero rows and never reaches the card. A URL shortener hits the same
pattern when two people request the same custom alias at once and both see it
free; a unique constraint on the alias turns that into one success and one
clean rejection.
