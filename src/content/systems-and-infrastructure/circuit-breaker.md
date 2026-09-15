---
title: Circuit Breaker
summary: Why stopping calls to a failing dependency helps it recover, instead of every caller's retries adding to the pile-up.
date: 2026-09-14
---

A **circuit breaker**, named after the electrical version, stops a
service from repeatedly calling a downstream dependency that's already
failing. Instead of letting every request wait out a full timeout against
something that's clearly down, it "trips" and starts failing fast for a
cooldown period, without even attempting the call.

## The three states it moves through

- **Closed** — normal operation. Requests pass through to the dependency
  as usual, and failures are counted in the background.
- **Open** — the failure count crossed a threshold. Every request fails
  immediately, without even attempting to call the dependency, for a
  fixed cooldown period.
- **Half-open** — once the cooldown elapses, a small number of trial
  requests are allowed through. If they succeed, the breaker closes again
  and normal traffic resumes; if they fail, it reopens and the cooldown
  starts over.

Picture it as a loop: closed until failures pile up, then open until the
cooldown passes, then a cautious half-open trial that either confirms the
dependency has recovered (back to closed) or confirms it hasn't (back to
open).

## Why failing fast is better than failing slowly

Without a circuit breaker, a struggling dependency gets hit by every
caller's retries — possibly spaced out with
[backoff](/systems-and-infrastructure/exponential-backoff), but still
hit — which can be exactly what prevents it from ever recovering in the
first place. On top of that, every one of those callers pays the cost of
waiting out a full timeout on each failed attempt, tying up its own
threads or connections on a call that was never going to succeed.

Failing fast while the breaker is open avoids both problems at once: the
downstream service gets a real chance to recover without added load
piling on top of it, and callers get an immediate, predictable failure
instead of hanging until a timeout expires.

## What it looks like in code

```python
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
        except Exception:
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

A wrapper like this sits around any call to a dependency that can fail —
another service, a database, an external API — and the caller just sees
either a normal result or a fast, predictable `CircuitOpenError` instead
of an unpredictable hang.

One thing this illustrative version leaves out: it doesn't cap how many
callers can get through at once while the breaker is half-open — the
state simply flips, and every concurrent caller that shows up next
attempts the call. A production implementation needs an explicit
concurrency gate here (a counter or semaphore limiting how many trial
requests are in flight) so "half-open" actually means a small, bounded
trial rather than the full request volume hitting a dependency that just
started to recover.

## Backoff and circuit breakers solve different halves of the problem

The two are easy to mix up because they both respond to failure, but
they aren't interchangeable: backoff is something a caller does to
survive its own transient failures, while a circuit breaker is something
that shields the dependency from getting hit by everyone's retries at
once. Most resilient systems run both together, since each is handling a
failure mode the other doesn't touch. This pattern shows up
constantly in service-to-service calls inside a
[microservices architecture](/systems-and-infrastructure/monolith-vs-microservices),
in database connection pools, and in any call to an external dependency
that can degrade under load.
