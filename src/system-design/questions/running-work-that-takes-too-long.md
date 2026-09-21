---
title: How do I run work that takes too long for a single request?
summary: How to move slow or multi-step work out of the request, from a plain queue with workers to a workflow engine, and what each one needs to be safe.
date: 2026-09-21
order: 8
---

Generating a report takes ninety seconds. An uploaded video has to be
processed. A signup should send an email, but the email provider is sometimes
down. A checkout has several dependent steps and waits for a warehouse to
confirm. Done inside the web request, each of these times out, ties up a server
thread while it waits, or turns a traffic spike into an outage. The fix is to
take the work out of the request, and how far you go depends on how many steps
there are and how long they wait.

## First, whether the user has to wait

If the person needs the result right now, a direct call is simpler than any of
this. Moving work out of the request fits only when the caller can be told
"accepted" and get the result later. To find out which step is slow before
deciding, use
[How do I figure out what's wrong with my system?](/system-design/figuring-out-whats-wrong)

## A queue and workers

A [message queue](/systems-and-infrastructure/message-queues) lets the request
hand the work off and return, and
[workers](/systems-and-infrastructure/worker-pools) do it at their own pace.
It buys decoupling: neither side needs the other to be up or as fast. It costs
you an immediate answer, and because delivery is at-least-once the work has to
be [idempotent](/systems-and-infrastructure/idempotency). The worker pool's
size and scaling depend on what the jobs do, which its topic covers.

## Plan for the ways it goes wrong

A message that fails every time shouldn't be retried forever, and a
[dead letter queue](/systems-and-infrastructure/dead-letter-queue) holds it for
a person to look at. If producers outpace the workers, the backlog grows
without limit, which is what
[backpressure](/systems-and-infrastructure/backpressure) is for. And saving a
record and enqueueing the message about it are two writes to two systems, so a
crash between them can lose the message; the
[outbox pattern](/systems-and-infrastructure/outbox-pattern) closes that gap.

## When the work is a process, not a job

A queue with workers covers one step, or independent steps. Several dependent
steps, waits of hours or days, or undoing earlier steps on failure is where a
[workflow engine](/systems-and-infrastructure/workflow-engines) starts to earn
its place. It runs a [saga](/systems-and-infrastructure/saga-pattern) but
doesn't replace designing one, and it's another system to operate.

## How they combine

Most systems start with a queue and workers and add the safeguards above as
they meet the failures. Whatever you choose, decide how the result will reach
the user; for one that should appear on its own, see
[How do I push live updates to users?](/system-design/pushing-live-updates-to-users)

## When it isn't this problem

If the request is slow because a database or a dependency is slow, not because
the work itself is long, fix that first:
[reads](/system-design/database-cant-keep-up-with-reads),
[writes](/system-design/database-cant-keep-up-with-writes) or
[How do I stop one failing service from taking everything else down?](/system-design/one-failing-service-taking-down-others)
