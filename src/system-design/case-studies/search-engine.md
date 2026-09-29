---
title: Design a Web Search Engine (like Google Search)
summary: Crawling a billion pages into an inverted index split across 100 shards, then asking every shard at once so a query comes back ranked within 300 ms.
date: 2026-09-29
order: 14
---

A web search engine takes a few words, such as `paris weather`, and returns the
ten pages most likely to answer them, each with a title, a link and a short
extract, the **snippet**, showing the words in context. Behind that page sit
two systems that barely talk to each other. One reads the web: a **crawler**
downloads pages, and an indexer turns them into a structure that can be
searched. The other answers queries from that structure, against every page
at once, in a fraction of a second.

What follows is one plausible design, sized well below the largest web search
engines, not a description of how any company builds theirs.

## Requirements

Functional requirements:

- **Search.** Given a query of one or more words, return the ten best pages,
  ranked, with title, URL and snippet, plus further pages of results.
- **Crawl.** Discover pages by following links, download them, and download
  them again later to notice changes, obeying each site's `robots.txt` (the
  file a site uses to tell crawlers which paths to skip, standardized as RFC 9309) and a polite request rate per site.
- **Freshness.** A page that changes is searchable in its new form soon after
  the crawler next fetches it; a page that disappears drops out.
- **Typeahead (optional).** Suggest completions, such as `paris weather
tomorrow`, as the user types.

Out of scope: images, video and news as separate result types, ads,
personalization, spelling correction, spam and link-farm detection beyond a
mention, pages that only render with JavaScript, and meaning-based matching
with embeddings, the approach [vector search](/ai-and-ml/vector-search)
covers. Each is a real subsystem, but none changes how the index is built,
split or queried, which is what this design is about.

Non-functional requirements:

- **Corpus:** 1 billion indexed pages, in one language for simplicity.
- **Queries:** 500 million a day.
- **Latency:** results within 300 ms at the 99th percentile (p99, the time
  99% of queries beat), measured at our servers.
- **Availability:** 99.9% of queries answered. A response missing at most 2
  of the 100 index shards (defined below) still counts as answered, since it
  has searched 98% of the pages.
- **Freshness:** a fetched change appears in results within 10 minutes.
  About 5 million fast-changing pages (news sites, front pages) are fetched
  every hour; every other page at least every 30 days.

## Back-of-the-envelope estimates

Rules of thumb from
[numbers every engineer should know](/engineering-practices/numbers-every-engineer-should-know):
a day is 86,400 seconds, and plan for a peak of ten times the average. All
figures are rounded, and each assumption is named where it's made.

**Queries.**

- Average: 500,000,000 ÷ 86,400 ≈ 5,790, call it **6,000 queries per
  second**.
- Peak, at ten times average: **60,000 queries per second**.
- Assume 40% of queries repeat one asked in the last five minutes and are
  answered from a result cache (popular queries repeat heavily). The index
  then sees 60% of the peak: 0.6 × 60,000 = **36,000 queries per second**.

**Pages and text.** Assume an average page is 100 KB of HTML that compresses
to 20 KB, and yields about 500 words of text, of which about 250 are
distinct.

- Raw pages, latest copy only: 1,000,000,000 × 20 KB = **20 TB**.
- Extracted text and title, compressed: about 2 KB a page, so **2 TB**.

**The index.** An **inverted index** maps each word to the list of pages
containing it; the list is a **posting list**, and one entry in it, a
**posting**, records a page ID, how often the word appears and where.
Assume a compressed posting averages 6 bytes.

- Postings: 1,000,000,000 pages × 250 distinct words = 250 billion.
- Size: 250,000,000,000 × 6 bytes = 1.5 TB.

**Shards.** The index is split into **shards**, pieces each held by its own
machines. Assume 100 shards of 10 million pages each (the first deep dive
explains how pages are split).

- Index per shard: 1.5 TB ÷ 100 = 15 GB.
- Snippet text per shard: 2 TB ÷ 100 = 20 GB.
- Per-page ranking features (a quality score and a few counts, assume 100
  bytes): 10,000,000 × 100 bytes = 1 GB.
