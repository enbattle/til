---
title: Read Replicas and Replication Lag
summary: Extra read-only copies of a database spread read traffic across machines, at the price of copies that can briefly trail the primary.
date: 2026-09-21
---

A **read replica** is a copy of a database that serves reads but not
writes. The original, called the **primary**, is the only machine that
accepts writes. It records every change in an ordered log, and each
replica receives that log and applies the same changes in the same
order, so it stays a near-current copy. A read-heavy application then
spreads its queries over several replicas instead of loading one
machine, as described in
[Scaling Reads vs. Scaling Writes](/systems-and-infrastructure/scaling-reads-vs-scaling-writes).

Replicas do nothing for write capacity. Every write still goes through
the primary, and each replica has to apply it too, so a write-heavy
system gains nothing from adding them.

## Routing reads

The database doesn't decide which queries go where; the application, a
driver, or a proxy in front of the database does. The simplest scheme
keeps two connection settings, one for the primary and one for the pool
of replicas, and sends every query that only reads to the second. A read
that must be fresh, or that runs inside a transaction that also writes,
goes to the primary.

## Asynchronous and synchronous replication

With **asynchronous** replication, the primary commits a write and
acknowledges it without waiting for any replica. Writes stay fast, and a
slow or dead replica doesn't hold anything up, but a replica is always
slightly behind. With **synchronous** replication, the primary waits
until at least one replica confirms it has received the change before
acknowledging. An acknowledged write then survives the loss of the
primary machine, but every write pays a network round trip, and
depending on the configuration, an unreachable replica can stall writes.
"Received" is weaker than "applied," too: a synchronous replica may hold
the change without having applied it yet, so it can still serve slightly
old reads. Most read replicas are asynchronous, since the point is cheap
read capacity, and many databases that offer the synchronous option let
you require it for some replicas and not others.

## Replication lag

The delay between a write landing on the primary and appearing on a
replica is **replication lag**. It is often milliseconds, but it grows
with heavy write bursts, a slow network, or a replica busy with a large
query, and can reach seconds or more. Lag is why a replica read may
return older data than a write that has already succeeded.

The most visible consequence is failing to **read your own writes**. A
user saves a change to their profile, the page reloads, the read lands
on a replica that hasn't received the change yet, and it looks as if the
save never happened. A related oddity is that two reads in a row can hit
different replicas, and the second, from a more delayed one, can show
older data than the first, so data appears to go back in time.

Common remedies, none of them free:

- Send a user's reads to the primary for a short window after they
  write.
- Have the application remember the log position of a user's last
  write, and use only a replica that has reached it.
- Pin a user to one replica, which prevents going back in time but not
  missing their own write.
- Send reads that must be correct, like a balance check before a
  withdrawal, always to the primary.

The other read-copy technique, a cache, carries the same risk of stale
answers; see [Caching](/systems-and-infrastructure/caching) and [Cache
Invalidation](/systems-and-infrastructure/cache-invalidation).

## Failover

If the primary dies, a replica can be **promoted** to take its place: it
stops following the old primary, starts accepting writes, and the other
replicas and the application are pointed at it. Because replication is
usually asynchronous, the promoted replica may be missing the last few
writes the old primary acknowledged, and those are lost or need manual
reconciliation. There is a second danger if the old primary comes back
believing it is still in charge: two machines accepting writes at once,
a situation called **split-brain**. Real setups need a way to stop the
old one from doing that, known as **fencing**, and to detect failure
without promoting on a brief network hiccup. Automating this is a topic
of its own; see [Self-Healing
Systems](/systems-and-infrastructure/self-healing-systems).

## Where you'll meet this

A news feed is the natural home for replicas: reads far outnumber
writes, and a timeline a second or two stale bothers nobody, but a user
posting something and not seeing it on their own profile does. A URL
shortener has a sharper version, since a link often gets used moments
after it's created, and a redirect served by a replica that hasn't
received the row yet returns "not found" for a link that exists. In
payments, order history can come from a replica, but checking that
funds or stock are still available before charging belongs on the
primary.
