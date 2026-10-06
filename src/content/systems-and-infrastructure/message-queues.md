---
title: Message Queues and Dead Letter Queues
summary: A broker holds work between the code that asks for it and the code that does it, redelivers what fails, and parks what can never succeed in a dead letter queue.
date: 2026-09-21
---

Follow one signup through a system. A user fills in a form, your web server creates the account, and now a welcome email has to go out. Should the web server send it right then?

If it calls the email provider directly and waits, the signup is as slow as the provider, and it fails whenever the provider is down. A **message queue** removes that coupling. The web server writes a small piece of data, a **message** such as "send welcome email to user 42", to a durable line held by a separate service called a **broker**, and returns at once. The code that adds messages is the **producer**. The code that takes them from the front and does the work is the **consumer**, and it reads at its own pace. If the email service is down for ten minutes, the messages wait.

The two sides no longer have to be up at the same time or run at the same speed, and a traffic burst becomes a backlog instead of an outage. The price is that the caller gets no answer back. If the user is watching a spinner for a card charge, a direct call is the simpler tool.

## What if the consumer dies mid-email?

The broker can't tell whether a consumer finished a message or crashed halfway, so it doesn't delete a message when it hands it out. The consumer sends an **acknowledgement** (an "ack") after the work is done, and only then does the broker remove the message.

A common way to enforce this is the **visibility timeout**. When a consumer receives a message, the broker hides it from everyone else for a set period. An ack in that period deletes the message. No ack, because the consumer crashed or was too slow, and the message reappears for another consumer.

This is **at-least-once delivery**: once the broker has accepted a message it is not lost, but it may arrive more than once. The consumer might send the email, then die before acking. A timeout shorter than the job takes causes duplicates with no crash at all. So consumers must be [idempotent](/systems-and-infrastructure/idempotency), meaning that processing a message twice leaves the same result as processing it once. Brokers with deduplication features only cover a limited window, and they can't un-send an email already sent.

## Going faster, and the order you lose

To drain the queue faster, run several consumers on it. The broker hands each message to just one of them, so they compete for work and the load spreads without coordination in your code. A fixed group of them is a [worker pool](/systems-and-infrastructure/worker-pools).

Competing consumers cost you ordering. A queue drains roughly first-in, first-out, but with two consumers, message 1 and message 2 can be processed at the same time, and if message 1 is slower its effects land second. A redelivered message also comes back after later ones were handled. Brokers that promise order usually promise it narrowly: among messages sharing a key, such as everything for one user. Global order means one consumer at a time and a big loss of throughput. If two operations must happen in order, give them the same key, or design them so order doesn't matter.

## What if one message can never succeed?

Now suppose user 43 typed an email address that isn't valid. The consumer fails, the message reappears, the consumer fails again. Some failures are transient: the provider was briefly overloaded, a connection dropped. A retry, ideally with [backoff and jitter](/systems-and-infrastructure/exponential-backoff), is the right answer. But a bug or a malformed payload fails identically on every attempt, and a message like that is called a **poison message**. Retrying it wastes work, and if the queue must be processed in order, it blocks every valid message behind it. That is **head-of-line blocking**.

## Dead letter queues

A **dead letter queue (DLQ)** is a second queue where such messages go instead. The mechanism is a delivery count on each message. Once it passes a configured maximum, the broker moves the message to the DLQ rather than redelivering it. Managed brokers usually offer this as a setting, often called a maximum receive or delivery count, so you don't track attempts yourself.

Landing in the DLQ changes who handles the message; it doesn't end it. An alert should fire so a person notices the failure. Someone inspects the message to find why it failed. Once the bug is fixed or the data corrected, the messages can be **redriven**: replayed into the original queue. Redriven messages are delivered again, so idempotency matters here too.

Choosing the maximum is a judgment call. Too low and a long provider outage pushes healthy messages into the DLQ. Too high and a poison message burns many attempts first.

## When the queue fills up

A queue absorbs bursts, but it doesn't make a slow consumer fast. If producers keep outpacing consumers, the backlog and the delay before a message is handled grow without limit. Choosing what to do then (slow the producers, reject new work, add consumers) is the subject of [backpressure](/systems-and-infrastructure/backpressure).

**Rule of thumb.** Put a queue between a caller and any work it doesn't need an answer from, make every consumer safe to run twice, and give each queue a dead letter queue with an alert on it.

## Where you'll meet this

A notification or email pipeline is close to a pure queue problem. One event fans out into many sends, each of which can fail and be retried independently, and a send that keeps failing, such as one to a malformed address, ends up in the DLQ instead of being retried forever or, where sends are ordered, blocking the ones behind it. In payments and checkout, a queue carries work that can wait until after the customer has their confirmation, such as receipts and shipping notices, and at-least-once delivery is why those steps must tolerate repeats. Chat systems lean on ordering scoped to a single conversation, not the whole system.