- Base total: 15 + 20 + 1 = 36 GB, plus about 1 GB for the day's changes
  (below), so 37 GB. That fits in a 128 GB machine with room to load the next
  day's base beside the current one: 2 × 36 + 1 = 73 GB during the swap.

**Index servers.** Every query is sent to all 100 shards (the first deep dive
says why). Assume one shard answers a query with about 10 ms of CPU time on
average, on a 32-core machine.

- Capacity of one machine: 32 cores × (1,000 ms ÷ 10 ms) = 3,200 queries per
  second at 100% CPU.
- Run at no more than 50% at peak: 1,600 queries per second per machine.
- Copies of each shard needed at peak: 36,000 ÷ 1,600 = 22.5.
- Round up to **24 replicas** (identical copies) per shard, 8 in each of 3
  regions: 36,000 ÷ 24 = 1,500 per replica, 47% CPU. With one region down, 16
  replicas carry it: 36,000 ÷ 16 = 2,250 per replica, 70% CPU. The hedged
  requests described later add about 5%, which makes that 74%.
- Total: 100 × 24 = **2,400 index servers**.

**Crawling.**

- Fast set: 5,000,000 pages ÷ 3,600 seconds ≈ 1,390 fetches per second.
- Everything else: 1,000,000,000 ÷ (30 × 86,400) = 1,000,000,000 ÷ 2,592,000
  ≈ 390 fetches per second.
- New pages: assume 100 million new URLs a month, 100,000,000 ÷ 2,592,000
  ≈ 40 per second (with as many old pages dropped, so the corpus stays near 1
  billion).
- Total ≈ 1,820, call it **2,000 fetches per second** with retries and
  `robots.txt` fetches. At 100 KB each that's 200 MB/s, about 1.6 Gbit/s.
  There is no peak to plan for: the crawler sets its own pace.

**Index updates.** Assume 20% of refetches find changed content; every new
page is a change.

- 0.2 × (1,390 + 390) + 40 = 356 + 40 ≈ **400 changed pages per second**.
- Per day: 400 × 86,400 ≈ 35 million, 3.5% of the corpus.
- Per shard per day: 350,000 pages, about 350,000 × 3.5 KB (1.5 KB of
  postings, 2 KB of text) ≈ 1.2 GB of memory, the "about 1 GB" above.

What the estimates say: storage is modest and the update rate is small. The
hard part is 36,000 queries a second, each touching 100 shards, which is 3.6
million shard requests a second across 2,400 machines, all within 300 ms.

## Data model

Four stores, each shaped by who reads it.

**Doc table**, one row per known URL, the source of truth for what has been
crawled:

```text
docs
  doc_id         64-bit hash of the normalized URL, primary key
  url            string
  shard          0-99, from doc_id
  version        integer, +1 on every content change or removal
  content_hash   hash of the parsed text, or null if removed
  status         ok | redirect | gone | blocked
  fetched_at     timestamp
  next_fetch_at  timestamp
  tier           fast | normal
```

Normalizing a URL (lowercasing the host, dropping the `#fragment` and known
tracking parameters) makes `https://Example.com/a#top` and
`https://example.com/a` the same row. At 1 billion rows of about 300 bytes,
that's 300 GB, sharded by `doc_id` across a SQL database's shards so each row
lives in exactly one of them. Next to it, in the same database shard, sits an
**outbox** table: one row per change that the index must hear about, written
in the same transaction as the `docs` change (the ingest path explains why).

**Page store**, object storage keyed by content hash: `raw/<hash>` holds the
compressed HTML and `parsed/<hash>` the title, text and outgoing links. Keying
by hash means writing the same page twice writes the same object, harmless.

**Index shard**, in memory on each index server. A tiny example with three
pages:

```text
page 1: "Paris weather today"
page 2: "Weather radar"
page 3: "Paris hotels"

paris   -> [1, 3]
weather -> [1, 2]
today   -> [1]
radar   -> [2]
hotels  -> [3]
```

