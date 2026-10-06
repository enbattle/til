---
title: Circuit Breaker
summary: A circuit breaker stops calls to a failing dependency so callers fail fast and the dependency gets room to recover, instead of retries piling on.
date: 2026-09-14
---

Picture a checkout service that calls a payment provider to charge each order. It takes 200 orders a second, and it has a pool of 200 worker threads (a thread is one unit of work running at a time; a request that is waiting on the provider occupies one). Normally the provider answers in 100 milliseconds, so each thread is busy for a tenth of a second and only about 20 of the 200 are busy at once.

Now the provider starts hanging. Your calls don't fail, they wait, because you set a **timeout** of 10 seconds: the longest you'll wait before giving up. What happens next? Each request holds a thread for 10 seconds, 200 new requests arrive every second, and so all 200 threads are taken within about a second. Checkout can no longer serve anything, including the requests that never needed the provider. A slow dependency has become your outage.

A **circuit breaker** is the fix, named after the electrical part that cuts power before a wire melts. It is a small wrapper around the call to the provider that watches how the calls are going, and once they are clearly failing it stops making them.

## The three states

The breaker is always in one of three states.

- **Closed** is normal operation. Calls go through to the provider, and the breaker counts failures. (The name is the electrical one: a closed circuit lets current flow.)
- **Open** means the failure count crossed a threshold, say five failures in a row. Now every call fails immediately without being sent, for a cooldown period such as 30 seconds.
- **Half-open** begins when the cooldown ends. The breaker lets a trial call through. If it succeeds, the breaker closes and traffic resumes. If it fails, the breaker opens again and the cooldown restarts.

Back in checkout: a hung call only counts as a failure when its timeout fires, so the breaker trips about 10 seconds into the hang, after the pool has already been full for most of that time. The breaker caps the stall at about one timeout; it doesn't prevent it. That is why it is paired with a short timeout. At 0.5 seconds, 200 orders a second hold about 100 threads, which still fits in the pool. Once tripped, each order for the next 30 seconds gets an instant "payment unavailable" instead of a wait, so the threads stay free and the rest of the site keeps working. After 30 seconds one trial charge goes out. If the provider has recovered, normal traffic resumes.

## Why failing fast helps both sides

There are two beneficiaries. Your callers stop paying the cost of a timeout on a call that was never going to work, which is the thread exhaustion above. And the provider stops receiving load while it is struggling. A dependency that is slow because it is overloaded gets worse when every caller keeps sending requests and retrying, and it may never recover until the traffic drops. Open state is that drop.

Doesn't [exponential backoff](/systems-and-infrastructure/exponential-backoff) already do this? Backoff makes each caller space out its own retries, which helps with brief failures. But each caller decides alone, and every one of them still waits out its timeouts and keeps sending. A breaker acts on the pattern across calls and stops the sending altogether. Most systems use both: backoff for the occasional blip, the breaker for sustained failure.

## What it looks like in code

```python
import time

class CircuitOpenError(Exception):
    pass

class ProviderError(Exception):
    """A timeout, connection error or 5xx: a sign the provider is unhealthy."""

class CircuitBreaker:
    def __init__(self, failure_threshold=5, cooldown_seconds=30):
        self.failures = 0
        self.state = "closed"
        self.opened_at = None
        self.failure_threshold = failure_threshold
        self.cooldown_seconds = cooldown_seconds

    def call(self, fn):
        if self.state == "open":
            if time.time() - self.opened_at < self.cooldown_seconds:
                raise CircuitOpenError()
            self.state = "half-open"

        try:
            result = fn()
        except ProviderError:
            self.failures += 1
            if self.state == "half-open" or self.failures >= self.failure_threshold:
                self.state = "open"
                self.opened_at = time.time()
            raise
        else:
            self.failures = 0
            self.state = "closed"
            return result
```

Checkout calls `breaker.call(lambda: charge(order))` and sees either a result or a fast `CircuitOpenError`, which it turns into a message to the shopper. This sketch counts consecutive failures and ignores threading. It counts only `ProviderError`: a declined card is the provider working correctly, and five declines in a row must not cut every shopper off. It also has a gap: once the cooldown ends, every caller that arrives next sees "half-open" and sends its request, so the "trial" is the full 200 orders a second landing on a provider that has only just started to recover. A production breaker caps the trial with a counter or semaphore (a lock that admits a fixed number of holders at once) so only one or a few calls get through. Many also trip on a failure rate over a time window, such as half of the last 20 calls, and count calls slower than a threshold as failures even when they eventually succeed.

## What to do while it's open

Failing fast only helps if callers handle the failure. Some calls can fall back: a recommendations service that is down can be replaced by a cached or default list. A payment can't be faked, so checkout shows an error, or queues the order for a retry later. Decide that per dependency before the incident, and set each breaker's thresholds from how that dependency fails, not from one global default. One breaker per dependency also keeps a broken service from tripping calls to a healthy one.

**Rule of thumb.** Put a circuit breaker around every call to a dependency that can hang or fail under load, give each dependency its own, and decide in advance what the caller does when it is open.

## Where you'll meet this

In payments, a breaker per provider lets checkout route around a failing one: with a second provider configured, an open breaker on the first sends charges to the second. In a news feed or timeline assembled from several services, each backend call gets its own breaker, so one failing source drops its section and the rest of the feed still loads. A notification or email pipeline wraps its email provider the same way, and while the breaker is open it leaves messages in the queue for later instead of failing them.
