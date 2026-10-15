---
title: Design an LLM Chat Service (like ChatGPT or Claude)
summary: Streaming a language model's replies to 10 million daily users, with batching, cache-aware routing and admission control deciding how many GPUs that takes.
date: 2026-10-05
order: 16
---

You're asked to design a chat service on a large language model, like ChatGPT or Claude. You send "What causes the seasons?" and the answer streams in word by word, because the model writes its reply one **token** at a time, a token being a word or a piece of one ([tokenization](/ai-and-ml/tokenization)). The **GPUs** that run the model, processors built for matrix arithmetic, are most of the cost, so the question is how to keep them busy without making anyone wait.

The design in one sentence: many replies share each GPU step, each conversation stays on the replica that holds its cache, and work past capacity is refused. This page starts with the obvious design and shows how many GPUs it would need, then follows a turn through the design that replaces it, sizes its parts, and makes three decisions: how to batch replies, where to send each conversation, and when to refuse a request.

## Requirements

- Stream each reply as it's generated. The user can stop it (the text so far is kept), retry it, and continue past conversations.
- 10 million daily users send 20 messages each: 200 million **turns** a day (a turn is a message and its reply).
- First token within 2 seconds at p99 (99% of requests are faster) for up to 8,000 new input tokens; at least 20 tokens a second per reply, with no pause over 100 ms at p99.
- A token quota per plan over a rolling five hours; past it, sends are refused.
- Sending is up 99.9% of the time, and a reply the user saw finish survives the loss of one database server. A reply still being written may be lost when a chat server dies; the user retries.

Out of scope: training, safety filtering, uploads and billing.

## Start simple

The obvious design gives each chat to one machine at a time. The model is a file of learned numbers, its **weights**, 140 GB here, and eight GPUs together hold one copy of them. Call that group a **replica**.

A **chat server**, an ordinary web server, takes the user's message and sends the conversation so far to a replica. That text is the **prompt**. The replica works on it until the reply is done, then takes the next one.

The replica's work has two stages. First it reads the whole prompt in one pass, which is fast because it handles thousands of tokens at once. That stage is **prefill**. Assume a replica reads 40,000 prompt tokens a second.

Then it writes the reply one token at a time, and each step has to read all 140 GB of weights from memory to make a single token. That stage is **decode**. Assume a replica writing one reply alone makes a token every 20 ms.

The model also keeps notes on every token it has read, so decode doesn't redo them. These notes are the **KV cache** ([KV cache](/ai-and-ml/kv-cache)), and they take memory.

Size this design. Assume a 3,000-token prompt (1,000 of system prompt, the instructions sent ahead of every conversation, 1,900 of earlier turns and 100 new), a 400-token reply, a busiest hour at 3 times average, and replicas run at 70% of capacity to leave room for bursts:

```text
turns a second, average:
  200,000,000 ÷ 86,400 s ≈ 2,300
peak, 3 times average:
  2,300 × 3 = 6,900, call it 7,000
one turn on one replica:
  prefill: 3,000 ÷ 40,000 = 0.075 s
  decode:  400 × 0.02 s = 8 s
  total:   8.075 s
replica-seconds needed each second:
  7,000 × 8.075 ≈ 56,500
replicas, at 70%:
  56,500 ÷ 0.7 ≈ 80,750
GPUs:
  80,750 × 8 ≈ 646,000
```

That's about 646,000 GPUs, and decode is 8 of the 8.075 seconds. Each decode step reads 140 GB to serve one user. The design that replaces this one reads it once for many replies at a time.

## High-level architecture

![Architecture of the chat service. Browsers and apps connect to a load balancer over HTTPS with streamed replies, and the load balancer passes them to chat servers. Chat servers send turns, history and token counts to the conversation store, reserve tokens in the quota store, and send generate requests to inference routers. Routers place requests on GPU replicas by conversation, and replicas send load reports back to the routers. The conversation store passes token counts to the usage relay, which sends actual counts and refunds to the quota store.](/diagrams/llm-chat-serving/architecture.svg)

Follow "What causes the seasons?". A **load balancer**, which spreads requests across servers ([load balancers](/computing-fundamentals/load-balancers-and-cdns)), hands the browser's request to a chat server. The chat server writes the turn to the **conversation store**, the database of every chat, and builds the prompt from the stored history.

