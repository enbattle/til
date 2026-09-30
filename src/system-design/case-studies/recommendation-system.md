---
title: Design a Recommendation System (like YouTube's home page)
summary: How a video site picks 20 videos out of 50 million for each home-page visit in under 150 ms, and the retrieval, ranking, feature and logging pipeline behind each pick.
date: 2026-09-29
order: 15
---

Open a large video site and the home page is a grid of videos chosen for you:
the next episode of a series you started, a cooking channel you watched last
night, something new on a subject you have been browsing. The system that
makes those picks is a **recommendation system**.

Most of the difficulty is arithmetic. There are tens of millions of videos and
of people, the answer has to come back in a fraction of a second, and no step
can afford to look at every video for every person. The usual answer splits
the work in two: a cheap stage that narrows 50 million videos to a few hundred
plausible ones, and an expensive stage that scores those few hundred
carefully. Around them sit a store of up-to-date facts about users and videos,
a log of what was shown and what people did with it, and jobs that retrain the
models on that log.

Some machine-learning vocabulary first. A **model** is a function with many
adjustable numbers (its **weights**) that takes facts about a user and a video
and returns a prediction, such as the chance the user clicks. **Training** sets
the weights from past examples whose outcome, the **label**, is known. Each
input fact, such as "clicks this video got in the last hour", is a
**feature**, and running a trained model on new input is **inference**. Why
such a system needs watching in ways ordinary software doesn't (its quality
can drift with no deploy at all) is the subject of
[MLOps](/ai-and-ml/what-is-mlops).

This is one plausible design for a video site's "Recommended for you" grid,
not a description of how YouTube or anyone else builds theirs.

## At a glance

**Requirements.** What the system must do:

- Return 20 ordered videos for a signed-in user's home page within 150 ms at
  p99.
- 100 million daily active users loading the page 5 times a day; 50 million
  videos, with about 200,000 new ones a day.
- Lean toward what the session is watching within about a minute, and drop a
  hidden or taken-down video within a minute.
- Let a video uploaded today appear within an hour, and give a new user a
  reasonable first list.
- Some list 99.95% of the time, a personalized one 99.9%.

**Key numbers.** From the estimates, at a 3× peak:

- ≈ 18,000 requests/s at peak (500 million a day ÷ 86,400 ≈ 5,800, × 3).
- 9 million candidate scores/s (18,000 × 500), 24 ranking servers of 32 cores
  at 60%.
- A 32 GB ANN index (50 million × 128 floats × 4 bytes, plus graph links),
  on 15 replicas.
- 900,000 feature-store reads/s after a 90% cache hit rate on 9 million
  lookups.
- 8 TB a day of served records (500 million × 16 KB), the largest store.

**Key decisions.** The three that shape it:

- Candidates from ANN over embeddings, co-watch lists and trending together:
  each source covers another's gap, and losing one still leaves a list
  ([candidate generation](#deep-dive-candidate-generation)).
- Train the ranker on features logged at serving time: training matches
  serving by construction
  ([feature store](#deep-dive-the-feature-store-and-training-serving-skew)).
- One exploration slot in 20 for videos under 48 hours old: about 1,500 seen
  impressions and 75 clicks per new video
  ([cold start](#deep-dive-cold-start)).

**Likely follow-ups.** What an interviewer asks next:

- Why not exact nearest-neighbour search? It would need 9,600 cores at 60%,
  about 40 times ANN's, to recover about 15 missed candidates of 300
  ([candidate generation](#deep-dive-candidate-generation)).
- How do you stop a new user tower meeting an old index? One serving pointer
  names both, flipped by a conditional write, and each request pins its
  versions ([candidate generation](#deep-dive-candidate-generation)).
- How does a replayed event not double a count? Online writes overwrite a
  value guarded by its `as_of`, and repeated event IDs are dropped
  ([feature store](#deep-dive-the-feature-store-and-training-serving-skew)).
- What if the feature store is down? The service falls back to a regional
  popular list held in memory
  ([failure modes](#failure-modes-and-bottlenecks)).
- What does a new user see? Picked topics if any, otherwise trending, and a
  personal list by the second or third load
  ([cold start](#deep-dive-cold-start)).

How the pieces connect is in the
[high-level architecture](#high-level-architecture).

## Requirements

Functional requirements:

- **Home recommendations.** When a signed-in user opens the home page, return
  an ordered list of 20 videos.
- **React to the session.** After someone watches three cooking videos, their
  next page load should lean toward cooking, within about a minute.
- **Filters.** Never recommend a video the user marked "Not interested", one
  they finished recently (in their last 100 watches), or one that isn't
  eligible for them (removed, private, age-restricted); a takedown stops
  appearing within a minute. Eligibility comes from the existing video
  catalog, which this design reads but doesn't own.
- **Cold start.** A video uploaded today can appear within an hour, and a new
  user gets something reasonable on their first visit.
- **Reasons (optional).** Some tiles say why, as in "Because you watched Knife
  Skills 101".

Out of scope: search, the player, ads, uploading and moderation, signed-out
visitors, scrolling past the first 20, and the inside of the models (their
layers and training tricks), which is a machine-learning subject rather than a
systems one. Deleting a user's history on request touches every store below;
it is left out for length, not because it is optional.

Non-functional requirements:

- **Scale:** 100 million daily active users, each loading the home page 5
  times a day. 50 million videos in the recommendable pool, with about 200,000
  new ones a day and about as many aging out.
- **Latency:** 150 ms at the 99th percentile (p99, the time 99% of requests
  beat), from when a request reaches our servers to when the response leaves.
- **Availability:** some list 99.95% of the time (43,200 minutes a month ×
  0.05% ≈ 22 minutes of failure), a personalized list 99.9%. A list of popular
  videos is a far better failure than an empty home page.
- **Training:** the ranking model is retrained daily on the last 30 days.
- **Headroom:** every serving tier runs at no more than 60% of capacity at
  peak.

## Back-of-the-envelope estimates

A day is 86,400 seconds.
[Numbers every engineer should know](/engineering-practices/numbers-every-engineer-should-know)
suggests planning for ten times the average when nothing better is known. A
home page used by 100 million people across time zones has a smooth daily
curve, so this design assumes the busiest hour runs at **3 times the
average**. With 60% headroom, a tier sized for that peak saturates only at
3 ÷ 0.6 = 5 times the average.

**Requests.**

- 100,000,000 users × 5 loads = 500 million requests a day.
- Average: 500,000,000 ÷ 86,400 ≈ 5,790, about **5,800 a second**.
- Peak: 3 × 5,800 = 17,400, rounded up to **18,000 a second**.

**Ranking.** Each request ranks about 500 candidates to fill 20 slots.

- Peak: 18,000 × 500 = **9 million candidate scores a second**.
- Scoring the whole pool instead: 18,000 × 50,000,000 = 900 billion a second,
  100,000 times more. That ratio is why there are two stages.
- Assume the ranking model costs about 1 million multiply-adds per candidate
  and one CPU core, scoring in batches, sustains about 20 billion a second:
  20,000 candidates per core per second.
- Peak: 9,000,000 ÷ 20,000 = 450 cores busy; at 60%, 450 ÷ 0.6 = 750 cores,
  about **24 servers of 32 cores** (768).

**The retrieval index.** Each video has an embedding of 128 numbers (defined
in the first deep dive), each a 4-byte float.

- Vectors: 50,000,000 × 128 × 4 bytes = 25.6 GB; the index's graph links add
  about 130 bytes a video, 6.5 GB. **About 32 GB**, which fits in one
  machine's memory.
- Assume one replica answers 2,000 queries a second at the accuracy wanted:
  18,000 ÷ 2,000 = 9 replicas busy; at 60%, **15 replicas**.

**Feature reads.** Each request reads one user's features and those of its 500
candidates.

- Peak video-feature lookups: 18,000 × 500 = 9 million a second.
- Each ranking server caches the features of the 2 million most-recommended
  videos (about 1 KB each, 2 GB). Candidates skew toward popular videos;
  assume 90% hit.
- Misses: 10% × 9,000,000 = **900,000 lookups a second**. At an assumed
  100,000 reads a second per store node, 9 nodes busy; at 60%, **15 nodes**.
- Data: 50 million videos × 1 KB = 50 GB, plus 300 million users with any
  history × 2 KB = 600 GB. Three copies of 650 GB make 1.95 TB, about 130 GB
  per node.

**Logs.**

- **Served records**, one per request: the 20 videos shown, their positions,
  and the feature values the model saw for each. At 200 features × 4 bytes =
  800 bytes a video, about 16 KB a record: 500,000,000 × 16 KB = **8 TB a
  day**.
- **Client events** from the apps: an impression when a tile is actually on
  screen, clicks, watch progress, hides. Assume 12 of 20 tiles are seen:
  500 million × 12 = 6 billion impressions, plus 2 billion other events, 8
  billion a day at about 200 bytes, **1.6 TB a day**.
- Event rate: 8,000,000,000 ÷ 86,400 ≈ 92,600 a second, and 3 × 92,600 ≈
  **280,000 a second** at peak, sent in batches of about 20, so 14,000 upload
  requests a second.
- 30 days of both: (8 + 1.6) × 30 = 288 TB. Columnar file formats usually
  compress this kind of data several-fold; assuming 4×, **about 72 TB**.

**New videos.** The cold start deep dive reserves 1 of the 20 slots for videos
under 48 hours old, a pool of 2 × 200,000 = 400,000.

- Reserved slots: 500 million a day ÷ 400,000 = 1,250 per video per day, so
  2,500 over 48 hours, of which 60% (12 of 20) are seen: **1,500
  impressions**.
- At an assumed 5% click-through rate (the share of seen tiles clicked),
  **about 75 clicks** per new video.

What the estimates say: ranking compute and feature reads dominate serving
cost, the index fits in memory, and the logs are the largest store by far,
with served records five times the size of the client events.

## Data model

Serving needs point lookups by one key: a user's features by user ID, a
video's by video ID, a precomputed list by name. That is a **key-value
store**'s job: it keeps each value under one key and finds it only by that
key. The online feature store is one, spread across its 15 nodes by a hash of
the key, as
[partitioning vs. sharding](/systems-and-infrastructure/partitioning-vs-sharding)
describes.

```text
online feature store (key-value)
  user:<user_id>
    recent     last 100 (video_id, watched_at, fraction_watched)
    hidden     set of video_id marked "Not interested"
    features   ~50 values: watch time by category, languages, device ...
  video:<video_id>
    features   ~150 values: clicks_1h, impressions_1h, watch_fraction_7d,
               category, language, uploaded_at ...
  list:cowatch:<video_id>   top 50 video_ids watched by the same people
  list:trending:<region>    top 500 video_ids by recent growth in clicks
```

Features are stored in groups, one per job that computes them (the hourly
counts, the daily batch features), and each group carries an `as_of`: the
event time its values are complete up to. The second deep dive shows why
writes check it.

Everything serving and training share also lands, with its history, in the
**data lake**: files in object storage, partitioned by hour.

```text
served_records    request_id, user_id, served_at, model_version,
                  items: [(video_id, position, source, score, features[200])]
client_events     event_id, request_id, user_id, video_id, type,
                  client_time, received_at
feature_history   entity_id, feature_name, value, event_time, written_at
embeddings        per model version: 50 million video_id -> 128 floats
```

`request_id` ties the two logs together: every client event about a tile
carries the ID of the request that served it, so training can join the
features the model saw to the outcome that followed. IDs are strings: a
JavaScript client parses a JSON number as a double, which loses precision
above 2^53, and 64-bit IDs go past that.

## API design

```http
GET /v1/recommendations?surface=home&count=20
Authorization: Bearer <session-token>

200 OK
{
  "request_id": "r_5c1e9a0b77f2",
  "personalized": true,
  "items": [
    { "video_id": "v_1938475620193847", "position": 1,
      "reason": "Because you watched Knife Skills 101" },
    { "video_id": "v_4410276655019023", "position": 2 }
  ]
}
```

`personalized` is `false` when the service fell back to a generic list, so the
app can label the row "Popular". The call only reads, so a retry is harmless;
it gets a new `request_id`.

```http
POST /v1/events

{
  "events": [
    { "event_id": "e_9f2c41d8a3b0", "request_id": "r_5c1e9a0b77f2",
      "video_id": "v_1938475620193847", "type": "impression",
      "position": 1, "client_time": "2026-09-29T19:04:11Z" },
    { "event_id": "e_9f2c41d8a3b1", "request_id": "r_5c1e9a0b77f2",
      "video_id": "v_1938475620193847", "type": "click",
      "client_time": "2026-09-29T19:04:13Z" }
  ]
}

202 Accepted
```

`202 Accepted` means the batch is appended to the event log, not processed.
The app creates each `event_id` once, when the event happens, and resends the
same IDs after a timeout, so the stream jobs can drop repeats: the resend is
[idempotent](/systems-and-infrastructure/idempotency). An app that can't reach
the collector keeps unsent events for up to 24 hours, then discards them.

## High-level architecture

![Architecture of the recommendation system. A web or mobile app sends GET /recommendations to the recommendation service and POST /events to the event collector. The recommendation service reads user features and lists from the online feature store, sends a user embedding to the ANN index, sends 500 candidates to the ranking service, which reads video features from the online feature store, and writes served records to the event log, where the collector writes client events. Stream jobs read the log, write fresh features to the online feature store and archive to the data lake. Batch and training jobs read the lake, write batch features and lists to the online store, and publish models and embeddings to the model registry, which supplies the ranking model to the ranking service, an index build to the ANN index, and the user tower and serving pointer to the recommendation service.](/diagrams/recommendation-system/architecture.svg)

Serving:

- The **recommendation service** is stateless, so any instance can take any
  request. It runs each request end to end, calling everything else with a
  deadline. Each instance keeps in memory the IDs of ineligible videos
  (assume 1 million at about 20 bytes, 20 MB), loaded from the catalog at
  startup and kept current from the catalog's change stream, so the filter
  is a memory lookup.
- The **ANN index** answers "which videos' embeddings are nearest this one?"
  (the first deep dive). Each of its 15 replicas holds the whole index.
- The **online feature store** answers the point reads in the data model.
- The **ranking service** scores candidates with the ranking model. Its 2 GB
  [cache](/systems-and-infrastructure/caching) of popular videos' features
  lives for 5 minutes: click counts a few minutes stale do no harm, while the
  user's own features, which must reflect the last minute, are always read
  fresh. It also absorbs hot videos, whose reads would otherwise pile onto one
  store node.

The ranker predicts both the chance of a click and the expected watch time,
and the service ranks by a weighted mix: a model trained on clicks alone
learns to favor misleading thumbnails. The weights are tuned by A/B tests,
which show two versions to random groups of users and compare what they do.

Learning:

- The **event collector** validates each batch and appends it to the **event
  log**, a partitioned, replayable log of the kind
  [message queues](/systems-and-infrastructure/message-queues) describes,
  partitioned by user ID so one user's events stay in order. Served records go
  there too.
- **Stream jobs** read the log: one drops repeated event IDs, writes each
  user's recent history and hidden set, and re-keys events by video ID (an
  internal shuffle) so exactly one task owns each video's hourly counts and
  their write to the online store; another archives every record to the lake. A "Not interested" tap
  reaches the hidden set within about a minute; until then the app hides the
  tile itself.
- **Batch and training jobs** run over the lake: co-watch and trending lists,
  slow-moving features, the daily ranking model, embeddings and the index
  build. They publish to the **model registry**, a store of model files plus a
  pointer naming which versions serve.

### The latency budget

The 150 ms is split across stages up front, so each part has its own number:

![Sequence of one home-page request. The recommendation service reads user features and the last 100 watches from the feature store in 10 ms and runs the user tower in 5 ms. In parallel for 25 ms, it gets the nearest 300 from the ANN index in 15 ms and co-watch and trending lists from the feature store in 10 ms, about 250 IDs. It merges and filters in 5 ms and sends about 500 candidates to the ranking service, which fetches features for cache misses in 15 ms and returns scores after 45 ms in all. The service diversifies in 10 ms and logs the served record without waiting.](/diagrams/recommendation-system/serve-sequence.svg)

| Stage                                | p99 budget |
| ------------------------------------ | ---------- |
| User features and recent history     | 10 ms      |
| User tower (the query's embedding)   | 5 ms       |
| Candidates, sources in parallel      | 25 ms      |
| Merge, remove duplicates, filter     | 5 ms       |
| Ranking (feature misses 15, scoring) | 45 ms      |
| Diversify, new-video slot, assemble  | 10 ms      |
| Network and serialization            | 10 ms      |
| **Total, leaving 40 ms spare**       | **110 ms** |

Summing stage p99s overstates the true p99, since a request rarely hits every
stage's slow tail, so the slack is bigger than it looks. Scoring fits because
the ranking service splits the 500 candidates into 4 batches of 125 on 4
cores: 125 ÷ 20,000 a second ≈ 6 ms each, leaving the rest of 30 ms for
queueing at peak. Smaller batches finish sooner but use cores less
efficiently, the tension
[latency vs. throughput](/systems-and-infrastructure/latency-vs-throughput)
covers.

The served record is buffered in memory and flushed to the log every second,
after the response, so logging never adds to the wait. That makes the served
log best-effort: a crashed instance loses up to a second of records. Training
drops client events whose `request_id` has no served record, and alerts if
more than 1% are dropped, which would mean a logging fault rather than routine
crashes.

## Deep dive: candidate generation

Candidate generation turns 50 million videos into about 500 in 25 ms. Scoring
them all with the ranker would take 900 billion ÷ 20,000 = 45 million cores,
so the question is which cheap method finds likely videos.

**Option 1: co-watch lists.** A daily batch job counts, for each video, which
other videos the same people watched, and keeps the top 50. At request time,
one multi-key read of the lists for the user's last 10 watches returns up to
500 IDs in a few milliseconds, each with a ready-made reason. The lists take
50,000,000 × 50 × 8 bytes = 20 GB. But a user with no history gets nothing, a
video uploaded today is in no list until tomorrow, and the result reflects
only the last few watches, not the user's taste as a whole.

**Option 2: embeddings and nearest-neighbour search.** An **embedding** is a
list of numbers, here 128, placing a user or a video in a shared space where
closeness means relevance. A common way to learn them is a **two-tower
model**: one small network (the user tower) turns a user's features and recent
watches into an embedding, another (the video tower) does the same from a
video's features, and training pulls the two together whenever the user
watched the video. Relevance is their **dot product**, the sum of the 128
pairwise products, and retrieval becomes a [vector search](/ai-and-ml/vector-search)
for the 300 videos with the highest one. How to search:

- **Exact search** compares against all 50 million: 6.4 billion
  multiply-adds, 0.32 core-seconds per query. At 18,000 queries a second that
  is 5,760 cores busy, 9,600 at 60%.
- **Approximate nearest neighbour (ANN)** search on a graph index visits a few
  thousand vectors per query. The 15 replicas from the estimates, at perhaps
  16 cores each, are about 240 cores, some 40 times fewer. The cost is
  **recall**, the share of the true top 300 returned; tuned to about 95%, it
  misses about 15, which a ranker downstream barely notices.
- **Compressed vectors** (product quantization, storing each vector as a few
  bytes of codes that approximate it) would shrink 32 GB to a few GB at more
  recall lost. Memory isn't the constraint here, so the index keeps full
  floats.

Embeddings carry their own costs. The user embedding is computed at request
time, 5 ms of inference on the history just read, because one precomputed
nightly couldn't react to the last minute's watches. And embeddings are only
comparable within one trained model: a retrain changes all 50 million video
embeddings, so the whole index is rebuilt, and a request must never pair a new
user tower with an old index.

**The choice:** both, plus a regional trending list. ANN supplies 300
candidates and covers taste as a whole, co-watch up to 200 with reasons,
trending about 50; after duplicates and filters about 500 remain. Each source
covers another's gap, and losing one still leaves a list.

**Keeping versions paired.** A build job turns each day's embeddings into a
new index (a few hours on one large machine), and each replica loads it beside
the old one, so a replica needs room for two 32 GB indexes. When every replica
reports it loaded, the job flips the registry's serving pointer: one record
holding a pointer version and what it names (user-tower version, index build
ID, ranker version), changed by a conditional write, "only if the version is
still N"; the daily ranker job flips only its own field the same way. A slow
or restarted job still holding N can't overwrite a newer flip. Service
instances reread the pointer every few seconds, and each request pins the
versions it started with. A job that crashes between writing files and flipping leaves
orphaned files, which a cleanup job deletes after a week.

**Today's uploads.** The video tower needs only a video's own features (title,
category, language, channel), so an upload job embeds each new video within
minutes into a small separate index of the last 48 hours, 400,000 vectors,
searched alongside the main one. It is versioned with the pair: before a flip,
the build job embeds those 400,000 with the new tower (minutes), and until the
flip, new uploads go into both the old and new small index.

## Deep dive: the feature store and training-serving skew

A model learns what its features meant during training. If "clicks in the
last hour" is computed one way for training and another way in production,
the model misreads it and nothing errors; recommendations just get quietly
worse. That is **training-serving skew**. Its cousin is **leakage**: a training
example must use feature values as they were when the tile was shown. Today's
"total clicks" for a video includes the very click the model is learning to
predict, so a model trained on it looks excellent offline and disappoints in
production.

**Option 1: two implementations.** Training computes features in batch SQL
over the lake; serving computes them in service code. It is the fastest start,
and it is how skew usually arrives. Say the streaming "clicks in the last
hour" ignores events more than 5 minutes late while the batch query counts
them all. If 3% of mobile events arrive late, the served value runs about 3%
below the trained one for every video, and predictions shift because of a
feature nobody changed.

**Option 2: one definition, two materializations.** Each feature is written
once (source events, window, aggregation), and a platform generates both the
streaming job that updates the online store and the batch job that fills
`feature_history`. Training uses a **point-in-time join**: for an impression at
time T, take each feature's latest value whose `event_time` plus the
feature's normal materialization delay is at or before T, what the model
could have seen (for live-written rows this matches `written_at` ≤ T;
backfilled rows, written today, use the modeled delay). That removes leakage
and most skew, and allows backfills: a new feature can be computed over the
past 30 days and trained on the same day. The costs are the platform, a sizable build, and some
remaining skew, because streaming and batch engines still disagree at the
edges (late events, window boundaries).

**Option 3: log features at serving time.** The served record already holds
the 200 values the model saw. Training on them matches serving by
construction. The costs are 8 TB a day, five times the client events, and
patience: a new feature has no logged history, so it needs weeks of logging
before a 30-day window is full.

**The choice:** 2 and 3 together. The production ranker, which serves every
request, trains on logged features, and 72 TB of compressed logs is a modest
object-storage bill next to a quietly degraded ranker. Feature definitions
still produce the online values, the lists and `feature_history`, so
experiments train on backfills and a new idea can be tested in days; once a
feature ships, the log starts collecting it. A daily job compares logged
values with point-in-time values on a 1% sample and alerts when a feature's
distributions drift apart, which is how the late-event case above gets caught.

**Writing the online store safely.** Stream jobs read the log from committed
offsets (their position in each partition) and, after a restart, replay from
the last commit, so any event can be processed twice. Two rules make that
harmless. Repeated `event_id`s are dropped within a 48-hour window kept in the
job's checkpointed state, wider than the app's 24-hour resend limit: 16
billion IDs × about 20 bytes ≈ 320 GB, spread across the job's tasks. And every
online write overwrites a computed value, never increments one: "clicks_1h for
video V is 812 as of 19:05", a conditional write that succeeds only if the
group's stored `as_of` is older (batch jobs write their groups the same way,
with the day they cover). A replay rewrites the same value. A stale instance
still running after its partition moved elsewhere (a long pause, then it
wakes) writes an older `as_of` and is refused: the fencing idea from
[distributed locks](/systems-and-infrastructure/distributed-locks), with event
time as the token. The archive job names each lake file by partition and
offset range, so a replay overwrites the file rather than adding a copy.
Offsets are committed after both writes; a crash between them means both are
redone, and both are safe to redo.

What can still go wrong: an event the app never sent (killed first) is lost,
and a resend more than 48 hours after the original, which only a device with a
badly wrong clock would produce, counts twice. Both bend training data by a
fraction of a percent, which this design accepts.

## Deep dive: cold start

A system that learns from watching has nothing to go on for a video nobody has
seen or a user who hasn't watched anything. That is **cold start**.

**New videos.** Three options:

- **Popularity only.** Rank new videos like any other. It costs nothing and
  starves them: the ranker's strongest features are past clicks and watch
  time, which a new video lacks, so it scores low, isn't shown, and never earns
  the clicks that would raise it.
- **Content features.** The video tower embeds a new video from its title,
  category and channel, so ANN can surface it within minutes. It is cheap, but
  content predicts appeal weakly: two cooking videos with similar titles can
  differ tenfold in how often they are watched.
- **An exploration slot.** Reserve some slots for new videos regardless of
  score and let the clicks teach the ranker. **Exploration** means showing
  something the model is unsure about to learn from the outcome, instead of
  always showing its best guess (**exploitation**). The price is paid in
  slots: what fills them is, on average, less engaging than the ranker's pick.

**The choice for videos:** content features plus 1 exploration slot in 20. The
estimates showed what that buys: about 1,500 seen impressions and 75 clicks per
new video in its first 48 hours, enough for its own click and watch features to
take over. The slot takes the best-scoring candidate from the small new-video
index, with a little randomness, so a cooking fan gets a new cooking video.
Each served record notes the slot and position, so training can separate a
click earned in the exploration slot from one earned on merit at position 3,
since position alone changes how often people click. A small group with no
exploration slot, compared in an A/B test, shows what the 5% costs; one slot
in 40 would halve the cost and double the time to learn.

**New users.** No history means no input for the user tower and no co-watch
lists. The regional trending list is always available but the same for
everyone; an onboarding question ("pick a few topics") gives the user tower
something from the first request, at the cost of a screen many people skip;
and the stream jobs put each watch into the user's history within a minute.
These cost little together, so the design uses all three in sequence: topics
if picked, else trending, with `personalized: false`, and by the second or
third page load the session has made the list personal.

## Failure modes and bottlenecks

**A candidate source is slow or down.** Each call has a deadline inside its
budget (15 ms for ANN, 10 ms for lists); a source that misses it is skipped
for that request. If it keeps failing, a
[circuit breaker](/systems-and-infrastructure/circuit-breaker) stops calling
it for a few seconds so a struggling index isn't buried under requests.
Without ANN, co-watch and trending still give a weaker but personal list.

**The ranker is down or over budget.** The service returns the candidates in a
simple order (ANN score, then list position). Worse ordering, same videos.

**The feature store is partly down.** Missing video features become the
default values the model saw in training, so those candidates score blandly.
Without the user's own features there is no embedding and no history, and the
service falls back to the regional popular list each instance keeps in memory,
refreshed every 10 minutes, with `personalized: false`. The 99.95% target
rests on that list.

**A bad model ships.** A new model must pass offline checks (accuracy on
recent data held out of training), then serves 1% of traffic for a few hours
while its clicks and watch time are compared with the current model's.
Rolling back is a new pointer version naming the previous versions, which
replicas and ranking servers keep loaded until the next build.

**The event pipeline falls behind.** Stale recent history stops the session
steering results, though serving is otherwise fine. The daily training job
waits for the archive's completeness marker for the day, and if that is hours
late, skips the retrain and the current model keeps serving.

## Trade-offs

- **Two stages over one.** Scoring 500 candidates instead of 50 million makes
  ranking affordable, 24 servers rather than millions of cores, but a video
  retrieval misses can never be recommended; the ranker only reorders.
- **ANN over exact search:** about 40 times less retrieval compute, paid for
  with roughly 5% of true neighbours missed and a nightly rebuild whose
  versions have to stay paired.
- **Logged features for training.** Consistency by construction, for 8 TB a
  day and a wait of weeks before a new feature trains without a backfill.
- **A best-effort served log.** No response waits on logging; a crash loses a
  second of records, which the join drops and counts.
- **Exploration** spends one slot in twenty on videos the model is unsure of,
  which is what lets 200,000 uploads a day compete. It is a dial.
- **Fresh by stream, the rest by batch.** The session steers results within a
  minute while lists and the main index are a day old; streaming everything
  would make every part harder to run.

What would change the design: at ten times the catalog, the index (320 GB)
no longer fits one machine and is split by video across shards, each query
fanning out to all of them. A much larger ranking model would move ranking to
GPUs, cheaper per candidate on large batches but sharper on the batch-size
versus latency tension. The [social feed](/system-design/social-feed) ranks a
far smaller candidate set, posts from followed accounts, and shows how much
simpler ranking is when the candidates are already known.
