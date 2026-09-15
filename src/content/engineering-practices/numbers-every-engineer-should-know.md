---
title: Numbers Every Engineer Should Know
summary: The order-of-magnitude latencies — cache, memory, disk, network — that let you sanity-check a design on a napkin.
date: 2026-09-14
---

A rough set of latency, throughput, and storage figures worth having
memorized well enough to sanity-check a design on the spot — not exact
benchmarks (real numbers vary by hardware, network, and year), but the
right order of magnitude to reason about whether a design is even
plausible.

## The jump between rows matters more than the digits

| Operation                                                                                                               | Approximate latency |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------- |
| L1 cache reference (a tiny pool of memory built directly into the CPU core, the fastest storage a program ever touches) | ~1 ns               |
| Main memory (RAM) reference                                                                                             | ~100 ns             |
| SSD (solid-state drive) random read                                                                                     | ~100 μs             |
| Round trip within the same datacenter                                                                                   | ~0.5 ms             |
| HDD (spinning hard-disk drive) seek                                                                                     | ~10 ms              |
| Round trip, cross-country (e.g. US coast to coast)                                                                      | ~50 ms              |
| Round trip, cross-continent                                                                                             | ~150 ms             |

Look at the jumps, not the exact digits: L1 to RAM is about 100x. RAM to
SSD is roughly another 1,000x. SSD to a cross-country network round trip
is roughly another 500x. Chain those together and the gap between
"served from memory" and "served across the country" is close to half a
million times over — so a design that hides an unnecessary cross-region
round trip behind something that could have been served from memory is
leaving most of that gap on the table. The point isn't precision — it's a
fast way to notice when a design can't possibly hit its own latency
budget.

## Chaining them into a throughput estimate

Back-of-envelope math in a capacity conversation usually chains a few of
these:

- A single modern server can typically handle on the order of
  **thousands to tens of thousands of requests/second** for simple,
  cacheable reads; far less (hundreds to low thousands) for anything
  hitting a database with real work per query.
- A single database connection or query is usually the bottleneck well
  before the network is — which is why **connection pooling** (reusing a
  small set of already-open database connections instead of opening a new
  one per request, since opening one is itself slow) and **read
  replicas** (extra copies of a database that serve reads, so the primary
  only has to handle writes) show up so often in scaling discussions.
- **1 million requests/day ≈ ~12 requests/second average.** But design
  for peak, not average: a 10x peak-to-average ratio is a common,
  reasonable assumption absent better data.

## Chaining them into a storage estimate

- A short text row (a tweet, a comment) is roughly **100 bytes – 1 KB**.
- A typical compressed photo is roughly **200 KB – 2 MB**; a minute of
  video, tens of MB.
- 1 million users × 1 KB of profile data ≈ **1 GB**: small. The same 1
  million users' photos at 1 MB each ≈ **1 TB** — usually the point where
  "this needs dedicated file storage, not a database row" becomes
  obvious.

## The actual payoff: catching a design that's off by 1000x

Skip the calculator and these numbers still catch the obvious break: if a
request's stated latency requirement is 50ms and the design routes it
through three sequential cross-region calls, the numbers alone say it
can't work before any deeper analysis does. Having them memorized means a
design that's off by three orders of magnitude gets flagged with "wait,
that can't be right" instead of surviving unchallenged.
