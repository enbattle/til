---
title: Caching
summary: A cache trades a little memory for a lot of speed, and how much depends on where it sits, how often lookups find what they want, and what it throws out when full.
date: 2026-09-21
---

Picture an online bookshop with two million titles. Every product page needs
a database query that takes about 50 ms, and on a busy afternoon the same few
thousand bestsellers are requested over and over. A **cache** is a small,
fast store holding copies of data that is slower to get from its original
source. The first time a page is requested, you fetch it the slow way and
keep a copy; later requests for the same page are answered from the copy.

Three questions decide how well it works: where it sits, how much traffic it
answers, and what it drops when full.
Keeping the copies correct once a book's price changes is a separate problem,
covered in [Cache Invalidation](/systems-and-infrastructure/cache-invalidation).

## Where a cache sits

A request from a shopper's phone to the database passes through several
places where a copy can be kept. The closer to the shopper, the faster the
answer and the less work for every layer behind it.

- The **browser** keeps its own copy of cover images and scripts, as
  instructed by the `Cache-Control` header the server sends. Reusing a copy
  needs no network request at all, but it belongs to one user on one device,
  and the server has no dependable way to reach in and delete it.
- A **[CDN](/computing-fundamentals/load-balancers-and-cdns)** (content delivery network) is a set of servers around the world
  that keep copies of responses, so a reader in Sydney gets the cover image
  from a nearby machine instead of one in Virginia. It suits responses that
  are identical for everyone.
- An **application cache** is a fast in-memory store the shop's code checks
  before querying the database. It can live inside each application process,
  which is quickest but leaves every server with its own copy that may differ
  from its neighbors', or in a shared service like Redis or Memcached that all
  servers consult.
- The **database** caches too, keeping recently read pages of data in memory
  with no effort from the application.

From here on, the bookshop caches each product row in a shared Redis.

## How much does it help?

A lookup that finds the data is a **hit**; one that doesn't is a **miss**,
and it pays for the cache check plus the slow fetch. The **hit rate** is hits
divided by total lookups. Say a Redis lookup takes about 1 ms and the database
takes 50 ms, so a miss costs 51 ms. The average request then takes
1 ms + (1 − hit rate) × 50 ms:

| Hit rate | Average request | Share of reads reaching the database |
| -------- | --------------- | ------------------------------------ |
| 50%      | 26 ms           | 1 in 2                               |
| 90%      | 6 ms            | 1 in 10                              |
| 99%      | 1.5 ms          | 1 in 100                             |

The last nine points cut the average fourfold, from 6 ms to 1.5 ms, and the
database's load tenfold. That is often why a cache is added: the
database can serve far more shoppers when it sees a hundredth of their reads.

A cache also starts empty, and an empty cache misses on everything, so a
restart can send a wall of traffic to the database at once (see [Thundering
Herd Problem](/systems-and-infrastructure/thundering-herd-problem)).

## What does it throw out?

Memory is finite, so a full cache must decide what to discard. That decision
is its **eviction policy**.

**LRU** (least recently used) drops whichever entry has gone longest without
being read, on the bet that a book viewed a minute ago is likelier to be
viewed again than one last touched last week. Its known weakness is the
one-time scan. Suppose a nightly report reads every one of the two million
rows once: each row enters the cache as the most recently used, and the
bestsellers get pushed out in favor of books nobody will ask for again.
**LFU** (least frequently used) counts reads instead of recency, so it
resists that scan, at the cost of being slow to forget an entry that used to
be popular. Redis, for one, lets you choose between them.

A **TTL** (time to live) is a different mechanism: each entry expires after a
fixed time whether or not memory is short. It is mainly a correctness tool,
capping how stale a copy can get.

## How big should it be?

The cache doesn't need to hold all two million books. Popularity is usually
lopsided, with a small share of items drawing most of the requests, so a
cache holding the hot **working set** (the data being asked for over a
period) can reach a high hit rate at a fraction of the data's total size.
Say the bookshop's working set is 50,000 titles.

To size the cache, measure. If a 20,000-entry cache shows a low hit rate and
entries evicted soon after they're added, it is smaller than the working set,
and more room will help. If the hit rate is low but little is evicted, memory
isn't the constraint. Either almost
nothing is requested twice, entries expire early because the TTL is short, or
the cache is still warming up after a restart.

**Rule of thumb.** Put the cache as close to the reader as the data allows,
size it to the working set rather than to the whole dataset, and judge it by
the hit rate and the load it takes off the database, not by how fast a single
lookup is.

## Where you'll meet this

A URL shortener's links almost never change after creation, so its cache can
hold them for a long TTL: popular links are served from cache, and the
database sees mostly the long tail of rarely followed ones. A news feed is
harder: a timeline assembled per reader differs for everyone, so a CDN can't
share it and the application cache holds the largest working set. In chat, the recent messages of active conversations form a small,
constantly shifting working set, and a bulk export of old history is the kind
of scan that can flush the useful entries out of an LRU cache.
