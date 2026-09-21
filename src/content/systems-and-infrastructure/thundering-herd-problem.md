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

- **Single-flight / request coalescing.** When a cache miss happens, let
  exactly one request recompute the value; every other concurrent
  request for the same key waits on that first request's result instead
  of independently recomputing it.
- Recomputing a cache entry slightly _before_ it expires, with a small
  random offset per entry, keeps requests from all discovering a miss at
  the exact same instant in the first place — **early or jittered
  expiration**.
- With **stale-while-revalidate**, most readers keep getting served the
  old, technically-expired value while exactly one request refreshes it
  in the background, instead of every reader waiting on or triggering a
  fresh recompute.
- The same underlying fix also applies to a completely different
  trigger: when a service comes back online after an outage, **jittered
  reconnects** spread out when clients retry, so they don't all hit the
  service in the same instant it's least able to absorb the load — the
  same idea as [exponential backoff and jitter](/systems-and-infrastructure/exponential-backoff).

## Where you'll meet this

A URL shortener shows the cache version: one link goes viral, its cache
entry expires, and thousands of concurrent redirects find it empty and query
the database for the same row. Chat has the reconnect version: when a server
restarts or a network blip drops every connection at once, all of those
clients try to reconnect in the same instant, which is where jittered retries
earn their keep. A notification pipeline gets the scheduled version: a digest
job set for 9:00 starts work for every account in the same minute, and if the
sends it retries aren't jittered, a provider recovering from an outage takes
all those retries at once.
