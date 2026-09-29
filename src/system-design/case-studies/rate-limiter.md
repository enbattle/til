---
title: Design a Rate Limiter (like an API gateway's)
summary: Holding every API key, user and IP address to its allowance across forty gateway nodes, with a check that costs under two milliseconds and a plan for when its counter store goes down.
date: 2026-09-28
order: 2
---

A public API is shared by everyone who calls it. One customer's runaway script,
a scraper, or someone guessing passwords can use up capacity that thousands of
other customers are paying for. A **rate limiter** is the component that
decides, for each incoming request, whether its sender is still within its
allowance ("20 requests a second for this API key") and turns the request
away if not. The idea, and the basic algorithms, are covered in
[rate limiting](/systems-and-infrastructure/rate-limiting); this case study
takes them further, into what it takes to enforce limits consistently across a
fleet of servers handling over half a million requests a second.

The limiter here sits in an **API gateway**: the layer of servers every API
request passes through before it reaches the services that do the work, which
already handles jobs common to every endpoint, such as checking the caller's
API key. What follows is one plausible design for a limiter like the one in
front of a large public developer API, not a description of how any
particular company built theirs.

## Requirements

Functional requirements say what the limiter does:

- **Check every request against its limits.** Each request is checked against
  every limit that applies to it, and is allowed only if all of them allow it.
- **Several kinds of limit, stacked.** The limits in force here, as a worked
  set:
  - **Per API key**, by plan: a free key gets 60 requests a minute, a Pro key
    1,200 a minute. An **API key** is the secret string that identifies one
    customer's application on each request.
  - **Per user**, also by plan: one account can create several keys, so all of
    an account's keys together get at most 120 a minute on the free plan and
    3,000 a minute on Pro. Without this, a free customer could make fifty keys
    and get 50 × 60 = 3,000 a minute, more than a paying Pro key; with it,
    fifty free keys share 120.
  - **Per IP address**: 6,000 a minute for any one address, and 10 a minute on
    `POST /v1/login`, which runs before the caller has a key. This limit
    catches traffic that has no key, or that rotates through many keys from one
    machine.
  - **Global, per endpoint**: `GET /v1/search` accepts 20,000 requests a
    second across all callers, sustained, with brief peaks up to 10% higher,
    because that is what the search cluster behind it can serve. This limit protects a backend, not fairness between
    clients.
- **Tell the client.** A rejected request gets `429 Too Many Requests` and a
  `Retry-After` header saying when to try again; every response carries headers
  saying how much allowance is left.
- **Rules are configuration.** Limits live in a rules config and change without
  deploying the gateway. A new rule can run in **shadow mode** first, logging
  what it would have rejected without rejecting anything.

Out of scope: monthly quotas and billing for usage (a quota is counted over
weeks and has to be exact for invoicing, which is a metering system, not a
limiter), network-level floods that overwhelm the servers before an HTTP
request exists (the edge network's job), authentication itself (the gateway
already looks up each API key; the limiter uses the result), and running in
several geographic regions at once, which the last section comes back to.

Non-functional requirements, with numbers:

- **Scale:** 5 billion API requests a day reach the gateway, including those it
  rejects. Up to 1 million API keys, 1 million users and 5 million distinct IP
  addresses send traffic in any one minute at peak.
- **Latency:** the check adds less than 2 ms at the 99th percentile (p99, the
  time that 99% of checks beat). It runs on every request, so whatever it costs
  is added to every endpoint's latency.
- **Accuracy:** a limit holds across the whole fleet. A client that spreads its
  requests over every gateway node gets the same allowance as one that talks to
  a single node. Overshooting is acceptable only while part of the limiter is
  failing: on most endpoints the per-client limits may then go unenforced for
  the length of the outage, while endpoints where that is unsafe keep a
  bounded limit or refuse.
- **Availability:** the API targets 99.99%, and the limiter must not be the
  thing that breaks it. If the limiter's own storage fails, the API keeps
  answering, apart from endpoints deliberately marked to refuse.

The check has to be fast for every request, and the store behind it has to
absorb a huge number of small operations:
[latency vs. throughput](/systems-and-infrastructure/latency-vs-throughput)
covers why those differ. The store's latency is paid on every request, and its
throughput is what the estimates below size.

## Back-of-the-envelope estimates

Two rules of thumb from
[numbers every engineer should know](/engineering-practices/numbers-every-engineer-should-know)
are used: plan for a peak of about ten times the average, and a network round
trip within one datacenter costs about 0.5 ms. A day is 24 × 60 × 60 = 86,400
seconds.

**Requests.**

- Average: 5,000,000,000 ÷ 86,400 ≈ 57,870, call it **58,000 requests per
  second**.
- Peak, at ten times average: **about 580,000 requests per second**.

**Gateway nodes.** Assume one gateway node can handle 20,000 requests a second.
It decrypts TLS (the encryption behind `https://`), looks up the key, routes
the request and runs the limit check, but does no business logic. Plan each at
75% of that, 15,000 a second: less headroom than the store below gets, because
gateway nodes hold no data and more can be started in minutes.

- 580,000 ÷ 15,000 ≈ 38.7, so **40 gateway nodes** at peak, each taking about
  14,500 a second. That number matters later: it is how many places one
  client's requests can be counted in.

**Operations on the counter store.** The shared store is **Redis**, an
in-memory key-value store that answers in microseconds and can run small
scripts next to the data. Each request needs two calls to it (the reason for
exactly two is in the "counting across many gateway nodes" deep dive):
one for the API key and user buckets together, one for the IP address bucket.

- 580,000 × 2 = **1,160,000 calls per second** at peak.
- Each call runs a small script of about half a dozen commands. Assume one
  store node can run on the order of 100,000 of those a second, and plan at
  half that, 50,000, to leave headroom for spikes and uneven key spread.
- 1,160,000 ÷ 50,000 = 23.2, so **24 shards**, each with a replica: 48 nodes.
  A **shard** is one node's slice of the keys; spreading keys over shards is
  what lets the store scale past one machine. A **replica** is a second node
  that keeps a copy of its shard's data and takes over if the shard's node
  fails, a switch called **failover**.

**Latency budget.** One in-datacenter round trip is about 0.5 ms, and the two
calls go to their shards in parallel, so they cost one round trip together.
Script execution adds tens of microseconds. That fits inside 2 ms at p99 with
room for queuing, but only if the store is in the same datacenter as the
gateway: a cross-country round trip (about 50 ms) would blow the budget 25
times over.

**Memory: which algorithm decides it.** The "choosing the algorithm" deep dive
compares five; their memory use falls into two groups.

- Constant state per client: a token bucket stores a token count and a
  timestamp (16 bytes of data); a fixed or sliding window counter stores one or
  two counts. Stored as a small key in Redis, each is roughly 100 bytes once
  the key name and the store's bookkeeping are counted. Buckets in use at peak:
  1,000,000 keys + 1,000,000 users + 5,000,000 IPs = 7 million.
  (The global search limit adds nothing here; it is counted in the gateway
  nodes.)
  7,000,000 × 100 bytes = **700 MB**, about 29 MB per shard. That is an upper
  bound, since the data model lets an idle bucket expire within seconds.
- State per request: a sliding-window log stores a timestamp for every
  request in the last minute. Kept in a Redis **sorted set** (a collection
  ordered by a number attached to each entry, here the timestamp, so old
  entries can be trimmed from one end), each entry costs on the order of 100
  bytes. A peak minute is 580,000 × 60 = 34.8 million requests,
  each logged under its key, its user and its IP, so 104.4 million entries ×
  100 bytes ≈ **10.4 GB**, about 435 MB per shard.

Per client the gap is sharper: a Pro key using its full 1,200 requests a
minute needs 1,200 × 100 bytes = 120 KB as a log against about 100 bytes as a
bucket, 1,200 times more.

What the estimates say: memory is not the hard part (even the expensive
algorithm fits), but 1.16 million store calls a second, each on the critical
path of a request, is. The design effort goes into keeping those calls atomic
and cheap, and into what happens when they can't be made at all.

## Data model

Two kinds of data, with very different lives.

**Rules** are small, rarely changed, and read on every request, so every
gateway node keeps all of them in memory and the rules config pushes changes
to the nodes. A few hundred rules take a few kilobytes.

```text
rules
  rule_id        string, primary key  "pro-per-key"
  match          plan and endpoint    plan = pro, endpoint = *
  dimension      enum                 api_key | user | ip | global
  rate           requests per second  20      (1,200 a minute)
  burst          tokens               100
  mode           enum                 enforce | shadow

endpoints
  endpoint       string, primary key  "POST /v1/messages"
  on_store_down  enum                 open | local | closed   (default open)
```

`rate` and `burst` are the two numbers a token bucket needs (the "choosing the
algorithm" deep dive explains the choice): tokens refill at `rate` per second,
and the bucket holds at most `burst`, which is the most requests a client can
send at once after being idle. `on_store_down` belongs to the endpoint, not the
rule, because the same `pro-per-key` rule guards cheap reads and costly text
sends; the "when the counter store is down" deep dive sets it per endpoint.
The worked limits from the requirements, as rules:

| Rule          | Dimension | Rate     | Burst         |
| ------------- | --------- | -------- | ------------- |
| free-per-key  | api_key   | 1/s      | 10            |
| pro-per-key   | api_key   | 20/s     | 100           |
| free-per-user | user      | 2/s      | 20            |
| pro-per-user  | user      | 50/s     | 200           |
| per-ip        | ip        | 100/s    | 500           |
| login-per-ip  | ip        | 1/6s     | 5             |
| search-global | global    | 20,000/s | 2,000 (split) |

The global rule's burst is split across the gateway nodes along with its rate,
as the "counting across many gateway nodes" deep dive describes.

**Counters** are the buckets, one per rule per client, in the counter store:

```text
key:    rl:{u_8f2c}:pro-per-key:key_3a91   rl:{u_8f2c}:pro-per-user
value:  hash { tokens: 57.4, ts: 1790000000.123 }
expiry: burst ÷ rate seconds after the last update (5 s for pro-per-key)
```

Each bucket is a Redis **hash**, a value made of named fields, here two: the
token count and the time it was last updated. The expiry costs no accuracy:
after `burst ÷ rate` seconds of silence the bucket would have refilled
completely, and a missing bucket is treated as a full one, so deleting it
loses nothing. Idle clients cost no memory, which is
why the estimates only count clients active within the last minute. The
`{u_8f2c}` part is the user ID in braces. Redis Cluster places keys by
**hash slot**, one of 16,384 buckets of keys that are divided among the shards,
and when a key name contains braces only the part inside them picks the slot.
Putting the user ID in braces on both the key's bucket and the user's bucket
puts them in the same slot, so one script can check both at once.

The global search limit has no counter here: it is counted in each gateway
node's memory, for reasons the "counting across many gateway nodes" deep dive
gives.

## API design

The limiter has no endpoint of its own for API clients. Its API is the contract
it adds to every response, and a check call inside the gateway.

**An allowed request**

```http
GET /v1/search?q=invoices
Authorization: Bearer <api-key>

HTTP/1.1 200 OK
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 57
X-RateLimit-Reset: 3
```

The headers describe the tightest bucket that applied: it holds up to 100
tokens (`Limit`), 57 whole tokens are left (`Remaining`), and it will be full
again in 3 seconds (`Reset`; (100 − 57.4) ÷ 20 per second ≈ 2.1, rounded up).
Well-behaved clients use `Remaining` to slow down before they hit zero. The
`X-RateLimit-*` names are a widespread convention, not a standard, and APIs
disagree about what `Reset` means (seconds from now, or a clock time), so the
API documentation has to say. An IETF draft standard covers the same idea as
`RateLimit` and `RateLimit-Policy`; a gateway can send both meanwhile.

**A rejected request**

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 1
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 5
Content-Type: application/json

{ "error": "rate_limited", "rule": "pro-per-key", "retry_after_seconds": 1 }
```

`429 Too Many Requests` (defined in RFC 6585) means this client sent too many;
`Retry-After` (RFC 9110) gives a whole number of seconds, zero included, or a
date. A Pro bucket refills one token every 50 ms, so the next token is at most
0.05 seconds away. Rounding up to 1, where `Retry-After: 0` would be legal,
costs a throttled client under a second and avoids inviting a tight retry
loop. Naming the rule in
the body tells the client whether to slow one key down or whether its whole
office IP is over the limit. Clients should wait at least `Retry-After`, and
after repeated rejections back off further with random jitter, as
[exponential backoff](/systems-and-infrastructure/exponential-backoff)
describes; otherwise every rejected client retries at the same instant and the
rejections become their own load.

A request turned away by the **global** search limit gets `503 Service
Unavailable` with a `Retry-After` instead. The client did nothing wrong; the
search cluster is at capacity, and a 429 would tell a well-behaved client that
its own usage was the problem. The 503 has a cost: as a server error it eats
into the 99.99% availability target, sets off 5xx alerts and triggers client
libraries that retry every 5xx, unless the gateway tags these responses so
dashboards and alerts can tell them apart from real failures. That split is a judgment call, and some APIs use 429 for both. (The
sequence diagram below leaves this branch out and shows only the per-client
buckets.)

**The check, inside the gateway**

```text
check(request) -> { allowed, retry_after, headers }
  inputs: api_key -> (user_id, plan) from the key lookup, client IP, endpoint
```

It is a library call inside the gateway process, not a network call to a
separate service; the "where the limiter sits" deep dive compares the two.

## High-level architecture

![Architecture of the rate limiter. API clients send requests to a load balancer, which spreads them over the API gateway nodes. Each gateway node runs the limiter library and holds its share of the global limits. A rules config store pushes rule changes to the gateway nodes. The gateway nodes run atomic bucket scripts against a counter store made of Redis shards with replicas, and sync their global-limit shares through it. Allowed requests go on to the backend services, and every node sends its decisions and 429 counts to metrics.](/diagrams/rate-limiter/architecture.svg)

The pieces:

- The **load balancer** spreads requests across gateway nodes. It knows
  nothing about limits.
- The **gateway nodes** decrypt TLS, look up the API key (cached in memory,
  as [caching](/systems-and-infrastructure/caching) describes, since the same
  keys arrive thousands of times a minute), run the limiter library, and
  forward allowed requests. They are interchangeable: any node can check any
  client, because the counts that must be shared live in the store.
- The **rules config** holds the rules table and pushes changes to every node.
- The **counter store** is a sharded Redis cluster holding the buckets. Each
  shard has a replica that takes over if it fails.
- The **backend services** only ever see requests that passed.
- **Metrics** receive every decision, which is how a bad rule or a store
  problem gets noticed.

Following one request, `GET /v1/search` with a Pro key, through it:

1. The gateway node looks up the API key in its in-memory cache, getting the
   user ID and plan, and picks the rules that match: `pro-per-key`,
   `pro-per-user`, `per-ip` and `search-global`.
2. It checks `search-global` against its own local share of the 20,000 a
   second, with no network call.
3. It sends two bucket scripts to the store in parallel: one for the key and
   user buckets, which live on the same shard, and one for the IP bucket.
4. If every bucket allowed the request, it goes to the search service and the
   response goes back with the rate-limit headers. If any bucket was empty, the
   node answers 429 itself and the search service never hears of it.

![Sequence of one request, GET /v1/search, through the check. The API client sends the request with its API key to a gateway node. The node looks up the key, matches the rules and checks its local share of the global search limit. In parallel, it sends one bucket script to the shard holding the key and user buckets and one to the shard holding the IP bucket, and each shard answers whether it allowed the request and how many tokens are left. If every bucket allowed it, the node forwards the request to the search service, gets 200 OK with results, and answers the client 200 OK with rate-limit headers. If a bucket was empty, the node remembers to reject whoever that bucket counts (the key, the user or the IP) until that bucket's next token, and answers 429 with Retry-After: 1.](/diagrams/rate-limiter/check-sequence.svg)

## Deep dive: where the limiter sits

A limit can be enforced at four points on a request's way in, and each one
costs something different.

**In the client.** An SDK (the client library the API's provider publishes
for customers to call it with) can pace its own requests: read `Remaining`, wait out
`Retry-After`, never send what would be rejected. It costs the server nothing
and is kind to well-meaning customers, but it cannot be trusted as
enforcement, since anyone can skip the SDK and send raw HTTP. It is worth
shipping as a courtesy, never as the limit.

**In the gateway, as a library.** Every request already passes through the
gateway, and it has already identified the caller, so the check can run there
for every endpoint with no work from the teams behind it. A rejected request
costs one store round trip, about 0.5 ms, and never reaches a backend. The
cost: the gateway sees requests, not what they do. It can't tell that a search
over five years of data costs a hundred times more than one over a day, or that
a login attempt failed.

**In the gateway, calling a separate limiter service.** The same place in the
path, but the logic lives in its own service that gateways call over the
network. That keeps the limiter in one language and lets one team deploy it
independently. It adds a second hop to every request (gateway to limiter,
limiter to store: two round trips, about 1 ms, where the library needs one),
and it adds a service that has to be scaled to 580,000 calls a second and whose
outage is felt by every endpoint.

**Inside each service.** A service knows what its requests mean, so it can
enforce limits no gateway could: five failed logins per account per 15
minutes, three verification texts per phone number per hour. The costs are
that a request has already used a connection and some work to get there, and
that every team builds its own limiter unless they share one.

**The choice** is a library in the gateway for the key, user, IP and global
limits, which are the same for every endpoint and are cheapest to enforce
before the backend. Services that need limits on what a request means use the
same library and the same counter store for those, so there is one algorithm
and one failure policy, not five. The client SDK honours the headers. The
separate limiter service is rejected on this design's numbers: its extra round
trip would use a quarter of the 2 ms budget to buy deployment independence,
and a versioned library that gateways upgrade on their own schedule gets most
of that independence for free.

## Deep dive: choosing the algorithm

The catalog topic describes four of these algorithms and the fixed window's
problem at its reset; what matters here is how all five behave under this
design's limits. Take the Pro limit, 1,200 requests a
minute, and ask three questions of each: what it stores per client, the most
requests it lets through in any one second, and the most in any 60 seconds.
The token bucket is configured as the rules table has it, 20 tokens a second
and a burst of 100.

| Algorithm              | State per client       | Most in any 1 s | Most in any 60 s |
| ---------------------- | ---------------------- | --------------- | ---------------- |
| Fixed window           | 1 count                | 2,400           | 2,400            |
| Sliding-window log     | up to 1,200 timestamps | 1,200           | 1,200            |
| Sliding-window counter | 2 counts               | about 1,220     | just under 2,400 |
| Token bucket           | tokens + timestamp     | 120             | 1,300            |
| Leaky bucket (queue)   | a queue of up to 100   | 20              | 1,200            |

Where those numbers come from:

- **Fixed window.** A count per clock minute, reset at `:00`. A client can send
  1,200 at 12:00:59.5 and another 1,200 at 12:01:00.0, both windows allow them,
  and the backend receives 2,400 in half a second: double the limit, all at
  once. The reset lining up with the clock also means every throttled client
  becomes eligible again at the same second, and a crowd that retries together
  is the [thundering herd problem](/systems-and-infrastructure/thundering-herd-problem).
- **Sliding-window log.** Exact: it keeps every timestamp and counts those in
  the last 60 seconds, so no 60-second span ever holds more than 1,200. But a
  client that was idle can send all 1,200 in one second, and the state grows
  with traffic, 120 KB for this one key at full use.
- **Sliding-window counter.** It estimates the last 60 seconds as the current
  minute's count plus the previous minute's count scaled by the share of that
  minute still inside the window. The seam burst mostly goes: a client that
  spent its full 1,200 just before a reset can add only 1,200 × 1/60 = 20 in
  the first second after it, so a one-second span straddling the reset holds
  about 1,220, not 2,400. A client that was idle can still send 1,200 in one
  second, as with the log. But the estimate assumes the previous
  minute's requests were spread evenly, and a client can exploit the gap. Send
  all 1,200 in the last tenth of a second of one minute, then 19 a second
  through the next. At t seconds into the new minute the estimate is
  1,200 × (60 − t) ÷ 60 + 19t = 1,200 − t, always under 1,200, so every
  request passes. Yet at 59.8 seconds in, the real last 60 seconds still
  include the whole burst: 1,200 + 19 × 59.8 ≈ 2,336 requests. The error runs
  the other way too, rejecting clients whose previous-minute requests all came
  early. For steady traffic it is close; against a client that times its
  requests on purpose, it isn't exact.
- **Token bucket.** In any interval of d seconds it allows at most the burst
  plus the refill: 100 + 20 × d. That is 120 in one second and 100 + 20 × 60 =
  1,300 in a minute. The peak is bounded and chosen separately from the rate,
  which none of the window algorithms can do: a window allowing 1,200 a minute
  always allows 1,200 in one instant.
- **Leaky bucket as a queue.** Requests wait in a queue drained at exactly 20 a
  second, so the backend never sees a burst. At a gateway that means holding
  requests open: the hundredth request in a burst waits 100 ÷ 20 = 5 seconds,
  tying up a connection the whole time. That smoothing suits a sender pacing
  its own output to a provider's limit, not a gateway answering callers. The
  leaky bucket has a second form, as a meter rather than a queue, usually
  implemented as the **generic cell rate algorithm** (GCRA): it stores a single
  timestamp, the time the next request is due, and rejects instead of queuing.
  It behaves the same as a token bucket with the same rate and burst.

**The choice** is the token bucket for every per-client rule. Its state is
constant (the 700 MB estimate), its burst is a separate, deliberate number
rather than a side effect of the window, and nothing about it resets on the
clock, so throttled clients don't come back in step. What it gives up: the
bucket can't answer "how many requests did this key send in the last minute",
which a log could, and a limit stated as "1,200 a minute" really means "20 a
second with a burst of 100", which the API documentation has to spell out.
GCRA would store 8 bytes instead of 16 for identical behaviour; at 700 MB total
the saving doesn't justify the less familiar code. The sliding-window log
would be the pick if a limit had to be exact over its window, for instance a
contractual "1,000 per hour, never more". Its cost grows with the window: each
client on such a rule holds up to 1,000 timestamps for a whole hour, about
1,000 × 100 bytes = 100 KB, against about 100 bytes for a bucket.

## Deep dive: counting across many gateway nodes

A count kept in one node's memory limits only the requests that land on that
node. With 40 nodes behind the load balancer, a Pro key limited to 20 a second
by each node separately could get 800 a second, the trap the catalog topic
describes. There are four ways to share the count.

**Read, then write, against a shared store.** Each node reads the bucket,
computes the new token count, and writes it back. It is simple and it is
wrong under concurrency. A client sends two requests that land on two nodes
at the same moment, with one token left: both nodes read 1, both see a token,
both allow, and both write 0. Two requests passed on one token. That is the
lost update from [race conditions](/systems-and-infrastructure/race-conditions),
and it scales with the client's parallelism: a client firing 100 requests at
once across 40 nodes can get many through on a nearly empty bucket.

**One atomic script per check against a shared store.** Redis can run a script
written in Lua, a small programming language built into it, and runs each
script as a single step: no other command runs on that shard until the script
finishes, so the read, the refill, the decision and the write can't be
interleaved with another node's. The script for one bucket:

```lua
-- KEYS[1] = bucket key; ARGV[1] = rate per second; ARGV[2] = burst
local rate, burst = tonumber(ARGV[1]), tonumber(ARGV[2])
local t = redis.call('TIME')                   -- the store's clock
local now = tonumber(t[1]) + tonumber(t[2]) / 1e6
local b = redis.call('HMGET', KEYS[1], 'tokens', 'ts')
local tokens = tonumber(b[1]) or burst          -- missing bucket = full
local ts = tonumber(b[2]) or now
local elapsed = math.max(0, now - ts)          -- a promoted replica's clock may lag
tokens = math.min(burst, tokens + elapsed * rate)
local allowed = 0
if tokens >= 1 then tokens = tokens - 1; allowed = 1 end
redis.call('HSET', KEYS[1], 'tokens', tokens, 'ts', now)
redis.call('EXPIRE', KEYS[1], math.ceil(burst / rate))
return { allowed, tostring(tokens) }
```

It reads the time from the store, not from the calling node, so 40 gateway
clocks that disagree by a few milliseconds can't hand out tokens early.
Reading the clock and then writing needs Redis 5 or later (or 3.2 and later
with `redis.replicate_commands()` at the top of the script), which copies a
script's resulting writes to the replica instead of re-running the script
there. The `math.max` guard keeps a clock that went backwards, after a
failover to a replica whose clock is slightly behind, from taking tokens away.
For
several buckets in one call (the key and its user), the script checks every
bucket first and takes a token from each only if all of them have one; that
only works because the braces in the key names put both buckets in one hash
slot, since Redis Cluster refuses a script whose keys are in different slots. The
IP bucket is keyed by IP, so it lives on some other shard and needs its own
call; if that call rejects after the key and user buckets each gave up a
token, those tokens are gone. Refunding them would need a third call, and a
client whose IP is over its limit is being rejected anyway, so the loss is
accepted. This option is exact, and costs one round trip per request and the
24 shards from the estimates.

**Local counters, synced periodically.** Each node counts in memory and every
100 ms sends its counts to the store and reads back the totals. Store traffic
drops from one call per request to one batched call per node per interval,
40 × 10 = 400 a second. Accuracy is what it costs. Between syncs, each node
decides from a total that is up to 100 ms old, so a Pro key with a full
bucket of 100 can spend it on every node before any of them hears about the
others: up to 40 × 100 = 4,000 requests in 100 ms against a burst of 100.
Once the burst is gone, each interval refills 20 a second × 0.1 s = 2 tokens,
and all 40 nodes can spend those same 2: 80 admitted instead of 2, an
overshoot of 78. A variant splits each limit evenly, 20 ÷ 40 = 0.5 a second
per node, which never overshoots but breaks for clients whose requests don't
spread evenly. HTTP keep-alive and HTTP/2 let a client send many requests
over one connection it keeps open, and a load balancer that picks a node per
connection then sends all of them to one node, where that client gets a
fortieth of what it pays for.

**Route each client to one node.** If the load balancer hashes the API key to
pick the node, every request for a key lands on the same node, which can count
it exactly in memory with no store at all.
[Consistent hashing](/systems-and-infrastructure/consistent-hashing) keeps most
keys on the same node when nodes are added or removed. The costs: a request
has several limits (key, user, IP) and can only be routed by one of them; a
single heavy key overloads its node; and a node that restarts forgets its
counts, handing every key it held a full bucket.

**The choice** is the atomic script for the key, user and IP limits, the ones
where a client's overshoot is the thing being prevented. Its cost is the
round trip the latency budget already allowed for and a 48-node store, and it
is the only option here that meets the accuracy requirement. The **global**
search limit takes the local-share approach instead, for a different reason:
it is one bucket, so as a single key in the store it would put every search
request, 20,000 a second and more when demand spikes, on one shard. Each shard
already carries 1,160,000 ÷ 24 ≈ 48,300 calls a second at peak, so that one
would reach about 68,000, well past its planned 50,000. Instead, each node runs its own local token
bucket for the rule, with a share of the rate and a burst of a tenth of a
second's worth of it. The even split is 20,000 ÷ the current node count, since
the fleet autoscales: at the peak's 40 nodes, 500 a second and a burst of 50.
Every 100 ms each node reports its demand through the store, and shares move
towards the nodes with more of it. The fleet then admits at most 20,000 a
second sustained, and at most 20,000 + 2,000 = 22,000 in any one second, a
margin the search cluster is sized for.

Moving shares has to keep their sum at or under 20,000, or two nodes can
briefly hold the same capacity. The share table lives in the store and only
changes through an atomic script there, which makes the store the
coordinator. A move is reduce-then-raise: the script raises one node's share
only out of capacity another node has already confirmed giving up. Each share
is a lease renewed by every sync, which also tells the node the current node
count; the node's row records its **fallback**, the even split as of that
sync. A node that joins starts at zero. A node that hasn't synced for 1 second drops its bucket to the smaller
of its share and its fallback. After 2 seconds of silence the script takes
back only the part of the share above the fallback; the rest stays held for
that node until it leaves the fleet (it deletes its row on shutdown, and the
autoscaler deletes a crashed node's row when it replaces it). A node that
comes back takes whatever share the store holds for it on its first
successful sync. So every node, synced or cut off, uses at most what the
store holds for it, and the 20,000 holds even when a full store outage ends
and the first node to sync finds every other row stale. The cost is
under-admission: a cut-off node with a small share stays small, and a crashed
node's share sits idle until its row goes, which is the right way for a
capacity guard to be wrong.

## Deep dive: when the counter store is down

A shard can fail, the network to it can slow down, and a failover takes as
long as the cluster needs to declare the node dead (its node timeout, 15
seconds by default in Redis Cluster, set to 5 here) plus about a second to
promote the replica: roughly 6 seconds. Every request is waiting on the check, so the limiter has to decide
what an unanswered check means, and decide quickly.

**Noticing.** Each store call gets a 5 ms timeout. Without one, a hung shard
would hold every request for the keys on it indefinitely. With only a timeout,
those requests still wait the full 5 ms each, and 5 ms is already 2.5 times
the 2 ms p99 budget. Each request touches 2 of the 24 shards, so about 1 in 12
requests (1 − (23/24)² ≈ 8%) touches any given one: at peak, about 47,000 a
second, each waiting 5 ms, so roughly 47,000 × 0.005 ≈ 240 requests stuck in
that wait at any moment across the fleet, about 6 per gateway node. That is
not much load, but it is 8% of all traffic breaking the latency target for as
long as the shard is hung. So the calls also go through a
[circuit breaker](/systems-and-infrastructure/circuit-breaker) per shard: once,
say, 20% of calls to a shard fail within 10 seconds, the breaker opens and the
nodes stop calling that shard, applying the fallback immediately, then let a
few trial calls through every second to see whether it has recovered (a
failover, below, takes about 6 seconds, so a longer wait would only prolong
the fallback).
Until it opens, p99 is breached for that slice of traffic; after, those
requests are fast again. The breaker also keeps 40 nodes' retries from piling
onto a shard that is trying to come back.

**Then what.** There are three policies, and each is right somewhere.

- **Fail open**: allow the request as if the bucket had a token. The API stays
  fully available; the limit simply isn't enforced for the keys on that shard
  until it returns. The risk is whatever the limit was stopping, for as long as
  the outage lasts.
- **Fail closed**: reject the request. Nothing abusive gets through, but a
  failure in the limiter's storage has become an outage of the API it protects,
  for every client on that shard, well-behaved or not. For most endpoints that
  turns a small incident into a large one.
- **Fall back to local counting**: each node enforces the limit ÷ the
  current node count (as of its last sync) from memory, the even split from
  the "counting across many gateway nodes" deep dive. A small burst split 40
  ways rounds to nothing (5 ÷ 40 is an eighth of a token, which would never
  admit anyone), so each node's share of the burst has a floor of one token.
  Accuracy drops (a client on one long connection gets one node's share, a
  fortieth of the rate at 40 nodes), but some protection remains.

**The choice** is made per endpoint, through the endpoints table's
`on_store_down`, and applies to every per-client rule on that endpoint:

| Endpoint                                         | Policy | Why                                                                                                                                                                                                                                         |
| ------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reads, such as `GET /v1/items`, `GET /v1/search` | open   | Availability matters most. Search keeps its global limit, which is local; `GET /v1/items` has no such backstop, and relies on its backend's spare capacity for the outage.                                                                  |
| `POST /v1/login`                                 | local  | Unlimited login attempts are password guessing. With a burst of 1 and 10 ÷ 40 = 0.25 a minute per IP on each node, one IP spraying all 40 nodes gets 40 attempts at once, then 10 a minute: crude, but orders of magnitude below unlimited. |
| `POST /v1/messages` (sends a text message)       | closed | Each call costs real money at the SMS provider, and unlimited sending is how fraudsters run that bill up. A failover's 7 seconds of refused sends, or a longer outage's minutes, cost less than the same time unguarded.                    |

The global search limit needs no policy: it lives in node memory and keeps
working when the store is gone. After a second without syncing, each node
holds the smaller of its share and its fallback, so the fleet stays at or
under 20,000, a little under where demand was uneven.

## Failure modes and bottlenecks

**One client hammering one shard.** A single key sending 100,000 requests a
second puts 100,000 script calls a second on the shard that holds it, on top
of the roughly 48,300 it already carries against a plan of 50,000, and every
other key on the shard slows down. A
rejection says exactly when the bucket will next have a token, and tokens only
ever come back through time (other nodes can only take them), so a node can
safely remember "reject this key until its next token" (or this user, or this
IP, whichever bucket was empty) and answer 429 from memory without calling the
store. That is the "remember" step in the sequence diagram. For a Pro key a
token comes back every 50 ms, so each of the 40 nodes asks the store about it
at most 20 times a second: 40 × 20 = 800 calls a second for the abusive key
instead of 100,000. For a free key it is 40 a second.

**A shard fails over.** Redis copies writes to its replica asynchronously, so
the last few milliseconds of bucket updates can be lost when the replica takes
over. A client whose updates were lost gets back a few tokens it had spent: a
small, bounded overshoot, once per failover. During the roughly 6 seconds the
failover takes, plus up to a second until the breaker's next trial call
reaches the new primary, requests whose buckets are on that shard follow
their endpoint's `on_store_down` policy: for `POST /v1/messages`, about 7
seconds of refused sends for the keys on that shard.

**Lots of clients behind one IP.** An office, a university or a mobile carrier
can put thousands of users behind one public IPv4 address, which is why the
per-IP limit (100 a second) is generous and why the key and user limits carry
the real per-customer allowance. IPv6 has the opposite problem: one machine can
pick new addresses from its /64 block (the range of addresses a single
network is usually given) whenever it likes, so the IP limit counts per /64
prefix rather than per address.

**A bad rule.** A rule with a typo, 1 a minute instead of 1 a second, rejects
most of an endpoint's traffic the moment it is pushed. New rules start in
shadow mode, and the rule change is only promoted to enforcing once the
would-have-rejected counts look right.

**Retry storms.** Clients that retry a 429 immediately double their own
traffic and hit the limiter harder. `Retry-After`, backoff with jitter in the
SDK, and the local reject-until memory above keep the cost of a rejection to a
few microseconds on the gateway node.

**Knowing any of this is happening.** The signals worth watching are check
latency at p99 per shard, the share of requests rejected per rule, 429 counts
per key (a customer suddenly throttled will open a support ticket), shadow
rules' would-reject counts, how often and where fallback policies are active,
and each shard's calls per second against its planned 50,000.
[Observability](/systems-and-infrastructure/observability) covers how metrics,
logs and traces divide that up; here, metrics carry nearly all of it, with one
log line per rejection so a particular customer's 429s can be explained.

## Trade-offs

- **Token bucket over the window algorithms.** Constant memory and a burst
  that is set on purpose, at the cost of a limit that has to be explained as a
  rate plus a burst, and no exact count over a window when someone asks for
  one.
- **A shared store with an atomic script over local counting.** Exact limits
  across 40 nodes, at the cost of a round trip on every request and a 48-node
  store to run. Local counting would cut store traffic by thousands of times
  (1,160,000 calls a second down to 400) and let a single client overshoot
  forty-fold during a burst.
- **Local shares for the global search limit.** No hot key and no store
  dependency for the limit that protects the search cluster, at the cost of
  under-admitting a little when demand moves between nodes faster than the
  100 ms rebalance and the lease protocol that keeps shares from overlapping,
  and capacity held idle for nodes that are cut off or dead.
- **A library in the gateway over a limiter service.** One round trip instead
  of two, at the cost of a library that every gateway (and every service that
  uses it) has to upgrade to change the algorithm.
- **Failure policy per endpoint.** Most of the API stays up when the store
  fails, at the cost of limits that go unenforced on open endpoints for the
  outage, a setting every endpoint has to get right, and a fallback path that runs rarely and so has to be tested on purpose.
- **Token loss on a partial rejection.** When the IP bucket rejects after the
  key and user buckets paid, the client loses those tokens, accepted to avoid a
  third store call.

What would change the design: serving from several regions. A cross-region
round trip costs about 50 ms against a 2 ms budget, so each region would keep
its own store and enforce its own share of each limit, and a client's
allowance would become the sum of regional shares, rebalanced as its traffic
moves, the same approach the global search limit takes across nodes here. If limits
had to become billing-grade quotas, counted exactly over a month, they would
move out of the limiter into a metering pipeline that records every request
durably, with the limiter left to stop bursts.
