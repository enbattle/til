---
title: Design a Chat App (like WhatsApp and Slack)
summary: One owner numbering each conversation, retries with deduplication, and fan-out that switches to store-once above 100 members, for 10 billion messages a day.
date: 2026-10-05
order: 5
template: 3
---

You're asked to design a chat app. Alice types "On my way" to Bob: if his phone is open it should appear within a fraction of a second, and if it's off it should be waiting when it comes back, once, in the right place. A **conversation** is a 1:1 chat, a group, or a **channel**: a named room of up to tens of thousands of mostly-reading members. The hard parts are millions of open connections, one agreed order, and no lost messages.

This page starts with the obvious design and shows where it breaks, follows "On my way" through the design that replaces it, sizes its parts, and makes three decisions: who numbers a conversation, how retries stay safe, and how delivery changes for big channels.

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

## Start simple

The obvious design has one server and one table. Alice's phone sends "On my way" to the **message service**, a server that writes it as a row in the **message store**, a database, with the conversation, sender, text and time.

Bob's phone asks the service every so often, "anything new for me?" That is **polling**. For a small app it's fine. Say 10,000 people use it, a quarter are online at once, and each phone asks once a second:

```text
online:
  10,000 ÷ 4 = 2,500
questions a second:
  2,500 × 1 = 2,500
```

One database answers that easily. Now run the steps on this app's numbers. A message that arrives just after a question waits a whole interval, so meeting 500 ms at p99 means asking every 0.5 seconds. Assume a quarter of the 200 million users are online at once:

```text
online:
  200,000,000 ÷ 4 = 50,000,000
questions per phone a second:
  1 ÷ 0.5 s = 2
questions a second:
  50,000,000 × 2 = 100,000,000
messages a day:
  200,000,000 × 50 = 10,000,000,000
messages a second, average:
  10,000,000,000 ÷ 86,400 s ≈ 116,000
questions per message:
  100,000,000 ÷ 116,000 ≈ 860
```

That is 100 million questions a second, and about 859 of every 860 get the answer "nothing". So reverse it and let the server do the telling. Each phone opens a [WebSocket](/systems-and-infrastructure/websockets-vs-sse-vs-long-polling), a connection that stays open so either side can send at any time, to a **gateway**, a server whose job is holding open connections. A message goes straight down the connection the moment it exists.

Pushing brings two problems. Fifty million connections need many gateways, and the message service that receives Alice's message doesn't know which gateway holds Bob. A **session registry**, a lookup from each user to the gateway holding them, answers that.

Then there is the wait. Alice shouldn't stare at a spinner while the service delivers to everyone, so it stores the message, replies, and puts it on a [queue](/systems-and-infrastructure/message-queues) for **workers**, background processes that take messages from it, to deliver. A worker asks the registry where Bob is and tells that gateway to push.

If Bob's phone is off, there's no connection to push down. A **push service** asks the phone's operating system to show a notification instead.

Those are the parts, but they don't yet say who numbers a conversation, what a retry does, or what Bob finds waiting after a night offline.

## High-level architecture

![Architecture of the chat app. Phones and desktops open a WebSocket to the connection gateways and send HTTPS requests (history, groups) to the message service. Gateways record each user in the session registry and pass sends, catch-up requests and ticks to the message service, which saves messages to and reads them from the message store and puts new messages and ticks on the queue. Workers take them from the queue, look up each member in the registry, write an entry per member in the store, deliver through the gateways and hand offline members to the push service.](/diagrams/messaging/architecture.svg)

Follow "On my way" with Bob online. Alice's phone sends it down her socket to a gateway, which passes it to the message service instance that owns conversation `c-42`. That instance gives it the next **sequence number**, `seq`, here 812: its place in the conversation's order. It stores the message and replies with an **ack** (an acknowledgment), which shows one tick, "sent". Why one instance owns each conversation is the first decision.

Only then does the message go on the queue, so "sent" never waits on delivery. A worker writes **inbox entries**. An inbox is a user's list of pointers, each naming a conversation and a `seq`, with one entry per delivery. The worker writes one for Bob and one for Alice, which her laptop reads. It asks the registry which gateway holds Bob, and that gateway pushes the message down his socket. With no registry entry, Bob counts as offline and the push service notifies his phone.

When Bob's phone reconnects, it sends `sync` with the last inbox position it saw, 5,209, meaning "what arrived after this?". The message service reads the inbox from there and returns the messages the entries point to. One question catches the phone up on every chat it missed. Scrolling back through old history takes the HTTPS path instead.

That's every part. How big does each one need to be?

## Key numbers

These size the message service (sends), the workers and inboxes (deliveries), the gateways and the message store. A day is 86,400 seconds, and peak is ten times the average ([numbers every engineer should know](/engineering-practices/numbers-every-engineer-should-know)).

- **Message service:** about 1.2 million sends a second at peak. 200 million × 50 = 10 billion messages a day, and 10 billion ÷ 86,400 ≈ 116,000 a second on average. Then 116,000 × 10 ≈ 1.2 million.
- **Workers and inboxes:** about 5.1 million inbox entries a second at peak. Assume 70% of messages go to 1:1 chats, which write 2 entries (the sender's and the recipient's), and 30% to groups of 10, which write 10. That's 0.7 × 2 + 0.3 × 10 = 4.4 entries per message, so 10 billion × 4.4 = 44 billion a day. Then 44 billion ÷ 86,400 ≈ 509,000 a second on average, and 509,000 × 10 ≈ 5.1 million.
- **Gateways:** 200 servers holding 50 million connections. A quarter of 200 million users online is 50 million. Assume a gateway runs at 250,000 connections, half its capacity, to leave headroom, so 50 million ÷ 250,000 = 200.
- **Message store:** about 7 TB a day and 2.6 PB a year. Messages take 10 billion × 500 bytes = 5 TB a day, and inbox entries 44 billion × 50 bytes = 2.2 TB, so about 7.2 TB, or 7 TB rounded. Then 7.2 TB × 365 ≈ 2.6 PB, before keeping three copies.

