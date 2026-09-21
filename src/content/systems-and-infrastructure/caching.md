---
title: 'Caching: Placement, Hit Rate, and Eviction'
summary: A cache trades a little memory for a lot of speed, and how much depends on where it sits, how often lookups find what they want, and what it throws out when full.
date: 2026-09-21
---

A **cache** is a small, fast store holding copies of data that is slower
to get from its original source. The first time something is requested,
the system fetches it the slow way and keeps a copy; later requests for
the same thing are answered from the copy. Doing this well comes down to
where the cache sits, how much of the traffic it answers, and what it
drops when it runs out of room. Keeping the copies correct once the
original changes is a separate problem, covered in [Cache
Invalidation](/systems-and-infrastructure/cache-invalidation).

## Where a cache sits

A request from a user's device to a database passes through several
places where a copy can be kept. The closer to the user, the faster the
answer and the less work for every layer behind it.

- The **browser** keeps its own copy of images, scripts and pages, as
  instructed by the `Cache-Control` header the server sends. Using it
  needs no network request at all, but it belongs to one user on one
  device, and the server can't reach in and delete it.
- A **CDN** (content delivery network) is a set of servers around the
  world that keep copies of responses, so a reader in Sydney is served
  from a nearby machine instead of one in Virginia. It suits responses
  that are identical for everyone.
- An **application cache** is a fast in-memory store the application
  checks before querying the database. It can live inside each
  application process, which is quickest but leaves every server with
  its own copy that may differ from its neighbors', or in a shared
  service like Redis or Memcached that all servers consult.
- The **database** caches too, keeping recently read pages of data in
  memory with no effort from the application.

## Hit rate

A lookup that finds the data is a **hit**; one that doesn't is a
**miss**, and it pays for the cache check plus the slow fetch. The
**hit rate** is hits divided by total lookups.

Suppose a cache lookup takes 1 ms and a database query takes 50 ms, so a
miss costs about 51 ms. At a 50% hit rate the average request takes
about 26 ms; at 90%, about 6 ms; at 99%, about 1.5 ms. The database's
load falls more steeply: at 90% it still sees one read in ten, at 99%
one in a hundred, so that last stretch cuts its load tenfold.

A cache also starts empty, and an empty cache misses on everything, so a
restart can send a wall of traffic to the database at once (see
[Thundering Herd
Problem](/systems-and-infrastructure/thundering-herd-problem)).

## Eviction

Memory is finite, so a full cache has to decide what to discard. That
decision is its **eviction policy**.

**LRU** (least recently used) drops whichever entry has gone longest
without being read, on the bet that what was read a minute ago is likelier
to be read again than what was last touched last week. Its known weakness
is the one-time scan: a report that reads every row of a table once can
push out all the popular entries in favor of data nobody will ask for
again. **LFU** (least frequently used) counts reads instead of recency
and resists that, at the cost of being slow to forget an entry that used
to be popular. Redis lets you choose among these.

A **TTL** (time to live) is a different mechanism: each entry expires
after a fixed time whether or not memory is short. It's mainly a
correctness tool, capping how stale a copy can get.

## Sizing

A cache seldom needs to hold everything. Popularity is usually lopsided,
with a small share of items drawing most of the requests, so a cache
holding the hot **working set** (the data actually being asked for over
a period) can reach a high hit rate at a fraction of the data's total
size.

To size one, measure. If the hit rate is low and entries are evicted
soon after they're added, the cache is smaller than the working set and
more room will help. If the hit rate is low but little is evicted,
memory isn't the constraint. Either almost nothing gets requested twice,
entries expire early because the TTL is short, or the cache is still
warming up after a restart.

## Where you'll meet this

A URL shortener is close to an ideal caching case: a small share of
links get most of the clicks, so a cache holding the popular ones
answers most redirects and the database sees mostly the rarely followed
tail. A news feed caches at several layers at once, with images on a CDN
and post data in an application cache; when timelines are assembled per
reader, that is where the working set is largest and the hit rate
hardest to keep high. In chat, the recent messages of active
conversations make a natural working set, while a bulk export of old
history is the kind of scan LRU handles badly.
