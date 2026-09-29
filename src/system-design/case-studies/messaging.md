---
title: Design a Chat App (like WhatsApp and Slack)
summary: Open connections, per-conversation ordering, offline sync and fan-out for 10 billion messages a day across 1:1 chats, groups and 50,000-member channels.
date: 2026-09-28
order: 5
---

A chat app moves short messages between people while they are both looking at
the screen, and keeps them safe for whoever isn't. Alice types "On my way" to
Bob; if Bob's phone is open, it should appear there within a fraction of a
second, and if his phone is off, it should be waiting for him when it comes
back, in the right place in the conversation, exactly once. Alice's phone
should show whether the message has reached the server, reached Bob's phone,
and been read.

A WhatsApp-style app is mostly one-to-one chats and small groups between
phones that are often offline. A Slack-style app adds **channels**, named
conversations in a team's workspace that can hold tens of thousands of
members, most of whom read rather than write. They share one core, so one
design carries both. It is one plausible design for an app like WhatsApp or
Slack, not a description of how either company built theirs.

A **conversation** below means any of the three: a 1:1 chat, a group, or a
channel. Each has an ID, such as `c-42`, and a list of members. **Fan-out**
is turning one stored message into what each member's devices need: a live
delivery, a pointer for their next sync, or a push notification.

## Requirements

Functional requirements:

- **Send and receive text messages** in 1:1 chats, in groups of up to 100
  members, and in channels of up to 50,000 members. Every member of a
  conversation sees its messages in the same order.
- **Delivery states.** In 1:1 chats and groups, the sender sees each message
  go through three states: **sent** (the server has stored it), **delivered**
  (it has reached at least one of the recipient's devices) and **read** (the
  recipient has opened the conversation and seen it). In a group, the sender
  sees sent live, and per-member delivered and read ("read by 7 of 9") when
  opening a message's details. Channels show no receipts.
- **Offline delivery.** A message to someone who is offline is kept and
  delivered when they reconnect, and their phone gets a push notification in
  the meantime.
- **Several devices per user.** A user signed in on a phone and a laptop gets
  every message on both, including ones they sent from the other, and each
  device can scroll back through the history from when it signed in (older
  history on a new device is covered under Trade-offs).
- **Presence and typing indicators (optional).** A 1:1 chat shows whether the
  other person is online, or when they were last seen, and "typing…" while
  they type.
- **Search message history (stretch goal).**

Out of scope: sign-up, contacts and workspace administration (assume every
connection carries a session token that identifies a user and device),
attachments (a photo would be uploaded to a separate file store and the
message would carry a link to it), voice and video calls, message editing
and deletion, reactions, threads, bots, spam filtering, and running in more
than one region. None changes how a message gets from one device to another.

Non-functional requirements:

- **Scale:** 200 million daily active users (people who open the app at least
  once that day), each sending 50 messages a day on average. History is kept
  indefinitely.
- **Latency:** a message reaches a recipient who is online within 500 ms at
  the 99th percentile, the time 99% of messages beat. The sender sees "sent"
  within 200 ms at the 99th percentile.
- **Availability:** sending and receiving 99.99% (about 4.3 minutes of
  downtime in a 30-day month). Presence and typing can be down without the
  app being down.
- **Durability:** once a message shows "sent", it is never lost.

## Back-of-the-envelope estimates

These use two rules of thumb from
[numbers every engineer should know](/engineering-practices/numbers-every-engineer-should-know):
one million events a day is about 12 a second, and a system should be planned
for a peak of about ten times its average. A day is 24 × 60 × 60 = 86,400
seconds. Figures are rounded, and the roundings are said where they happen.

**Messages.**

- Per day: 200,000,000 users × 50 = **10 billion messages**.
- Average: 10,000,000,000 ÷ 86,400 ≈ 115,700, call it **116,000 messages a
  second**. The rule of thumb agrees: 10,000 million a day × 12 ≈ 120,000.
- Peak, at ten times average: **about 1.2 million messages a second**.

**Deliveries.** Assume 70% of messages go to 1:1 chats and 30% to groups
averaging 10 members. Each message goes to every other member and to the
sender's own other devices, so every member of the conversation counts, the
sender included. Channel messages are a small share of the total and are
delivered differently, as the fan-out deep dive explains.

- Users per message: 0.7 × 2 + 0.3 × 10 = 4.4.
- Per day: 10 billion × 4.4 = 44 billion deliveries.
- Average: 44,000,000,000 ÷ 86,400 ≈ **509,000 a second**; peak ≈ **5.1
  million a second**.

