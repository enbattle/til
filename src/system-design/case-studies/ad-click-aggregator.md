---
title: Design an Ad Click Aggregator (like an ad network's click reporting)
summary: Counting a billion ad clicks a day per ad and per minute, each click once, with late events, a daily batch that settles billing, and a live list of the most-clicked ads.
date: 2026-09-29
order: 13
---

When someone clicks an online ad, the click usually goes first to the ad
network's own server, which records it and then redirects the browser to the
advertiser's page. Those records become two products. Advertisers watch a
**dashboard** showing clicks per ad, minute by minute, and they are **billed**
per click, so the same numbers are also money. An **aggregator** is the
system in between: it turns a stream of individual click events into counts
per ad per minute, and here also into a live **top-K** list, the K ads with
the most clicks in a recent window (K = 100 below).

The product fits in a sentence; the difficulty is in the word "once". Clicks
arrive twice, arrive late, or arrive while a server is restarting, and a
count that is off by a few percent is an overcharge or a refund. What follows
is one plausible design for this kind of pipeline, not a description of how
any particular ad network builds theirs.

## Requirements

Functional requirements:

- **Record clicks.** A click on an ad hits a click endpoint, which records it
  and redirects the browser to the ad's landing page, the page the advertiser
  chose.
- **Counts per ad per minute.** For any ad, return clicks per minute (or summed
  per hour or day) over a time range. Counts are shown as **provisional**
  within a minute of the click, and become **final** once the day is settled.
- **Billing.** Each day, produce final click counts per ad for the previous
  day, which the billing system charges from.
- **Deduplication.** An ad shown once can be billed for at most one click. Each
  time an ad is shown (an **impression**), the ad server gives it a unique ID,
  and every click on that impression carries the ID, so a double-click, a
  reload or a retried request is counted once.
- **Top-K.** The 100 most-clicked ads over the last complete minute, the last
  5 minutes and the last 60 minutes, refreshed every 15 seconds.
- **Breakdowns (optional).** Counts by country or device type, from fields the
  click event already carries.

Out of scope: serving ads and running the auction that picks them, counting
impressions (the same pipeline shape, with bigger numbers), click-fraud
detection beyond deduplication, budgets and spend pacing (they consume these
counts), and matching clicks to purchases.

Non-functional requirements:

- **Scale:** 1 billion clicks a day across 10 million live ads.
- **Freshness:** a click appears in the provisional counts and the top-K lists
  within 60 seconds at the 99th percentile (p99, the time 99% of clicks beat).
- **Redirect latency:** recording the click adds under 20 ms at p99, measured
  at our servers.
- **Accuracy:** final counts include every valid click that reaches the
  pipeline by 04:00 UTC the next day, each counted once. A click on an
  impression more than 24 hours old isn't billable. Clicks that arrive after
  the cutoff aren't billed.
- **Availability:** the click endpoint 99.99%, since a failed redirect loses
  the advertiser a visitor; dashboards and the top-K API 99.9%.

## Back-of-the-envelope estimates

A day is 86,400 seconds. Two rules of thumb from
[numbers every engineer should know](/engineering-practices/numbers-every-engineer-should-know):
one million events a day is about 12 a second, and plan for a peak of ten
times the average.

**Click rate.**

- Average: 1,000,000,000 ÷ 86,400 ≈ 11,574, about **12,000 clicks a second**
  (the rule of thumb gives 1,000 × 12 = 12,000).
- Peak: 10 × 11,574 ≈ 116,000, rounded up to **120,000 clicks a second**.
- Capacity target: **200,000 a second**, so the peak runs at 60% of what
  every tier can take (120,000 ÷ 200,000).

**Event size and volume.** A click event holds the click ID (16 bytes), ad and
advertiser IDs, a sub-key, three timestamps, country, device type and a hashed IP address;
with field names and framing, assume **250 bytes**.

- Per day: 1,000,000,000 × 250 bytes = **250 GB**.
- Into the queue at peak: 120,000 × 250 = 30 MB a second, or 90 MB a second
  across three replicas (copies of the data on different machines).
- Queue retention of 7 days: 250 GB × 7 × 3 replicas = 5,250 GB, about
  **5.3 TB**.
- Raw archive: assume 5× compression in a columnar file format, so 50 GB a
  day; kept 400 days for billing disputes, about **20 TB**.

**Distinct ads.** Requests and distinct items differ: 1 billion clicks don't
touch 1 billion ads. Assume an average of **200,000 distinct ads** clicked in
a given minute and **500,000** in the peak minute.

- Count rows (one per ad per minute with clicks): 200,000 × 1,440 minutes =
  **288 million rows a day**, so about 3.5 clicks per row.
- At about 50 bytes a row: 288,000,000 × 50 = 14.4 GB a day; minute rows kept
  90 days is about **1.3 TB**, with hourly sums kept longer.

**Aggregators.** Assume one aggregator process handles 20,000 events a second
(a deduplication lookup and a counter update each).

- At the 200,000 capacity target: **10 processes**; at the 120,000 peak each
  runs at 60%.
- The queue is split into **32 partitions**, independent ordered slices each
  read by one aggregator at a time, so the pool can grow to 32 processes
  (640,000 a second) without re-partitioning. At peak each partition carries
  120,000 ÷ 32 = 3,750 events a second.

**Deduplication memory.** Held for one hour of clicks (the first deep dive
explains why an hour):

- At peak: 120,000 × 3,600 = 432 million click IDs.
- At about 48 bytes each (the 16-byte ID, a timestamp and the index's
  overhead): 432,000,000 × 48 = 20.7 GB across the cluster, about **650 MB per
  partition**. This assumes a full hour at peak, so it is an upper bound.

**Writes to the counts store.** Aggregators flush changed counts every 15
seconds. A flush writes one row per (ad, minute) that changed, which at peak
is at most about the 500,000 ads clicked in a minute:

- 500,000 ÷ 15 ≈ **33,000 row writes a second** at peak, sent as 32 batched
  inserts per flush (one per partition), about 2 inserts a second.

What the numbers say: bandwidth and storage are modest. The hard parts are
counting 120,000 events a second exactly once without a per-click database
write, and keeping the provisional and final numbers in agreement.

## Data model

**Click event** (a message in the click queue, and a row in the raw archive):

```text
click_event
  click_id        string   impression ID, 128 bits, e.g. "c-9f2e..."
  ad_id           string
  advertiser_id   string
  impression_time timestamp  when the ad was shown
  event_time      timestamp  when the click server received the click
  ingest_time     timestamp  when the queue appended it (set by the queue)
  sub_key         integer    0, or 0–3 for a split hot ad (see Failure modes)
  country, device string
  ip_hash         string
  valid           bool       false if the token failed its checks
```

IDs are strings in every JSON payload: JSON numbers above 2^53 lose precision
in many parsers.

**Minute counts** (the counts store):

```text
ad_minute_counts
  advertiser_id   string   }
  ad_id           string   } key
  sub_key         integer  }
  minute          timestamp }
  clicks          integer   the absolute count for this ad in this minute
  version         integer   which write this is (see the first deep dive)
  final           bool      written by the daily batch
```

Dashboards ask two questions: one ad over a time range, and all of one
advertiser's ads over a range. Both are range scans over the leading part of
the key, then a sum. A **columnar analytics store** fits that: it stores each
column separately and compressed, so summing `clicks` over millions of rows
reads only that column, and it takes large batched inserts well. Such stores
prefer appending to updating, so every write is a new row carrying a
`version`, and reads take the highest version per key. ClickHouse's
ReplacingMergeTree engine, for example, keeps the highest-version row when it
merges rows with the same key in the background; until a merge runs, a query
has to pick the latest version itself.

**Top-K lists** (the top-K cache): one entry per window and partition, such as
`topk:5m:p17`, holding that partition's 100 highest-counted ads for the
window and the queue offset it was computed at.

**Deduplication and window state** lives inside each aggregator, per
partition, in an embedded on-disk key-value store, and is checkpointed with
the queue offsets (the first deep dive).

## API design

**The click endpoint.** Each ad's link carries a **click token**: the
impression ID, ad ID, advertiser ID and impression time, signed by the ad
server with an HMAC, a keyed hash that only holders of the secret key can
produce. A forged or edited token fails the check.

```http
GET /c/eyJpbXAiOiJjLTlmMmUi...

HTTP/1.1 302 Found
Location: https://shop.example.com/autumn-boots
```

It always redirects, even for a token that fails its checks or an impression
older than 24 hours, since the visitor did nothing wrong. Those clicks are
recorded with `valid: false` and never billed. The redirect is a `302` for the
reason given in [the URL shortener](/system-design/url-shortener): a cached
`301` would hide repeat clicks from us.

**Counts for one ad.**

```http
GET /v1/ads/ad-42/clicks?from=2026-09-28T12:00Z&to=2026-09-28T13:00Z&step=minute
Authorization: Bearer <api-key>

{ "ad_id": "ad-42",
  "points": [ { "minute": "2026-09-28T12:07Z", "clicks": 58, "final": false }, ... ] }
```

`step` is `minute`, `hour` or `day`, and each point says whether it is final.
The same shape exists per advertiser, at
`/v1/advertisers/{id}/clicks`, summed over their ads.

**Top-K.**

```http
GET /v1/top-ads?window=5m&k=100

{ "window": "5m", "as_of": "2026-09-28T12:08:15Z",
  "ads": [ { "ad_id": "ad-913", "clicks": 81204 }, ... ] }
```

`window` is `1m`, `5m` or `60m`; `k` is at most 100.

## High-level architecture

![Architecture of the ad click aggregator. A browser or app sends GET /c/{token} to the click servers, which answer with a 302. The click servers send click events to the click queue, which has 32 partitions. Stream aggregators read the queue and write versioned counts to the counts store and the top 100 per window to the top-K cache. An archiver copies the queue into files in the raw archive in object storage, which the daily batch reconciliation reads; it writes final counts to the counts store. The query API reads the counts store and the top-K cache; billing reads only final rows from the counts store.](/diagrams/ad-click-aggregator/architecture.svg)

The components:

- **Click servers** are stateless: any one can handle any click. They
  check the token, look up the landing page by ad ID (in a
  local cache, refreshed from the ad catalog), send the event to the queue and
  redirect.
- The **click queue** is a partitioned log, a
  [message queue](/systems-and-infrastructure/message-queues) that keeps
  messages in order within each partition and lets consumers re-read from any
  **offset** (a message's position in its partition). Events are routed to one
  of 32 partitions by a hash of `ad_id`, so all of one ad's clicks, and every
  duplicate of a click, land in the same partition;
  [partitioning](/systems-and-infrastructure/partitioning-vs-sharding) covers
  the general technique.
- **Stream aggregators** each own some partitions, dedupe and count their
  clicks, and flush every 15 seconds.
- The **archiver**, a second consumer of the queue, writes raw events to
  object storage as files, which **batch reconciliation** reads daily to write
  the final counts.
- The **query API** reads the counts store and the top-K cache; **billing**
  reads only rows marked final.

One click, `GET /c/eyJpbX...`:

1. The click server verifies the token's HMAC and the impression's age.
2. It sends the event to partition `hash(ad-42) mod 32` and waits for the
   queue to confirm that two of the partition's three replicas have it, a few
   milliseconds because the click servers and the queue share one data center
   (a cross-region wait of 50–150 ms would break the 20 ms budget).
3. It answers `302` with the landing page.
4. An aggregator reads the event, checks its click ID against the last hour of
   IDs, and adds 1 to `(ad-42, 12:07)`.
5. Within 15 seconds it flushes the new count to the counts store and its top-K
   lists to the cache.

The click server makes exactly one write per click, to the queue, so there is
no second store that can fall out of step with the first. If the queue can't
be reached, the server appends the event to a file on local disk, redirects
anyway, and a background sender forwards the file later; those events reach
the aggregators late, which the second deep dive handles. A server that dies
before it has written anything returns no redirect, and the browser's retry
carries the same click ID.

## Deep dive: counting each click once

Every step here delivers **at least once**: a sender that doesn't hear an
acknowledgment retries, so a message can arrive twice but isn't silently
dropped. Duplicates come from five places:

1. The user double-clicks or reloads: two requests, one impression ID.
2. The click server times out waiting for the queue and resends an event the
   queue had already stored.
3. The disk spool is forwarded again after a sender crash.
4. An aggregator crashes and re-reads events it had already counted.
5. After a partition is reassigned, the old owner, stalled but alive, keeps
   writing for a moment.

The first three put a second copy of the event in the queue, and are removed
by the click ID. The last two re-process a single copy, and are handled by how
the aggregator stores state and writes results.

**Dropping duplicate click IDs.** Three ways to remember which IDs have been
seen:

- **A unique constraint in a database.** Insert each click ID into a table
  with a unique key and count only if the insert succeeds. It is exact and
  simple, but it is a strongly consistent database write per click, 120,000 a
  second at peak and a billion rows a day, which is the per-click write this
  design exists to avoid.
- **A Bloom filter per partition.** A Bloom filter is a bit array that
  answers "possibly seen" or "definitely not seen" in a fixed amount of memory.
  For 432 million IDs at a 1% false-positive rate it needs about 9.6 bits per
  ID, about 520 MB in total, 40 times less than exact storage. But every false
  positive is a real click discarded as a duplicate: 1% of clicks, which the
  provisional counts would then undercount.
- **An exact set per partition.** Keep each ID seen in the last hour in the
  partition's local key-value store, expiring after the hour. That is the
  20.7 GB estimated above, about 650 MB per partition, mostly on local disk
  with the recent part in memory. Because the queue routes by `ad_id`, every
  copy of a click reaches the same partition, so the check never leaves the
  process.

This design uses the exact set. Its memory is affordable at these numbers, and
it keeps provisional counts close to final ones. The hour is the trade: retries,
resends and redeliveries arrive within seconds or minutes, so an hour catches
nearly all of them. A second click on the same impression three hours later is
counted by the stream, and removed by the batch, which applies the full
24-hour rule. That is one reason the provisional numbers can run slightly high.

**Surviving a crash without counting twice.** The aggregator's state (the
dedup set, the open minute counts and the top-K windows) is **checkpointed**
every 30 seconds: saved, together with the queue offset it reflects, to object
storage as one consistent snapshot. After a crash, the replacement loads the
latest snapshot and resumes reading from its offset, so it re-reads at most 30
seconds of events: 3,750 × 30 ≈ 112,500 per partition at peak, under half a
minute of work for a process holding three or four partitions. Snapshots are
incremental: only what changed since the last one is uploaded, so the 650 MB
dedup set isn't copied every 30 seconds.

Replaying those events rebuilds the same counts, but the store may already hold
the results of the first pass. What happens then depends on what the
aggregator writes:

- **Increments** ("add 3 to ad-42, 12:07") are small and let any number of
  writers share a row, but a replay adds the same 3 again. Making them safe
  means storing which increments were applied, an
  [idempotency](/systems-and-infrastructure/idempotency) record per write.
- **Absolute counts with a version** ("ad-42, 12:07 is 58, as of offset
  9,041") can be written any number of times. The version is the partition
  offset the count reflects, and the store keeps the highest version per key.
  A replay recomputes 58 at offset 9,041 and writes the same row again, which
  changes nothing.

This design writes absolute counts. It needs each row to have exactly one
writer, which the routing by `ad_id` already gives: one partition owns each
ad (or each sub-key of a split hot ad). It also needs replay to be **deterministic**, producing the same count at
the same offset every time. Anything that depends on the wall clock breaks
that, so every decision the aggregator makes about time (which minute a click
belongs to, whether it is too late) uses the event's own timestamp.

![Sequence of one click being counted once. The browser sends GET /c/{token} to a click server, which sends click c-9f2e to the click queue, gets an ack, and returns a 302 redirect. The aggregator reads offset 9,041, finds a new click ID and moves the count from 57 to 58, then writes ad 42, 12:07 = 58 at version 9,041 to the counts store. In a crash-and-replay box, the aggregator restores its checkpoint at 9,000, re-reads offsets 9,000 to 9,041, computes 58 again and writes the same row with version 9,041, which the counts store treats as the same version, with no change.](/diagrams/ad-click-aggregator/count-once-sequence.svg)

**Fencing the old owner.** The queue assigns each partition to one aggregator
through group membership that behaves like a lease: an aggregator that stops
sending heartbeats for, say, 10 seconds loses its partitions. A long garbage
collection pause can make a live process miss that deadline, and when it wakes
it may flush once more before learning it lost the partition.
[Distributed locks](/systems-and-infrastructure/distributed-locks) describes
this failure and the usual fix, a fencing token checked on every write. Here
the offset version is that token. The stalled process's counts are identical
to the new owner's at every offset, since both replay the same input, and the
store never lets a lower version replace a higher one, so the late write can't
move a row backwards. In the top-K cache, where each entry is one small key, a
short script on the cache node compares versions and sets the entry only if
the new offset is higher; a single cache node runs such a script atomically.

These writes are a second system beside the checkpoint, and no transaction
covers both. The usual fix for that, an
[outbox](/systems-and-infrastructure/outbox-pattern), isn't needed here,
because every write can be repeated safely: a crash between flushing and
checkpointing only means the next owner repeats the flush.

**What can still go wrong.** Duplicates beyond an hour reach provisional counts
(the batch removes them). An event on a click server's disk spool is lost if
that disk dies before forwarding. An event is lost if both queue replicas that
acknowledged it fail before a third copy exists. The counts are once per click
ID inside this pipeline. They won't match the advertiser's own visit counts,
since a visitor can click and close the tab before the landing page loads.

## Deep dive: late events and batch reconciliation

Each event has two times: its **event time**, when the click server received
it, and its **processing time**, when an aggregator reads it. They drift apart
whenever something upstream stalls: a spooled event forwarded 40 minutes late,
an aggregator catching up after a restart, click servers cut off from the
queue by a network fault. A click at 12:07 that arrives at 12:50 still belongs to 12:07.

A stream processor decides when a minute is done using a **watermark**, its
running estimate that no more events older than time T will arrive. Here each
partition's watermark is the largest event time seen in it minus 2 minutes,
computed from the events themselves, which keeps replay deterministic. Three
ways to treat an event behind the watermark:

- **Drop it.** Simple and bounded, but every stall becomes a permanent
  undercount in the stream, and a 40-minute network fault drops the 40
  minutes of clicks spooled behind it.
- **Wait.** Hold each minute open for, say, an hour before emitting it. Late
  clicks land in the right minute and each row is written once, but dashboards
  run an hour behind, far outside the 60-second requirement.
- **Emit early, then update.** Flush each minute's count every 15 seconds and
  keep its state for an hour of event time; a late event updates the count and
  the next flush rewrites the row. The cost is state for 60 open minutes per
  ad and rows that change after a dashboard first shows them.

This design emits and updates. With absolute versioned rows, an update is just
another write. Events more than an hour behind the watermark are left out of
the stream's counts and tallied in a "too late" metric; the batch counts them.

**Where the final numbers come from.** Three ways to split the work between
streaming and batch:

- **Batch only.** A job over the raw archive every hour or day. It is exact,
  easy to audit and easy to re-run after a bug fix, but dashboards would lag by
  at least an hour.
- **Stream only.** One pipeline, and a bug is fixed by replaying the queue
  through corrected code. Billing would then rest on the stream: the dedup set
  would have to span the full 24-hour billing rule (1 billion IDs × 48 bytes ≈
  48 GB at the daily average, before any peak), the queue would have to keep
  events long enough to replay a disputed period, and nothing would check the
  numbers independently.
- **Stream for provisional, batch for final.** The stream feeds dashboards and
  top-K; a daily batch recomputes billing from the archive. The cost is two
  implementations of the same counting rules, which can drift apart.

This design uses the third. Billing closes daily anyway, so the batch's delay
costs nothing where it matters, and the raw archive has to exist for disputes
regardless. To limit drift, both pipelines call one shared library for
validation, the dedup rule and minute bucketing, and every run compares the two.

**The daily job.** It starts after 04:00 UTC on day D+1, once the archiver's
recorded offset on every partition has passed events with an `ingest_time` of
04:00, so every file it needs already exists:

1. Read the archive files for events that arrived during day D and the first 4
   hours of D+1: about 1.17 billion events (the day's billion plus 4 ÷ 24 of
   the next), about 290 GB, keeping those with event times in D and
   `ingest_time` before 04:00 on D+1. Filtering on the queue's own timestamp,
   not on which files exist, is what lets a re-run produce the same rows.
2. Load the click IDs of day D−1 (1 billion × 16 bytes = 16 GB), so a click
   at 00:10 on an impression shown at 23:50 the day before is checked against
   earlier clicks on it.
3. Drop invalid events and impressions older than 24 hours, keep the first
   click per click ID, and count per ad per minute.
4. Write those rows, at sub-key 0, with `final = true` and a version above any
   stream version, so no late stream flush can overwrite them. For every stream
   row of day D with no batch counterpart (a minute whose clicks were all
   rejected, or a split ad's other sub-keys), write `clicks = 0`,
   `final = true` at the same version, so no inflated provisional row survives.
5. Compare with the stream's rows and alert on any advertiser whose day
   differs by more than 0.5%.
6. Write a "day D closed" marker, which billing waits for.

A crash anywhere re-runs the whole job, which rewrites the same rows. If it
dies after step 4 but before step 6, dashboards already show final rows,
billing hasn't started, and the re-run finishes the job.

The archive has the same repeat problem one level down. The archiver names
each file by partition and starting offset, uploads it, then records the
offset. A crash between the two re-uploads a file under the same name,
replacing the first copy, and any overlap between files would still be removed
by the batch's click-ID check.

## Deep dive: top-K most-clicked ads

The list answers "which 100 ads had the most clicks in the last minute, 5
minutes, hour?", refreshed every 15 seconds, over up to 500,000 distinct ads a
minute. Three approaches:

**Exact counts, merged from partitions.** Each aggregator already keeps exact
per-minute counts for its ads. For each window it keeps a running sum per ad
(add the newest minute, subtract the one that fell out) and an ordered index
on that sum, and every 15 seconds publishes its top 100 per window. Because
each ad lives in exactly one partition, each ad's full count is in one place,
so the global top 100 is exactly the top 100 of the 32 partitions' lists put
together, 3,200 entries per window. (A hot ad split across partitions is the
exception; Failure modes covers how the merge handles it.) The query API does that merge on read. The
memory is the last hour's (ad, minute) counts: 500,000 × 60 = 30 million
entries at peak, at about 32 bytes each about 1 GB across the cluster, around
30 MB per partition.

**A Count-Min sketch plus a heap.** A Count-Min sketch is a small grid of
counters, d rows of w columns, with one hash function per row. A click adds 1
to one counter in each row; an ad's estimate is the smallest of its d
counters. Collisions only ever add, so it overestimates, never under. With
w = e ÷ ε and d = ln(1 ÷ δ), the overestimate stays below ε × N with
probability 1 − δ, where N is the total clicks counted. A sketch keeps no ad
IDs, so a heap of the current top candidates sits beside it. For the peak
minute, N = 120,000 × 60 = 7.2 million; at ε = 0.0001 and d = 5 (δ ≈ 0.7%),
w ≈ 27,183 and the grid is 27,183 × 5 × 4 bytes ≈ 540 KB, with errors up to
720 clicks. If the 100th ad has around 5,000 clicks that minute, an error of
720 is enough to reorder the bottom of the list, and over the hour window N
and the error grow 60 times.

**A heavy-hitters summary (Space-Saving).** Keep a fixed table of k counters.
A tracked ad's click increments its counter; an untracked ad replaces the
smallest counter and inherits its value plus one. Any ad with more than N ÷ k
clicks is guaranteed to be in the table, and each count is over by at most
N ÷ k. With k = 10,000 for the peak minute, that is again 720 clicks, in about
240 KB at 24 bytes a counter.

This design keeps exact counts. The sketches trade accuracy for memory, and
at 1 GB for the whole cluster there is little memory to save. Exact counts
also mean the top-K list and an ad's own dashboard show the same number, which
advertisers notice when they don't. The balance would tip if the list were
broken down by country and device: 100 times as many keys would mean around
100 GB of window state, and a Space-Saving table per partition, merged the same
way, would be the better buy.

Ties are broken by `ad_id`, so every reader sees the same order, and a late
event updates the window sums like any other.

## Failure modes and bottlenecks

**A hot ad.** Routing by `ad_id` puts every click on one ad in one partition.
Assume no single ad exceeds 2% of all clicks: 2,400 a second at peak. Its
partition then carries about 2,400 + 117,600 ÷ 32 ≈ 6,100 events a second, and
the process holding it with two other partitions about 6,100 + 2 × 3,675 ≈
13,450, 67% of its 20,000. An ad above that would be split: the click server
sets `sub_key` to a hash of the click ID mod 4 and routes by `ad_id` plus
`sub_key`, which still sends every copy of a click to one place. Each sub-key
is its own count row, with one writer and that partition's offset as its
version (offsets from different partitions can't be compared, so the sub-rows
can't share one row), and reads sum the 4 sub-rows. In top-K, each partition
publishes a split ad's sub-count whatever its rank, and the merge sums them
before ranking.

**Aggregators falling behind.** If aggregators process more slowly than events
arrive, the backlog grows in the queue, which holds 7 days, and dashboards go
stale while nothing is lost. The signal is **consumer lag**, the gap between
the newest offset and the one being processed, per partition; the response is
adding processes, up to 32. Letting the queue absorb the difference is the
[backpressure](/systems-and-infrastructure/backpressure) choice.

**The counts store is slow or down.** Flushes fail and are retried, and
aggregators keep counting in memory. Each retry rewrites absolute counts, so
repeating one is harmless. Dashboards show stale numbers until it recovers,
while clicks and billing are untouched.

**The queue is unreachable from some click servers.** They spool to local
disk and keep redirecting. When the link returns, the spool is forwarded and
arrives as late events: within the hour, the stream updates past minutes;
later, only the batch counts them. A spool that outlives the 04:00 cutoff isn't
billed, which is why spool size is watched.

**Malformed events.** An event that fails to parse is moved to a
[dead-letter queue](/systems-and-infrastructure/dead-letter-queue) rather than
blocking its partition, and counted in a metric that should stay near zero.

**Knowing any of this is happening.** Consumer lag per partition, the "too
late" count, spool size per click server, the stream-to-batch gap per
advertiser, redirect latency at p99, and the time from a click to its count.
[Observability](/systems-and-infrastructure/observability) covers how metrics,
logs and traces divide that work.

## Trade-offs

- **Stream plus batch.** Dashboards are fresh and billing is recomputed
  independently from immutable files. The price is maintaining the counting
  rules in two pipelines and investigating whenever they disagree.
- **An hour of dedup in the stream, 24 in the batch.** The stream's state
  stays near 21 GB at peak, and provisional counts can run high for a
  repeated click on an old impression until the day is settled.
- Routing by `ad_id` gives each count row one writer, keeps dedup local and
  makes the top-K merge exact; it also means a hot ad lands on one partition,
  so heavy ads need the sub-key split.
- **Absolute versioned counts over increments.** Replays and a stalled old
  owner are harmless, at the cost of append-heavy writes and reads that must
  pick the highest version.
- **Exact top-K over sketches**, about 1 GB of state for numbers that match the
  dashboards. With breakdowns by country and device, this flips.
- **A hard 04:00 cutoff.** Billing closes on time, and a click stuck in a
  spool past it is never charged, which errs toward the advertiser.

What would change the design: counting impressions as well would multiply the
event rate, perhaps a hundredfold, making the dedup set the first thing to
outgrow its budget and the Bloom filter worth revisiting for that stream.
