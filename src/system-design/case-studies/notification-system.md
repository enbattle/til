---
title: Design a Notification System (like a push, email and SMS service)
summary: One request fans out into push, email, SMS and inbox sends on queues split by channel and priority, so a 50-million-user campaign never delays a login code.
date: 2026-10-05
order: 3
template: 2
---

You're asked to design the service the rest of a company's backend calls when
it needs to tell a user something. The order service says "order 83121 shipped,
tell user u_4821", and your system picks the channels: a **push notification**
(the banner a phone shows with the app closed), an email, an SMS, an in-app inbox entry, or several. Each outside channel runs through a
**provider** (Apple's and Google's push services, an email service, an SMS
gateway) that caps how fast you may call it. The interview is about sharing
those providers between a login code someone is waiting for and a sale
announcement for 50 million people, and about sends that fail after they've
had an effect.

## Requirements

- Turn a service's request into push, email, SMS and in-app sends, honoring
  opt-outs and quiet hours (a nightly window when the phone shouldn't buzz).
- Each type is **transactional** (a login code, a receipt) or **marketing**.
  100 million users, 100 million transactional requests a day at two sends
  each, plus up to 300 million marketing sends.
- A transactional message reaches its provider within 2 seconds at p99 (99% are faster), even during the largest campaign.
- A campaign to 50 million users finishes within an hour and can be cancelled.
- Requests are accepted 99.99% of the time, an accepted request isn't silently
  lost, and a user rarely gets a message twice.
- A send's status is queryable within a minute, kept 90 days.

Out of scope: audience lists, templates and A/B tests.

## Key numbers

First, size what each part must handle: the requests the API accepts, the sends
the workers make, the status writes behind them, and the log's disk. Peak is
ten times average
([numbers every engineer should know](/engineering-practices/numbers-every-engineer-should-know)),
except for campaigns, which we pace ourselves:

- **API requests:** about 12,000 a second at peak. 100 million ÷ 86,400 ≈ 1,200
  a second, times ten.
- **Transactional sends:** about 24,000 a second at peak, two per request.
- **Campaign sends:** about 14,000 a second, held for an hour. 50 million ÷
  3,600.
- **Worst hour:** about 38,000 sends a second, a campaign running at the
  transactional peak (24,000 + 14,000), with up to four status updates each (queued, sent, delivered, opened):
  152,000 status writes a second.
- **Delivery log:** 22.5 TB. 500 million sends a day × 500 bytes = 250 GB,
  kept 90 days.

## High-level architecture

![Architecture of the notification system. Calling services send POST /v1/notifications to the Notification API, which puts requests on request queues for the fan-out workers. The campaign scheduler feeds the same fan-out workers in paced batches. Fan-out workers read users, preferences and templates, put one message per send onto channel queues split by channel and priority, and publish queued and skipped status events to a status queue. Channel senders take messages off the channel queues, record a claim in send state, call the providers or the in-app inbox, and publish sent status events. Providers report delivery receipts to the status queue. The status queue feeds the delivery log.](/diagrams/notification-system/architecture.svg)

Follow a login code for u_4821 during a campaign. The **Notification
API** checks the caller, puts the request on the high-priority request queue and answers `202` at once. A **fan-out worker** reads the user, preferences and templates, drops
channels the user turned off, and queues one message per send on a
**channel queue**, such as `sms-high`. A **channel sender** claims the send in send state with a **lease**, a lock that expires (`lease_until`), so a redelivered copy can take over if the sender dies. It then calls the provider and records the result. The campaign scheduler feeds
fan-out at a pace the senders can take; status events flow into the delivery log.

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
  type, user_id, params, expires_at, fanned_out
send_state
  send_id          string, primary key   notification_id + channel + address
  state            sending | retrying | sent | failed | expired
  lease_until, lease_version, provider_message_id
```

The IDs are the choice that matters. A retried request hashes to the same
`notification_id`, and re-running fan-out rebuilds the same `send_id`s. `send_state` is written
conditionally, so it needs a store with cheap compare-and-set on one key
([SQL vs. NoSQL](/systems-and-infrastructure/sql-vs-nosql)).

## Decision: a queue and sender pool per channel and priority

Each (channel, priority) pair gets its own
[queue](/systems-and-infrastructure/message-queues) and sender pool:
`sms-high`, `email-high`, `email-low` and so on. Per channel, so a failing SMS provider can't stall email. Per priority, because even paced to two minutes of backlog, a campaign in one email queue makes a password reset wait 14,000 × 120 ÷ 20,000 ≈ 84 seconds, with the email provider allowing 20,000 a second. Both email pools share one counter of 20,000 a second
([rate limiting](/systems-and-infrastructure/rate-limiting)), and the low pool
gets 20,000 minus the larger of high-pool usage and a floor of 4,000, assuming a sixth of the transactional peak is email.

Why not one queue that serves high-priority messages first? That fixes the
order, but both priorities still share workers and one provider limit, so during a provider slowdown, when calls take seconds, marketing calls occupy every worker while a login code waits. The cost: six pools to size, since SMS and in-app carry no marketing.

**Rule of thumb.** When two kinds of work share a bottleneck and one must not
wait on the other, give each its own queue and workers, then split the shared
limit between them.

## Decision: resend transactional, drop marketing on an unknown outcome

Suppose a sender crashes after the provider
accepted the text, before it wrote `sent`, or a call times out. The next
copy can't tell whether the text went out, so it must pick. Transactional
sends are resent: a second login code is an annoyance, a missing one locks
someone out. Marketing sends are marked `failed`: a missed sale email costs
little, and a duplicate promotion costs unsubscribes. Where a provider accepts
an idempotency key, the `send_id` lets it drop the duplicate ([idempotency](/systems-and-infrastructure/idempotency)).

Why not exactly-once? The provider and our store share no transaction, and
nothing recalls a text already on its way. Writing `sent` first only turns
every crash in that gap into a lost login code.

**Rule of thumb.** Across a boundary you don't control, you choose between a
duplicate and a loss per message type, based on which costs less.

## Decision: retry by re-queueing until the message expires

A `429` or `503` is retried
later; a push token for an uninstalled app is permanent, so the send is marked
`failed`. A retry goes back on its queue with a delay, doubling from 1 second
to 64 with random jitter
([exponential backoff](/systems-and-infrastructure/exponential-backoff)), which
frees the worker at once. A login code's deadline is its `expires_at`, about 10
minutes out; a marketing email gets 3 hours. Past it, the send is marked
`expired`.

Why not retry a fixed five times, then dead-letter? Five doubling waits total
31 seconds, while a login code is useful for 10 minutes, and an outage would
dead-letter millions of messages.

**Rule of thumb.** Retry until the message stops being useful, not for a fixed
count, and keep the [dead-letter queue](/systems-and-infrastructure/dead-letter-queue)
for failures a person must read.

## Likely follow-ups

- **What if a user opts out, or the campaign is cancelled, mid-send?** Both are checked at fan-out, so already-queued messages still go. That's why the scheduler
  keeps only about two minutes of a campaign queued
  ([backpressure](/systems-and-infrastructure/backpressure)). Quiet hours are checked there too: a marketing send waits until the window ends.
- **What if the SMS provider goes down?** A
  [circuit breaker](/systems-and-infrastructure/circuit-breaker) per provider
  stops calls to it. New login codes go by push or email; codes on `sms-high` wait and expire.
- **What if a service crashes after committing an order, before calling you?**
  The
  [outbox pattern](/systems-and-infrastructure/outbox-pattern) closes it, and
  its retries reuse the idempotency key.
- **Where does the delivery log live?** Appended writes that expire after 90 days suit a wide-column store.
