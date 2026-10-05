---
title: Design an Ad Click Aggregator (like an ad network's click reporting)
summary: One billion clicks a day counted per ad per minute, each click once, with versioned counts that make replays harmless and a daily batch that settles billing.
date: 2026-10-05
order: 13
template: 2
---

You're asked to design an ad network's click reporting. A visitor clicks an
ad, the network's server records the click and redirects to the advertiser's
page, and a **dashboard** shows clicks per ad per minute. Advertisers are
billed per click, so a count off by a few percent is an overcharge or a
refund. The difficulty is "once": clicks arrive twice, late, and mid-restart.

## Requirements

- Record each click and redirect, adding under 20 ms at p99 (99% of requests
  are faster).
- Count clicks per ad per minute: **provisional** within 60 seconds at p99,
  **final** once the day is settled for billing.
- Count each click once. Every showing of an ad (an **impression**) has a
  unique ID that its clicks carry. A click on an impression over 24 hours old
  isn't billable.
- Keep a top 100 of the most-clicked ads over the last 1, 5 and 60 minutes,
  refreshed every 15 seconds.
- 1 billion clicks a day across 10 million live ads; the click endpoint is up
  99.99% of the time.

Out of scope: serving ads, fraud detection and budgets.

## Key numbers

These size the queue that takes clicks, the aggregators that count them, and
the store that holds the counts. Peak is ten times average
([numbers every engineer should know](/engineering-practices/numbers-every-engineer-should-know)):

- **Clicks:** about 120,000 a second at peak, and capacity for 200,000. A
  billion a day ÷ 86,400 is 12,000 a second on average.
- **Queue:** 30 MB a second at peak. Assume a 250-byte event; 250 GB a day.
- **Aggregators:** 10 processes, over 32 queue partitions. Assume one handles
  20,000 events a second, so 200,000 ÷ 20,000.
- **Dedup memory:** 20.7 GB across the cluster, about 650 MB per partition.
  432 million click IDs in an hour at peak × 48 bytes.
- **Counts store:** 33,000 row writes a second at peak. Assume 500,000 ads are
  clicked in the peak minute, and each flush (every 15 seconds) writes one row
  per ad.

## High-level architecture

![Architecture of the ad click aggregator. A browser or app sends GET /c/{token} to the click servers, which answer with a 302 back. The click servers send click events to the click queue, which has 32 partitions. The queue feeds the stream aggregators, and an archiver copies it as files into the raw archive in object storage. The stream aggregators write versioned counts to the counts store and the top 100 per window to the top-K cache. The raw archive feeds the daily batch reconciliation, which writes final counts to the counts store. The query API reads the counts store and the top-K cache; billing reads only final rows from the counts store.](/diagrams/ad-click-aggregator/architecture.svg)

Follow a click on ad 42. A **click server** checks the click token, sends one
event to the click queue, and answers `302`. The queue is a partitioned log, a
[message queue](/systems-and-infrastructure/message-queues) that keeps order
within each partition and lets a consumer re-read from any **offset** (a
message's position). Events go to partition `hash(ad_id, sub_key) mod 32`, so all of ad 42's clicks share one. Its stream aggregator counts the click and flushes every
15 seconds. The archiver copies the queue to object storage, where the daily
batch recomputes the final counts that billing reads.

## API and data model

```http
GET /c/eyJpbXAiOiJjLTlmMmUi...
-> 302 Found, Location: https://shop.example.com/autumn-boots

GET /v1/ads/ad-42/clicks?from=2026-09-28T12:00Z&to=2026-09-28T13:00Z&step=minute
-> { "points": [ { "minute": "2026-09-28T12:07Z", "clicks": 58, "final": false }, ... ] }

GET /v1/top-ads?window=5m&k=100
-> { "as_of": "2026-09-28T12:08:15Z", "ads": [ { "ad_id": "ad-913", "clicks": 81204 }, ... ] }
```

```text
click_event (queue message and archive row)
  click_id (the impression ID), ad_id, sub_key, impression_time, event_time, valid, country, device, ...

ad_minute_counts
  key: advertiser_id, ad_id, sub_key, minute
  clicks   the absolute count for that minute
  version  the queue offset that count reflects
  final    true when written by the daily batch
```

The **click token** holds the impression ID, ad ID and impression time, signed with an HMAC (a
hash only the key's holders can produce), so forgeries fail. A bad token still gets the redirect, recorded `valid: false`, as a `302`
for the reason in [the URL shortener](/system-design/url-shortener).
Dashboards scan one ad over a time range, which suits a **columnar
store** (columns stored compressed apart). It prefers appending, so each write
is a new row and reads take the highest `version`.

## Decision: an exact click-ID set per partition

Duplicates come from double-clicks, retried sends and a spool forwarded twice. All carry the same click ID, and routing by
`ad_id` puts every copy in one partition. So each aggregator keeps the last
hour's click IDs in its own local store, and a lookup never leaves the process.
Retries arrive within minutes, so an hour catches nearly all of them; the
batch removes a repeat three hours later.

Why not a Bloom filter, a bit array that answers "possibly seen" or "definitely
not" in fixed memory? It needs about 520 MB, forty times less, but a 1%
false-positive rate discards up to 1% of real clicks as duplicates. The batch
would repair the bill, but dashboards would run low. 20.7 GB is affordable.

**Rule of thumb.** When a wrong answer costs money, use the exact structure if
it fits in memory; reach for a probabilistic one when it doesn't.

## Decision: absolute counts versioned by offset

An aggregator can crash, so every 30 seconds it
**checkpoints**: uploads what changed in its dedup set and counts, with its offset, to object storage. A replacement loads it and re-reads at most 30 seconds, so ad 42's 12:07 count is computed again. Each flush writes the
absolute count with the offset as its version: "ad 42, 12:07 is 58, version
9,041". Writing that row twice changes nothing, and a lower version never replaces
a higher one. A stalled old owner that wakes and flushes
after a reassignment can't move a row backwards either.

Why not write increments, "add 3 to ad 42"? A replay adds the 3 again, so each
needs an
[idempotency](/systems-and-infrastructure/idempotency) record. Absolute counts
need one writer per row, which routing by `ad_id` gives, and replay that is
**deterministic**, so every time decision uses the event's own timestamp.

**Rule of thumb.** Make a write safe to repeat instead of trying to prevent
every repeat.

## Decision: a stream for provisional, a daily batch for final

Dashboards need numbers within 60 seconds, so aggregators flush counts every
15 seconds and keep each minute open for an hour of event time. A click spooled
40 minutes late still updates its row; later, only the batch counts it. After 04:00 UTC the daily job reads the archive, applies the full 24-hour
rule, and writes final rows with a version above any stream version. Billing
reads only those.

Why not let the stream produce the final numbers too? Billing would rest on one pipeline nothing checks, and late or spooled clicks arrive after the stream has closed their minute, so its totals would stay open for a day. The price of two
pipelines is two copies of the counting rules, so both share one library, and
the job alerts when an advertiser's day differs from the stream by over 0.5%.

**Rule of thumb.** Serve fast, approximate numbers from a stream, and settle
anything that bills from the raw record, recomputed.

## Likely follow-ups

- **How is the top 100 built?** Each aggregator keeps exact sums per window
  and publishes its top 100 every 15 seconds. The answer merges the 32 lists, summing a split ad's parts. The state is about 1 GB (500,000 ads × 60
  minutes × 32 bytes).
- **What if one ad takes a large share of clicks?** Routing by `ad_id` puts it
  on one partition. Past 2% of clicks, 2,400 a second at peak, the click server sets a `sub_key` (a click-ID hash mod 4) that routing hashes too, spreading it over four partitions; each sub-row keeps one writer and reads sum the four.
- **What if the click servers can't reach the queue?** A click server
  spools to local disk, redirects anyway, and forwards later as late events. A
  spool that outlives the 04:00 cutoff isn't billed.
- **What if aggregators fall behind?** The backlog waits in the queue, which
  keeps seven days; dashboards go stale and nothing is lost. Add processes, up
  to 32.
