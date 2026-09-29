---
title: Design an LLM Chat Service (like ChatGPT or Claude)
summary: Streaming a language model's replies to 10 million daily users, and the batching, cache-aware routing and admission control that decide how many GPUs that takes.
date: 2026-09-29
order: 16
---

A chat product built on a large language model looks like a messaging app with
one very slow participant. The user types a message; the model reads the whole
conversation so far and writes a reply one **token** at a time, where a token
is the unit the model reads and writes, a word or a piece of one (about four
characters of English on average; [tokenization](/ai-and-ml/tokenization)
explains how text is split). A 400-token reply takes the model over ten
seconds to write, so the product streams it: words appear as they are produced
instead of all at once at the end.

The model runs on **GPUs**, processors built for the matrix arithmetic a
model is made of, and by far the most expensive part of the system. Most of
this design is about keeping them busy without making anyone wait. What follows is one plausible design for a service like ChatGPT or
Claude, not a description of how any company runs theirs. Hardware and
throughput figures are round assumptions chosen to make the arithmetic
visible, not measurements of a particular product.

## Requirements

Functional requirements:

- **Send a message and stream the reply.** The reply's tokens reach the user
  as they are generated.
- **Conversations.** A user can list past conversations, reopen one and
  continue it. The model sees the earlier turns each time.
- **Stop.** The user can stop a reply part-way; what was written so far is
  kept.
- **Retry (optional).** The user can ask for a failed or unwanted reply to be
  written again, replacing the old one.
- **Quotas.** Each plan (free or paid) allows a number of tokens per rolling
  five-hour window. Over it, sends are refused with a time to try again.

Out of scope: training the model or judging its answers, safety filtering,
file and image uploads, tool use and web search, a developer API, billing, and
keeping alternative versions of a retried reply. One model serves every
request; offering several models would repeat the fleet sizing per model.

Non-functional requirements:

- **Scale:** 10 million daily active users sending 20 messages each, so 200
  million turns a day. A **turn** is one user message and the reply to it.
- **Time to first token** (from send to the first word of the reply): under 2
  seconds at the 99th percentile (the time 99% of requests beat) up to the planned peak, for turns whose new input is under
  8,000 tokens.
- **Streaming speed:** at least 20 tokens a second per reply at the median,
  with no gap between tokens over 100 ms at the 99th percentile. People read
  at roughly 5 to 10 tokens a second, so 20 stays ahead of the reader.
- **Availability:** sending messages 99.9% (about 43 minutes of downtime in a
  30-day month).
- **Durability:** a reply the user has seen finish is never lost. A reply
  still being written can be lost when a server fails; the user then sees an
  error and can retry.

## Back-of-the-envelope estimates

A day is 86,400 seconds.

**Turns per second.**

- Average: 200,000,000 ÷ 86,400 ≈ 2,315, call it **2,300 turns per second**.
- Peak: [numbers every engineer should know](/engineering-practices/numbers-every-engineer-should-know)
  suggests planning for ten times average, but that rule is for bursty web
  traffic, and GPUs are too expensive to hold that much spare. Chat load
  follows waking hours, so assume the busiest hour runs at three times average:
  2,315 × 3 ≈ **7,000 turns per second**. Bursts above that are handled by
  admission control (deep dive 3), not by more hardware.

**Tokens per turn.** Every turn resends the conversation, since the model
remembers nothing between calls. Assume:

- An instruction text the service puts in front of every conversation (the
  **system prompt**): 1,000 tokens.
- Earlier turns of the conversation: 1,900 tokens on average.
- The new user message: 100 tokens.
- So the **prompt**, everything the model reads, averages 3,000 tokens, and
  the reply averages 400.

**The work.** A model handles a request in two phases. **Prefill** reads the
whole prompt at once; it is limited by arithmetic and processes thousands of
tokens in one pass. **Decode** then produces the reply one token per step,
each step reading the model's weights (its learned numbers) from GPU memory,
so it is limited by memory speed rather than arithmetic.

