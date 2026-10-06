---
title: Observability
summary: Metrics tell you something is wrong, traces tell you where, and logs tell you why, which is the order to reach for them in an incident.
date: 2026-09-14
---

Your checkout page has been fine for months. At 2:10 p.m. a customer writes in: "payment is taking forever." You can't attach a debugger to production, and you can't reproduce the problem on your laptop. What you have is whatever the running system chose to report about itself. **Observability** is how well you can work out what is happening inside a system from those outputs alone, and it usually comes from three kinds of signal.

## Metrics: is something wrong?

A **metric** is a number sampled over time, such as requests per second, the share of requests that fail, or how long requests take. Your system adds up counts as it runs, and a monitoring tool records them every few seconds to a minute.

Because a metric is an aggregate, it is small and cheap to keep, and you can chart it, draw a line on the chart and **alert** when it crosses the line. Say your checkout's 99th-percentile latency (the time that 99 of every 100 requests beat) jumps from 0.8 seconds to 5 seconds at 2:10. An alert fires before the customer finishes typing.

But the same aggregation is the limit. The metric says at least 1 request in 100 is taking 5 seconds or more. It can't say which request, which service, or why, because that detail was averaged away when the number was made.

## Traces: where is it wrong?

Checkout doesn't do its work alone. It calls an inventory service, a pricing service and a payment provider. So where did the five seconds go?

A **trace** answers that. When a request enters your system it gets a unique **trace ID**, and every service passes that ID along on each call it makes, usually in a request header. Each service records a **span**: one timed step, with a start, a duration and the trace ID. Stitch the spans with the same ID together and you get the request's whole journey:

| Step                      | Time in step |
| ------------------------- | -----------: |
| Pricing                   |        0.1 s |
| Inventory                 |        0.2 s |
| Payment call (3 attempts) |        4.2 s |
| Everything else           |        0.5 s |
| Total                     |        5.0 s |

The question just got much smaller. You aren't searching all of checkout, only the payment call. Note what a trace can't tell you here: it shows how long your call to the provider took, not what happened inside the provider.

Recording every request's trace can cost more than it's worth at high traffic, so many systems keep a **sample**, such as 1 request in 100, plus any request that failed or ran slowly. That still gives you plenty of slow examples to open.

## Logs: why is it wrong?

A **log** is a timestamped record a program writes about one event: an error message, the input that caused it, a stack trace. Logs hold the detail the other two signals discard.

At scale, the trouble is finding the right lines. Checkout runs on many instances, and each writes thousands of lines a minute. This is where the trace ID pays off a second time. If every log line carries it, you search for one ID and see exactly what the payment code logged for the slow request: each attempt timed out, and the provider's error said its card network was degraded. Logs written as structured fields (key and value pairs) rather than free text make that search reliable.

## Why the order matters

You now have the whole sequence for the 2:10 incident: the metric told you something was wrong, a trace narrowed it to the payment call, and that request's logs showed the cause. Under pressure the tempting move is to jump straight to logs, since they hold the answer. But without a place to look, you are reading millions of lines about requests that were fine.

Metrics have a cost trap. A metric is cheap until you add a label (a tag that splits the number by some value) with many distinct values, such as a user ID, because the monitoring tool stores a separate series for every distinct value. Logs and traces are the signals to key by individual request.

The same sequence explains the behavior of other patterns in this catalog. A [circuit breaker](/systems-and-infrastructure/circuit-breaker) opening shows up as a metric, and traces of the calls before it tripped show why it opened. A run of [retries](/systems-and-infrastructure/exponential-backoff) shows up as a cluster of repeated spans under one trace ID.

**Rule of thumb.** Alert on metrics, find the culprit with traces, and explain it with logs that carry the trace ID; going straight to logs makes you search before you know where to look.

## Where you'll meet this

In payments and checkout, the metric that pages someone is usually the payment failure rate, and the trace is how you tell a slow provider from your own slow code. In a news feed or timeline assembled from several services, a slow page load is a "where" question before it is a "why" one, so traces come first. In a notification or email pipeline, you alert on queue depth and the age of the oldest waiting message. When a user says an email never arrived, follow that one message's ID through the logs to see whether it was never sent, was retried, or ended up in a [dead-letter queue](/systems-and-infrastructure/message-queues#dead-letter-queues).
