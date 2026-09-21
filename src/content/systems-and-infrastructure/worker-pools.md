---
title: Worker Pools
summary: A fixed number of workers that pull jobs from a queue, which caps how much work runs at once and lets the backlog absorb the rest.
date: 2026-09-21
---

A **worker pool** is a fixed number of workers, each a thread, a
process, or a whole server, that repeatedly take a job from a shared
[queue](/systems-and-infrastructure/message-queues), run it, and come
back for the next. The number of workers is set in advance and changed
deliberately rather than per job. That is the point: the pool puts a
ceiling on how much work runs at once, and jobs beyond that ceiling wait
in the queue instead of all starting at the same moment.

The alternative is to start a new thread or process for every job. That
works until a spike arrives, at which point thousands of simultaneous
jobs fight over the CPU, memory and downstream services until everything
slows down together. A pool turns that into a queue and a steady rate of
completion.

## How many workers?

The right size depends on what each job spends its time doing.

A **CPU-bound** job keeps a processor busy the whole time, for example
encoding a video or hashing a large file. A core can only run one such
job at a time, so workers beyond the number of cores add no speed; they
only add switching overhead. A pool for this kind of work is sized close
to the core count.

An **I/O-bound** job mostly waits: for a database reply, an HTTP
response, a disk read. While it waits it uses almost no CPU, so a core
can serve many such jobs by switching between them, and the pool can be
much larger than the core count. How large depends on the ratio of
waiting to working. If a job spends 90% of its time waiting, roughly ten
workers can share one core's worth of computing.

Real jobs are usually a mix, so measure: start from a guess, watch CPU
use and job latency, and adjust.

Workers also consume resources that are limited elsewhere. If each
worker holds a database connection while it works, a pool of 200 workers
against a
[connection pool](/systems-and-infrastructure/database-connection-pooling)
of 20 leaves 180 of them idle, waiting for a connection. The smaller
number is the effective limit.

## Queue depth tells you when to scale

**Queue depth** is the number of jobs waiting. A depth near zero means
the workers are keeping up. A depth that climbs and doesn't come back
down means jobs are arriving faster than the pool finishes them, and
more workers (or faster jobs) are needed. The age of the oldest waiting
job is often more useful than the raw count, since it is what a user
actually experiences as delay. This is why worker fleets are commonly
autoscaled on queue depth rather than on CPU: an I/O-bound pool can be
badly behind while its CPUs look idle.

Adding workers only helps if something else isn't the bottleneck. If the
jobs all hit one database that is already at its limit, more workers
make things worse, and the right response is to slow the producers or
reject work, which is
[backpressure](/systems-and-infrastructure/backpressure).

## A slow job takes a whole worker

Each worker handles one job at a time, so a job that takes an hour
occupies a worker for an hour. If enough of them arrive together, every
worker is stuck on a long job and quick jobs queue behind them. The
usual fixes are separate queues and pools for slow and fast work, and a
per-job time limit, so one stuck job can't hold a worker forever.

## Shutting down without losing work

Deploys and scale-downs stop workers, sometimes mid-job. A **graceful
shutdown** has the worker stop taking new jobs, then either finish what
it holds within a time limit or hand it back to the queue. If a worker
is killed outright, an unacknowledged job typically reappears (after its
visibility timeout, on brokers that use one) and another worker runs it
from the start, which is safe only if the job is
[idempotent](/systems-and-infrastructure/idempotency).

## Where you'll meet this

A URL shortener rarely needs one for the redirect itself, but it does
for the background work around it, such as counting clicks or checking
new links against a blocklist, where an I/O-bound pool absorbs bursts
without slowing redirects. A news feed uses workers to update
followers' timelines after a post, and a very popular account turns
that into a large backlog worth watching. In a notification pipeline the
pool is the sending stage, and its size is often set by what the mail
or push provider will accept.
