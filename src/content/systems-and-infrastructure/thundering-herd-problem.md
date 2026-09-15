---
title: Thundering Herd Problem
summary: What happens when a single event wakes up or triggers many clients at once, and the small set of techniques that keep the resulting stampede from taking a system down.
date: 2026-09-15
---

The **thundering herd problem** happens when a single event triggers a
large number of clients or processes at once, and most of them then
compete for the same limited resource — often uselessly, since only a
handful can actually be served, while the rest have simply added load
for nothing.

## Where the name comes from

The term originates in operating systems: multiple processes can be put
to sleep waiting on the same event (a socket becoming ready to accept a
connection, for instance), and some early designs woke _all_ of them the
instant that event occurred, even though only one process could actually
claim it. The rest woke up, found the resource already taken, and went
back to sleep — a burst of wasted work triggered by a single event,
exactly like a herd of animals startled into stampeding by one gunshot.

## The version everyone actually runs into: cache stampede

The most common real-world instance today isn't in an operating system
scheduler at all — it's a **cache stampede**. A popular cache key
expires. In the instant right after, every request that would normally
have been served instantly from cache instead finds it empty, and all of
them independently go recompute the same expensive value — often by
hitting the same database query or the same slow computation
simultaneously. A key that was previously absorbing thousands of
requests per second with zero database load can, in that one moment,
send all of them to the database at once.

## Fixes: keep the herd from forming, or filter most of it out

- **Single-flight / request coalescing** — when a cache miss happens,
  let exactly one request actually recompute the value; every other
  concurrent request for the same key waits on that first request's
  result instead of independently recomputing it.
- **Early or jittered expiration** — recompute a cache entry slightly
  _before_ it actually expires, with a small random offset per entry, so
  requests don't all discover a miss at the exact same instant in the
  first place.
- **Stale-while-revalidate** — keep serving the old, technically-expired
  value to most readers while exactly one request refreshes it in the
  background, rather than making every reader wait on (or trigger) a
  fresh recompute.
- **Jittered reconnects** — the same underlying fix as
  [exponential backoff and jitter](/systems-and-infrastructure/exponential-backoff)
  applied to a different trigger: when a service comes back online after
  an outage, spreading out when clients reconnect avoids every client
  hitting it in the same instant it's least able to absorb the load.

## The common thread: don't let one trigger become work for everyone

Anywhere a shared resource has a synchronized trigger that can hit many
clients at the same moment: a cache key expiring, a service recovering
from an outage and every client reconnecting at once, or a scheduled job
that fires for every tenant at exactly the same minute. The common
thread across every fix above is the same: don't let one trigger turn
into simultaneous, duplicated work from everyone it affects.
