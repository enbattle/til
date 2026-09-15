---
title: Rate Limiting
summary: Capping how often a client can call you protects shared capacity — the algorithms behind it, and the trap of enforcing it per server instead of globally.
date: 2026-09-14
---

**Rate limiting** caps how many requests a client can make within a given
window of time, protecting a shared service from being overwhelmed by any
single caller. It's the mirror image of a
[circuit breaker](/systems-and-infrastructure/circuit-breaker): a circuit
breaker protects a _caller_ from a struggling dependency, while rate
limiting protects a _dependency_ from too many callers.

## The token bucket: allowing bursts without allowing abuse

One common algorithm, the **token bucket**, works like an actual bucket
that holds up to some fixed number of tokens and refills at a steady
rate. Every request consumes one token; if the bucket is empty, the
request gets rejected or delayed until it refills. This design allows
short bursts — a client can spend everything sitting in the bucket at
once — as long as its average rate over time stays within the refill
rate.

```python
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

A related approach, the **leaky bucket**, instead queues incoming
requests and processes them at a fixed rate no matter how bursty their
arrival was — smoothing traffic to a constant output rate rather than
letting bursts through at all.

## Why a simple running count isn't quite precise enough

Both bucket approaches track a running balance rather than individual
request timestamps, which is efficient but slightly imprecise right at
the edge of a time window: a client could send a full burst right before
a fixed window resets, then another full burst right after — doubling up
at the seam between windows. **Sliding window** approaches fix this by
looking at a continuously moving window instead of a fixed one that
resets on a clock tick, at different cost points:

- **Sliding window log** — record the exact timestamp of every request,
  and on each new one, drop anything older than the window and count
  what's left. Exactly correct, but the amount of data stored grows with
  request volume rather than staying constant.
- **Sliding window counter** — an approximation that stays cheap: keep a
  count for the current fixed window and the one before it, and weight
  the previous window's count by how much of it still overlaps the
  sliding window. This assumes requests were spread evenly through the
  previous window, which isn't exactly true, but it's close enough for
  most rate limiters at a fraction of the log approach's storage cost.

## Making the limit hold across many servers

A counter that only lives in one process's memory only limits requests
that happen to land on _that_ process. Behind a load balancer spreading
traffic across ten instances, each independently enforcing "100 requests
per minute" effectively allows 1,000 requests per minute in total — the
limit was real, just not shared. The fix is centralizing the counter
somewhere every instance can see, typically a fast, shared, external
store built for this kind of thing (Redis is a common choice).

That introduces its own subtlety: incrementing the shared counter and
setting its expiry have to happen together, atomically. If a process
increments the counter, then crashes before setting its expiry, that
counter can be left permanently in place, silently rate-limiting that
client forever. Systems built for this kind of shared state generally
provide a way to run "increment, and set an expiry only if this was the
very first increment" as one indivisible operation — the specific
mechanism varies by store, but the requirement is the same everywhere:
the two steps can't be allowed to happen as separate, individually
interruptible operations.

## Where it applies

Public-facing APIs (per-API-key limits are standard across most SaaS
products), internal service-to-service calls inside a
[microservices architecture](/systems-and-infrastructure/monolith-vs-microservices),
and login endpoints, where rate limiting doubles as a standard defense
against brute-force password guessing. Because it protects the opposite
side of a call from what a circuit breaker protects, a resilient system
generally needs both, not one instead of the other.
