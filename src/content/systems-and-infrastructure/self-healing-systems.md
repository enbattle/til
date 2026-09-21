---
title: Self-Healing Systems
summary: Letting the platform detect a broken instance and restart, replace or reroute around it automatically, and where that automation stops helping.
date: 2026-09-21
---

A **self-healing system** notices when one of its parts has failed and
fixes the situation without a person being paged first. The fix is
usually crude: restart the process, replace the machine, send traffic
elsewhere. That crudeness is fine, because most failures in a large
fleet (a hung process, a leaked connection, a dead host) are common and
boring, and a replacement is cheaper than a diagnosis.

Everything starts with a way to tell healthy from broken. That is a
**health check**: a small endpoint or command the platform calls
repeatedly, treating failed or slow answers as a sign something is
wrong. Container orchestrators like Kubernetes split this into two
different questions.

## Liveness and readiness are different questions

A **liveness check** asks "is this process stuck beyond recovery?" If it
fails repeatedly, the platform kills and restarts it. A **readiness
check** asks "can this instance serve traffic right now?" If it fails,
the instance is only taken out of the load balancer's rotation, and it
is not restarted. That suits an instance that is still warming a cache
at startup, or one that is temporarily overloaded. Restarting it would
just throw away the work it is doing to become ready. The same worry
applies to a slow-starting instance that an aggressive liveness check
kills before it finishes booting; Kubernetes has a separate **startup
probe** for that, which holds the other two checks off until the
instance has come up once.

Beyond restarts, a few other mechanisms do the same kind of job.
**Failover** promotes a standby, such as a replica that becomes the new
primary database, when the active one dies. It has its own failure
modes: promoting a replica that is behind loses acknowledged writes, and
a failover triggered by a brief network blip can leave two primaries
(see [Read Replicas and Replication
Lag](/systems-and-infrastructure/read-replicas)). **Autoscaling** adds
instances when load rises and removes them when it falls. Separately,
the same platforms keep a desired instance count and start a replacement
when one disappears.

## The ways automation makes things worse

Self-healing is a loop of detect, act, repeat, and each part of that loop
can go wrong.

A **crash loop** happens when a new instance fails just as the old one
did, for example because its configuration is bad, so the platform keeps
restarting it. Kubernetes reports this state as `CrashLoopBackOff` and
waits longer between each attempt, up to a cap, for the same reason
[exponential backoff](/systems-and-infrastructure/exponential-backoff)
exists for clients: restarting instantly and forever burns resources and
helps nothing.

A **cascading restart** comes from a liveness check that is too
ambitious. Suppose it also verifies that the database is reachable. When
the database goes down, every instance fails liveness at once and is
killed, and now the whole service is restarting on top of a database
that was the real problem. Liveness should test only the process's own
health. Dependencies belong in readiness at most, and even there a
shared dependency taking every instance out of rotation at once can be
worse than serving degraded answers, so many teams keep them out of both
probes and rely on a [circuit
breaker](/systems-and-infrastructure/circuit-breaker) instead.

**Flapping** is an instance oscillating between healthy and unhealthy,
each flip triggering a restart or a routing change. It usually comes
from thresholds set too tightly, so a single slow response counts as a
failure. Requiring several consecutive failures before acting, and
several successes before trusting an instance again, damps it.

## Healing can hide a bug

A service with a memory leak that gets restarted every few hours looks
healthy from most dashboards. The restart is a bandage, and the leak is
still there, waiting to get worse under more traffic. Restarts also
discard in-memory state and drop in-flight requests, so callers still
need timeouts and safe retries.

Count restarts, failovers and scale events, and alert on the rate rather
than the individual event. A pod restarting twenty times a day should
get someone's attention even though no user noticed; that is the kind of
signal [observability](/systems-and-infrastructure/observability) is
there to surface.

## Where you'll meet this

A chat service holds long-lived connections to its users, so its
instances need readiness checks that stop new connections landing on a
node that is shutting down or overloaded, and a restart drops everyone
connected to that node at once. In payments and checkout, failover of
the primary database is the case that matters most, since a lost
acknowledged write there is a lost order or payment; the failure modes
of promoting a replica are covered in [Read Replicas and Replication
Lag](/systems-and-infrastructure/read-replicas).
