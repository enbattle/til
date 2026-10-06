---
title: Design a Recommendation System (like YouTube's home page)
summary: A two-stage funnel that narrows 50 million videos to 20 for each home-page load in 150 ms, trained on the exact features it served.
date: 2026-10-05
order: 15
---

You're asked to design the home page of a video site. When Maya opens it, she
sees 20 videos picked for her out of 50 million. You can't run a careful model
over all of them for thousands of requests a second, so the design is a funnel:
a cheap stage narrows the pool to about 500, and a **ranking model** (it
predicts the chance of a click from **features**, facts like "clicks this
video got in the last hour") orders them.

## Requirements

- Return 20 ordered videos for a signed-in user's home page within 150 ms at
  p99 (99% of requests are faster).
- 100 million daily users load it 5 times a day; 50 million videos, 200,000
  new ones a day.
- After Maya watches three cooking videos, her next load leans toward cooking
  within a minute. A hidden or taken-down video disappears within a minute.
- A video uploaded today can appear within an hour; a new user gets a
  reasonable first list.
- Some list is served 99.95% of the time, a personalized one 99.9%. The
  model retrains daily on the last 30 days.

Out of scope: search, ads, the player and moderation.

## Key numbers

These size the ranking servers, retrieval index, feature store and logs. Peak
is 3 times average, as time zones spread users; tiers run at no more than 60% of capacity:

- **Requests:** about 18,000 a second at peak. 500 million a day ÷ 86,400 ≈ 5,800 a second, × 3 ≈ 17,400, rounded up.
- **Ranking servers:** 24 servers of 32 cores. 500 candidates a request is 9 million
  scores a second; at an assumed 20,000 per core, 450 cores busy, 750 at 60%.
- **Retrieval index:** 32 GB per replica, 15 replicas. 50 million × 128
  floats × 4 bytes = 25.6 GB, plus assumed links of 6.5 GB. At an assumed
  2,000 queries a second each, 9 replicas are busy, 15 at 60%.
- **Feature store:** 900,000 reads a second: 9 million lookups, if ranking
  servers cache popular videos and hit 90%.
- **Logs:** 8 TB a day, the largest store: 20 videos × 200 features × 4 bytes
  = 16 KB a request, × 500 million.

## High-level architecture

![Architecture of the recommendation system. A web or mobile app sends GET /recommendations to the recommendation service and POST /events to the event collector. The recommendation service sends user features and lists to the online feature store plus candidate lists, a user embedding to the ANN index, and 500 candidates to the ranking service, which reads video features from the feature store. The recommendation service writes served records to the event log, where the event collector writes client events. Stream jobs read the log, write fresh features to the feature store and archive to the data lake. Batch and training jobs read the lake, write batch features and lists to the feature store, and send models and embeddings to the model registry. The registry sends the ranking model to the ranking service, an index build to the ANN index, and the user tower and serving pointer to the recommendation service. An upload job sends new-video embeddings to the ANN index, and the catalog sends ineligible IDs to the recommendation service.](/diagrams/recommendation-system/architecture.svg)

Follow Maya's load. The **recommendation service** reads her last 100 watches
from the **online feature store** (which also holds candidate lists), turns
them into a user embedding and asks the **ANN index** for the 300 nearest
videos. Lists add more. After dropping hidden, recently watched and ineligible
videos (the service keeps ineligible IDs in memory, fed by the catalog), about
500 remain. The **ranking service** scores them and the top 20 go back.

Her clicks go to the **event collector**, which appends them to the **event
log**, a replayable [message queue](/systems-and-infrastructure/message-queues).
**Stream jobs** update her watches and hidden set within a minute and archive
to the **data lake**. **Batch and training jobs** read the lake and publish
models to the **model registry**.

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
data lake
  served_records   request_id, user_id, items: [(video_id, features[200])]
  client_events    event_id, request_id, user_id, video_id, type
```

Reads are lookups by one key, so a
[key-value store](/systems-and-infrastructure/sql-vs-nosql) fits. The choice
that matters is `request_id`: each event names the request that showed the
tile, which is how training joins features to outcomes.

## Decision: approximate nearest-neighbor retrieval

Ranking all 50 million videos per request would be 900 billion scores a second,
so a cheap stage picks first. An **embedding** is a list of 128 numbers placing
a user or video in a shared space, so Maya sits near videos she would watch;
computing hers per request lets tonight's cooking videos move her.
**Approximate nearest-neighbor (ANN)** search
([vector search](/ai-and-ml/vector-search)) visits a few thousand vectors, not
all 50 million, at the cost of **recall**, the share of the true top 300
returned: at 95%, about 15 are missed.

Why not exact search? It is simpler and right for a smaller catalog. Here it is
50 million × 128 = 6.4 billion multiply-adds a query: at an assumed 20 billion
a second per core, 9,600 cores at 60%. The 15 ANN replicas, at an assumed 16
cores, are 240: 40 times fewer, to recover 15 candidates.

**Rule of thumb.** When exact search costs too much and the next stage
tolerates a few misses, trade a little recall for a large cut in compute.

## Decision: train on the features that were served

If "clicks in the last hour" is computed one way in training and another in
serving, the model misreads it in production and nothing errors. That is
**training-serving skew**. So the served record stores the 200 values the model
saw for each video, and training reads them back, joined by `request_id` to
what happened next. The price is 8 TB a day, 240 TB over the 30-day window,
about 60 TB at an assumed 4× compression, and a new feature needs weeks of
logging.

Why not recompute features from the lake as of each impression (a point-in-time
join)? It stores far less and lets a new feature backfill, but streaming and batch code still disagree at the edges: if streaming drops events
over 5 minutes late and batch counts them, served counts run low.

**Rule of thumb.** If a model must train on what it saw in serving, log the
serving-time inputs instead of recomputing them: pay storage to remove a silent
bug.

## Decision: reserve one slot in 20 for new videos

A video uploaded ten minutes ago has no clicks, so the ranker scores it low
and it never gets any. An upload job embeds each new video
within minutes, from its title, category and channel, into a small index of the
last 48 hours (2 × 200,000 = 400,000 vectors), searched alongside the main one.
Then one of the 20 slots goes to the best new candidate: 500 million requests ÷
400,000 = 1,250 slots per video a day on average, 2,500 in 48 hours. With 12 of 20 tiles
on screen, 1,500 are seen: at an assumed 5% click rate, about 75 clicks.

Why not a score boost for new videos? It's simpler, but how many slots it takes from ranked videos shifts with the competition; the slot costs a known 5%.

**Rule of thumb.** If a system learns only from what it shows, budget
exploration as a fixed share of slots, so the cost is known.

## Likely follow-ups

- **What does a new user see?** Topics picked at sign-up, else the regional
  trending list, until her own watches take over.
- **How do you stop a new user tower meeting an old index?** Embeddings only
  compare within one trained model. The registry's serving pointer names the
  tower, index and ranker versions, flips by a conditional write once every
  replica has loaded the index, and each request keeps the versions it began with.
- **What if the feature store is down?** Serve a regional popular list from
  memory with `personalized: false`, the "some list" requirement. A
  [circuit breaker](/systems-and-infrastructure/circuit-breaker) stops calls
  to it.
- **How does a replayed event not double a count?** Stream jobs drop repeated
  `event_id`s and write computed values ("clicks_1h is 812 as of 19:05"), not
  increments ([idempotency](/systems-and-infrastructure/idempotency)).
