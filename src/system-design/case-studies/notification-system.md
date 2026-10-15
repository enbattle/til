---
title: Design a Notification System (like a push, email and SMS service)
summary: One request fans out into push, email, SMS and inbox sends on queues split by channel and priority, so a 50-million-user campaign never delays a login code.
date: 2026-10-05
order: 3
---

A service in your company's backend has just shipped order 83121 and needs to tell user u_4821. You're asked to design the notification system every service calls for that. It picks the channels, among them a **push notification** (the banner a phone shows with the app closed), an email, an SMS and an entry in the app's inbox, and sends on each.

Email, SMS and push leave through an outside company, a **provider**, that caps how fast you may call it. The tension is two kinds of message sharing those caps: a login code someone is waiting for, and a sale announcement for 50 million people. A second problem is a send that fails after it has already had an effect, such as a text that went out just before a crash.

The design gives each kind of message its own path to the providers, so the sale can't hold up the login code. This page starts with the obvious single-path design and shows it break, follows a login code through the replacement, sizes its parts, and makes three decisions: how the paths are split, what to do when a send's outcome is unknown, and how failed sends are retried.

## Requirements

- Turn a service's request into push, email, SMS and in-app sends, honoring opt-outs and quiet hours (a nightly window when the phone shouldn't buzz).
- Each message is **transactional** (a login code, a receipt) or **marketing**. There are 100 million users, 100 million transactional requests a day at two sends each, and up to 300 million marketing sends a day.
- A transactional message reaches its provider within 2 seconds at p99 (99% of them are faster), even during the largest campaign.
- A **campaign**, one marketing message to a whole audience, of 50 million users finishes within an hour and can be cancelled.
- Requests are accepted 99.99% of the time, an accepted request isn't silently lost, and a user rarely gets a message twice.
- A send's status is queryable within a minute and kept 90 days.

Out of scope: building audience lists, authoring message templates and A/B tests.

## Start simple

The obvious design is one **queue**, a line that holds work until something takes it ([message queues](/systems-and-infrastructure/message-queues)). Every service calls one front door, the **Notification API**, which puts the request on the queue and answers at once.

A pool of **workers**, background processes ([worker pools](/systems-and-infrastructure/worker-pools)), takes requests off the queue one by one, reads the user's preferences and calls the right provider. Say the email provider allows 20,000 calls a second.

For a small app that works. Its sale email goes to 10,000 users, and the queue drains at the provider's limit:

```text
drain time:
  10,000 emails ÷ 20,000 a second = 0.5 seconds
```

A login code that arrives mid-sale waits about half a second. Now send this app's 50-million-user campaign through the same queue:

```text
drain time:
  50,000,000 emails ÷ 20,000 a second = 2,500 seconds
in minutes:
  2,500 ÷ 60 ≈ 42 minutes
```

The campaign fits its one-hour window, but a login code that arrives just after it is queued waits behind all 50 million, about 42 minutes against a target of 2 seconds.

So campaigns and login codes can't share a line, and the campaign has to be fed in slowly instead of dumped at once. Splitting the line creates new jobs: something must decide which line each send goes on, and a send that fails halfway must be neither lost nor doubled. The architecture gives each job a part.

## High-level architecture

![Architecture of the notification system. Calling services send POST /v1/notifications to the Notification API, which saves the request in a request and send state store and puts it on request queues for the router workers. The campaign scheduler also feeds the router workers, in paced batches. Router workers read users, preferences and message templates, put one message per send on channel queues split by channel and priority, and put queued and skipped status messages on the status queue. Sender workers take messages off the channel queues, claim each send in the state store, call the providers or the in-app inbox, and put sent status messages on the status queue. Providers send delivery receipts to the status queue, and the status queue feeds the delivery log.](/diagrams/notification-system/architecture.svg)

Follow a login code for u_4821 while a campaign is running. The Notification API checks the caller and saves the request in the **state store**, a database holding the requests and a record of each send. It puts the request on the high-priority request queue, then answers `202`, meaning accepted. A router worker takes the request off that queue, reads the user's preferences and message templates, and drops the channels the user turned off. For each channel left it puts one message on a **channel queue** named for the channel and priority, such as `sms-high`.

A **sender worker** for that queue takes the message and claims the send with a **lease**, a lock that expires (`lease_until`), so that if the sender dies, a redelivered copy of the message can take over ([distributed locks](/systems-and-infrastructure/distributed-locks)). The sender then calls the provider and records the result.