It then reserves tokens in the **quota store**, which counts each plan's use against its limit, and asks an **inference router** to generate. The router picks a replica and passes the tokens it writes back to the chat server, which holds them in memory and relays them to the browser. Replicas send the routers load reports, so the router knows which are busy.

At the end, the chat server commits the reply and a row of its token counts in one transaction, then sends `done`. Storing the row beside the reply, instead of calling the quota store directly, is the [outbox pattern](/systems-and-infrastructure/outbox-pattern): the **usage relay** reads stored rows later and applies the actual count to the quota store, or a refund if the reply failed. A crash between the two writes can't lose a charge, and a repeated apply is harmless because it is keyed by turn.

## Key numbers

These size the replicas, the memory on each and the conversation store. A day is 86,400 seconds.

- **Turns:** about 7,000 a second at peak, as worked out in "Start simple".
- **Replicas:** about 1,600, or 12,800 GPUs. Decision 1 explains the next two assumptions: a batch of 100 replies sharing each step, and a step of 33 ms. Decision 2 explains the third: on half of turns the 1,900 earlier tokens are already cached. The system prompt always is.

  ```text
  decode: 100 replies ÷ 0.033 s ≈ 3,000 tokens a second
  prefill reads per turn:
    100 new + 1,900 × 0.5 = 1,050 tokens
  prefill time:
    1,050 ÷ 40,000 = 0.026 s
  decode time:
    400 ÷ 3,000 = 0.133 s
  busy per turn:
    0.026 + 0.133 = 0.16 replica-seconds
  busy at peak:
    7,000 × 0.16 = 1,120
  replicas, at 70%:
    1,120 ÷ 0.7 = 1,600
  GPUs:
    1,600 × 8 = 12,800
  ```

- **KV cache:** 400 GB per replica. Each GPU has 80 GB, so 8 × 80 = 640 GB; less 140 GB of weights and 100 GB of working space leaves 400 GB. At an assumed 320 KB a token, a 3,400-token conversation (3,000 prompt and 400 reply) takes 3,400 × 320 KB ≈ 1.09 GB.
- **Conversation store:** about 180 TB a year and 28,000 writes a second at peak. 200 million turns × 2.5 KB = 500 GB a day, × 365 ≈ 182 TB. Four rows are written a turn: 7,000 × 4 = 28,000.

Next, how a client talks to the service and what the store holds.

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
  message_id             chosen by the client; a repeated send with the same id is ignored
  status                 generating | complete | stopped | failed
  generation             attempt number, raised by a retry
  owner                  the chat server streaming it
