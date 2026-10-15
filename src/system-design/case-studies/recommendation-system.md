---
title: Design a Recommendation System (like YouTube's home page)
summary: A two-stage funnel that narrows 50 million videos to 20 for each home-page load in 150 ms, trained on the features it served.
date: 2026-10-05
order: 15
template: 3
---

You're asked to design the home page of a video site, like YouTube's. When Maya opens it, she sees 20 videos picked for her out of 50 million, and the page has 150 ms to arrive. How do you pick well, for 100 million people a day?

The answer is a funnel: a cheap step narrows 50 million videos to about 500, and a slower, smarter step orders those. This page starts with the obvious design, scoring everything, and shows where it breaks. Then it follows Maya's page load through the funnel, sizes its parts, and makes three decisions: how the cheap step finds candidates, what the scoring step trains on, and how brand-new videos get seen.

## Requirements

- Return 20 ordered videos for a signed-in user's home page within 150 ms at p99 (99% of requests are faster).
- 100 million daily users load it 5 times a day; 50 million videos, 200,000 new ones a day.
- After Maya watches three cooking videos, her next load leans toward cooking within a minute. A hidden or taken-down video disappears within a minute.
- A video uploaded today can appear within an hour; a new user gets a reasonable first list.
- Some list is served 99.95% of the time, a personalized one 99.9%. The system learns from the last 30 days of activity and retrains daily.

Out of scope: search, ads, the player and moderation.

## Start simple

The obvious design scores every video for every request. A **ranking model** is a program that predicts how likely Maya is to click a video. It works from **features**, facts about her and the video such as "clicks this video got in the last hour". Score all the videos, sort by score and return the top 20.

For a small site that's fine. Say it has 20,000 videos and 1,000 daily users loading the page 5 times each, peak traffic is 3 times the average because time zones spread users, and one core scores 20,000 videos a second (an assumption):

```text
loads a day:
  1,000 users × 5 = 5,000
average:
  5,000 ÷ 86,400 s ≈ 0.058 a second
peak:
  0.058 × 3 ≈ 0.17 a second
scores at peak:
  0.17 × 20,000 videos
  = 3,400 a second
```

That is a fraction of one core. Now run the same steps on this site's numbers:

```text
loads a day:
  100,000,000 users × 5
  = 500,000,000
average:
  500,000,000 ÷ 86,400 s ≈ 5,800 a second
peak:
  5,800 × 3 = 17,400,
  rounded up to 18,000 a second
scores at peak:
  18,000 × 50,000,000 videos
  = 900,000,000,000 a second
cores:
  900,000,000,000 ÷ 20,000
  = 45,000,000
```

That is 45 million cores to score everything. So score only a shortlist of about 500, which is 100,000 times fewer, and let a cheaper step choose it.

What can a cheap step look at? Give every video a list of 128 numbers, built so that videos watched by the same people get similar numbers. That list is an **embedding**: a position in a space where related videos sit close together ([vector search](/ai-and-ml/vector-search) covers how they are made). Maya gets one too, built from her last 100 watches, so she sits near videos she would like. Her **nearest neighbors** are the videos whose lists are closest to hers, and the 300 nearest are the start of the shortlist.

Finding them among 50 million videos, fast, is the problem the architecture is built around.

## High-level architecture

![Architecture of the recommendation system. A web or mobile app sends GET /recommendations to the recommendation service and POST /events to the event log. The recommendation service reads user features and lists from the online feature store, sends a user embedding to the neighbor index and 500 candidates to the ranking service, which reads video features from the feature store. The recommendation service also writes served records to the event log. Stream jobs and a batch job read the event log. Stream jobs write fresh features to the feature store. The batch job writes batch features and lists to the feature store, and sends a ranking model to the ranking service, an index build to the neighbor index, and the user model and versions to the recommendation service. An upload job sends new-video embeddings to the neighbor index. The catalog sends ineligible IDs to the recommendation service.](/diagrams/recommendation-system/architecture.svg)

Follow Maya's load. The **recommendation service** builds her page. It reads her last 100 watches from the **online feature store**, where features are kept for fast lookup, and turns them into her embedding.

It sends the embedding to the **neighbor index**, a store built to answer "which videos are closest to this one?", and gets back the 300 nearest. The feature store adds candidates the embedding can miss, as precomputed lists: for each recent watch, the 50 videos most often watched by the same people, and the 500 fastest-growing videos in her region. The service merges the three sources, removes duplicates, drops hidden, recently watched and taken-down videos (the catalog sends it their IDs, which it keeps in memory), and keeps 500, nearest neighbors first, then co-watch, then trending. The **ranking service** scores them and the top 20 go back.

Every load is recorded in the **event log**, a replayable [message queue](/systems-and-infrastructure/message-queues) that keeps 30 days of what the service showed and what people clicked. **Stream jobs**, which process each event as it arrives, update Maya's watches and hidden set within a minute.

A daily **batch job**, which reprocesses the stored 30 days at once, retrains the models and sends them, with a rebuilt index, to the parts that use them. New videos take a faster path: when one is uploaded, a job embeds it within minutes and adds it to the neighbor index, which is how a new video can appear within the hour. That is every part. How big must each be?

## Key numbers

These size the recommendation service, the ranking servers, the neighbor index, the feature store and the logs. Peak is 3 times average, and each tier runs at no more than 60% of its capacity, to leave headroom. Figures are rounded sensibly.

- **Recommendation service:** about 18,000 requests a second at peak, as worked out in "Start simple".
- **Ranking servers:** 24 servers of 32 cores. 500 candidates × 18,000 requests = 9,000,000 scores a second; at an assumed 20,000 per core, 9,000,000 ÷ 20,000 = 450 cores busy; 450 ÷ 0.6 = 750 cores at 60%; 750 ÷ 32 ≈ 23.4, so 24 servers.
- **Neighbor index:** 32 GB per replica, 15 [replicas](/systems-and-infrastructure/read-replicas), copies that each answer queries. 50,000,000 videos × 128 numbers × 4 bytes = 25.6 GB, plus an assumed 6.5 GB for the index's own structure, about 32 GB. At an assumed 2,000 queries a second each, 18,000 ÷ 2,000 = 9 replicas are busy, and 9 ÷ 0.6 = 15 at 60%.
- **Feature store:** about 900,000 reads a second. The ranking servers look up 500 × 18,000 = 9,000,000 videos a second; if they cache popular videos and hit 90%, 10% reach the store: 9,000,000 × 0.1 = 900,000.
- **Event log:** 8 TB a day, the largest store. Each request records 20 videos × 200 features × 4 bytes = 16,000 bytes = 16 KB, and 16 KB × 500,000,000 requests = 8 TB.

The index is the step that must not search everything, and the log is the largest store to keep; the first two decisions are about them.

## API and data model

```http
GET /v1/recommendations?surface=home&count=20
-> 200 { "request_id": "r_5c1e", "personalized": true,
         "items": [ { "video_id": "v_1938", "position": 1,
                      "reason": "Because you watched Knife Skills 101" } ] }

POST /v1/events
{ "events": [ { "event_id": "e_9f2c", "request_id": "r_5c1e",
                "video_id": "v_1938", "type": "click" } ] }
-> 202 Accepted
```

```text
online feature store (key-value)
  user:<user_id>            recent (last 100 watches), hidden, ~50 features
  video:<video_id>          ~150 features: clicks_1h, watch_fraction_7d ...
  list:cowatch:<video_id>   top 50 videos watched by the same people
  list:trending:<region>    top 500 videos by recent growth in clicks
event log (kept 30 days)
  served_records   request_id, user_id, items: [(video_id, features[200])]
  client_events    event_id, request_id, user_id, video_id, type
```

Reads are lookups by one key, so a [key-value store](/systems-and-infrastructure/sql-vs-nosql) fits. The choice that matters is `request_id`: each event names the request that showed the tile, which is how training joins features to outcomes.

That's the shape. Now the step that can't afford to search everything: finding Maya's neighbors.

## Decision: approximate nearest-neighbor retrieval

The simpler way to find Maya's 300 nearest videos is exact search: compare her embedding with all 50 million. That is right for a smaller catalog. Here each comparison is 128 multiply-and-add steps, and at an assumed 20 billion steps a second per core:

```text
steps a query:
  50,000,000 × 128 = 6.4 billion
cores busy at peak:
  18,000 × 6.4 billion ÷ 20 billion
  = 5,760
cores at 60%:
  5,760 ÷ 0.6 = 9,600
```

So the choice is **approximate nearest-neighbor (ANN)** search. The index is built ahead of time, so a query visits a few thousand lists instead of 50 million. The 15 replicas, at an assumed 16 cores each, are 15 × 16 = 240 cores: 9,600 ÷ 240 = 40 times fewer. Maya's embedding is still computed on every request from her latest watches, so tonight's cooking videos move her.

The cost is **recall**, the share of the true top 300 returned. At 95%, 300 × 5% = 15 are missed, and the ranker still gets about 500 candidates. The index is also rebuilt with each new model rather than updated per video.

**Rule of thumb.** When exact search costs too much and the next stage tolerates a few misses, trade a little recall for a large cut in compute.

## Decision: train on the features that were served

The simpler way to train is to recompute each feature from the stored history, as it stood at each impression. It stores far less than logging, and a new feature can be backfilled. It breaks on a silent mismatch: serving uses streaming code that drops events over 5 minutes late, while training recomputes with batch code that counts them. Say 3% of clicks arrive that late (assumed):

```text
clicks_1h as served:
  812
as recomputed for training:
  812 ÷ 0.97 ≈ 837
```

The model trains on 837 and sees 812 in production, across 200 features and 20 videos on every request, and nothing errors. That mismatch is **training-serving skew**.

So the **served record** stores the 200 values the model saw for each video, and training reads them back, joined by `request_id` to what happened next. The price is 8 TB a day: 8 TB × 30 days = 240 TB over the window, and 240 ÷ 4 = 60 TB at an assumed 4× compression. A new feature also needs weeks of logging before it has training data.

**Rule of thumb.** If a model must train on what it saw in serving, log the serving-time inputs instead of recomputing them: pay storage to remove a silent bug.

## Decision: reserve one slot in 20 for new videos

A video uploaded ten minutes ago has no clicks, so the ranker scores it low and it never gets any. The simpler fix is a score boost for new videos. Its cost is unknown, because the number of slots it takes depends on the competition: a boost that fills 1 of 20 slots on a typical page might fill 4 when the day's ranked videos are weak (assumed), which is 5% of the page one day and 20% the next.

So reserve a slot, which costs a known 5%. An upload job embeds each new video within minutes, from its title, category and channel, into a small index of the last 48 hours: 2 × 200,000 = 400,000 videos. It is searched alongside the main one, and one of the 20 slots goes to the best new candidate. If the slot lands at a random position and 12 of the 20 tiles are on screen (an assumption), 60% are seen:

```text
slots per new video a day:
  500,000,000 requests ÷ 400,000 = 1,250
in 48 hours:
  1,250 × 2 = 2,500
seen:
  2,500 × 12 ÷ 20 = 1,500
clicks at an assumed 5%:
  1,500 × 0.05 = 75
```

About 75 clicks gives the ranker something to learn from.

**Rule of thumb.** If a system learns only from what it shows, budget exploration as a fixed share of slots, so the cost is known.

## Likely follow-ups

- **What does a new user see?** Topics picked at sign-up, else the regional trending list, until her own watches take over.
- **How do you stop a new user model meeting an old index?** Embeddings only compare within one trained model. A **serving pointer**, a record naming the user-model, index and ranker versions, flips by a conditional write ([optimistic locking](/systems-and-infrastructure/optimistic-vs-pessimistic-locking)) once every replica has loaded the index, and each request keeps the versions it began with.
- **What if the feature store is down?** Serve a regional popular list from memory with `personalized: false`, the "some list" requirement. A [circuit breaker](/systems-and-infrastructure/circuit-breaker) stops calls to it.
- **How does a replayed event not double a count?** Stream jobs drop repeated `event_id`s and write computed values ("clicks_1h is 812 as of 19:05"), not increments ([idempotency](/systems-and-infrastructure/idempotency)).