Every result goes on a **status queue**: queued and skipped from the routers, sent from the senders, and delivery receipts from the providers. It feeds the **delivery log**, which answers "what happened to this send?". Campaigns skip the API: the scheduler feeds the router workers in paced batches, sized to what the senders can take. Whether each part keeps up depends on its rate, so next we size them.

## Key numbers

These size the Notification API, the sender workers, the status queue and the delivery log's disk. A day is 86,400 seconds, and peak is ten times the average ([numbers every engineer should know](/engineering-practices/numbers-every-engineer-should-know)), except for campaigns, which the scheduler paces itself. Figures are rounded sensibly.

- **Notification API:** about 12,000 requests a second at peak.
  ```text
  average:
    100,000,000 requests ÷ 86,400 s ≈ 1,200 a second
  peak:
    1,200 × 10 = 12,000 a second
  ```
- **Sender workers:** about 38,000 sends a second in the worst hour, a campaign running at the transactional peak.
  ```text
  transactional, at peak:
    12,000 requests × 2 sends = 24,000 a second
  campaign, paced over an hour:
    50,000,000 ÷ 3,600 s ≈ 14,000 a second
  both at once:
    24,000 + 14,000 = 38,000 a second
  ```
- **Status queue:** about 152,000 status writes a second in that hour, with up to four updates per send (queued, sent, delivered, opened).
  ```text
  38,000 sends × 4 updates = 152,000 a second
  ```
- **Delivery log:** 22.5 TB of disk, assuming 500 bytes per send.
  ```text
  transactional sends a day:
    100,000,000 × 2 = 200,000,000
  all sends a day:
    200,000,000 + 300,000,000 marketing = 500,000,000
  per day:
    500,000,000 × 500 bytes = 250 GB
  kept 90 days:
    250 GB × 90 = 22.5 TB
  ```

The campaign's 14,000 a second, set against one email provider's 20,000, drives the first decision. The unknown outcomes and failures hiding in all that traffic drive the other two.

## API and data model

```http
POST /v1/notifications
Idempotency-Key: login-8812-attempt-3
{ "type": "login_code", "user_id": "u_4821", "params": { "code": "481920" }, "expires_at": "2026-10-05T12:10:00Z" }
-> 202 { "notification_id": "n_7Qf3k9" }

GET /v1/notifications/{id}     -> each send with its channel and status
POST /v1/campaigns             -> 202 { "campaign_id": "c_91" }   (a type, an audience list, a start time)
```

```text
notification_requests
  notification_id  string, primary key   hash of caller + Idempotency-Key
  type, user_id, params, expires_at
send_state
  send_id          string, primary key   notification_id + channel + address
  state            sending | retrying | sent | failed | expired
  lease_until, lease_version, provider_message_id
```

The IDs are the choice that matters. The `notification_id` hashes the caller and its `Idempotency-Key`, a key the caller picks for one request, so a retried request gets the same ID and is recognized ([idempotency](/systems-and-infrastructure/idempotency)). Recognized doesn't mean answered from the saved row. If the API dies between saving a request and queueing it, the caller never got its `202` and sends it again, and the API always queues a duplicate, because the saved row doesn't prove the queue write happened. Routing it a second time is harmless because the `send_id`s repeat, so a request queued twice doesn't send twice.

The `send_state` row is written with **compare-and-set**, a write that applies only if the row still holds the value the writer last read, which is how the lease works. It needs a store with cheap compare-and-set on one key ([SQL vs. NoSQL](/systems-and-infrastructure/sql-vs-nosql)). With the IDs fixed, the first decision is how to keep the sale away from the login code.

## Decision: a queue and sender pool per channel and priority

The simpler option keeps one queue per channel, with the scheduler pacing campaigns into it. Even if it holds only two minutes of campaign backlog, a password reset waits behind that backlog in the email queue:

```text
campaign backlog:
  14,000 a second × 120 s = 1,680,000 messages
drain at the email limit:
  1,680,000 ÷ 20,000 a second = 84 seconds
```

That is 84 seconds against a target of 2. Sorting the queue so high priority comes out first fixes the order but not the capacity. Most brokers keep one first-in, first-out line with no priority inside it, and where priority is emulated, each worker prefetches a batch of messages ahead. A worker holding 10 prefetched marketing messages at 2 seconds each in a slowdown (10 × 2 s = 20 s) makes a login code that lands on it wait about 20 seconds, and both priorities still share one provider limit.

