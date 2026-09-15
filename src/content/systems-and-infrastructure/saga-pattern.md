---
title: Saga Pattern
summary: Replacing a distributed transaction with a sequence of local steps, each with a compensating action to undo it if a later step fails.
date: 2026-09-15
---

A **saga** coordinates a business operation that spans multiple services
— each with its own database — as a sequence of local transactions,
each with a defined **compensating transaction** that undoes it if a
later step fails. There's no distributed transaction wrapping the whole
operation; instead, correctness comes from always having a way to unwind
whatever has already happened.

## Why a single-database transaction's guarantee disappears across services

A transaction inside one database gives atomicity for free: either
everything in it commits, or nothing does. Once an operation spans
multiple services, each owning its own data, there's no shared
transaction coordinator that can offer the same guarantee without an
unacceptable cost to availability — a related tension to what
[CAP theorem](/systems-and-infrastructure/cap-theorem) describes, and
part of why coordinating a single transaction across multiple databases
falls out of favor as a system grows. A saga accepts that intermediate
states are real and briefly visible to the rest of the system, and
designs explicitly for how to recover if a later step fails, rather than
trying to prevent that visibility altogether.

## A worked example: booking a trip

A trip-booking saga might run: reserve a flight, then reserve a hotel,
then charge the card. If charging the card fails after the flight and
hotel are already reserved, the saga doesn't just give up — it runs
compensating actions in reverse order: cancel the hotel reservation,
then cancel the flight reservation. The end state is "nothing booked,
nothing charged," reached deliberately through undo steps, rather than
"two paid-for reservations with no successful booking to show for them,"
which is what simply stopping at the point of failure would leave
behind.

## Orchestration vs. choreography

Two ways to actually run the sequence of steps and compensations:

- **Orchestration** — a central coordinator explicitly calls each step
  in order and decides what to do if one fails. Easier to follow and
  test, since the whole flow lives in one place, at the cost of adding a
  new central component everything depends on.
- **Choreography** — each service reacts to an event from the previous
  step and emits its own event when it's done, with no central
  coordinator at all. There's no single point of control, but the
  overall flow becomes implicit: reconstructing "what happens when
  payment fails" means tracing event handlers across every service
  involved, rather than reading one place.

## Living with partial state

Publishing each step's outcome reliably — so the next step, or a
compensation, actually fires — is exactly the problem the
[Outbox Pattern](/systems-and-infrastructure/outbox-pattern) solves;
sagas are usually built on top of it, not as a replacement for it.

A flight reserved with no hotel booked yet is a state someone else in
the system can actually observe — the saga's job is to make sure there's
always a way back out of it, not to pretend it never happens.
