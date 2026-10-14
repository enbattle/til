---
title: Design a Social Media Feed (like Instagram)
summary: Home feeds for 500 million daily users, built by pushing posts to ordinary accounts' followers and pulling the posts of accounts with over 100,000 followers at read time.
date: 2026-10-05
order: 4
template: 3
---

You're asked to design the home screen of a photo-sharing app, like Instagram's. It's the **feed**, a scrolling list of recent posts from the accounts you follow, your **followees**; the people who follow you are your followers. "Posts by anyone I follow, newest first" sounds like one query, but at this scale it's the most expensive thing the system does.

So the question is when to do that work: once per post, when it's written, or once per view, when it's read. The answer here is both, depending on who posted. This page starts with the obvious design and shows where it breaks, then follows a post through the design that replaces it, sizes its parts, and makes three decisions: who gets pushed, where feeds are stored, and how likes are counted.

## Requirements

- A home feed of followed accounts' posts, 20 at a time, plus posting, following and likes.
- 1 billion monthly users, 500 million daily, 10 feed requests each a day, 100 million new posts a day.
- A user follows 200 accounts, about 190 of them ordinary. 10,000 accounts have over 100,000 followers (1 million on average, the largest 50 million) and post twice a day.
- A feed page in under 200 ms at p99 (99% of requests are faster); a new post reaches followers' feeds within 5 seconds normally.
- Reading the feed is up 99.99% of the time, posting and liking 99.9%; counts may lag.

Out of scope: video, comments, search and ads.

## Start simple

The obvious design builds your feed when you open it, called **pulling** the feed at read time. The machine answering your request is an **app server**, one of many identical servers that handle the app's API calls.

A database holds every post, the **post store**, and a table of who follows whom, the **follow graph**. The app server looks up the newest posts of each of your 200 followees, merges the 200 lists by time and returns the top 20.

For a small app, that's fine. Say it has 10,000 daily users, each opening the feed 10 times a day, and peak traffic is ten times the average ([numbers every engineer should know](/engineering-practices/numbers-every-engineer-should-know)):

```text
feed requests a day:
  10,000 users × 10 = 100,000
average:
  100,000 ÷ 86,400 s ≈ 1.2 a second
peak:
  1.2 × 10 = 12 a second
lookups at peak:
  12 × 200 followees
  = 2,400 a second
```

One database handles that easily. Now run the same steps on this app's numbers, assuming one database server answers about 50,000 lookups a second:

```text
feed requests a day:
  500,000,000 users × 10
  = 5,000,000,000
average:
  5,000,000,000 ÷ 86,400 s
  ≈ 58,000 a second
peak:
  58,000 × 10 = 580,000 a second
lookups at peak:
  580,000 × 200 followees
  = 116,000,000 a second
servers to gather:
  116,000,000 ÷ 50,000 ≈ 2,300

a lookup is slower than its p99
1 time in 100, so per feed request:
all 200 fast:
  0.99^200 ≈ 0.13
one or more slow:
  1 − 0.13 ≈ 0.87
```

That's 116 million lookups a second, about 2,300 servers just to gather posts, and 87% of feed requests wait on at least one slow lookup, so the slowest lookups, not typical ones, decide whether a page meets its 200 ms target.

So move the work to the moment a post is written. Each user gets a **timeline**, a list of the post IDs that belong in their feed, newest first, all held in memory in the **timeline cache**.

When @maya, who has 400 followers, posts, her post's ID is copied into 400 timelines. Delivering a post to every follower like this is called **fan-out**, or pushing. Gathering a feed is then one timeline lookup: 580,000 a second instead of 116 million, 200 times fewer.

The work hasn't vanished, though. It has moved to the writes.

## High-level architecture

