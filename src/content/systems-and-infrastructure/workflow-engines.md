---
title: Workflow Engines and Durable Execution
summary: A workflow engine saves a multi-step process's progress after each step, so a crash, a deploy or a week-long wait resumes where it left off instead of starting over.
date: 2026-09-21
---

Take one order in an online shop. You charge the card, reserve the stock, wait for the warehouse to confirm, and email the customer. If the warehouse says no, you refund the card. That is several steps across several services, with a wait that could last days, and it has to end in a sensible state even if a server dies after step two.

A **workflow engine** runs processes like this one. The property it provides is **durable execution**: after each step, the engine records the progress in durable storage, so a crashed process can be picked up by another machine at the step it had reached.

## Why not just use a queue?

You might reach for a [message queue](/systems-and-infrastructure/message-queues). It handles one message at a time and remembers nothing about the larger process. To run the order on queues, you would send a message for step one, have its consumer send a message for step two, and so on. Beside that, you keep a database row recording how far each order has got.

Then the extras arrive. Each step needs retry logic. A scheduled job has to notice orders stuck in the middle. Something has to fire a timeout if the warehouse never answers. Each piece is manageable, but together they are a small workflow engine written by hand, and you now own its bugs.

## What the engine does for you

You describe the order's steps, as code or as a declarative definition depending on the product, and the engine keeps the state, runs the steps and decides what happens next.

- **Persisted progress.** The result of "charge the card" is stored before "reserve stock" begins. Temporal, for example, keeps a history of what the workflow has done and re-runs the workflow code against that history to rebuild its state. That is why such code has to be deterministic: no reading the clock or random numbers directly, because a replay must reach the same decisions.
- **Retries.** If the stock service is down, the step is retried on a policy, typically with [backoff](/systems-and-infrastructure/exponential-backoff), instead of in a loop you wrote.
- **Timers and waiting.** The order can sleep for three days, or wait for a signal such as the warehouse's confirmation, without holding a thread or a process open. The engine wakes it when the time comes.
- **Compensation.** If the warehouse refuses for good, the workflow runs the cleanup steps you defined for the earlier ones, here the card refund.

AWS Step Functions and Temporal are two examples of the category.

## How does this relate to a saga?

The [saga pattern](/systems-and-infrastructure/saga-pattern) is a design: split a cross-service operation into local steps, each with an undo. Our order is a saga. A workflow engine is infrastructure that can run one.

Written by hand, an orchestrated saga is a coordinator service you build and operate, including its state storage and recovery. With an engine, you still write the sequence and the compensations, and the engine makes sure they run, even after a crash. It doesn't make a compensation correct: a refund is a new action, not an undo, and the customer may have seen the charge appear in the meantime.

## Does each step run exactly once?

No. Durable execution guarantees that progress is remembered, not that a step runs exactly once. Suppose the worker charges the card and dies before the engine records the result. The engine sees no result, so it retries the step, and the card is charged twice unless the call is [idempotent](/systems-and-infrastructure/idempotency), meaning a repeat has no further effect. The usual answer is an idempotency key derived from the workflow and the step, so a retry sends the same key and the payment service recognizes it.

Starting the workflow has a similar trap. Saving the order and starting its workflow are writes to two systems, so a crash between them can leave a paid-for order with no workflow. Writing the "start" request through an [outbox](/systems-and-infrastructure/outbox-pattern) closes that gap.

## When is a queue enough?

If the work is one step, or independent steps that don't depend on each other's outcomes (send this email, resize this image), use a queue and [workers](/systems-and-infrastructure/worker-pools). Our order is different: its steps depend on each other, one wait is measured in days, and a failure must be undone. When you would otherwise be writing that state machine yourself, an engine pays for itself. It is another system to run and learn, so it should be earning its place.

**Rule of thumb.** Use a plain queue for one step or for independent steps. Reach for a workflow engine when a process has dependent steps, long waits or undo on failure, and make every step idempotent either way, because steps still run more than once.

## Where you'll meet this

Payments and checkout is the clearest home: the order above, with each step recorded so a crash resumes at the step it reached instead of losing the order, and an idempotency key on the charge keeping a retry from charging twice. A notification or email pipeline uses one when a message is really a sequence, such as a reminder that goes out after three days unless the user has already acted. Chat rarely needs one, since sending a message is a single step that a queue handles well.
