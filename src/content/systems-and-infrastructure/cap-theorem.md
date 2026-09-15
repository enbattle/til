---
title: CAP Theorem
summary: Why a distributed system can't stay both fully consistent and fully available during a network partition, and what choosing between them actually looks like.
date: 2026-09-14
---

A **distributed system** — one where data lives across more than one
machine — has to survive a **network partition**: a period where some of
those machines can't talk to each other, whether from packet loss, a
crashed node, or a severed link between data centers. The **CAP
theorem** says that when a partition happens, a system has to choose
between **Consistency** (every read reflects the latest write) and
**Availability** (every request gets a response, even a stale one) — it
can't fully guarantee both at the same time.

## Why partition tolerance isn't actually a choice

CAP is often summarized as "pick two of Consistency, Availability, and
Partition tolerance," as if all three combinations were equally live
options. In practice, only two are: any system spread across more than
one machine will eventually experience a partition, so refusing to
tolerate one isn't a real design choice — it's just a system that hasn't
had its bad day yet. The actual decision is what happens **during** that
partition: keep answering and risk a stale or conflicting answer
(**availability-favoring**), or refuse to answer until the system can be
sure the answer is current (**consistency-favoring**).

## What each choice looks like in practice

- **Favoring consistency**: a system built around getting multiple nodes
  to agree before confirming anything — the kind of coordination service
  used to manage cluster configuration — would rather return an error
  than risk handing back an inconsistent read.
- **Favoring availability**: the internet's DNS system keeps answering
  requests during a partition, serving whatever answer it already has
  cached even if it's gone stale, rather than refusing to respond until
  it can reach the authoritative source.

## The tradeoff CAP leaves out: latency vs. consistency, even when nothing's broken

CAP only describes behavior **during** a partition — it's silent about
the rest of the time, when the network is perfectly healthy. A related
idea, sometimes called **PACELC**, extends it: _if there's a Partition,
choose Availability or Consistency (that's CAP) — Else (network healthy),
choose Latency or Consistency._

Even with no partition in sight, a system that wants every read to
reflect the very latest write has to wait for that write to be
confirmed by multiple copies of the data before telling the client it
succeeded — and that confirmation step costs time. A system that instead
confirms a write as soon as it reaches just one copy, and copies it to
the others in the background, responds faster, but a read against one of
those other copies immediately afterward can return the older value.
That's a real, everyday tradeoff, entirely separate from partition
behavior.

This is why naming only a system's partition behavior ("it's
availability-favoring") is an incomplete answer: a system can additionally
choose to favor low latency over strict consistency the rest of the time
too, by design, the same way it favors availability during a partition —
or it can choose consistency in both cases, paying a latency cost
whether or not anything is actually broken.

## Choosing it deliberately

Partitions aren't a rare edge case to plan for later — they happen
regularly at any real scale, so this decision is best made deliberately
at design time, not discovered mid-incident when a service has already
started timing out. It shows up directly when picking between a strongly
consistent [relational database and a more availability-oriented NoSQL
store](/systems-and-infrastructure/sql-vs-nosql), and in designing any
service replicated across multiple regions or availability zones.