**Receipts.** Only the other members send receipts: 0.7 × 1 + 0.3 × 9 = 3.4
per message. If each produced one "delivered" and one "read" receipt, that
would be 2 × 3.4 × 10 billion = 68 billion receipts a day,
about 787,000 a second on average: receipts would outnumber messages almost
seven to one. The delivery deep dive shrinks this where messages pile up
unread, by making one receipt cover many.

**Open connections.** Each online device holds one connection to the server,
kept open so the server can send to it at any moment. Assume that at the
busiest moment a quarter of daily users are online, one connection each (a
user with a phone and a laptop open counts twice, which the round quarter
absorbs):

- 200,000,000 × 0.25 = **50 million open connections**.
- A **gateway** is a server whose job is to hold these connections. Assume a
  gateway tuned for it can hold 500,000 connections, most of them idle, and
  run each at half that, 250,000. One failed gateway's clients would add only
  0.5% to each of the other 199; the half is for losing a whole data center's
  share of gateways, or draining a batch during a deploy.
  50,000,000 ÷ 250,000 = **200 gateways**.
- Memory: at an assumed 20 KB per connection, 250,000 × 20 KB = 5 GB per
  gateway. Memory and open-connection limits run out long before CPU.

**Heartbeats.** Proxies and firewalls close connections that stay silent, so
each client sends a tiny **heartbeat** frame every 30 seconds:

- 50,000,000 ÷ 30 ≈ **1.67 million heartbeats a second**, more than the peak
  message rate, all of them answered by the gateways and never passed further
  in: 1,670,000 ÷ 200 ≈ 8,300 a second per gateway.

**Bandwidth.** At 1 KB per delivered message on the wire, framing and
encryption included, the peak is 5.1 million × 1 KB ≈ 5.1 GB a second, about
41 Gbit/s, or 41 ÷ 200 ≈ 200 Mbit/s per gateway: comfortable.

**Storage.** A stored message holds the conversation ID, a sequence number, a
message ID, the sender, a timestamp and the text; with the storage engine's
overhead, round it up to 500 bytes. The message itself is stored once per
conversation:

- Per day: 10,000,000,000 × 500 bytes = 5 TB.
- Per year: 5 TB × 365 = 1,825 TB, about **1.8 PB**, and about 5.5 PB with
  three copies for durability.

What is stored per recipient is a small **inbox** row pointing at the message
(the data model explains it), one per delivery:

- 44 billion rows a day; at peak, 5.1 million inbox writes a second, 4.4 times
  the message writes.
- At about 100 bytes a row, 4.4 TB a day. Rows are kept 30 days, so about
  **132 TB** before replication.

What the estimates say: storage grows fast but simply (append-only, by
conversation), and bandwidth is modest. The hard parts are the 50 million open
connections, the peak of 1.2 million messages a second that each have to find
their recipients' connections and inboxes, and the receipts and presence
updates that would dwarf the messages if handled naively.

## Data model

Every read is "one conversation's messages, in order, from some point": the
latest page, older pages on scroll, everything after what a device has seen.
Writes append to one conversation, and nothing joins two. So messages are
stored grouped by conversation and sorted by their **sequence number**
(`seq`): 1, 2, 3, with no gaps, assigned by the server for reasons the
ordering deep dive gives.

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
latest 50 is one sorted slice from one place. The `bucket` caps how much sits
under one key: at 500 bytes each, 10,000 messages make a 5 MB partition,
however long the conversation runs. A client that knows a `seq` can compute
its bucket, so no lookup is needed to find it. A page that straddles a bucket
boundary costs a second read.

The **inbox** is a per-user list of pointers, not messages: one row for each
message in the user's conversations, their own included (for their other
devices), saying "conversation c-42 has a new message, seq 812". It exists so a reconnecting device can ask one question, "what arrived
after position 5,209?", instead of asking each of its hundreds of
conversations in turn. Inbox rows expire after 30 days; a device offline
longer than that does a full resync, reading the head of each of its
conversations. Only conversations of up to 100 members write inbox rows; the
fan-out deep dive explains why larger ones don't.

A **cursor** is a sequence number meaning "everything up to here":
`last_read_seq = 812` says the member has read 812 and all before it. Each
device also keeps its inbox position and its last seq per conversation.

