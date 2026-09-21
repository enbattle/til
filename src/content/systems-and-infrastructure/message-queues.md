---
title: Message Queues
summary: A buffer that sits between the code that requests work and the code that does it, so neither has to wait for or survive the other.
date: 2026-09-21
---

A **message queue** is a durable line of messages held by a separate
service (a **broker**). One piece of code, the **producer**, adds
messages to the end; another, the **consumer**, takes them from the
front and does the work each one describes. A message is just a small
piece of data, such as "send a welcome email to user 42" or "resize
image `a1b2`".

## Queue vs. a direct call

Suppose a signup request has to create an account, then send an email.
If the web server calls the email service directly and waits, the signup
is as slow as the email provider, and it fails whenever the provider is
down. With a queue, the web server writes "send welcome email" to the
broker and returns immediately. The email service reads messages at its
own pace, and if it is down for ten minutes, the messages simply wait.

That decoupling is the reason to use a queue: the two sides don't have
to be up at the same time or run at the same speed, and a burst of
traffic becomes a backlog rather than an outage. The price is that the
caller no longer gets an answer. If the user needs the result right now
(a card charge they're watching a spinner for), a direct call is the
simpler and better tool.

## Acknowledgement and redelivery

The broker can't know whether a consumer actually finished a message or
crashed halfway through. So it doesn't delete a message when it hands it
out. The consumer has to send an **acknowledgement** (an "ack") after it
has done the work, and only then does the broker remove the message.

Brokers differ in the details, but a common design is the **visibility
timeout**. When a consumer receives a message, the broker hides it from
everyone else for a set period. If an ack arrives in that period, the
message is deleted. If not, because the consumer crashed or was too
slow, the message becomes visible again and another consumer receives
it.

This gives **at-least-once delivery**: a message is never silently lost
once the broker has accepted it, but it can be delivered more than once,
for example when a consumer finishes the work and then dies before
acknowledging. A timeout set shorter than the job's real duration
causes duplicates even without a crash. Consumers therefore have to be
[idempotent](/systems-and-infrastructure/idempotency): processing the
same message twice must leave the same result as processing it once.
Some brokers offer stronger deduplication features, but those work
inside a limited window and don't cover a consumer that has already
performed a side effect like sending an email.

A message that keeps failing shouldn't be redelivered forever; after a
set number of attempts it is moved to a
[dead letter queue](/systems-and-infrastructure/dead-letter-queue).

## Competing consumers

To go faster, run several consumers on the same queue. The broker gives
each message to just one of them, so they compete for work and the load
spreads out without any coordination in the application. A fixed group
of such consumers is a
[worker pool](/systems-and-infrastructure/worker-pools).

## Ordering is weaker than it looks

A queue drains roughly first-in, first-out, but that doesn't mean
messages are processed in order. Two consumers can take message 1 and
message 2 together, and if message 1 is slower, its effects land second.
A redelivered message also comes back after later ones have already
been handled.

Brokers that do promise ordering usually promise it narrowly: within one
partition, or within one group of messages that share a key, such as all
messages for one chat conversation. Global ordering across the whole
queue is rare and costs throughput, since it effectively means one
consumer at a time. If two operations have to happen in order, put them
in the same ordered group or design them so the order doesn't matter.

## The queue can also fill up

A queue absorbs bursts, but it does not make a slow consumer fast. If
producers keep outpacing consumers, the backlog and the delay before a
message is handled grow without limit. Deciding what to do then (slow
the producers, reject new work, add consumers) is the subject of
[backpressure](/systems-and-infrastructure/backpressure).

## Where you'll meet this

A notification or email pipeline is close to a pure queue problem: one
event fans out into many sends, each of which can fail and be retried
independently of the rest. In payments and checkout, a queue carries
work that can happen after the customer has their confirmation, such as
receipts and shipping notifications, and at-least-once delivery is the
reason those steps must tolerate repeats. Chat systems lean on ordering
guarantees scoped to a single conversation, not the whole system.
