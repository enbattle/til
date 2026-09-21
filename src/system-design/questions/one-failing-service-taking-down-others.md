---
title: How do I stop one failing service from taking everything else down?
summary: The defenses for a failing dependency, from timeouts and safe retries to circuit breakers, and which ones sit on the caller's side versus the receiver's.
date: 2026-09-20
order: 4
---

One service slows down or starts erroring. Its callers wait for responses, then
retry, and the retries add to the load on something that's already struggling.
Their own threads and connections fill up with waiting calls, so they start
failing too and the outage spreads. When the first service finally recovers, a
wave of clients hits it at once and knocks it down again.

## Confirm it

Retries and timeouts spiking right after a dependency degrades is the
signature. Error rate and latency on calls to that dependency show the
problem, and traces show which calls are waiting on it; see
[figuring out what's wrong](/system-design/figuring-out-whats-wrong).

## Set a timeout

A timeout is a deadline on a call: past it, the caller gives up instead of
waiting. A caller with no effective timeout can sit on a hung dependency,
holding threads and connections the whole time, so this is the cheapest
defense and the ones below build on it. Set it too tight, though, and calls
that were merely slow start failing and trigger retries of their own.

## Make retrying safe

A caller that times out can't tell whether the server never got the request or
did the work and lost the reply. Retrying covers both cases, but only if the
operation is [idempotent](/systems-and-infrastructure/idempotency), meaning
doing it twice has the same effect as once. Operations that aren't naturally
idempotent can be made so with a unique key the client attaches to each
attempt, which lets the server recognize a repeat. Retry only operations that
pass this test.

## Retry without making it worse

Retry only errors that could succeed later, such as a timeout, and cap the
number of attempts. Retrying instantly recreates the load that caused the
failure. [Exponential backoff](/systems-and-infrastructure/exponential-backoff)
waits longer after each failure, and jitter (randomness in the wait) keeps
clients that failed together from retrying together. Retries at every layer of
a call chain multiply, so retry in one place.

## Stop calling something that's down

A [circuit breaker](/systems-and-infrastructure/circuit-breaker) trips after
enough failures and fails calls immediately for a cooldown, instead of letting
each one wait out a timeout. Callers get a fast, predictable error and the
dependency gets room to recover. Backoff and a breaker protect different things,
and systems that need one usually want both.

## If you own the failing service

The rest matter when you're on the receiving end.
[Rate limiting](/systems-and-infrastructure/rate-limiting) caps how many
requests each client can make in a window, so no one caller can use up shared
capacity. To hold across many servers, the counter has to be shared between
them, not kept separately on each.

Where work flows from a producer (the sender) to a consumer (the receiver)
through a queue or buffer, [backpressure](/systems-and-infrastructure/backpressure)
lets a slow consumer make the producer wait, or drop excess work on purpose once
the buffer fills. Letting the buffer grow without limit delays the failure and
makes it worse.

For queue-based work there's one more case. Some messages will never succeed,
because of a bug or a malformed payload, and retrying them wastes effort. In an
ordered queue one such message can block everything behind it. A
[dead letter queue](/systems-and-infrastructure/dead-letter-queue) takes a
message after a set number of failures so a person can inspect it and replay it
once it's fixed. Replayed messages arrive a second time, so consumers still need
to be idempotent.

## How they combine

On the caller's side the pieces are a timeout, safe retries with backoff and
jitter, and a breaker. On the receiver's side they're rate limiting and
backpressure, plus a dead letter queue for queued work. Rate limiting protects
the opposite side of a call from what a breaker protects, so a service that both
calls others and is called wants both. After an outage, clients reconnecting all
at once have their own name and their own fixes, in the
[thundering herd problem](/systems-and-infrastructure/thundering-herd-problem).

## When it isn't this problem

If the dependency is slow because its own database is overloaded, start with
[reads](/system-design/database-cant-keep-up-with-reads) or
[writes](/system-design/database-cant-keep-up-with-writes), whichever is the
load. If a failure left data half-changed across services, that's
[How do I keep data correct when many users or services change it at once?](/system-design/keeping-data-correct-under-concurrency).
