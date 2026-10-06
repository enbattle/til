---
title: Rate Limiting
summary: Capping how many requests a client may make per unit of time protects shared capacity, and the hard parts are choosing the counting algorithm and making the cap hold across many servers.
date: 2026-09-14
---

Say you run the link-creation endpoint of a URL shortener, `POST /links`. Anyone with an API key can call it, and one buggy script in a loop can fill your database with junk and starve everyone else. **Rate limiting** is the fix: cap how many requests one client may make in a span of time, and refuse the rest. The usual refusal is an HTTP `429 Too Many Requests` response, often with a `Retry-After` header telling the client when to try again.

It's the mirror image of a [circuit breaker](/systems-and-infrastructure/circuit-breaker). A breaker protects a _caller_ from a struggling dependency; a rate limiter protects a _dependency_ from too many callers.

Let's set a policy: **60 requests per minute per API key**. The next question is how to count.

## The simplest count, and its seam

The obvious design is a **fixed window**: one counter per key per clock minute, reset when the minute ends. It is cheap, and it has a hole. A client sends 60 requests at 12:00:59, the counter resets at 12:01:00, and it sends 60 more. That is 120 requests in two seconds, and every one was within the rules. The limit holds per window, not per any 60-second stretch.

## Token bucket: bursts allowed, average capped

The **token bucket** gives each key a bucket that holds up to a fixed number of tokens and refills at a steady rate. Every request takes one token; with none left, the request is rejected (or delayed). For our policy, refill at one token per second and cap the bucket at 10.

A client that has been quiet can spend all 10 at once, a legitimate burst. The 11th request in that instant is refused, and one more is allowed every second after that. Over time the client can't average more than the refill rate, which is the 60 per minute you wanted, though a full bucket plus a minute of refills can admit 70 in one minute.

```python
import time

class TokenBucket:
    def __init__(self, capacity, refill_rate_per_sec):
        self.capacity = capacity
        self.tokens = capacity
        self.refill_rate = refill_rate_per_sec
        self.last_refill = time.monotonic()

    def allow(self):
        now = time.monotonic()
        elapsed = now - self.last_refill
        self.tokens = min(self.capacity, self.tokens + elapsed * self.refill_rate)
        self.last_refill = now

        if self.tokens >= 1:
            self.tokens -= 1
            return True
        return False
```

Each key needs only two numbers (tokens and last refill time), however many requests it makes. The seam is gone too: after a burst of 10, the bucket is empty and more must be earned at one token per second.

A close relative is the **leaky bucket**: it queues requests and releases them at a fixed rate, dropping requests when the queue is full. That suits the opposite situation, where you are the caller and a downstream provider caps you (see [backpressure](/systems-and-infrastructure/backpressure)).

## Sliding windows: exact versus cheap

If you want "no more than 60 in any 60 seconds" without bursts, use a **sliding window**, one that moves with each request instead of resetting on the clock. There are two versions.

The **sliding window log** stores the timestamp of every request. On each new request you discard timestamps older than a minute and count what's left. It is exact, but storage grows with request volume: a key at its limit holds 60 timestamps.

The **sliding window counter** keeps just two numbers, the count for the current fixed minute and the count for the one before. It estimates the sliding total by weighting the previous count by how much of it still overlaps the window. Suppose the last minute had 40 requests, and you are 15 seconds into this one with 30 so far. Three quarters of the previous minute still overlaps, so the estimate is 40 × 0.75 + 30 = 60, at the limit, so the next request is refused. The estimate assumes the previous minute's requests were spread evenly, so it can be off.

## Making the limit hold across servers

So far the counter lived in one process's memory. Put your API behind a [load balancer](/systems-and-infrastructure/forward-vs-reverse-proxy) with ten instances, each enforcing 60 per minute on its own, and a client whose requests spread across all of them gets up to 600.

The fix is to keep the counter somewhere every instance can reach, typically a fast shared store such as Redis, at the price of a network round trip per check.

A shared counter brings a new problem. If an instance reads the count, adds one and writes it back as separate steps, two instances can read the same value and both write the same result, losing an update. That is a [race condition](/systems-and-infrastructure/race-conditions), and the store's atomic increment, which does the read and the add as one step, avoids it. There is a second trap, one level down. Say an instance increments a new key's counter, then crashes before setting the expiry that resets it. That counter now never resets, and the client is eventually blocked for good. The increment and "set the expiry if this was the first increment" must run as one indivisible operation. Stores differ in how they let you do that; Redis, for instance, can run both steps as a single script.

Last, decide what happens when the shared store is down. Failing **open** (letting requests through) keeps your service up but drops protection; failing **closed** keeps protection but refuses everyone. For link creation, open is often sensible.

A rejected client should wait with [exponential backoff](/systems-and-infrastructure/exponential-backoff), not retry in a tight loop.

**Rule of thumb.** Use a token bucket when short bursts are fine and the average is what you protect, a sliding window log when you must bound every span exactly, and always keep the count in one place all your servers share, updated atomically.

## Where you'll meet this

A URL shortener's link-creation endpoint needs a per-client cap, while its read-heavy redirect path can take a much higher ceiling. A notification or email pipeline meets the idea from the other side: as the caller, it must hold its own send rate under what a downstream provider allows. Login and payment endpoints use tight limits to blunt password guessing and card testing (trying stolen card numbers with small charges), and limits between internal services in a [microservices architecture](/systems-and-infrastructure/monolith-vs-microservices) keep one noisy service from drowning its neighbours.
