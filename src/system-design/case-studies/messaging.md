---
title: Design a Chat App (like WhatsApp and Slack)
summary: One owner numbering each conversation, retries with deduplication, and fan-out that switches to store-once above 100 members, for 10 billion messages a day.
date: 2026-10-05
order: 5
---

You're asked to design a chat app. Alice types "On my way" to Bob: if his phone is open it should appear within a fraction of a second, and if it's off it should be waiting when it comes back, once, in the right place. A **conversation** is a 1:1 chat, a group, or a **channel**: a named room of up to tens of thousands of mostly-reading members. The hard parts are millions of open connections, one agreed order, and no lost messages.

## Requirements

- Text messages in 1:1 chats, groups of up to 100 and channels of up to
  50,000, in the same order for every member.
- Sent, delivered and read ticks in chats and groups; channels show none.
- Offline users get a push notification, then the message on reconnect, on
  every device they own.
- 200 million daily active users send 50 messages a day each; history is kept
  forever.
- An online recipient sees a message within 500 ms at p99 (99% of messages are
  faster); the sender sees "sent" within 200 ms. Sending and receiving are up
  99.99% of the time, and a message that showed "sent" isn't lost.

Out of scope: attachments, calls, editing, search, encryption and multiple
regions.

## Key numbers

Size the send path, delivery, gateways and store, with peak at ten times average
([numbers every engineer should know](/engineering-practices/numbers-every-engineer-should-know)):

- **Sends: about 1.2 million messages a second at peak.** 200 million × 50 = 10
  billion a day ÷ 86,400 ≈ 116,000 a second on average.
- **Deliveries: about 5.1 million a second at peak.** Assume 70% of messages go
  to 1:1 chats and 30% to groups of 10, counting the sender's own inbox: 4.4
  inbox entries per message, so 509,000 a second on average.
- **Gateways: 200 servers holding 50 million connections.** Assume a quarter of
  users are online and a gateway, a server holding open connections, runs at 250,000, half its capacity.
- **Message store: about 7 TB a day, 2.6 PB a year.** 10 billion messages ×
  500 bytes, plus 44 billion inbox entries × 50 bytes, before three copies.

## High-level architecture

![Architecture of the chat app. Clients reach a load balancer, which sends WebSockets to the connection gateways and HTTPS (history, groups, resync) to the message service. Gateways register users in the session registry and pass sends, syncs and receipts to the message service, which appends to and reads from the message store and publishes messages and receipts to the fan-out queue. Fan-out workers look members up in the registry, write inbox entries to the store, deliver through the gateways, and hand offline members to the push service.](/diagrams/messaging/architecture.svg)

Follow "On my way" with Bob online. Alice's phone holds a
[WebSocket](/systems-and-infrastructure/websockets-vs-sse-vs-long-polling), a
connection that stays open so either side can send at any time, to a gateway.
The gateway passes her `send` to the message service instance that owns
conversation `c-42`, which numbers it 812, stores it and replies with an `ack`:
one tick, "sent". It then puts the message on the fan-out
[queue](/systems-and-infrastructure/message-queues), so "sent" never waits on
delivery. A fan-out worker writes an inbox entry for Bob and one for Alice,
which her laptop reads, asks the session registry which gateway holds Bob, and that gateway
pushes the message down his socket. With no registry entry, Bob counts as
offline and the push service notifies his phone.

## API and data model

```json
{ "type": "send", "conversation_id": "c-42", "message_id": "m-7f3a", "body": "On my way" }
{ "type": "ack", "message_id": "m-7f3a", "seq": 812 }
{ "type": "sync", "after_inbox": 5209 }
```

```http
GET /conversations/c-42/messages?before_seq=763&limit=50
```

```text
messages  partition key (conversation_id, bucket), sorted by seq
  seq 812, message_id "m-7f3a", sender_id, body, sent_at
          bucket = seq ÷ 10,000, rounded down
inbox     partition key user_id, sorted by position
  position (time-ordered ID), conversation_id, seq
```

