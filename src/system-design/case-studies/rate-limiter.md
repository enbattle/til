---
title: Design a Rate Limiter (like an API gateway's)
summary: A token bucket per API key, counted by one atomic script in a sharded Redis, with a failure policy chosen per endpoint, for 580,000 requests a second at peak.
date: 2026-10-05
order: 2
---

You're asked to design the rate limiter for a public API. A **rate limiter**
decides, for each request, whether its sender is still within its allowance
("20 requests a second for this API key") and answers `429 Too Many Requests`
if not. The difficulty is counting correctly across dozens of
servers, adding almost no latency, and surviving the counters breaking. The algorithms are in [rate limiting](/systems-and-infrastructure/rate-limiting).

## Requirements

- Limit per **API key** (the secret string identifying a customer's
  application) by plan, free at 60 a minute and Pro at 20 a second with bursts of 100 (about 1,200 a minute), and per IP
  address where there is no key yet: 10 a minute on `POST /v1/login`.
- Reject with `429` and `Retry-After`; report the balance.
- Rules live in config, with a **shadow mode** that logs what a new rule would
  reject without rejecting.
- 5 billion requests a day, a check under 2 ms at p99 (99% of checks are
  faster), and one allowance per client whichever server it reaches.
- The API is up 99.99%, so it keeps answering when the limiter's store fails,
  except on endpoints marked to refuse.

Out of scope: monthly quotas, network floods and several regions.

## Key numbers

These size the servers that run the check and the shared store they call.
Peak is ten times average
([numbers every engineer should know](/engineering-practices/numbers-every-engineer-should-know)):

- **Requests:** about 580,000 a second at peak. 5 billion ÷ 86,400 ≈ 58,000 a
  second on average.
- **Gateway servers:** 40. Assume one handles 20,000 a second and plan it at
  15,000: 580,000 ÷ 15,000 ≈ 39.
- **Store calls:** 580,000 a second, one per request, so 12 shards (slices of
  the keys, one per node) at 50,000 each, 24 nodes with replicas. Assume a
  Redis node runs 100,000 scripts a second; plan at half.
- **Memory:** about 100 MB. 1 million active keys × 100 bytes of state each.
- **Latency:** one 0.5 ms round trip to the store within a datacenter, a
  quarter of the 2 ms budget.

## High-level architecture

![Architecture of the rate limiter. API clients send requests to a load balancer, which spreads them over the API gateway nodes. Each gateway node runs the limiter library. A rules config pushes rule changes to the gateway nodes. The gateway nodes run atomic bucket scripts against a counter store made of Redis shards with replicas. Allowed requests go on to the backend services, and every node sends its decisions and 429 counts to metrics.](/diagrams/rate-limiter/architecture.svg)

Follow a Pro customer's request. The **load balancer** sends it to any
**gateway node**, the layer every API request passes through. The node
looks up the API key (cached in memory,
[caching](/systems-and-infrastructure/caching)), picks the matching rule, and
runs one script against the **counter store**. If the bucket allows it, the
request goes to a **backend service**; if not, the node answers `429` itself. The limiter is a library in the gateway, since every request
passes there already; a separate service would add another quarter of the
budget in a second hop. The **rules config** pushes changes to every node, and
**metrics** receive every decision.

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

The expiry costs no accuracy: after `burst ÷ rate` seconds of silence the
bucket would be full anyway, and a missing bucket counts as full, so idle
clients take no memory.

## Decision: a token bucket per key

Take the Pro key `key_3a91`. Its **token bucket** holds up to
100 tokens, refills at 20 a second and spends one per request; an empty bucket
means `429`. In any second it admits at most 120, and in any minute at most
1,300, a peak the backend can plan for.

Why not a sliding-window counter, which keeps two counts a client? It lets an idle client send all 1,200 in one second, ten times the
bucket's peak, and, because it assumes last minute's traffic was spread evenly, a client that sent it all at the end can briefly get nearly twice the limit. The bucket's price: the limit is documented as "20 a
second, burst of 100", not "1,200 a minute".

**Rule of thumb.** Choose the algorithm by the worst burst the backend can
absorb, not by the average rate it's allowed.

## Decision: one atomic script in a shared store

A client's requests land on any of 40 nodes, so the bucket lives where all of
them can reach it: a sharded Redis, a fast in-memory key-value store, with the
shard picked by hashing the key
([sharding](/systems-and-infrastructure/partitioning-vs-sharding)). Each check
is one small Lua script that Redis runs as a single step, so two nodes can't
both see one token left and both allow
([race conditions](/systems-and-infrastructure/race-conditions)). The price is a 0.5 ms round trip per request and 12 shards.

Why not count in each node's memory and sync every 100 ms? That cuts store
traffic to a few hundred calls a second, but between syncs `key_3a91` can
spend its burst of 100 on every node: up to 4,000 requests. Splitting the limit evenly gives
each node a fortieth, and a client on one long-lived connection, kept on one node, gets only that fortieth.

**Rule of thumb.** A limit that must hold across servers is counted in one
place, atomically; sync lazily only if overshooting by the server count is
acceptable.

## Decision: a failure policy per endpoint

Every request waits on the store. Calls time out at 5 ms and each shard has a
[circuit breaker](/systems-and-infrastructure/circuit-breaker): after enough
failures, nodes stop calling that shard and apply a fallback straight away. The
timeout alone isn't enough: 5 ms is 2.5 times the p99 budget, and with one of
12 shards hung about 1 request in 12 would blow it. The fallback is set per
endpoint. Reads **fail open**: allowed, unlimited for keys on that shard. Login
counts locally, each node allowing a fortieth of the limit, at least one
attempt, so one IP spraying all 40 nodes gets about 40 tries, then about 10 a
minute. Sending a text message **fails closed**: refused.

Why not fail open everywhere, the usual default? For reads it is right. But
unlimited logins are password guessing and every text costs money, so for those two a crude local limit or a refusal is cheaper than being unguarded.

**Rule of thumb.** When the limiter itself fails, decide per operation: favor
availability where a wrong "allow" is cheap, safety where it isn't.

## Likely follow-ups

- **What if one key sends 100,000 requests a second?** A rejection says when
  the bucket next has a token, so each node can remember "reject this key until
  then" and answer from memory. At a token every 50 ms, the 40 nodes
  make about 40 × 20 = 800 store calls a second for it.
- **How would you add a global limit, say 20,000 a second on search?** As one
  store key it would put every search on one shard, already near its 50,000 plan.
  Give each node a local share instead, 500 a second at 40 nodes.
- **What should a client do on a `429`?** Wait `Retry-After`, then back off with jitter
  ([exponential backoff](/systems-and-infrastructure/exponential-backoff)).
- **What changes across regions?** A cross-region round trip costs about 50 ms
  against a 2 ms budget, so each region keeps its own store and a share of
  each limit.
