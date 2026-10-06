---
title: Latency vs. Throughput
summary: Latency is how long one request takes and throughput is how many a system finishes per second, and tuning one often costs you the other.
date: 2026-09-14
---

Imagine a service that records user events, such as clicks and page views, by writing a row to a database for each one. Two numbers describe how well it performs, and they sound like the same thing. **Latency** is how long a single request takes from start to finish ("this event was saved 120 milliseconds after it arrived"). **Throughput** is how much work the system finishes per unit of time ("it can save up to 5,000 events per second"). Why can't you always have both at once?

## Why does improving one hurt the other?

Take the event service. Suppose every database write has a fixed cost of 10 ms (a network round trip plus the commit, the step that makes the write durable), and each row inside the write adds 0.1 ms. Writing events one at a time costs 10.1 ms each, so a lone write's latency is low, about 10 ms. But one writer, waiting on each write before starting the next, manages only about 99 writes per second, because each one pays the full 10 ms.

Now suppose events arrive at 1,000 per second. One at a time, the service falls far behind, and a line of unsaved events grows without limit. The standard fix is **batching**: collect 100 events and write them together. That costs 10 + 100 × 0.1 = 20 ms per batch, which is 5,000 events per second of capacity, fifty times better. See [Batching and Asynchronous Writes](/systems-and-infrastructure/batching-and-asynchronous-writes) for the full technique.

Look at what happened to latency, though. At 1,000 events per second, a batch of 100 takes 100 ms to fill. The first event in a batch waits about 100 ms for its companions and then another 20 ms to be written: 120 ms, where a lone write took 10. The last event waits no time to fill and takes 20 ms. Averaged over the batch, it's about 70 ms. Capacity went up fiftyfold, and each event now takes about seven times as long as a lone write would. At 1,000 a second that is still a win, since the unbatched line was growing without limit, but at low traffic you would be paying latency to buy throughput nobody needs.

## What about adding more workers?

The other way out is to run many writers at once. Several workers writing in parallel (a [worker pool](/systems-and-infrastructure/worker-pools)) raise throughput, because while one waits on the database another can be working. Little's Law, below, says how many: at 1,000 events a second and 10.1 ms each, about 10 writers keep up without batching. But the workers share things: the database's connections, a lock on a hot row, the CPU. Past some point each new worker mostly adds waiting, so every request takes longer, and total throughput flattens and can even fall. Doubling the workers doesn't double anything once the shared resource is the limit.

## How do the two numbers connect?

**Little's Law** ties them together: `L = λW`. Here `L` is the average number of requests inside the system at once, `λ` (lambda) is the rate at which requests arrive, and `W` is the average time each spends in the system, which is its latency. It holds for any stable system, whatever its internals.

Check it against the batched service. Events arrive at 1,000 per second and spend about 0.07 s each in the system, so `L = 1,000 × 0.07 = 70` events are in flight on average: the ones waiting for a batch to fill and the ones being written. The law makes one fact hard to ignore. If you hold throughput fixed and latency rises, more work piles up inside the system. If you push arrivals past what the system can finish, `L` has nowhere to level off, and a queue grows. That queue is where latency goes to get much worse; the usual defence is [backpressure](/systems-and-infrastructure/backpressure), refusing or slowing new work instead of letting the line grow. The raw costs behind numbers like the 10 ms above are in [Numbers Every Engineer Should Know](/engineering-practices/numbers-every-engineer-should-know).

## Which one should you optimize?

It depends on who is waiting. If a person is watching a screen, latency wins, and you should look at the slow tail as well as the average. A "p99" latency is the time that 99 percent of requests beat, so the slowest 1 percent are worse than that. If nobody is waiting on any individual item, such as a nightly job loading millions of records, throughput wins and a long wait per record is fine.

You can bound the latency cost by batching on size and on time: write when 100 events have gathered or when 20 ms have passed, whichever comes first. Under heavy load batches fill to the size limit and throughput stays high; when traffic is light, the time limit keeps latency bounded. When one system holds both kinds of work, a [message queue](/systems-and-infrastructure/message-queues) between them lets each side run at its own pace.

**Rule of thumb.** Decide who is waiting on each request. If a person is, protect latency and batch only up to a short, fixed time limit. If no one is, batch as large as memory and failure recovery allow, and measure both numbers whenever you change either.

## Where you'll meet this

In chat and messaging, a message should show up in well under a second, so senders are served one at a time or in tiny batches, while the history written behind the scenes can be grouped heavily. A notification or email pipeline serves both kinds: a password-reset message is latency-sensitive and a bulk announcement is throughput-sensitive, so the two usually travel on separate queues so a large send doesn't sit in front of an urgent one.