The query `paris weather` walks the lists for `paris` and `weather` together
and keeps IDs that appear in both, page 1. The idea is the same one a
database index uses to find rows by value, applied to words; see
[database indexing](/systems-and-infrastructure/database-indexing). The page
numbers here are shard-local IDs, assigned when a shard's index is built. Each
shard also keeps a table from local ID to the page's `doc_id`, URL, title,
snippet text, `version` and ranking features.

**Global statistics**, computed at each daily build and copied to every shard:
for each word, how many pages in the whole corpus contain it. Ranking needs
this (the second deep dive).

## API design

The public API is one read endpoint; nothing outside can write to the index.

```http
GET /search?q=paris+weather&page=1

200 OK
{
  "results": [
    { "url": "https://example.com/paris/forecast",
      "title": "Paris 10-day forecast",
      "snippet": "…the Paris weather today is mild, 18°C…" }
  ],
  "next_page": 2
}
```

`400 Bad Request` for an empty or over-long query (say, over 256 characters),
and `429 Too Many Requests` when one client exceeds its rate, which protects
the index servers from scrapers; the
[rate limiter](/system-design/rate-limiter) case study covers that
component. The response doesn't tell the user when a shard was missing;
internally it's logged, and the frontend won't cache such a response (see
failure modes).

The optional typeahead, `GET /suggest?prefix=paris+wea`, is a separate small
service left out of the diagrams: an hourly job turns the last week's queries
into an in-memory table from each prefix to its ten most common completions.

Inside, the root aggregator calls each index shard with
`Search(words, k=10, deadline)` and gets back ten `(doc_id, score)` pairs,
then calls `Fetch(doc_ids, words)` on the replicas that answered for the
winners to get titles, URLs and snippets. Local IDs differ between replicas
and change when a new base loads, so a `Fetch` retried on another replica
looks the page up by `doc_id` instead.

## High-level architecture

![Architecture of the search engine. On the query path, users send GET /search to query frontends, which read a result cache first and, on a miss, pass the query to root aggregators, which scatter it to all 100 shards on the index servers (100 shards × 24 replicas). On the ingest path, the crawler (frontier, fetch, parse) receives fetched pages from websites, writes raw and parsed pages to the page store in object storage, and writes a new version plus an outbox row to the doc table. An outbox relay publishes from the doc table to the update log, which index servers tail for changes. The index builder does a daily scan of the doc table, reads pages from the page store and writes new base segments there, which index servers load.](/diagrams/search-engine/architecture.svg)

The query path, top left:

- **Query frontends** are stateless servers behind a load balancer (a
  component that spreads incoming requests across the servers; see
  [forward vs. reverse proxy](/systems-and-infrastructure/forward-vs-reverse-proxy)). They
  normalize the query (lowercase, split into words) and check the result
  cache.
- The **result cache** maps a normalized query and page number to a finished
  results page for five minutes, a [cache](/systems-and-infrastructure/caching)
  in the plain sense. At peak, five minutes is 18 million queries; if half
  are distinct and each page is 5 KB, that's 45 GB across a few cache
  servers.
- **Root aggregators** send each query to one replica of every shard, merge
  the answers and fetch snippets. This pattern, one request fanned out to
  many servers and the answers combined, is **scatter-gather**.
- **Index servers** each hold one shard in memory: a base index built daily,
  plus the changes since, read from the update log.

The ingest path, right:

- The **crawler** keeps the **frontier**, the queue of URLs due for fetching
  ordered by `next_fetch_at`, and runs fetchers that download, parse and store
  pages.
- The **doc table + outbox** records every change; an **outbox relay** copies
  new outbox rows to the **update log**, a durable log split into 100
  partitions, one per shard, kept for seven days.
- The **index builder** is a daily batch job: it recomputes link-based
  quality scores and builds a fresh base index for each shard.

Following `paris weather` through a cache miss:

