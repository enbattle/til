---
title: Worker Pools
summary: A fixed number of workers pull jobs from a queue, which caps how much runs at once, sizes the pool by what the jobs wait on, and lets the backlog absorb a burst.
date: 2026-09-21
---

Say you run a photo-sharing site on one 8-core server. Every upload needs a thumbnail, and resizing an image takes about 200 ms of CPU. The simplest design starts a new thread for each upload. That is fine on a quiet day. Then a popular event ends, 1,000 photos arrive within a few seconds, and you have 1,000 threads, each holding a decoded image in memory, all competing for 8 cores. Nothing finishes quickly, memory climbs, and the server may fall over.

A **worker pool** fixes this. It is a fixed number of workers (threads, processes or whole servers) that repeatedly take a job from a shared [queue](/systems-and-infrastructure/message-queues), run it, and come back for the next. The count is set in advance and changed on purpose, not once per job. Jobs beyond what the workers can hold wait in the queue instead of all starting at once.

## How many workers?

Start with the burst. The total work is 1,000 jobs at 200 ms, which is 200 CPU-seconds. Spread over 8 cores, that takes at least 25 seconds. A pool of 8 gets close to that floor; 1,000 threads only add switching and memory pressure on top. The pool doesn't make the work smaller. It changes how the work is shaped: 8 images in memory at a time instead of 1,000, and the first photos are done in a fraction of a second instead of everyone finishing at the end.

Why 8 workers, though? Because resizing is **CPU-bound**: the job keeps a processor busy the whole time. A core runs one such job at a time, so a ninth worker adds switching overhead and no speed. For CPU-bound work, size the pool near the core count.

Now add a second step. After the resize, the worker puts an upload job on a second queue, served by its own pool, which sends the result to object storage. Suppose an upload takes 450 ms of waiting for the network and about 50 ms of CPU. This job is **I/O-bound**: it mostly waits, and a waiting job barely uses the CPU. If 90% of a job's time is waiting, about ten workers can take turns on one core, so 8 cores could support roughly 80 workers. The ratio of waiting to working sets the size, and real jobs are mixes, so treat the arithmetic as a starting guess. Watch CPU use and job latency, then adjust.

Workers also use things that are limited elsewhere. If each of those 80 workers holds a database connection while it runs, and the [connection pool](/systems-and-infrastructure/database-connection-pooling) has 20, then at most 20 workers make progress at a time and 60 sit waiting for a connection. The smallest limit along the path is the real size of the pool.

## When do you add workers?

Say uploads settle at 50 a second, but your pool finishes 40 a second. The queue grows by 10 jobs a second, so after a minute 600 jobs are waiting. **Queue depth**, the number of jobs waiting, near zero means the workers keep up. A depth that climbs and doesn't come back down means jobs arrive faster than they finish. How long jobs wait is often more useful than the count: here, the oldest waiting job arrived about 12 seconds ago, and one joining now waits about 15 (600 jobs at 40 a second). That is the delay a user feels. This is also why fleets of workers are often autoscaled on queue depth and not on CPU. An I/O-bound pool can be far behind while its CPUs look idle.

Adding workers helps only if the workers were the bottleneck. If every job hits one database that is already at its limit, more workers make it worse, and making each job faster is the better lever. The answer then is to slow the senders or turn work away, which is [backpressure](/systems-and-infrastructure/backpressure).

## What if one job is slow?

Each worker handles one job at a time. Suppose users can also export a whole album as a zip, which takes ten minutes. If eight exports arrive together, all eight workers are busy for ten minutes, and every thumbnail waits behind them. Two fixes are common: separate queues and pools for slow and fast work, so exports can only exhaust their own workers, and a per-job time limit, so a stuck job cannot hold a worker forever.

## What happens on a deploy?

Deploys and scale-downs stop workers, sometimes mid-job. In a **graceful shutdown**, the worker stops taking new jobs, then either finishes its current one within a time limit or hands it back to the queue. If a worker is killed outright, its job was never **acknowledged**, meaning the worker never told the broker (the queue's server) "done". An unacknowledged job typically reappears (after its visibility timeout, on brokers that use one) and another worker starts it from the beginning. The thumbnail may be generated twice, which is harmless here. It is safe in general only if the job is [idempotent](/systems-and-infrastructure/idempotency).

**Rule of thumb.** Size the pool by what its jobs wait on: near the core count for CPU-bound work, larger for I/O-bound work, never beyond the tightest downstream limit. Watch queue depth and the oldest job's age, and keep slow jobs in a pool of their own.

## Where you'll meet this

In a notification or email pipeline, the pool is the sending stage, and its size is usually set by how many requests the mail or push provider accepts at once, not by your CPUs. In a news feed, workers update followers' timelines after a post, and a very popular account turns one post into a large burst of jobs. In a URL shortener, the redirect itself rarely needs a pool, but background work such as counting clicks or checking new links against a blocklist does.
