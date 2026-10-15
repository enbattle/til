---
title: Design an Ad Click Aggregator (like an ad network's click reporting)
summary: One billion clicks a day counted per ad per minute, each click once, with versioned counts that make replays harmless and a daily batch that settles billing.
date: 2026-10-05
order: 13
---

You're asked to design an ad network's click reporting. A visitor clicks an ad, the network's server records the click and redirects to the advertiser's page, and a **dashboard**, a web page of live numbers, shows clicks per ad per minute. Advertisers are billed per click, so a count off by a few percent is an overcharge or a refund.

So the question is how to count 1 billion clicks a day, each once, when clicks arrive twice, late and in the middle of a restart. The answer: the click is only written to a queue, a stream counts it for dashboards, and a daily recount settles billing. This page starts with the obvious design and shows where it breaks, then follows a click through the pipeline that replaces it, sizes its parts, and makes three decisions: how repeats are caught, how counts are written so a replay is harmless, and why a daily recount settles the bill.

## Requirements

- Record each click and redirect, adding under 20 ms at p99 (99% of requests are faster).
- Count clicks per ad per minute: **provisional** (early, and may still change) within 60 seconds at p99, **final** (settled for billing) once the day is closed.
- Count each click once. Every showing of an ad, an **impression**, has a unique ID that its clicks carry. A click on an impression over 24 hours old isn't billable.
- Keep a top 100 of the most-clicked ads over the last 1, 5 and 60 minutes, refreshed every 15 seconds.
- 1 billion clicks a day across 10 million live ads; the click endpoint is up 99.99% of the time.

Out of scope: serving ads, fraud detection and budgets.

## Start simple

The obvious design counts during the click. A **click server**, one of many identical servers that answer clicks, looks up the click's impression ID in a table of IDs already seen, inserts it if it's new, and adds one to the row for that ad and minute in the **counts store**, the database that holds the counts. Then it redirects.

For a small network that's fine. Peak is ten times the average ([numbers every engineer should know](/engineering-practices/numbers-every-engineer-should-know)). At a million clicks a day, 1,000,000 ÷ 86,400 s ≈ 12 a second, so peak is 12 × 10 = 120 a second, and one database barely notices. Now run the steps on this network's numbers, and assume one database server handles 50,000 writes a second:

```text
average:
  1,000,000,000 ÷ 86,400 s ≈ 12,000 a second
peak:
  12,000 × 10 = 120,000 a second
writes at peak (an insert and an update per click):
  120,000 × 2 = 240,000 a second
database servers:
  240,000 ÷ 50,000 ≈ 5
```

Five servers is affordable. A popular ad is not. Say one ad draws 2% of all clicks, and assume each update holds its row for 2 ms:

```text
clicks on that ad at peak:
  120,000 × 0.02 = 2,400 updates a second
one row, one update at a time:
  1,000 ms ÷ 2 ms = 500 updates a second
```

That's 2,400 updates arriving where 500 fit, and every click waits in line inside its 20 ms budget. Worse, a timed-out update leaves you guessing: retry it and the click may count twice, skip it and the click may vanish.

So take counting out of the click. The click server should only write the click down as an **event**, a short record of the click, in a queue, and leave the counting to other processes.

## High-level architecture

![Architecture of the ad click aggregator. A browser or app sends GET /c/{token} to the click servers, which answer with a 302 back. The click servers send click events to the click queue, which has 32 partitions. The queue feeds the stream aggregators, and an archiver copies it as files into the raw archive in object storage. The stream aggregators write versioned counts to the counts store and the top 100 per window to the top-K cache. The raw archive feeds the daily batch reconciliation, which writes final counts to the counts store. The query API reads the counts store and the top-K cache; billing reads only final rows from the counts store.](/diagrams/ad-click-aggregator/architecture.svg)

Follow a click on ad 42. A click server checks the token in the click's URL, writes one event to the **click queue**, and answers with a redirect. The queue is a [message queue](/systems-and-infrastructure/message-queues), which holds events until something takes them, so the click waits for one queue write and nothing more. The queue is split into 32 **partitions**, each an ordered list of events. A hash of the ad ID picks the partition, so all of ad 42's clicks share one.

Each partition is read by a **stream aggregator**, a process that counts events as they arrive; 10 aggregators share the 32 partitions. The one holding ad 42 keeps a running count per ad and minute in memory, and every 15 seconds it writes each changed count to the counts store. Because a click can arrive twice, it also remembers the click IDs it has seen in the last hour and skips a repeat; the first decision is about that memory. Dashboards ask the query API, which reads these counts. The aggregators also publish a top 100 per window to the **top-K cache**, which the query API reads for the top-ads list.

The last path is for billing. A second reader, the archiver, copies every event as files into the **raw archive**, kept in **object storage**, a service that stores files by name. Once a day a job recounts from the archive and writes the final counts, the only rows billing reads.

## Key numbers

These size the click servers, the queue, the aggregators and the counts store. Peak is ten times the average, and figures are rounded.

- **Clicks:** about 120,000 a second at peak, with capacity for 200,000. 1,000,000,000 ÷ 86,400 s ≈ 12,000 a second on average, and 12,000 × 10 = 120,000.
- **Queue:** 30 MB a second at peak, 250 GB a day. Assume a 250-byte event: 120,000 × 250 B = 30 MB a second, and 1,000,000,000 × 250 B = 250 GB.
- **Aggregators:** 10 processes over the 32 partitions. Assume one handles 20,000 events a second; sized for the 200,000 capacity, 200,000 ÷ 20,000 = 10.
- **Click-ID memory:** 20.7 GB across the cluster, about 650 MB per partition. An hour at peak holds 120,000 × 3,600 s = 432 million click IDs; assume 48 bytes each, so 432,000,000 × 48 B ≈ 20.7 GB, and 20.7 GB ÷ 32 ≈ 650 MB.
- **Counts store:** 33,000 row writes a second at peak. Assume 500,000 ads are clicked in the peak minute and each 15-second write covers one row per ad: 500,000 ÷ 15 s ≈ 33,000.

The click-ID memory drives the first decision, and the counts store's writes shape the second.

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
  version  the queue position that count reflects
  final    true when written by the daily recount
```

The **click token** in the URL holds the impression ID, ad ID and impression time, signed with an [HMAC](/computing-fundamentals/encoding-hashing-and-encryption), a hash only the key's holders can produce, so a forged token fails the check. A bad token still gets the redirect, recorded `valid: false`, for the reason in [the URL shortener](/system-design/url-shortener).

Two fields need a word. `event_time` is when the click happened, stamped by the click server. `sub_key` is 0 for almost every ad; when one ad is so busy it would overload a partition, `sub_key` splits that ad's clicks into four sub-rows. The partition is then `hash(ad_id, sub_key) mod 32`, which is the ad ID's hash alone while `sub_key` is 0 (the follow-up on busy ads shows how).

Dashboards scan one ad over a time range, which suits a **columnar store**, a database that keeps each column compressed apart. It prefers appending, so every write is a new row and a read takes the highest `version`. Why that works is the second decision, after the first.

## Decision: an exact click-ID set per partition

Duplicates come from three places: a visitor's double-click, a click server retrying a send that timed out, and a **spool** forwarded twice. A spool is the file where a click server saves clicks on local disk while the queue is unreachable, then forwards them. All copies carry the same click ID, and routing by `ad_id` and `sub_key` puts every copy in one partition.

So each aggregator needs only to remember the IDs it has seen. The cheap way is a **Bloom filter**, a bit array that answers "possibly seen" or "definitely not" in fixed memory. At a 1% false-positive rate it needs about 9.6 bits an ID:

```text
filter: 432,000,000 × 9.6 bits ÷ 8 ≈ 520 MB
exact set: 432,000,000 × 48 B ≈ 20.7 GB
20.7 GB ÷ 520 MB ≈ 40 times more
real clicks discarded: 120,000 × 1% = 1,200 a second
```

Forty times less memory, but "possibly seen" is wrong for up to 1% of new clicks, and each one is discarded as a repeat. The daily recount would repair the bill, yet dashboards would run low all day. 20.7 GB is affordable, so each aggregator keeps the last hour's click IDs exactly, in its own local store, and a lookup never leaves the process. Retries arrive within minutes, so an hour catches nearly all of them; the daily recount removes a repeat that comes later.

The cost is that memory, 650 MB on each partition, and a window that misses a repeat after the hour.

**Rule of thumb.** When a wrong answer costs money, use the exact structure if it fits in memory; reach for a probabilistic one when it doesn't.

## Decision: absolute counts versioned by offset

Each 15-second **flush**, the write of an aggregator's changed counts, could send an increment: "add 3 to ad 42, 12:07". It breaks on a crash.

A consumer can re-read a partition from any **offset**, an event's position in it, so an aggregator **checkpoints** every 30 seconds: it uploads what changed in its click-ID set and counts, with its offset, to object storage. A replacement loads the last checkpoint and re-reads from that offset.

```text
clicks re-read after a crash, at most:
  30 s × 20,000 a second = 600,000
```

Those clicks were already flushed, so replaying their increments counts them twice. Guarding each increment takes an [idempotency](/systems-and-infrastructure/idempotency) record, a stored note that this exact write already happened.

Instead, each flush writes the absolute count, with the offset as its version: "ad 42, 12:07 is 58, version 9,041". Writing that row twice changes nothing, and a lower version never replaces a higher one, so a stalled old owner that wakes after a reassignment can't move a row backwards.

Two conditions make absolute counts right. One writer must see every click of a row, which routing by `ad_id` and `sub_key` gives. And a replay must reach the same count as the first run, which makes counting **deterministic**: any decision about time, such as which minute a click belongs to or the 24-hour rule, reads the event's own timestamps, not the aggregator's clock ([time and clocks](/computing-fundamentals/time-clocks-and-time-zones)).

The cost is that rule for the counting code, and a store that keeps every version of a row until old ones are merged away.

**Rule of thumb.** Make a write safe to repeat instead of trying to prevent every repeat.

## Decision: a stream for provisional, a daily batch for final

The simple design has the stream produce the final numbers too. It breaks on late clicks. Dashboards need numbers within 60 seconds, so aggregators flush every 15 seconds and keep each minute open for an hour of event time, which is time measured by the events' own timestamps. A click spooled 40 minutes late still updates its row. A click later than an hour finds its minute closed.

Making the stream final would mean keeping every minute open for the 24-hour rule:

```text
open minutes now: 60
open minutes for a day: 24 × 60 = 1,440
state: 1,440 ÷ 60 = 24 times larger
```

And billing would rest on one pipeline nothing checks. So after 04:00 UTC the daily **batch** job, a program run on a schedule over a whole day of data, reads the archive, applies the full 24-hour rule, and writes final rows with a version above any stream version. Billing reads only those; a spool that outlives the cutoff isn't billed.

The price is two pipelines and two copies of the counting rules. Both share one library, and the job alerts when an advertiser's day differs from the stream's by over 0.5%.

**Rule of thumb.** Serve fast, approximate numbers from a stream, and settle anything that bills from the raw record, recomputed.

## Likely follow-ups

- **How is the top 100 built?** Each aggregator keeps exact sums per window and publishes its top 100 every 15 seconds. The answer merges the 32 lists, summing a split ad's parts. The state is about 1 GB: 500,000 ads × 60 minutes × 32 bytes ≈ 960 MB.
- **What if one ad takes a large share of clicks?** Routing by `ad_id` puts it on one partition. Past 2% of clicks, 2,400 a second at peak, the click server sets its `sub_key` to a hash of the click ID mod 4, which the routing hash includes, so the ad spreads over up to four partitions (two `sub_key`s can land on the same one) at about 600 a second per `sub_key`. A repeat has the same click ID, so it still meets its first copy. Each sub-row keeps one writer, and reads sum the four.
- **What if the click servers can't reach the queue?** A click server spools to local disk, redirects anyway, and forwards later as late events. A spool that outlives the 04:00 cutoff isn't billed.
- **What if aggregators fall behind?** The backlog waits in the queue, which keeps seven days; dashboards go stale, and nothing within those days is lost. Add processes, up to 32.
