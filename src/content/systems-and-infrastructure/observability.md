---
title: 'Observability: Metrics, Logs, and Traces'
summary: What metrics, logs, and traces each tell you that the others can't, and the order to reach for them when something's wrong.
date: 2026-09-14
---

**Observability** is the ability to figure out what's happening inside a
running system just from what it outputs, without having to attach a
debugger to it directly. It's built from three complementary kinds of
signal: **metrics** (aggregated numbers over time, like request rate or
error rate), **logs** (discrete, timestamped records of individual
events), and **traces** (the path one specific request took as it moved
through multiple services).

## Why you need all three, not just one

Each signal answers a different question, and none of them is a
substitute for the others:

- **Metrics tell you _something_ is wrong.** A dashboard's error-rate
  line spikes. Metrics are cheap to store and great for dashboards and
  alerts, precisely because they're aggregated — but that same
  aggregation means they can't tell you which specific request failed, or
  why.
- **Logs tell you what happened, for one event, in detail.** But at any
  real scale, grepping through logs scattered across dozens of service
  instances to reconstruct a single request's path is slow and easy to
  get wrong.
- Zoom out one level further and **traces** show where, across a whole
  chain of services, something went wrong — which of six services a slow
  request spent four of its five seconds waiting inside.

## How the three get used together

A typical incident plays out in roughly the same order: a dashboard's
error-rate metric spikes and an alert fires — that's the "something's
wrong" signal. Traces for the slow or failed requests in that time window
narrow down _which_ service in the chain is the bottleneck — that's the
"where" signal. That service's own logs, found via the shared trace ID
stamped on the request as it passed through, give the full detail of
_why_ — the error message, the bad input, the stack trace.

## The order matters more than it seems

That sequence isn't just a mnemonic — skipping straight to the last step
is the expensive mistake most people make under pressure. Jumping
straight to logs — the most common instinct when something breaks —
means combing through fine-grained detail before you even know where to
look, which is a large part of why debugging a production incident so
often takes longer than it should. This is also exactly the toolkit for
answering why a
[circuit breaker](/systems-and-infrastructure/circuit-breaker) tripped,
or why a string of
[retries](/systems-and-infrastructure/exponential-backoff) keep failing:
the same metrics-then-traces-then-logs order applies there too.

## Where you'll meet this

A checkout that suddenly feels slow shows what traces are for. The
request calls inventory, pricing, and a payment provider, and a trace
shows which hop the time went to (for the provider, only how long your
call to it took), while a metric such as payment failure rate is what
fires the alert in the first place. A news feed page is often assembled
from several services, so a slow load is again a "where" question before
it is a "why" one. In a notification or email pipeline, the metrics
worth alerting on are things like queue depth and the age of the oldest
waiting message. When a user says an email never arrived, following that
one message's ID through the logs shows whether it was never sent,
retried, or
[dead-lettered](/systems-and-infrastructure/dead-letter-queue).
