---
title: Design a Chat App (like WhatsApp and Slack)
summary: Open connections, per-conversation ordering, offline sync and fan-out for 10 billion messages a day across 1:1 chats, groups and 50,000-member channels.
date: 2026-09-28
order: 5
---

A chat app moves short messages between people while they are looking at the
screen, and keeps them for whoever isn't. Alice types "On my way" to Bob; if
his phone is open it should appear within a fraction of a second, and if it's
off it should be waiting when it comes back, in the right place, exactly
once. Alice's phone shows whether it has reached the server, reached Bob's
phone, and been read.

A WhatsApp-style app is mostly one-to-one chats and small groups between
phones that are often offline. A Slack-style app adds **channels**, named
conversations in a team's workspace that can hold tens of thousands of
members, most of whom read rather than write. One design carries both; it is
a plausible design, not how either company built theirs.

A **conversation** below means any of the three: a 1:1 chat, a group, or a
channel. Each has an ID, such as `c-42`, and a list of members. **Fan-out**
is turning one stored message into what each member's devices need: a live
delivery, a pointer for their next sync, or a push notification.

## At a glance

**Requirements.**

- Text messages in 1:1 chats, groups of up to 100 and channels of up to
  50,000, in the same order for every member.
- Sent, delivered and read states in chats and groups; offline users get a
  push and the message on reconnect, on every device.
- 200 million daily active users sending 50 messages a day each, history
  kept indefinitely.
- An online recipient gets a message within 500 ms at p99; the sender sees
  "sent" within 200 ms.
- Sending and receiving 99.99% available, and a message shown "sent" is
  never lost.

**Key numbers.** From the estimates:

- 1.2 million messages a second at peak: 10 billion ÷ 86,400 ≈ 116,000,
  times ten.
- 5.1 million deliveries a second at peak: 4.4 users per message × 10
  billion = 44 billion a day ≈ 509,000 a second, times ten.
- 50 million open connections on 200 gateways: a quarter of daily users
  online, 250,000 per gateway.
- 1.67 million heartbeats a second: 50 million connections ÷ 30 seconds.
- About 1.8 PB of messages a year: 10 billion × 500 bytes = 5 TB a day.

**Key decisions.**