- Prefill at peak: 7,000 × 3,000 = 21 million prompt tokens a second.
- Decode at peak: 7,000 × 400 = 2.8 million reply tokens a second.

**One replica.** Assume a model big enough that one copy spans 8 GPUs with
80 GB of memory each. One such copy is a **replica**. Assumed figures,
which a real team would measure on its own hardware with its own traffic:

- Weights: 140 GB (70 billion numbers at 2 bytes each).
- Prefill speed: 40,000 prompt tokens a second.
- Decode speed: 3,000 reply tokens a second in total, when about 100 replies
  are being written together, which is 30 tokens a second each.

**Prefix caching.** The model keeps intermediate results for every token it
has read, the **KV cache** (the [KV cache](/ai-and-ml/kv-cache) topic explains
what is stored and why). If the start of a new prompt matches tokens a replica
already holds, prefill can skip them. The system prompt is shared by everyone,
so it is always held. The earlier turns are held if the conversation's last
turn ran on the same replica and hasn't been evicted; deep dive 2 works out
why that is true about half the time. New prefill per turn:

- 100 + 0.5 × 1,900 = **1,050 tokens**, instead of 3,000.

**Replica time per turn.** Treating the two phases as sharing each replica's
time:

- Prefill: 1,050 ÷ 40,000 = 0.026 seconds.
- Decode: 400 ÷ 3,000 = 0.133 seconds.
- Total: about **0.16 replica-seconds per turn**.

**Fleet size.**

- Busy replicas at peak: 7,000 × 0.16 = 1,120.
- Planned at 70% utilization, leaving 30% for bursts and failed replicas:
  1,120 ÷ 0.7 = **1,600 replicas, 12,800 GPUs**.
- Without prefix caching, a turn costs 3,000 ÷ 40,000 + 0.133 = 0.208
  replica-seconds, and the fleet would be 7,000 × 0.208 ÷ 0.7 ≈ 2,080
  replicas. Caching saves about a quarter, less than the two-thirds cut in
  prefill tokens suggests, because decode dominates.
- At average load, 2,315 × 0.16 ≈ 370 replicas are busy, under a quarter of
  the fleet.

**Concurrent streams.** A reply lasts about 400 ÷ 30 ≈ 13 seconds plus a
second to start, call it 14:

- At peak: 7,000 × 14 = **98,000 replies in progress**.
- Per replica: 98,000 ÷ 1,600 ≈ 61, under the 100 each is sized for.

**KV cache memory.** Assume the model stores 320 KB per token.

- One average conversation: (3,000 + 400) × 320 KB ≈ 1.09 GB.
- Per replica, 640 GB of GPU memory, minus 140 GB of weights and 100 GB for
  working space, leaves **400 GB for KV cache**.
- 100 replies in progress use about 109 GB; the other ~290 GB holds prefixes
  kept for conversations likely to continue.

**Conversation storage.** Each turn stores the message (about 400 bytes), the
reply (about 1,600 bytes) and metadata, about 2.5 KB in all:

- 200,000,000 × 2.5 KB = 500 GB a day, about **180 TB a year**, before copies.
- Peak writes: each turn inserts two message rows, updates one when the reply
  finishes and adds a usage row, so 7,000 × 4 = 28,000 a second.

The conversation store is ordinary; the GPUs are where the money goes. The
deep dives either raise tokens per GPU-second or protect the latency targets
when demand exceeds the fleet.

## Data model

Conversations are read and written one user at a time, so everything a user
owns lives on one **shard** (one of the independent database servers the data
is split across, here by `user_id`; see
[partitioning vs. sharding](/systems-and-infrastructure/partitioning-vs-sharding)).
That puts a turn and its usage record in one shard, so a single database
transaction can write both. A relational database sharded this way fits:
around 28,000 writes a second across a few dozen shards is modest. Each shard
confirms a commit only after a standby copy has it, so promoting the standby
never loses a reply the user saw finish; that adds a few milliseconds to each
commit.

