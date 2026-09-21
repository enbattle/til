---
title: Dead Letter Queue
summary: A separate holding queue for messages that have failed processing enough times that retrying again clearly isn't going to help.
date: 2026-09-15
---

A [message queue](/systems-and-infrastructure/message-queues)'s normal
answer to a failed message is to retry it. A
**dead letter queue (DLQ)** is where a message goes instead, once it's
failed enough times that retrying it again is clearly not going to help
— a separate holding area for messages that need a human, or a fix,
rather than another automatic attempt.

## Why "just keep retrying" isn't good enough on its own

Some failures are transient — a downstream service was briefly
overloaded, a network blip dropped a connection — and a retry, especially
with [backoff and jitter](/systems-and-infrastructure/exponential-backoff),
is exactly the right response. But a message that fails because of a
genuine bug or a malformed payload will fail _identically_ on every
retry. No number of additional attempts fixes that; it only wastes
processing time. In a queue where messages have to be processed roughly
in order, this is worse than wasted effort: a permanently-failing
message stuck at the front can block every valid message queued up
behind it — a form of **head-of-line blocking** where one bad message
holds an entire queue hostage.

## How a message actually ends up there

The mechanism is simple: track a delivery or attempt count on each
message. Once that count crosses a configured maximum, the message is
routed to the dead letter queue instead of being retried or re-queued
again. Most managed queue systems bake this policy in directly — a
maximum-receive-count setting, say — rather than requiring an application
to hand-roll its own attempt tracking.

## What happens once it's there

Landing in the DLQ isn't the end of a message's life, just a change in
who — or what — handles it next. Typically: an alert fires so a human
actually notices instead of the failure silently repeating forever; the
message is inspected to understand what specifically kept causing it to
fail; and once the underlying bug is fixed or the bad data corrected,
the messages sitting in the DLQ can be **redriven** — replayed back into
the original queue for normal processing.

## Where you'll meet this

In a notification or email pipeline, a message with a malformed address, or a
template that won't render for one recipient, keeps failing while everything
around it is fine, and the DLQ keeps it from being retried forever and, if the
queue is processed in order, from blocking the messages behind it. The same
holds for any system built on at-least-once delivery (a message may arrive more
than once but is never lost), including webhook handlers and other
event-driven pipelines. Since redriven messages are, by definition, being
delivered again, consumers reading from a queue with a dead letter policy still
need to be [idempotent](/systems-and-infrastructure/idempotency): a message
coming back a second time, whether as an ordinary retry or a manual redrive
after a fix, has to be safe to process again.
