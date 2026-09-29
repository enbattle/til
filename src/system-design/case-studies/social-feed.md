---
title: Design a Social Media Feed (like Instagram)
summary: Building home feeds from followed accounts, and why pushing every post to followers breaks on an account with 50 million followers while gathering them at read time breaks on everyone else.
date: 2026-09-28
order: 4
---

A photo-sharing app has one screen people open more than any other: the home
**feed**, a scrolling list of recent posts from the accounts the viewer
follows. Following is one-way. If you follow a bakery, the bakery's posts
appear in your feed, and nothing appears in the bakery's feed unless it
follows you back. The accounts you follow are your **followees**; the people
who follow you are your **followers**.

Showing one person their feed sounds like one query: "posts by anyone I
follow, newest first, 20 at a time". At the scale of hundreds of millions of
people opening the app several times a day, that query is the most expensive
thing the system does, and the design is mostly about when to do that work:
once per post, when it is written, or once per view, when it is read. The
answer turns out to depend on who posted. What follows is one plausible
design for an app like Instagram, not a description of how any particular
company built theirs.

## At a glance

**Requirements.**

- A home feed of followed accounts' posts, 20 at a time, plus posting,
  following, likes and comments.
- 1 billion monthly and 500 million daily active users, 10 feed requests
  each a day, 100 million new posts a day.
- 200 followees per user on average; 10,000 accounts over 100,000
  followers, the largest at 50 million.
- A feed page in under 200 ms at p99; a new post in followers' feeds within
  5 seconds normally, a minute at worst.
- Feed reads 99.99% available, posting and liking 99.9%; counts may lag a
  few seconds.

**Key numbers.** From the estimates:

- 580,000 feed requests a second at peak: 5 billion ÷ 86,400 ≈ 58,000, times
  ten.
- 451,000 timeline inserts a second if every post fanned out: 19 billion
  ordinary plus 20 billion celebrity inserts a day, ÷ 86,400.
- 116 million lookups a second at peak if feeds were gathered at read time:
  580,000 × 200 followees.
- 8 TB of timelines: 1 billion users × 500 entries × 16 bytes.
- 1,400 likes a second on one post: 10% of 50 million followers in an hour.

**Key decisions.**