```text
conversations
  conversation_id  string, primary key
  user_id          string, shard key
  title            string
  updated_at       timestamp          sorts the conversation list

messages
  conversation_id  string             primary key with seq
  seq              integer            position in the conversation
  message_id       string, unique     chosen by the client, for user messages
  role             user | assistant
  content          text
  status           generating | complete | stopped | failed
  generation       integer            which attempt this is; the fencing token
  owner            string             chat server writing it
  input_tokens, output_tokens

usage_outbox
  event_id         string             "<turn_id>:<generation>"
  user_id, tokens, kind               true-up or refund
  created_at

chat_servers
  server_id        string
  lease_until      timestamp          renewed every 10 s, lasts 30 s
```

An assistant row is the turn's reply; its `turn_id` is `conversation_id` plus
`seq`. `complete`, `stopped` and `failed` are terminal for a generation; a
retry starts a new one by raising `generation`.

The **quota store** is separate: a fast in-memory counter store, the one the
[rate limiter case study](/system-design/rate-limiter) designs. For each user
and window it keeps a total and a small map from generation key
(`t-9:1`) to the tokens charged for it.

The KV cache is not in any database. It lives in GPU memory, belongs to one
replica, and is safe to lose: anything missing is recomputed by prefill.

## API design

Signed-in clients send a session token with every request. The main endpoint
sends a message and streams the reply:

```http
POST /v1/conversations/c-4/messages
Authorization: Bearer <session-token>
Content-Type: application/json

{ "message_id": "m-81", "content": "What causes the seasons?" }

HTTP/1.1 200 OK
Content-Type: text/event-stream

event: turn
data: {"turn_id": "t-9", "generation": 1}

event: token
data: {"i": 0, "text": "The"}

event: token
data: {"i": 1, "text": " tilt"}

event: done
data: {"status": "complete", "output_tokens": 412}
```

The body is a **server-sent events** stream: one long HTTP response the server
keeps writing small events into. `i` numbers the events, so a client knows
where it got to. The server groups tokens into one event every 50 ms or so
rather than one event per token.

`message_id` is chosen by the client, and it is the send's **idempotency
key**: a retried send with the same ID never creates a second turn
([idempotency](/systems-and-infrastructure/idempotency)). If the turn already
finished, the retry gets the stored reply; if it is still being written, the
retry joins the live stream.

Errors: `429 Too Many Requests` with the time the quota window frees up;
`503 Service Unavailable` with a `Retry-After` header when the fleet is full;
`409 Conflict` if the conversation already has a reply being written (one at a
time per conversation).

The rest:

- `GET /v1/turns/t-9/stream?after=37` rejoins a reply after a dropped
  connection, from event 38.
- `POST /v1/turns/t-9/stop` stops a reply and keeps its text.
- `POST /v1/turns/t-9/retry` writes the reply again as generation 2.
- `GET /v1/conversations?cursor=…` and `GET /v1/conversations/c-4/messages`
  list conversations and read history.

## High-level architecture

![Architecture of the chat service: browsers and apps connect through a load balancer to chat servers. Chat servers write turns, history and outbox rows to the conversation store, reserve tokens in the quota store, and send generate requests to inference routers. Routers place each request on a GPU replica by conversation, and replicas send load reports back to the routers. A usage relay reads outbox rows from the conversation store and applies true-ups and refunds to the quota store.](/diagrams/llm-chat-serving/architecture.svg)

A **load balancer** spreads client connections over the **chat servers**,
which own a turn from send to finish: record it, reserve quota, build the
prompt from stored history, relay tokens to the client and save the reply,
holding its text in memory meanwhile. They also run the sweeper that cleans up
after a dead chat server (deep dive 1). **Inference routers** decide which
replica runs each request, and whether it runs yet (deep dive 3), and pass the
token stream back. Each **GPU replica** runs one copy of the model with its own
scheduler, which batches requests and manages the KV cache (deep dive 2), and
reports its load to the routers every 100 ms. The **usage relay** carries
usage rows from the conversation store's outbox to the quota store.

A turn, end to end:

