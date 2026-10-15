---
title: Design a Web Search Engine (like Google Search)
summary: Splitting a billion-page inverted index by page across 100 shards, ranking in two stages inside each shard, and keeping it fresh with a small live index beside a daily base.
date: 2026-10-05
order: 14
template: 3
---

You're asked to design a web search engine. A user types `paris weather` and gets the ten pages most likely to answer, each with a title, a link and a **snippet**, an extract showing the query words in context. A **crawler** downloads pages from across the web, and a separate system answers queries over a billion of them in a fraction of a second.

The trick is to do most of the work before anyone asks. The design builds a lookup from each word to the pages containing it, cuts that lookup into 100 pieces searched in parallel, and ranks in two stages. This page starts with the obvious design of reading every page for every query, shows where it breaks, follows one query through the design that replaces it, sizes its parts, and makes three decisions: how to cut the index, how to rank inside a piece, and how to keep it fresh.

## Requirements

- Return the ten best pages for a query, with title, URL and snippet, in under 300 ms at p99 (99% of queries are faster).
- Index 1 billion pages and answer 500 million queries a day.
- Crawl by following links, obeying each site's `robots.txt` (the file listing paths crawlers must skip) and a polite request rate.
- A fetched change shows up within 10 minutes. Refetch 5 million fast-changing pages hourly and every other page every 30 days.
- Answer 99.9% of queries. A response missing up to 2% of the index still counts as an answer.

Out of scope: images, ads, personalization and [embedding-based](/ai-and-ml/vector-search) matching.

## Start simple

The obvious design keeps the text of every page in a store. For `paris weather`, a server reads each page, keeps the ones containing both words, ranks them and returns ten.

For a small site that's fine. Assume checking one page takes 1 µs of CPU:

```text
a 100,000-page site:
  100,000 × 1 µs = 0.1 s
```

Now run the same step on the web, with peak traffic at ten times the average ([numbers every engineer should know](/engineering-practices/numbers-every-engineer-should-know)):

```text
one query, one core:
  1,000,000,000 pages × 1 µs = 1,000 s
spread over a 32-core machine:
  1,000 s ÷ 32 ≈ 31 s
queries a second, average:
  500,000,000 ÷ 86,400 ≈ 6,000
CPU for that:
  6,000 × 1,000 core-seconds
  = 6,000,000 cores
```

A query takes 31 seconds against a 300 ms target, and the average load alone needs six million cores.

So do the reading ahead of time. Instead of asking every page which words it holds, write down, for each word, which pages hold it, like the index at the back of a book. Each entry, a record that one page contains one word, is a **posting**, and a word's list of postings is a **posting list**. Here are the lists for three pages:

```text
page 1 "Paris weather today"   paris   -> [1, 3]   weather -> [1, 2]
page 2 "Weather radar"         radar   -> [2]      hotels  -> [3]
page 3 "Paris hotels"          today   -> [1]
```

The set of all the lists is an **inverted index**. A query now reads only its own words' lists. For `paris weather`, keep the IDs in both lists: page 1 (a [database index](/systems-and-infrastructure/database-indexing) over words).