- Push ordinary accounts' posts, pull those of accounts over 100,000
  followers: inserts fall to 220,000 a second, at most 100,000 per post
  ([fan-out deep dive](#deep-dive-fan-out-on-write-fan-out-on-read-and-celebrities)).
- Timelines of post IDs in memory: derived data, rebuilt from followees in
  tens of milliseconds if lost
  ([timeline deep dive](#deep-dive-timeline-storage-and-hydration)).
- Like counts batched through a queue, one write per post a second: no counter
  row takes thousands of writes a second
  ([counting deep dive](#deep-dive-counting-likes-and-comments)).

**Likely follow-ups.**

- Why not push every post? One 50-million-follower post would hold the
  whole fan-out fleet for about 11 seconds, delaying every post behind it
  ([fan-out](#deep-dive-fan-out-on-write-fan-out-on-read-and-celebrities)).
- How is the threshold chosen? 100,000 is a starting point, tuned against
  fan-out lag and feed latency, with demotion only below 80,000
  ([fan-out](#deep-dive-fan-out-on-write-fan-out-on-read-and-celebrities)).
- How do IDs become posts quickly? Four batched calls issued at once
  instead of 80 round trips
  ([hydration](#deep-dive-timeline-storage-and-hydration)).
- Why a cursor, not a page number? New posts shift a numbered list; a cursor
  names a position in a stored feed session
  ([pagination](#deep-dive-ranking-and-pagination)).
- What if a timeline shard loses both copies? Its roughly 2.6 million
  users' timelines are rebuilt by a pull as each user next opens the app
  ([failure modes](#failure-modes-and-bottlenecks)).

The components, and a post's path from upload to followers' timelines, are in
[High-level architecture](#high-level-architecture).

## Requirements

Functional requirements:

- **Post.** A user uploads a photo with a caption. The photo is shown in a
  few fixed sizes; video is out of scope here.
- **Follow and unfollow** any public account.
- **Home feed.** A user sees posts from the accounts they follow, 20 at a
  time, and can scroll for more and pull to refresh for newer ones.
- **Like and comment** on a post, and see each post's like and comment
  counts.
- **Profile.** Anyone can see one account's own posts, newest first.
- **Ranking (optional).** Order the feed by a simple relevance score rather
  than strictly by time, while still favoring recent posts.

Out of scope: video and anything that transcodes media, stories, direct
messages, search, the "explore" page that suggests accounts you don't follow
(a full recommendation system is a subject of its own), notifications, ads,
private accounts, the list of who liked a post, and content moderation. None
changes how the home feed is built.

Non-functional requirements:

- **Scale:** 1 billion monthly active users, 500 million of them active on a
  given day. A daily active user makes 10 feed requests a day (opening the
  app, pulling to refresh, or scrolling to the next page of 20), likes 10
  posts and writes 1 comment. One in five of them posts once a day, so 100
  million new posts a day.
- **The follow graph:** a user follows 200 accounts on average. Follower
  counts have a long tail: most accounts have under a couple of hundred,
  and a few have millions. Assume 10,000 accounts with more than 100,000
  followers, averaging 1 million (the largest has 50 million), each posting
  twice a day. So the typical user follows about 10 of these large accounts
  and 190 ordinary ones.
- **Latency:** a feed page returns in under 200 ms at the 99th percentile
  (p99, the time 99% of requests beat), measured at our servers. A new post
  appears in followers' feeds within 5 seconds normally, and within a minute
  at worst.
- **Availability:** reading the feed 99.99%. Posting, liking and following
  99.9%. A feed that is a few seconds stale is fine; a feed that fails to
  load is not. [CAP theorem](/systems-and-infrastructure/cap-theorem) names
  that preference: when parts of the system can't reach each other, keep
  answering, even from slightly old data.
- **Counts** may lag by a few seconds and may be shown rounded ("1.2M
  likes"); they need not be exact at every instant.

## Back-of-the-envelope estimates

Two rules of thumb from
[numbers every engineer should know](/engineering-practices/numbers-every-engineer-should-know)
are used below: one million requests a day is about 12 a second, and peak
traffic is planned at ten times the average. A day is 86,400 seconds.

**Requests per second.**

- Feed requests: 500 million × 10 = 5 billion a day. 5,000,000,000 ÷ 86,400
  ≈ 57,900, call it **58,000 a second**, and **580,000 at peak**. The rule
  of thumb agrees: 5,000 million × 12 = 60,000.
- New posts: 100,000,000 ÷ 86,400 ≈ 1,157, call it **1,200 a second**, and
  12,000 at peak.
- Likes: 500 million × 10 = 5 billion a day, the same 58,000 a second as feed
  requests, 580,000 at peak.
- Comments: 500 million a day ÷ 86,400 ≈ 5,800 a second, 58,000 at peak.

Feed requests outnumber posts about 50 to 1. That points the design at the
read path, but the next three lines show the write side is not cheap either.

**Fan-out.** To **fan out** a post is to deliver a copy of it, or its ID, to
many places at once: here, one entry into the precomputed feed of each
follower. Every follow has one follower and one followee, so 1 billion users
× 190 ordinary follows gives about 1 billion ordinary accounts 190 billion
followers, 190 each on average. Most have fewer, since the tail pulls the
mean up; assuming posters are average, an ordinary post reaches 190. If every
post were fanned out to every follower:

- Ordinary posts: 100 million a day × 190 followers = 19 billion feed inserts
  a day.
- Posts by the 10,000 large accounts: 10,000 × 2 = 20,000 posts a day × 1
  million followers = 20 billion inserts a day.
- Together, 39 billion a day ÷ 86,400 ≈ **451,000 inserts a second**, 4.5
  million at peak.

The large accounts write 0.02% of the posts and cause more than half of the
inserts. That imbalance is the celebrity problem, and the first deep dive is
about it.

**Gathering at read time instead.** If nothing were precomputed and each feed
request looked up the recent posts of all 200 followees, that is 58,000 × 200
= **11.6 million lookups a second**, 116 million at peak, before any merging
or sorting.

**Timeline storage.** Each user's precomputed feed, their **timeline**, is a
list of entries of a post ID (8 bytes) and its author's ID (8 bytes), capped
at the newest 500:

- 500 × 16 bytes = 8,000 bytes, about 8 KB per user.
- For every monthly active user: 1,000,000,000 × 8 KB = **8 TB**.
- Fanning out ordinary posts only, the average timeline gains
  19 billion ÷ 1 billion = 19 entries a day, so 500 entries hold about 26
  days of posts for a typical user.

**Posts.** About 1 KB each for the caption, IDs, timestamps and the image's
storage key: 100 million × 1 KB = 100 GB a day, about **180 TB over five
years** (100 GB × 365 × 5 = 182.5 TB), roughly 550 TB with three copies.

**Images.** The phone uploads a compressed photo of about 2 MB, and the
service keeps it plus three sizes: 1,080 pixels wide (about 300 KB), 640
wide (100 KB) and a 150-pixel thumbnail (10 KB), about 2.4 MB per post.

- Stored: 100 million × 2.4 MB = 240 TB a day. **Object storage**, a service
  that keeps files by name across many machines, makes it durable with
  erasure coding (parity pieces spread across machines) for about 1.5×
  rather than three copies: 360 TB of disk a day, about **130 PB a year**.
- Uploaded: 100 million × 2 MB ÷ 86,400 ≈ 2.3 GB a second, about 19 gigabits
  a second on average and ten times that at peak.
- Served: if each feed request downloads 10 new images at the 1,080 size
  (the rest are already on the phone), 5 billion × 10 × 300 KB = 15 PB a
  day, about 174 GB a second, or **1.4 terabits a second** on average.

**Likes.** A like row is two IDs, a timestamp and overhead, about 40 bytes:
5 billion × 40 bytes = 200 GB a day. The awkward part is concentration: if
10% of a 50-million-follower account's followers like a post in its first
hour, that is 5,000,000 ÷ 3,600 ≈ **1,400 likes a second on one post**, and
more than that in the first few minutes.

What the estimates say: images are huge but simple, and belong to object
storage and a **CDN** (content delivery network: caching servers close to
users). The feed is the hard part, and neither extreme works as
is: gathering on every read costs over 100 million lookups a second at peak,
and pushing every post costs 4.5 million inserts a second at peak, more than
half of them for 10,000 accounts.

## Data model

Images are files in object storage; everything else is a small record.
"Sharded by X" below means the table is split across many machines, each
row placed by its value of X:

```text
users                          sharded by user_id
  user_id, handle, display_name, avatar_key

posts                          key-value / wide-column, sharded by post_id
  post_id      int64, primary key   time-ordered, see below
  author_id    int64
  caption      string               up to 2,200 characters
  media_key    string               where the image sizes live in object storage
  status       enum                 processing, live, deleted
  created_at   timestamp

author_posts                   sharded by author_id
  author_id    int64    partition key
  post_id      int64    sorted newest first
  -- one account's posts, for its profile page and for the celebrity path

follows                        sharded by user; stored in both directions
  followers:  (followee_id, follower_id)   "who follows X", used by fan-out
  following:  (follower_id, followee_id)   "whom does X follow", used by reads

likes                          sharded by user_id
  user_id      int64    partition key
  post_id      int64
  created_at   timestamp
  -- primary key (user_id, post_id): a user can like a post once

comments                       sharded by post_id
  post_id, comment_id, author_id, text, created_at

post_counts
  post_id, like_count, comment_count

timeline:{user_id}             in the timeline cache
  up to 500 (post_id, author_id) pairs, newest first
```

**Post IDs sort by time.** Each ID is a 64-bit number: a zero top bit (so it
stays positive), 41 bits of milliseconds since a fixed start date (about 69
years' worth), 10 bits naming the minting machine (up to 1,024) and a 12-bit
counter that machine resets every millisecond (4,096 IDs per millisecond).
Any server mints IDs without asking anyone, no two machines mint the same
one, and sorting by ID sorts by creation time, to within the few
milliseconds by which machines' clocks disagree, invisible in a feed. The
feed leans on that: timelines are sorted by ID, merging two sources is
merging two sorted lists, and a page boundary can be written as an ID.

**Stores.** Posts, likes and comments are each looked up by one key and never
joined in the hot path, which is the shape
[SQL vs. NoSQL](/systems-and-infrastructure/sql-vs-nosql) says a key-value
or wide-column store is built for, and at 180 TB they have to be split across
many machines anyway. Each table is split on the key its busiest query uses,
as [partitioning vs. sharding](/systems-and-infrastructure/partitioning-vs-sharding)
describes. `likes` is keyed by user, not by post, on purpose: the question
asked 580,000 times a second at peak is "which of these 20 posts has this
viewer liked?", answered from one shard, and a viral post's likes spread
across every shard. "Who liked this post?" would need a second table keyed
by post, which is out of scope.

The follow graph is 200 billion edges (1 billion users × 200 followees),
stored twice so both questions are one lookup. At about 30 bytes per row,
200 billion × 2 × 30 bytes = 12 TB.

`timeline:{user_id}` is not the source of truth for anything. Every entry in
it can be rebuilt from `author_posts` and `following`, which is what lets it
live in memory without backups, as the second deep dive argues. Keeping a
read-shaped copy of the data, maintained from the write side, is the pattern
[CQRS](/systems-and-infrastructure/cqrs) describes: the posts table is where
writes go, and each timeline is a read model built for exactly one query.

## API design

**Upload an image, then create a post.** The image goes straight from the
phone to object storage, never through the app servers:

```http
POST /media/uploads
Authorization: Bearer <session-token>
Content-Type: application/json

{ "content_type": "image/jpeg", "size_bytes": 2048000 }
```

The response is a `media_id` and a **presigned URL**: an object-storage
address with a signature attached, computed with the service's secret key,
that allows one kind of request: a `PUT` of this object key, with this
content type and exactly the `size_bytes` the client declared, until it
expires 15 minutes later. The phone sends the bytes there directly. Anyone
holding the URL can use it until then, but only to overwrite that one
object. Then:

```http
POST /posts
Authorization: Bearer <session-token>
Content-Type: application/json

{ "media_id": "m_8f2c", "caption": "First loaf that didn't collapse" }
```

This returns `201 Created` with the `post_id`. The post starts as
`processing` and goes `live` once the resized images exist, usually within a
couple of seconds. A retried `POST` could create the post twice; the client
sends an `Idempotency-Key` header and the server returns the first result
for a repeated key, the technique
[idempotency](/systems-and-infrastructure/idempotency) covers.

**Read the feed.**

```http
GET /feed?limit=20
GET /feed?limit=20&cursor=eyJzZXNzaW9uIjoiZjNhOSIsInBvcyI6MjB9
```

```json
{
  "posts": [
    {
      "post_id": "892411121162670085",
      "author": {
        "id": "41",
        "handle": "maya",
        "avatar_url": "https://cdn.example/a/41/150.jpg"
      },
      "image_url": "https://cdn.example/m/m_8f2c/1080.jpg",
      "caption": "First loaf that didn't collapse",
      "like_count": 128,
      "comment_count": 9,
      "liked_by_me": false
    }
  ],
  "next_cursor": "eyJzZXNzaW9uIjoiZjNhOSIsInBvcyI6MjB9"
}
```

The `cursor` is an opaque string the server hands back; the client passes it
unchanged to get the next page. This one is base64-encoded JSON,
`{"session":"f3a9","pos":20}`; what that means, and why it isn't a page
number, is part of the third deep dive.

**Like, comment, follow.**

```http
PUT    /posts/{post_id}/like          like (repeating it changes nothing)
DELETE /posts/{post_id}/like          unlike
POST   /posts/{post_id}/comments      { "text": "..." }
GET    /posts/{post_id}/comments?cursor=...
PUT    /users/{user_id}/follow
DELETE /users/{user_id}/follow
GET    /users/{user_id}/posts?cursor=...      profile
```

Like and follow use `PUT` and `DELETE` because they set a state: a double tap
or a retry leaves one like, not two.

## High-level architecture

![Architecture of the social feed. A mobile or web client sends API calls to the app servers, and uploads and loads images through object storage and its CDN, drawn as one node. The app servers read timelines from the timeline cache and write the author's own new post into it; write to, read from and read likes from the post store and the post cache in front of it, drawn as one node; read and write follows in the follow graph; and publish posts, likes and follows to an event queue. Workers consume the queue: they write resized images to object storage, mark posts live, append them to author_posts and write counts in the post store and post cache, page through followers in the follow graph, push and remove post IDs in the timeline cache, and publish each celebrity post back to the queue, from which the app servers receive it.](/diagrams/social-feed/architecture.svg)

The pieces:

- The **app servers** are identical and keep no state that can't be rebuilt
  (only caches, such as the celebrity lists below). They serve the whole
  API; the client goes elsewhere only for image bytes.
- **Object storage** holds every image, and the CDN in front of it (one
  node in the diagram) serves them, as 1.4 terabits a second requires. An
  image never changes once written, so the CDN can keep it for a long time;
  a deleted post's images are purged from it.
- The **post store** holds the users, posts, author_posts, likes, comments
  and counts tables. The **post cache** in front of it (the same node in the
  diagram) holds recent posts, user profiles and counts. The per-request
  "did I like these?" read skips the cache and goes to the viewer's one
  `likes` shard, 580,000 reads a second at peak spread across all of them.
- The **follow graph** holds the `followers` and `following` tables.
- The **event queue** is a [message queue](/systems-and-infrastructure/message-queues)
  carrying post, like and follow events. The **workers** consume it: for a
  new post they make the resized images, mark it live, append it to
  `author_posts` and fan it out, or, for a celebrity, publish it back to the
  queue for the app servers instead; for likes they add up counts; for a
  follow or unfollow they edit that user's timeline.
- The **timeline cache** holds every active user's timeline.

Publishing a post, `POST /posts` from @maya, who has 400 followers:

1. The app server writes the post row (status `processing`) and a "post
   created" event in the same atomic write, and a relay publishes the event
   to the queue: the
   [outbox pattern](/systems-and-infrastructure/outbox-pattern), so a crash
   between the two can't leave a post that is never fanned out.
2. The app server also inserts the post into @maya's own timeline right
   away, so she sees her own post on her next refresh (with a placeholder
   image until step 3 finishes) even though her followers may wait a few
   seconds.
3. A worker takes the event, reads the original from object storage, writes
   the three sizes, marks the post `live`, and appends its ID to
   `author_posts`, which puts it on @maya's profile.
4. The worker pages through @maya's followers 1,000 at a time and inserts
   the post ID into each follower's timeline. For 400 followers that is one
   page and a few milliseconds.

Reading the feed, `GET /feed`:

1. The app server reads the viewer's timeline: up to 500 post IDs, newest
   first.
2. It adds the recent posts of the large accounts the viewer follows, which
   were never fanned out (the first deep dive).
3. It picks the 20 posts for this page and looks up everything needed to
   show them: post, author, counts, whether the viewer liked it. Turning
   bare IDs into displayable posts this way is called **hydration** (the
   second deep dive). It returns the page with a cursor for the next one.

## Deep dive: fan-out on write, fan-out on read, and celebrities

There are two basic ways to build a feed, and the estimates already priced
both.

**Fan-out on write (push).** When a post is created, push its ID into every
follower's timeline. Reading a feed is then one lookup of a precomputed
list, a few kilobytes from memory. The cost moves to posting: one insert per
follower, 4.5 million a second at peak, much of it for followers who won't
look before the entry scrolls away. One post from the 50-million-follower
account is 50 million inserts; even a fleet sized for push's own 4.5 million
a second needs 50,000,000 ÷ 4,500,000 ≈ 11 seconds for it, and every
ordinary post queued behind it misses its 5-second target. Worse, celebrity
posts cluster: if that account posts five times during a live sports final,
that is 250 million inserts, about 56 seconds of the whole fleet, on top of
the ordinary peak the same event causes.

**Fan-out on read (pull).** Store nothing per reader. For each feed request,
fetch the recent post IDs of every followee from `author_posts`, merge them
by ID and take the newest 20. Posting is one write however many followers
there are. The cost lands on reads: 116 million lookups a second at peak,
and each request waits for the slowest of its 200, which makes a 200 ms p99
hard to hold. Caching the merged result per reader helps, but that cache is
a timeline again, just built lazily.

**The hybrid.** Push for ordinary accounts, pull for large ones. An account
with more than 100,000 followers is a **celebrity** account: a worker handles
its posts like anyone's, resizing the image and appending the ID to
`author_posts`, but instead of fanning out it publishes the post ID back to
the event queue for the app servers. At read time the app server
merges the reader's own timeline (every ordinary followee, already pushed)
with the recent posts of the celebrities they follow.

![The hybrid fan-out. Posts by @maya, who has 400 followers, and by @star, who has 50 million, both reach the workers as post events. For @maya's post the workers push its ID into 400 timelines in the timeline cache. For @star's post they only append the ID to author_posts in the post store (as they do for every post), and publish the new celebrity post ID back to the event queue, which delivers it to every app server, which keeps celebrity post lists in its own memory. When a reader opens the feed, GET /feed reaches an app server, which reads the reader's own timeline from the timeline cache and merges it with its in-memory lists for the celebrities the reader follows.](/diagrams/social-feed/fan-out.svg)

What it costs in this design's numbers:

- **Writes.** Only ordinary posts fan out: 19 billion inserts a day ÷ 86,400
  ≈ **220,000 a second**, 2.2 million at peak, half the push-everything
  figure, and no single post needs more than 100,000 inserts. That largest
  case takes 100,000 ÷ 2,200,000 ≈ 0.05 seconds of the fleet. Handed to one
  worker as a single job it would hold that worker for the whole time, the
  slow-job problem [worker pools](/systems-and-infrastructure/worker-pools)
  describes, so it is split into tasks of 1,000 followers that many workers
  share.
- **Reads.** One timeline read plus about 10 celebrity lists per request,
  5.8 million list reads a second at peak, which would hurt over the
  network. They stay local: the newest 100 IDs of all 10,000 celebrities is
  10,000 × 100 × 8 bytes = 8 MB, so every app server holds a copy in its own
  memory, loaded from `author_posts` at startup and then kept current by
  subscribing to the celebrity posts the workers publish (20,000 a day),
  about a second behind.
- **Which followees are celebrities.** The app server intersects the
  viewer's cached `following` list (200 IDs) with the in-memory set of
  celebrity IDs, so promoting an account changes one entry: earlier posts
  are already in timelines, later ones are pulled. Promotion happens at
  100,000 followers but demotion only below 80,000, so an account near the
  line doesn't flip back and forth. A demotion copies the account's recent
  posts into its followers' timelines (under 80,000 inserts per post), or
  they would drop out of feeds.

The merge is cheap because both sources are sorted by post ID: walk the
timeline and the celebrity lists from their newest ends, taking the larger ID
and skipping one already taken (a post from just before a promotion can be in
both), until 20 are chosen.

**The threshold** trades one side against the other. Lowering it to 10,000
would cap fan-outs at 10,000 inserts, but many more accounts have 10,000
followers than 100,000, so the pulled set, the lists per read and the
in-memory copy would grow several times over. Raising it to 1 million would
pull far fewer accounts but allow fan-outs of a million inserts,
1,000,000 ÷ 2,200,000 ≈ 0.45 seconds of the whole fleet each. 100,000 is a
starting point, tuned by measuring fan-out lag against feed latency.

**Choice:** the hybrid. Pure push fails on the largest accounts, and pure
pull puts two orders of magnitude more work on the path users wait for. The
cost is two code paths and a merge that has to be right, since a bug there
shows up as posts missing from feeds.

## Deep dive: timeline storage and hydration

Two questions: where the 8 TB of timelines live, and how a list of 20 post
IDs becomes a page of 20 posts fast enough.

**Option 1: an in-memory store.** Keep each timeline in Redis as a **sorted
set**: a collection of unique members kept in order by a number attached to
each, its **score**. Scores are 64-bit floating-point numbers, exact only up
to 2⁵³ (about 9 × 10¹⁵), and post IDs run near 9 × 10¹⁷, so scoring by post
ID would round neighboring IDs together. Instead every score is 0 and each
member is the post ID's 8 bytes, most significant first, then the author
ID's 8 bytes. Equal-score members are ordered byte by byte, which for
fixed-width members is exactly post-ID order, so "members below this post
ID" is an exact range query for a cursor.

Memory depends on one setting. Redis keeps a sorted set of up to 128 members
as one compact block (a listpack, about 20 bytes per entry here) and larger
ones as a skip list plus hash table, over 100 bytes per entry. This design
raises that limit (`zset-max-listpack-entries`) to 512, so a timeline is
about 500 × 20 bytes = 10 KB plus about 100 bytes of key overhead. The price:
an insert scans and shifts up to 10 KB and a range read scans it, a few
microseconds, instead of following pointers. A set that passes 512 converts
to the larger form and stays there even when trimmed, so every write adds at
most 12 members and trims the set back to its newest 500 as one atomic step
(a `MULTI` transaction, which Redis runs with nothing in between). Bulk
inserts (a rebuild, a new follow's copied posts, a demotion's copy) go in
chunks of 12, sent together so a 500-entry rebuild still costs one round
trip, and a timeline that takes pushes meanwhile never holds more than
500 + 12 = 512. For 1 billion users that is about
10.1 TB; planning 12 TB leaves about 20% for allocator slack, and a
**replica** of each shard (a live copy that takes over if the original
fails) doubles it to 24 TB. At 256 GB of usable memory per machine,
24,000 ÷ 256 ≈ 94, call it **96 machines**, each running eight Redis
processes of about 30 GB (smaller processes resync faster after a failure),
768 in all: 384 shards of a primary and a replica on different machines.
Each insert lands on both, so 2.2 million inserts a second at peak become
4.4 million writes, about 5,700 a second per process.

**Option 2: a wide-column store.** Keep timelines on disk in a store such as
Cassandra: one partition per user, rows sorted by post ID. It is durable and
cheaper per gigabyte: 8 TB with three copies is 24 TB of SSD rather than of
memory. The costs: reads take a few milliseconds instead of a fraction of
one, and trimming after each insert leaves **tombstones**, markers the store
writes for deleted rows and must skip on reads until compaction removes
them, so a constantly trimmed timeline slows down.

**Choice:** in memory. Timelines are derived data; a lost one is rebuilt by
pulling from its owner's 200 followees once, in tens of milliseconds, so the
store needs to be fast, not durable. Users map to shards by
[consistent hashing](/systems-and-infrastructure/consistent-hashing), so
adding shards moves only the users the new shards take over; a failed
machine moves nobody, since its replicas take over. Timelines of users
inactive for 30 days are evicted and rebuilt on their next visit.

**Unfollowing and deleted posts.** The author ID in each entry makes
unfollowing cheap: on the unfollow event, a worker scans the reader's 500
entries and removes the unfollowed account's. A new follow copies that
account's last few posts in. A deleted post is not removed from millions of
timelines at all; hydration skips it.

**Hydration.** Each of the 20 posts on a page needs its post row, its
author's name and avatar, its counts, and whether this viewer liked it.
Written naively, that is a loop over 20 posts making 4 lookups each:

```text
for each of 20 post IDs:
    get post         (post cache)
    get author       (post cache, user profile)
    get counts       (post cache, counts)
    check my like    (likes table)
```

That is 80 round trips per request, the pattern
[N+1 queries](/systems-and-infrastructure/n-plus-one-queries) describes. At
half a millisecond each done one after another, it is 40 ms of waiting, and
at 580,000 requests a second it is 46 million calls a second across the
caches.

Batched, it is four calls, all issued at once:

```text
posts   = cache.get_many(post keys for 20 post IDs)
authors = cache.get_many(profile keys for the distinct author IDs)
counts  = cache.get_many(count keys for 20 post IDs)
liked   = likes.get(viewer, 20 post IDs)     one shard, keyed by viewer
```

All four start together because each needs only the timeline entries; the
author IDs are already there, saving a round trip that would wait for the
posts to learn who wrote them. Each `get_many` asks each shard once, and the
answers arrive in a few milliseconds, leaving most of the 200 ms budget.

Hydration also filters out posts that are deleted, by a blocked author, or
still `processing`, except the viewer's own `processing` posts, shown with a
placeholder image. It hydrates about 25 to fill a page of 20 after
filtering.

The **post cache** makes this cheap: nearly every feed shows posts from the
last few days, and two days of posts is 200 million × 1 KB = 200 GB. How
much it saves depends on its hit rate, which
[caching](/systems-and-infrastructure/caching) covers.

## Deep dive: ranking and pagination

**Ordering.** Chronological order, newest first, is the simplest. It needs
nothing beyond post IDs, it is predictable (users know why they see what
they see), and paging through it is easy. Its weakness appears when someone
follows many active accounts: a close friend's post from three hours ago is
buried under forty posts from brands posted since.

A lightweight ranking step keeps recency but mixes in how much the viewer
cares about the author. As an example score:

```text
score = affinity × 0.5 ^ (age in hours ÷ 6)
```

**Affinity** runs from 0.1 (the viewer never interacts with this author) to
1.0 (they like or comment on this author's posts almost daily). A nightly
batch job computes it for each user's followees from the last 30 days of
likes and comments, and stores a small table per user. The second factor
halves a post's score every six hours. Worked through:

- A friend's post from 3 hours ago: 1.0 × 0.5^0.5 ≈ **0.71**.
- A brand's post from 10 minutes ago: 0.1 × 0.5^(1/36) ≈ 0.1 × 0.98 ≈
  **0.098**.
- The same friend's post from 2 days (48 hours) ago: 1.0 × 0.5^8 ≈
  **0.004**.

Affinity reorders recent posts but can't keep old ones on top. The ranking
scores the newest 500 or so candidates from the timeline and celebrity lists
and sorts them. Age comes from the post ID and the author from the timeline
entry, so the extra cost is one read of the affinity table and 500 small
calculations. What ranking does cost is predictability and, below, a
harder pagination problem. Anything more elaborate, such as a trained model
or posts from accounts the viewer doesn't follow, is a recommendation
system, a different design.

**Paging.** A page number, `?page=3`, means "skip the first 40 posts and
return the next 20". It breaks on a feed because the list moves: if 5 new
posts arrive while the reader is on page 2, everything shifts down by 5, and
page 3 starts with 5 posts they already saw. Posts can also be skipped when
something above is removed.

A **cursor** names a position rather than a count. In the chronological
fallback chosen below it is the last post's ID, as a string like `post_id`
(JSON parsers lose digits past 2⁵³): `{"before":"892411121162670085"}`
means "the 20 newest posts with a smaller ID". Posts arriving at the top
don't change which IDs are smaller, so nothing repeats or is skipped, and
the same cursor works on the celebrity lists.

A ranked feed isn't in ID order, so the first request ranks the candidates
once and stores the ordered list of about 500 IDs as a **feed session**,
500 × 8 bytes = 4 KB, for 30 minutes, under the viewer's ID so no one else's
cursor can reach it. The cursor carries the session ID and a position, as in
the API sample's `{"session":"f3a9","pos":20}`; a position is safe because
the stored list doesn't change. Even 50 million open sessions take
50,000,000 × 4 KB = 200 GB. Pull-to-refresh starts a new session.

**Choice:** ranked with cursors over a feed session, falling back to
chronological order, which needs nothing but the timeline, if ranking is
slow or down, so ranking never becomes a new way for the feed to fail.

## Deep dive: counting likes and comments

A like has two parts: the `likes` row, which answers `liked_by_me` and
spreads out because it is keyed by user, and the post's total, which every
like on a viral post wants to change: 1,400 times a second, more in the
first minutes.

**Option 1: one counter row, incremented in place.** `UPDATE post_counts SET
like_count = like_count + 1 WHERE post_id = ?`. Simple, but updates to one
row queue behind each other, each holding it until its write is committed
and replicated, a few milliseconds. That caps a row at a few hundred to
about a thousand updates a second, below a celebrity post's rate, and
[optimistic vs. pessimistic locking](/systems-and-infrastructure/optimistic-vs-pessimistic-locking)
explains why no locking strategy fixes a row thousands of writers want.

**Option 2: a sharded counter.** Spread the count over N rows, each like
incrementing a random one, the "spreading the counter across several rows"
relief that topic mentions. With N = 20, a post taking 5,000 likes a second
puts 250 on each row, and counts stay current. The costs: a read sums N rows,
and N must be chosen per post, since 20 rows for each of 100 million new
posts a day is wasted on the many that get a handful of likes.

**Option 3: queue and batch**, that topic's third relief: funnel a post's
updates through one worker. The app server inserts the `likes` row only if
absent and, only if it was created, a "liked" event row beside it: an outbox
(the pattern again) in the same partition of the viewer's `likes` shard, so
both go in one single-shard transaction and a crash can't lose the event.
That needs a store with single-shard transactions, and even there costs
more than a plain write (some stores bill transactional writes at about
double); where a conditional write needs extra coordination rounds between
replicas, it costs several times more. An unlike produces "-1" only if a row
was deleted. Events are partitioned by post ID, so one worker owns each
post; once a second it writes one increment, "+1,387", with the queue
position applied so far, so a batch redelivered after a crash is skipped. A
post taking 1,400 likes a second becomes one write a second; one liked
twice a day still costs two. If half of all likes land on posts taking 10 or
more a second, the 580,000 peak writes fall to at most 290,000 + 29,000 =
319,000, about 45% fewer. The costs: counts lag a second or two, and a
queue and worker pool to run, the trade
[batching and asynchronous writes](/systems-and-infrastructure/batching-and-asynchronous-writes)
describes.

**Choice:** queue and batch. The requirements already allow counts to lag,
which is what it spends, and it removes contention on every post without
deciding which are hot. Sharded counters fit where a count must be current,
such as limited stock; nobody can tell 1,203,488 likes from 1,203,491, and
the app shows "1.2M" anyway. The viewer's own like shows at once, since
`liked_by_me` comes from the `likes` row. The worker writes each total to
the post cache as well as the store, the write-through strategy
[cache invalidation](/systems-and-infrastructure/cache-invalidation)
compares with deleting the entry. An app server filling the cache on a miss
can race it and put back an older total, but the worker's next write, at
most a second later for an active post, overwrites it. Comments use the same
pipeline for `comment_count`; the comment rows themselves see at most a few
hundred writes a second even on a viral post, which one shard handles.

## Failure modes and bottlenecks

**Fan-out falls behind.** A burst of posts, such as midnight on New Year's
Eve, grows the queue and delays delivery, but posting still succeeds. The
signal is **fan-out lag**, from a post's creation to its last timeline
insert, and the response is more workers. An event that
fails repeatedly (a corrupted image, say) goes to a
[dead-letter queue](/systems-and-infrastructure/dead-letter-queue) instead of
blocking the posts behind it.

**A fan-out is delivered twice.** A worker that crashes after inserting into
half a follower page but before acknowledging the event will see it again.
A sorted set holds each member once, so adding the same post ID again leaves
one entry, and redelivery is harmless.

**Losing a timeline cache machine.** Each shard has a replica, which takes
over. If both copies of a shard are lost, its users, 1 in 384 or about 2.6
million, have no timeline. Each is rebuilt by a pull when that user next
opens the app. At peak, they make 580,000 ÷ 384 ≈ 1,500 feed requests a
second, and 1,500 rebuilds × 200 followees is about 300,000 extra
`author_posts` reads a second for the first minutes, spread
across the post store's shards (and its
[read replicas](/systems-and-infrastructure/read-replicas), since a rebuild
tolerates a second of replication lag). Limiting concurrent
rebuilds and serving an interim feed of celebrity lists keeps that surge
bounded.

**A celebrity's post is a hot key.** The moment @star posts, millions of
feeds hydrate the same post ID, and every one of them asks the same post
cache shard. When its cache entry is first filled, or expires, all of them
miss at once and hit the post store together, the stampede the
[thundering herd problem](/systems-and-infrastructure/thundering-herd-problem)
describes. Two protections: request coalescing (one fetch per key, the other
requests wait for it), and a small in-process cache on each app server for
the few hundred hottest posts, refreshed every second, so that shard sees one
read a second per app server instead of one per viewer.

**The post store or post cache is slow.** The feed still has its timelines,
but hydration can't complete. The app server returns what it could hydrate
within the time budget and drops the rest, rather than failing the page.
Posting fails with `503` until the store recovers.

**Media uploads.** Uploads bypass the app servers, so a flood of them costs
object-storage bandwidth, not API capacity. A post whose image never arrives
stays `processing` and is cleaned up.

**What to watch.** Metrics for feed latency at p99, fan-out lag, queue
depth, post cache hit rate, the rate of timeline rebuilds and like-count lag
say that something is wrong; a trace of one slow `GET /feed` says which of
the timeline read, the merge or a hydration shard was slow, the division of
labor [observability](/systems-and-infrastructure/observability) describes.

## Trade-offs

- **The hybrid over pure push or pure pull.** Writes stay bounded (no post
  needs more than 100,000 inserts) and reads stay a single timeline plus a
  few in-memory lists. The price is two paths to build and a threshold to
  tune.
- **Timelines in memory.** Sub-millisecond reads, for about 96 machines of
  memory, a Redis setting chosen to keep them compact, and the need to
  rebuild from the post store after losing both copies of a shard. It works
  only because a timeline is derived data.
- **Timelines of IDs, not posts.** About 20 bytes an entry, so timelines fit
  in memory and a deleted post is never removed from millions of places, at
  the price of a hydration step that batching keeps to a few milliseconds.
- **Eventual consistency.** Posts reach followers within seconds and counts
  lag a second or two, both allowed by the requirements.
- **Ranked over chronological.** A better first page for people who follow
  many accounts, at the cost of an unpredictable order and a stored session
  per cursor, with the chronological fallback bounding the risk.
- **Batched counters over sharded counters.** No per-post tuning, a hot post
  reduced to one write a second, and perhaps 45% fewer count writes overall,
  for counts a second or two behind.

What would change the design: if the typical user followed thousands of
accounts rather than hundreds, 500-entry timelines would cover only days,
and both the cap and the fan-out volume would need rethinking. If the feed
had to include posts from accounts the user doesn't follow, candidates would
come from a recommendation system rather than just the follow graph, and
ranking would become the largest part of the design instead of a step at the
end. And as [scaling reads vs. scaling writes](/systems-and-infrastructure/scaling-reads-vs-scaling-writes)
puts it, a bigger cache helps none of the write paths here: fan-out, likes
and comments grow with users, and each is scaled by splitting it across more
machines, as the deep dives do.