So each (channel, priority) pair gets its own queue and sender pool: `sms-high`, `email-high`, `email-low` and so on. Per channel, so a failing SMS provider can't stall email. The two email pools share one [rate limit](/systems-and-infrastructure/rate-limiting) counter of 20,000 a second. The high pool keeps a floor of 4,000, a sixth of the transactional peak, assuming a sixth of it is email (24,000 ÷ 6 = 4,000). The low pool gets 20,000 minus the larger of the high pool's usage and that floor, so at most 16,000, above a campaign sent by email at 14,000.

The cost is six pools to size, four high and two low, since SMS and in-app carry no marketing.

**Rule of thumb.** When two kinds of work share a bottleneck and one must not wait on the other, give each its own queue and workers, then split the shared limit between them.

## Decision: resend transactional, drop marketing on an unknown outcome

Suppose a sender dies after the provider accepted a text but before it wrote `sent`, or a call times out. The next copy of the message can't tell whether the text went out. The simplest policy gives every message the same answer, and each answer fails somewhere. Assume 1 send in 1,000 ends this way:

```text
resend everything, duplicate promotions:
  300,000,000 marketing × 0.001 = 300,000 a day
never resend, lost transactional messages:
  200,000,000 transactional × 0.001 = 200,000 a day
```

Hundreds of thousands a day is too many either way: lost login codes lock people out, and duplicate promotions cost unsubscribes. So the answer depends on the type. Transactional sends are resent, because a second login code is an annoyance and a missing one locks someone out. Marketing sends are marked `failed`, because a missed sale email costs little. Where a provider accepts an idempotency key, the `send_id` lets it drop the duplicate.

Why not make it exactly-once? The provider and our store share no transaction, and nothing recalls a text already on its way. Writing `sent` first only turns every crash in that gap into a lost login code. The cost of the split is, on the same assumption, up to 200,000 doubled transactional messages and 300,000 missed promotions a day.

**Rule of thumb.** Across a boundary you don't control, you choose between a duplicate and a loss per message type, based on which costs less.

## Decision: retry by re-queueing until the message expires

A `429` or `503` (the provider saying "too many calls" or "unavailable") is worth retrying. A push token for an uninstalled app is permanent, so that send is marked `failed`. The simpler policy is to retry five times, doubling the wait each time, and then move the message to a [dead-letter queue](/systems-and-infrastructure/message-queues#dead-letter-queues), a holding queue for messages that failed for good. The waits add up quickly:

```text
five doubling waits:
  1 + 2 + 4 + 8 + 16 = 31 seconds
a login code is useful for:
  10 minutes × 60 = 600 seconds
an outage of that length, with email at 4,000 a second:
  4,000 × 600 = 2,400,000 messages dead-lettered
```

So a short outage dead-letters millions of messages that were still worth sending. Instead a retry goes back on its own queue with a delay that doubles from 1 second to 64, plus random jitter so retries don't arrive together ([exponential backoff](/systems-and-infrastructure/exponential-backoff)), which frees the worker at once. A message keeps retrying until its deadline: a login code's `expires_at`, about 10 minutes out, or 3 hours for a marketing email. Past it, the send is marked `expired`. The cost is queue space: that same outage leaves 2.4 million messages waiting in queues instead of in a dead-letter list.

**Rule of thumb.** Retry until the message stops being useful, not for a fixed count, and keep the dead-letter queue for failures a person must read.

## Likely follow-ups

- **What if a user opts out, or the campaign is cancelled, mid-send?** Both are checked when a router worker splits a request, so already-queued messages still go. That's why the scheduler keeps only about two minutes of a campaign queued, holding the rest back ([backpressure](/systems-and-infrastructure/backpressure)). Quiet hours are checked there too: a marketing send waits until the window ends.
- **What if the SMS provider goes down?** A [circuit breaker](/systems-and-infrastructure/circuit-breaker) per provider stops calls to it for a while. New login codes go by push or email, and codes on `sms-high` wait and expire.
- **What if a service crashes after committing an order, before calling you?** The [outbox pattern](/systems-and-infrastructure/outbox-pattern) closes it: the service saves the notification request in the same write as the order, and a relay sends it later. The relay's retries reuse the idempotency key.
- **Where does the delivery log live?** Appended writes that expire after 90 days suit a [wide-column store](/systems-and-infrastructure/sql-vs-nosql), a database built for huge tables spread over many machines.
