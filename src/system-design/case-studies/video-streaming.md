---
title: Design a Video Streaming Service (like YouTube and Netflix)
summary: Turning each upload into a ladder of renditions cut into short segments, letting every player pick its rung from measured throughput and buffer, and serving 37.5 Tbit/s at peak through tiered CDN caches whose hit ratio sets the bill.
date: 2026-09-28
order: 7
---

A video streaming service takes a file someone uploads, a 10-minute clip shot
on a phone, say, and lets millions of people watch it on phones, laptops and
TVs, over connections that range from fiber to a train in a tunnel. Video is
enormous (one minute of 1080p is tens of megabytes), and it is watched while
it downloads, so a delivery that falls a few seconds behind stops the picture.

**Resolution** is the picture's size in pixels (1080p is 1920 × 1080).
**Bitrate** is how many bits one second of video takes, in megabits per second
(Mbit/s); more bits mean fewer visible artifacts. A **codec** is the
compression scheme that turns frames into those bits and back: H.264 plays on
nearly every device, while newer codecs such as AV1 need fewer bits for the
same picture but more computing to produce. **Transcoding** is decoding a
video and encoding it again at a different resolution, bitrate or codec.

This is one plausible design for a service like YouTube or Netflix, a large
catalog that anyone can upload to, not a description of how either company
built theirs.

## At a glance

**Requirements.**

- Resumable uploads of up to 20 GB and 6 hours, transcoded into renditions
  at several bitrates.
- First frame within 2 seconds at p95 on 5 Mbit/s or faster, and under 0.5% of
  watch time rebuffering.
- Playable at up to 720p within 5 minutes of upload (p95) for videos up to an
  hour, every H.264 rendition within 30 minutes.
- Resume within 30 seconds of where the viewer stopped, on any device; view
  counts that retries can't inflate.
- 100 million viewers a day watching 60 minutes each, 500,000 uploads of 10
  minutes, playback 99.95% available.

**Key numbers.** Peak is 3 times the average:

- 12.5 million concurrent streams at peak (100 million hours a day ÷ 24 ≈ 4.17
  million, × 3).
- 37.5 Tbit/s out at peak (12.5 million streams × 3 Mbit/s), about 4.05 EB a
  month.
- 6.25 million segment requests a second at peak (12.5 million streams × 2
  requests every 4 seconds).
- 770 TB stored a day (375 TB of originals + 395 TB of renditions), about
  1.4 EB over five years.
- About 75,000 transcoding cores at peak (17,400 busy on average, × 3, run at
  most 70% busy).

**Key decisions.**

