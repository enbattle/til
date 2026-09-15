---
title: Monolith vs. Microservices
summary: The real tradeoffs behind the split — deployment, team autonomy, failure modes — and why microservices aren't a maturity level to graduate into.
date: 2026-09-14
---

A **monolith** is a single deployable unit containing all of an
application's functionality — one codebase, one build, one deploy.
**Microservices** split that same functionality into many independently
deployable services, each owning a narrow piece of it, talking to each
other over the network instead of through direct in-process calls.

## What a monolith costs you, and what it saves you

Everything runs in one process, so a stack trace is just a stack trace,
not a hunt across five services' worth of logs. Deploys, and usually
database transactions, are atomic — either the whole change lands or none
of it does. Because internal components talk through plain function
calls, not the network, none of the distributed-systems failure modes
below apply _internally_. The cost is that the entire application scales
as a single unit even when only one feature is actually under heavy
load, and a large team working in one codebase creates real day-to-day
coordination friction — two people's changes collide more often, and one
person's bug can block everyone else's deploy.

## What microservices cost you, and what they save you

Splitting the application up buys independent deployability — each
team ships on its own schedule — and independent scaling, since only the
service that's actually under load needs more capacity. What it costs is
substantial operational complexity, because everything a monolith got for
free now has to be built deliberately:

- Calls between services now travel over the network, which means they
  can fail, time out, or arrive out of order — needing
  [retries with backoff](/systems-and-infrastructure/exponential-backoff),
  [circuit breakers](/systems-and-infrastructure/circuit-breaker), and
  [rate limiting](/systems-and-infrastructure/rate-limiting) to handle
  gracefully.
- There's no single-database transaction spanning the whole operation
  anymore, so keeping several services' data consistent needs patterns
  built specifically for that, and every consumer of an event needs to be
  [idempotent](/systems-and-infrastructure/idempotency), since a message
  might get delivered more than once.
- Debugging a feature that now spans five services requires real
  [observability](/systems-and-infrastructure/observability) — a debugger
  attached to one process no longer shows you the whole picture.
- [CAP theorem](/systems-and-infrastructure/cap-theorem) tradeoffs, mostly
  invisible inside a monolith's single database, become unavoidable the
  moment state is split across services that can't always talk to each
  other.

## Why the industry consensus shifted

This is one of the more debated architecture decisions of the last
decade, and opinion has moved: from "everyone should be doing
microservices" toward a more cautious "start with a monolith" default,
with some well-known early adopters having since folded services back
together. That shift happened because the operational costs above are
easy to underestimate from the outside — they don't show up until a team
is actually living with them.

A middle ground worth knowing: a "modular monolith" is still one
deployable unit, but internally organized into clearly separated modules
with disciplined boundaries between them — aiming to keep the simplicity
of one deploy while making a future split easier, if one ever actually
becomes necessary.

## Default to a monolith, split when the pain is real

Microservices trade simplicity for independent scalability and
deployability — a trade that only pays for itself once team size,
conflicting deploy schedules, or genuine scaling needs make the
distributed-systems complexity worth it. Adopting microservices before
that need is real and specific is a common, expensive mistake: it pays
the entire operational cost while capturing none of the benefit yet.
