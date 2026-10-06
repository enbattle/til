---
title: Design an LLM Chat Service (like ChatGPT or Claude)
summary: Streaming a language model's replies to 10 million daily users, with batching, cache-aware routing and admission control deciding how many GPUs that takes.
date: 2026-10-05
order: 16
template: 2
---

You're asked to design a chat service on a large language model, like ChatGPT
or Claude. The model reads the whole conversation, then writes its reply one
**token** at a time, a token being a word or a piece of one
([tokenization](/ai-and-ml/tokenization)). A 400-token reply takes about 13
seconds, so you stream it. The **GPUs**, processors built for matrix
arithmetic, are most of the cost, so keep them busy without making anyone wait.

## Requirements

- Stream each reply as it's generated. The user can stop it (the text so far
  is kept), retry it, and continue past conversations.
- 10 million daily users send 20 messages each: 200 million **turns** a day (a
  turn is a message and its reply).
- First token within 2 seconds at p99 (99% of requests are faster) for up to
  8,000 new input tokens; at least 20 tokens a second per reply, with no pause
  over 100 ms at p99.
- A token quota per plan over a rolling five hours; past it, sends are refused.
- Sending is up 99.9% of the time, and a reply the user saw finish survives the
  loss of one database server. A reply still being written may be lost when a
  chat server dies; the user retries.

Out of scope: training, safety filtering, uploads and billing.

## Key numbers

First, size the GPU fleet, the memory on each replica and the database. Assume
a 3,000-token prompt (1,000 of system prompt, 1,900 of earlier turns, 100 new),
a 400-token reply, and a busiest hour at 3 times average, not 10.

- **Turns:** about 7,000 a second at peak. 200 million ÷ 86,400 ≈ 2,300, × 3.
- **GPU fleet:** about 1,600 **replicas**, 12,800 GPUs. A replica is one copy
  of the model on 8 GPUs, reading 40,000 prompt tokens a second or writing
  3,000 reply tokens a second across 100 replies. On half of turns the earlier
  1,900 tokens are already in its **KV cache** (intermediate results kept per
  token; [KV cache](/ai-and-ml/kv-cache)), and the system prompt always is, so a turn reads 1,050 tokens and writes 400: 7,000 × 0.16 ≈ 1,120 busy, ÷ 0.7 for headroom.
- **KV cache:** 400 GB per replica. 640 GB of GPU memory, less 140 GB of
  weights and 100 GB working space. At an assumed 320 KB a token, a
  3,400-token conversation takes 1.09 GB.
- **Database:** about 180 TB a year, 28,000 writes a second at peak. 200
  million turns × 2.5 KB ≈ 500 GB a day; four rows written a turn.

## High-level architecture

![Architecture of the chat service. Browsers and apps connect to a load balancer over HTTPS with streamed replies, and the load balancer passes them to chat servers. Chat servers send turns, history and outbox rows to the conversation store, reserve tokens in the quota store, and send generate requests to inference routers. Routers place requests on GPU replicas by conversation, and replicas send load reports back to the routers. The conversation store passes outbox rows to the usage relay, which sends true-ups and refunds to the quota store.](/diagrams/llm-chat-serving/architecture.svg)

Follow "What causes the seasons?" through it. A chat server records the turn,
reserves tokens in the quota store, builds the prompt from history, and asks an
inference router to generate. The router picks a replica and passes
tokens back; the chat server holds them in memory and relays them to the
browser. At the end it commits the reply and a usage row ([outbox](/systems-and-infrastructure/outbox-pattern)) in one transaction,
then sends `done`. The usage relay later applies the real token count to the
quota store.

## API and data model

```http
POST /v1/conversations/c-4/messages
{ "message_id": "m-81", "content": "What causes the seasons?" }
-> 200, server-sent events: turn {turn_id: "t-9"}, token {i: 0, text: "The"}, ... , done
   (429 over quota, 409 if a reply is still being written, 503 when the fleet is full)

GET  /v1/turns/t-9/stream?after=37   rejoin a reply after event 37
POST /v1/turns/t-9/stop              or /retry, which starts a new generation
```