![Sequence of one query, paris weather, on a result-cache miss. The query frontend asks the result cache and gets a miss, then sends the search to the root aggregator with a 250 ms budget. The aggregator sends phase 1, top 10, to all 100 shards; for shard 37, replica A doesn't reply within 30 ms, so the aggregator sends the same request to replica B as a hedge, gets its top 10 IDs and scores, and cancels the request to replica A. The aggregator merges 100 lists into the global top 10, sends phase 2 to replica B asking for snippets for its 2 winners, and gets titles, URLs and snippets back. It returns 10 results to the frontend, which sets the cache entry with a TTL of 5 minutes.](/diagrams/search-engine/query-sequence.svg)

1. The frontend misses the cache and gives an aggregator a 250 ms budget,
   leaving 50 ms of the 300 ms target for the network and the frontend.
2. **Phase 1.** Each of the 100 shards returns its own ten best `doc_id`s and
   scores, a few hundred bytes. A slow replica gets a backup request (the
   first deep dive).
3. The aggregator merges 100 lists into the global ten. No shard's eleventh
   result is needed: each global winner is in its own shard's top ten.
4. **Phase 2.** Only the replicas that answered for a winner, at most ten,
   send titles, URLs and snippets, so no text is shipped for the 990 losers.
5. The frontend caches the page with a five-minute **TTL** (time to live,
   after which the entry is dropped) and returns it.

## Deep dive: splitting the index across machines

A 1.5 TB index doesn't fit one machine, so it has to be split, and there are
two ways to cut it. [Partitioning vs. sharding](/systems-and-infrastructure/partitioning-vs-sharding)
covers the general idea; the question here is what to split by.

**By word (term-partitioned).** Each shard owns every posting for a range of
words: one shard has all of `paris`, another all of `weather`. A query touches
only the shards for its own words, two here instead of 100. It costs a lot,
though:

- A multi-word query must intersect posting lists that live on different
  machines. Suppose `weather` appears in 5% of pages: that's 50 million
  postings, about 300 MB at 6 bytes each. Shipping even a pruned slice of that
  between machines on every query, at 36,000 queries a second, is far beyond
  what the network can carry within the latency budget.
- Load follows word popularity. The shard holding `the` or `weather` is
  asked far more often than the one holding `quinoa`, so hot shards need many
  more replicas, and the right number shifts with the news.
- A changed page touches about 250 posting lists, spread across nearly every
  shard, so the 400 updates a second become 100,000 posting-list writes a
  second.

**By page (document-partitioned).** Each shard owns every posting for its own
10 million pages, and a page's shard is `doc_id mod 100`. Since `doc_id` is a
hash, pages spread evenly, and so does load. A shard intersects `paris` and
`weather` locally and returns ten results, so nothing large crosses the
network. A changed page touches one shard. The cost is fan-out: every query
goes to all 100 shards, which is where the 3.6 million shard requests a
second come from, and the query is only as fast as its slowest shard.

**Chosen: by page.** Fan-out costs CPU, which the estimates already pay for,
while splitting by word costs network and uneven load, which are harder to
buy. The price that remains is **tail latency**: the slow end of the latency
distribution.

Assume each shard answers in 12 ms at the median, 30 ms at p95 and 50 ms at
p99. The chance that all 100 shards beat their own p99 on one query is 0.99¹⁰⁰
≈ 0.37, so 63% of queries wait on at least one shard slower than 50 ms. A
shard's rare slow moment (a garbage-collection pause, a noisy neighbour, a
full network queue) becomes the common case for the query. Two options:

- **Wait, with a deadline.** Give each shard 100 ms; answer without any shard
  that hasn't replied. Simple, and it bounds latency, but each shard that
  misses the deadline drops 1% of the corpus from the results.
- **Hedged requests**, described in Dean and Barroso's 2013 paper _The Tail
  at Scale_: if a replica hasn't replied by the shard's p95 (30 ms), send the
  same request to a second replica and take whichever answers first,
  cancelling the other. About 5% of shard requests get a copy, so load rises
  5%, the figure the estimates include. Because a slow moment on one machine
  is rarely shared with another, the second copy usually comes back in about
  a median time, around 30 + 12 = 42 ms.

