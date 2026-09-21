---
title: What do I do when one database can't keep up with writes?
summary: What to try, in roughly increasing order of disruption, when write volume is the bottleneck.
date: 2026-09-20
order: 3
---

Writes are slow to commit, a single database server is close to its limits, or
loading data in falls behind during bursts. This is the harder side of scaling,
because every write eventually has to land in the authoritative copy of the
data. Copying doesn't help the way it does for reads.

## Confirm it's writes, and that it's volume

A read cache doesn't reduce the number of writes, so read-scaling techniques
don't help here. If most of the load is `INSERT` and `UPDATE`, you're in the
right place;
[Scaling Reads vs. Scaling Writes](/systems-and-infrastructure/scaling-reads-vs-scaling-writes)
lays out why the two sides differ.

Then separate volume from contention. If the database is short of CPU, memory
or disk, that's volume. If it has spare capacity but writes queue behind one
another on the same rows, that's contention, a different problem with
different fixes, covered in
[How do I keep data correct when many users or services change it at once?](/system-design/keeping-data-correct-under-concurrency).

## Trim the load, or add headroom

Start with what each write costs. Every
[index](/systems-and-infrastructure/database-indexing) has to be kept up to
date as rows are written, so an index no query uses is pure overhead here, the
flip side of the index advice for reads. A bigger machine or faster storage
buys headroom without changing the design, up to what one machine can do.

## Batch and defer

Two techniques from
[Scaling Reads vs. Scaling Writes](/systems-and-infrastructure/scaling-reads-vs-scaling-writes)
change how writes reach the database. Batching combines many small writes into
fewer large ones, so a fixed cost like a transaction commit (the step that
makes a transaction's changes permanent) is paid once for many rows.
Asynchronous writes acknowledge a write as soon as it's safely stored in a
queue and apply it to the database a little later, which smooths out bursts.
The database still has to keep up on average, though. If writes arrive faster
than they're applied, the queue grows without limit, which is the situation
[backpressure](/systems-and-infrastructure/backpressure) exists for.

Both give something up. A batch makes its earliest item wait (the trade-off in
[Latency vs. Throughput](/systems-and-infrastructure/latency-vs-throughput)),
and a deferred write means readers can briefly see the old value.

## Partition if the problem is query speed or maintenance

[Partitioning](/systems-and-infrastructure/partitioning-vs-sharding) splits a
large table into pieces on the same server. Queries skip the pieces they don't
need and old data can be dropped almost instantly, but every piece still shares
the server's CPU, memory and disk, so it adds no write capacity. It fits when
the database is slow to query or maintain without being out of room. If that's
your situation, sharding is more machinery than you need.

## Split the data across machines

When one machine is out of capacity, the answer is
[sharding](/systems-and-infrastructure/partitioning-vs-sharding): each shard
is a separate database server holding part of the data. The shard key, the
column that decides which shard a row lives on, controls how evenly load
spreads, so pick it by what most of your queries filter on. Sharding adds write
capacity by adding machines, and it makes queries, joins and transactions that
span shards harder or impossible without extra machinery.

If shards are chosen by hashing the key (a number computed from it) and taking
the remainder after dividing by the shard count, adding or removing a shard
reassigns nearly every key.
[Consistent hashing](/systems-and-infrastructure/consistent-hashing) limits
that to a small share of keys, which keeps growing the fleet from turning into
a mass relocation of data.

## How they combine

Roughly, the steps run from least to most disruptive. It isn't strictly
cheapest first: partitioning an existing large table is itself a migration, and
asynchronous writes add a queue and mean readers may see older data for a while.
Sharding changes what queries are possible, and it's much easier to plan for
while the dataset is small.

## When it isn't this problem

If the database is under read pressure, go to
[What do I do when my database can't keep up with reads?](/system-design/database-cant-keep-up-with-reads).
If writes are slow because many writers collide on the same rows, that's the
contention material in the correctness question linked above.