**The store.** The access pattern (append by key, read a sorted range by key)
is what a **wide-column store** such as Cassandra or ScyllaDB is built for:
rows grouped under a partition key, kept sorted within it, and spread across
machines by that key without the application doing anything.
[SQL vs. NoSQL](/systems-and-infrastructure/sql-vs-nosql) covers the family.
Their write path appends to a log and sorts in the background, which suits the
5.1 million inbox writes a second at peak. Cursors, `head_seq` and
`fanned_out_seq` must only move forward, yet they stay plain writes: each is
written with its seq as the store's write timestamp, so the store's
last-write-wins rule keeps the largest without reading first. That holds only
if nothing touches those cells at the default timestamp, the current time in
microseconds (about 1.8 × 10¹⁵), which would outrank every seq for good. So
every write and delete of them carries a seq timestamp, in a statement of its
own, apart from normally timestamped columns like `member_count`: a new
conversation's `head_seq` and `fanned_out_seq` start at 0, stamped 0; a
joining member's cursors start at `head_seq`, stamped with it. Leaving sets
`left` and keeps the cursors; rejoining clears it and raises them to the
head. Receipts alone
could send up to 787,000 cursor writes a second on average if none were
coalesced. The message writes are harder: each
is a conditional insert (the ordering deep dive says why), and on a store with
no single leader per partition, such as these, a conditional write reads
before it writes and adds rounds of agreement between replicas on top of the
plain write's acknowledgments. At 1.2 million a second at peak, that is the
store's largest cost. A relational database, split by conversation across many
servers, would make that check local to each partition's one primary, but the
split has to be built and operated by hand, and none of its joins or
multi-row transactions are needed. This design takes the wide-column store and
pays for the conditional writes with more nodes; a store with a leader per
partition would be the first thing to reconsider. Either way the data is
divided by conversation, as
[partitioning vs. sharding](/systems-and-infrastructure/partitioning-vs-sharding)
describes, and a conversation far busier than the rest (a company-wide
channel) becomes a **hot partition**, one partition taking a large share of
the traffic, which the fan-out deep dive plans for.

Two small pieces of state live in memory instead, because they are rebuilt in
seconds if lost and change too often to be worth writing to disk:

- The **session registry**: for each online user, which devices are
  connected and to which gateway (`u-bob → [(d-1, gateway-17)]`). At about 100
  bytes per connection, 50 million connections take 5 GB.
- **Presence**: for each user, online or not, and when last seen.

## API design

Each device holds one long-lived WebSocket for everything live and uses
ordinary HTTPS for one-off fetches. A **WebSocket** starts as an HTTP request
that asks to be upgraded, then stays open as a two-way channel on which either
side can send a message, called a **frame**, at any time;
[WebSockets vs. SSE vs. long polling](/systems-and-infrastructure/websockets-vs-sse-vs-long-polling)
compares it with the alternatives. A device opens
`wss://chat.example/connect`, and its first frame carries its session token.
From the device:

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

The sender's device generates `message_id` before the first attempt and reuses
it on every retry; the server and every receiving device use it to recognize
a copy they've already seen. The `ack` turns "sending" into "sent".

Over HTTPS:

```http
GET /conversations/c-42/messages?before_seq=763&limit=50
```

