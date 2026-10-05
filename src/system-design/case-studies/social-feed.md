---
title: Design a Social Media Feed (like Instagram)
summary: Home feeds for 500 million daily users, built by pushing posts to ordinary accounts' followers and pulling the posts of accounts with over 100,000 followers at read time.
date: 2026-10-05
order: 4
template: 2
---

You're asked to design the home screen of a photo-sharing app, like Instagram's. It's the **feed**, a scrolling list of recent posts from the accounts you follow, your **followees**; the people who follow you are your **followers**. "Posts by anyone I follow, newest first" sounds like one query, but at this scale it's the most expensive thing the system does. So the interview is about when to do that work: once per post, when it's written, or once per view, when it's read. It depends on who posted.

## Requirements

- A home feed of followed accounts' posts, 20 at a time, plus posting, following and likes.
- 1 billion monthly users, 500 million daily, 10 feed requests each a day, 100 million new posts a day.
- A user follows 200 accounts, about 190 of them ordinary. 10,000 accounts have over 100,000 followers (1 million on average, the largest 50 million) and post twice a day.
- A feed page in under 200 ms at p99 (99% of requests are faster); a new post reaches followers' feeds within 5 seconds normally.
- Reading the feed is up 99.99% of the time, posting and liking 99.9%; counts may lag.

Out of scope: video, comments, search and ads.

## Key numbers

The numbers size the servers answering feed requests, the workers delivering posts and the cache holding each user's feed. Peak is ten times average ([numbers every engineer should know](/engineering-practices/numbers-every-engineer-should-know)):

- **Feed servers:** about 580,000 requests a second at peak. 500 million × 10 = 5 billion a day ÷ 86,400 ≈ 58,000 on average.
- **Delivery workers:** about 220,000 inserts a second on average if only ordinary accounts push. 100 million posts × 190 followers each = 19 billion a day. The 10,000 large accounts would add 20 billion more.
- **Gathering at read time:** 116 million lookups a second at peak. 580,000 requests × 200 followees.
- **Timeline cache:** about 8 TB of entries. 1 billion users × 500 entries × 16 bytes; plan about 20 TB with overhead and a replica of each shard.
- **One hot post:** about 1,400 likes a second. 10% of 50 million followers in an hour, 5 million ÷ 3,600.

Pushing everything would be 451,000 a second, over half of it from 0.02% of the posts.

## High-level architecture

![Architecture of the social feed. A mobile or web client sends API calls to the app servers, and uploads and loads images through object storage and its CDN, drawn as one node. The app servers read timelines from the timeline cache and write the author's own new post into it, write and read posts and likes in the post store and the post cache in front of it, drawn as one node, read and write follows in the follow graph, and publish posts, likes and follows to an event queue. Workers consume the queue: they write resized images to object storage, mark posts live, write counts and author_posts in the post store, page through followers in the follow graph, push and remove post IDs in the timeline cache, and publish each celebrity post back to the queue, from which the app servers receive it.](/diagrams/social-feed/architecture.svg)

Follow a post by @maya, who has 400 followers. The **app server** writes the post and a "post created" event in one atomic write, and a relay publishes the event to the **event queue**, a [message queue](/systems-and-infrastructure/message-queues) ([outbox pattern](/systems-and-infrastructure/outbox-pattern), so a crash can't strand a post). A **worker** resizes the image into **object storage** (files by name, behind a CDN), then pages through @maya's followers in the **follow graph** and inserts the post's ID into each one's timeline in the **timeline cache**. To read, an app server takes the viewer's timeline and fetches the 20 posts, authors, counts and likes from the **post store** and its cache in four batched calls, not 80.

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

Post IDs sort by creation time, so merging two lists of posts is merging two sorted lists, and a **cursor** (where a page ended) can be the last ID seen, sent as a string because JSON numbers lose digits past 2⁵³. `likes` is keyed by user, so "which of these 20 has this viewer liked?" hits one shard.

Now the three choices.

## Decision: push for ordinary accounts, pull for celebrities

**Fan-out** means delivering a post's ID to many places at once; here, into each follower's timeline. Push to everyone and a feed read is one lookup in memory. But a post from the 50-million-follower account is 50 million inserts, about 11 seconds of a fleet sized for pushing everything at peak (4.5 million a second), and ordinary posts queued behind it miss their 5-second target. So an account over 100,000 followers is a **celebrity**: its post is only appended to `author_posts` and sent to every app server, which keeps the newest 100 IDs of all 10,000 celebrities in memory, 8 MB. A read merges the viewer's timeline with those lists; no post costs over 100,000 inserts.

![The hybrid fan-out. Posts by @maya, who has 400 followers, and by @star, who has 50 million, both reach the workers as post events. For @maya's post the workers push its ID into 400 timelines in the timeline cache. For @star's post they only append the ID to author_posts in the post store, as they do for every post, and send it to the app server, which keeps celebrity lists in memory. When a reader opens the feed, GET /feed reaches that app server, which reads the reader's timeline from the timeline cache and merges it with the in-memory lists.](/diagrams/social-feed/fan-out.svg)

Why not push everyone, the simpler single path? It works for most apps; here, one celebrity post stalls the rest. The hybrid's price is two paths and a merge.

**Rule of thumb.** When fan-out is wildly uneven, split on the size of the tail: do the work up front where it's cheap and at read time where it's not.

## Decision: timelines of IDs in memory

Where does a timeline live? In memory, in a Redis sorted set (members kept in order). Every score is 0, so members sort by the post ID they start with, and a raised compact-encoding limit keeps 500 of them near 20 bytes each. A timeline is derived data: if one is lost, a pull from the user's 200 followees rebuilds it, so it needs no backup. Users map to shards by [consistent hashing](/systems-and-infrastructure/consistent-hashing).

Why not a wide-column store such as Cassandra, on disk? That works too, and holds the 8 TB far more cheaply. But reads take milliseconds, not a fraction of one, and trimming to 500 after each insert leaves deletion markers (tombstones) that reads must skip until compaction. At 580,000 reads a second, memory is worth its price.

**Rule of thumb.** If you can rebuild data from a source of truth, optimize it for speed and let the store be disposable.

## Decision: count likes through a queue

The `likes` rows spread out, but a post's total doesn't: 1,400 updates a second to one counter row, each waiting a few milliseconds to commit while the rest queue. So the app server records the like and an event, and the worker that owns the post takes its events from the queue and, once a second, writes one increment, "+1,387". A hot post costs one write a second ([batching](/systems-and-infrastructure/batching-and-asynchronous-writes)).

Why not a **sharded counter**, spreading a post's count over 20 rows? It works too, and counts stay current. But a read sums 20 rows, and each post needs its own row count. The queue needs no tuning, and the requirements already let counts lag.

**Rule of thumb.** If a value may lag, batch its writes; if it must be current, split the hot row.

## Likely follow-ups

- **What if both copies of a timeline shard are lost?** Each affected user's timeline is rebuilt by a pull when they next open the app. Cap concurrent rebuilds.
- **What if a celebrity's post is a hot key?** When its cache entry expires, millions of feeds miss together, a [thundering herd](/systems-and-infrastructure/thundering-herd-problem). Let one request fetch while the rest wait.
- **How do you rank the feed?** Score the newest 500 candidates by affinity (how much the viewer interacts with the author) decayed by age, and fall back to newest first if ranking is down.
- **What happens when a celebrity drops below the line?** Promote at 100,000 followers but demote below 80,000, so an account near the line doesn't flip back and forth.
