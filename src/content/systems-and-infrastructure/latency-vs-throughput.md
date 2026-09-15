---
title: Latency vs. Throughput
summary: Two different performance numbers that trade off against each other, so optimizing one can quietly wreck the other.
date: 2026-09-14
---

**Latency** is how long a single request takes to complete — "this
response came back in 120 milliseconds." **Throughput** is how much work
a system gets through per unit of time — "this system handles 5,000
requests per second." They sound like two ways of saying "how fast is
it," but they're genuinely different measurements, and improving one can
actively make the other worse.

## Why raising one can lower the other

**Batching** is the clearest example. Processing items one at a time
keeps each item's latency low — it's handled the moment it arrives — but
caps throughput at whatever a single item costs to process. Grouping many
items into a batch spreads a fixed cost (a network round-trip, a database
transaction) across all of them, which raises throughput. But now the
first item to arrive has to sit and wait for the rest of the batch to
fill before anything gets processed at all — its individual latency just
went up, even though the system as a whole is getting more done per
second.

The same tension shows up with concurrency. Adding more workers raises
throughput, up to a point — but past that point, contention (workers
waiting on the same lock, waiting their turn for CPU time, queueing for
a shared resource) starts increasing how long each individual request
takes, even while total throughput keeps climbing.

## The formula that ties them together: Little's Law

**Little's Law** states a simple, mechanical relationship: `L = λW` — the
average number of requests a system is holding at once (`L`) equals the
rate new requests arrive (`λ`) multiplied by how long each one spends in
the system (`W`, which is latency). It's not an optimization technique,
just a reminder that these two numbers can't be treated as independent.

Concretely: a service handling 50 requests per second, each taking 200
milliseconds, is holding `L = 50 × 0.2 = 10` requests at any given moment
on average — that's the concurrency it needs just to keep up, before any
actual queueing starts. Push the arrival rate up without also pushing
latency down, and the number of requests in flight at once grows too —
which usually means queueing, and queueing usually makes latency worse
next, not better. (For the underlying raw latencies that estimates like
this build on — memory, disk, and network round-trip times — see
[Numbers Every Engineer Should Know](/engineering-practices/numbers-every-engineer-should-know).)

## Deciding which one actually matters here

Most systems can't maximize both latency and throughput at once, and
which one should win is a real design decision that differs by endpoint,
not just by system. A search-autocomplete endpoint needs low latency even
at some throughput cost — a suggestion that arrives a second late is
useless no matter how many the backend could technically serve per
second. A nightly batch job processing millions of records wants maximum
throughput and can tolerate high latency on any single record, since
nothing is waiting on one record in particular. Optimizing for the wrong
one — batching a user-facing request to squeeze out more throughput, or
handling a bulk job one row at a time to keep per-row latency low — is a
common, and avoidable, performance mistake.