returns the 50 messages before seq 763, for scrolling back. Creating a group
(`POST /conversations`), joining a channel
(`POST /channels/c-9/members`) and a full resync
(`GET /me/conversations`, each with its `head_seq` and the user's cursors) are
ordinary requests too, kept off the socket so the gateways do one job.

## High-level architecture

![Architecture of the chat app. Clients reach a load balancer, which sends WebSockets to the connection gateways and HTTPS (history, groups, resync) to the message service. Gateways register users in the session registry, exchange online status and typing with the presence service, and pass sends, syncs and receipts to the message service, which appends to and reads from the message store and publishes messages and receipts to the fan-out queue. Fan-out workers look members up in the registry, write inbox entries to the store, deliver through the gateways, and hand offline members to the push service.](/diagrams/messaging/architecture.svg)

The pieces:

- The **load balancer** passes each WebSocket to one gateway, where it stays
  until it closes, and sends ordinary HTTPS requests straight to the message
  service.
- The **connection gateways** hold the 50 million open WebSockets, answer
  heartbeats, and turn frames into calls on the services behind them. If one
  dies, its clients reconnect elsewhere and lose nothing: everything durable
  is in the store.
- The **session registry** maps each online user to their gateways.
- The **message service** numbers, stores and acknowledges each message, and
  answers syncs and history reads. Sends and history reads for a
  conversation both go to the instance that owns it.
- The **fan-out queue** and **fan-out workers** take each stored message and
  get it to every member's devices, the sender's other devices included: live
  through a gateway if online, as an inbox entry for the next sync regardless,
  and as a push notification if offline.
- The **push service** hands notifications to the push service of each
  phone's operating system, which can wake a phone whose app isn't running.
- The **presence service** tracks who is online and relays typing
  indicators.

Following Alice's "On my way" to Bob, who is online:

1. Alice's phone sends a `send` frame over its WebSocket to gateway 3.
2. Gateway 3 passes it to the message service instance that owns
   conversation `c-42`.
3. The message service assigns seq 812, writes the message to the store, and
   once the write is durable, sends the `ack` back through gateway 3. Alice
   sees one tick: sent.
4. The message service puts "c-42, seq 812" on the fan-out queue.
5. A fan-out worker takes it, writes inbox entries for Bob and for Alice (her
   laptop needs the message too), and asks the registry where they are
   connected: Bob on gateway 17.
6. Gateway 17 pushes the `message` frame to Bob's phone.
7. Bob's phone sends `receipt delivered up to 812`, which travels back the
   same way (gateway, message service, fan-out queue and worker, Alice's
   gateway) and turns Alice's tick into two.

Putting the queue between steps 3 and 5 means Alice's "sent" waits only for
the durable write, not for delivery to every member, so "sent" comes back as
fast in a 100-member group as in a 1:1 chat. The queue is split into partitions by
conversation ID, so one conversation's messages reach the workers in order,
the per-key ordering [message queues](/systems-and-infrastructure/message-queues)
explains.

Steps 3 and 4 are two writes to two systems, and an owner that dies between
them would leave a stored, "sent" message that nobody delivers. So the owner
raises `c-42`'s `fanned_out_seq` to 812 only once the queue has accepted every
seq up to 812 (enqueues are pipelined, so 812 can be accepted before 811), and
a new owner taking over `c-42` re-enqueues every stored seq above
`fanned_out_seq`. An owner that loses a conditional insert (the ordering deep
dive) enqueues the seqs it lost to, from that one up to the latest stored,
since the owner that won them may have died before enqueuing. Some seqs go twice, which downstream deduplication absorbs.
It is the [outbox pattern](/systems-and-infrastructure/outbox-pattern) with
the message log itself as the outbox.

## Deep dive: holding 50 million connections

A server can't start a conversation with a client over plain HTTP: HTTP is
request and response, and a phone that hasn't asked has nothing to receive an
answer on. Chat needs the server to speak first. Three techniques do it (the
topic linked under API design covers how); what matters here is what each
costs at this scale.

**Long polling** works through any proxy that allows ordinary HTTP, but every
delivered message ends a request, so each one also pays for a new request and
its headers, often several hundred bytes, larger than the message, 5.1
million times a second at peak.

**Server-sent events (SSE)** deliver cheaply but only one way, so every send,
receipt and typing indicator needs its own HTTP request, and a chat client
sends nearly as much as it receives.

**WebSockets** carry all of it on one connection, a few bytes of framing per
frame, but every proxy on the path must allow the upgrade and keep the
connection open, and some corporate networks don't.

This design uses **WebSockets**, because chat traffic runs both ways and most
frames are tiny, with long polling as a fallback for networks that block the
upgrade.

**Routing a message to its recipient's connection.** Holding the connection is
half of it. Bob's socket is on one of 200 gateways, and the fan-out worker
has to find which one. Three ways:

- **Broadcast every message to every gateway**, and let each gateway deliver
  to whichever recipients it holds. No lookup at all, but each gateway would
  handle all 1.2 million messages a second at peak to find the 0.5% meant for
  its own clients.
- **A publish-subscribe broker with a topic per user.** Each gateway
  subscribes to the topic of every user it holds, and the fan-out worker
  publishes to the recipient's topic. The broker does the routing, but it has
  to track 50 million subscriptions, changing every time a phone reconnects.
- **A session registry.** Each gateway writes "u-bob is on gateway-17" when
  Bob connects and deletes it when he leaves. The worker looks Bob up and
  sends straight to gateway 17. It costs one registry read per delivery, up to
  5.1 million a second at peak, spread across registry nodes by user ID with
  [consistent hashing](/systems-and-infrastructure/consistent-hashing), so
  adding a node moves only its share of users. A group message looks up all
  its members in one batched read.

The registry is the choice for 1:1 chats and groups: it is the most direct and
its load grows with deliveries, not with the number of gateways.
Publish-subscribe comes back for large channels, where it wins, as the fan-out
deep dive shows.

The registry can be wrong for a moment: a gateway dies without cleaning up, or
Bob's phone switches from Wi-Fi to mobile data and reconnects to a different
gateway while the old entry lingers. Entries expiring on their own would need
renewing more often than they expire: every 60 seconds for a two-minute
expiry is 50 million ÷ 60 ≈ 833,000 writes a second. Instead each gateway
renews one liveness key every 10 seconds, expiring after 30 (200 ÷ 10 = 20
writes a second in all). The key carries an incarnation number that goes up
each time the gateway starts, and each entry records the incarnation it was
written under, so an entry counts only while its gateway's key exists with
the same number; a restarted gateway-17 can't revive its old entries. Dead
entries are deleted when a lookup finds them, and a background sweep removes
the rest. A reconnect on a new gateway overwrites the device's entry, and a
gateway asked to deliver to a user it no longer holds says so. Either way the
worker treats Bob as offline for that message: a push, and his phone collects
the message from its inbox entry on the next sync.

**Why push is needed.** A phone's operating system suspends an app soon after
it leaves the screen, taking its WebSocket with it, and then only the
system's push service, one connection per phone shared by every app, reaches
it. The app, woken or opened, syncs the message itself, so a lost push delays
a message and can't lose it.

## Deep dive: ordering messages

Every member of a conversation must see its messages in the same order, and
a reply must never appear above the message it replies to. That needs some
number to sort by. Four candidates:

**The sender's clock.** Phone clocks can be wrong by minutes. If Alice's runs
two minutes fast, her question sent at 09:14:00 is stamped 09:16:00, and Bob's
answer at 09:14:30 sorts above it, for everyone.

**The server's clock.** Server clocks are kept close by time
synchronization, but a few milliseconds apart is normal, so two messages 2 ms
apart on two servers can be stamped in the wrong order. And timestamps can't
tell a client it has missed something: after 09:14:03.120 and 09:14:03.410,
was there a message in between?

**Globally unique, time-ordered IDs.** Each server generates IDs made of a
timestamp in the high bits and its own machine number and a counter in the
low bits. This fixes ties, but IDs within one conversation have gaps, the IDs
in between having gone to other conversations, so a client still can't tell
"nothing was sent" from "something was lost".

**A per-conversation sequence number.** Each conversation has its own counter,
and each message takes the next value: 811, 812, 813. The order is simply the
order the server accepted them in, the same for everyone. The numbers are also
dense: a device holding 810 that receives 812 knows 811 is missing and asks
for it, a device can sync "after 811", and a receipt can say "read up to 812".
The cost is that one place has to hand out a conversation's numbers, one at a
time.

The per-conversation sequence is the choice. If Alice and Bob hit send in the
same instant, the server decides which is first, and both see that order; the
order they pressed send in is lost, since no server can know it without
trusting their clocks. But Bob can only reply to a message his phone has
received, which already has its number, so his reply always gets a higher one
and sorts below it.

**Who assigns the numbers.** Each conversation is owned by one message service
instance, chosen by [consistent hashing](/systems-and-infrastructure/consistent-hashing)
of the conversation ID, so every send to `c-42` goes to the same instance,
which keeps `c-42`'s next number in memory. One owner per conversation is not
a throughput limit: even a busy channel sends a few messages a second.

The risk is a handover. When an instance fails or the pool grows, `c-42` moves
to a new owner. `head_seq` is updated separately from the message and may lag,
so the new owner reads the latest bucket it points to (and the next, if that
one is full) and takes the highest seq actually stored. For a moment, the old
owner may not know it has been replaced, and both could assign 813 to
different messages. The store settles it: the message is written with a
conditional insert, "only if (c-42, 813) doesn't exist yet", so one write wins
and the other owner rereads the latest stored seq, with a linearizable read
(one guaranteed to see every write completed before it), and retries as 814.
`head_seq` is written with its seq as the write timestamp, as the data model
described, so a stale owner can't move it backwards. The conditional insert is paid on every message, with the
extra rounds of agreement the data model described, as the price of never
giving two messages one number.

The alternative is fencing, from
[distributed locks](/systems-and-infrastructure/distributed-locks): each owner
holds a **lease**, permission to own a conversation that expires unless
renewed, carrying a number that rises with every change of owner, and the
store rejects writes with an older number. On a store with a single leader per
partition, that leader checks the number cheaply as part of an ordinary write.
On the leaderless store chosen here, checking it is itself a read, compare and
write needing the same agreement, so fencing would save nothing and add a
lease service.

Meanwhile Alice's phone shows her message at the bottom, marked "sending";
when the `ack` brings seq 812, it moves into place, below Bob's 811 if his
arrived first, as everyone else sees it.

## Deep dive: delivery, receipts and offline users

The network between a phone and the server drops things, and neither side
can tell whether a message it sent was lost on the way or its reply was lost
on the way back. The design gives up on exactly-once delivery over the wire
and builds it from two pieces: send until acknowledged (**at-least-once**
delivery), and throw away copies that were already seen (**deduplication**).

The sequence below follows Alice's message to Bob, who is offline when she
sends it.

![Sequence of one message from Alice to offline Bob. Alice sends m-7f3a through the gateways to the message service, which stores it as c-42 seq 812 and acks; Alice sees "sent". Via the queue, a fan-out worker writes inbox entries for Bob and for Alice's other devices, finds Bob offline in the registry and notifies him through the push service. When Bob reconnects and syncs after inbox position 5,209, the message service reads his inbox and c-42 seq 812 and returns the message through the gateways. Bob's "delivered up to 812" goes through the gateways, message service and a fan-out worker to Alice's gateway, and Alice sees "delivered"; "read up to 812", sent when Bob opens the chat, takes the same route.](/diagrams/messaging/delivery-sequence.svg)

**From Alice to the server.** Alice's phone keeps "On my way" in a local
outbox until it gets an `ack`, and with no ack within a few seconds sends
again, over a new connection if need be, with the same `message_id`. If only
the ack was lost, the message service recognizes `m-7f3a` and replies with the
original seq: [idempotency](/systems-and-infrastructure/idempotency) with a
key the client chose. The owner keeps each conversation's recent message IDs
in memory, reloading them from the latest bucket when it takes over. A retry
arriving after its ID has aged out (a phone that lost its ack, then sat in a
drawer for a day) would be stored twice, under two seqs, and receiving devices
drop the second copy by `message_id`. The ack is sent only after a majority of
the store's replicas have the message, which backs the promise that "sent" is
never lost.

**From the server to Bob.** Bob can get a message two ways: pushed live over
his socket, or pulled by a sync. When he is offline, as in the sequence, it
waits. The fan-out worker has already written the inbox entry "c-42, seq 812"
at position 5,210 in Bob's inbox. When Bob's phone reconnects, it sends `sync`
with the last inbox position it processed, 5,209. The message service reads
the inbox entries after that, fetches the messages they point to (here just
c-42 seq 812, the one after the 811 his phone already has) and returns them.
Once his phone has stored them, it moves its inbox position to 5,210.

A dense per-user counter would need one place handing out each user's
numbers, while Bob's entries come from whichever workers carry his
conversations. So a position is a **time-ordered ID**: the worker's clock
reading plus a random tie-breaker, shown here as small numbers. Two workers can finish their writes out of
order, so an entry with an earlier position can appear after a sync has read
past it. The design bounds that: a worker that hasn't finished writing an
entry within 5 seconds of taking its ID abandons it and writes the entry again
under a fresh ID, acknowledging the queue message only after that write
succeeds, and worker clocks are kept within a second of each other. No entry
the device depends on can then appear more than 6 seconds behind the newest,
so a sync reads from 10 seconds before the device's position, and the device
drops entries it already has. An abandoned write that lands late only adds a
duplicate. The design depends on that clock bound: a worker whose clock drifts
further could have entries skipped silently, noticed only when a later message
in the same conversation reveals the gap.

A sync also re-sends messages delivered live since the device's last sync,
because live delivery doesn't move the inbox position: a live ack can't prove
every earlier entry arrived. In the worst case each of the 44 billion daily
deliveries is read a second time at the next reconnect, about 509,000 extra
message reads a second on average, which the design accepts. So Bob's phone
drops any message whose `message_id` it already holds, and fills gaps it spots
in the sequence numbers by fetching the missing range.

**Receipts as cursors.** The naive receipt, one "delivered" and one "read" per
message per recipient, is the 68 billion a day from the estimates. Bob's
phone instead sends "delivered up to 812" once it has everything up to 812,
and "read up to 812" when he opens the chat and sees it. In a live
back-and-forth, where each message is read as it arrives, that is still one
receipt per message. The saving comes when messages pile up: 20 messages
waiting for Bob while he's away cost two receipts instead of 40. The message
service stores the cursor in the `members` row (`last_delivered_seq`,
`last_read_seq`, written with the seq as the write timestamp so a late or
repeated receipt changes nothing) and, in a 1:1 chat, sends it on to Alice
through the fan-out path.
Her phone marks every message up to 812 as delivered, or read. A forwarded
receipt isn't stored for a device that is offline; when Alice's phone opens
the chat, it reads Bob's current cursors from the `members` row, one read, and
catches up.

Cursors can only say "everything up to here", where per-message receipts
would be exact, but messages are delivered and read in order, so that is all
a chat screen shows.

In a group, members' receipts are stored but not each forwarded to Alice.
"Read by 7 of 9" is the count of members whose `last_read_seq` is at least
812, fetched when Alice opens the message's details, rather than pushed to her
after every member's receipt.

**Several devices.** Bob's laptop and phone each keep their own inbox position
and per-conversation seqs, and sync independently; a message Bob sends from
the phone reaches the laptop through his own inbox entry. Delivered means "at
least one of Bob's devices has it". His read cursor is shared: a read on the
laptop is also fanned out to Bob's other devices, so the phone clears its
unread badge and notification, and a device that was offline gets Bob's
cursors with its conversation list on reconnect.

## Deep dive: groups and large channels

Fan-out, as defined at the top, can happen at two times.

**Fan out on write.** When the message is stored, the worker does the
per-member work at once: an inbox entry, a registry lookup, and a live
delivery or a push. A sync then reads one inbox. The cost grows with members ×
messages.

**Store once, read by cursor.** Nothing is written per member; each device
compares the conversation's `head_seq` with its own cursor. Writes cost
nothing extra, but a reader checks each conversation instead of one inbox.

For a 1:1 chat or a 10-member group, fan-out on write is cheap: 2 to 10 inbox
entries per message, 4.4 on average, and reconnecting with one inbox read is
worth that price.

Now a 50,000-member channel on a busy morning, say one message a second:

- **Fan out on write:** 50,000 inbox entries and 50,000 registry lookups a
  second, from one channel. The whole system averages 509,000 deliveries a
  second, so this one channel would add about 10% on its own. A push per
  message to 50,000 people would be unusable as well as expensive.
- **Store once:** one write a second. Unread badges are the channel's
  `head_seq` minus each member's read cursor, computed on the member's own
  device.

So delivery follows size, not kind. Any conversation of up to 100 members
fans out on write, including a small channel; anything larger is stored once.
Groups are capped at 100, so only a channel ever crosses the line: from its
101st member on, its messages stop writing inbox rows, and its members'
devices are told to track it by `head_seq`. It stays in store-once mode if it
later shrinks, so it never flips back and forth. Receipts follow kind:
channels have none at any size. The 100 is a tuning choice: a 100-member group
sending one message a second costs 100 inbox entries a second, which is noise.

Channels still need live delivery to the members who are online. Registry
lookups per member would be the same 50,000 a second, so channels use a
version of the publish-subscribe option set aside in the connections deep
dive, subscribed per gateway rather than per user. Each gateway records in the
session registry, for every large channel that at least one of its connected
users belongs to, that it wants that channel's messages. The fan-out worker
reads the channel's list of gateways, at most 200, sends the message once to
each, and each gateway hands it to its own connected members from memory. If
one member in ten is online, that's 5,000 devices reached with at most 200
messages between servers. Large channels are few compared with users, so these
subscriptions stay manageable in a way that 50 million per-user ones
didn't.

A reconnecting device asks for the `head_seq` of each big channel it belongs
to (one batched read) and fetches only the channels it opens. Pushes go out
only for mentions (`@bob`), and receipts are off, as the requirements said.

A popular channel is also the hot partition the data model warned of: its
latest messages are read by thousands of members opening it in the same
minute. History reads go to the channel's owner, which keeps each channel's
last few hundred messages in memory and answers "latest page" reads from
there, sparing the store.

## Deep dive: presence and typing indicators

Presence ("online", "last seen 09:12") and typing indicators are cheap
because they are **ephemeral** (only the current value matters) and **lossy**
(a missed update is corrected by the next one or a timeout). Nothing here is
stored, acknowledged or retried.

**Presence.** A user is online while one of their devices holds a connection;
the gateway reports opens and clean closes. A phone that vanishes (the train
went into a tunnel) is marked offline after two missed 30-second heartbeats,
up to a minute late, and a user is shown offline only after ten seconds
without reconnecting, so a flaky connection doesn't flicker.

Who hears about a change is where the cost is. Assume each user goes online
and offline 10 times a day, 20 changes, and has 200 contacts:

- 200,000,000 users × 20 = 4 billion changes a day, about 46,000 a second.
- **Push every change to every contact:** × 200 = 800 billion notifications a
  day, about 9.3 million a second, nearly twice the peak message deliveries.
- **Push only to contacts who are online:** if a quarter of them are, as for
  users overall, about 2.3 million a second, still above the average message
  deliveries.
- **Push only to people looking at you.** Presence shows in a 1:1 chat's
  header, so a device subscribes while that chat is open. An online device
  has at most one chat open: at most 50 million subscriptions over 200
  million users, 0.25 watchers per user. 46,000 changes a second × 0.25 ≈
  **12,000 notifications a second**.

The third is the choice, about 800 times less traffic than the first; the
contact list shows "last seen" fetched when it opens instead of live dots.
Presence lives only in memory, split by user ID; a lost node's users look
offline until their gateways re-report them, and losing the whole service
costs dots and "typing…" while messages keep flowing.

**Typing.** While Alice types, her phone sends a `typing` frame at most every
three seconds; the presence service relays it to whoever has `c-42` open, and
their screens show "Alice is typing…" until five seconds pass without another.
A lost frame makes the indicator blink off early, and nothing can leave it
stuck on. Typing frames are the first thing a gateway drops when a client's
buffer fills.

## Failure modes and bottlenecks

**A gateway dies.** Its 250,000 clients all reconnect and sync at once, a
[thundering herd](/systems-and-infrastructure/thundering-herd-problem) on the
other gateways and the store. With
[exponential backoff](/systems-and-infrastructure/exponential-backoff) and
random jitter spreading the first attempts over 30 seconds, that is
about 8,300 reconnects a second, about 40 per surviving gateway, and nothing
is lost. Deploys drain gateways a few at a time for the same reason.

**A slow client.** A phone on a weak signal reads frames more slowly than a
busy group produces them, and the gateway buffers what's waiting. Each
connection gets a bounded buffer; when it fills, the gateway first drops
typing and presence frames, then closes the connection, which is
[backpressure](/systems-and-infrastructure/backpressure) applied to one
client. Closing is safe: the phone reconnects and syncs what it missed from
the store.

**A message service instance dies.** Its conversations move to other
instances by consistent hashing. Sends in flight get no ack, so their clients
retry with the same message IDs after a timeout; the new owner finds the
latest stored seq and re-enqueues every seq above `fanned_out_seq`. Seqs the
old owner stored in the handover and died before enqueuing are enqueued when
the new owner's next insert loses to them, so a stored message is delivered
at worst with the conversation's next send; duplicates are caught by message
ID, and the
conditional insert stops two owners giving out one number during the
handover. Senders see "sending" for a few seconds longer.

**The fan-out queue falls behind.** Messages are stored and acknowledged but
arrive late. The queue's consumer lag (how far the workers trail the newest
message) is the signal to add workers.

**The session registry loses a node.** Its users are treated as offline (a
push, then the next sync) until their gateways, which know their own
connections, re-register them within seconds.

**A phone operating system's push service is slow or down.** Offline users
aren't nudged, but their messages are stored and in their inboxes, so they get
them the next time they open the app.

**Knowing any of this is happening.** Watch send-to-delivered time at p99,
connections per gateway and the reconnect rate, fan-out queue lag, syncs a
second, push failures, and retried sends caught as duplicates (a sign of lost
acks).
[Observability](/systems-and-infrastructure/observability) covers how
metrics, logs and traces divide that work.

## Trade-offs

- **WebSockets over SSE and long polling:** one cheap two-way channel per
  device, but a long polling fallback to keep for networks that block it.
- **Per-conversation sequence numbers over timestamps:** one order for
  everyone and detectable gaps, paid for with a single owner per conversation
  and a conditional write per message.
- **At-least-once delivery with dedup on the device:** nothing acknowledged is
  lost, but every device tracks its cursors and message IDs.
- **Cursor receipts:** one receipt per batch of piled-up messages, able to say
  only "everything up to here".
- **Fan-out on write up to 100 members, store once above:** cheap reconnects
  and cheap big channels, at the price of two delivery paths and a threshold
  to tune.
- **Presence only for people who are looking:** about 800 times less presence
  traffic; the contact list shows "last seen" instead of live status.

**Server-readable history or end-to-end encryption.** In this design the
server can read what it stores. With **end-to-end encryption**, the sender's
device encrypts each message, and the server stores and relays
**ciphertext**, scrambled bytes it has no key to read. Sequence numbers,
cursors, the inbox and fan-out keep working on metadata the server still sees
(who, which conversation, which seq). This design assumes 1:1 messages are
encrypted separately for each receiving device (the recipient's, and the
sender's other devices), so the `messages` row keeps the metadata and a
`message_ciphertexts` table keyed by (conversation_id, seq, device_id) holds
one body per device. With two devices each that is three bodies per message;
even counting the whole 500-byte row three times, daily storage rises from 5
TB to at most 12 TB (3.5 TB of 1:1 messages tripled, plus 1.5 TB of group
messages). In groups, each sender shares a group key with the members' devices
once per membership change and encrypts each message once, keeping one copy.
What goes is anything that needs the text: the server can't search it, so
search runs on each device, and a push can't carry the text unless the phone
decrypts it. A device added later can't read earlier history unless the
user's other devices re-share it or it is restored from a backup, which is
why the requirements promise scroll-back only from sign-in. A reasonable split for this merged product is
end-to-end encryption for 1:1 chats and small groups, and server-readable team
channels, where search and history for people who join later are part of the
point.

**Search (stretch goal).** For server-readable conversations, a separate
consumer of the fan-out queue feeds a search engine's index of words to
message IDs, so indexing never slows delivery; results are filtered by the
searcher's memberships.

What would change the design: several regions would give each conversation
a home region for its sequence numbers, which cross-region chats pay for in
latency. And if channel
messages became a large share of traffic, per-gateway fan-out would be next to
revisit: a big channel already has members on nearly every gateway (5,000
online members over 200 gateways is 25 each), so each channel message costs
about 200 sends between servers whatever its size, and 10,000 channel messages
a second would be 2 million of them.
