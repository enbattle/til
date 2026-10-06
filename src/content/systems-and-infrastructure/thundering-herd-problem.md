---
title: Thundering Herd Problem
summary: When one event, such as a cache entry expiring, sends many clients to the same resource at once, and the ways to keep that burst from overwhelming it.
date: 2026-09-15
---

Picture an online shop with a product page for one mug. The page is expensive to build: it takes a database query that runs for about 2 seconds. So the shop keeps the finished result in a [cache](/systems-and-infrastructure/caching), a fast store that holds a copy, and the page reads from there. About 1,000 people a second ask for the mug, and nearly all of them are served from the cache. The database sees almost nothing.

Then the cached copy expires. What happens in the next two seconds?

## A cache stampede

Each cache entry has a time to live (TTL), a timer after which the copy is thrown away so it can't go stale forever. The mug's entry has a 300-second TTL. When the timer runs out, the next request finds the entry empty, a **cache miss**, and goes to the database to rebuild it. That takes 2 seconds. During those 2 seconds the cache is still empty, so the other requests arriving each find a miss too, and each starts the same query on its own. At 1,000 requests a second, that is about 2,000 identical slow queries in flight at once, against a database that was seeing none a moment ago.

This is a **cache stampede**, one instance of the **thundering herd problem**: a single event sends many clients to the same limited resource at the same moment, and most of that work is wasted. Only one of those 2,000 queries was needed. The other 1,999 produce the same answer, and they may slow the database enough that the one needed query takes longer, which lets even more requests pile up behind it.

The name comes from operating systems. Several processes could sleep waiting for one event, such as a new connection arriving on a socket. Some early designs woke all of them when it happened, though only one could take the connection. The rest woke, found it gone and went back to sleep, one trigger producing a pile of useless work.

## Stopping the herd from forming

Every fix either makes sure only one client does the work or spreads the clients out in time. Which one fits depends on whether you can tolerate waiting or old data.

**Single-flight**, also called request coalescing, lets exactly one request rebuild the entry. The first miss takes a marker saying "I'm rebuilding this", and every other request for the mug waits for its result instead of querying. Within one server process, a map of in-progress rebuilds is enough. Across many servers you need the marker in shared storage, which is a small [distributed lock](/systems-and-infrastructure/distributed-locks). The cost is that waiting requests are slow for those 2 seconds, and if the rebuilder crashes they need a timeout so they don't wait forever.

**Stale-while-revalidate** removes the waiting. When the entry expires, keep serving the old copy to everyone, and let one request rebuild it in the background. Readers get a slightly old mug page and never see a miss. This only works when slightly old data is acceptable, which for a product page it is and for an account balance it isn't.

**Early expiration** and **jitter** (a small random offset) attack the timing. Instead of letting the entry die at exactly 300 seconds, each request, as the 300-second mark nears, has a small and rising chance of refreshing early, so usually one does it before the timer runs out. Jitter matters most when many entries are created together: a hundred mugs all cached at startup with a 300-second TTL would all expire in the same second, so adding a random few seconds to each TTL spreads those expiries out.

## The same herd, with a different trigger

Caches are the common case, but not the only one. A cache that restarts empty misses on every key at once, and since the keys all differ, only warming it first or letting traffic back in gradually helps. Or suppose the shop's servers keep a live connection open to each browser, and one server restarts. Every client it held reconnects at once, and a service that has only just come back is hit by all of them in its weakest moment. A failed request that is retried on a fixed schedule is the same: everyone who failed together retries together. The fix is the same too. Spread the retries with random delays that grow after each failure, as in [exponential backoff and jitter](/systems-and-infrastructure/exponential-backoff). A [circuit breaker](/systems-and-infrastructure/circuit-breaker) in each client stops sending to a service that keeps failing, and a [rate limit](/systems-and-infrastructure/rate-limiting) on the receiving side caps how much of the herd gets through.

**Rule of thumb.** Whenever many clients wait on one event, such as an expiry, a restart or a retry timer, ask who will act at that instant. If the answer is "all of them", make one of them do the work and let the rest reuse it, or give each a different moment to act.

## Where you'll meet this

A URL shortener has the cache version: one link goes viral, its entry expires, and thousands of concurrent redirects miss together and query the database for the same row. In chat, a server restart or network blip drops every connection at once, and the reconnect storm is the herd, so clients need jittered delays. A notification pipeline has the scheduled version: a digest job set for 9:00 starts every account's work in the same minute, and unjittered retries after a provider outage arrive together.