![Sequence of one turn: the client sends message m-81; the chat server inserts m-81 and turn t-9 at generation 1 into the conversation store, reserves quota for t-9:1, and asks a router and GPU replica to generate. Tokens flow back to the chat server and on to the client as token events. The chat server then completes the turn if it is still at generation 1, writing a usage row in the same transaction, and sends done. Afterwards the relay applies the true-up for t-9:1 to the quota store.](/diagrams/llm-chat-serving/turn-sequence.svg)

## Deep dive: streaming and saving a reply

**The transport.** The options are covered in
[WebSockets vs. SSE vs. long polling](/systems-and-infrastructure/websockets-vs-sse-vs-long-polling).
Polling (the client asks "anything new?" every half second) adds up to half a
second of delay and, with 98,000 replies in progress at peak, about 196,000
requests a second just to ask. A WebSocket, a two-way connection kept open, fits a chat app
where messages arrive unprompted, which is why the
[chat app case study](/system-design/messaging) uses one. Here nothing arrives
unprompted: every reply answers a request the client just made, and the only
other client-to-server action, stop, can be its own `POST`. A server-sent
events response streams one way over plain HTTP, passes through ordinary
proxies, and ends with the reply, so no server holds idle connections for
users who aren't waiting on anything. This design uses it.

**A dropped connection.** A phone switching networks mid-reply is routine. The
reply keeps being generated either way: the GPU work is already paid for.
Three ways to let the client catch up:

- **Wait for the saved reply.** The client polls the messages endpoint until
  the turn is `complete`. Nothing to build, but the user stares at a frozen
  half-reply for up to a dozen seconds.
- **Log every stream in a shared store.** Each chat server appends token
  batches to a short-lived log any server can read from. Rejoining works
  anywhere, but at 98,000 streams sending 20 batches a second that is about
  2 million writes a second to a store that only matters on the rare rejoin.
- **Proxy to the owner.** The turn row already names its `owner`. A rejoin
  that lands on another chat server reads the row and proxies the stream from
  the owner's memory, from the event number the client last saw.

The third costs a store read and one extra hop, only on rejoin, and this
design uses it. If the owner itself is gone, the text in its memory is gone
too; that case is below.

**Saving the reply.** A turn touches three places: the conversation store, the
quota store and a GPU replica. Each write path, and what a crash at each step
leaves behind:

1. **Send.** One transaction looks up `message_id`; a retried send finds its
   turn and is routed to it. Otherwise, if the conversation's latest assistant
   row is terminal, it inserts the user message and the assistant row at the
   next two `seq` values, as `generating`, generation 1, owner this server;
   if not, the send gets `409`. Two sends racing for the same `seq` collide on
   the primary key, so only one starts. A crash before commit leaves nothing;
   the client retries.
2. **Reserve quota.** The chat server charges the quota store for key `t-9:1`,
   keyed so a repeat is harmless (deep dive 3). If the user is over quota,
   the row is marked `failed` (with the condition from step 4) and the send
   returns `429`. A crash after step 1 but before this leaves a `generating`
   row with no charge.
3. **Generate.** Tokens stream in and are held in memory. Nothing is written
   per token.
4. **Complete.** One transaction updates the assistant row to `complete` with
   its text and token counts **only if** its status is still `generating` and
   its `generation` is still 1, and inserts a `usage_outbox` row with the
   actual token count. Only after this commit does the server send `done`, so
   a reply shown as finished is always stored.
5. **Relay.** The usage relay reads outbox rows and applies them to the quota
   store, marking each row sent afterwards. A crash between applying and
   marking resends the row; the quota store's per-key write makes that
   harmless. This is the [outbox pattern](/systems-and-infrastructure/outbox-pattern),
   used because writing the reply and then calling the quota store directly
   would lose the usage update whenever the server died between the two.

A stop that lands elsewhere is forwarded to the row's owner, which cancels the
replica request and commits `stopped` with its text and a usage row under the
step-4 condition. A retry updates the row to `generating`, generation = g+1,
owner = itself, only if the status is terminal (`complete`, `stopped` or
`failed`) and generation = g, then reserves `t-9:g+1`.

