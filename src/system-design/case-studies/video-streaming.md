---
title: Design a Video Streaming Service (like YouTube and Netflix)
summary: Parallel 60-second encodes, 4-second segments a player chooses among as its connection changes, and an origin shield that cuts object-store egress, for 37.5 Tbit/s at peak.
date: 2026-10-05
order: 7
---

You're asked to design a service like YouTube or Netflix. A creator uploads a 10-minute phone clip, `Fixing a bike chain`, and millions of people watch it on phones and TVs, over connections from fiber to a train in a tunnel. How does one upload become something every one of those screens plays without freezing, at a cost you can pay?

The answer here is to re-encode each upload into several smaller copies, let each player pick the copy its connection can carry, and serve popular video from copies kept near the viewers. This page starts with the one-file design and shows it freeze, follows an upload through the design that replaces it, sizes the parts, and makes three decisions: how to split the encoding work, how long each piece of video should be, and how to cut the cost of reading from storage.

## Requirements

- Resumable uploads of up to 20 GB, so a dropped connection continues instead of restarting, each re-encoded into several smaller copies of the same video.
- A first frame within 2 seconds at p95 (95% of starts are faster) on 5 Mbit/s (megabits per second) or faster.
- Under 0.5% of watch time rebuffering (frozen, waiting for data), and a worse picture, not a freeze, when a connection slows.
- A video of up to an hour plays at up to 720p, a medium picture size, within 5 minutes of upload (p95), and has every copy within 30 minutes.
- A viewer who pauses resumes at that spot on any device, and after a player crash within about 2½ minutes of it. View counts may lag, but a retry mustn't inflate them.
- 100 million viewers a day watching 60 minutes each, and 500,000 uploads of 10 minutes.

Out of scope: recommendations, search, live streaming and ads.

## Start simple

The obvious design keeps the uploaded file in an **object store**, a service that stores files by name ([file storage](/system-design/file-storage)), and has every player download it.

The phone recorded the clip at 10 Mbit/s, so every second of video takes 10 megabits. On home Wi-Fi at 50 Mbit/s that's easy:

```text
file size:
  10 Mbit/s × 600 s = 6,000 Mbit
  6,000 Mbit ÷ 8 = 750 MB
Wi-Fi at 50 Mbit/s, per second of video:
  10 Mbit ÷ 50 Mbit/s = 0.2 s to download
```

Now try the 5 Mbit/s the requirements promise, and the tunnel's 1.5:

```text
5 Mbit/s:
  10 ÷ 5 = 2 s to download each second of video
tunnel, 1.5 Mbit/s:
  10 ÷ 1.5 ≈ 6.7 s
```

Each second of video takes 2 seconds to arrive at 5 Mbit/s, so it freezes half the time, and in the tunnel most of the time. One file can't suit both connections.

A smaller copy can. It uses fewer pixels and compresses harder, so each second of video takes fewer bits. That count of bits per second is the video's **bitrate**, 10 Mbit/s for the upload. Encoding the video again at a lower bitrate is **transcoding**.

Make several copies, from smallest to biggest, and you have a **bitrate ladder**: each copy is one **rung**. Assume five rungs of video, each named by its picture height in pixels (1080p is 1,080 pixels tall), and one of audio:

```text
rung    bitrate
240p    0.4 Mbit/s
360p    0.8
480p    1.4
720p    2.8
1080p   5.0
audio   0.1
total:  0.4 + 0.8 + 1.4 + 2.8 + 5.0 + 0.1 = 10.5 Mbit/s
```

A player in the tunnel takes the 360p rung at 0.8 Mbit/s, and a TV on fiber takes 1080p. But a connection changes mid-video, so the player can't commit to a rung at the start. Cut each rung into pieces of a few seconds, the **segments**, and it can choose again before each one. A **manifest**, a list of the rungs and their segments, tells it what exists.

That fixes the viewer's side. It leaves the service with five encodes per upload and millions of players fetching segments, and the architecture is built around those two jobs.

## High-level architecture

![Architecture of the video streaming service. Clients send upload, play and events requests to API servers, upload parts to the object store, and fetch manifests and segments from CDN edges. Edges send misses to the origin shield, and the shield sends misses to the object store. The API servers read the metadata DB plus cache, send events to the event log, and read resume positions and counts from the progress and counts stores. The metadata DB starts jobs in the workflow engine with an outbox row, and the engine writes status back. The workflow engine sends tasks to transcode workers, which read the original and write segments to the object store. Stream workers read the event log and write to the progress and counts stores.](/diagrams/video-streaming/architecture.svg)

Follow `Fixing a bike chain`. The creator's app asks an **API server**, one of many identical servers that answer the app's requests, to start an upload, and sends the file's parts straight to the object store. When it reports done, the API server records the video as `processing` in the metadata DB, which holds each video's record. In the same write goes a row that says "start encoding", so both land or neither does, even if the server crashes right after ([outbox pattern](/systems-and-infrastructure/outbox-pattern)). That row starts the [workflow engine](/systems-and-infrastructure/workflow-engines), which tracks a job made of many tasks and retries failed ones. It hands encode tasks to the transcode workers, which read the original from the object store and write segments back, and it records the job's status in the metadata DB.