**Chosen: both.** Hedge at 30 ms, and keep the 100 ms deadline as the floor
for the rare case where both copies are slow. The query's p99 is then set
mostly by hedged shards at roughly 50-100 ms, well inside 250 ms, and
partial results are rare. Hedging only helps if repeating a request is safe;
`Search` and `Fetch` are pure reads, so a duplicate costs CPU and nothing else.

Two further costs of this split. Ranking needs corpus-wide word counts, and a
shard sees only its own 1%, so the daily build computes them globally and
ships them to every shard; otherwise scores from different shards wouldn't be
comparable at the merge. And moving to 200 shards changes `doc_id mod 100`
for half the pages, but since the builder rebuilds every shard daily anyway,
that's one planned cutover rather than a live migration.

## Deep dive: ranking within the time budget

Every shard must pick its ten best pages in about 10 ms of CPU. For
`weather`, 5% of a shard's 10 million pages match: 500,000 candidates.

Two kinds of signal decide ranking:

- **Query-dependent**, how well a page's text matches the words. The standard
  starting point is **BM25**, a formula that scores a page higher when the
  query words appear in it often, when those words are rare in the corpus
  (hence the global counts), and when the page isn't simply long.
- **Query-independent**, how good the page is regardless of the query: a
  **static rank** such as PageRank (published by Brin and Page in 1998),
  computed from which pages link to which, plus signals like URL depth. The
  daily builder computes it for all pages from the parsed outgoing links.

A learned model combining dozens of such features ranks better than BM25
alone, but costs more: assume 10 µs per page. Three ways to spend the budget:

**Score every match with the full model.** 500,000 × 10 µs = 5 seconds per
shard for `weather`. Out of the question.

**A tiered index.** Build a small top tier holding, say, the 10% of pages
with the highest static rank, search it first, and fall back to the full
index only if the top tier returns too few good matches. It cuts work for
common queries about tenfold, but a second index doubles the build and
update paths, and the fallback is a second round trip to every shard,
adding its latency to the queries that need it.

**A cascade inside each shard.** Assign local IDs in static-rank order at
build time, so page 1 is the shard's best page and every posting list runs
from best page to worst. Then, in two phases:

1. Walk the posting lists scoring with the cheap formula (BM25 plus static
   rank), keeping the best 200. Algorithms such as WAND (Broder et al., 2003)
   skip postings that provably can't enter the current top 200, and because
   lists run best page first, the top 200 fill with strong candidates early
   and the skips come sooner. This is where most of the 10 ms goes.
2. Score those 200 with the full model: 200 × 10 µs = 2 ms. Return the top
   ten.

**Chosen: the cascade.** It stays one index and one round trip, and the
expensive model sees only 200 pages per shard. What it costs: a page the cheap
formula ranks 201st on its shard can never be rescued by the full model, so
the cheap formula must be good enough to put the right pages in the top 200.
Running the full model on the shard, rather than at the aggregator, avoids
shipping 100 × 200 = 20,000 feature sets per query; the model ships with the
daily base, so shards disagree on its version only during a rollout.

Pages that were just updated live in the day's change set, not the static-rank
order (the next deep dive), so each shard scans that small set, 350,000 pages
at most, separately and merges its candidates into the same top 200.

## Deep dive: keeping the index fresh

A new article must be searchable within 10 minutes of being fetched. Posting
lists are compressed and sorted, which makes them fast to read and awkward to
change. Three options:

**Rebuild everything periodically.** A batch job builds each shard's index
from scratch every day. The index is always compact and the process is
simple, but a change waits up to a day, which fails the 10-minute target by
more than a hundredfold.

**Update posting lists in place.** Insert the page's ID into 250 compressed
lists, rewriting part of each while queries read it, which needs locking or
copy-on-write on every list. It also breaks the static-rank ID order the
ranking deep dive depends on.