- A per-conversation sequence number from one owning instance: one order for
  everyone, and gaps a device can detect
  ([ordering deep dive](#deep-dive-ordering-messages)).
- At-least-once delivery with deduplication by `message_id`: nothing
  acknowledged is lost on a network that drops replies
  ([delivery deep dive](#deep-dive-delivery-receipts-and-offline-users)).
- Fan out on write up to 100 members, store once above: a 50,000-member
  channel sending once a second would otherwise add about 10% to all
  deliveries ([groups deep dive](#deep-dive-groups-and-large-channels)).

**Likely follow-ups.**

- How does a message find the recipient's connection? A session registry
  maps online users to gateways ([architecture](#high-level-architecture)).
- What does an offline phone get? A push, then a sync from its last inbox
  position ([delivery](#deep-dive-delivery-receipts-and-offline-users)).
- Don't receipts swamp the system? They are cursors, "read up to 812", so 20
  piled-up messages cost two receipts instead of 40
  ([receipts](#deep-dive-delivery-receipts-and-offline-users)).
- How is presence kept cheap? A change goes only to devices with that chat
  open, about 12,000 notifications a second instead of 9.3 million
  ([trade-offs](#trade-offs)).
- What happens when a gateway dies? Its 250,000 clients reconnect with
  backoff over 30 seconds, about 8,300 a second, and sync what they missed
  ([failure modes](#failure-modes-and-bottlenecks)).

The components, and one message's path, are in
[High-level architecture](#high-level-architecture).

## Requirements

Functional requirements:

- **Send and receive text messages** in 1:1 chats, in groups of up to 100
  members, and in channels of up to 50,000 members. Every member of a
  conversation sees its messages in the same order.
- **Delivery states.** In 1:1 chats and groups, the sender sees each message
  go through three states: **sent** (the server has stored it), **delivered**
  (it has reached at least one of the recipient's devices) and **read** (the
  recipient has seen it). In a group, per-member delivered and read ("read by
  7 of 9") show when the sender opens a message's details. Channels show no
  receipts.
- **Offline delivery.** A message to someone offline is kept for their
  reconnect, and their phone gets a push notification meanwhile.
- **Several devices per user.** A phone and a laptop both get every message,
  including ones sent from the other, and each can scroll back through the
  history from when it signed in.
- **Presence and typing indicators (optional)** in 1:1 chats: online or
  last seen, and "typing…".
- **Search message history (stretch goal).**

Out of scope: sign-up, contacts and workspace administration (every
connection carries a session token that identifies a user and device),
attachments (a message would carry a link to a file store), calls, editing
and deletion, reactions, threads, bots, spam filtering, and more than one
region. None changes how a message gets from one device to another.

Non-functional requirements:

- **Scale:** 200 million daily active users (people who open the app at least
  once that day), each sending 50 messages a day on average. History is kept
  indefinitely.
- **Latency:** an online recipient gets a message within 500 ms at the 99th
  percentile (the time 99% of messages beat); the sender sees "sent" within
  200 ms.
- **Availability:** sending and receiving 99.99% (about 4.3 minutes of
  downtime in a 30-day month); presence and typing may fail separately.
- **Durability:** once a message shows "sent", it is never lost.

## Back-of-the-envelope estimates

These use two rules of thumb from
[numbers every engineer should know](/engineering-practices/numbers-every-engineer-should-know):
one million events a day is about 12 a second, and a system should be planned
for a peak of about ten times its average. A day is 86,400 seconds.

**Messages.**

- Per day: 200,000,000 users × 50 = **10 billion messages**.
- Average: 10,000,000,000 ÷ 86,400 ≈ 115,700, call it **116,000 messages a
  second**. The rule of thumb agrees: 10,000 million a day × 12 ≈ 120,000.
- Peak, at ten times average: **about 1.2 million messages a second**.

**Deliveries.** Assume 70% of messages go to 1:1 chats and 30% to groups
averaging 10 members. A message also goes to the sender's own other devices,
so every member counts, the sender included. Channel messages are a small
share and are delivered differently (the groups deep dive).

- Users per message: 0.7 × 2 + 0.3 × 10 = 4.4.
- Per day: 10 billion × 4.4 = 44 billion deliveries.
- Average: 44,000,000,000 ÷ 86,400 ≈ **509,000 a second**; peak ≈ **5.1
  million a second**.

**Receipts.** Only the other members send receipts: 0.7 × 1 + 0.3 × 9 = 3.4
per message. If each produced one "delivered" and one "read" receipt, that
would be 2 × 3.4 × 10 billion = 68 billion receipts a day, about 787,000 a
second on average, almost seven for every message. The delivery deep dive
makes one receipt cover many.

**Open connections.** Assume that at the busiest moment a quarter of daily
users are online, one connection each (a second open device is absorbed by
the round quarter):

- 200,000,000 × 0.25 = **50 million open connections**.
- A **gateway** is a server whose job is to hold these connections. Assume a
  gateway tuned for it can hold 500,000 connections, most of them idle, and
  run each at half that, 250,000, leaving room to lose a data center's share
  of gateways or drain a batch during a deploy.
  50,000,000 ÷ 250,000 = **200 gateways**.
- Memory: at an assumed 20 KB per connection, 250,000 × 20 KB = 5 GB per
  gateway. Memory and open-connection limits run out long before CPU.

**Heartbeats.** Proxies and firewalls close connections that stay silent, so
each client sends a tiny **heartbeat** frame every 30 seconds:

- 50,000,000 ÷ 30 ≈ **1.67 million heartbeats a second**, more than the peak
  message rate, all answered by the gateways: 1,670,000 ÷ 200 ≈ 8,300 a
  second per gateway.

**Bandwidth.** At 1 KB per delivered message on the wire, framing and
encryption included, the peak is 5.1 million × 1 KB ≈ 5.1 GB a second, about
41 Gbit/s, or 41 ÷ 200 ≈ 200 Mbit/s per gateway: comfortable.

**Storage.** A message row (IDs, sender, timestamp, text and the storage
engine's overhead) rounds up to 500 bytes, stored once per conversation:

- Per day: 10,000,000,000 × 500 bytes = 5 TB.
- Per year: 5 TB × 365 = 1,825 TB, about **1.8 PB**, and about 5.5 PB with
  three copies for durability.

Per recipient, a small **inbox** row points at the message (the data model
explains it), one per delivery:

- 44 billion rows a day; at peak, 5.1 million inbox writes a second, 4.4 times
  the message writes.
- At about 100 bytes a row, 4.4 TB a day. Rows are kept 30 days, so about
  **132 TB** before replication.

Storage and bandwidth are simple. The hard parts are the 50 million
connections, finding recipients for 1.2 million messages a second at peak,
and receipts and presence updates that would dwarf the messages if handled
naively.

## Data model

Every read is "one conversation's messages, in order, from some point", and
every write appends to one conversation. So messages are stored grouped by
conversation and sorted by their **sequence number** (`seq`): 1, 2, 3, with
no gaps, assigned by the server (the ordering deep dive says why).

```text
messages                partition key (conversation_id, bucket), sorted by seq
  conversation_id   string      "c-42"
  bucket            integer     seq ÷ 10,000, rounded down
  seq               integer     812
  message_id        string      "m-7f3a…", a random ID the sender's device chose
  sender_id         string      "u-alice"
  sent_at           timestamp   server time, for display only
  body              bytes       the text (or ciphertext; see Trade-offs)

conversations           key conversation_id
  kind              direct | group | channel
  head_seq          integer     highest seq stored; only ever raised
  fanned_out_seq    integer     highest seq handed to the fan-out queue
  member_count      integer

members                 partition key conversation_id, then user_id
  last_delivered_seq, last_read_seq     the member's receipt cursors
  left              boolean     set on leaving; the cursors are kept

user_conversations      partition key user_id, then conversation_id
  kind                                   the reverse of members

inbox                   partition key user_id, sorted by position
  position          time-ordered ID (see the delivery deep dive)
  conversation_id   string
  seq               integer     "c-42 has a new message, seq 812"
```

A **partition key** decides which machine holds a row and which rows sit
together on disk. A conversation's recent messages share one, so reading the
latest 50 is one sorted slice from one place. The `bucket` caps a partition at
10,000 messages, 5 MB at 500 bytes each, however long the conversation runs,
and a client that knows a `seq` can compute its bucket.

The **inbox** is a per-user list of pointers: one row for each message in the
user's conversations, their own included (for their other devices). It lets a
reconnecting device ask one question, "what arrived after position 5,209?",
instead of asking each of its hundreds of conversations. Rows expire after 30
days; a device offline longer does a full resync, reading the head of each
conversation. Only conversations of up to 100 members write inbox rows (the groups deep dive says why).

A **cursor** is a sequence number meaning "everything up to here":
`last_read_seq = 812` says the member has read 812 and all before it.

**The store.** Append by key and read a sorted range by key is what a
**wide-column store** such as Cassandra or ScyllaDB is built for: rows grouped
under a partition key, kept sorted within it, and spread across machines by
that key ([SQL vs. NoSQL](/systems-and-infrastructure/sql-vs-nosql)). Its
log-structured writes suit the 5.1 million inbox writes a second at peak.
Cursors, `head_seq` and `fanned_out_seq` must only move forward, yet stay
plain writes: each is written with its seq as the store's write timestamp, so
last-write-wins keeps the largest without reading first. A write at the
default timestamp (the current time in microseconds, about 1.8 × 10¹⁵) would
outrank every seq for good, so each is written in a statement of its own: new
counters start at 0, stamped 0, and a joining member's cursors at `head_seq`,
stamped with it. Leaving sets `left` and keeps the cursors; rejoining raises
them to the head.

The message writes cost more. Each is a conditional insert (the ordering deep
dive says why), and on a store with no single leader per partition, such as
these, a conditional write reads first and adds rounds of agreement between
replicas: at 1.2 million a second at peak, the store's largest cost. A
relational database split by conversation would make the check local to each
partition's one primary, but the split is built by hand, for joins nothing
here needs. This design pays with more nodes; a store with a leader per
partition would be the first thing to reconsider. Either way data is divided by conversation
([partitioning vs. sharding](/systems-and-infrastructure/partitioning-vs-sharding)),
and a conversation far busier than the rest (a company-wide channel) becomes
a **hot partition**, which the groups deep dive plans for.

Two pieces of state live in memory, rebuilt in seconds if lost:

- The **session registry**: for each online user, which devices are
  connected and to which gateway (`u-bob → [(d-1, gateway-17)]`). At about 100
  bytes per connection, 50 million connections take 5 GB.
- **Presence**: for each user, online or not, and when last seen.

## API design

Each device holds one long-lived WebSocket for everything live and uses
ordinary HTTPS for one-off fetches. A **WebSocket** starts as an HTTP request
that asks to be upgraded, then stays open as a two-way channel on which either
side can send a message, called a **frame**, at any time. Long polling would
pay for new request headers, often larger than the message, on each of 5.1
million deliveries a second at peak, and server-sent events carry only one
way while a chat client sends nearly as much as it receives
([WebSockets vs. SSE vs. long polling](/systems-and-infrastructure/websockets-vs-sse-vs-long-polling));
long polling stays as a fallback for networks that block the upgrade. A
device opens `wss://chat.example/connect`, and its first frame carries its
session token. From the device:

```json
{ "type": "send", "conversation_id": "c-42", "message_id": "m-7f3a", "body": "On my way" }
{ "type": "receipt", "conversation_id": "c-42", "kind": "read", "up_to_seq": 812 }
{ "type": "sync", "after_inbox": 5209 }
{ "type": "typing", "conversation_id": "c-42" }
{ "type": "ping" }
```

From the server:

```json
{ "type": "ack", "message_id": "m-7f3a", "seq": 812, "sent_at": "2026-09-28T09:14:03Z" }
{ "type": "message", "conversation_id": "c-42", "seq": 812, "message_id": "m-7f3a",
  "sender_id": "u-alice", "body": "On my way", "sent_at": "2026-09-28T09:14:03Z" }
{ "type": "receipt", "conversation_id": "c-42", "user_id": "u-bob", "kind": "delivered", "up_to_seq": 812 }
```

The sender's device chooses `message_id` once and reuses it on every retry,
and the `ack` turns "sending" into "sent".

Over HTTPS:

```http
GET /conversations/c-42/messages?before_seq=763&limit=50
```

returns the 50 messages before seq 763, for scrolling back. Creating a group
(`POST /conversations`), joining a channel (`POST /channels/c-9/members`) and
a full resync (`GET /me/conversations`, with each `head_seq` and the user's
cursors) stay off the socket so the gateways do one job.

## High-level architecture

![Architecture of the chat app. Clients reach a load balancer, which sends WebSockets to the connection gateways and HTTPS (history, groups, resync) to the message service. Gateways register users in the session registry, exchange online status and typing with the presence service, and pass sends, syncs and receipts to the message service, which appends to and reads from the message store and publishes messages and receipts to the fan-out queue. Fan-out workers look members up in the registry, write inbox entries to the store, deliver through the gateways, and hand offline members to the push service.](/diagrams/messaging/architecture.svg)

The pieces:

- The **load balancer** passes each WebSocket to one gateway, where it stays
  until it closes, and sends HTTPS requests to the message service.
- The **connection gateways** hold the 50 million open WebSockets, answer
  heartbeats, and turn frames into calls on the services behind them. One
  that dies loses nothing: everything durable is in the store.
- The **session registry** maps each online user to their gateways.
- The **message service** numbers, stores and acknowledges each message, and
  answers syncs and history reads, each at the instance that owns the
  conversation.
- The **fan-out queue** and **fan-out workers** get each stored message to
  every member's devices, the sender's other devices included: live through a
  gateway if online, an inbox entry regardless, and a push if offline.
- The **push service** hands notifications to each phone operating system's
  push service, the only thing that reaches a suspended app. The woken app
  syncs the message itself, so a lost push delays a message and can't lose
  it.
- The **presence service** tracks who is online and relays typing
  indicators.

Following Alice's "On my way" to Bob, who is online:

1. Alice's phone sends a `send` frame over its WebSocket to gateway 3.
2. Gateway 3 passes it to the message service instance that owns
   conversation `c-42`.
3. The message service assigns seq 812, writes the message to the store, and
   once the write is durable, sends the `ack` back. Alice sees one tick: sent.
4. The message service puts "c-42, seq 812" on the fan-out queue.
5. A fan-out worker writes inbox entries for Bob and for Alice (her laptop
   needs the message too), and asks the registry where they are connected:
   Bob on gateway 17.
6. Gateway 17 pushes the `message` frame to Bob's phone.
7. Bob's phone sends `receipt delivered up to 812`, which travels back
   through the message service and fan-out path to Alice: two ticks.

With the queue between steps 3 and 5, "sent" waits only for the durable
write, so it comes back as fast in a 100-member group as in a 1:1 chat. The
queue is partitioned by conversation ID, so one conversation's messages reach
the workers in order, the per-key ordering
[message queues](/systems-and-infrastructure/message-queues) explains.

Steps 3 and 4 are two writes to two systems, and an owner that dies between
them would leave a "sent" message that nobody delivers. So the owner raises
`c-42`'s `fanned_out_seq` to 812 only once the queue has accepted every seq up
to 812 (enqueues are pipelined, so 812 can be accepted before 811), and a new
owner re-enqueues every stored seq above `fanned_out_seq`. An owner that
loses a conditional insert (the ordering deep dive) enqueues the seqs it lost
to, up to the latest stored, since their winner may have died before
enqueuing. Some seqs go twice, which deduplication absorbs. It is the
[outbox pattern](/systems-and-infrastructure/outbox-pattern) with the message
log as the outbox.

**Finding Bob's gateway.** Broadcasting every message to all 200 gateways
would make each handle 1.2 million messages a second at peak to find the 0.5%
meant for its clients, and a publish-subscribe broker with a topic per user
would track 50 million subscriptions that change on every reconnect. The
session registry costs one lookup per delivery, up to 5.1 million a second at
peak (a group's members in one batched read), spread across nodes by user ID
with [consistent hashing](/systems-and-infrastructure/consistent-hashing).
Publish-subscribe comes back, per gateway, for large channels.

The registry can be briefly wrong: a gateway dies without cleaning up, or
Bob's phone switches networks and reconnects elsewhere. Expiring each entry
would need renewals faster than the expiry: every 60 seconds for a two-minute
expiry is 50 million ÷ 60 ≈ 833,000 writes a second. Instead each gateway
renews one liveness key every 10 seconds, expiring after 30 (20 writes a
second in all), carrying an incarnation number that rises each time the
gateway starts. An entry counts only while its gateway's key exists with the
incarnation it was written under, so a restarted gateway-17 can't revive old
entries; dead ones are deleted on lookup or by a background sweep. A reconnect on a new gateway overwrites that device's entry, so the registry follows the phone. When a lookup misses, or a gateway no longer holds Bob, the worker treats him as
offline: a push, and the inbox entry waits for his next sync.

## Deep dive: ordering messages

Every member must see a conversation's messages in the same order, and a
reply must never appear above the message it answers. Four candidates to sort
by:

- **The sender's clock.** Phone clocks can be minutes off. If Alice's runs
  two minutes fast, her question at 09:14:00 is stamped 09:16:00, and Bob's
  answer at 09:14:30 sorts above it, for everyone.
- **The server's clock.** Server clocks differ by a few milliseconds, so two
  messages 2 ms apart on two servers can be stamped out of order, and a
  timestamp can't tell a client it missed something in between.
- **Globally unique, time-ordered IDs** (a timestamp in the high bits, a
  machine number and counter in the low bits) fix ties, but one
  conversation's IDs have gaps where other conversations took the values, so a
  client can't tell "nothing was sent" from "something was lost".
- **A per-conversation sequence number.** Each message takes the
  conversation's next value: 811, 812, 813. The order is the order the server
  accepted them in, and the numbers are dense: a device holding 810 that
  receives 812 asks for 811, a sync can say "after 811", and a receipt "read
  up to 812". The cost is one place handing out each conversation's numbers.

The sequence number is the choice. If Alice and Bob hit send in the same
instant, the server picks the order and both see it; Bob can only reply to a
message his phone has, which already has its number, so his reply always gets
a higher one.

**Who assigns the numbers.** Each conversation is owned by one message service
instance, chosen by consistent hashing of its ID, which keeps the next number
in memory. One owner is not a throughput limit: even a busy channel sends a
few messages a second.

The risk is a handover, when an instance fails or the pool grows. `head_seq`
may lag the messages, so the new owner reads the latest bucket it points to
(and the next, if that one is full) and takes the highest seq stored. For a
moment the old owner may not know it was replaced, and both could assign 813
to different messages. Two ways to stop that:

- **Fencing**, from
  [distributed locks](/systems-and-infrastructure/distributed-locks): each
  owner holds a **lease**, permission to own a conversation that expires
  unless renewed, carrying a number that rises with every change of owner,
  and the store rejects writes with an older number. A store with one leader
  per partition checks that cheaply; on the leaderless store chosen here the
  check is itself a read, compare and write needing a round of agreement, so
  fencing would save nothing and add a lease service.
- **A conditional insert**: write "only if (c-42, 813) doesn't exist yet".
  One write wins, and the other owner rereads the latest stored seq with a
  linearizable read (one guaranteed to see every completed write) and retries
  as 814.

This design uses the conditional insert, paid on every message as the price
of never giving two messages one number, and a stale owner can't move
`head_seq` backwards because it carries its seq as the write timestamp.
Meanwhile Alice's phone shows her message at the bottom, marked "sending";
when the `ack` brings seq 812, it moves into place, below Bob's 811 if his
arrived first.

## Deep dive: delivery, receipts and offline users

The network drops things, and neither side can tell whether its message or
the reply was lost. So the design builds exactly-once display from two
pieces: send until acknowledged (**at-least-once** delivery), and throw away
copies already seen (**deduplication**). The sequence follows Alice's message
to Bob, offline when she sends it.

![Sequence of one message from Alice to offline Bob. Alice sends m-7f3a through the gateways to the message service, which stores it as c-42 seq 812 and acks; Alice sees "sent". Via the queue, a fan-out worker writes inbox entries for Bob and for Alice's other devices, finds Bob offline in the registry and notifies him through the push service. When Bob reconnects and syncs after inbox position 5,209, the message service reads his inbox and c-42 seq 812 and returns the message through the gateways. Bob's "delivered up to 812" goes through the gateways, message service and a fan-out worker to Alice's gateway, and Alice sees "delivered"; "read up to 812", sent when Bob opens the chat, takes the same route.](/diagrams/messaging/delivery-sequence.svg)

**From Alice to the server.** Alice's phone keeps "On my way" in a local
outbox until it gets an `ack`, resending after a few seconds, over a new
connection if need be, with the same `message_id`. If only the ack was lost,
the message service recognizes `m-7f3a` and replies with the original seq:
[idempotency](/systems-and-infrastructure/idempotency) with a key the client
chose. The owner keeps each conversation's recent message IDs in memory,
reloading them from the latest bucket on takeover. A retry arriving after its
ID aged out (a phone that lost its ack, then sat in a drawer for a day) is
stored twice, and receiving devices drop the second copy by `message_id`. The
ack goes out only after a majority of the store's replicas have the message,
which backs "sent is never lost".

**From the server to Bob.** Bob gets a message pushed live over his socket or
pulled by a sync. Offline, as in the sequence, the fan-out worker has already
written "c-42, seq 812" at position 5,210 in his inbox. His phone reconnects
and sends `sync` with the last position it processed, 5,209; the message
service returns the messages the later entries point to, and once they're
stored the phone moves its position to 5,210.

Bob's entries come from whichever workers carry his conversations, so a dense
per-user counter would need one place handing out his numbers. Instead a
position is a **time-ordered ID**: the worker's clock reading plus a random
tie-breaker, shown here as small numbers. Two workers can finish out of
order, so an entry can land behind a position a sync already read past. The
bound: a worker that hasn't written an entry within 5 seconds of taking its
ID writes it again under a fresh ID, acknowledging the queue message only
after that succeeds, and worker clocks stay within a second of each other. No entry the device depends on can then land more than 6 seconds behind the newest, so a sync reads from 10 seconds before the device's position and the device drops what it has; an abandoned write that lands late only adds a duplicate. A worker whose clock drifts past that bound could have entries skipped
silently, noticed only when a later message reveals the gap.

Live delivery doesn't move the inbox position, because a live ack can't prove
every earlier entry arrived, so a sync re-sends what came live since the last
one: at worst every delivery read twice, about 509,000 extra reads a second
on average, which the design accepts. The phone drops any `message_id` it
already holds and fetches any range of seqs it finds missing.

**Receipts as cursors.** Instead of the 68 billion per-message receipts a day
from the estimates, Bob's phone sends "delivered up to 812" once it has
everything up to 812, and "read up to 812" when he sees it. A live
back-and-forth still costs one receipt per message; the saving comes when
messages pile up: 20 waiting while Bob's away cost two receipts instead of 40.
A cursor can say only "everything up to here", but messages are read in
order, so that is all a chat screen shows. The message service stores it in
the `members` row (seq as the write timestamp, so a late or repeated receipt
changes nothing) and, in a 1:1 chat, forwards it to Alice through the fan-out
path; an offline Alice reads Bob's cursors from the row when she opens the
chat. In a group, receipts are stored but not forwarded: "read by 7 of 9"
counts members whose `last_read_seq` is at least 812, fetched when Alice opens
the message's details.

**Several devices.** Each of Bob's devices keeps its own inbox position and
per-conversation seqs and syncs independently; a message he sends from the
phone reaches the laptop through his own inbox entry. Delivered means at least
one device has it. His read cursor is shared: a read on the laptop fans out to
his other devices, clearing the phone's unread badge.

## Deep dive: groups and large channels

Fan-out can happen at two times. **Fan out on write**: when the message is
stored, the worker does each member's inbox entry, registry lookup and
delivery or push at once, so a sync reads one inbox, at a cost of members ×
messages. **Store once, read by cursor**: nothing is written per member, and
each device compares the conversation's `head_seq` with its own cursor, so a
reader checks each conversation instead of one inbox.

For a 1:1 chat or a 10-member group, fan-out on write costs 2 to 10 inbox
entries per message, 4.4 on average, a fair price for reconnecting with one
inbox read. Now a 50,000-member channel on a busy morning, one message a
second:

- **Fan out on write:** 50,000 inbox entries and 50,000 registry lookups a
  second from one channel. The whole system averages 509,000 deliveries a
  second, so this channel alone would add about 10%, and a push per message
  to 50,000 people would be unusable.
- **Store once:** one write a second. Unread badges are `head_seq` minus each
  member's read cursor, computed on the device.

So delivery follows size. Any conversation of up to 100 members fans out on
write, a small channel included; anything larger is stored once. Groups are
capped at 100, so only a channel crosses the line: from its 101st member its
messages stop writing inbox rows and its members' devices track it by
`head_seq`, and it stays that way if it shrinks, so it never flips back and
forth. The 100 is a tuning choice: a 100-member group sending once a second
costs 100 inbox entries a second, which is noise. Receipts follow kind:
channels have none at any size.

Online channel members still need live delivery, and per-member registry
lookups would be the same 50,000 a second. So channels use publish-subscribe
per gateway: each gateway records in the session registry every large channel
one of its connected users belongs to, and the fan-out worker sends each
message once to each gateway on the channel's list, at most 200, which hands
it to its own members from memory. If one member in ten is online, 5,000
devices are reached with at most 200 messages between servers, and large
channels are few enough that these subscriptions stay manageable.

A reconnecting device reads the `head_seq` of each big channel it belongs to
in one batched read, and fetches only the channels it opens. Pushes go out
only for mentions (`@bob`). A popular channel is also the data model's hot
partition, opened by thousands in the same minute, so its owner answers
"latest page" reads from its last few hundred messages in memory.

## Failure modes and bottlenecks

**A gateway dies.** Its 250,000 clients reconnect and sync at once, a
[thundering herd](/systems-and-infrastructure/thundering-herd-problem).
[Exponential backoff](/systems-and-infrastructure/exponential-backoff) with
random jitter spreads the first attempts over 30 seconds: about 8,300
reconnects a second, about 40 per surviving gateway, and nothing is lost.
Deploys drain gateways a few at a time for the same reason.

**A slow client.** A phone on a weak signal reads frames more slowly than a
busy group produces them. Each connection gets a bounded buffer; when it
fills, the gateway drops typing and presence frames first, then closes the
connection, [backpressure](/systems-and-infrastructure/backpressure) applied
to one client. The phone reconnects and syncs what it missed.

**A message service instance dies.** Its conversations move to other
instances by consistent hashing. Sends in flight get no ack, so their clients
retry with the same message IDs; the new owner re-enqueues every stored seq
above `fanned_out_seq`. A seq the old owner stored during the handover but
never enqueued is enqueued when the new owner's next insert loses to it, so
it is delivered at worst with the conversation's next send. Duplicates are
caught by message ID, and senders see "sending" for a few seconds longer.

**The fan-out queue falls behind.** Messages are acknowledged but arrive
late; consumer lag (how far the workers trail the newest message) is the
signal to add workers.

**The session registry loses a node.** Its users are treated as offline (a
push, then the next sync) until their gateways re-register them within
seconds.

**A push service is slow or down.** Offline users aren't nudged, but their
messages wait in their inboxes for the next time they open the app.

**Knowing any of this is happening.** Watch send-to-delivered time at p99,
connections per gateway and the reconnect rate, fan-out queue lag, push
failures, and retried sends caught as duplicates (a sign of lost acks); see
[observability](/systems-and-infrastructure/observability).

## Trade-offs

- **WebSockets over SSE and long polling:** one cheap two-way channel per
  device, plus a long polling fallback to keep.
- **Per-conversation sequence numbers over timestamps:** one order and
  detectable gaps, paid for with a single owner per conversation and a
  conditional write per message.
- **At-least-once delivery with dedup on the device:** nothing acknowledged is
  lost; every device tracks cursors and message IDs.
- **Cursor receipts** say only "everything up to here", which is all a chat
  screen shows.
- **Fan-out on write up to 100 members, store once above:** cheap reconnects
  and cheap big channels, for two delivery paths and a threshold to tune.
- **Presence only for people who are looking:** about 800 times less presence
  traffic, and the contact list shows "last seen" instead of live dots.

**Presence and typing.** Both are lossy (the next update or a timeout
corrects a missed one), so nothing is stored, acknowledged or retried, and
losing the in-memory presence service costs only dots and "typing…". A
vanished phone shows offline after two missed heartbeats plus ten seconds, so
a flaky connection doesn't flicker. The cost is in who hears a change. Assume
each user has 200 contacts and goes online and offline 10 times a day: 200
million × 20 = 4 billion changes a day, about 46,000 a second. Pushing each to
every contact is about 9.3 million notifications a second, nearly twice the
peak message deliveries; only to online contacts, still about 2.3 million.
Instead a device subscribes to someone's presence only while their 1:1 chat
is open, at most one chat per online device: 50 million subscriptions over
200 million users is 0.25 watchers each, so 46,000 × 0.25 ≈ **12,000
notifications a second**. Typing is relayed the same way.

**Server-readable history or end-to-end encryption.** With **end-to-end
encryption**, the server stores and relays **ciphertext** it has no key to
read; sequence numbers, cursors, the inbox and fan-out keep working on the
metadata. If 1:1 messages are encrypted separately for each receiving device
(a `message_ciphertexts` table keyed by conversation_id, seq and device_id),
two devices each means three bodies per message: even counting the whole
500-byte row three times, daily storage rises from 5 TB to at most 12 TB (3.5
TB of 1:1 messages tripled, plus 1.5 TB of group messages, each encrypted once
under a group key). What goes is anything that needs the text: search runs on
the device, a push can't carry the text unless the phone decrypts it, and a
new device can't read earlier history unless another device re-shares it,
which is why the requirements promise scroll-back only from sign-in. A
reasonable split is end-to-end encryption for 1:1 chats and small groups, and
server-readable team channels, where search and history for later joiners are
the point.

**Search (stretch goal).** For server-readable conversations, a separate
consumer of the fan-out queue feeds a search index, so indexing never slows
delivery; results are filtered by the searcher's memberships.

What would change the design: several regions would give each conversation a
home region for its sequence numbers, paid for in cross-region latency. And
if channel messages became a large share of traffic, per-gateway fan-out is
next: a big channel has members on nearly every gateway, so 10,000 channel
messages a second would be 2 million sends between servers.