```

Rows are split across database servers by user, so a turn and its token-count row share one transaction ([sharding](/systems-and-infrastructure/partitioning-vs-sharding)). Completing updates the row only if its status is still `generating` and its `generation` matches, so a stalled server's late write can't overwrite a retry. Nothing is written per token.

That's the shape. The first decision is the one that shrinks 646,000 GPUs.

## Decision: continuous batching with chunked prefill

Start simple ran one reply at a time and needed about 80,750 replicas, because every decode step read 140 GB for one user. A **batch** runs many replies in the same step, so they share that one read. Say a batch of 100 makes a step take 33 ms (assumed), since the reads dominate:

```text
alone:        1 token ÷ 0.02 s = 50 tokens a second
batch of 100: 100 ÷ 0.033 ≈ 3,000 tokens a second
throughput:   3,000 ÷ 50 = 60 times
step time:    33 ÷ 20 = 1.65 times
one reply:    1 ÷ 0.033 ≈ 30 tokens a second
```

That's sixty times the throughput for under twice the step time ([latency vs. throughput](/systems-and-infrastructure/latency-vs-throughput)), and 30 tokens a second clears the 20 required. A 400-token reply takes 400 ÷ 30 ≈ 13 seconds, so you stream it.

Waiting for a whole batch to finish would make short replies wait behind long ones. **Continuous batching** rebuilds the batch every step, so finished replies leave and waiting ones join. A joining prefill runs inside a step and stalls everyone in the batch. A 3,000-token one adds 3,000 ÷ 40,000 = 75 ms, so that step takes 33 + 75 = 108 ms, over the 100 ms limit, and a prompt of the 8,000-token maximum adds 200 ms. So feed it in 512-token chunks, each 512 ÷ 40,000 ≈ 13 ms, which makes a step 33 + 13 = 46 ms, under the limit.

Why not separate prefill and decode replicas, so decode is never interrupted? It works, but chunking already meets the 100 ms target with one pool of replicas, so a second fleet to size, plus a step that moves each prompt's cache between machines, buys nothing here. We'd switch if prompts grew so long that chunking couldn't keep pauses under the limit. The price of chunking is slower steps while a prefill is joining, a token rate of 1 ÷ 0.046 ≈ 22 a second, close to the 20 floor.

**Rule of thumb.** Share a per-step fixed cost across as many requests as the latency target allows.

## Decision: route by conversation

The simpler way is to send each request to the least loaded replica. It balances best, but a conversation's earlier tokens sit in one replica's cache, and the next turn finds them there 1 time in 1,600. Without them, a prefill reads 100 + 1,900 = 2,000 tokens:

```text
prefill: 2,000 ÷ 40,000 = 0.05 s
busy per turn: 0.05 + 0.1333 = 0.1833 replica-seconds
peak: 7,000 × 0.1833 ≈ 1,283 busy
replicas, at 70%: 1,283 ÷ 0.7 ≈ 1,830
extra: 1,830 − 1,600 ≈ 230
```

So instead, hash `conversation_id` onto a ring of replicas ([consistent hashing](/systems-and-infrastructure/consistent-hashing)), which keeps a conversation on one. The cache then lingers. Of its 400 GB, 100 replies in progress take 100 × 1.09 = 109 GB:

```text
left for old conversations: 400 − 109 = 291 GB
conversations held: 291 ÷ 1.09 ≈ 267
turns finished a second: 7,000 ÷ 1,600 ≈ 4.4
a prefix survives: 267 ÷ 4.4 ≈ 61 s
```

Assume half of follow-ups arrive within that minute: that's the 50% behind 1,600 replicas. To limit imbalance, a replica above 1.25 times average load passes the request to the next on the ring, and takes that miss.

**Rule of thumb.** When expensive state lives on one machine, route to the state, with a load cap so a popular key can't swamp it.

## Decision: refuse early with a bounded queue

The simpler answer is to add GPUs when load rises. Assume a spike of 10 times average, and that a new replica loads its 140 GB of weights at 10 GB a second: 140 ÷ 10 = 14 s. For those 14 s it serves nothing, while 23,000 turns a second arrive. Running at 70%, the fleet can absorb about 7,000 ÷ 0.7 = 10,000, so the other 13,000 a second wait past the 2-second first-token target. Getting the GPUs at all is often a longer delay. Planning for that peak instead of 3 times average means about 5,300 replicas, not 1,600:

```text
peak at 10 times: 2,300 × 10 = 23,000 turns a second
busy: 23,000 × 0.16 = 3,680
replicas, at 70%: 3,680 ÷ 0.7 ≈ 5,300
```

Queueing everything is worse: waits grow past the 2-second target, and users resend. So past the planned peak, the router queues a request only if its expected wait fits the target (about one second), and otherwise answers `503` with a randomized `Retry-After`, a header saying when to try again, free tier first. That is [backpressure](/systems-and-infrastructure/backpressure). The price is that in a long overload, free users get nothing.

**Rule of thumb.** When capacity is costly and slow to add, admit only what you can serve within the target and refuse the rest quickly.

## Likely follow-ups

- **Why server-sent events, not WebSockets?** Every reply answers a request the client just made, and stop can be its own `POST`, so a one-way HTTP stream is enough ([WebSockets vs. SSE vs. long polling](/systems-and-infrastructure/websockets-vs-sse-vs-long-polling)).
- **What if the phone drops mid-reply?** Generation continues. The client rejoins with its last event number; any chat server proxies the stream from the row's `owner`.
- **What if a chat server dies mid-reply?** It stops renewing its **lease**, a timestamp saying it's alive. A **sweeper**, a background job, marks its `generating` rows `failed` and writes a zero-count token row in the same transaction (the same guarded update as completion), so the usage relay applies the refund.
- **How do quotas work when reply length is unknown?** Reserve the most a turn could cost (an assumed 2,000-token reply cap), then lower the charge to the actual count, keyed by turn so repeats are harmless ([rate limiting](/systems-and-infrastructure/rate-limiting)).