To watch, the player fetches the manifest, then segments, from **CDN edges**, caches in many cities ([CDNs](/computing-fundamentals/load-balancers-and-cdns)). An edge that lacks a segment asks the **origin shield**, a shared cache in front of the object store, which asks the store only if it lacks the segment too. The API servers, with a cache in front of the metadata DB, answer "play" requests.

While it plays, the player sends **events**, small messages such as "at second 330", through the API servers to the [event log](/systems-and-infrastructure/message-queues), a list kept in order. The stream workers read the log and write resume positions and view counts to the progress and counts stores. When a viewer returns, the API servers read the resume position from the progress store.

Each of those parts has to be sized, and delivery is the largest.

## Key numbers

These size the CDN edges, the object store and the transcode workers. A day is 86,400 seconds, and peak is 3 times the average ([numbers every engineer should know](/engineering-practices/numbers-every-engineer-should-know)).

- **CDN edges, bandwidth:** 37.5 Tbit/s at peak. 100 million viewers × 60 minutes is 100 million hours of video a day; ÷ 24 hours ≈ 4.17 million streams (viewers watching at once) on average; × 3 ≈ 12.5 million at peak; × an assumed 3 Mbit/s each = 37.5 million Mbit/s = 37.5 Tbit/s. Over a day, 100 million hours × 3,600 s × 3 Mbit/s ÷ 8 = 135 PB.
- **CDN edges, requests:** 6.25 million a second at peak. Each stream fetches a video segment and an audio segment every 4 seconds (the length chosen below): 12.5 million × 2 ÷ 4 = 6.25 million.
- **Object store:** 770 TB added a day. Originals: 500,000 × 750 MB = 375 TB. Rungs: 10.5 Mbit/s × 600 s = 6,300 Mbit ÷ 8 = 787.5 MB each, × 500,000 ≈ 394 TB. 375 + 394 = 769, about 770 TB.
- **Transcode workers:** about 75,000 cores at peak. A core is one processor unit doing one thing at a time. 500,000 uploads × 600 s = 300 million video-seconds a day; assume all five rungs take 5 core-seconds (one core busy for one second) per video-second; 300 million × 5 = 1.5 billion core-seconds; ÷ 86,400 ≈ 17,400 cores on average; × 3 ≈ 52,000 at peak; ÷ 0.7, so they're at most 70% busy, ≈ 75,000.

Those are the sizes. Next, what the clients send and what is stored.

## API and data model

```http
POST /videos   { "title": "Fixing a bike chain", "size": 750000000 }
-> { "video_id": "v9Qx", "upload_id": "up_31", "part_size": 16777216, "parts": 45 }

POST /uploads/up_31/complete   -> 202 Accepted, status "processing"

GET /videos/v9Qx/play   -> { "hls": ".../v9Qx/master-2.m3u8", "resume_at_s": 312 }

POST /events   [{ "type": "heartbeat", "video_id": "v9Qx", "position_s": 330, "view_id": "..." }]
```

```text
videos          video_id PK, owner_id, title, manifest_version,
                status (uploading | processing | playable | ready | failed | deleted)
renditions      video_id, name ("h264_720p"), bitrate, object_key   PK (video_id, name)
watch_progress  user_id (partition key), video_id, position_s       wide-column store
```

Parts go up on **presigned URLs** (addresses the API signs so the store can check them), so a dropped connection resends only what's missing ([file storage](/system-design/file-storage)). No file is overwritten, so a cached copy can't go stale: when 1080p finishes, a new manifest version, `master-2`, adds it.

The `hls` field names the manifest, in a widely supported streaming format called **HLS**. `status` is `playable` once 240p to 720p have segments and are in the manifest, and `ready` with 1080p. `renditions`, the usual word for a rung, has one row per rung.

`watch_progress` lives in a [wide-column store](/systems-and-infrastructure/sql-vs-nosql), a database that spreads huge tables over many machines, keyed by user so a resume reads one machine. Every 30 seconds the player sends a **heartbeat**, a small "I'm at second 330" event, which the stream workers turn into a position.

That's the data. The slowest job comes first: encoding an hour-long video.

## Decision: encode in 60-second chunks

The simpler design runs one encode per rung, start to finish. Assume an encoder that uses 4 cores well and spends 1.2 core-seconds per second of 720p:

```text
10-minute clip, 720p:
  600 s × 1.2 = 720 core-seconds
  720 ÷ 4 = 180 s
1-hour video, 720p:
  3,600 s × 1.2 = 4,320 core-seconds
  4,320 ÷ 4 = 1,080 s = 18 min
longest video that fits 5 minutes:
  1.2 ÷ 4 = 0.3 s of work per second of video
  300 s ÷ 0.3 = 1,000 s ≈ 17 min
```

For most uploads that's fine. But an hour-long video takes 18 minutes, and any video over about 17 minutes misses the 5-minute requirement.

So cut each rung into 60-second **chunks**, each its own encode task, run in parallel and joined. Chunks are for encoding; a viewer never sees them. Queue 240p to 720p first, so the video is playable early:

```text
one 720p chunk:
  60 s × 1.2 ÷ 4 = 18 s
one 1080p chunk, at an assumed 2.4 core-seconds per second:
  60 s × 2.4 ÷ 4 = 36 s
1-hour video:
  60 chunks × 5 rungs = 300 tasks
  300 × 4 cores = 1,200 cores, for under a minute
a day:
  500,000 uploads × 10 chunks × 5 rungs
  = 25,000,000 tasks
```

Splitting costs seams. Decoding starts only at a **keyframe**, a frame stored whole, so each chunk is cut from the keyframe before it. The engine also has 25 million tasks a day to track. With the encodes parallel, the next question is what viewers fetch.

**Rule of thumb.** When one worker is too slow for the biggest job and it splits into independent pieces, split it and pay for joining and tracking.

## Decision: 4-second segments

The simpler choice is long segments: fewer requests, and fewer keyframes, since every segment starts with one far larger than the frames after it. Try 6 seconds. The player starts on the 480p rung, so the first segment decides the 2-second first-frame target:

```text
first segment, 480p at 1.4 Mbit/s, over 5 Mbit/s:
  6 s: 6 × 1.4 ÷ 5 ≈ 1.7 s
  4 s: 4 × 1.4 ÷ 5 ≈ 1.1 s
setup, assumed: 4 round trips × 100 ms = 0.4 s
  6 s: 1.7 + 0.4 = 2.1 s, over the 2 s target
  4 s: 1.1 + 0.4 = 1.5 s
edge requests a second (12.5 million streams × 2 segments ÷ length):
  6 s: 12.5M × 2 ÷ 6 ≈ 4.2M
  4 s: 12.5M × 2 ÷ 4 = 6.25M
  2 s: 12.5M × 2 ÷ 2 = 12.5M
tunnel, 1.5 Mbit/s, one 4 s segment of 1080p:
  4 s × 5 Mbit/s = 20 Mbit
  20 ÷ 1.5 ≈ 13 s
```

Add an assumed 0.4 seconds of setup, fetching the manifest and opening connections. At 6 seconds the first frame then arrives at 2.1 seconds and misses the target; at 4 it arrives at 1.5. So segments are 4 seconds long.

Before each one, the player picks a rung. It starts at 480p, steps up a rung while its **buffer** (seconds downloaded, not yet played) grows, and drops when measured speed says the buffer would run dry. Keyframes line up across rungs, so the picture carries on across a switch. In the tunnel, a 13-second segment fits inside a buffer of 30 seconds (an assumed size) while the player drops a rung.

Why not 2 seconds, so it reacts sooner? That doubles the edges' load to 12.5 million requests a second, and every segment starts with a keyframe, so the same picture costs more bits. Segments set how many requests the edges answer, but the bytes behind them still have to come from somewhere.

**Rule of thumb.** Size a unit of delivery by the longest wait you can't react within, and accept more overhead as it shrinks.

## Decision: an origin shield behind the edges

The simpler design lets each edge read the object store on a miss. Assume the CDN bills per GB sent either way. What changes is **egress**, bytes read out of the object store, at an assumed $0.02 per GB. If edges hit 90% of bytes:

```text
read from the store, a day:
  135 PB × 10% = 13.5 PB
a month:
  13.5 PB × 30 = 405 PB = 405,000,000 GB
egress:
  405,000,000 × $0.02 = $8.1 million
```

That's a lot to pay for bytes already sent once. A **shield** is a few large caches per region, between the edges and the store. If one hits 80% of what reaches it, the store sends 20% of the edges' misses:

```text
read from the store, a day:
  13.5 PB × 20% = 2.7 PB (2% of 135 PB)
a month:
  2.7 PB × 30 = 81 PB = 81,000,000 GB
egress:
  81,000,000 × $0.02 ≈ $1.6 million
```

It works because of the long tail, the many videos each watched rarely. A video watched 20 times a day across 20 cities is fetched by each edge, usually after eviction, while a regional shield fetches it once. The price is an extra hop on an edge miss, and the shields themselves.

**Rule of thumb.** When many caches share a long tail, put one shared tier behind them so a miss is fetched once, not once per cache.

## Likely follow-ups

- **What if a transcode worker stalls?** It holds a **lease**, a claim it must keep renewing; when it lapses the engine reassigns the task. A late result from the old worker is rejected by attempt number ([distributed locks](/systems-and-infrastructure/distributed-locks)).
- **How are views counted without inflating them?** Workers sum 10 seconds of views per video into one write that also records the log offset counted (the position in the event log), so replaying events does nothing, and they drop a `view_id` seen in the last 10 minutes ([idempotency](/systems-and-infrastructure/idempotency)).
- **How does resume work?** The player sends a heartbeat every 30 seconds; workers write the latest position every 2 minutes, and at once on pause or close, so a player crash loses at most about 2½ minutes. Workers commit their log offset only after writing, so their crash replays events ([batching](/systems-and-infrastructure/batching-and-asynchronous-writes)).
- **How would you cut the delivery bill?** A newer codec (compression format), AV1, needs fewer bits but more compute, so encode it only for popular videos.
