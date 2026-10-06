---
title: Self-Healing Systems
summary: How a platform detects a broken instance and restarts, replaces or reroutes around it without a page, and the three ways that automation backfires.
date: 2026-09-21
---

Picture a checkout service running as four identical instances behind a
[load balancer](/systems-and-infrastructure/forward-vs-reverse-proxy), all
talking to one primary database. At 3 a.m. one instance hangs: the process
is alive but no longer answers requests. Nobody wants to be paged for that.
A **self-healing system** notices the failure and fixes it without a person,
usually crudely: restart the process, replace the machine, send traffic
elsewhere. Crude is fine, because most failures in a fleet (a hung process,
a leaked connection, a dead host) are common and boring, and a replacement
costs less than a diagnosis.

How does the platform know the instance is broken? Through a **health
check**: a small endpoint or command it calls on a schedule, treating
failed or slow answers as a sign something is wrong. Container
orchestrators such as Kubernetes ask two main questions with it.

## Liveness and readiness are different questions

A **liveness check** asks "is this process stuck beyond recovery?" After
several failures in a row, the platform kills and restarts it. That fixes
our hung instance. A **readiness check** asks "can this instance serve
traffic right now?" When it fails, the instance is only taken out of the
load balancer's rotation, not restarted.

Why keep both? Say a fifth checkout instance is starting up and spends 40
seconds warming a cache. It is alive but not ready. If liveness were
strict enough to kill it, it would restart before finishing and never come
up. Kubernetes has a **startup probe** for this case: it holds the other two
checks off until the instance has passed once.

The platform also keeps a desired instance count, so when one disappears
it starts a replacement. **Autoscaling** changes that count with load.
**Failover** is the same idea for stateful parts: when the primary database
dies, a standby replica is promoted to take its place.

## When the loop makes things worse

Self-healing is a loop of detect, act, repeat, and each step can go wrong.

Suppose a bad configuration change ships, and every new checkout instance
crashes on startup. The platform dutifully restarts each one, forever. This
is a **crash loop**. Kubernetes reports it as `CrashLoopBackOff` and waits
longer between attempts, up to a cap, for the same reason clients use
[exponential backoff](/systems-and-infrastructure/exponential-backoff):
retrying instantly burns resources and fixes nothing.

Now the subtler one. A well-meaning engineer makes the liveness check also
confirm the database is reachable. The database has a bad minute. All four
instances fail liveness together and are killed, and the whole service
restarts on top of a database that was the actual problem, with caches cold
and a rush of reconnections on the way (the
[thundering herd](/systems-and-infrastructure/thundering-herd-problem)). This
is a **cascading restart**. Liveness should test only whether the process
itself is stuck. Dependencies, at most, belong in readiness. Even there,
a shared dependency failing takes every instance out of rotation at once,
which can be worse than serving degraded answers, so many teams keep
dependencies out of both probes and use a
[circuit breaker](/systems-and-infrastructure/circuit-breaker) instead.

The third is **flapping**: an instance oscillating between healthy and
unhealthy, each flip causing a restart or a routing change. It usually
comes from a threshold so tight that one slow response counts as failure.
Requiring several consecutive failures before acting, and several
successes before trusting the instance again, damps it.

Failover has its own trap. Promote a replica that is behind and you lose
writes the old primary had already acknowledged, which in checkout means
lost orders. Promote on a brief network blip and the old primary may still
be running, leaving two primaries (see
[Read Replicas and Replication Lag](/systems-and-infrastructure/read-replicas)).

## Healing can hide a bug

Suppose the checkout service leaks memory and gets killed every few hours.
The dashboards look fine, because each restart masks the leak. But the
restart is a bandage: the leak is still there, and the kills will come
sooner as traffic grows. Restarts also throw away in-memory state and cut off requests in
flight, so callers still need timeouts and
[safe retries](/systems-and-infrastructure/idempotency).

So watch the healing itself. Count restarts, failovers and scale events,
and alert on the rate, not each event. An instance restarting twenty times
a day deserves a look even though no customer complained, and
[observability](/systems-and-infrastructure/observability) is how you see it.

**Rule of thumb.** Let the platform fix the boring failures, but keep
liveness checks to the process's own health, make every repair slow down
when it keeps failing, and treat a rising restart rate as a bug report.

## Where you'll meet this

In chat and messaging, instances hold long-lived connections, so a restart
drops every user on that node at once, and readiness has to stop new
connections landing on a node that is draining. In payments and checkout,
primary-database failover matters most, because a lost acknowledged write is
a lost payment. In a notification or email pipeline, workers are restarted
freely, which is safe only if sending is idempotent, since a restart can
replay the message that was in flight.