**An immutable base plus a small live index.** The base, built daily, is never
modified. Changes since the base go into a small in-memory index on each
replica, and a query searches both. A page that changed since the base is
marked in a **deleted-set** (a bitmap of base local IDs to skip), so its old
base copy is hidden (an older live copy is simply replaced) and only the new one in the live index can match. This is
the approach search libraries such as Lucene take with their segments.
Queries pay for a second, small lookup (350,000 pages at most, 3.5% of the
shard), and memory holds a day of changes, the 1.2 GB estimated earlier.

**Chosen: base plus live index.** It meets the target with a small, bounded
cost, and the daily rebuild keeps the live index from growing. The hard part
is the write path from crawler to index, which crosses three systems.

**The write path, step by step.** A fetcher, holding the URL's row as read at
`version = 7`:

1. Downloads the page (with `If-Modified-Since`, so an unchanged page can
   answer `304 Not Modified` without sending its body), parses it and computes
   `content_hash`.
2. Writes `raw/<hash>` and `parsed/<hash>` to the page store.
3. In one database transaction on the row's shard: update `docs` with
   `version = 8`, the new hash and `next_fetch_at`, **only if `version` is
   still 7**; and insert the outbox row `(doc_id, version 8, upsert, hash)`.
4. A relay reads outbox rows in order, publishes each to the update log
   partition for the page's shard, and marks it sent.
5. Every replica of that shard tails the partition, fetches `parsed/<hash>`,
   and adds the page to its live index, which is searchable within seconds.

If the content hash is unchanged, step 3 only updates `fetched_at` and
`next_fetch_at`, with no version bump and no outbox row. A page that returns
`404` or `410` gets the same treatment as a change: `version` bumps,
`content_hash` becomes null, and the outbox row says `delete`.

Writing the change and the notification in one transaction is the
[outbox pattern](/systems-and-infrastructure/outbox-pattern): writing to the
database and then publishing directly to the log would lose the publish
whenever the fetcher died between the two. What each crash does:

- **After step 2, before step 3:** the objects exist but nothing refers to
  them. The row still has its old `next_fetch_at`, so the URL is fetched again
  on the next pass. A weekly sweeper deletes objects no row has referenced for
  a week.
- **During step 3:** the transaction commits both rows or neither.
- **After step 3, before step 4 finishes:** the outbox row is still unsent,
  and the relay publishes it when it restarts.
- **After publishing, before marking sent:** the relay publishes it again.
  The update log now holds a duplicate.
- **A replica crashes:** its live index was only in memory. On restart it
  loads the current base and replays the log from the base's start point,
  below.

Duplicates are expected, since the relay delivers at least once, and they are
removed by version. Each replica keeps the highest `version` it has applied
per page (10 million × 4 bytes = 40 MB) and ignores any log record whose
version isn't higher. That makes applying a record
[idempotent](/systems-and-infrastructure/idempotency), and it also makes the
order of records irrelevant: a late copy of version 7 arriving after version 8
is dropped.

The conditional write in step 3 is what keeps versions honest. The crawler
gives each fetcher a **lease** on a set of sites, a claim that expires unless
renewed, so one fetcher paces requests to a site; see
[distributed locks](/systems-and-infrastructure/distributed-locks). A lease
can expire while its holder is still working, stuck in a long pause, and
another fetcher can then fetch the same URL. Both read `version = 7`; the
first to commit writes 8, and the second's "only if still 7" fails, so it
discards its copy. If that copy was the newer one, the change is picked up on
the page's next scheduled fetch. Nothing in the index double-counts.
What can't be fenced is the site itself: for the length of one lease, it may
see two fetchers and twice the polite rate. Keeping leases short (a minute)
bounds that.

**Swapping in a new base.** The daily builder scans the doc table, which takes
hours; say the scan for shard 37 starts at 02:00. It builds the base from the
parsed pages, in static-rank order, with each page's `version`, and writes the
files to the page store. It then advances shard 37's manifest, a small record
naming the current base, with a conditional write: only if the new base's scan
start time is later than the current one's. A builder run that stalled and
finishes after a newer one therefore fails to install an older base. A replica
loads the new base beside the old one (the 73 GB), then replays the update log
from 01:00, an hour before the scan began, applying only records with a
version above what the base holds. A change committed after the scan read its
row was published after 02:00, so the replay covers it; the hour of margin
absorbs relay lag, and the version check makes the overlap harmless. The seven-day log retention leaves six days of room for
a failed build to be retried before replay would need records the log no
longer has.

