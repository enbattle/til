---
title: Scaling Reads vs. Scaling Writes
summary: Reads scale by adding copies of the data, while writes must be split across machines or smoothed out in time, so each kind of load needs its own fix.
date: 2026-09-15
---

Say you run a photo-sharing app, and one database machine holds everything. Today people open photos about 20,000 times a second and upload about 200 new ones a second, a ratio of 100 reads to 1 write. The machine is sweating. What do you add?

That depends on which side is hurting, because reads and writes scale by different means. A **read** fetches data without changing it. A **write** changes it. Start with the easier side.

## Why are reads easy to scale?

A read doesn't need the one true copy of the data. Any copy that is close enough to current will do, so you can make more copies. Three common ways:

- **A cache** keeps recently used results in fast memory, so many reads never reach the database. If 95% of those 20,000 photo opens hit the cache, the database sees 1,000 reads a second instead. See [Caching](/systems-and-infrastructure/caching) for where caches sit, and [Cache Invalidation](/systems-and-infrastructure/cache-invalidation) for keeping them from serving old data.
- **Read replicas** are read-only copies of the database that follow the **primary**, the machine that takes writes. Spread the reads across five replicas and each handles a fifth. See [Read Replicas and Replication Lag](/systems-and-infrastructure/read-replicas).
- **A CDN** (content delivery network) keeps copies of files that look the same to every viewer, such as the photos themselves, on servers near the readers, so they don't all travel to your servers.

What does a copy cost you? It can be out of date. A replica may trail the primary by a moment, and a cache entry may outlive the change it should have reflected. You accept that on purpose, photo by photo, where a stale answer is harmless.

## Why can't writes just be copied too?

Because a write has to land in the authoritative data, and copying doesn't change that. Replicas don't take writes off the primary, and each replica has to apply every change too. So the 200 uploads a second still arrive at one machine, and a read cache has nothing to offer them.

Suppose your app grows a feature: every photo view increments a view counter. Now each of those 20,000 views a second is also a write, and the cache you built does nothing for them. This is the situation where reads and writes need different answers. Writes have two kinds of fix.

**Split the data.** Divide it across several database machines, called **shards**, so each takes only part of the writes. If you shard by photo ID, the writes for one photo go to one shard and different photos' writes spread across the shards. Choosing the split, and what it costs you, is in [Partitioning vs. Sharding](/systems-and-infrastructure/partitioning-vs-sharding). A single photo that goes viral is still one counter on one shard, so splitting alone won't save you there.

**Do less work per write, or do it later.** Instead of updating the database on every view, have each app server count views in memory and flush the totals once a second. Each server writes its own totals, so with 10 app servers, twenty thousand increments a second turn into at most 10 writes per photo per second: up to 5,000 a second if 500 photos are being watched, a quarter of the 20,000, and a viral photo costs 10 writes a second however many people watch it. The price is that the stored count can trail reality by about a second, and a crash can lose the unflushed counts, which a durable queue (one that writes each item to disk) in front of the store can prevent. See [Batching and Asynchronous Writes](/systems-and-infrastructure/batching-and-asynchronous-writes) for the mechanics and [Latency vs. Throughput](/systems-and-infrastructure/latency-vs-throughput) for the trade it makes, and [Message Queues and Dead Letter Queues](/systems-and-infrastructure/message-queues) for the queue.

## What if reads and writes need different shapes?

Sometimes the two loads pull the design in opposite directions. Writes want data stored compactly and consistently, while reads want it pre-assembled, like a photo with its counts and comments already joined. Then you can give each side its own data model, and keep the read side up to date from the write side. That is [CQRS](/systems-and-infrastructure/cqrs), and it is the same idea carried further: stop forcing one structure to serve both loads.

## How do you tell which problem you have?

Measure the ratio and watch where the database is struggling. A mostly-read system, like the original photo app, is held up by repeated reads of the same data, which a cache or replicas absorb. A mostly-write system, like one that ingests a stream of sensor readings, gets nothing from either. Check too whether your "reads" are quietly writing, as the view counter did.

**Rule of thumb.** Find out which side is overloaded before choosing a fix. Add copies for reads, and accept some staleness in return. For writes, split the data across machines, or batch and defer the work and accept that a deferred write may not be visible, or may not survive a crash, the instant it is acknowledged unless you make it durable first.

## Where you'll meet this

A news feed is read-heavy, since far more people scroll than post, so its timelines come from caches and replicas while the posts themselves go to the primary. A URL shortener is the extreme case, with each link created once and followed many times, so caches and replicas serve almost all the traffic. Chat is far more write-heavy than a feed, because every message sent is a new write, so its relief comes from splitting messages across shards by conversation.