```text
messages
  conversation_id, seq   primary key; seq is the position in the conversation
  message_id             chosen by the client; the send's idempotency key
  status                 generating | complete | stopped | failed
  generation             attempt number, raised by a retry
  owner                  the chat server streaming it
```

Rows are sharded by user, so a turn and its usage row share one transaction.
Completing updates the row only if its status is still `generating` and its
`generation` matches, so a stalled server's late write can't overwrite a retry.
Nothing is written per token.

## Decision: continuous batching with chunked prefill

**Prefill** reads the prompt in one pass. **Decode** then makes one token per
step, and each step reads all 140 GB of weights, so memory speed limits it. One reply alone gets a token every 20 ms (assumed). A **batch** of 100 replies shares each
read, and a step takes about 33 ms (assumed): 3,000 tokens a second, sixty
times the throughput for under twice the step time ([latency vs. throughput](/systems-and-infrastructure/latency-vs-throughput)).

**Continuous batching** rebuilds the batch every step, letting finished replies
leave and waiting ones join, so nobody waits behind a long reply. A
joining 3,000-token prefill would stall a step for 75 ms, so feed it in
512-token chunks: 13 ms more per step, about 46 ms, under the 100 ms limit.

Why not separate prefill and decode replicas, so decode is never interrupted?
It works, and we'd switch if prompts reached tens of thousands of tokens. Here
it moves up to 1 GB of cache per turn, about 7 TB a second in all; chunking already meets the limit.

**Rule of thumb.** Share a per-step fixed cost across as many requests as the
latency target allows.

## Decision: route by conversation

Prefill skips tokens a replica already holds. Hashing `conversation_id` onto a ring of replicas
([consistent hashing](/systems-and-infrastructure/consistent-hashing)) keeps a
conversation on one. Its cache then lingers: 400 GB, less 109 GB for 100
replies in progress, holds about 266 conversations, and a replica finishes 4.4
turns a second, so a prefix survives about a minute. Assume half of follow-ups
arrive within it: that's the 50% behind 1,600 replicas.

Why not the least loaded replica? It balances best, but the next turn finds
its prefix 1 time in 1,600. Reading 2,000 tokens costs 0.183 replica-seconds a turn, so the fleet is about 1,830, some 230 more. To limit
imbalance, a replica above 1.25 times average load passes the request to the
next on the ring and takes that miss.

**Rule of thumb.** When expensive state lives on one machine, route to the
state, with a load cap so a popular key can't swamp it.

## Decision: refuse early with a bounded queue

Past the planned peak, the router queues a request
only if its expected wait fits the 2-second target (about one second), and
otherwise answers `503` with a randomized `Retry-After`, free tier first. That
is [backpressure](/systems-and-infrastructure/backpressure).

Why not add GPUs when load rises? Loading 140 GB of weights takes minutes, so
a replica arrives after most spikes end, and planning for 10 times average
instead of 3 means about 5,300 replicas, not 1,600. Queueing everything is
worse: waits grow and users resend. The price is that in a long overload, free
users get nothing.

**Rule of thumb.** When capacity is costly and slow to add, admit only what you
can serve within the target and refuse the rest quickly.

## Likely follow-ups

- **Why server-sent events, not WebSockets?** Every reply answers a request the
  client just made, and stop can be its own `POST`, so a one-way HTTP stream is
  enough
  ([WebSockets vs. SSE vs. long polling](/systems-and-infrastructure/websockets-vs-sse-vs-long-polling)).
- **What if the phone drops mid-reply?** Generation continues. The client
  rejoins with its last event number; any chat server proxies the stream from
  the row's `owner`.
- **What if a chat server dies mid-reply?** It stops renewing its **lease**, a
  timestamp saying it's alive. A sweeper marks its `generating` rows `failed`
  (the same guarded update as completion) and refunds the quota.
- **How do quotas work when reply length is unknown?** Reserve the most a turn
  could cost (an assumed 2,000-token reply cap), then lower the charge to the
  actual count, keyed by turn so repeats are harmless
  ([rate limiting](/systems-and-infrastructure/rate-limiting)).
