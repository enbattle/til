---
title: What do I do when my database can't keep up with reads?
summary: A cheapest-first path for a database that's slow or overloaded by read traffic, from fixing individual queries to serving reads from copies.
date: 2026-09-20
order: 2
---

The app got slower as traffic grew, and the database is where it stalls.
Either the database is busy, with high CPU and queries queueing, most of them
`SELECT`, or it looks idle while requests wait for a connection to it. Reading
is the easier side of a database to scale, but the right technique depends on
why the reads are expensive, and the cheap fixes come before the heavy ones.

## Confirm it's reads, and find out what kind

If the database looks idle while requests wait, skip ahead to the connection
pool. Otherwise, check the mix first. If writes are the main load, adding read
capacity won't help, and
[Scaling Reads vs. Scaling Writes](/systems-and-infrastructure/scaling-reads-vs-scaling-writes)
explains why the two sides need different tools. Then look at what the reads
are, using the signals from
[figuring out what's wrong](/system-design/figuring-out-whats-wrong). A trace
of one slow request shows whether it ran one slow query, dozens of
near-identical ones, or spent its time waiting for a database connection.
Each of those has a different fix.

## Make each query cheaper

A common cause of a slow query is a missing
[index](/systems-and-infrastructure/database-indexing). Without one, the
database checks every row in the table to find a match, so the cost grows with
the table. An index lets it find a match without scanning every row. The price is
that every write has to update the index too, and the database sometimes
ignores an index you've added, so check the query plan (the database's
explanation of how it will run a query) to confirm it's used.

## Send fewer queries

If a trace shows one request firing dozens of near-identical queries that
differ only by an ID, you have an
[N+1 problem](/systems-and-infrastructure/n-plus-one-queries): one query for a
list, then one more for each row on it. It tends to hide inside ORM code (a
library that lets code treat database rows as objects) and only hurts once
there's production-sized data. The fix is to fetch what you need in a single
query using a join, which combines rows from two tables, or one lookup for
many IDs at once.

## Check the connection pool

When individual queries are fast but requests still wait, the wait may be for a
connection. Applications keep a pool of open connections and lend them out,
because opening a fresh one for every request is slow. If you have no pool,
adding one is the fix. If you have one and it has run dry, look for what's
holding connections: a slow query elsewhere, or code that never handed one
back. Either way, size the pool across the whole fleet of application
instances, since they all count against what the database can hold open. See
[Database Connection Pooling](/systems-and-infrastructure/database-connection-pooling).

## Serve repeated reads from a copy

Copies make sense once the queries themselves are sensible, and they differ in
what they suit. A [cache](/systems-and-infrastructure/caching) keeps hot
results in memory and suits data many requests ask for repeatedly; how much it
helps depends on where it sits and how often lookups find what they want.
[Read replicas](/systems-and-infrastructure/read-replicas) are read-only copies
of the database, and suit a workload of many different queries, since any of
them can run against a replica. A replica is updated after the write has
already returned, so it can lag the primary (the main copy, which takes every
write). A content delivery network (CDN) serves content that's
identical for every user from servers near the reader, and does nothing for
personalized queries that reach your database.
[Scaling Reads vs. Scaling Writes](/systems-and-infrastructure/scaling-reads-vs-scaling-writes)
compares the read and write sides as a whole. What all the copies share is that
one can be slightly stale.

If the shape the reads need differs from the shape the data is stored in, say
an order history that would join five tables on every page view, a separate
read model built for those queries is the heavier option, and it's what
[CQRS](/systems-and-infrastructure/cqrs) describes. It adds a second copy of the data, shaped for those queries,
and a lag between the two, so most systems try replicas first.

A cache brings two problems of its own. Keeping it correct is the subject of
[cache invalidation](/systems-and-infrastructure/cache-invalidation), where
the common moves are deleting the entry when the data changes and giving every
entry a TTL (a time after which it expires on its own) as a backstop. And when
a popular entry expires, every request that would have hit the cache lands on
the database at once, which is the
[thundering herd](/systems-and-infrastructure/thundering-herd-problem).

## How they combine

The order above roughly follows effort and risk. An index or an N+1 fix is a
contained change, although building an index on a large table takes time and
slows writes afterward. A cache adds a correctness problem you manage for as
long as it exists, and caching in front of an unindexed query or an N+1 loop
just hides it until the next miss, so fix those first.

## When it isn't this problem

If the database is struggling with writes, go to
[What do I do when one database can't keep up with writes?](/system-design/database-cant-keep-up-with-writes).
Wrong data from a stale cache or replica belongs here, in the invalidation and
TTL material above. Other wrong or conflicting data is
[How do I keep data correct when many users or services change it at once?](/system-design/keeping-data-correct-under-concurrency).