The inbox line decides the third decision, and the first decision keeps the 1.2 million sends in order.

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

Reads walk one conversation in order, so rows are grouped by conversation and sorted by `seq`, which suits a wide-column store such as Cassandra ([SQL vs. NoSQL](/systems-and-infrastructure/sql-vs-nosql)). `bucket` caps a partition at 10,000 messages. The `inbox` is keyed by user, so a reconnecting phone asks one question for all its chats, "what arrived after 5,209?". Several workers write an inbox, so one entry can land behind a position already read: the phone reads a few seconds back and drops what it has.

That's the shape. The first question is how 812 gets assigned.

## Decision: one owner numbers each conversation

The simpler option stamps each message with the sender's clock and sorts by time. It breaks on clocks. Phone clocks can be minutes off: if Bob's is 60 seconds slow and he replies 2 seconds after Alice's question, his reply is stamped 58 seconds earlier and lands above it. Stamping on the servers instead helps, but servers disagree by milliseconds too, so two quick messages can still swap. A counter shared by all instances fixes both, but it leaves gaps:

```text
IDs handed out a second, at peak:
  1,200,000
messages in c-42 a second (busy channel):
  3
IDs between two of its messages:
  1,200,000 ÷ 3 = 400,000
```

So a phone holding 810 that receives a message numbered 400,000 higher can't tell "nothing was sent" from "something was lost".

Instead, one message service instance owns each conversation, picked by [consistent hashing](/systems-and-infrastructure/consistent-hashing) of its ID, and hands out 811, 812, 813 with no gaps. A busy channel sends a few messages a second, so one owner isn't a bottleneck. A phone holding 810 that receives 812 asks for 811.

The cost is a failover window. When an owner stops answering, it's taken off the ring (the shared list that maps conversations to instances). The new list takes a moment to reach every gateway, so if the old owner was only slow, some gateways still send `c-42` to it while others send it to the new owner, and both hand out 813. So the insert is conditional: write only if `(c-42, 813)` doesn't exist. One wins; the loser rereads and takes 814.

**Rule of thumb.** When people must agree on an order, let one place assign it within the smallest unit that needs it, and number densely so a gap is visible.

## Decision: retry and deduplicate

The simpler option sends each message once and trusts the connection. A sender can't tell a lost message from a lost reply, and phones lose connections all the time. Assume only 1 send in 1,000 loses its reply:

```text
messages a day:
  10,000,000,000
lost or unconfirmed at 1 in 1,000:
  10,000,000,000 ÷ 1,000 = 10,000,000 a day
```

Ten million a day would be messages Alice has to guess about.

So Alice's phone resends with the same `message_id` until it gets an `ack`, and the owner answers a repeat with the original `seq` ([idempotency](/systems-and-infrastructure/idempotency)). Bob's phone drops repeats too. The `ack` waits for a majority of the store's copies, so "sent" survives the loss of one node. If Bob is offline, his inbox entry waits and a push wakes the phone, which sends `sync` with its last position. A lost push delays a message and can't lose it.

Why not a broker that guarantees exactly-once delivery? Its guarantee ends at the consumer, and the last hop is a phone, so the app needs dedup anyway. The cost of retrying is that every stage must tolerate repeats, and the `ack` waits for a majority, which adds a little to the 200 ms for "sent".

**Rule of thumb.** Over a link that can lose replies, retry until acknowledged and make repeats harmless instead of trying to prevent them.

## Decision: fan out on write up to 100 members

The simpler option writes an inbox entry for every member of every conversation, called **fan-out on write**. For a chat or a group that's 2 to 100 entries per message, which the numbers allow. It breaks on a 50,000-member channel at one message a second:

```text
entries a second:
  50,000 × 1 = 50,000
bytes a second:
  50,000 × 50 bytes = 2.5 MB
bytes a day:
  2.5 MB × 86,400 = 216 GB
share of the store's 7.2 TB a day:
  216 ÷ 7,200 = 3%
```

One busy channel adds 3% to the whole store's growth, kept forever, and each message also sends a push to every offline member.

So a channel above 100 members **stores once**: no inbox entries, and each device compares the channel's latest `seq` with its own read position. Gateways subscribe to the channels their clients have open, so each message goes once to each subscribed gateway, at most 200, and offline members get one summary push. The cost is two delivery paths and a threshold to tune.

**Rule of thumb.** Fan out on write while audiences are small; once an audience is large, store once and let readers pull.

## Likely follow-ups

- **How does a message find Bob's gateway?** One registry lookup per delivery.
  Broadcasting to all 200 gateways, asking each whether it holds Bob, would make each sift 1.2 million messages a
  second for its 0.5%.
- **What if the owner dies between storing 812 and enqueueing it?** The
  conversation records the highest `seq` the queue accepted, and the new owner
  re-enqueues every stored `seq` above it
  ([outbox pattern](/systems-and-infrastructure/outbox-pattern)). Dedup absorbs
  the repeats.
- **What if a gateway dies?** Its 250,000 clients reconnect at once, a
  [thundering herd](/systems-and-infrastructure/thundering-herd-problem), so
  clients wait a random, growing delay before retrying
  ([backoff with jitter](/systems-and-infrastructure/exponential-backoff)) and spread out; the store has everything.
- **Don't ticks swamp the system?** A tick update is a receipt, and a receipt is a cursor: "read up to 812"
  covers every earlier message, so 20 piled-up messages cost two receipts, not 40.