- Parallel 60-second pieces per rung: a one-hour video's 720p takes under a
  minute, not 18 ([the pipeline](#deep-dive-the-upload-and-transcoding-pipeline)).
- 4-second segments and a hybrid bitrate rule: the first segment fits the
  start-up budget, and the buffer decides each step up
  ([adaptive bitrate](#deep-dive-segments-manifests-and-adaptive-bitrate)).
- Regional origin shields behind the CDN edges: object-store egress falls from
  about $8.1 million to $1.6 million a month
  ([the CDN](#deep-dive-delivery-through-the-cdn)).

**Likely follow-ups.**

- What does delivery cost? About $20 million a month; AV1 for videos past 1,000
  views saves about $2.1 million for $75,000 of compute
  ([fewer bytes per view](#deep-dive-delivery-through-the-cdn)).
- And storage by year five? $28 million a month all hot, about $5.2 million
  with originals archived and unwatched renditions in cold
  ([storage cost](#back-of-the-envelope-estimates)).
- What if a transcode worker stalls? Its lease lapses after 60 seconds, the
  task reruns, and the late result is rejected by its attempt number
  ([leases](#deep-dive-the-upload-and-transcoding-pipeline)).
- How do view counts avoid double counting? Each batch's transaction also
  advances its partition's offset, so a worker's replay does nothing, and
  workers drop a `view_id` resent within 10 minutes ([view counts](#high-level-architecture)).

The [high-level architecture](#high-level-architecture) follows one upload to its first viewer.

## Requirements

Functional requirements:

- **Upload.** A creator uploads a video of up to 20 GB and 6 hours. An
  interrupted upload resumes where it stopped.
- **Processing.** Each upload becomes several renditions (the same video at
  different resolutions and bitrates), with thumbnails.
- **Playback.** On the web, phones and TVs, dropping in quality rather than
  stopping when the connection slows, with seeking anywhere.
- **Resume.** A viewer who stops partway picks up at the same spot later, on
  any of their devices.
- **View counts.** Each video shows how many times it has been watched.

Out of scope: recommendations, search, comments, live streaming, ads,
subtitles, moderation, and **DRM** (digital rights management: encrypted
segments and a license server), which sits on top of this design.

Non-functional requirements:

- **Scale:** 100 million viewers a day, watching 60 minutes each on average.
  500,000 uploads a day, averaging 10 minutes of video each.
- **Start-up:** the first frame appears within 2 seconds at the 95th
  percentile (p95, the time 95% of starts beat) on connections of 5 Mbit/s or
  more.
- **Smoothness:** less than 0.5% of watch time spent **rebuffering**, the
  picture frozen while the player waits for data.
- **Processing time:** a video up to an hour long is playable at up to 720p
  within 5 minutes of its upload finishing (p95), and has every H.264
  rendition within 30 minutes.
- **Resume accuracy:** within 30 seconds of where the viewer stopped (a few
  seconds after a normal pause or close), on other devices within about 2
  minutes.
- **View counts** may lag by a couple of minutes and aren't exact to the view,
  but retries mustn't inflate them.
- **Availability:** playback 99.95% (about 22 minutes of downtime in a 30-day
  month, 43,200 minutes × 0.05% = 21.6); uploads and processing 99.9%.

## Back-of-the-envelope estimates

Units are decimal, and a byte is 8 bits. The usual rule of thumb from
[numbers every engineer should know](/engineering-practices/numbers-every-engineer-should-know),
a peak of ten times the average, fits bursty requests; viewing is a slow daily
swell across time zones, so this design assumes **3 times the average** for
viewing, uploads and processing.

**Watching.** 100,000,000 viewers × 60 minutes = 6 billion minutes a day, 100
million hours. Average concurrent streams: 100,000,000 ÷ 24 ≈ 4.17 million;
peak: × 3 = **12.5 million concurrent streams**.

**Bandwidth out.** Assume an average delivered bitrate of 3 Mbit/s across
phones at 480p and 720p and TVs at 1080p.

- Peak: 12,500,000 × 3 Mbit/s = **37.5 Tbit/s**. Average: 12.5 Tbit/s.
- Per day: 6 billion minutes × 60 seconds × 3,000,000 bits ÷ 8 = 1.35 × 10¹⁷
  bytes = **135 PB a day**, about **4.05 EB a month**.

**Views.** Assume an average view lasts 6 minutes: 6 billion ÷ 6 = **1 billion
views a day**, about 11,600 a second on average and 35,000 at peak, each
starting with one call to the playback API.

**Segment requests.** Players fetch video and audio in 4-second pieces (the
second deep dive explains why 4), 2 requests every 4 seconds: 12,500,000 × 2
÷ 4 ≈ **6.25 million requests a second** at peak, all served by the CDN.

**Uploads.** Assume a typical upload is 1080p at 10 Mbit/s, like a phone's: 10 Mbit/s × 600 seconds ÷ 8 = **750 MB** per 10-minute
video. 500,000 ÷ 86,400 ≈ 5.8 uploads a second, 17 at peak, and 500,000 ×
750 MB = 375 TB a day, about 34.7 Gbit/s on average and **104 Gbit/s at
peak**.

**The ladder.** The renditions, each an H.264 video stream, plus one audio
stream at 128 kbit/s:

| Rung  | Resolution  | Bitrate    |
| ----- | ----------- | ---------- |
| 240p  | 426 × 240   | 0.4 Mbit/s |
| 360p  | 640 × 360   | 0.8 Mbit/s |
| 480p  | 854 × 480   | 1.4 Mbit/s |
| 720p  | 1280 × 720  | 2.8 Mbit/s |
| 1080p | 1920 × 1080 | 5.0 Mbit/s |

- Together: 0.4 + 0.8 + 1.4 + 2.8 + 5.0 + 0.128 = 10.528 Mbit/s, about the
  same as the original, so 10.528 × 600 ÷ 8 ≈ **790 MB** of renditions per
  video.
- Per day: 500,000 × 790 MB ≈ 395 TB of renditions plus 375 TB of originals:
  **770 TB a day**.
- Per year: 770 TB × 365 ≈ **281 PB** (137 PB originals, 144 PB renditions).
  Over five years, about **1.4 EB**: 684 PB of originals and 721 PB of
  renditions.

**Transcoding compute.** Assume the H.264 ladder costs about 5 core-seconds
per second of video: about 2.8 for 1080p, 1.2 for 720p and 1.0 for the three
lower rungs together. 500,000 × 600 seconds = 300 million seconds of video a
day × 5 = 1.5 billion core-seconds, ÷ 86,400 ≈ 17,400 cores busy on average,
52,000 at peak. Run at no more than 70% busy so a queue doesn't build at every
burst, that is 52,000 ÷ 0.7 ≈ **75,000 cores at peak**, about 1,200 machines
of 64 cores, scaled down overnight.

**Events and metadata.** A progress **heartbeat** every 30 seconds per stream
is 12,500,000 ÷ 30 ≈ **417,000 events a second** at peak, about 83 MB a second
at 200 bytes each. Five years of videos, 912.5 million at about 2 KB each with
their rendition rows, is **1.8 TB** of metadata.

**Storage cost.** At an assumed $0.02 per GB-month for the standard (hot)
tier, 1.4 EB all hot is 1.4 billion GB × $0.02 ≈ **$28 million a month** by
year five. Cheaper tiers, as [cloud file storage](/system-design/file-storage)
lays out: **cold** answers in milliseconds for about $0.004 per GB-month but
charges about $0.03 per GB read and bills minimum periods; **archive** costs
about $0.001 but can take hours to return anything. Tiering by use:

- Originals are needed only to re-encode, so they go to archive after 30
  days: 30 × 375 TB = 11.25 PB hot, $0.2 million, and 673 PB archived,
  $0.7 million.
- Renditions unread for 90 days go to cold. If 10% of rendition bytes were
  watched in that time, 72 PB hot is $1.4 million and 648 PB cold $2.6
  million.
- Cold reads: if one in ten bytes the shields fetch from the object store
  (2.7 PB a day, the CDN deep dive) is cold, 0.27 PB a day, 8.1 PB a month × $0.03 ≈
  $0.24 million.
- Total: about **$5.2 million a month**, under a fifth of all-hot.

Deleting 1080p (5.0 of the ladder's 10.5 Mbit/s) from videos unwatched for a
year would save at most about $1.2 million, but the rare viewer of an old
video would get 720p for the hours a restore and re-encode take, so this
design keeps every rung. A cold rendition read often moves back to hot.

What the estimates say: the metadata is small. The bytes are enormous, 1.4 EB
kept and 4 EB a month sent, and nearly every decision below is about paying
for fewer of them, or less for each.

## Data model

**Video bytes** live in an **object store**: a cheap, redundant service that
keeps blobs under string keys, with put, get, get-a-byte-range and delete but
no queries or edits in place. Per video:

```text
originals/v9Qx.mp4                     the file as uploaded
v/v9Qx/h264_240p.mp4 … h264_1080p.mp4  one file per video rendition
v/v9Qx/audio.mp4                       the audio rendition
v/v9Qx/h264_720p.m3u8 …                one playlist per rendition
v/v9Qx/master-2.m3u8, master-2.mpd     manifests listing the renditions
thumbs/v9Qx/…                          thumbnail candidates and seek previews
```

No file is ever overwritten, so nothing a CDN has cached goes stale. Only the
top-level manifests change, when 1080p finishes or a second codec is added,
and each change writes a new **manifest version**: `master-1` lists the rungs
up to 720p, `master-2` adds 1080p.

**Metadata** lives in a relational database: 1.8 TB and a few hundred writes a
second fit one primary (the copy that takes writes) with read-only
**replicas**, and status changes need the conditional updates a relational
database does well.

```text
videos           video_id PK, owner_id, title, description, duration_s,
                 status (uploading | processing | playable | ready | failed | deleted),
                 visibility (public | unlisted | private),
                 manifest_version, created_at, published_at
upload_sessions  upload_id PK, video_id, object_key, multipart_id,
                 size, part_size, expires_at
renditions       video_id, name (h264_720p, av1_1080p, audio …), codec,
                 width, height, bitrate, object_key, bytes, tier
                 PK (video_id, name)
outbox           id PK, video_id, kind, created_at, sent_at
```

`status` moves forward only. `ready`, `failed` and `deleted` are **terminal**,
except that `failed` and `ready` can go to `deleted`, and `failed` can go back
to `processing` when an operator replays the video. Every status write is
conditional on the status it expects to replace, which makes a retried or late
write harmless (the pipeline deep dive).

**Watch progress** is one row per viewer per video in a wide-column store,
where rows are grouped and spread across machines by a partition key, here
`user_id`, so one viewer's rows sit together:

```text
watch_progress   user_id (partition key), video_id, position_s, duration_s
                 capped at the 500 most recent videos per user
```

For 300 million monthly viewers at about 60 bytes a row: 300 million × 500 ×
60 bytes = 9 TB, a small cluster.

**View counts** are one counter per video, plus one row per event-log
partition recording how far it has been counted, in the same database (the
architecture section explains why):

```text
view_counts      video_id PK, total
count_offsets    partition PK, next_offset
```

## API design

**Upload.** Uploads use the mechanics of
[cloud file storage](/system-design/file-storage): bytes go from the device
straight to the object store on **presigned URLs** (addresses the API signs so
the object store can check them on its own), in parts, so an interrupted
upload resends only the parts it lost.

```http
POST /videos
Authorization: Bearer <session-token>
Idempotency-Key: 0c9d…

{ "title": "Fixing a bike chain", "size": 750000000, "filename": "IMG_0412.MOV" }
```

`Bearer` means the request is allowed for whoever holds (bears) the token. The
response creates the video in status `uploading` and an upload session in
parts of 16 MiB (16,777,216 bytes, about 16.8 MB): 750 MB ÷ 16.8 MB ≈ 45 of
them:

```json
{ "video_id": "v9Qx", "upload_id": "up_31", "part_size": 16777216, "parts": 45 }
```

```http
POST /uploads/up_31/part-urls   { "parts": [1, 2, 3, 4] }  → one presigned PUT URL per part
GET  /uploads/up_31             → which parts the object store has received
POST /uploads/up_31/complete    → 202 Accepted, status processing
```

`complete` joins the parts into `originals/v9Qx.mp4` and starts processing.
The `Idempotency-Key` gives an app that retries after a timeout the same video
instead of a second one ([idempotency](/systems-and-infrastructure/idempotency)),
and the app polls `GET /videos/v9Qx` for the status.

**Play.**

```http
GET /videos/v9Qx/play
Authorization: Bearer <session-token>
```

```json
{
  "hls": "https://cdn.example/v/v9Qx/master-2.m3u8",
  "dash": "https://cdn.example/v/v9Qx/master-2.mpd",
  "resume_at_s": 312,
  "token": "…"
}
```

The URLs name the current manifest version, so the files behind them never
change. `token`, present only for private and unlisted videos, is a signed,
short-lived pass the CDN checks; it is not part of the cache key, so one
cached copy serves every allowed viewer.

**Events.** The player batches its events every 30 seconds, and sends at once
on pause, seek or close:

```http
POST /events
{ "session": "s_8f2a", "events": [
  { "type": "view", "video_id": "v9Qx", "view_id": "s_8f2a:v9Qx" },
  { "type": "progress", "video_id": "v9Qx", "position_s": 342, "reason": "heartbeat" }
] }
```

A `view` event is sent once per session, after 30 seconds of play (an assumed
definition of a view), and `view_id` lets a resend be recognized.

## High-level architecture

![Architecture of the video streaming service. Clients call the API servers for uploads, metadata, play requests and events, upload parts directly to the object store, and fetch manifests and segments from CDN edges. Edge misses go to the origin shield, and shield misses read from the object store. The API servers read and write the metadata database and read the progress and counts stores. An outbox row in the metadata database starts a job in the workflow engine, which sends encode and package tasks to the transcode workers and writes status back to the metadata database. Transcode workers read originals from and write renditions to the object store. The API servers append view and progress events to the event log, and stream workers consume it and write to the progress and counts stores.](/diagrams/video-streaming/architecture.svg)

The **API servers** are stateless, behind a load balancer left out of the
diagram, and never touch video bytes; the **metadata DB** has a cache in front
for play requests. The deep dives cover the **workflow engine** and
**transcode workers**, the player, and the **CDN edges** and **origin
shield**.

Following one upload, `IMG_0412.MOV`, to its first viewer:

1. The creator's app calls `POST /videos`, uploads 45 parts to the object
   store, and calls `complete`.
2. The API server has the object store assemble the parts, then, in one
   transaction, sets the video to `processing` and inserts an outbox row,
   "start processing v9Qx".
3. A relay reads the outbox and starts a workflow whose ID is the video ID.
4. The workflow probes the original, fans out encode tasks for 10 one-minute
   pieces × 5 rungs, plus audio and thumbnails, and packages the renditions:
   `playable` when 240p to 720p are packaged, `ready` when 1080p is.
5. A viewer's player calls `GET /videos/v9Qx/play` and fetches the manifest
   and segments from its nearest CDN edge; the edge and then the shield miss,
   and the shield reads from the object store.
6. The player sends heartbeats to `/events`.

Steps 2 and 3 are a dual write: calling the engine after the status write
would, on a crash between them, leave a video in `processing` with no job.
The outbox row in the same transaction is the
[outbox pattern](/systems-and-infrastructure/outbox-pattern), and the relay
retries until the engine has the job. A relay that crashes after starting the
workflow but before marking the row sent starts it again, and the engine
refuses a second workflow with the same ID, a common engine feature this
design needs. A crash between assembling the parts and the transaction is
finished by the client's retry of `complete`, which finds the original at its
key, or by a sweeper over expired upload sessions.

**The event path.** Heartbeats and views stay off the **hot path**, the
requests a viewer waits on: the API servers append them to the event log, a
**partitioned log** ([message queues](/systems-and-infrastructure/message-queues))
that keeps events in order per partition for a few days while each consumer
records the **offset** (position) it has read to. Progress is partitioned by
`user_id`, views by `video_id`.

Writing every heartbeat would be 417,000 writes a second, nearly all soon
overwritten; reporting only on pause and close loses the position when a
phone kills the app. So stream workers keep each viewer's latest position in
memory and write it at most every 2 minutes, and at once on pause, seek or
close. A worker commits its log offset only once every event before it has
been written, so a crash replays events instead of losing them, and a killed
app loses at most one 30-second heartbeat. That is at most 12,500,000 ÷ 120 ≈
**104,000 writes a second**, a quarter as many
([batching and asynchronous writes](/systems-and-infrastructure/batching-and-asynchronous-writes)).
So that a replay or a second device can't move a position backwards, each
write carries the time the API server received the event as its timestamp,
and the store keeps the higher-timestamped write (Cassandra's
`USING TIMESTAMP` allows this). A player sends its next batch only after the
last is acknowledged, so a resend can't outrank newer events.

View counts are batched too: the view stream has 256 partitions, and a worker
sums views per video for 10 seconds, 35,000 × 10 ÷ 256 ≈ 1,400 per batch, so
a video watched by a million people costs one write per batch, not thousands
on one row. "Add 1,400" isn't
[idempotent](/systems-and-infrastructure/idempotency), so the counts database
is sharded by the same partition number, and each batch is one transaction
that adds the sums and advances `count_offsets` from the batch's start offset
to its end, only if it still holds the start. A worker that dies before
recording its offset replays a batch that then does nothing, and on restart, or
whenever a batch's conditional update is rejected, it re-reads `next_offset`
from the counts shard and seeks the log there, so the counts shard, not the
log, decides where counting resumes. Workers drop `view_id`s seen in the last
10 minutes, rebuilt after a restart by re-reading 10 minutes of the log before
that offset; a later resend counts twice, which "not exact to the view" allows.

## Deep dive: the upload and transcoding pipeline

**One encode per rung, or many small ones.** The simplest pipeline gives each
rung to one 4-core task (encoders gain little beyond a handful of threads).
For a one-hour video, 720p then takes 3,600 × 1.2 ÷ 4 = 1,080 seconds, 18
minutes, and 1080p 42; any video past about 16 minutes (300 seconds × 4 cores
÷ 1.2) misses the 5-minute target.

The alternative encodes each rung as 60-second pieces, separate tasks run in
parallel and joined afterwards. A 1080p piece takes 60 × 2.8 ÷ 4 = 42 seconds
and a 720p piece 18, whatever the video's length: an hour-long video is 60
pieces × 5 rungs = 300 tasks, 1,200 cores for under a minute out of the
75,000. Splitting has costs:

- **Cutting exactly.** A compressed video can only be decoded from a
  **keyframe**, a frame stored whole rather than as changes from earlier
  frames, and the phone put its keyframes anywhere. A **probe** task reads the
  original's index (duration, codecs, keyframes); each piece fetches by byte
  range from the keyframe before its start (about 75 MB a minute) and discards
  frames before its exact start.
- **Aligned output.** Every rung forces a keyframe every 4 seconds, and each
  piece is 15 of those intervals, so segment boundaries fall at the same
  instants in every rendition, which switching depends on (the next deep
  dive).
- **Seams.** Quality can shift slightly at a piece boundary; one bitrate
  target and cap for every piece keeps that small. Audio is one task over the
  whole track, since cutting it risks clicks.
- **More to track.** A 10-minute video becomes 50 encode tasks plus audio,
  thumbnails and packaging: 500,000 × about 52 = 26 million tasks a day, 300
  a second on average and 900 at peak.

This design splits. **Packaging** then rewrites timestamps so the pieces play
as one stream and writes each rendition into one file with its playlists,
copying rather than re-encoding.

**Who keeps track.** Chaining queues by hand needs a progress table, a
finished-piece count that concurrent workers update safely, a sweeper for
stuck videos and retries at every step: a
[workflow engine](/systems-and-infrastructure/workflow-engines) written by
hand. A real engine runs the job as code and records each step durably, so a
crash resumes where it was, for one more system to run; its store takes 900
task starts and completions a second at peak, within one relational database.

This design uses an engine, feeding a
[worker pool](/systems-and-infrastructure/worker-pools) sized to its core
count through two queues: rungs up to 720p, audio and packaging first, 1080p
and everything else after, so at peak what waits is work with a 30-minute
target. The pool scales on the age of the oldest high-priority task, which is
what a creator waits for.

**Leases and late finishers.** A worker holds a **lease** on its task, a claim
it renews every 15 seconds; after 60 seconds of silence the engine hands the
task to another worker. That invites the failure
[distributed locks](/systems-and-infrastructure/distributed-locks) warns
about: a worker that was only paused (a long garbage-collection pause, a
network partition) reports a result for a task another worker is redoing. The
fence is the attempt number. Each attempt writes to its own key,
`work/v9Qx/h264_720p/piece-07.attempt-2.mp4`. A task is `pending`,
`running (attempt n)`, `done (output key)` or `failed`, and a completion is
accepted only if the task is `running` with the same attempt number, moving it
to `done` with that key in one conditional update. `done` and `failed` are
terminal, so attempt 1's late completion is rejected, and packaging reads only
the recorded key. The engine's store has one primary, so that check is a
single-row update; on a store where any replica takes writes it would need a
consensus round. A rule deletes anything under `work/` after 7 days.

Status writes are retried steps too, so each is conditional: `playable` only
from `processing`, `ready` only from `processing` or `playable`. A video
deleted mid-processing fails the next status write, and the workflow cancels
its tasks and deletes its output.

A task that fails three times, usually a **poison** upload the encoder can't
parse, goes to a
[dead-letter queue](/systems-and-infrastructure/dead-letter-queue). Before
`playable`, the video is marked `failed`, and an operator's replay sets it
back to `processing` (only if still `failed`) under a fresh workflow ID; after
`playable`, it stays playable and an alert fires.

![Flow of one upload through processing. The original in the object store is probed for duration, codecs and keyframes. The probe fans out encode tasks, one per piece and rung, run on the transcode workers, plus an audio task and a thumbnails task. When the 240p to 720p pieces and the audio are done, they are packaged and the video is marked playable. When the 1080p pieces are done, they are packaged too and the video is marked ready. A task that fails three times goes to the dead-letter queue. Once a ready video passes 1,000 views, an AV1 ladder is encoded for it.](/diagrams/video-streaming/transcode-pipeline.svg)

For a 10-minute upload at quiet times, the first playable version takes well
under two minutes: seconds for the relay and probe, about 18 seconds for the
720p pieces, and packaging that copies about 415 MB (the four lower rungs and
audio: 5.528 Mbit/s × 600 ÷ 8). At peak, queueing eats the rest of the 5
minutes.

## Deep dive: segments, manifests and adaptive bitrate

A player can't download 790 MB before playing, or commit to one bitrate on a
connection that changes minute to minute. **Adaptive bitrate streaming** (ABR)
cuts each rendition into short **segments**, each starting with a keyframe,
listed in a **manifest**. Before each segment the player picks a rendition;
with aligned keyframes, segment 79 of 720p follows segment 78 of 480p
seamlessly.

**HLS or DASH.** **HLS** (HTTP Live Streaming, `.m3u8` text playlists) plays
natively on Apple's devices; **DASH** (an XML `.mpd` manifest) is widely used
elsewhere. Both can point at the same **CMAF** (fragmented MP4) segments, so
the video is stored once with two small manifests. The HLS top-level playlist:

```text
#EXTM3U
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="aud",NAME="English",DEFAULT=YES,URI="audio.m3u8"
#EXT-X-STREAM-INF:BANDWIDTH=1600000,RESOLUTION=854x480,CODECS="avc1.4d401e,mp4a.40.2",AUDIO="aud"
h264_480p.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=3100000,RESOLUTION=1280x720,CODECS="avc1.4d401f,mp4a.40.2",AUDIO="aud"
h264_720p.m3u8
```

`BANDWIDTH` is the rung's peak bitrate, audio included, in bits per second.
Each rung's own playlist lists its segments:

```text
#EXTM3U
#EXT-X-VERSION:7
#EXT-X-TARGETDURATION:4
#EXT-X-PLAYLIST-TYPE:VOD
#EXT-X-MAP:URI="h264_720p.mp4",BYTERANGE="1234@0"
#EXTINF:4.000,
#EXT-X-BYTERANGE:1400123@1234
h264_720p.mp4
#EXTINF:4.000,
#EXT-X-BYTERANGE:1398877@1401357
h264_720p.mp4
…
#EXT-X-ENDLIST
```

Each segment is a **byte range** of one file per rendition (1,400,123 bytes
from byte 1,234; about 2.8 Mbit/s × 4 s ÷ 8 = 1.4 MB), and the `MAP` line
points at the header the player needs once per rendition. One object per
segment would also work, but tier transitions cost about $0.02 per 1,000
objects: 150 segments × 6 renditions is 900 objects per video, 164 billion a
year, and moving 90% to cold costs **about $3 million**, with every 64 KB
audio segment billed as 128 KB where that minimum applies. One object per
rendition is 1.1 billion a year, **about $20,000**. Most CDNs cache byte-range
requests, so the caches work the same either way.

**How long a segment.** Shorter segments start and react sooner, but mean more
requests and more keyframes, which are large. At peak:

- **2 seconds:** 12,500,000 × 2 ÷ 2 = 12.5 million requests a second.
- **4 seconds:** 6.25 million a second. The first 480p segment is
  1.4 Mbit/s × 4 = 5.6 Mbit, 1.1 seconds at 5 Mbit/s, plus about 0.1 seconds
  for the first audio segment (0.128 × 4 ≈ 0.5 Mbit).
- **6 seconds:** 4.2 million a second, but the first segment is 8.4 Mbit,
  1.7 seconds at 5 Mbit/s, leaving almost nothing of the 2-second budget.

This design uses 4 seconds, which leaves room in the start-up budget for the
play call, playlists and init segments, and halves the request rate of 2.

![Sequence of the first playback of v9Qx, resuming at 312 seconds. The player asks the play API for the video and gets the manifest URL, a token and the resume position. It fetches the master playlist, master-2.m3u8, from the CDN edge and gets the list of rungs, then fetches the 480p playlist, h264_480p.m3u8, and gets the byte range of each of that rung's segments. It then asks the edge for 480p segment 78. The edge misses and asks the origin shield, which also misses and reads that byte range from the object store; the shield caches it and returns it to the edge, which caches it and returns it to the player. The player measures about 9 Mbit/s with 4 seconds buffered and asks the edge for 720p segment 79, which the edge returns (on a miss, fetched the same way as segment 78).](/diagrams/video-streaming/playback-sequence.svg)

The resume position, 312 seconds, is segment 312 ÷ 4 = 78 (counting from 0),
so the player starts there at a conservative 480p and chooses the next rung
once it has measured something.

**Choosing the rung.** Three kinds of rule are in common use:

- **Throughput-based.** Estimate speed as the lower of a fast and a slow
  average of recent downloads, and take the highest rung under 80% of it: at
  9 Mbit/s, 7.2 Mbit/s allows 1080p. It starts well, but learns of a collapse
  only once a slow segment finishes, and flip-flops around a threshold.
- **Buffer-based.** Look only at the seconds downloaded but not yet played:
  under 8, the lowest rung; above 30, the highest; stepping up in between. It
  stalls and switches less, but plays the lowest rung for the first
  half-minute.
- **Hybrid.** Throughput decides at start-up and always caps the choice; the
  buffer decides when to step up, one rung at a time, which is why the player
  above goes from 480p to 720p, not straight to 1080p.

A worked case: a viewer on a train watching 1080p with 24 seconds buffered
enters a tunnel, and throughput falls from 10 to 1.5 Mbit/s. A 1080p segment
(5.0 × 4 = 20 Mbit) now takes 13.3 seconds while adding 4 to the buffer:
24 − 13.3 + 4 ≈ 14.7 seconds left, then about 5.4, and the third stalls. After
the first slow segment the throughput cap drops to 80% of 1.5, 1.2 Mbit/s, so
360p (3.2 Mbit, 2.1 seconds a segment), and the buffer grows about 1.9 seconds
per segment. Leaving the tunnel, the hybrid climbs one rung per segment only
while the buffer keeps growing.

This design ships the hybrid; the service's levers over it are the ladder's
spacing and the segment length.

## Deep dive: delivery through the CDN

At 37.5 Tbit/s, no single data center could send the bytes, and a viewer in
Jakarta fetching from Virginia would wait 200 ms or more per request. A
**CDN** (content delivery network) is a large set of caching servers grouped
in **points of presence** (PoPs) in many cities, which viewers reach through
DNS (the internet's directory from names to addresses) or a shared address
that routing delivers to the closest PoP. The **edge** cache that answers
serves a hit itself and fetches a miss from further back.

**What sets the bill.** CDN delivery is billed per GB sent to viewers: at an
assumed negotiated $0.005 per GB, 4.05 billion GB a month is **about $20
million a month**, whatever the caches do. What the caches change is the
bytes read from the object store behind them, billed as **egress** (bytes
leaving the cloud) at an assumed $0.02 per GB, and the edges' **hit ratio**,
the share of bytes served from cache, decides how many there are.

**Where the hits come from.** Every edge holds the few videos that take most
of the watch time. The long tail is the problem: a video watched 20 times a
day over 20 PoPs is requested once per PoP per day, usually after its
segments were evicted. Two ways to back the edges:

- **Edges fetch misses straight from the object store.** If edges hit 90% of
  bytes, the other 10%, 13.5 PB a day, is 405 PB a month × $0.02 = **$8.1
  million a month** in egress, and each long-tail video is fetched once per
  PoP that asks.
- **Regional shields between them.** A few dozen large caches, each serving a
  region's edges, so a video missed by 20 edges is fetched once. If shields
  hit 80% of what reaches them, the object store sends 10% × 20% = 2% of
  bytes, 2.7 PB a day, **$1.6 million a month**, for an extra hop of tens of
  milliseconds on an edge miss and the shields themselves.

This design uses shields; they pay for themselves several times over and
absorb bursts. When thousands of edges miss on a new release's segment 0 in
the same second, each shield **coalesces** the misses into one object-store
request
([thundering herd problem](/systems-and-infrastructure/thundering-herd-problem)).
Segments never change, so they are cached with a TTL (time to live) of a year
([caching](/systems-and-infrastructure/caching)). Deleting a video or making
it private purges the `v/v9Qx/` prefix from edges and shields and sets a
per-video CDN flag requiring a token, so access never depends on the cached
copy.

Predictable demand, like a series' next episode, is pushed to the edges in the
idle early morning by a background job left out of the diagram. Running its
own edge servers is the other way to cut the delivery bill: at an assumed 40
Gbit/s per server run at most 70% busy, 37,500 ÷ 28 ≈ 1,340 servers at peak,
plus network contracts. This design starts on commercial CDNs and takes that step only once the bill justifies the
hardware and the team.

**Fewer bytes per view.** Every percent of bits saved is a percent of $20
million. AV1 is commonly measured at 30% or more fewer bits than H.264 for
similar quality, the biggest single lever. Assume it takes ten times the
H.264 compute, 50 core-seconds per second of video, and plays on devices
covering half of watch time:

- **AV1 for every upload:** 300,000,000 seconds × 50 = 15 billion
  core-seconds a day, about 4.2 million core-hours; at an assumed $0.02 per
  core-hour, $83,000 a day, **$2.5 million a month**.
- **AV1 once a video passes 1,000 views.** If 3% of uploads do, carrying 70%
  of watch time, compute is 3% of that, **$75,000 a month**, and the saving is
  70% × 50% × 30% = 10.5% of the delivery bill, **about $2.1 million a
  month**.
- AV1 for the other 97% would add 30% × 50% × 30% = 4.5%, $0.9 million a
  month, for $2.4 million more compute. Not worth it.

This design encodes AV1 past the threshold, at low priority in the overnight
trough (about 5,200 cores on average), and a new manifest version lists both
ladders for players to choose from. A video that passes the threshold after
its original has gone to archive waits hours for a restore first, and its
H.264 ladder serves until then.

## Failure modes and bottlenecks

**A transcode worker dies or stalls.** Its lease lapses after 60 seconds and
the task reruns; a late finisher is refused by the attempt check. The cost is
under a minute of encoding, so workers can run on cheap interruptible (spot)
capacity that cloud providers may take back.

**A burst of uploads.** Past the 3× peak, the high-priority queue's age rises,
the pool scales on it, and 1080p and AV1 wait. Once that age passes an hour,
the upload API refuses new uploads with `503` and a retry time
([backpressure](/systems-and-infrastructure/backpressure)) rather than accept
work it can't finish on time.

**An edge PoP goes down.** Its viewers move to the next-nearest PoP, the
shield takes the extra misses, and players step down a rung briefly.

**The object store's region is unavailable.** Edges and shields keep serving
what they hold, 98% of bytes by the hit ratios above: popular videos play on,
uncached long-tail videos fail to start, and uploads stop. Replicating the
72 PB of hot renditions to a second region would cover the tail, at twice
their storage cost; this design replicates only the metadata and revisits
that if outages exceed the availability target.

**The metadata DB is down.** Plays with cached play information keep working;
other plays, uploads and status changes fail until a replica is promoted. A
stalled event path, by contrast, only delays positions and counts, and players
hold unsent events for a few minutes, so a short `/events` outage loses
nothing.

**Knowing any of this is happening.** Players report time to first frame,
rebuffering and delivered bitrate by CDN, PoP, region and device, since one
internet provider's problem vanishes in a global average; behind them sit hit
ratios, egress, queue age and event-log lag
([observability](/systems-and-infrastructure/observability)).

## Trade-offs

- **Parallel pieces over one encode per rung.** A one-hour video's 720p takes
  under a minute instead of 18, paid for with 5 tasks per minute of video, a
  probe step, and small quality seams at piece boundaries.
- **A workflow engine over hand-chained queues.** Crash recovery, retries and
  fan-out come built in, for another system to operate; steps must still be
  idempotent.
- **4-second segments.** Start-up fits in 2 seconds with half the requests of
  2-second segments, but a collapsing connection shows up a segment later.
- **A shield tier.** Object-store egress falls from about $8.1 million a month
  to $1.6 million and release-day bursts are absorbed, for another cache layer
  and an extra hop on every edge miss.
- **AV1 only for popular videos:** $2.1 million a month saved for $75,000 of
  compute; the long tail stays H.264-only.
- **Tiered storage, no deleted rungs.** $5.2 million a month instead of $28
  million, with retrieval fees and hours to restore an original.
- **Coalesced progress, batched counts.** A quarter of the progress writes and
  one counter write per video per batch; positions can trail by 2 minutes, and
  a very late resend can count one view twice.

What would change the design: live streaming would rebuild the pipeline around
a latency budget of seconds, encoding segments as they arrive. A catalog of a
few thousand licensed titles would make everything popular: the whole catalog
could sit at every edge, and more compute per title would pay back on every
view.
