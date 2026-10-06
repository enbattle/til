---
title: Design a Web Search Engine (like Google Search)
summary: Splitting a billion-page inverted index by page across 100 shards, ranking in two stages inside each shard, and keeping it fresh with a small live index beside a daily base.
date: 2026-10-05
order: 14
template: 2
---

You're asked to design a web search engine. A user types `paris weather` and
gets the ten pages most likely to answer, each with a title, a link and a
**snippet**, an extract showing the query words in context. A **crawler**
downloads pages and an indexer makes them searchable, while a separate system
answers queries across a billion pages.

## Requirements

- Return the ten best pages for a query, with title, URL and snippet, in under
  300 ms at p99 (99% of queries are faster).
- Index 1 billion pages and answer 500 million queries a day.
- Crawl by following links, obeying each site's `robots.txt` (the file listing
  paths crawlers must skip) and a polite request rate.
- A fetched change shows up within 10 minutes. Refetch 5 million fast-changing
  pages hourly and every other page every 30 days.
- Answer 99.9% of queries. A response missing at most 2 of the 100 index
  **shards** (pieces of the index, each on its own machines) still counts.

Out of scope: images, ads, personalization and
[embedding-based](/ai-and-ml/vector-search) matching.

## Key numbers

First, size the index servers' queries, each shard's data and the crawler's
fetches, with peak at ten times average
([numbers every engineer should know](/engineering-practices/numbers-every-engineer-should-know)):

- **Queries: 36,000 a second reach the index at peak.** 500 million ÷ 86,400 ≈
  6,000 average, 60,000 peak. Assume 40% repeat a recent query and come from a
  result cache.
- **Index: 1.5 TB, 100 shards of 15 GB.** Assume 250 distinct words a page and
  a 6-byte **posting** (a record that a page contains a word):
  1 billion × 250 × 6 bytes. Snippet text (2 KB a page) and ranking features
  (100 bytes) make a shard 36 GB, 37 with the day's changes, in memory.
- **Index servers: 2,400.** Every query visits all 100 shards: 3.6 million
  shard requests a second. Assume 10 ms of CPU each on a 32-core machine: 1,600
  a second at 50% load. 36,000 ÷ 1,600 = 22.5, so 24 replicas (identical
  copies) per shard, 8 in each of 3 regions, at 47% CPU.
- **Crawler: about 2,000 fetches a second.** 5 million ÷ 3,600 = 1,390 for the
  fast set, 1 billion ÷ (30 × 86,400) = 390 for the rest, 40 new pages (assume
  100 million a month), plus retries.
- **Changes: about 400 pages a second.** Assume 20% of refetches find a change,
  plus the new pages: 350,000 a day per shard, about 1.2 GB.

## High-level architecture

![Architecture of the search engine. Users send GET /search to query frontends, which read the result cache first and, on a miss, go to root aggregators, which scatter to all 100 shards on the index servers (100 shards × 24 replicas). The crawler (frontier, fetch, parse) takes fetched pages from websites, sends raw and parsed pages to the page store, and sends a new version plus an outbox row to the doc table. The doc table feeds the update log through an outbox relay, and index servers tail changes from the log. The index builder gets a daily scan from the doc table, reads pages from the page store and writes the base there, and index servers load base segments from the page store.](/diagrams/search-engine/architecture.svg)

Follow `paris weather`. A query frontend checks the result cache, which holds
finished pages for five minutes. On a miss, a root aggregator sends the query
to one replica of every shard. Each returns its ten best page IDs with scores,
and the aggregator merges 100 lists into the global ten and fetches their
snippets. Fanning one request out and combining the answers is
**scatter-gather**.

Meanwhile the crawler fetches URLs in `next_fetch_at` order and records changes
in the doc table. A relay copies them to the update log, which index servers
tail. Daily, the index builder writes a new base index that they load.

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

index shard, in memory: an inverted index, here for three pages
  page 1 "Paris weather today"   paris   -> [1, 3]   weather -> [1, 2]
  page 2 "Weather radar"         radar   -> [2]      hotels  -> [3]
  page 3 "Paris hotels"          today   -> [1]
```

An **inverted index** maps each word to a **posting list**, the pages that
contain it; `paris weather` keeps the IDs in both, page 1 (a
[database index](/systems-and-infrastructure/database-indexing) over words).
The key is `doc_id`, a hash, so a page's shard (`doc_id` mod 100) is fixed and
pages spread evenly.

## Decision: split the index by page

Each shard owns every posting for its own 10 million pages. It intersects
`paris` and `weather` locally and returns ten results, so nothing large crosses
the network, and a changed page touches one shard. The price: every query goes
to all 100 shards.

Why not split by word, so a query touches two shards? It costs less CPU, but
suppose `weather` matches 5% of pages: 50 million postings, about 300 MB, and a
two-word query must intersect lists on different machines. Even a pruned slice
of that at 36,000 queries a second is too much network.

**Rule of thumb.** Cut data so each machine can answer its part alone, and pay
in CPU fan-out before network traffic.

## Decision: rank in two stages inside each shard

A shard has about 10 ms of CPU to find its ten best pages, but `weather`
matches 500,000 of them. Assume the best ranking model costs 10 µs a page: 5
seconds. So at build time the shard numbers its pages from highest link-based
quality to lowest, and each posting list runs best first. Stage one scores
with a cheap formula (query-word counts plus quality), skipping postings that
can't reach the top 200. Stage two runs the full model on those 200: 2 ms.

Why not search a small index of only the best pages first? It can cut common
queries' work about tenfold, but it doubles the build and update paths, and a
query it can't fill needs a second round trip. The cascade's cost: a page the
cheap formula ranks 201st is never rescued.

**Rule of thumb.** Spend the expensive scorer on a shortlist, and judge the
cheap stage by what it lets through.

## Decision: a daily base plus a live index

Compressed posting lists are awkward to change. So each replica keeps a base
index, rebuilt daily and never modified, plus an in-memory **live index** of
changes since, 3.5% of the shard. A query searches both, and a **deleted set**
(base pages to skip) hides a changed page's old copy. The crawler commits each new `version` with an [outbox](/systems-and-infrastructure/outbox-pattern) row in the same transaction, so a crash can't lose it, and replicas skip any version they already hold, replacing an older live copy ([idempotency](/systems-and-infrastructure/idempotency)). A change is searchable in seconds, five minutes via the cache.

Why not update the lists in place? A page touches 250 lists, each rewritten
while queries read it, and inserts break the quality order ranking relies on.
The live index costs a second lookup per query.

**Rule of thumb.** When a structure is fast because it is immutable, keep a
small mutable layer beside it and merge on a schedule.

## Likely follow-ups

- **What about slow shards?** If slow moments are independent, only
  0.99¹⁰⁰ ≈ 37% of queries see all 100 shards beat their p99. **Hedge**:
  after 30 ms (the p95), ask a second replica and take the first answer, for
  about 5% more load. A 100 ms deadline drops a shard still silent.
- **What if a region goes down?** The other two carry the peak:
  36,000 ÷ 16 replicas = 2,250 a second, 70% CPU, 74% with hedging.
- **How does the crawler stay polite?** Hash each site to one fetcher, which
  spaces its requests and caches `robots.txt`. Errors cut a site's rate
  ([backoff](/systems-and-infrastructure/exponential-backoff)); a URL cap per
  site stops endless calendars.
- **How does a restarted replica catch up?** It loads the current base, then
  replays the update log from before that build began, skipping old versions.
