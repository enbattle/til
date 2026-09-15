---
title: Exponential Backoff & Jitter
summary: Why retrying a failed request needs both a growing delay and randomness, or the retries themselves become the next outage.
date: 2026-09-14
---

**Exponential backoff** is a retry strategy where the wait between
retries grows exponentially — roughly `base × 2^attempt` — instead of
retrying immediately or waiting the same fixed interval every time.
**Jitter** adds randomness to that wait so retries coming from many
different clients don't all land at the same instant.

## Why retrying instantly makes things worse, not better

Retrying the moment a request fails just recreates the exact condition
that caused the failure in the first place: if a server is overloaded, a
client hammering it with instant retries adds to the load that's already
overwhelming it. Spacing retries out — and making that spacing grow with
each additional failure — gives a struggling system real room to recover
instead of getting hit again a millisecond later.

## Why backoff alone still isn't enough

Backoff on its own has a subtle failure mode: if every client computes
the exact same delay from the exact same formula, they all back off in
lockstep. A thousand clients that all failed at the same moment will all
retry again at exactly the same moment too — a synchronized retry storm
that can knock a recovering service back down just as effectively as no
backoff at all. Concretely, this can play out as: a server returns an
overload error to every client at once; each client waits roughly one
second and retries — all landing on the server again within the same
few milliseconds; the server, still not recovered, fails all of them
again, and it repeats. Jitter breaks that synchronization by adding
randomness to the delay, so retries spread out across the whole window
instead of arriving in a wave.

## A concrete formula: full jitter

One well-known approach, sometimes called "full jitter," picks a
completely random delay between zero and the exponential cap — rather
than the exponential value plus a small random offset — which tends to
spread retries out most evenly:

```python
import random

def backoff_delay(attempt, base=1.0, cap=30.0):
    exponential = min(cap, base * (2 ** attempt))
    return random.uniform(0, exponential)
```

Each failed attempt increases the _ceiling_ a random delay is drawn from,
so later retries are, on average, spaced further apart — while still
never landing at the same predictable moment as another client's retry.

## Where it applies, and what it depends on

This shows up anywhere a client might retry a request against a shared,
possibly struggling dependency — which describes most distributed
systems: HTTP client retry logic, message-queue consumers redelivering
failed messages, any service-to-service call that can time out. It only
makes sense to retry at all when doing so is actually safe — that's a
separate property called
[idempotency](/systems-and-infrastructure/idempotency), and the two
pair directly: backoff decides _when_ to send a retry, idempotency is
what makes sending it safe in the first place. Backoff protects the
failing system from being hit too aggressively by any one client; jitter
protects it from being hit by every client at once. They solve two
different halves of the same problem and are almost always used
together.
