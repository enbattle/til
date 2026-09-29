---
title: Design a Video Streaming Service (like YouTube and Netflix)
summary: Turning each upload into a ladder of renditions cut into short segments, letting every player pick its rung from measured throughput and buffer, and serving 37.5 Tbit/s at peak through tiered CDN caches whose hit ratio sets the bill.
date: 2026-09-28
order: 7
---

A video streaming service takes a file someone uploads, a 10-minute clip shot
on a phone, say, and lets millions of people watch it on phones, laptops and
TVs, over connections that range from fiber to a train going through a tunnel.
Two properties of video shape the whole design. It is enormous: one minute of
1080p video is tens of megabytes, where a chat message is a few hundred bytes.
And it is watched while it downloads, so a delivery that falls a few seconds
behind stops the picture, which viewers notice immediately.

Some vocabulary first. **Resolution** is the picture's size in pixels (1080p
is 1920 × 1080). **Bitrate** is how many bits one second of video takes, in
megabits per second (Mbit/s); at a given resolution, more bits mean fewer
visible artifacts. A **codec** is the compression scheme that turns raw frames
into those bits and back: H.264 plays on nearly every device made in the last
fifteen years, while newer codecs such as AV1 need fewer bits for the same
picture but more computing to produce. **Transcoding** is decoding a video and
encoding it again at a different resolution, bitrate or codec.

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

