---
title: Design a Video Streaming Service (like YouTube and Netflix)
summary: Parallel 60-second encodes, 4-second segments a player chooses among as its connection changes, and an origin shield that cuts object-store egress, for 37.5 Tbit/s at peak.
date: 2026-10-05
order: 7
---

You're asked to design a service like YouTube or Netflix. A creator uploads a
10-minute phone clip, and millions watch it on phones and TVs, over connections
from fiber to a train in a tunnel. The interview is about **transcoding** each upload (re-encoding it at several resolutions and
**bitrates**, the bits per second of video), letting players switch between
them, and paying to send 37.5 Tbit/s.

## Requirements

- Resumable uploads of up to 20 GB, each transcoded into **renditions**, the
  same video at several bitrates.
- First frame within 2 seconds at p95 (95% of starts are faster) on 5 Mbit/s or
  faster, under 0.5% of watch time **rebuffering** (frozen, waiting for data),
  and lower quality, not a stall, when the connection slows.
- A video of up to an hour plays at up to 720p within 5 minutes of upload (p95)
  and has every rendition within 30 minutes.
- A viewer who pauses resumes at that spot on any device, and after a crash within about 2½ minutes of it. View counts may lag, but a retry mustn't inflate them.
- 100 million viewers a day watching 60 minutes each, and 500,000 uploads of 10
  minutes.

Out of scope: recommendations, search, live streaming and ads.

## Key numbers

These size the **CDN** (content delivery network, caches in many cities), the
object store and the encoders. Peak is 3 times the average ([numbers every engineer should know](/engineering-practices/numbers-every-engineer-should-know)):

- **Delivery:** 37.5 Tbit/s from the CDN at peak. 100 million hours a day ÷ 24 ×
  3 = 12.5 million streams, × an assumed 3 Mbit/s, 135 PB a day.
- **CDN edges:** 6.25 million requests a second at peak. Each stream fetches a
  video and audio piece every 4 seconds: 12.5 million × 2 ÷ 4.
- **Object store:** 770 TB added a day. 500,000 originals of 750 MB (10 Mbit/s ×
  10 minutes) is 375 TB, plus 394 TB of renditions (the five video rungs and audio
  total 10.5 Mbit/s).
- **Transcoding:** about 75,000 cores at peak. 300 million video-seconds a day ×
  an assumed 5 core-seconds ÷ 86,400 ≈ 17,400, × 3, at most 70% busy.

## High-level architecture

![Architecture of the video streaming service. Clients send upload, play and events requests to API servers, upload parts to the object store, and fetch manifests and segments from CDN edges. Edges send misses to the origin shield, and the shield sends misses to the object store. The API servers read the metadata DB plus cache, send events to the event log, and read resume positions and counts from the progress and counts stores. The metadata DB starts jobs in the workflow engine with an outbox row, and the engine writes status back. The workflow engine sends tasks to transcode workers, which read the original and write renditions to the object store. Stream workers read the event log and write to the progress and counts stores.](/diagrams/video-streaming/architecture.svg)

Follow `Fixing a bike chain`. The creator's app asks the **API servers** to start
an upload and sends the parts to the **object store**.
When it reports done, the API server marks the video `processing` and, in the
same transaction, writes an **outbox** row into the **metadata DB** that starts the
[workflow engine](/systems-and-infrastructure/workflow-engines)
([outbox pattern](/systems-and-infrastructure/outbox-pattern)). The engine hands
encode tasks to the **transcode workers**. A viewer's player fetches a
**manifest** (the list of renditions) and **segments** (the 4-second pieces of
each) from **CDN edges**; a miss goes to the **origin shield**, a shared cache
in front of the store. Player events go through the API servers to the
[event log](/systems-and-infrastructure/message-queues), where **stream
workers** turn them into resume positions and view counts.

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

Parts go up on **presigned URLs** (addresses the API signs so the store can
check them), so a dropped connection resends only what's missing
([file storage](/system-design/file-storage)). No file is overwritten, so a cached copy can't go stale. When 1080p finishes, a new
manifest version, `master-2`, adds it. `status` is `playable` once 240p to 720p
are packaged, `ready` with 1080p.

## Decision: encode in 60-second pieces

Each rung is cut into 60-second pieces, each its own encode task, run in
parallel and joined. Assume an encoder uses 4 cores well and spends
1.2 core-seconds per second of 720p. A piece takes 60 × 1.2 ÷ 4 = 18 seconds, so
an hour-long video's 300 tasks (60 pieces × 5 rungs) need 1,200 cores for under
a minute. 240p to 720p queue first.

Why not one encode per rung? For most uploads it works: 720p of a 10-minute clip
takes 180 seconds. But an hour takes 18 minutes, and any video over about 16
minutes misses the 5-minute requirement. Splitting costs seams: decoding starts only at a **keyframe** (a frame stored whole), so each piece is cut from the keyframe before it, and 25 million daily tasks need tracking.

**Rule of thumb.** When one worker is too slow for the biggest job and it splits
into independent pieces, split it and pay for joining and tracking.

## Decision: 4-second segments

Before each segment the player picks a rendition. It starts at 480p, steps up a
rung while its buffer (seconds downloaded, not yet played) grows, and drops when
measured speed says the buffer would run dry. Keyframes line up across
renditions, so a switch is seamless.

Why not 2 seconds? The player reacts sooner: in a tunnel at 1.5 Mbit/s, one 20
Mbit segment of 1080p takes 13 seconds, which the buffer covers while the player drops a rung. But the edges' load doubles to 12.5
million requests a second, and every segment starts with a keyframe, far larger
than the frames between, so the same picture costs more bits. Longer fails
start-up: a first 6-second 480p segment takes 1.7 of the 2 seconds at 5 Mbit/s,
against 1.1 for 4.

**Rule of thumb.** Size a unit of delivery by the longest wait you can't react
within, and accept more overhead as it shrinks.

## Decision: an origin shield behind the edges

The CDN bills per GB sent, whatever the arrangement. What changes is
**egress**, bytes read out of the object store, at an assumed $0.02 per GB. If
edges hit 90% of bytes, 10% of the 135 PB a day, 405 PB a month, comes from the
store: **$8.1 million**. A **shield** is a few large caches per region. If one
hits 80% of what reaches it, the store sends 2%: **$1.6 million**.

Why not let edges read the store directly? The long tail
hurts: a video watched 20 times a day across 20 cities is fetched by each,
usually after eviction, while a regional shield fetches it once. The price is an
extra hop on an edge miss, and the shields.

**Rule of thumb.** When many caches share a long tail, put one shared tier
behind them so a miss is fetched once, not once per cache.

## Likely follow-ups

- **What if a transcode worker stalls?** It holds a **lease**, a claim it
  must keep renewing; when it lapses the engine reassigns the task. A late result
  from the old worker is rejected by attempt number ([distributed locks](/systems-and-infrastructure/distributed-locks)).
- **How are views counted without inflating them?** Workers sum 10 seconds of
  views per video into one write that also records the log offset counted, so a
  replay does nothing, and drop a `view_id` seen in the last 10 minutes.
- **How does resume work?** The player sends a heartbeat every 30 seconds;
  workers write the latest position every 2 minutes, and at once on pause or close, so a player crash loses at most about 2½ minutes. Workers commit their log offset only after writing, so their crash replays events
  ([batching](/systems-and-infrastructure/batching-and-asynchronous-writes)).
- **How would you cut the delivery bill?** A newer codec, AV1, needs fewer bits
  but more compute, so encode it only for popular videos.
