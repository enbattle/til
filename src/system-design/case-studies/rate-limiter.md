---
title: Design a Rate Limiter (like an API gateway's)
summary: A token bucket per API key, counted by one atomic script in a sharded Redis, with a failure policy chosen per endpoint, for 580,000 requests a second at peak.
date: 2026-10-05
order: 2
template: 3
---

You're asked to design the rate limiter for a public API. A **rate limiter** decides, for each request, whether its sender is still within an allowance ("20 requests a second for this customer") and answers `429 Too Many Requests` if not. Checking one request is easy. The hard part is doing it correctly across dozens of servers, in under 2 ms, while the counters themselves can fail.

The answer is a bucket of allowance per client, kept in one shared store, with a fallback chosen per endpoint for when that store fails. This page starts with the obvious design and where it breaks, then follows a request through the design that replaces it, sizes its parts, and makes three decisions: how to count, where to count, and what to do when counting fails. The algorithms are in [rate limiting](/systems-and-infrastructure/rate-limiting).

## Requirements

- Limit per **API key**, the secret string that identifies a customer's application, by plan: free at 60 a minute, and Pro at 20 a second with up to 100 at once after a quiet spell (20 × 60 = 1,200 a minute).
- Where there is no key yet, limit per IP address: 10 a minute on `POST /v1/login`.
- Reject with `429` and a `Retry-After` header saying how long to wait, and report the remaining balance.
- Rules live in config, with a **shadow mode** that logs what a new rule would reject without rejecting.
- 5 billion requests a day, a check under 2 ms at p99 (99% of checks are faster), and one allowance per client whichever server it reaches.
- The API is up 99.99%, so it keeps answering when the limiter's store fails, except on endpoints marked to refuse.

Out of scope: monthly quotas, network floods and several regions. First, would the obvious design meet these?

## Start simple

The obvious design keeps one counter per API key in a database. Every request passes through a **gateway node**, one of many identical servers in front of the backend. The node reads the key's count for the current second, answers `429` if it has reached the limit, and otherwise adds one and passes the request on. A **load balancer** spreads requests over the gateway nodes, so every node asks the same database and a client gets one allowance whichever node it reaches.

For a small API that's fine. Say it gets 1 million requests a day, and peak traffic is ten times the average ([numbers every engineer should know](/engineering-practices/numbers-every-engineer-should-know)), and assume a database server answers about 50,000 checks a second:

```text
average:
  1,000,000 ÷ 86,400 s ≈ 12 a second
peak:
  12 × 10 = 120 a second
```

One database server handles that easily. Now run the same steps on 5 billion requests a day:

```text
average:
  5,000,000,000 ÷ 86,400 s ≈ 58,000 a second
peak:
  58,000 × 10 = 580,000 a second
database servers:
  580,000 ÷ 50,000 ≈ 12
```

Spreading 580,000 checks a second over 12 servers works, each holding a slice of the keys called a **shard**, and the final design keeps those 12 shards. The breaks are elsewhere. A call to a disk-backed database takes about 5 ms (an assumption), 2.5 times the whole 2 ms budget. And reading the count, then adding one, is two steps: two nodes can both read 99 against a limit of 100, and both allow.

So the counters need a faster store and a one-step update, and the 12 shards carry over. That store, and what surrounds it, is the architecture.

## High-level architecture

![Architecture of the rate limiter. API clients send requests to a load balancer, which spreads them over the gateway nodes. Each gateway node runs the limiter library that makes the check. A rules config pushes rule changes to the gateway nodes. Each gateway node updates the client's allowance with one call per check to the counter store, which is split into shards, each with a backup copy. Allowed requests go on to the backend services, and every node sends its decisions and 429 counts to metrics.](/diagrams/rate-limiter/architecture.svg)

Follow a Pro customer's request. The load balancer sends it to any gateway node. The node looks up the API key (cached in memory, [caching](/systems-and-infrastructure/caching)) to find the customer's rule, such as "20 a second, up to 100 at once". It then makes one call to the **counter store**, which holds each client's unspent allowance as a **bucket**, built in the first decision, and the store answers allow or reject.

If the request is allowed, the node passes it to a backend service. If not, the node answers `429` itself. The counter store is **Redis**, a fast in-memory key-value store, split into the shards from "Start simple", and each shard has a **replica**, a backup copy on another node that takes over if it fails.

The limiter is a library inside the gateway node, not a separate service, since every request passes through the gateway already. A separate service would add a second network hop of about 0.5 ms (an assumption), a quarter of the 2 ms budget. The **rules config** pushes changes to every node, and every node sends its decisions to **metrics**, a record of allows and `429`s.

That puts one store call on every request, so how big do the parts have to be?

## Key numbers

These size the gateway nodes, the counter store's shards and memory, and the time a check takes. A day is 86,400 seconds, and peak is ten times the average.

- **Gateway nodes:** 40. Peak is 580,000 requests a second, as worked out in "Start simple". Assume one node handles 20,000 a second and plan it at 15,000 to leave headroom: 580,000 ÷ 15,000 ≈ 39, rounded up to 40.
- **Counter store, calls:** 580,000 a second at peak, one per request. Assume a Redis node runs 100,000 a second and plan it at half, 50,000: 580,000 ÷ 50,000 ≈ 12 shards. With a replica each, 12 × 2 = 24 nodes.
- **Counter store, memory:** about 100 MB. Assume 1 million active keys with 100 bytes of state each: 1,000,000 × 100 = 100,000,000 bytes.
- **Check time:** one round trip to the store within a datacenter, about 0.5 ms (assumed). 0.5 ÷ 2 = a quarter of the 2 ms budget.

Next, what a client sees and what the store keeps.

## API and data model

The limiter has no endpoint of its own. It adds headers to every response:

```http
HTTP/1.1 200 OK
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 57
X-RateLimit-Reset: 3        (seconds until the bucket is full)

HTTP/1.1 429 Too Many Requests
Retry-After: 1
{ "error": "rate_limited", "rule": "pro-per-key" }
```

```text
rule     pro-per-key: dimension api_key, rate 20/s, burst 100, mode enforce
bucket   key rl:pro-per-key:key_3a91 -> { tokens: 57.4, ts: 1790000000.123 }
         expires burst ÷ rate seconds after its last update
```

In `shadow` mode, the node runs the same check and logs the rejection it would have made, but allows the request. The expiry costs no accuracy: after `burst ÷ rate` = 100 ÷ 20 = 5 seconds of silence the bucket would be full anyway, and a missing bucket counts as full, so idle clients take no memory.

That's the shape. The first decision is what a bucket holds and why.

## Decision: a token bucket per key

The simpler way to count is a **sliding-window counter** ([rate limiting](/systems-and-infrastructure/rate-limiting) covers both algorithms): keep two counts per client, this minute's and last minute's, and blend them to estimate the last 60 seconds. For Pro that is 1,200 a minute. It breaks on bursts. An idle client can send all 1,200 in one second, when the backend is planned for 20 a second. And because the blend assumes last minute's traffic was spread evenly, a client that sent it all at the end of the minute can briefly get nearly twice the limit.

So each client gets a **token bucket**. Take the Pro key `key_3a91`: its bucket holds up to 100 tokens, refills at 20 a second and spends one per request, and an empty bucket means `429`. In any second it admits at most 100 + 20 = 120, ten times fewer than 1,200. In any minute it admits at most 100 + 20 × 60 = 1,300, a peak the backend can plan for.

The price is a limit that is harder to explain: it is documented as "20 a second, burst of 100", not "1,200 a minute".

**Rule of thumb.** Choose the algorithm by the worst burst the backend can absorb, not by the average rate it's allowed.

## Decision: one atomic script in a shared store

A client's requests land on any of 40 nodes, so where does its bucket live? The simpler answer is in each node's memory, synced every 100 ms. That cuts store traffic to 40 nodes × 10 syncs a second = 400 calls a second. It breaks on overshoot: between syncs, `key_3a91` can spend its burst of 100 on every node, 40 × 100 = 4,000 requests. Splitting the limit evenly instead gives each node a fortieth, 20 ÷ 40 = 0.5 a second, and a client on one long-lived connection, kept on one node, gets only that.

So the bucket lives where all nodes can reach it: the sharded Redis, with the shard picked by hashing the key ([sharding](/systems-and-infrastructure/partitioning-vs-sharding)). Each check is one small **Lua script**, a program Redis runs as a single step with nothing in between. Two nodes can't both see one token left and both allow ([race conditions](/systems-and-infrastructure/race-conditions)), and "Start simple"'s read-then-add problem is gone.

The price is a 0.5 ms round trip on every request and 24 store nodes to run, which local counting avoids.

**Rule of thumb.** A limit that must hold across servers is counted in one place, atomically; sync lazily only if overshooting by the server count is acceptable.

## Decision: a failure policy per endpoint

Every request now waits on the store, so what happens when it doesn't answer? The simpler policy is to fail open everywhere, meaning to allow the request, so a limiter outage never takes the API down. For reads that is right. It breaks where a wrong allow is costly. Login is limited to 10 a minute per IP, but with the limiter blind an attacker sending 100 guesses a second makes 100 × 60 = 6,000 a minute, and 6,000 ÷ 10 = 600 times the limit. And every text message an endpoint sends costs money.

So the fallback is set per endpoint. Reads fail open: allowed, unlimited for keys on the failed shard. Login counts locally: each node gets a fortieth of the limit, 10 ÷ 40 = 0.25 a minute, so its bucket refills at 0.25 a minute but holds at least one token. One IP spraying all 40 nodes gets 40 tries in one minute, then waits 1 ÷ 0.25 = 4 minutes for the nodes to refill, which averages 40 ÷ 4 = 10 a minute. Sending a text fails closed: refused.

To notice a failure quickly, calls time out at 5 ms and each shard has a [circuit breaker](/systems-and-infrastructure/circuit-breaker): after enough failures, nodes stop calling that shard and apply the fallback straight away. The timeout alone isn't enough, because 5 ms is 2.5 times the 2 ms budget, and with one of 12 shards hung about 1 request in 12 would blow it.

The price is that a refusing endpoint turns away good customers during an outage, and the local login limit is cruder: an IP can make 40 tries in one minute, though it averages about 10 a minute.

**Rule of thumb.** When the limiter itself fails, decide per operation: favor availability where a wrong "allow" is cheap, safety where it isn't.

## Likely follow-ups

- **What if one key sends 100,000 requests a second?** A rejection says when the bucket next has a token, so each node can remember "reject this key until then" and answer from memory. At a token every 50 ms, the 40 nodes make about 40 × 20 = 800 store calls a second for it.
- **How would you add a global limit, say 20,000 a second on search?** As one store key it would put every search check on one shard, whose plan is 50,000 a second, and rejected requests count too. Give each node a local share instead, 20,000 ÷ 40 = 500 a second.
- **What should a client do on a `429`?** Wait `Retry-After`, then back off with jitter, a small random delay so clients don't retry together ([exponential backoff](/systems-and-infrastructure/exponential-backoff)).
- **What changes across regions?** A cross-region round trip costs about 50 ms against a 2 ms budget, so each region keeps its own store and a share of each limit.
