---
title: Exponential Backoff and Jitter
summary: A retry delay that grows after each failure and is randomized per client, so a struggling service gets room to recover instead of a second wave of traffic.
date: 2026-09-14
---

Say you run a thousand email workers, and they all send through one provider. The provider hits trouble and starts answering every request with an overload error. Each worker has to decide what to do with the message it just failed to send. Dropping it loses mail, so it will retry. The question is when.

**Exponential backoff** is the answer to "when": wait longer after each consecutive failure, with the wait growing by a constant factor (usually doubling), roughly `base × 2^attempt`. **Jitter** is randomness added to that wait. You need both, and the reasons show up one failure at a time.

## Why not retry immediately?

Because the failure was probably caused by load, and an instant retry is more load. Your thousand workers each fail once, each retry right away, and the provider now sees two requests per message when it could barely handle one. A fixed pause, say one second between tries, is better but still wrong. If the provider needs ten seconds to recover, every worker still arrives once a second, so the provider never gets a quiet moment.

So the delay should grow. The first retry comes quickly, since most failures are brief blips. If that fails too, the problem is probably bigger, so wait longer, and again longer after that. With doubling, a client that keeps failing waits 1 second, then 2, 4, 8, 16, and its traffic to the provider shrinks quickly.

## Is growing the delay enough?

No, and this surprises people. Your thousand workers all failed at the same moment, because the provider failed for all of them at once. They all use the same formula, so they all compute the same delay. All thousand wait one second and retry together, and the provider, still struggling, fails all thousand again. Then all thousand wait two seconds and arrive together again. You have turned a steady stream into synchronized spikes, each as large as the original burst. This is a **thundering herd**: many clients acting at the same instant ([the thundering herd problem](/systems-and-infrastructure/thundering-herd-problem) covers the other ways it happens).

Jitter breaks the lockstep. Instead of every worker waiting exactly 4 seconds, each draws its own delay at random, so the thousand retries spread out over the window and the provider sees a smear of requests instead of a wall.

## The usual formula: full jitter

The common version is called **full jitter**. It picks the delay uniformly at random between zero and the exponential value, rather than adding a small random offset to it:

```python
import random

def backoff_delay(attempt, base=1.0, cap=30.0):
    ceiling = min(cap, base * (2 ** attempt))
    return random.uniform(0, ceiling)
```

Trace it for the workers, counting `attempt` from 0. After the first failure the ceiling is 1 second, so the thousand retries land anywhere in a one-second window. After the fourth failure the ceiling is 8 seconds, so if all 1,000 are still failing they spread across 8 seconds, about 125 arrivals per second, where a fixed schedule would send all 1,000 in one instant. The `cap` stops the ceiling growing forever: from attempt 5 on it holds at 30 seconds, so no worker goes silent for minutes.

A small offset on top of the exponential value (say, 4 seconds plus or minus 10 percent) also spreads the retries, but only slightly, and the clients stay roughly clustered. Drawing from the whole range from zero up spreads them far more evenly, and it costs one `uniform` call.

## What else a real retry loop needs

The delay is only part of it, and three more rules keep the loop from doing harm:

- **Retry only errors that can succeed later.** An overload (HTTP 503), a rate limit (429) or a timeout is worth retrying. A rejected address or a malformed request fails the same way every time.
- **Cap the number of attempts.** After, say, eight tries, stop and hand the message to a place where it can be inspected, such as a [dead letter queue](/systems-and-infrastructure/message-queues#dead-letter-queues). Retrying forever hides an outage inside a growing backlog.
- **Respect the server's hint.** If the provider replies with a `Retry-After` header saying how long to wait, use it instead of your own guess.

A timeout also leaves you unsure whether the first attempt went through. If the retry can send the email twice, backoff alone is unsafe, and you need [idempotency](/systems-and-infrastructure/idempotency) so a duplicate is harmless. Backoff decides when the retry goes out, idempotency decides whether sending it is safe.

**Rule of thumb.** Retry with a delay that doubles up to a cap, draw each delay at random from zero up to that ceiling, and stop after a fixed number of attempts.

## Where you'll meet this

A notification or email pipeline retries sends against a provider that is throttling or briefly down, and without jitter its workers fall into step and keep the provider down for as long as they stay synchronized. In payments and checkout, a client that times out on a charge request retries it, and does so safely only when the payment is idempotent. In chat and messaging, a server restart drops every connection at once, and clients reconnecting with jittered backoff arrive spread out instead of as one spike.
