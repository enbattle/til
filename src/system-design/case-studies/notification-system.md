---
title: Design a Notification System (like a push, email and SMS service)
summary: One event becomes a push, an email, a text and an inbox entry, queued by channel and priority so a marketing blast never delays a login code.
date: 2026-09-28
order: 3
---

A notification system is the shared service that the rest of a company's
backend calls when it wants to tell a user something. The order service says
"order 83121 has shipped, tell user u_4821", and the notification system
decides how: a **push notification** (the banner a phone shows even when the
app is closed), an email, a text message (**SMS**), an entry in the app's own
**in-app inbox**, or several of these at once. Each of those outside routes is
run by a **provider**: Apple's push service (APNs) for iPhones, Google's
Firebase Cloud Messaging (FCM) for Android, an email-sending service, and an
SMS gateway that passes texts on to the phone carriers. The notification system
never talks to a phone directly; it hands each message to a provider and hears
back, sometimes, whether it arrived.

It is a good design exercise because almost nothing about it is a hard
computation. The difficulty is in the plumbing: one event turns into many
sends, the sends share providers that cap how fast you may call them, a login
code and a sale announcement compete for the same capacity, and every step can
fail after it has already had an effect. What follows is one plausible design
for a service like this, not a description of how any particular company built
theirs.

## Requirements

Functional requirements say what the system does:

- **Send.** Another backend service asks for a notification of a registered
  **type** (such as `order_shipped` or `login_code`) to one user, with the
  values the message needs (`order_id`, `code`). The system picks the
  channels, fills in the message and delivers it on each: push, email, SMS and
  in-app.
- **Priority.** Every type is either **transactional**, something the user
  is waiting for or must know (a login code, a password reset, an order
  update, a security alert), or **marketing** (a sale, a newsletter, a "we
  miss you"). Transactional messages go first, always.
- **Preferences.** Users can turn off a category of notification per channel
  ("no marketing email", "no SMS at all"), and set **quiet hours**, a nightly
  window in their own time zone when the phone shouldn't buzz. Both are
  checked before anything is sent.
- **Templates and languages.** Message text comes from templates written once
  per type, channel and language, filled in with the request's values in the
  user's own language.
- **Campaigns.** A marketing team can send one type to a large list of users,
  and cancel it part way through.
- **Tracking.** Each send records its progress (sent, delivered, opened or
  failed), and the calling service can look up what happened.

Out of scope: building the audience lists that campaigns go to (they arrive
as a finished list of user IDs), writing and approving templates (they are
already stored), A/B tests, a reporting dashboard, and chat messages between
users, which have their own delivery and ordering needs. How a provider gets
a message from its servers to the phone is its business, not ours.

Non-functional requirements, as numbers:

- **Scale:** 100 million users. 100 million transactional requests a day,
  each producing two sends on average (a send is one message on one channel
  to one address, so a user with two phones gets two push sends), so 200
  million transactional sends. Marketing adds up to 300 million sends a day.
  Of all these, 10 million a day are SMS, nearly all of them login codes.
- **Campaign speed:** the largest campaign reaches 50 million users and must
  finish within an hour of starting, not counting users whose quiet hours hold
  their message back.
- **Latency:** a transactional message is handed to its provider within
  2 seconds of the request being accepted, at the 99th percentile (p99, the
  time 99% of messages beat), and that holds while the largest campaign is
  running. Login codes usually expire within about 10 minutes, so a code
  that arrives late is a failed login.
- **Availability:** accepting requests 99.99% (about 4.3 minutes of downtime
  in a 30-day month: 30 × 24 × 60 = 43,200 minutes, and 0.01% of that is
  4.32). If the notification system can't accept a login code, nobody who
  signs in with one can log in.
- **Delivery:** a request that was accepted is never silently lost. A user
  should almost never get the same message twice, and the design should say
  exactly when they can.
- **Tracking lag:** a send's status is queryable within a minute, and kept
  for 90 days.

The delivery requirement holds the central tension. "Never lost" and "never
twice" pull against each other, and the section on sending exactly once
explains why the design can't have both perfectly.

## Back-of-the-envelope estimates

The estimates find which parts of the design are under pressure. Two rules of
thumb from
[numbers every engineer should know](/engineering-practices/numbers-every-engineer-should-know)
are used: one million requests a day is about 12 a second, and a system should
be planned for a peak of about ten times its average. A day is
24 × 60 × 60 = 86,400 seconds.

**Transactional requests and sends.**

- Requests, average: 100,000,000 ÷ 86,400 ≈ 1,157, call it **1,200 a second**.
  The rule of thumb agrees: 100 × 12 = 1,200.
- Requests, peak at ten times average: **12,000 a second**.
- Sends, at two per request: 2,400 a second on average and **24,000
  a second at peak**.

**The largest campaign.** Marketing traffic doesn't follow the ten-times rule,
because the system decides when a campaign's messages go out. Assume it is one
email per recipient.

- 50,000,000 sends ÷ 3,600 seconds ≈ 13,889, call it **14,000 sends a second**,
  held for an hour.

**The worst hour.** A campaign can run during the transactional peak, so the
senders are planned for both at once: 24,000 + 14,000 = 38,000 sends a
second, provisioned as **about 40,000**. The campaign alone is more than a
third of that (14,000 ÷ 38,000 ≈ 37%), which is why the priority deep dive
matters.

**By channel.** Splitting the day's 500 million sends (200 million
transactional plus 300 million marketing) with assumed shares:

```text
channel   transactional   marketing   total a day
push      100 million     100 million   200 million
email      30 million     200 million   230 million
in-app     60 million       none         60 million
SMS        10 million       none         10 million
```

- SMS: 10,000,000 ÷ 86,400 ≈ 116, about **120 a second on average and 1,200
  at peak**. Small in volume, but it is the channel users are least patient
  with, and each text costs money (under a cent in some countries, tens of
  cents in others), so a duplicate text has a price.
- Transactional email: 30,000,000 ÷ 86,400 ≈ 347, about **350 a second
  on average and 3,500 at peak**, the capacity the email channel must keep
  free for password resets while a campaign is running.

**Tracking writes.** Each send produces about three status updates over its
life (sent; then delivered or failed; then, for some, opened).

- 500,000,000 × 3 = 1.5 billion updates a day; 1,500,000,000 ÷ 86,400 ≈
  17,361, about **17,000 a second on average**.
- In the worst hour, 38,000 sends a second can produce up to 38,000 × 3 =
  **114,000 updates a second**, though deliveries and opens trail the sends by
  seconds to hours. Writing each one on its own as it arrives would make
  tracking the heaviest write load in the system.

**Delivery log storage.** Allow 500 bytes per send, covering its IDs, channel,
template, provider message ID, each status with a timestamp, and the store's
indexes:

- 500,000,000 × 500 bytes = **250 GB a day**.
- Kept 90 days: 250 GB × 90 = 22.5 TB, and about **67.5 TB** with three
  copies.

**Users, devices and preferences.** Allow 1 KB per user for email address,
phone number, language, time zone, a few device registrations and preference
settings: 100,000,000 × 1 KB = **100 GB**. It is read once per request and
once per campaign recipient, 12,000 + 14,000 = **26,000 reads a second at
peak**, which a cache in front of the store handles comfortably.

What the estimates say: no single number here is large for modern hardware.
The pressure comes from sharing: 14,000 marketing sends a second competing
with 24,000 transactional ones for the same providers, and 114,000 status
updates a second that must not slow either of them down.

## Data model

Five kinds of data, each with its own access pattern.

