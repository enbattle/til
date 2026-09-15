---
title: Scaling Reads vs. Scaling Writes
summary: Reads scale by adding copies of the data; writes have to scale the authoritative data itself — why that asymmetry exists and what actually helps each side.
date: 2026-09-15
---

Read-heavy and write-heavy workloads scale via genuinely different
techniques, and conflating them is a common design mistake: throwing a
read-scaling technique like a cache at a write-heavy problem does
nothing for it, and vice versa.

## The read side: adding copies

Reads are usually the easier side to scale, because a read can be
served from a **copy** of the data instead of the one authoritative
source:

- **Caching** — serve hot data from memory instead of hitting the
  database at all; see [Cache Invalidation](/systems-and-infrastructure/cache-invalidation)
  for the correctness side of keeping that copy from going stale.
- **Read replicas** — one or more read-only copies of the database, kept
  in sync (usually asynchronously) with the primary. Reads scale by
  adding more replicas; every write still has to go through the single
  primary.
- **A CDN** — for content that's identical for every user, push it to
  edge servers physically close to the reader instead of serving it from
  one origin every time.

The common thread across all three: they all work by adding copies, and
a copy means the reader might occasionally see slightly stale data — a
real tradeoff to make deliberately, not a free win.

## The write side: splitting the source

Writes are the harder side, because every write eventually has to land
somewhere authoritative — there's no copying your way out of needing to
actually store the new data:

- **Sharding or partitioning** — split writes across multiple database
  instances so no single machine absorbs all of the write load; see
  [Partitioning vs. Sharding](/systems-and-infrastructure/partitioning-vs-sharding).
- **Write-behind / asynchronous processing** — acknowledge a write once
  it's durably queued (a message broker, a write-ahead log), and apply
  it to the actual store slightly later, trading immediate consistency
  for higher write throughput.
- **Batching** — combine many small writes into fewer, larger ones,
  amortizing per-write overhead like a transaction commit or a network
  round trip — the same [Latency vs. Throughput](/systems-and-infrastructure/latency-vs-throughput)
  tradeoff batching always makes, applied to the write path specifically.

## Diagnosing which one a system actually needs

Any system-design question of "how does this scale" is really two
separate questions, and they deserve separate answers: a social feed is
read-heavy (far more views than posts) and leans on caching and
replicas; a metrics-ingestion pipeline is write-heavy (constant
high-volume writes, comparatively rare reads) and leans on sharding,
batching, and asynchronous ingestion instead.

Reads scale by adding copies; writes scale by splitting the
authoritative data itself. A design struggling under write load needs
sharding or asynchronous processing, not a bigger cache — caching
doesn't touch the write path at all.