Reads walk one conversation in order, so rows are
grouped by conversation and sorted by `seq`, which suits a wide-column store
such as Cassandra ([SQL vs. NoSQL](/systems-and-infrastructure/sql-vs-nosql)).
`bucket` caps a partition at 10,000 messages. The `inbox` holds one pointer per
delivery, so a reconnecting phone asks one question for all its chats, "what
arrived after 5,209?". Several workers write an inbox, so one entry can land
behind a position already read: the phone reads a few seconds back and drops
what it has.

## Decision: one owner numbers each conversation

Every member must see the same order, so one message service instance owns each
conversation, picked by
[consistent hashing](/systems-and-infrastructure/consistent-hashing) of its ID,
and hands out 811, 812, 813. A busy channel sends a few messages a second, so
one owner isn't a bottleneck. The numbers are dense: a phone holding 810 that
receives 812 asks for 811. If an owner dies, its replacement may briefly
overlap it and both hand out 813, so the insert is conditional: write only if
`(c-42, 813)` doesn't exist. One wins; the loser rereads and takes 814.

Why not sort by timestamp? Phone clocks can be minutes off and servers
disagree by milliseconds, so a reply can land above its question.
Time-ordered IDs fix that but leave gaps where other conversations took
values, so a phone can't tell "nothing was sent" from "something was lost".

**Rule of thumb.** When people must agree on an order, let one place assign it
within the smallest unit that needs it, and number densely so a gap is visible.

## Decision: retry and deduplicate

A sender can't tell a lost message from a lost reply. So Alice's phone resends with the same `message_id` until it gets an `ack`; the owner answers
a repeat with the original `seq`
([idempotency](/systems-and-infrastructure/idempotency)). Bob's phone drops repeats. The `ack` waits for a majority of the store's
replicas, so "sent" survives a node loss. If Bob is offline, his inbox entry
waits and a push wakes the phone, which sends `sync` with its last position. A
lost push delays a message and can't lose it.

Why not a broker that guarantees exactly-once delivery? Its guarantee ends at
the consumer, and the last hop is a phone, so the app needs dedup anyway.

**Rule of thumb.** Over a link that can lose replies, retry until acknowledged
and make repeats harmless instead of trying to prevent them.

## Decision: fan out on write up to 100 members

Small conversations cost a few inbox entries per message. Now a 50,000-member channel at one message a
second: 50,000 inbox rows a second, kept forever, is about 216 GB a day from
one room, and a push per message to every offline member. So a channel above
100 members **stores once**: no inbox rows, and each device compares the
channel's latest `seq` with its own read position. Gateways subscribe to the
channels their clients have open, so each message goes once to each
subscribed gateway, at most 200, and offline members get one summary push.

Why not fan out on write everywhere, for one path to maintain? One busy
channel would add 3% to the whole store's daily growth. The cost of not
doing it: two delivery paths and a threshold to tune.

**Rule of thumb.** Fan out on write while audiences are small; once an audience
is large, store once and let readers pull.

## Likely follow-ups

- **How does a message find Bob's gateway?** One registry lookup per delivery.
  Broadcasting to all 200 gateways would make each sift 1.2 million messages a
  second for its 0.5%.
- **What if the owner dies between storing 812 and enqueueing it?** The
  conversation records the highest seq the queue accepted, and the new owner
  re-enqueues every stored seq above it
  ([outbox pattern](/systems-and-infrastructure/outbox-pattern)). Dedup absorbs
  the repeats.
- **What if a gateway dies?** Its 250,000 clients reconnect at once, a
  [thundering herd](/systems-and-infrastructure/thundering-herd-problem), so
  backoff with jitter spreads them out; the store has everything.
- **Don't receipts swamp the system?** A receipt is a cursor: "read up to 812"
  covers every earlier message, so 20 piled-up messages cost two receipts, not 40.