**When a chat server dies.** Its lease stops being renewed. A sweeper job,
which the chat servers run between them, finds
`generating` rows whose owner's lease has expired and, under the same
condition as step 4, marks them `failed` and writes a refund outbox row for
that generation key. The client's rejoin then sees `failed` and offers retry.

A lease can expire while its holder is alive but stalled, for example in a
long garbage-collection pause
([distributed locks](/systems-and-infrastructure/distributed-locks) covers
this). If the stalled server wakes and tries step 4, the row's status is no
longer `generating`, or a retry has raised `generation` to 2, so its write
changes nothing. The `generation` column is the fencing token; checking it
costs nothing extra, since it is part of a single-row conditional update the
shard's primary already serializes.

What can still go wrong: GPU work duplicates when a stalled server's
generation and a retry's both run, and that cost falls on the service, since
only the committed generation is charged. A reply in progress is lost with its
chat server, as the requirements allow. A crash between steps 1 and 2 leads the
sweeper to refund a charge never made; the quota store ignores a refund for a
key it has no charge for. One leak remains: a server that stalls between steps
1 and 2 for longer than its lease, then reserves after the sweeper's refund,
leaves that charge in place until it ages out of the five-hour window.

## Deep dive: batching and the KV cache

This is where the 3,000 tokens a second per replica comes from, and it is the
largest lever on fleet size.

**Why batch at all.** A decode step reads all 140 GB of weights to produce the
next token. For one reply alone, the step might take 20 ms, so 50 tokens a
second, with the GPUs' arithmetic units mostly idle. The same step can
produce the next token for 100 replies at once, because the weights are read
once for all of them; assume that takes 33 ms. That is 3,000 tokens a second
instead of 50: sixty times the throughput for under twice the step time. The
trade between per-request speed and total throughput is the one
[latency vs. throughput](/systems-and-infrastructure/latency-vs-throughput)
describes. The question is how to form the batch.

**Static batching.** Collect a group of requests, run them together until all
are done, then start the next group. Simple, but replies vary from 20 tokens
to 2,000. Slots whose replies finish early sit empty until the longest one
ends, and a new request waits for the whole group: behind a 2,000-token reply
at 33 ms a step, that is over a minute, far past the 2-second target.

**Continuous batching.** The scheduler rebuilds the batch at every step:
finished replies leave, waiting requests join. Slots stay full and a new
request waits one step, not one group. The cost is that a joining request
needs its prefill, and running a 3,000-token prefill in one go at 40,000
tokens a second stalls the step for 75 ms, which every other reply in the
batch sees as a pause.

That leaves two ways to keep prefill from interrupting decode:

- **Chunked prefill.** Split each prompt into pieces of 512 tokens and add one
  piece to each decode step. A piece adds 512 ÷ 40,000 ≈ 13 ms, so a step takes
  about 46 ms, under the 100 ms gap limit. The price: a long prompt takes
  several steps to get through, which raises its time to first token. The
  typical 1,050 new tokens need three steps, about 140 ms; 8,000 new tokens
  need 16 steps, about 0.75 s, which is why the requirement names that size.
- **Separate prefill and decode replicas.** Some replicas only prefill, then
  send the KV cache to a decode replica. Decode steps are never interrupted,
  and each pool can be sized for its own phase. The price is moving the cache:
  3,000 tokens × 320 KB ≈ 1 GB per turn, about 7 TB a second across the fleet
  at peak, which needs a fast network between replicas, and two pools to size
  and keep balanced.

This design uses continuous batching with chunked prefill. With prompts
averaging 3,000 tokens, of which 1,050 are new, the interruptions stay within
the latency targets, and the fleet stays one pool. If long prompts became
common, the transfer cost would be worth paying.

