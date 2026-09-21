---
title: Workflow Engines and Durable Execution
summary: A system that saves the progress of a multi-step process after every step, so a crash, a deploy or a week-long wait resumes where it left off instead of starting over.
date: 2026-09-21
---

Some work is a process rather than a single job: charge a card, reserve
stock, wait for a warehouse to confirm, email the customer, and if the
warehouse says no, refund the card. It takes several steps across
several services, may wait days for an outside event, and has to end in
a sensible state even if a server dies partway through. A **workflow
engine** runs processes like this, and the property it provides is
**durable execution**: after each step, the engine records the progress
in durable storage, so a crashed process can be picked up by another
machine at the step it had reached.

## What a plain queue leaves you to build

A [message queue](/systems-and-infrastructure/message-queues) handles
one message at a time and remembers nothing about the larger process. To
run five steps on queues, you would send a message for step one, have its
consumer send a message for step two, and so on, while keeping a row in a
database to record how far each order has got. Then you add retry logic
for each step, a scheduled job to notice orders stuck in the middle, and
something to fire a timeout if the warehouse never answers. Each piece
is manageable; together they are a small workflow engine written by
hand.

A workflow engine supplies that bookkeeping. You describe the steps, as
code or as a declarative definition depending on the product, and the
engine keeps the state, runs the steps, and decides what happens next.

## What the engine does for you

- **Persisted progress.** Each step's result is stored before the next
  begins. Temporal, for example, does this by keeping a history of what
  the workflow has done and re-running the workflow code against that
  history to rebuild its state, which is why that code has to be
  deterministic (no reading the clock or random numbers directly).
- **Retries.** A step that fails is retried on a policy, typically with
  [backoff](/systems-and-infrastructure/exponential-backoff), instead of
  in a loop you wrote.
- **Timers and waiting.** A workflow can sleep for three days, or wait
  for an external signal such as a payment confirmation, without holding
  a thread or a process open; the engine wakes it when the time comes.
- **Compensation.** When a later step fails for good, the engine runs the
  cleanup steps you defined for the earlier ones.

AWS Step Functions and Temporal are two examples of the category.

## How this relates to a saga

The [saga pattern](/systems-and-infrastructure/saga-pattern) is a
design: break a cross-service operation into local steps, each with an
undo. A workflow engine is infrastructure that can run one. Written by
hand, an orchestrated saga is a coordinator service you build and
operate, including its state storage and recovery. In an engine, the
sequence and the compensations still have to be written by you, and the
engine's job is to make sure they run, even after a crash. The engine
doesn't make a compensation correct (a refund is still a new action, not
an undo), and it doesn't remove the need to think about the intermediate
states others can observe.

## Steps still run more than once

Durable execution guarantees that progress is remembered, not that a
step runs exactly once. If a step charges a card and the worker dies
before the engine records the result, the step is retried, and the card
is charged again unless the call is
[idempotent](/systems-and-infrastructure/idempotency). The
usual answer is to derive an idempotency key from the workflow and step,
so a retry reuses it.

Starting the workflow has the same dual-write shape as publishing an
event. Saving an order and starting its workflow are writes to two
systems, so a crash between them can leave an order with no workflow.
Writing the "start" request through an
[outbox](/systems-and-infrastructure/outbox-pattern) closes that gap.

## When a queue is enough

If the work is one step, or independent steps that don't depend on each
other's outcomes (send this email, resize this image), use a queue and
[workers](/systems-and-infrastructure/worker-pools). Reach for a
workflow engine when the process has several dependent steps, waits
measured in hours or days, or needs undoing on failure, and you would
otherwise be writing the state machine yourself. An engine is another
system to run and learn, so it should be earning its place.

## Where you'll meet this

Payments and checkout is the clearest home: authorize the card, reserve
stock, ship, and refund if a later step fails, with waits for
confirmations along the way. A notification pipeline uses one when a
message is really a sequence, such as a reminder that goes out after
three days unless the user has already acted. Chat rarely needs one,
since sending a message is a single step that a queue handles well.