**The freshness budget.** The relay polls every second, and a replica adds
changes to its live index within seconds, so the pipeline is normally under a
minute. The result cache can serve a page up to five minutes old. Together
that's about six minutes, inside the 10-minute target, with four minutes of
headroom for relay or log lag, which is monitored and alerted on. A fast-set
page is refetched within an hour of changing, so it's in results within about
70 minutes of the change.

## Failure modes and bottlenecks

- **A slow or dead replica.** Hedging hides a slow one. A replica that keeps
  missing deadlines is taken out of rotation by the aggregators, in the manner
  of a [circuit breaker](/systems-and-infrastructure/circuit-breaker), and its
  load spreads across the others.
- **Every replica of a shard in one region down.** Aggregators send that
  shard's requests to another region with a longer deadline (about 200 ms)
  and no 30 ms hedge, adding perhaps 50-100 ms, which the 250 ms budget
  absorbs. If that also fails, results come back
  without the shard: 1% of pages missing, flagged internally and not cached,
  so the gap doesn't outlive the outage by five minutes.
- **A whole region down.** The other two regions carry the peak at 74% CPU
  with hedging, per the estimates. There's no room to also lose a second
  region's worth of machines; at that point, shed load by answering cached
  queries only.
- **A query that crashes shards.** Every query reaches every shard, so one
  that triggers a bug can take down a replica of all 100 shards at once, and
  more as it's hedged and retried. Aggregators note the queries in flight when
  a replica dies and refuse, for an hour, any query linked to two crashes.
- **A bad base build.** A build with far fewer pages than yesterday, or that
  fails a fixed set of sample queries with known good answers, isn't
  installed. A good-looking build rolls out to one replica per shard first,
  and the previous base stays in the page store for a rollback.
- **A hot query after its cache entry expires.** Thousands of identical
  requests arrive in the same second and all miss, the
  [thundering herd](/systems-and-infrastructure/thundering-herd-problem).
  Each frontend lets one request for a given key through to the aggregators
  and has the rest wait for its answer.
- **Crawler traps.** A calendar that links to next month forever can eat the
  crawl budget; a per-site cap on URLs and daily fetches bounds it. A site
  that answers slowly or with errors has its rate cut, per
  [exponential backoff](/systems-and-infrastructure/exponential-backoff).
- **Duplicate pages.** Mirrors serve the same page under many URLs. Pages
  with the same `content_hash` are indexed once, under the URL with the
  highest static rank; near-duplicates that differ by a date or an ad slip
  through.

## Trade-offs

- **Split by page, not by word.** Load spreads evenly, updates touch one
  shard, and nothing large crosses the network; in exchange every query costs
  100 shard requests, and latency is set by the slowest.
- **Hedging** buys a predictable tail for 5% more index load. It works
  because searches are reads; the same trick on a write path would need
  idempotency first.
- **A ranking cascade** puts the expensive model on 200 pages per shard. A
  good page the cheap formula misses stays missed.
- **Base plus live index.** Changes appear within minutes, while the base
  stays compact and in static-rank order. Queries pay a second lookup, and
  the write path needs an outbox, versions and a fenced manifest to stay
  correct across three systems.
- **A five-minute result cache** takes 40% of peak traffic off 2,400 machines
  and spends half the freshness budget on staleness. A shorter TTL is the
  lever if news queries feel stale.
- Holding **everything in memory** needs 128 GB machines; serving from SSD
  would be cheaper per gigabyte but add roughly 100 µs for each posting-list
  block read, and a query reads many.

What would change the design: at ten times the corpus, 1,000 shards would
make one aggregator's fan-out too wide, and aggregators would form a tree
(each merging 30 or so shards, then a root merging those). At ten times the
query rate, the tiered index rejected above would pay for its complexity,
since cutting per-query CPU tenfold for common queries would save thousands
of machines.