**Memory for the cache.** Each reply in the batch needs its KV cache in GPU
memory, and replies grow a token at a time to lengths nobody knows in advance.
Reserving each request's maximum up front, say 32,000 tokens × 320 KB ≈ 10 GB,
fits only 40 requests into 400 GB, well short of the 100 the throughput
figure assumes. Allocating in small fixed-size blocks (16 tokens, say) as the
reply grows, with a table mapping each request to its blocks, lets 100
average replies share about 109 GB. The price is the lookup table the
attention step has to follow and some complexity in the scheduler. Blocks also
make sharing cheap: many requests can point at the same blocks for the system
prompt, which is what prefix caching needs.

**How long prefixes stay.** After a turn ends, its blocks become a cached
prefix for the conversation's next turn. The ~290 GB left over holds
290 ÷ 1.09 ≈ 266 conversations. Each replica finishes 7,000 ÷ 1,600 ≈ 4.4
turns a second at peak, so a finished conversation stays about 266 ÷ 4.4 ≈ 60
seconds before it is evicted (least recently used first). Assume half of
follow-up messages arrive within a minute; that is the 50% hit rate the
estimates used, and it holds only if the next turn lands on the same replica.
Moving evicted prefixes to the servers' ordinary memory would keep them for
minutes longer, at the cost of copying them back and running a second cache
tier.

When memory runs out mid-reply, the scheduler pauses the newest request, drops
its blocks and later re-runs its prefill. Recomputing costs GPU time but needs
no extra memory tier.

## Deep dive: routing and admission control

The router decides where each request runs and whether it runs now.

**Where to run it.** Three choices:

- **Round-robin**, each replica in turn. It ignores load: a replica with ten
  long replies gets the same share as an idle one. And with 1,600 replicas, a
  conversation's next turn lands on the replica holding its prefix 1 time in
  1,600, so the 50% hit rate becomes nearly 0% and the fleet grows to about
  2,080 replicas.
- **Least loaded**, the replica with the most free memory and fewest waiting
  requests. It balances well but still scatters conversations, with the same
  cache miss.
- **By conversation.** Hash `conversation_id` onto a ring of replicas with
  [consistent hashing](/systems-and-infrastructure/consistent-hashing), so the
  same conversation keeps landing on the same replica, and adding or removing
  a replica moves only about 1/1,600 of conversations. The risk is imbalance:
  a replica can be given more than its share. So the router uses a bounded
  load: if the chosen replica is above 1.25 times the average load, it takes
  the next one on the ring and accepts a cache miss for that turn.

This design uses the third. It is what makes the 50% hit rate possible, and
with it a fleet of 1,600 replicas instead of about 2,080. The price is that routers need a current view of
replica load. Replicas report every 100 ms, so two routers can both send to
a replica that looked free; the replica's scheduler is the final judge and
answers "busy," and the router tries the next replica.

**Whether to run it now.** When traffic rises past the planned peak, demand
exceeds the fleet, and something has to give:

- **Queue everything.** No request is refused, but waits grow without limit.
  Users who see nothing for ten seconds resend, adding load exactly when there
  is none to spare, the pattern in
  [the thundering herd problem](/systems-and-infrastructure/thundering-herd-problem).
- **Reject when full.** Latency stays good for admitted requests, but a
  momentary spike refuses people who would have been served a second later.
- **A short, bounded queue.** Queue a request only if its expected wait keeps
  it within the 2-second first-token target, so about a second, and refuse
  it otherwise. This is [backpressure](/systems-and-infrastructure/backpressure):
  the router tells callers to slow down instead of absorbing unlimited work.

This design uses the bounded queue, ordered by plan: when it has to refuse
someone, free-tier requests go first. Refusals return `503` with a
`Retry-After` value spread randomly over a few seconds, so refused clients
don't all return at once
([exponential backoff](/systems-and-infrastructure/exponential-backoff)). The
cost: in a long overload, free users get no service at all. Shorter reply
limits under load would spread the pain, at the price of one more mode to test.