![Architecture of the social feed. A mobile or web client sends API calls to the app servers, and uploads and loads images through object storage and its CDN, drawn as one node. The app servers read timelines from the timeline cache and write the author's own new post into it, write and read posts and likes in the post store and the post cache in front of it, drawn as one node, and read and write follows in the follow graph. Each write goes into its store together with an event, and a relay publishes the stored events from both the post store and the follow graph to an event queue. Workers consume the queue: they write resized images to object storage, mark posts live, write counts and author_posts in the post store, page through followers in the follow graph, push and remove post IDs in the timeline cache, and publish each celebrity post back to the queue, from which the app servers receive it.](/diagrams/social-feed/architecture.svg)

Follow @maya's post. The app server that receives it writes the post and a "post created" event to the post store in a single write, so both land or neither does, and puts the post at the top of @maya's own timeline. This is the [outbox pattern](/systems-and-infrastructure/outbox-pattern): the event waits in its store until a **relay**, a small process that forwards stored events, publishes it, so a crash can't strand a post. Likes are written the same way, and a follow lands in the follow graph with its own event.

The relay publishes it to the **event queue**, a [message queue](/systems-and-infrastructure/message-queues) that holds events until something takes them. A **worker**, one of a [pool of processes](/systems-and-infrastructure/worker-pools) that take events off the queue, picks it up, resizes the photo and marks the post live. Then it pages through @maya's 400 followers in the follow graph and inserts the post's ID into each one's timeline in the timeline cache. An unfollow runs the same way, removing IDs.

To read, an app server takes the viewer's timeline from the timeline cache. The cache is split into [shards](/systems-and-infrastructure/partitioning-vs-sharding), slices of the users each held by one machine, and keeps a second copy of each shard on another machine. The app server then fetches what the 20 posts need from the **post cache**, popular posts kept in memory in front of the post store ([caching](/systems-and-infrastructure/caching)): the posts, their authors, their like counts and whether the viewer liked each. Photos take their own path, covered with the API. The diagram's last path, celebrity posts flowing back through the queue to the app servers, is the first decision, once the parts are sized.

## Key numbers

These size the app servers, the workers, the timeline cache and the post store's busiest row, one hot post's like count. A day is 86,400 seconds, and peak is ten times the average.

- **App servers:** about 580,000 timeline reads a second at peak, one per feed request, as worked out in "Start simple".
- **Delivery workers:** about 220,000 timeline inserts a second on average if only ordinary accounts push. Each follow has one follower and one followee, so 1 billion users × 190 ordinary follows = 190 billion follows, spread over about 1 billion ordinary accounts, gives each about 190 followers. Then 100 million posts × 190 = 19 billion inserts a day, and 19 billion ÷ 86,400 ≈ 220,000 a second.
- **Workers, pushing everything:** about 451,000 inserts a second on average, 4.5 million at peak. The large accounts add 10,000 × 2 posts × 1 million followers = 20 billion inserts a day; 19 + 20 = 39 billion, 39 billion ÷ 86,400 ≈ 451,000 a second, and 451,000 × 10 ≈ 4.5 million at peak. Their 20,000 posts are 0.02% of the 100 million, yet cause over half the inserts.
- **Timeline cache:** about 8 TB of entries. 1 billion users × 500 entries × 16 bytes = 8 TB. With the second copy of each shard, 8 TB × 2 = 16 TB, so plan about 20 TB with overhead.
- **Post store, one hot post:** about 1,400 likes a second. If 10% of the largest account's 50 million followers like a post within an hour, that's 5 million likes, and 5,000,000 ÷ 3,600 ≈ 1,400 a second.

The lopsided third line drives the first decision; the last drives the third.

## API and data model

```http
POST /posts       { "media_id": "m_8f2c", "caption": "First loaf that didn't collapse" }
-> 201 { "post_id": "892411121162670085" }

GET /feed?limit=20&cursor=<opaque>
-> 200 { "posts": [...], "next_cursor": "<opaque>" }

PUT /posts/{post_id}/like       (repeating it changes nothing)
```

```text
posts      post_id (time-ordered, 64-bit), author_id, caption, media_key, created_at
follows    (followee_id, follower_id) and (follower_id, followee_id), both stored
likes      primary key (user_id, post_id)
timeline   per user: up to 500 (post_id, author_id) pairs, newest first
```

The `media_id` names a photo the client has already uploaded straight to **object storage**, a service that stores files by name, where a worker also saves resized copies. Readers load photos through a **CDN**, servers near users that keep copies of popular files.

Post IDs sort by creation time, so merging two lists of posts is merging two sorted lists. A **cursor**, where a page ended, can then be the last ID seen. It's sent as a string because JSON numbers lose digits past 2⁵³.

A feed page's four lookups, the posts, their authors, their like counts and whether the viewer liked each, go out as four **batched calls**, each asking for all 20 posts at once, instead of 80 single lookups ([N+1 queries](/systems-and-infrastructure/n-plus-one-queries)). `likes` is keyed by user, so the last of them, "which of these 20 has this viewer liked?", hits one shard.

That's the shape. Now for the 50-million-follower account.

## Decision: push for ordinary accounts, pull for celebrities

The simpler design pushes every post, one path for everyone. It works for most apps. Here, a post from the 50-million-follower account is 50 million inserts. Even a fleet sized to push everything at peak, 4.5 million inserts a second, needs 50,000,000 ÷ 4,500,000 ≈ 11 seconds for that one post, and ordinary posts queued behind it miss their 5-second target.

So split the accounts. One with over 100,000 followers is a **celebrity**, and its posts aren't pushed. A celebrity post is only appended to `author_posts`, the author's own list in the post store, as every post is, and published back to the queue for every app server. Each app server keeps the newest 100 IDs of all 10,000 celebrities in memory: 10,000 × 100 IDs × 8 bytes = 8 MB. A read merges the viewer's timeline with the lists of the roughly 10 celebrities they follow.

![The hybrid fan-out. Posts by @maya, who has 400 followers, and by @star, who has 50 million, both reach the workers as post events. For @maya's post the workers push its ID into 400 timelines in the timeline cache. For @star's post they only append the ID to author_posts in the post store, as they do for every post, and send it to the app server, which keeps celebrity lists in memory. When a reader opens the feed, GET /feed reaches that app server, which reads the reader's timeline from the timeline cache and merges it with the in-memory lists.](/diagrams/social-feed/fan-out.svg)

Now no post costs over about 100,000 inserts. The price is two paths to build and test, and a merge on every read.

**Rule of thumb.** When fan-out is wildly uneven, split on the size of the tail: do the work up front where it's cheap and at read time where it's not.

## Decision: timelines of IDs in memory

Where should 8 TB of timelines live? The obvious answer is on disk, in a wide-column store such as Cassandra, a database built to spread huge tables over many machines. Disk costs far less per byte than memory, and a read of a few milliseconds still fits the 200 ms target.

It breaks on machine count, because this store is sized by its write rate, not its bytes. Assume each of its servers handles the same 50,000 operations a second as in "Start simple", writes included, and that it keeps two copies of every row, like the timeline cache:

```text
inserts at peak (ordinary accounts):
  220,000 × 10 = 2,200,000 a second
writes, two copies:
  2,200,000 × 2
  = 4,400,000 a second
servers for writes:
  4,400,000 ÷ 50,000 = 88
servers for reads (one copy each):
  580,000 ÷ 50,000 ≈ 12
total:
  88 + 12 = 100 servers
bytes, two copies:
  8 TB × 2 = 16 TB,
  or 8 disks of 2 TB
```

That's about 100 servers for data eight disks could hold. Memory is sized by bytes instead. Assume a machine with 256 GB of memory, and that an in-memory store handles over 100,000 simple operations a second:

```text
machines:
  20,000 GB ÷ 256 GB ≈ 80
operations each, two copies:
  (2,200,000 × 2 + 580,000) ÷ 80
  ≈ 62,000 a second
```

The margin is thin, 80 machines against 100, and a memory machine costs more, so fewer machines needn't mean less money. Headroom decides it: the disk servers run at their limit, so more writes mean more servers; memory machines run well under theirs, and capped timelines gain no bytes. So the timelines live in memory, each one a Redis sorted set (members kept in order) of up to 500 entries at about 16 bytes each. Users map to shards by [consistent hashing](/systems-and-infrastructure/consistent-hashing), which moves few users when a machine joins or leaves.

Memory still costs far more per byte, and a shard loses its timelines if both of its copies fail. But a timeline is derived data: if one is lost, a pull from the user's 200 followees rebuilds it, so it needs no backup.

**Rule of thumb.** Size a store by whatever runs out first, bytes or operations; when operations do, disk's low price per byte stops deciding, and data you can rebuild can live in memory.

## Decision: count likes through a queue

The `likes` rows spread across shards by user, but a post's total doesn't spread: every like adds one to the same counter row. Assume each update locks that row for about 2 ms while the database saves it for good. Then one row takes at most 1,000 ÷ 2 = 500 updates a second, and the hot post sends 1,400, so the rest wait in line.

The fix a reader would suggest is a **sharded counter**: spread the post's count over 20 rows, so each takes 1,400 ÷ 20 = 70 updates a second, and counts stay current. But a read sums 20 rows, and each post needs its own row count, tuned to its traffic.

Here, the app server records the like and an event together, and the queue sends each post's events to the one worker that owns it. Once a second, that worker writes one increment, such as "+1,387", so a hot post costs one write a second ([batching](/systems-and-infrastructure/batching-and-asynchronous-writes)). The queue needs no tuning. Its cost is a count up to a second or so behind, which the requirements already allow.

**Rule of thumb.** If a value may lag, batch its writes; if it must be current, split the hot row.

## Likely follow-ups

- **What if both copies of a timeline shard are lost?** Each affected user's timeline is rebuilt by a pull when they next open the app. Cap concurrent rebuilds.
- **What if a celebrity's post is a hot key, one cache entry read by millions?** When its cache entry expires, millions of feeds miss together, a [thundering herd](/systems-and-infrastructure/thundering-herd-problem). Serve the old entry while one request rebuilds it.
- **How do you rank the feed?** Score the newest 500 candidates by affinity (how much the viewer interacts with the author) decayed by age, and fall back to newest first if ranking is down.
- **What happens when a celebrity drops below the line?** Promote at 100,000 followers but demote below 80,000, so an account near the line doesn't flip back and forth.
