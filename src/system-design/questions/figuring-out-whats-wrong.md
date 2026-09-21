---
title: How do I figure out what's wrong with my system?
summary: Where to look first when something is slow or failing and you don't yet know which part is responsible.
date: 2026-09-20
order: 1
---

Pages take longer than they used to, some requests fail, or an alert fires
and the only information is a number that went up. Most of the other
questions in this section start from a diagnosis ("my database can't keep up
with reads"). This one is for getting to a diagnosis.

## Start with what you can measure

[Observability](/systems-and-infrastructure/observability) is built from
three kinds of signal, and they work best in a fixed order. Metrics, numbers
aggregated over time such as the error rate, show that something is wrong.
Traces, which follow one request through every service it touches, show
where. Logs, the detailed records from the one service you've narrowed it
down to, show why. Going straight to the logs is the usual mistake: with no
idea which service to open, you're searching a lot of detail for something
you can't yet describe.

## If you have none of that yet

A small system may have no metrics or traces at all. Start smaller. Check CPU,
memory and disk on the machines involved, look at what changed recently (a
deploy, a traffic spike, a configuration change), and read the application's
own error logs. Then add what you had to guess at, starting with request-time
and error-rate metrics.

## Work out which kind of slow it is

"Slow" means one of two things. Either each request takes too long, which is
a latency problem, or the system can't finish enough requests per second,
which is a throughput problem. They call for different fixes and can pull
against each other, so a change aimed at one can hurt the other. Decide which
one the affected endpoint cares about before choosing a remedy; the
distinction is laid out in
[Latency vs. Throughput](/systems-and-infrastructure/latency-vs-throughput).
Slow individual requests tend to show up in a trace as one slow step. A
throughput shortfall tends to show up as queues and a saturated component.

## Where to go next

Once the metrics and traces have narrowed it down, the symptom usually points
at one of these:

| What you're seeing                                                    | Go to                                                                                                                                        |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Queries are slow, or the database is busy with read traffic           | [What do I do when my database can't keep up with reads?](/system-design/database-cant-keep-up-with-reads)                                   |
| Requests hang or fail while the database looks idle                   | [What do I do when my database can't keep up with reads?](/system-design/database-cant-keep-up-with-reads) (see the connection-pool section) |
| Writes are slow or the database is out of capacity for them           | [What do I do when one database can't keep up with writes?](/system-design/database-cant-keep-up-with-writes)                                |
| One dependency is failing and the trouble is spreading to its callers | [How do I stop one failing service from taking everything else down?](/system-design/one-failing-service-taking-down-others)                 |
| Duplicate, missing or conflicting data                                | [How do I keep data correct when many users or services change it at once?](/system-design/keeping-data-correct-under-concurrency)           |

## When it isn't this problem

If you already know which part is failing, skip to the matching question. If
you're choosing an architecture rather than debugging one, that belongs to
[How should I structure my services and storage in the first place?](/system-design/structuring-services-and-storage).