**Quotas.** Token quotas use the rate limiter's store and checks, applied to
tokens instead of requests (see
[rate limiting](/systems-and-infrastructure/rate-limiting)). A turn's size is
not known until it ends, so the chat server reserves the most it could cost,
the prompt tokens (known after tokenizing) plus the 2,000-token reply limit,
and the true-up lowers the charge to the actual count. Each operation sets the
charge for its generation key rather than adding to a total, in one atomic
step on the user's shard of the quota store: reserve sets it only if absent
and the new total stays within the limit, and a true-up or refund replaces it
only if present. A resent outbox row sets the
same value again. Since the reservation is the maximum, a user never ends
over quota while the quota store is up. The cost is the other way: a user near the limit is refused for a
turn that would have fit, and quota spent on unfinished generations stays
reserved until the sweeper's refund arrives.

## Failure modes and bottlenecks

- **A GPU replica fails mid-reply.** Its streams break. The chat server still
  holds the text so far, so it sends the prompt plus that text to another
  replica and asks it to continue. The user sees a pause of a second or two;
  re-prefilling about 3,400 tokens in 512-token chunks takes about 7 steps,
  roughly 0.3 s, and the rest is queueing.
  The continuation may not match what the failed replica would have written,
  but it reads on from the visible text. Its tokens are charged as usual.
- **A router fails.** Queued requests have not started, so chat servers resend
  them to another router. Streams passing through it break and are handled as
  a replica failure.
- **A chat server fails.** Its in-progress replies are lost. Clients rejoin,
  and within about 30 seconds the sweeper marks those turns `failed` and
  refunds their quota. If each chat server carries a few hundred streams, one failure
  interrupts a few hundred replies.
- **A conversation store shard fails.** Its users can't send until a standby
  copy of the shard is promoted (a few tens of seconds), since a turn can't start
  without its row. Replies being written for those users can't commit, so
  they fail too; this is the main threat to 99.9%.
- **The quota store fails.** Chat servers fall back to local counting, one of
  the policies the [rate limiter case study](/system-design/rate-limiter)
  compares: each enforces a small per-user allowance from memory, so an outage
  costs some uncharged tokens rather than refusing every send. Outbox rows wait
  in the conversation store and the relay applies them once it is back.
- **Very long prompts.** A 100,000-token conversation needs 32 GB of cache
  and 2.5 seconds of prefill, starving the replicas it lands on. Capping
  history (dropping the oldest turns once a conversation passes a limit; see
  [context window](/ai-and-ml/context-window)) and sending the few long
  prompts to a small separate pool keep them from hurting everyone else.
- **Deploying a new model version.** Loading 140 GB of weights takes minutes
  per replica, so rollouts run off-peak, when over three quarters of the fleet
  is idle. A new model or system prompt also empties every prefix cache, and
  prefill load runs high until the caches refill.

## Trade-offs

- **Streaming over plain HTTP instead of WebSockets.** It fits the
  request-then-reply shape and passes through ordinary infrastructure;
  rejoining needs the owner-proxy path.
- **Saving a reply once, at the end.** A chat server crash loses the reply in
  progress. Checkpointing every second would cut the loss to a second's worth
  for about 14 extra writes per reply, some 100,000 more a second at peak.
- **Continuous batching with chunked prefill** gets 3,000 tokens a second per
  replica with one pool of replicas. Separate prefill replicas would give
  steadier token timing but cost a fast network and a second pool to size.
- **Routing by conversation.** The cache hits it enables save about 480
  replicas at peak. It needs a load bound and live load reports to avoid hot
  replicas, and every miss it accepts to stay balanced is paid in prefill.
- **Planning for three times average, not ten.** That keeps the fleet at 1,600
  replicas instead of about 5,300, and means a surge beyond the plan is met by
  refusals, free tier first.
- Reserving the maximum makes quota overruns impossible and turns some
  sends near the limit into refusals that weren't needed.

What would change the design: if long documents or agent-style tasks pushed
typical prompts into the tens of thousands of tokens, prefill would dominate,
and separate prefill replicas and a host-memory cache tier would pay for
themselves. Serving from several regions would flatten the daily peak, since
busy hours in different time zones only partly overlap.