**Requests**, one row per accepted request, keyed by an ID that doubles as
the duplicate check (the exactly-once deep dive explains how it's built):

```text
notification_requests
  notification_id  string, primary key   derived from caller + idempotency key
  caller           string                which service asked
  type             string                "order_shipped", "login_code"
  user_id          string
  params           JSON                  values the templates fill in
  created_at       timestamp
  expires_at       timestamp             don't deliver after this
  fanned_out       boolean               true once all its sends are queued
```

Rows are kept for 30 days: 100 million a day at about 1 KB each is
100,000,000 × 1 KB × 30 = 3 TB. Campaign recipients don't get rows here. Each
gets a notification ID built from the campaign ID and the user ID, and the
campaign scheduler records how far through its list it has got, so a restart
repeats at most one batch, whose sends the senders recognize as already made.

**Users and preferences**, read by user ID on every request:

```text
users
  user_id      string, primary key
  email, phone string                 verified addresses only
  locale       string                 "pt-BR"
  time_zone    string                 "America/Sao_Paulo"
  quiet_hours  start and end, local   e.g. 22:00 to 08:00
  devices      list of { token, platform, app_version, last_seen }

preferences
  user_id, category   primary key     category: "security", "orders", "marketing"
  channels            which of push, email, SMS, in-app are allowed
```

A **device token** is the address a push provider gives an app on one phone;
sending to a user means sending to each of their current tokens.

**Types and templates**, a few thousand rows that change rarely and are cached
in every worker's memory:

```text
notification_types   type → category, priority, default channels
templates            (type, channel, locale, version) → subject, body with placeholders
```

**Send state**, one row per send, used to avoid sending twice:

```text
send_state
  send_id              string, primary key   one per notification, channel and address
  state                sending | retrying | sent | failed | expired
  reason               string                why failed or expired: "unknown_outcome", ...
  lease_until          timestamp             while "sending": until when the claim holds
  lease_version        integer               goes up on every write
  provider_message_id  string                the provider's ID once accepted
  attempts             integer
```

There is no row until a sender claims the send, so a send that succeeds first
time is written twice (claim, then result), at up to 2 × 38,000 = 76,000
writes a second. Every write is **conditional** (the exactly-once deep dive
gives the rules), so it needs a store that does conditional writes on one key
cheaply. A key-value store fits, with
rows expiring after 7 days: 500 million rows a day at about 200 bytes, kept 7
days, is 500,000,000 × 200 × 7 = 700 GB.

**Delivery log**, the history callers and support staff query ("what did we
send this user this week, and did it arrive?"), keyed by notification ID, with
each send's status changes under it. That serves campaign sends too, whose IDs
come from the campaign and user, for the full 90 days. A second table keyed by
user ID and time lists each user's notification IDs, written once per send.
Its load is almost all writes, appended in time order and deleted after
90 days, which suits a
wide-column store such as Cassandra: rows grouped under a key and sorted by a
second column, with old data expiring on its own.
[SQL vs. NoSQL](/systems-and-infrastructure/sql-vs-nosql) covers why that kind
of store fits this shape and what it gives up. Users and preferences, by
contrast, are small and edited by people, and a relational database with a
cache in front is the simpler choice there.

## API design

**Send a notification** (called by other backend services):

```http
POST /v1/notifications
Authorization: Bearer <service credential>
Idempotency-Key: order-83121-shipped
Content-Type: application/json

{
  "type": "order_shipped",
  "user_id": "u_4821",
  "params": { "order_id": "83121", "carrier": "Parcelway", "eta": "2026-10-02" },
  "expires_at": "2026-10-02T00:00:00Z"
}
```

- `202 Accepted` with `{ "notification_id": "n_7Qf3k9" }`. **202** means
  "received, will be processed", not "delivered": the sending happens
  afterwards, and the caller can follow it with the ID.
- `400 Bad Request` for an unknown type or missing params the templates need.
- `429 Too Many Requests` if the caller is over its request limit.

The caller does not choose the priority. The type's registration does, so a
team can't mark its marketing type "urgent" to jump the queue. The
`Idempotency-Key` is a string the caller chooses once per intent and sends on
every retry of it; the exactly-once deep dive shows what the system does with
it.

A service that sends notifications about its own database changes has a
problem of its own before this call is even made: if it commits the order and
then crashes before calling, the customer never hears about it. The
[outbox pattern](/systems-and-infrastructure/outbox-pattern) fixes that on the
caller's side, by writing the request to a table in the same transaction as
the order and sending it afterwards, and it pairs naturally with this API,
because the outbox's retries arrive with the same idempotency key.

**Follow a notification:** `GET /v1/notifications/{id}` returns each send
with its channel and status (`queued`, `sent`, `delivered`, `opened`,
`failed`, `expired`, or `skipped` with a reason such as `opted_out` or
`quiet_hours`).

**Campaigns:** `POST /v1/campaigns` with a type, a stored audience list and a
start time returns `202` and a campaign ID; `POST /v1/campaigns/{id}/cancel`
stops it sending further messages.

**User-facing endpoints**, called by the apps: `PUT /v1/me/preferences` and
`PUT /v1/me/quiet-hours`; `POST /v1/me/devices` to register a phone's push
token when the app starts; `GET /v1/me/inbox` for the in-app list; and
`POST /v1/me/notifications/{send_id}/events` for the app to report that a push
arrived or was opened.

**Provider webhooks:** `POST /v1/webhooks/{provider}` receives the providers'
own reports ("delivered", "bounced", "opened"). A **webhook** is an HTTP
request a provider makes to our server when something happens on its side.
Each is checked against the provider's signature before it is believed.

## High-level architecture

![Architecture of the notification system. Calling services send POST /v1/notifications to the Notification API, which passes requests through request queues to fan-out workers; a campaign scheduler feeds the same fan-out workers in paced batches. Fan-out workers read users, preferences and templates (cached), put one message per send onto channel queues split by channel and priority, and publish queued and skipped statuses to a status queue. Channel senders take messages from the channel queues, render them from templates held in memory, claim and mark each send in the send-state store, and deliver to the providers (APNs, FCM, email, SMS) or the in-app inbox; a message they give up on goes to a dead-letter queue, and each sent event goes to the status queue. Providers send webhooks to status endpoints, which also take the apps' reports and feed the status queue. Tracking workers read the status queue and write to the delivery log.](/diagrams/notification-system/architecture.svg)

The pieces, from the top:

- The **Notification API** checks the caller, validates the request, works
  out its notification ID and puts it on the high or low **request queue**
  according to the type's priority, then answers `202`. It does no sending
  itself, so it stays fast and available even when a provider is down.
- The **campaign scheduler** turns a campaign into a stream of recipients,
  released in batches at the pace the senders can take (the priority deep
  dive).
- **Fan-out workers** turn one request into its sends. For each request they
  read the user, their preferences and their devices; drop channels the user
  has turned off; apply quiet hours; choose the language; and put one message
  per send onto the right **channel queue**. They also publish a `queued`
  status for each send, and a `skipped` one, with its reason, for each channel
  they dropped. "Fan-out" is the step where one
  thing becomes many: `order_shipped` for a user with two phones and push,
  email and in-app enabled becomes four sends (two push, one email, one
  in-app).
- **Channel queues** are separate
  [message queues](/systems-and-infrastructure/message-queues) per channel
  and per priority: `push-high`, `push-low`, `email-high`, `email-low`,
  `sms-high` and `inapp-high`. A queue keeps each message until a
  sender confirms it was handled, and gives it to another sender if the first
  one dies, so a crash doesn't lose messages.
- **Channel senders** are pools of workers, one pool per queue, each taking
  a message, recording in the send-state store that it is sending, filling in
  the template (loaded from the templates store and kept in memory), calling
  the provider, and recording the result. The in-app sender's "provider" is our
  own inbox store, plus a nudge over the app's live connection if it has one
  open
  ([WebSockets vs. SSE vs. long polling](/systems-and-infrastructure/websockets-vs-sse-vs-long-polling)
  compares the ways of keeping one).
- The **dead-letter queue** collects messages that failed in a way retrying
  won't fix (the retry deep dive).
- The **status endpoints** are the webhook and app-report endpoints from the
  API section, run apart from the send API so a flood of receipts can't slow
  requests down. They check each report and put it on the **status queue**,
  where fan-out's and the senders' status events also go.
- **Tracking workers** read the status queue and write to the **delivery
  log** in batches.

Following one login code through it, as in the sequence below: the auth
service calls `POST /v1/notifications` with type `login_code` and the code in
`params`. The API puts it on the high request queue and answers `202`. A
fan-out worker reads the user: SMS is allowed and the security category ignores
quiet hours. It picks the template in the user's language, builds the send ID
and puts one message on `sms-high`. An SMS sender claims that send ID in the
send-state store, calls the SMS provider, gets back the provider's
accepted-with-an-ID answer, and marks the send `sent`. It publishes a "sent"
event for tracking without waiting for it to be stored. Seconds later, the
carrier reports the text as delivered; the provider passes that on by webhook
to the status endpoints, which put it on the status queue for tracking.

![Sequence of one login code sent by SMS. The auth service (Auth) sends POST /v1/notifications to the Notification API (API), which puts it on the high request queue for a fan-out worker (Fan-out) and answers 202 Accepted. The fan-out worker checks preferences and picks the locale, then puts the message on the sms-high queue. The SMS sender claims the send in the send-state store, sends the text to the SMS provider, gets back "accepted" with the provider's message ID, and marks the send as sent in the send-state store. It puts a "sent" event on the status queue for tracking without waiting. Later, the SMS provider sends the delivery receipt by webhook to the status endpoints, which put it on the status queue for tracking.](/diagrams/notification-system/login-code-sequence.svg)

**Tracking stays off the send path.** Only the send-state writes are on the
path a message travels, because they decide whether to send. Everything
tracking stores is published and forgotten by the sender, then gathered by the
tracking workers and written to the delivery log in batches every few
seconds instead of one write per status. At 114,000 status updates a
second in the worst hour, that batching is the difference between a
delivery log that keeps up and one that slows the senders down;
[batching and asynchronous writes](/systems-and-infrastructure/batching-and-asynchronous-writes)
covers the trade. Here it costs a status that's a few seconds stale. Status
events and webhook receipts wait on a status queue until their batch is
written, so a tracking worker that dies mid-batch causes a replay, not a loss,
and replaying is harmless because recording "delivered" twice leaves the same
record as recording it once.

What "delivered" means depends on the channel. For in-app, it means the entry
was written to the user's inbox. An SMS provider passes on the carrier's
**delivery receipt**. An email provider reports whether the receiving mail
server accepted or rejected the message (a **bounce**), which says the mailbox
took it, not that anyone saw it. The push services confirm that they accepted a
message but don't call the
sender back per message when it reaches the phone (FCM can export Android
delivery data in bulk after the fact, which is useful for statistics but not
for one send's live status), so the app reports that itself: it calls the
events endpoint when a notification arrives or is tapped. "Opened" for email
comes from a tiny image in the message that loads when it's viewed, and some
mail apps now download every image in advance
through a proxy whether or not the message is read, so email opens are an
estimate.

## Deep dive: priority and per-channel queues

The requirement is that a login code reaches its provider within 2 seconds
while a 50-million-message campaign is going out. Consider the email channel,
assuming the email provider lets this account send **20,000 messages a
second**. The campaign's fan-out can produce messages far faster than that,
since checking a preference and choosing a template takes microseconds, so
millions of campaign emails can be waiting in a queue within minutes.

**One queue for everything.** Every send, of every channel and priority,
goes into one queue, first in, first out. It's the least to build and run. A
password-reset email that arrives behind the campaign waits for all of it:
up to 50,000,000 ÷ 20,000 = 2,500 seconds, about **42 minutes**, well past the
2-second target and past the reset link's usefulness. A single slow provider
also stalls everything: if the SMS gateway starts timing out, SMS messages hold
up the push and email messages behind them.

**A priority field in one queue.** Some brokers can hand out higher-priority
messages first from a single queue. That fixes the ordering, but the
priorities still share one pool of workers and one provider limit: if every
worker is busy waiting on a slow marketing send, the login code has no one to
pick it up. Many popular queues also don't offer this at all. A
**partitioned log**, for instance, stores messages as an append-only list split
into partitions and hands each partition's messages out strictly in the order
they were written, so there is no way for one to jump ahead.

**Separate queues per channel and per priority.** One queue per
(channel, priority), each with its own pool of senders. A backed-up
`email-low` doesn't touch `email-high`, whose senders are idle and waiting when
the reset arrives, and a failing SMS gateway only fills `sms-high`. The costs:
six queues and pools (`push-high`, `push-low`, `email-high`, `email-low`,
`sms-high`, `inapp-high`) to size, watch and scale instead of one; capacity
held back for the high queues that sits partly idle most of the day; and a
rule for sharing each provider's limit between the two priorities, since the
provider sees one account, not two queues.

This design uses separate queues. Both email pools draw from one shared
counter of 20,000 sends a second
([rate limiting](/systems-and-infrastructure/rate-limiting) covers how to make
such a limit hold across many machines). The high pool may take whatever it
needs. The low pool may take 20,000 minus the larger of two numbers: what the
high pool is using right now, or a floor of **4,000 a second**, the
3,500-a-second transactional email peak from the estimates, rounded up. As
long as transactional email stays within its 4,000, which covers the estimated
peak, the campaign gets 20,000 − 4,000 = 16,000 a second, above the 14,000 it
needs to finish in an hour. The floor keeps 4,000 a second of provider
capacity free even when transactional email is quiet, so a sudden burst of
resets finds room up to that rate at once. A surge beyond 4,000 eats into the
campaign's share, and because usage is measured over the last second, the
first moments of one can push combined demand past 20,000 and draw `429`s
from the provider. Those land on both pools; a `429` pauses the low pool for
the provider's `Retry-After` time while rejected transactional sends are
retried first, so the campaign absorbs the overshoot. If a campaign also goes
out by push, `push-low` is paced the same way against the push services'
limits.

Each pool's size follows from its rate and how long one provider call takes.
If a call to the email provider takes about 100 ms, the two email pools
together, sending up to 20,000 a second, have 20,000 × 0.1 = **2,000 calls in
flight** at any moment, so they need that many concurrent workers or
connections between them. That is Little's law, rate times time in the
system, from
[latency vs. throughput](/systems-and-infrastructure/latency-vs-throughput);
[worker pools](/systems-and-infrastructure/worker-pools) covers using queue
depth to tell when a pool needs more workers.

**The campaign scheduler doesn't dump the whole list at once.** It feeds the
fan-out only while `email-low` holds less than about two minutes of sending,
16,000 × 120 ≈ 1.9 million messages, and waits when it's above that. This is
[backpressure](/systems-and-infrastructure/backpressure): the slow stage (the
provider's limit) sets the pace of the fast one (the fan-out), rather than a
queue swelling to 50 million. It buys two things here. Cancelling a campaign
stops it within about two minutes, because only the queued messages are
already committed. And a preference changed mid-campaign ("stop sending me
these") is read when that user's batch is fanned out, not an hour earlier.

## Deep dive: preferences, quiet hours and templates

Before a send exists, three questions are asked for its user: is this channel
allowed for this category, is it the middle of their night, and what language
and words should it use. Where and when to ask is the design choice.

**When to check preferences.** One option is to check only at fan-out, when
sends are created. That's one read per request, 26,000 a second at peak,
answered from the cache. Its weakness is the gap between fan-out and sending:
a user who opts out of marketing email while their message waits in
`email-low` still gets it. The other option is to check again in the sender,
immediately before the provider call. That closes the gap, at the cost of a
second preference read per send (up to 38,000 a second, also from the cache)
and a sender that needs to know about users rather than only about providers.

The design checks at fan-out and keeps the gap short, rather than checking
twice. With backpressure, a campaign message waits at most a couple of
minutes, and transactional queues are nearly empty. For marketing, an opt-out
that takes effect within minutes is what users expect. It must be honored
promptly: anti-spam laws in many countries require marketing messages to carry
a working opt-out, large mailbox providers also require bulk senders to offer
one-click unsubscribe (a standard email header), and SMS recipients can reply
STOP. Those unsubscribes arrive at the
preferences store as ordinary updates, and the cache entry for that user is
deleted at the same time, so the next fan-out reads the new setting.

**Quiet hours.** A message whose user is in their quiet hours can be dropped,
delivered anyway without sound, or held until the window ends. Dropping loses
messages people wanted ("your order has shipped"). Holding is right for
marketing, and for a campaign it comes almost free: the scheduler already
walks the audience in batches, so it groups recipients by time zone and
releases each group when it's daytime there, and a user whose own quiet hours
differ from the default is simply put back for a later batch. A single
marketing message from the API, such as an abandoned-cart reminder, that meets
the user's quiet hours is dropped and recorded as `skipped` with reason
`quiet_hours`: a nudge that arrives the next morning has lost its point, and
dropping it avoids building a store of delayed sends. For a single
transactional message, holding would need a store of delayed sends and
something that wakes them up; the design instead sends non-urgent
transactional messages at night silently (push services let a notification
arrive quietly, without a sound and, on recent phones, without lighting the
screen, to be seen in the morning). The **security** category, login codes and
"was this you?" alerts, goes out normally at any hour: a login code is useless
by morning, and a warning about someone else signing in is urgent whenever it
happens.

**Templates and languages.** The fan-out worker picks each send's template by
type, channel and **locale**, a language plus an optional region such as
`pt-BR` (Portuguese as written in Brazil). When a translation is missing it
falls back along a chain, `pt-BR` → `pt` → `en`, so a new language never
blocks a send. Two ways to fill the template in:

- **Render at fan-out**, putting the finished text into the queue message.
  The sender stays simple and every retry sends identical text. But a
  marketing email's HTML is often tens of kilobytes; at 30 KB, 1.9 million
  queued campaign emails are about 57 GB of queue, against a few hundred
  bytes per message otherwise.
- **Render in the sender**, with the queue message carrying the template's ID,
  its **version** and the values. Queues stay small, and the templates, a few
  thousand of them, sit in each sender's memory. Pinning the version at
  fan-out keeps the one property that matters from the first option: a retry
  an hour later renders exactly what the first attempt did, even if someone
  edited the template in between.

The design renders in the sender. One localization detail changes costs on
the SMS channel. A text is billed per **segment**. The **GSM alphabet** is the
7-bit character set SMS was designed around: unaccented Latin letters, digits,
common punctuation and a handful of accented letters. A text written entirely
in it fits 160 characters in one segment; a longer one is split into parts of
153, since each part gives up room to a header that lets the phone join them
back together. A few symbols, such as € and square or curly brackets, come
from an extension table and count as two. One character outside the alphabet,
which includes most non-Latin scripts, every emoji, and accented letters such
as Portuguese ã and õ, switches the whole text to a 16-bit encoding that fits
70 characters, or 67 per part. A login code template that fits one segment in
English can need two in Russian, or in Portuguese once a single ã appears, so
each template's rendered length per locale is worth checking when it's
written.

## Deep dive: exactly-once processing, but not exactly-once delivery

The queues here deliver **at least once**, so any step can see the same
message twice, after a crash or a retry, and each step needs its own duplicate
check. [Idempotency](/systems-and-infrastructure/idempotency) is the property
being built: doing a step twice has the same effect as doing it once.

**At the API and fan-out.** The caller's `Idempotency-Key` and the caller's
name are hashed together into the `notification_id`, so a retry of the same
request gets the same ID. The API only enqueues the request and answers `202`
with that ID; a retry puts a second copy on the queue. The fan-out worker
inserts the request into `notification_requests` only if the ID is new. If the
row is already there and marked `fanned_out`, the copy is a duplicate and is
dropped. If it's there but not marked, an earlier worker died part way through,
so this one fans out again.

The check lives in fan-out, not in the API, so that the API makes one durable
write before answering. If the API recorded "seen this key" and then enqueued,
a crash between the two would leave a key that turns away every retry for a
request no worker ever received.

**Send IDs.** Each send's ID is built from the notification ID, the channel
and the address (the device token, email address or phone number), so
re-running fan-out for the same request produces the same send IDs, not new
ones. A send enqueued twice is then two copies of the same send, which the
sender can catch.

**At the sender**, which is where the hard case lives. Every `send_state`
write is a **compare-and-set**: it succeeds only if `lease_version` is still
the value the sender just read, and it bumps the version. To claim a send, the
sender creates the row as `sending` with a **lease**, a deadline (say 30
seconds away), or takes over a row that is `retrying`, or `sending` with its
lease run out. Then it calls the provider and writes the outcome. `sent`,
`failed` and `expired` are final, and a copy that finds one is dropped. A
temporary failure writes `retrying`, which releases the lease, and puts the
message back on the queue with a delay. A copy that finds a live lease goes
back with a delay too, in case the holder dies. A lease is the same device a
[distributed lock](/systems-and-infrastructure/distributed-locks) uses, with
the same weakness: it can run out while its holder is still working.

The trouble comes in three shapes. A sender crashes after the provider
accepted the message and before `sent` was written. A provider call times out
without an answer, so the sender itself doesn't know. Or a sender stalls past
its lease, in a long garbage-collection pause (the runtime freezing the
program while it reclaims memory) or a slow provider call, and carries on
sending after another sender has taken the send over. In the first
two, whoever handles the message next, the timed-out sender itself or the one
that finds the expired lease, cannot tell whether the text already went out.
There are two ways to resolve that:

- **Send again**, which is at-least-once. Nothing is lost; a user
  occasionally gets two copies.
- **Mark it failed and don't send**, which is at-most-once. Nothing is
  duplicated; a user occasionally gets nothing.

Writing `sent` before calling the provider doesn't escape the choice; it only
picks the second option for every crash in that gap. The underlying reason is
that the provider and the send-state store are separate systems with no shared
transaction: the provider's "accepted" can be lost on the network after the
provider acted, and nothing on our side can undo a text that is already on its
way to a phone. Past the provider, delivery to the device is outside our
control altogether. Exactly-once _processing_ inside our own system is
achievable with the checks above; exactly-once _effect_ on a phone is not.

The design chooses per category. **Transactional** sends are resent: a
second copy of a login code is a mild annoyance, a missing one is a user who
can't sign in. **Marketing** sends are marked `failed` with reason
`unknown_outcome` and not resent: a missed sale email costs little, while a
duplicate promotion is exactly the kind of annoyance that makes people
unsubscribe. Where a provider accepts a caller-chosen idempotency key, as some
email and SMS APIs do, the send ID goes there and the provider drops a second
copy in all three cases; the per-category rule matters for providers that
don't.

The stalled sender is narrowed rather than solved. Each provider call has a
10-second timeout, well inside the 30-second lease, and a sender doesn't start
a call with less than 15 seconds of lease left, so only a stall of many
seconds gets through. The lease version in `send_state` works as the
**fencing token** the distributed-locks topic describes: a stalled sender's
late `sent` write carries an old version and is rejected, so it can't
overwrite its replacement's record. The provider can't check our token, so
without a provider idempotency key a transactional send caught this way goes
out twice, which this design accepts as rare. (A marketing send can't double
this way: its replacement doesn't resend.)

On push, the notification ID is also passed as the collapse identifier
(APNs's `apns-collapse-id`, at most 64 bytes, which a send ID holding a long
device token could exceed; on Android, the notification `tag` through FCM).
Collapsing is per device anyway. If the first copy is still on screen, the
second replaces it, though it may still buzz; if the first was already opened
or swiped away, the second shows up fresh; and the Android `tag` covers only
notifications the system displays, not data messages the app handles itself.
Collapse IDs soften duplicates rather than hide them.

A plain redelivery never causes a duplicate. One needs a crash in the fraction
of a second between the provider's acceptance and the `sent` write, a provider
call that times out after the provider acted, or a stall longer than the lease
allows for, and then only through a provider without idempotency keys.

## Deep dive: retries, provider limits and the dead-letter queue

Provider calls fail constantly at this volume, and not all failures are
alike. Sorting them is the first job:

- **Temporary**, such as a `5xx` status (HTTP's codes for "the server
  failed") from the provider, or `429 Too Many Requests` (we went over our
  allowed rate). Retry later. A timeout is temporary too, but it's also the
  unknown outcome above, so it follows the per-category rule first.
- **Permanent for this address**, such as a push token the provider says is no
  longer registered (the app was uninstalled), an email that **hard
  bounced** (the mailbox doesn't exist), or a number that can't receive SMS.
  Don't retry; remove the token or mark the address unusable so no future
  send tries it, and record the send as `failed`.
- **Our own bug**, such as a template that fails to render with this user's
  values, or an error code the sender doesn't recognize. Retrying won't help
  and nobody has decided what to do, so a person needs to look.

**How to wait before retrying.** Waiting in place, with the worker sleeping
until it's time, is the simplest, but with 2,000 calls in flight on the email
channel a provider outage would soon leave every worker asleep and nothing
moving, including sends to healthy providers if pools were shared. The
alternative is to put the message back on its queue with a delay, which many
queues support directly (or can mimic with a small set of retry queues with
fixed delays, such as 10 seconds, 1 minute and 10 minutes, feeding back into
the main one). The worker is free at once, and a retry costs a queue write
instead of a sleeping worker. The design re-queues with a delay.

The delays double from 1 second and stop growing at 64, and each is
randomized so failed sends don't all come back at once.
[Exponential backoff](/systems-and-infrastructure/exponential-backoff) covers
why both are needed; here they are what stops 16,000 campaign sends a second
from hammering a provider that has just started refusing them. When a provider
answers `429` with a `Retry-After`
time, that wins over the schedule, and the shared rate counter is lowered for a
while, since the provider's limit is evidently lower than configured.

Retrying stops at a deadline per category, not after a fixed count. A login
code's deadline is its `expires_at`, about 10 minutes out, room for at least
14 retries (the first seven waits add up to at most 127 seconds, then at most
64 each); a sender that picks up a code past it records `expired` and drops
it. An order update gets 6 hours, a marketing email 3.

**When a deadline passes (for anything but a stale code), or the failure is
our own bug**, the message goes to
the [dead-letter queue](/systems-and-infrastructure/dead-letter-queue),
where it stops being retried and stops blocking anything, and an alert tells
someone it's there. Permanent address failures deliberately don't go there:
they are an expected, handled outcome, and millions of dead tokens a day would
bury the few messages that need a person. A dead-lettered message's
send-state row stays `retrying`, not final, so once the bug is fixed a replay
can claim it, while a copy of anything already sent still finds `sent` and is
dropped.

**A provider that is down, not just slow.** If a provider fails every call
for minutes, backoff alone still sends each message's retries into it. A
[circuit breaker](/systems-and-infrastructure/circuit-breaker) per provider
stops calling it after repeated failures, and messages stay on their queues
until it recovers. For login codes there's a better fallback than waiting. The
breakers live in the senders, so each sender pool publishes its breaker's state
to a small shared key in the cache, and fan-out reads that key when it picks
channels. While the SMS breaker is open, a new login code for a user with the
app installed goes out by push or email instead, if the type's registration
allows it; codes already on `sms-high` wait there and expire.

## Failure modes and bottlenecks

**A provider outage.** Its channel's queues grow while everything else keeps
flowing, because every channel has its own queues and pools. The queues must
hold the backlog: an hour of SMS at the 1,200-a-second peak is 1,200 × 3,600
≈ 4.3 million messages, trivial for a queue. Login codes expire during a long
outage regardless, which is why the SMS-to-push-or-email fallback exists.

**A campaign in a bad state.** A marketing type with a broken template, or
aimed at the wrong list, can do damage at 14,000 sends a second. The
backpressure limit means cancelling it stops everything past the two minutes
already queued, and a template that fails to render sends its messages to the
dead-letter queue rather than out to users. A new campaign can also start with
a small slice of its audience, a few thousand users, and continue only once
that slice's failure rate looks normal.

**The users and preferences store is down.** Fan-out needs a user's addresses
and preferences for every request. Users whose entries are cached keep being
served; for the rest, requests wait on their queues until the store is back.
The one thing fan-out must not do is fall back to default settings and send,
because the defaults are "opted in", and messaging someone who opted out is
the more expensive mistake. Login codes for uncached users can expire in the
meantime, which is one reason the store is replicated and the cache is sized
to hold every user, the 100 GB from the estimates.

**Stale device tokens.** Users uninstall apps without telling anyone, and
their tokens keep being sent to until the push service answers "unregistered".
Removing tokens on that answer, and dropping any not refreshed by the app in a
couple of months, keeps a growing share of push sends from being wasted calls.

**Duplicates.** Covered in the exactly-once deep dive: a plain redelivery
never causes one, and neither does anything else at a provider that takes an
idempotency key. Elsewhere a transactional send goes out twice when a sender
dies, or its provider call times out, after the provider accepted it, or when
a stalled sender outlives its lease. On push,
the second copy merges with the first only if the first is still on screen.

**Tracking falls behind.** If the delivery log is slow, status events pile up
on their queue; sends are unaffected, and statuses show up late. That is the
point of keeping tracking off the send path.

**Knowing any of this is happening.** Worth watching: queue depth and the age
of the oldest message per channel queue (a growing age on a `-high` queue is a
page, one on `-low` is a note), p99 time from accept to provider for
transactional types, provider error rates split by the three failure kinds,
the dead-letter queue's size, the share of expired login codes, and the SMS
delivery-receipt rate by country.
[Observability](/systems-and-infrastructure/observability) covers how metrics,
logs and traces divide that work; a trace that follows one notification ID
from the API to its receipt is the quickest way to answer "why didn't this
user get their code?"

## Trade-offs

The design is a set of choices, each with a price:

- **Queues per channel and priority over one queue.** A campaign can't delay
  a login code and one failing provider can't stall the others. The bill is
  six queues and pools, capacity held back for the high queues, and a rule
  for dividing each provider's limit.
- **At-least-once for transactional, at-most-once on unclear outcomes for
  marketing.** A rare duplicate login code is the price of never losing one; a
  rare lost promotion is the price of never sending one twice.
- **Checking preferences once, at fan-out.** Saves a read per send. A fresh
  opt-out can miss a message already queued, but backpressure keeps that
  window to a minute or two.
- **Rendering in the sender, with the template version pinned.** Keeps queues
  small, and makes senders heavier.
- **Batched, asynchronous tracking**, which means sends never wait on the
  delivery log and statuses run a few seconds behind.
- **Pacing campaigns by queue depth.** Cancellation within minutes and
  preferences read close to send time. The scheduler has to refill the queue
  before it runs dry, or the campaign loses sending time it can't get back
  within its hour.

What would change the design: if SMS became a large share of volume, its cost
would justify checking preferences again in the sender and spending more
effort on avoiding duplicate texts. If callers needed a delivery confirmation
before continuing, for example a login flow that waits for "delivered" before
showing the code-entry screen, tracking for those types would move onto a
faster path, and the channel-specific meaning of "delivered" would become a
product question rather than a footnote.