That removes the scan, but the index is large and its lists are long. Assume 250 distinct words a page and a 6-byte posting (the page's ID and a count):

```text
postings:
  1,000,000,000 pages × 250 words
  = 250,000,000,000
size:
  250,000,000,000 × 6 bytes
  = 1,500 GB = 1.5 TB
```

And `weather` appears on about 5% of pages:

```text
postings in its list:
  1,000,000,000 × 0.05 = 50,000,000
time to walk it, at 10 ns a posting:
  50,000,000 × 10 ns = 0.5 s
```

One machine can't hold 1.5 TB in memory or walk that list inside 300 ms. So cut the index into 100 pieces, called **shards**, each owning every posting for its own 10 million pages, and keep each shard on several identical machines, its **replicas**, which share the load and cover for one that fails; together these machines are the index servers. How do 100 shards answer one query together?

## High-level architecture

![Architecture of the search engine. Users send GET /search to query frontends, which read the result cache first and, on a miss, go to root aggregators, which scatter to all 100 shards on the index servers (100 shards, each replicated). The crawler (fetch, parse) takes fetched pages from websites, sends raw and parsed pages to the page store, and sends a new version plus an outbox row to the doc table. The doc table feeds the update log through an outbox relay, and index servers tail changes from the log. The index builder gets a daily scan from the doc table, reads pages from the page store and writes a fresh index there, and index servers load it from the page store.](/diagrams/search-engine/architecture.svg)

Follow `paris weather`. A query frontend checks the result cache, which holds finished pages for five minutes. On a miss, a **root aggregator**, a server that coordinates one query, sends it to one replica of every shard. Each returns its ten best page IDs with scores, and the aggregator merges the 100 lists into the global ten and fetches their snippets. Fanning one request out and combining the answers is **scatter-gather**.

Meanwhile the crawler fetches the URLs that are due next and saves each page. It records a changed page in the **doc table**, which keeps one row per URL, together with an [outbox](/systems-and-infrastructure/outbox-pattern) row, a record of a message still to send.

A relay, a small process that forwards stored rows, copies the outbox rows to the **update log**, an ordered list of changes that index servers read. Daily, the index builder reads the doc table for each URL's current version and the saved pages from the page store, writes a fresh copy of the index there, and the index servers load it.

## Key numbers

These size the queries the index servers answer, the crawler's fetches, each shard's memory and the number of index servers. Peak is ten times the average.

- **Queries:** 36,000 a second reach the index at peak. 500 million ÷ 86,400 ≈ 6,000 average, so 6,000 × 10 = 60,000 at peak. Assume 40% repeat a recent query and come from the result cache, so 60,000 × 0.6 = 36,000.
- **Crawler:** about 2,000 fetches a second. The fast set is 5 million ÷ 3,600 = 1,390 a second. The rest is 1 billion ÷ (30 × 86,400) = 390. New pages, assuming 100 million a month, are 100 million ÷ (30 × 86,400) = 40. That's 1,820, and retries round it up to 2,000.
- **Changes:** about 400 pages a second. Assume 20% of refetches find a change: 0.2 × (1,390 + 390) ≈ 356, plus the 40 new pages ≈ 400. A day is 400 × 86,400 ≈ 34.6 million, which is 350,000 per shard (÷ 100).
- **Memory per shard:** 36 GB, 37 with the day's changes. A page adds its postings (250 × 6 = 1,500 bytes), a 2 KB snippet text and 100 bytes of ranking features, so 1,500 + 2,000 + 100 = 3,600 bytes. For 10 million pages, 10,000,000 × 3,600 = 36 GB, held in memory. The changes add 350,000 × 3,600 ≈ 1.3 GB, for 37 GB.
- **Index servers:** 2,400. Every query visits all 100 shards, so 36,000 × 100 = 3.6 million shard requests a second. Assume each takes 10 ms of CPU on a 32-core machine, 32 ÷ 0.01 = 3,200 a second, run at 50% load: 1,600. Then 36,000 ÷ 1,600 = 22.5, so 24 replicas per shard, 8 in each of 3 regions (data centers in different places). That's 24 × 100 = 2,400 machines, each at 36,000 ÷ 24 = 1,500 a second, 47% of 3,200.

So each shard is the size of one machine's memory, and the fleet is a few thousand machines.

## API and data model

```http
GET /search?q=paris+weather&page=1
-> 200 { "results": [ { "url": "...", "title": "...", "snippet": "..." } ], "next_page": 2 }
   (400 for an empty or over-long query, 429 when one client exceeds its rate)
```

```text
docs  (doc table, one row per URL)
  doc_id         64-bit hash of the normalized URL, primary key
  url, status, fetched_at
  version        +1 on every content change or removal
  content_hash   hash of the parsed text, null once removed
  next_fetch_at, tier (fast | normal)
```

The key is `doc_id`, a hash, so a page's shard (`doc_id` mod 100) is fixed and pages spread evenly. The `version` lets an index server tell a new copy of a page from one it already holds.

Those 100 shards raise the first question: why cut the index by page rather than by word?

## Decision: split the index by page

The simpler cut is by word. Each machine owns the lists for a slice of the vocabulary, so a query touches only the machines holding its words, here two.

It breaks on the long lists. `weather` has 50 million postings, 50,000,000 × 6 bytes = 300 MB. Its machine can't intersect it with `paris` without receiving the other list or sending its own. Take a query with a word as common as `weather` and say its long list is the one shipped:

```text
shipped per query:
  300 MB
at 36,000 queries a second:
  300 MB × 36,000 = 10.8 TB/s
at 1.25 GB/s per network link:
  10,800 GB ÷ 1.25 ≈ 8,640 links
```

Even shipping only the best 1% of the list is 3 MB × 36,000 = 108 GB/s.

So cut by page. Each shard owns every posting for its own 10 million pages, intersects `paris` and `weather` locally and returns ten results, so only 100 short lists cross the network. A changed page touches one shard. The price: every query goes to all 100 shards, 3.6 million shard requests a second instead of 72,000 for two machines.

**Rule of thumb.** Cut data so each machine can answer its part alone, and pay in CPU fan-out before network traffic.

## Decision: rank in two stages inside each shard

The simplest ranking scores every matching page with the best model, which weighs hundreds of signals. A shard has about 10 ms of CPU for a query, and `weather` matches 5% of its 10 million pages:

```text
matches in one shard:
  10,000,000 × 0.05 = 500,000
best model at 10 µs a page:
  500,000 × 10 µs = 5 s
```

That's 500 times the budget. So rank in two stages. Each day the index builder counts the links between all pages, which no single shard can do, and gives a page a higher **quality score** the more pages link to it. The shard numbers its pages from highest score to lowest, so each posting list runs best first. Stage one scores with a cheap formula (query-word counts plus quality) and stops reading a list once the quality still ahead can't lift a page into the top 200. Stage two runs the full model on those 200:

```text
200 × 10 µs = 2 ms
```

Why not search a small index of only the best pages first? It can cut common queries' work about tenfold, but it doubles the build and update paths, and a query it can't fill needs a second round trip. The cascade's cost: a page the cheap formula ranks 201st is never rescued.

**Rule of thumb.** Spend the expensive scorer on a shortlist, and judge the cheap stage by what it lets through.

## Decision: a daily base plus a live index

The simpler way to keep the index fresh is to update the lists in place. A shard sees 350,000 changes a day, and each page sits in 250 lists:

```text
changes a second, one shard:
  400 ÷ 100 = 4
list edits a second:
  4 × 250 = 1,000
```

That's 1,000 rewrites a second, on lists stored compressed (packed tightly, so a change means rewriting a stretch of it), while 1,500 queries a second read them. An inserted page also breaks the quality order that ranking relies on.

So each replica keeps a **base index**, rebuilt daily and never modified, plus a **live index**, an in-memory index of the changes since, 3.6% of the shard (1.3 GB ÷ 36 GB). A query searches both.

A changed page's old copy is still in the base, so a **deleted set** lists base pages to skip. The crawler commits each new `version` with an outbox row in the same transaction, so a crash can't lose it, and replicas skip any version they already hold, replacing an older live copy ([idempotency](/systems-and-infrastructure/idempotency)). A change is searchable in seconds, or five minutes through the result cache. The cost is a second lookup per query.

**Rule of thumb.** When a structure is fast because it is immutable, keep a small mutable layer beside it and merge on a schedule.

## Likely follow-ups

- **What about slow shards?** If slow moments are independent, only 0.99¹⁰⁰ ≈ 37% of queries see all 100 shards beat their p99. **Hedge**: after 30 ms (the p95, the time 95% of requests beat), ask a second replica and take the first answer, for about 5% more load. A 100 ms deadline drops a shard still silent.
- **What if a region goes down?** The other two carry the peak: 36,000 ÷ 16 replicas = 2,250 a second, 70% CPU, 74% with hedging.
- **How does the crawler stay polite?** Hash each site to one fetcher, which spaces its requests and caches `robots.txt`. Errors cut a site's rate ([backoff](/systems-and-infrastructure/exponential-backoff)); a URL cap per site stops endless calendars.
- **How does a restarted replica catch up?** It loads the current base, then replays the update log from before that build began, skipping old versions.