- Encode each rung as parallel 60-second pieces: a one-hour video's 720p takes
  under a minute instead of 18 minutes
  ([the pipeline](#deep-dive-the-upload-and-transcoding-pipeline)).
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
  ([storage tiers](#deep-dive-storage-tiers-for-the-long-tail)).
- What if a transcode worker stalls? Its lease lapses after 60 seconds, the
  task reruns, and the late result is rejected by its attempt number
  ([leases](#deep-dive-the-upload-and-transcoding-pipeline)).
- How do view counts avoid double counting? Each batch's transaction also
  advances its partition's offset, so a worker's replay does nothing, and
  workers drop a `view_id` resent within 10 minutes ([view counts](#deep-dive-view-counts-and-watch-progress)).

The [high-level architecture](#high-level-architecture) follows one upload to its first viewer.

## Requirements

Functional requirements:

- **Upload.** A creator uploads a video file of up to 20 GB and up to 6 hours
  long. An interrupted upload resumes where it stopped.
- **Processing.** Each upload is transcoded into several renditions (the same
  video at different resolutions and bitrates), with thumbnails to choose
  from.
- **Playback.** Viewers watch on the web, phones and TVs. The picture adapts
  to the viewer's connection, dropping to a lower quality rather than
  stopping, and viewers can seek anywhere in the video.
- **Resume.** A viewer who stops partway picks up at the same spot later, on
  any of their devices.
- **View counts.** Each video shows how many times it has been watched.

Out of scope: recommendations and the home page (a later case study), search,
comments, live streaming, ads, subtitles, and content moderation or copyright
matching (which would hang extra steps off the processing workflow below
without changing its shape). Paid catalogs add **DRM** (digital rights
management: segments are encrypted and players fetch keys from a license
server); that sits on top of this design and isn't covered.

Non-functional requirements:

- **Scale:** 100 million viewers a day, watching 60 minutes each on average.
  500,000 uploads a day, averaging 10 minutes of video each.
- **Start-up:** the first frame appears within 2 seconds at the 95th
  percentile (p95, the time 95% of starts beat) for viewers on connections of
  5 Mbit/s or more.
- **Smoothness:** less than 0.5% of watch time spent **rebuffering**, the
  picture frozen while the player waits for data.
- **Processing time:** a video up to an hour long is playable at up to 720p
  within 5 minutes of its upload finishing (p95), and has every H.264
  rendition within 30 minutes.
- **Resume accuracy:** the resume point is within 30 seconds of where the
  viewer stopped, and within a few seconds when they paused or closed the
  player normally. It reaches their other devices within about 2 minutes.
- **View counts** may lag by a couple of minutes and aren't exact to the view,
  but retries mustn't inflate them.
- **Availability:** playback 99.95% (about 22 minutes of downtime in a 30-day
  month, since 43,200 minutes × 0.05% = 21.6); uploads and processing 99.9%.
  A creator whose upload waits an extra ten minutes is annoyed; a million
  viewers staring at a spinner is an outage.

## Back-of-the-envelope estimates

MB, GB, TB, PB and EB are decimal, and a byte is 8 bits. Rules of thumb come
from
[numbers every engineer should know](/engineering-practices/numbers-every-engineer-should-know),
with one change: the usual "plan for ten times the average" is for bursty
request traffic, and viewing is a slow daily swell as evening moves across
time zones. This design assumes a peak of **3 times the average** for viewing,
uploads and processing alike.

**Watching.**

- Watch time: 100,000,000 viewers × 60 minutes = 6 billion minutes a day,
  which is 100 million hours.
- Average concurrent streams: 100,000,000 hours ÷ 24 hours ≈ 4.17 million.
- Peak: 4.17 million × 3 = **12.5 million concurrent streams**.

**Bandwidth out.** Assume an average delivered bitrate of 3 Mbit/s across the
mix of phones at 480p and 720p and TVs at 1080p.

- Peak: 12,500,000 × 3 Mbit/s = **37.5 Tbit/s**. Average: 12.5 Tbit/s.
- Per day: 6 billion minutes × 60 seconds × 3,000,000 bits ÷ 8 = 1.35 × 10¹⁷
  bytes = **135 PB a day**, about **4.05 EB a month**.

**Views and playback starts.** Assume an average view lasts 6 minutes, so
6 billion ÷ 6 = **1 billion views a day**: about 11,600 a second on average
and 35,000 at peak. Each view starts with one call to the playback API.

**Segment requests.** Players fetch video in 4-second pieces (the second deep
dive explains why 4), and audio in pieces of the same length from its own
file, so each stream makes about 2 requests every 4 seconds:
12,500,000 × 2 ÷ 4 ≈ **6.25 million requests a second** at peak, all served
by the CDN.

**Uploads.** Assume the typical upload is 1080p at 10 Mbit/s, the ballpark of
a phone recording.

- Original size: 10 Mbit/s × 600 seconds ÷ 8 = **750 MB** per 10-minute video.
- Uploads: 500,000 ÷ 86,400 ≈ 5.8 a second, 17 at peak.
- Bytes in: 500,000 × 750 MB = 375 TB a day, about 34.7 Gbit/s on average and
  **104 Gbit/s at peak**.

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
  same as the original.
- Per 10-minute video: 10.528 Mbit/s × 600 ÷ 8 ≈ **790 MB** of renditions.
- Per day: 500,000 × 790 MB ≈ 395 TB of renditions, plus 375 TB of originals:
  **770 TB a day**.
- Per year: 770 TB × 365 ≈ **281 PB** (137 PB originals, 144 PB renditions).
  Over five years, about **1.4 EB**.

**Transcoding compute.** Encoding cost grows with pixel count. Assume the whole
H.264 ladder costs about 5 core-seconds per second of video (one CPU core busy
for 5 seconds): about 2.8 for 1080p, 1.2 for 720p and 1.0 for the three lower
rungs together.

- Video uploaded per day: 500,000 × 600 seconds = 300 million seconds.
- Core-seconds: 300,000,000 × 5 = 1.5 billion a day.
- Average: 1,500,000,000 ÷ 86,400 ≈ 17,400 cores busy; peak 52,000.
- Run at no more than 70% busy, so a queue doesn't build at every burst:
  52,000 ÷ 0.7 ≈ **75,000 cores at peak**, about 1,200 machines of 64 cores,
  scaled down overnight.

**Events.** Players report progress with a **heartbeat** every 30 seconds
while playing: 12,500,000 ÷ 30 ≈ **417,000 events a second** at peak, about
83 MB a second at 200 bytes each.

**Metadata.** 500,000 videos a day for five years is 912.5 million videos. At
about 2 KB each for the video row and its rendition rows, that is
**1.8 TB**.

What the estimates say: the metadata is small and the request rates for it are
modest. The bytes are enormous in both directions that matter: 1.4 EB kept
over five years, and 4 EB a month sent to viewers. Nearly every decision below
is about paying for fewer of those bytes, or paying less for each.

## Data model

**Video bytes** live in an **object store**: a service that keeps blobs of
bytes under string keys, with put, get, get-a-byte-range and delete, but no
queries or edits in place. It is cheap per byte, scales to exabytes, and keeps
its own redundant copies across machines and buildings. Per video:

```text
originals/v9Qx.mp4                     the file as uploaded
v/v9Qx/h264_240p.mp4 … h264_1080p.mp4  one file per video rendition
v/v9Qx/audio.mp4                       the audio rendition
v/v9Qx/h264_720p.m3u8 …                one playlist per rendition
v/v9Qx/master-2.m3u8, master-2.mpd     manifests listing the renditions
thumbs/v9Qx/…                          thumbnail candidates and seek previews
```

No file is ever overwritten, so nothing a CDN has cached goes stale (deleting
a video or making it private purges it, as the CDN deep dive describes). A
rendition, once written, keeps its name (a re-encode would get a new one). The
top-level manifests are the only files whose content has to change, when the
1080p rung finishes or a second codec is added, so each change writes a new
one under the next **manifest version**: `master-1` lists the rungs up to
720p, `master-2` adds 1080p.

**Metadata** lives in a relational database: 1.8 TB and at most a few hundred
writes a second fit one primary (the copy that takes writes) with read-only
copies of it (**replicas**), and status changes need conditional updates that a relational
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

`status` moves forward only. `ready`, `failed` and `deleted` are **terminal**:
no update ever moves a video out of them, except that `failed` and `ready` can
go to `deleted`, and `failed` can go back to `processing` when an operator
replays the video (the pipeline deep dive). Every status write is conditional on the status it expects to
replace, which is what makes a retried or late write harmless (the pipeline
deep dive).

**Watch progress** is one row per viewer per video, in a wide-column store:
rows are grouped under a partition key, here `user_id`, and spread across
machines by that key, so all of one viewer's rows sit together.

```text
watch_progress   user_id (partition key), video_id, position_s, duration_s
                 capped at the 500 most recent videos per user
```

Assume 300 million people watch in a month; at about 60 bytes a row, 300
million × 500 × 60 bytes = 9 TB, spread over a small cluster.

**View counts** are one counter per video, plus one row per event-log
partition recording how far that partition has been counted:

```text
view_counts      video_id PK, total
count_offsets    partition PK, next_offset
```

The last deep dive explains why they sit in the same database, sharded by the
same key.

## API design

**Upload.** Uploads use the same mechanics as
[cloud file storage](/system-design/file-storage): the bytes go straight from
the creator's device to the object store on **presigned URLs** (upload
addresses the API signs so the object store can check them on its own), in
parts, so an interrupted upload resends only the parts it lost. The API
servers never carry video bytes.

```http
POST /videos
Authorization: Bearer <session-token>
Idempotency-Key: 0c9d…

{ "title": "Fixing a bike chain", "size": 750000000, "filename": "IMG_0412.MOV" }
```

`Bearer` is the standard word in front of a token and means the request is
allowed for whoever holds (bears) it. The response creates the video in status
`uploading` and an upload session split into parts of 16 MiB (16,777,216
bytes, about 16.8 MB): 750 MB ÷ 16.8 MB ≈ 45 of them (the last one short):

```json
{ "video_id": "v9Qx", "upload_id": "up_31", "part_size": 16777216, "parts": 45 }
```

```http
POST /uploads/up_31/part-urls   { "parts": [1, 2, 3, 4] }  → one presigned PUT URL per part
GET  /uploads/up_31             → which parts the object store has received
POST /uploads/up_31/complete    → 202 Accepted, status processing
```

A client that lost its connection calls `GET /uploads/up_31`, asks for URLs
for the missing parts, and carries on. `complete` asks the object store to
join the parts into `originals/v9Qx.mp4`, then starts processing (the
architecture walkthrough follows exactly how, and what happens on a crash at
each step). The `Idempotency-Key` on `POST /videos` means a creator's app that
retries after a timeout gets the same video back instead of a second one;
[idempotency](/systems-and-infrastructure/idempotency) covers the mechanism.

`GET /videos/v9Qx` returns the metadata and status, which the creator's app
polls while the video processes.

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
change. `token` is present only for private and unlisted videos: a signed,
short-lived pass the CDN checks before serving anything, which is not part of
the cache key, so one cached copy still serves every viewer allowed to see it.
The player then fetches the manifest and segments from the CDN, never from the
API servers.

**Events.** The player batches its events and sends them every 30 seconds, and
at once when the viewer pauses, seeks or closes the player:

```http
POST /events
{ "session": "s_8f2a", "events": [
  { "type": "view", "video_id": "v9Qx", "view_id": "s_8f2a:v9Qx" },
  { "type": "progress", "video_id": "v9Qx", "position_s": 342, "reason": "heartbeat" }
] }
```

A `view` event is sent once per playback session, after 30 seconds of play
(an assumption for what counts as a view), and `view_id` names that session
and video so a resent batch can be recognized.

## High-level architecture

![Architecture of the video streaming service. Clients call the API servers for uploads, metadata, play requests and events, upload parts directly to the object store, and fetch manifests and segments from CDN edges. Edge misses go to the origin shield, and shield misses read from the object store. The API servers read and write the metadata database and read the progress and counts stores. An outbox row in the metadata database starts a job in the workflow engine, which sends encode and package tasks to the transcode workers and writes status back to the metadata database. Transcode workers read originals from and write renditions to the object store. The API servers append view and progress events to the event log, and stream workers consume it and write to the progress and counts stores.](/diagrams/video-streaming/architecture.svg)

The **API servers** are stateless and never touch video bytes; a load balancer
in front of them, which spreads requests across them, is left out. The
**metadata DB** has a cache in front for play requests, since a video's play
information rarely changes. The **workflow engine** and **transcode workers**
are the first deep dive, the player's side the second, **CDN edges** (caches
close to viewers) and the **origin shield** (a few large regional caches behind
them) the third, and the **event log**, **stream workers** and the stores they
fill the last.

Following one upload, `IMG_0412.MOV`, to its first viewer:

1. The creator's app calls `POST /videos`, uploads 45 parts to the object
   store, and calls `complete`.
2. The API server asks the object store to assemble the parts, then, in one
   transaction on the metadata DB, sets the video to `processing` and inserts
   an outbox row, "start processing v9Qx".
3. A relay reads the outbox and starts a workflow whose ID is the video ID.
4. The workflow probes the original, fans out encode tasks for 10 one-minute
   pieces × 5 rungs, plus audio and thumbnails, then packages the renditions.
   When 240p to 720p are packaged, it sets the video to `playable`; when
   1080p is done, to `ready`.
5. A viewer's player calls `GET /videos/v9Qx/play`, gets the manifest URLs and
   a resume position, and fetches the manifest and segments from its nearest
   CDN edge. The edge misses (nobody near it has watched this video yet),
   asks the shield, which misses too and reads from the object store.
6. The player sends heartbeats to `/events`, which the API servers append to
   the event log.

Steps 2 and 3 are the classic trap of writing to two systems. If the API server
wrote the status and then called the workflow engine directly, a crash between
the two would leave a video stuck in `processing` with no job. Writing the
"start" request as an outbox row in the same transaction as the status is the
[outbox pattern](/systems-and-infrastructure/outbox-pattern): the transaction
either records both or neither, and the relay keeps trying until the engine has
the job. Crash by crash:

- **During the part uploads:** the client resumes from `GET /uploads/up_31`.
- **After assembling the parts, before the transaction:** the client's retry of
  `complete` finds the original already at its key (the API server checks for
  it before asking the object store to assemble again) and runs the
  transaction. If the client never retries, a sweeper that looks at upload
  sessions past their expiry finds the assembled original and finishes the
  same way.
- **After the transaction, before the relay starts the workflow:** the row is
  still unsent, so the relay starts it on its next pass.
- **After the workflow starts, before the relay marks the row sent:** the relay
  starts it again, and the engine refuses a second workflow with the same ID.
  This design needs an engine that treats workflow IDs as unique, which is a
  common feature.

## Deep dive: the upload and transcoding pipeline

**One encode per rung, or many small ones.** The simplest pipeline gives each
rung to one task, which encodes the whole video. A task gets 4 cores (encoders
use several threads, with diminishing returns beyond a handful). For a
10-minute video, 720p takes 600 × 1.2 ÷ 4 = 180 seconds and 1080p 600 × 2.8 ÷ 4
= 420 seconds, which is fine. For a one-hour video, 720p takes 3,600 × 1.2 ÷ 4
= 1,080 seconds, 18 minutes, and 1080p 42 minutes. Any video longer than about
16 minutes (300 seconds × 4 cores ÷ 1.2) misses the 5-minute target at 720p,
and a 6-hour upload would hold four cores for over four hours at 1080p.

The alternative splits the video in time. Each rung is encoded as 60-second
pieces, each piece a separate task, run in parallel and joined afterwards. A
1080p piece takes 60 × 2.8 ÷ 4 = 42 seconds and a 720p piece 18 seconds,
whatever the video's length, given enough free workers: an hour-long video is
60 pieces × 5 rungs = 300 tasks, 1,200 cores for under a minute out of the
75,000. That is how the 5-minute target holds for long videos.

Splitting has costs of its own:

- **Cutting exactly.** A compressed video can only be decoded starting from a
  **keyframe**, a frame stored whole rather than as changes from the frames
  before it. The upload's keyframes are wherever the phone put them. So a
  first **probe** task reads the original's index (duration, codecs and every
  keyframe's position). Each piece task then fetches, by byte range, from the
  last keyframe before its start time (about 75 MB for a minute at
  10 Mbit/s), decodes forward, throws away the frames before its exact start,
  and encodes from there. No split copy of the original is ever written.
- **Aligned output.** Every rung is encoded with a keyframe forced exactly
  every 4 seconds, and each piece is 15 of those intervals. Segment boundaries
  then fall at the same instants in every rendition, which the player's
  switching depends on (the next deep dive).
- **Quality at the seams.** Each piece's encoder decides on its own how to
  spend its bits, so quality can shift slightly at a piece boundary. Giving
  every piece the same bitrate target and cap keeps that small.
- **Audio** is encoded as one task over the whole track; audio is cheap, and
  cutting it risks audible clicks at the joins.
- **More to track.** A 10-minute video becomes 50 encode tasks, plus audio,
  thumbnails and packaging: 500,000 uploads × about 52 tasks = 26 million tasks
  a day, 300 a second on average and 900 at peak.

This design splits. **Packaging** afterwards is cheap: it rewrites timestamps
so the pieces play as one stream and writes each rendition's pieces into one
file with the manifests (the next deep dive), copying the encoded data rather
than encoding it again. **Thumbnails** come from a task that decodes one frame
every few seconds: a handful of candidates for the creator to choose from, and
a grid of small frames the player shows while the viewer drags the seek bar.

**Who keeps track.** A video's processing is a small process: probe, fan out,
wait for all 50 pieces, package the low rungs, mark it playable, package
1080p, mark it ready, retry anything that fails. Two ways to run it:

- **Chain queues by hand.** Each worker, when done, updates a row and, if it
  finished the last piece of a rung, enqueues packaging. That needs a progress
  table, a finished-piece count that concurrent workers update safely, a
  sweeper for videos stuck halfway and retries at every step: a small
  [workflow engine](/systems-and-infrastructure/workflow-engines) written by
  hand.
- **A workflow engine.** The job is written as code (`probe`, then these tasks
  in parallel, then `package`…), and the engine records each step's result
  durably, so a crash or deploy resumes the job where it was. The cost is one
  more system to run, whose store records 900 task starts and completions a
  second at peak, a few thousand small writes, well within one relational
  database.

This design uses an engine. Its tasks go onto a task queue served by the
transcode workers, a
[worker pool](/systems-and-infrastructure/worker-pools) sized close to its
core count because encoding is CPU-bound. Two task queues, two priorities: the
rungs up to 720p, audio and packaging of new uploads go first, 1080p and
everything else after. At peak, when the pool is fully busy, what waits is
1080p work, which has a 30-minute target, rather than the first playable
version. The pool is scaled on the age of the oldest waiting high-priority
task, since that is what a creator waits for.

**Leases and late finishers.** A worker holds a **lease** on its task, a claim
it renews every 15 seconds; after 60 seconds of silence the engine hands the
task to another worker. That reruns a crashed worker's task, and it has the
failure mode [distributed locks](/systems-and-infrastructure/distributed-locks)
warns about: a worker that was only paused (a long garbage-collection pause, a
network partition) wakes up and reports a result for a task another worker is
already redoing. The fence is the attempt number:

- Each attempt writes its output to its own key,
  `work/v9Qx/h264_720p/piece-07.attempt-2.mp4`, never over another attempt's.
- The engine keeps each task as `pending`, `running (attempt n)`, `done
(output key)` or `failed`. A completion is accepted only if the task is
  `running` with the same attempt number, and it moves the task to `done`
  with that attempt's key in one conditional update. `done` and `failed` are
  terminal, so a late completion from attempt 1 is rejected, and packaging
  reads only the recorded key.
- The engine's store is a relational database with one primary, so that check
  is a single-row conditional update on one machine. (On a store where any
  replica takes writes, it would need a consensus round per completion.)
- Rejected attempts' outputs are orphans, deleted by an object-store rule that
  removes anything under `work/` after 7 days.

Status writes to the metadata DB are retried steps too, so each is
conditional: `playable` only if the video is `processing`, `ready` only if it
is `processing` or `playable`. A retry that finds the video already `ready`
does nothing, and a video deleted mid-processing fails the next status write;
the workflow sees that, cancels its remaining tasks and deletes what it wrote.

A task that fails three times goes to a
[dead-letter queue](/systems-and-infrastructure/dead-letter-queue) instead of
being retried forever. The usual cause is a **poison** upload, one the encoder
can't parse, which would otherwise keep crashing workers. Before the video is
`playable`, the workflow then marks it `failed`; once the cause is fixed, an
operator replays it, which sets it back to `processing` (only if it is still
`failed`) and starts a new workflow run under a fresh ID. A failure in 1080p
or later work after `playable` leaves the video playable and raises an alert,
rather than marking it failed.

![Flow of one upload through processing. The original in the object store is probed for duration, codecs and keyframes. The probe fans out encode tasks, one per piece and rung, run on the transcode workers, plus an audio task and a thumbnails task. When the 240p to 720p pieces and the audio are done, they are packaged and the video is marked playable. When the 1080p pieces are done, they are packaged too and the video is marked ready. A task that fails three times goes to the dead-letter queue. Once a ready video passes 1,000 views, an AV1 ladder is encoded for it.](/diagrams/video-streaming/transcode-pipeline.svg)

**How long the first playable version takes.** A 10-minute upload at quiet
times: the relay picks up the outbox row within a second or two, the probe
reads the original's index in seconds, the 720p pieces take about 18 seconds
each in parallel (the lower rungs less), and packaging copies about 415 MB
(the four lower rungs and audio: 5.528 Mbit/s × 600 ÷ 8 ≈ 415 MB). Well under
two minutes. At peak, time waiting in the high-priority queue is what eats the
rest of the 5 minutes, which is why that queue's age is the scaling signal.

## Deep dive: segments, manifests and adaptive bitrate

A player can't download a 790 MB video before playing it, and shouldn't
commit to one bitrate at the start: the viewer's connection changes minute to
minute. **Adaptive bitrate streaming** (ABR) solves both. Each rendition is
cut into short **segments** that each start with a keyframe, so each can be
decoded on its own, and a **manifest** lists the renditions and their
segments. The player downloads segments one after another and chooses, before
each one, which rendition to take it from. Because the keyframes are aligned
across rungs, segment 79 of 720p follows segment 78 of 480p seamlessly.

**HLS or DASH.** Two manifest formats dominate. **HLS** (HTTP Live Streaming)
uses `.m3u8` text playlists and is the format Apple's devices play natively;
**DASH** uses an XML manifest (`.mpd`) and is widely used by players
elsewhere. Both can point at the same segment files if the segments are
**CMAF**, a common fragmented-MP4 format, so the design stores the video once
and writes two small manifests. The HLS top-level playlist lists the rungs:

```text
#EXTM3U
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="aud",NAME="English",DEFAULT=YES,URI="audio.m3u8"
#EXT-X-STREAM-INF:BANDWIDTH=1600000,RESOLUTION=854x480,CODECS="avc1.4d401e,mp4a.40.2",AUDIO="aud"
h264_480p.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=3100000,RESOLUTION=1280x720,CODECS="avc1.4d401f,mp4a.40.2",AUDIO="aud"
h264_720p.m3u8
```

(The other rungs follow the same pattern.) `BANDWIDTH` is the rung's peak
bitrate, audio included, in bits per second. Each rung's own playlist lists
its segments:

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
starting at byte 1,234; about 2.8 Mbit/s × 4 s ÷ 8 = 1.4 MB), rather than a
file of its own. The storage deep dive shows what that saves. The `MAP` line
points at the file's header, which the player needs once per rendition.

**How long a segment.** Shorter segments let the player react sooner and start
sooner, since the first segment arrives faster. They also mean more requests
and more keyframes, which are large and cost compression efficiency. At peak:

- **2 seconds:** 12,500,000 × 2 ÷ 2 = 12.5 million requests a second to the
  CDN (a video and an audio segment each interval), with a keyframe every 2
  seconds.
- **4 seconds:** 6.25 million a second. The first 480p segment is
  1.4 Mbit/s × 4 = 5.6 Mbit, 1.1 seconds to download at 5 Mbit/s, and the
  first audio segment, 0.128 × 4 ≈ 0.5 Mbit, about 0.1 seconds more.
- **6 seconds:** 4.2 million a second, but that first segment is 8.4 Mbit, 1.7
  seconds at 5 Mbit/s, which leaves almost nothing of the 2-second start-up
  budget for the round trips before it.

This design uses 4 seconds, which fits the start-up target with room for the
play API call, the master and media playlists, and the init segments, fetched
in parallel where possible, and halves the request rate of 2.

![Sequence of the first playback of v9Qx, resuming at 312 seconds. The player asks the play API for the video and gets the manifest URL, a token and the resume position. It fetches the master playlist, master-2.m3u8, from the CDN edge and gets the list of rungs, then fetches the 480p playlist, h264_480p.m3u8, and gets the byte range of each of that rung's segments. It then asks the edge for 480p segment 78. The edge misses and asks the origin shield, which also misses and reads that byte range from the object store; the shield caches it and returns it to the edge, which caches it and returns it to the player. The player measures about 9 Mbit/s with 4 seconds buffered and asks the edge for 720p segment 79, which the edge returns (on a miss, fetched the same way as segment 78).](/diagrams/video-streaming/playback-sequence.svg)

The sequence above is one start-up. The resume position, 312 seconds, is
segment 312 ÷ 4 = 78 (counting from 0), so the player starts there, at a
conservative 480p, and decides the next rung once it has measured something.

**Choosing the rung.** Three kinds of rule are in common use:

- **Throughput-based.** Estimate the connection's speed from how fast recent
  segments downloaded, as the lower of a fast and a slow average (or the last
  segment's throughput), so a collapse registers at once while a single fast
  segment can't push the choice up. Take the highest rung whose bitrate is
  under, say, 80% of that. At 9 Mbit/s that allows 7.2 Mbit/s: 1080p. It
  starts well, since it needs only a segment or two of measurements. It
  learns of a collapse only once a slow segment has finished downloading, and
  it flip-flops between rungs on a connection whose speed varies around a
  threshold.
- **Buffer-based.** Ignore measured speed and look at how many seconds of
  video are downloaded but not yet played. Under 8 seconds, take the lowest
  rung; above 30, the highest; in between, step up with the buffer. The buffer
  is a direct measure of whether the player is keeping up, so this avoids
  stalls well and switches less, but at start-up the buffer is empty and it
  plays the lowest rung for the first half-minute.
- **Hybrid.** The throughput estimate, the lower of the two averages, decides
  at start-up and caps the choice at all times;
  the buffer decides when it is safe to step up, and only one rung at a time,
  which is why the player in the sequence above goes from 480p to 720p rather
  than straight to 1080p.

A worked case: a viewer on a train watching 1080p with 24 seconds buffered
enters a tunnel, and throughput falls from 10 to 1.5 Mbit/s. A 1080p segment
is 5.0 × 4 = 20 Mbit and now takes 20 ÷ 1.5 ≈ 13.3 seconds to download, while
the buffer plays down by 13.3 seconds and gains only 4: after one such
segment 24 − 13.3 + 4 ≈ 14.7 seconds are left, after the next about 5.4, and
the third stalls. A throughput rule notices after the first slow segment,
since its fast average falls to about 1.5 Mbit/s: 80% of 1.5 is 1.2 Mbit/s, so 360p (0.8 Mbit/s, 3.2 Mbit a segment, 2.1
seconds to download), and the buffer grows by about 1.9 seconds per segment
from then on. A buffer rule would also have dropped, since 14.7 seconds is in
its lower range. The hybrid gets the drop from the throughput cap and, when
the train leaves the tunnel, climbs back one rung per segment only while the
buffer keeps growing, so it neither stalls nor flip-flops on the way back up.

This design ships the hybrid in its players. The service's influence over it
is the ladder itself (rungs close enough together that a step is a small
change in quality) and the segment length.

## Deep dive: delivery through the CDN

At 37.5 Tbit/s, no single data center could send the bytes, and a viewer in
Jakarta fetching from a server in Virginia would wait 200 ms or more for every
request. A **CDN** (content delivery network) is a large set of caching servers
placed in many cities, grouped in **points of presence** (PoPs), each serving
the viewers near it. A viewer's requests go to a nearby PoP, by DNS (the internet's
directory from names to addresses) answering with a nearby address, or by many PoPs announcing the same address so that
the internet's routing delivers each packet to the closest one. The server that
answers is an **edge** cache: a hit is served from its disk or memory, and a
miss is fetched from further back.

**What sets the bill.** CDN delivery is billed per GB sent to viewers.
At this volume, assume a negotiated $0.005 per GB (list prices for small
customers are several times that): 4.05 EB a month is 4.05 billion GB ×
$0.005 = **about $20 million a month**. Every byte a viewer receives is paid
for once here whatever the cache does, so what the caches change is everything
behind the edge: the bytes read from the object store and sent across the
provider's network, billed as **egress** (bytes leaving the cloud) at an
assumed $0.02 per GB. And the edges' **hit ratio**, the share of bytes they
serve from cache, is what decides how much of that there is.

**Where the hits come from.** Popularity is lopsided: a small share of videos
takes most of the watch time, and every edge holds those. The long tail is the
problem: a video watched 20 times a day, spread over 20 PoPs, is requested once
per PoP per day, and by then its segments have usually been evicted to make
room for busier ones. Two ways to back the edges:

- **Edges fetch misses straight from the object store.** Simple. Assume edges
  hit 90% of bytes: the other 10%, 13.5 PB a day, is read from the object
  store, 405 PB a month × $0.02 = **$8.1 million a month** in egress, and each
  long-tail video is fetched once per PoP that asks for it.
- **A tier of regional shields between them.** A few dozen large caches, each
  serving the edges of a region. A long-tail video missed by 20 edges is
  fetched from the object store once and served to the other 19 from the
  shield. Assume the shields hit 80% of what reaches them: the object store
  sends 10% × 20% = 2% of bytes, 2.7 PB a day, **$1.6 million a month**. The
  cost is an extra hop on an edge miss (tens of milliseconds, paid once per
  segment per PoP) and the shields themselves.

This design uses the shield tier; it pays for itself several times over at
these assumptions, and it also absorbs bursts. When a video is released to an
audience waiting for it, thousands of edges miss on segment 0 within the same
second. Each shield **coalesces** those misses, sending one request for a
byte range to the object store and holding the rest until it answers; that is
the remedy the
[thundering herd problem](/systems-and-infrastructure/thundering-herd-problem)
describes. Segments never change (a rendition file is never overwritten), so
they are cached with a TTL (time to live) of a year and no update needs a
purge; the reasoning is the one in
[caching](/systems-and-infrastructure/caching). Deleting a video or making it
private does: the API servers send the CDN a purge by path prefix (`v/v9Qx/`),
which clears the edges and shields, and set a per-video flag in the CDN's
configuration that makes it require a token for that prefix. Whether a request
needs a token is decided by that flag, not by the cached copy.

**Pre-positioning.** Some demand is predictable: the next episode of a series
at its release time, or a video whose views in its first hour are climbing
fast in one region. Rather than let the first viewers at each edge miss during
the evening peak, a background job (left out of the architecture diagram)
pushes those videos' popular rungs to the
edges in the early morning, when the network is idle. It uses spare
off-peak capacity and costs a little edge storage for videos that turn out
less popular than predicted.

**Serving it ourselves** is the other way to cut that bill. At an assumed 40
Gbit/s per edge server run at most 70% busy, 37,500 Gbit/s ÷ 28 ≈ 1,340
servers at peak, spread over enough PoPs, plus network contracts: owned
hardware and a team instead of a per-GB bill. This design starts on commercial
CDNs and treats that as the step to take once the bill justifies it.

**Fewer bytes per view.** Every percent of bits saved is a percent of $20
million. Encoding a second ladder in AV1, which is commonly measured at 30% or
more fewer bits than H.264 for similar quality, is the biggest single lever.
Its cost is compute: assume AV1 takes ten times the H.264 core-seconds, 50 per
second of video, and plays only on the devices that can decode it, assumed to
be half of watch time.

- **AV1 for every upload:** 300,000,000 seconds × 50 = 15 billion core-seconds
  a day, about 4.2 million core-hours; at an assumed $0.02 per core-hour that is
  $83,000 a day, **$2.5 million a month**.
- **AV1 only once a video passes 1,000 views.** Assume 3% of uploads do, and
  they carry 70% of watch time. Compute: 3% of that, **$75,000 a month**.
  Saving: 70% × 50% × 30% = 10.5% of the delivery bill, **about $2.1 million a
  month**.
- What AV1 on the other 97% would add: 30% × 50% × 30% = 4.5% of the bill,
  $0.9 million a month, for $2.4 million more compute. Not worth it.

This design encodes AV1 for videos past the threshold, as a low-priority
workflow step that runs in the overnight trough (its average load is about
5,200 cores). A new manifest version then lists both ladders, and each player
takes the codec it can decode; the H.264 segments already in caches stay
valid, since their files haven't changed.

## Deep dive: storage tiers for the long tail

Five years of uploads is about 1.4 EB: 684 PB of originals and 721 PB of
renditions. At an assumed $0.02 per GB-month for the standard (hot) tier, all
of it hot is 1.4 billion GB × $0.02 ≈ **$28 million a month**. Most of those
bytes are rarely read. Object stores sell tiers priced for that, as
[cloud file storage](/system-design/file-storage) lays out: a **cold** tier
still answers in milliseconds but costs about $0.004 per GB-month, charges
about $0.03 per GB read and bills minimum storage periods, and an **archive**
tier costs about $0.001 per GB-month but can take hours to return anything.
Three policies:

**Everything hot.** $28 million a month by year five, and simple.

**Tier by use.**

- Originals are needed only to re-encode (a new codec, a new rung), so they
  go to archive 30 days after upload. Hot: 30 days × 375 TB = 11.25 PB, $0.2
  million; archive: the other 673 PB, $0.7 million.
- Renditions not read for 90 days go to cold. Assume 10% of rendition bytes
  were watched in the last 90 days: 72 PB hot is $1.4 million, and 648 PB cold
  is $2.6 million.
- Reads of cold renditions: assume one in ten bytes the shields fetch from
  the object store is cold, 0.27 PB a day, 8.1 PB a month × $0.03 ≈ $0.24
  million.
- Total: about **$5.2 million a month**, less than a fifth of all-hot.

**Tier, and delete the higher rungs of the coldest videos.** 1080p is 5.0 of
the ladder's 10.5 Mbit/s, so dropping it from videos unwatched for a year
would save roughly half of their cold bytes. The price lands on the rare
viewer: the video plays at 720p until a job restores the original from archive
(hours) and re-encodes it.

This design tiers by use and keeps every rung: deleting saves at most about
$1.2 million of the $2.6 million cold bill, at the price of a worse picture for
exactly the viewers who went looking for an old video. A cold rendition that is
read more than a few times in a week goes back to hot, with the shields
covering it meanwhile. An archived original needed for an AV1 encode takes
hours to restore, and the H.264 ladder serves until then.

**Why one file per rendition.** The HLS example in the previous deep dive
addresses segments as byte ranges of one file. Storing each segment as its own
object would work too, and is simpler to picture, but the number of objects
matters to the tiering bill. Moving an object between tiers costs about $0.02
per 1,000 objects, and cold tiers at some providers bill any object under
128 KB as if it were 128 KB:

- **One object per segment:** a 10-minute video has 150 segments in each of 6
  renditions (5 video, 1 audio), 900 objects. A year of uploads is 500,000 ×
  365 × 900 ≈ 164 billion objects, and moving 90% of them to cold is **about
  $3 million**. Every audio segment is 128 kbit/s × 4 s ÷ 8 = 64 KB, billed as
  128 KB in cold storage.
- **One object per rendition:** 6 objects per video, 1.1 billion a year, and
  moving 90% costs **about $20,000**. No object is under the minimum.

Most CDNs cache byte-range requests, so the edges and shields work the same
either way. This design keeps one file per rendition, because it makes tiering
nearly free per object.

## Deep dive: view counts and watch progress

Both come from the same events: 417,000 heartbeats a second at peak, plus
35,000 view events. Neither belongs on the **hot path**, the requests a viewer
waits on, so the API servers only append events to the event log and answer at
once. The event log is a **partitioned log**, a
[message queue](/systems-and-infrastructure/message-queues) that keeps events
in order within each of its partitions for a few days, where each consumer
records the **offset** (position) it has read up to and can re-read from an
earlier one. It holds two streams: progress events, split into partitions by
`user_id`, and view events, split by `video_id`. A slow or failed consumer means counts and positions lag;
playback carries on. Players also hold unsent events for a few minutes if
`/events` is down, so a short outage of the event path loses nothing.

**Watch progress.** Three ways to store it:

- **Write every heartbeat straight to the progress store:** 417,000 writes a
  second at peak, almost all of them about to be overwritten 30 seconds later.
- **Have players report only on pause and close:** almost no writes, but an
  app killed by the phone's operating system, or a TV switched off at the
  wall, never reports, and the viewer resumes from wherever they last paused,
  possibly an hour back.
- **Heartbeats to the log, coalesced by stream workers.** Because the progress
  stream is partitioned by `user_id`, one worker sees all of a viewer's events. It
  keeps the latest position per (user, video) in memory and writes it at most
  once every 2 minutes, and at once for a pause, seek or close event. At most
  12,500,000 ÷ 120 ≈ **104,000 writes a second** at peak, a quarter of the
  first option, while a killed app still loses at most one heartbeat interval.

This design coalesces, using the technique
[batching and asynchronous writes](/systems-and-infrastructure/batching-and-asynchronous-writes)
describes: fewer writes in exchange for positions that reach other devices up
to 2 minutes late, which the requirements allow, and immediately after a normal
pause or close.

Two things could move a position backwards: a crashed worker replaying events
from its last committed offset (it commits an offset only once every event
before it has been written, so replays happen), and a viewer watching on two
devices. Both are settled by time. The API server stamps each event with the
time it received it, and the worker writes each position with that timestamp
as the write's own. The progress store is chosen for this: it keeps, of two
writes to the same cell, the one with the higher timestamp, and lets the
writer supply it (Cassandra's `USING TIMESTAMP` does both). A replayed older
position loses to the newer one already stored, and of two devices the one
that reported last wins, with no read before the write. A player sends its
next batch only once the last was acknowledged, so a resent batch can't be
stamped later than a newer one from the same device.

**View counts.** The requirement is a count that lags by minutes and is never
inflated by retries. Options:

- **Increment the video's counter on every view:** 35,000 writes a second,
  and a video that is being watched by a million people at once puts
  thousands of them on one row, which then limits how fast that one video can
  be counted.
- **Aggregate in the stream workers and write totals in batches.** The view stream
  has 256 partitions, each video's events always in the same one. A worker adds up views per
  video in memory for 10 seconds, then applies the sums. At peak each
  partition carries 35,000 × 10 ÷ 256 ≈ 1,400 views per batch, so one busy
  video costs one write per batch, not thousands.

This design aggregates. The trap is the replay: a worker that applies its
batch and dies before recording its offset re-reads the same events on
restart and adds them again, since "add 1,400" is not
[idempotent](/systems-and-infrastructure/idempotency). So the counts store is
a relational database split across several databases, each a **shard**, by
the same partition number as the view stream, and each batch is one transaction on one shard: add each video's sum, and advance
`count_offsets` for the partition from the batch's start offset to its end,
only if it still holds the start offset. A replayed batch finds the offset
already advanced, and the transaction does nothing. On start, and whenever a
batch's conditional update is rejected, the worker reads `next_offset` for its
partition from the counts shard and seeks the log there, so the counts shard,
not the log's committed offset, is the source of truth for where counting
resumes. Between the log and the counters, then, each event counts once.

That leaves duplicates from the player: a batch resent because the response to
`POST /events` was lost. Each worker remembers the `view_id`s of the last 10
minutes (after a restart, by re-reading 10 minutes of the log before the
offset it resumes from) and drops repeats. A resend more than 10 minutes late counts
twice, which "not exact to the view" allows. Filtering out bots is a separate
stage, out of scope.

## Failure modes and bottlenecks

**A transcode worker dies or stalls.** Its lease runs out after 60 seconds and
the task reruns as the next attempt; a stalled worker that finishes late is
refused by the attempt check and its output is cleaned up with the rest of
`work/`. The cost is one piece's encode time, under a minute. Worker machines
can therefore be cheap interruptible (spot) capacity, which cloud providers
sell at a large discount on the understanding that they may take it back.

**A burst of uploads.** A creator event or a holiday can push uploads well
past the 3× peak. The queues absorb it: the high-priority queue's age rises,
the pool scales on that age, and 1080p and AV1 tasks wait. If the pool can't
grow fast enough, the creator-facing target slips before anything else does.
The upload API can refuse new uploads with `503` and a retry time when the
queue's age passes an hour, the kind of limit
[backpressure](/systems-and-infrastructure/backpressure) describes, rather
than accept work it knows it can't finish on time.

**An edge PoP goes down.** Its viewers are routed to the next-nearest PoP,
whose cache holds that region's popular videos only partly. Its hit ratio drops
and the shield behind it takes the extra misses, which is part of what the
shields are sized for. Players see a slower segment or two and step down a
rung; the buffer covers the switch.

**The object store's region is unavailable.** Edges and shields keep serving
what they hold, which by the hit ratios above is 98% of bytes: popular videos
play on, and long-tail videos that aren't cached fail to start. Uploads and
processing stop. Replicating hot renditions to a second region would cover the
long tail too, at the cost of paying for those 72 PB twice; this design
replicates only the metadata and accepts the long-tail gap, a trade to revisit
if outages prove more frequent than the availability target allows.

**The metadata DB is down.** Plays of videos whose play information is cached
keep working; other plays, uploads and status changes fail until a replica is
promoted. (The event path falling behind, by contrast, only delays positions
and counts.)

**Knowing any of this is happening.** The numbers that describe the viewer's
experience come from the players themselves: time to first frame, rebuffering
ratio and average delivered bitrate, broken down by CDN, PoP, region and
device, because a problem at one internet provider looks like nothing in the
global average. Behind them: edge and shield hit ratios, object-store egress,
high-priority queue age, dead-letter arrivals, and lag between the event log
and its consumers. [Observability](/systems-and-infrastructure/observability)
covers how metrics, logs and traces divide that work.

## Trade-offs

- **Parallel pieces over one encode per rung.** A one-hour video's 720p takes
  under a minute of encoding instead of 18, paid for with 5 tasks per minute of video, a
  probe step, and small quality seams at piece boundaries.
- **A workflow engine over hand-chained queues.** Crash recovery, retries and
  fan-out come built in; the price is another system to operate, and
  idempotent steps are still the job's own responsibility.
- **4-second segments.** Start-up fits in 2 seconds, and requests are half what
  2-second segments would cost. A player on a collapsing connection learns of
  it a segment later than it would with 2 seconds.
- **A shield tier.** It cuts object-store egress from about $8.1 million a
  month to $1.6 million and absorbs release-day bursts, in exchange for another
  cache layer and an extra hop on every edge miss.
- **AV1 only for popular videos:** $2.1 million a month saved for $75,000 of
  compute; the long tail stays H.264-only and costs slightly more per view.
- **Tiered storage, no deleted rungs.** $5.2 million a month instead of $28
  million, with retrieval fees and slower first reads for old videos, and hours
  to restore an original for re-encoding.
- **Coalesced progress, batched counts.** A quarter of the progress writes and
  one counter write per video per batch; positions can trail by 2 minutes and
  counts by a little more, and a very late resend can count one view twice.

What would change the design: live streaming would rebuild the pipeline around
a latency budget of seconds, with segments encoded as they arrive and
manifests updated continuously rather than written once. A catalog of a few
thousand licensed titles instead of a billion uploads would flip the storage
and delivery sections, since everything would be popular: the whole catalog
could be pre-positioned at every edge overnight, and spending more compute per
title on encoding would pay back on every view.
