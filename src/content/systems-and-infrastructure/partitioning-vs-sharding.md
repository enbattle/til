---
title: Partitioning vs. Sharding
summary: Splitting a table for manageability on one machine vs. spreading it across many machines for scale — two words often used interchangeably that mean different things.
date: 2026-09-15
---

Both **partitioning** and **sharding** split a large dataset into
smaller pieces, but at a different scope. **Partitioning** is the
general term: dividing data into pieces by some rule (range, list,
hash), which can happen entirely within _one_ database instance.
**Sharding** is specifically partitioning _across multiple_ machines —
every shard is a partition, but not every partition is a shard.

## Partitioning: splitting a table without adding a machine

Most relational databases support this natively — splitting one logical
table into several physical ones on the _same_ server, transparent to
the queries that read it:

```sql
CREATE TABLE events (
  id bigint,
  created_at timestamp,
  payload jsonb
) PARTITION BY RANGE (created_at);

CREATE TABLE events_2026_01 PARTITION OF events
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
```

The database can then **prune** partitions a query doesn't need: a
query filtered to `2026-01` never touches any other month's data at
all. This improves both query performance and maintenance (dropping an
entire old partition is close to instant; deleting the same rows one at
a time isn't) — without adding a single extra server, or any of the
distributed-systems complexity sharding brings.

## Sharding: partitioning across machines

Sharding takes the same splitting idea and distributes the pieces
across multiple database _instances_, specifically to scale beyond what
one machine's storage or throughput can handle. The central design
decision becomes the **shard key** — which column(s) determine which
shard a given row lives on — since that single choice determines both
how evenly data spreads and which queries stay fast:

- **Range-based** — shard by a value's range (e.g. user IDs 1–1M on
  shard A, 1M–2M on shard B). Simple, and a range query stays on one
  shard. But traffic and data are rarely uniform across ranges, which
  creates hot shards — every new signup, for instance, landing on the
  single newest shard.
- **Hash-based** — hash the shard key and spread by the result (ideally
  via [consistent hashing](/systems-and-infrastructure/consistent-hashing),
  to avoid a full reshuffle when the shard count changes). Spreads load
  evenly, but a range query ("all orders from June") now has to fan out
  to every shard instead of staying on one.
- **Directory-based** — a separate lookup service maps each key to its
  shard explicitly. The most flexible option (individual keys can be
  rebalanced one at a time), but the directory itself becomes a
  critical, must-scale dependency and an extra hop on every query.

The right key is whatever the majority of real queries actually filter
by: sharding by `user_id` is a good fit when nearly every query is
already scoped to one user (most SaaS applications); it's the wrong
choice if a common query needs to join across users (e.g. "all orders in
a region"), since that becomes an expensive fan-out or cross-shard join
instead of a single-shard lookup. There's rarely a shard key that's
optimal for every access pattern — choosing one is really choosing which
queries you're willing to make expensive in exchange for keeping the
common ones cheap.

## Hot shards and resharding

Any strategy can still concentrate load on one shard if the key
distribution turns out to be skewed in practice: a single account with
far more activity than typical, a viral product, a burst of sequential
IDs all created in the same short window. Common mitigations include
adding entropy to a write-heavy key (`user_id` plus a random suffix),
splitting an overloaded shard further, or simply caching in front of the
hot shard rather than resharding the whole dataset for one outlier.

Changing the number of shards later is expensive under naive
hash-modulo sharding, for the same reason the naive `hash(key) % n`
approach breaks down for any hashed system: nearly every key has to
move. This is exactly the problem consistent hashing solves, which is
why systems built for elastic scaling generally reach for it instead of
a raw modulo from the start.

## Why the distinction actually matters

The two terms get used interchangeably in casual conversation, but
conflating them hides the actual design decision being made: partitioning
alone doesn't add capacity — every partition still lives on the same
machine, sharing its CPU, memory, and disk. It only improves
organization and query efficiency _within_ that existing capacity.
Sharding is what actually adds capacity, at the cost of making
cross-shard queries, joins, and transactions harder or impossible
without extra machinery.

If a database is struggling with query performance or table maintenance
but isn't actually running out of capacity, partitioning alone might be
the entire fix — reaching straight for sharding's operational complexity
when partitioning would have solved it is a common, expensive
overcorrection.
