---
title: Saga Pattern
summary: Splitting an operation across services into local steps, each paired with a compensating step that undoes it if a later step fails.
date: 2026-09-15
---

You are building checkout for a shop. A customer buys a laptop, and three
services have to agree: **inventory** sets one laptop aside, **payments**
charges the card, and **shipping** books a courier. Each service owns its own
database. What happens if the card is declined after the laptop is already set
aside?

Inside a single database the answer is free. You wrap the work in a
**transaction**, which commits everything or nothing, and a failure rolls all of
it back. Across three services there is no such wrapper. Protocols that make
several databases commit together, such as **two-phase commit** (every database
first promises it can commit, then a coordinator tells them all to), make each
database hold its locks until all of them agree. If the coordinator dies
partway, those locks stay held and block every other order that touches the
same rows. That is a cousin of the tension
[CAP theorem](/systems-and-infrastructure/cap-theorem) describes between
staying consistent and staying available.

## What a saga does instead

A **saga** gives up on "all at once" and runs the operation as a sequence of
**local transactions**, one per service, each committing on its own. Every step
that changes something is paired with a **compensating transaction**, a second
step that undoes the first one's business effect.

For checkout, the pairs look like this:

| Step               | Compensation            |
| ------------------ | ----------------------- |
| Reserve the laptop | Release the reservation |
| Charge the card    | Refund the charge       |
| Book the courier   | Cancel the booking      |

If the courier booking fails, the saga runs the compensations for the steps that
already succeeded, newest first: refund the card, then release the laptop. The
order ends in "nothing reserved, nothing charged," reached on purpose. Stopping
at the failure instead would leave a paid order with nothing shipping.

## Compensation is not rollback

A rollback erases a change as if it never happened. A compensation is a new
action that runs after the original one committed, so the original was real for
a while. The laptop showed as unavailable to other shoppers. The customer saw a
charge on their statement before the refund arrived. A saga is atomic in the end
state, but it is not **isolated**: other requests can see the half-finished
order in the middle. You design for that. Mark the order "pending" so a page
doesn't show it as confirmed, and give reservations an expiry.

This also suggests an ordering rule. Put steps that are hard or impossible to
undo, such as sending an email or handing a parcel to a courier, last, after
every step that can still fail. The reservation is cheap to release, so it goes
first.

## Who runs the steps?

There are two ways to drive the sequence, and the choice is the main design
decision.

**Orchestration** puts one coordinator in charge. It calls inventory, then
payments, then shipping, and on a failure it calls the compensations itself. The
whole flow is readable in one place, and you can test it there. The cost is a
central component that every order depends on. A
[workflow engine](/systems-and-infrastructure/workflow-engines) is
infrastructure built to be that coordinator, including remembering where an
order stood if the coordinator crashes mid-way.

**Choreography** has no coordinator. Inventory publishes "laptop reserved,"
payments reacts to that and publishes "card charged," shipping reacts to that.
A failure is another event: "payment failed" makes inventory release its
reservation. There is no coordinator to break, but the flow now exists only as a
pattern spread across handlers. To answer "what happens when payment fails?" you
read every service.

With two or three steps, choreography is pleasant. As the steps and branches
multiply, the missing overview costs more, and orchestration usually wins.

## Making the steps safe to retry

Messages get delivered more than once and services crash between doing a step
and confirming it was done, so each step and each compensation must be safe to run twice.
Refunding the same charge twice must refund it once, which is the job of
[idempotency](/systems-and-infrastructure/idempotency), usually done by sending
a key built from the order's ID and the step's name with every call, so the
refund isn't mistaken for a repeat of the charge. A step also has to commit its own database change
and announce the result without losing one of the two; the
[outbox pattern](/systems-and-infrastructure/outbox-pattern) exists for this, and
sagas are usually built on top of it. Events that still can't be processed after
retries are parked for a person to look at, as described in
[message queues](/systems-and-infrastructure/message-queues).

A compensation can itself fail. You can't give up on it, because the order would
be stuck half undone, so you retry it, and if it keeps failing you park it for a person, as with any
other stuck event. That is why you choose
compensations that can always eventually succeed: a refund can, while "un-send
this email" cannot.

**Rule of thumb.** Use a saga when one business operation spans services that
each own their data, and write the undo step for every step before you write
the step. Prefer an ordinary transaction whenever the data lives in one database.

## Where you'll meet this

In payments, a transfer between two ledgers kept in separate databases is a
two-step saga: debit one account, credit the other, and if the credit fails,
post a reversing credit to the first account rather than deleting the debit, so
the ledger keeps a record of both.
