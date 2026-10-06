---
title: Read Replicas and Replication Lag
summary: Extra read-only copies of a database spread read traffic across machines, at the price of copies that can briefly trail the primary.
date: 2026-09-21
---

Picture a profile page on a busy app. Millions of people load profiles
all day, and a few of them each minute change their display name. One
database machine is struggling under all those page loads. What do you
do?

You add copies. A **read replica** is a copy of a database that serves
reads but not writes. The original, called the **primary**, is the
machine that accepts writes. It records every change in an ordered log,
and each replica receives that log and applies the same changes in the
same order, so it stays a near-current copy. Profile page loads now
spread across several replicas, which is the read-scaling move described
in
[Scaling Reads vs. Scaling Writes](/systems-and-infrastructure/scaling-reads-vs-scaling-writes).

Replicas add no write capacity. Every name change still goes through the
primary, and each replica has to apply it as well, so a write-heavy
system gains little from adding them.

## Who decides where a query goes?

Not the database. The application, a driver, or a proxy in front of the
database does. The simplest scheme keeps two connection settings, one
for the primary and one for the pool of replicas, and sends queries that
only read to the second. A read that must be fresh, or that runs inside
a transaction that also writes, goes to the primary.

## Does the primary wait for its replicas?

That is the choice between two modes. With **asynchronous** replication,
the primary commits a write and acknowledges it without waiting for any
replica. Writes stay fast and a slow or dead replica holds nothing up,
but a replica is always slightly behind. With **synchronous**
replication, the primary waits until at least one replica confirms the
change before acknowledging. An acknowledged write then survives the loss
of the primary machine, as long as failover promotes a replica that confirmed it, but every write pays a network round trip, and an
unreachable replica can stall writes, depending on configuration.

"Confirms" varies by database and setting. Some confirm only that the
change was received, and a replica that has received a change may not
have applied it yet, so it can still serve old data. Most read replicas
are asynchronous, since the point is cheap read capacity.

## What goes wrong on the profile page?

The delay between a write landing on the primary and appearing on a
replica is **replication lag**. It is often milliseconds, but it grows
with write bursts, a slow network, or a replica busy with a large query,
and it can reach seconds or more.

Now a user renames themselves and the page reloads. The write went to the
primary, the reload read from a replica the change hasn't reached, and
the old name appears. The save looks lost. This is a failure to **read
your own writes**. A second oddity: two reloads in a row can land on
different replicas, and if the second is more delayed, the name flips
back to the old one, so data seems to go back in time.

Remedies, each with a cost:

- Send a user's reads to the primary for a short window after they
  write. This puts load back on the primary.
- Have the application remember the log position of a user's last write,
  and read only from a replica that has reached it. This takes more
  bookkeeping, and a replica that is far behind forces a fallback to the
  primary.
- Pin a user to one replica. That stops the name flipping back, but does
  nothing about the first reload missing the new name, and if that
  replica fails the user moves to another with a different lag.
- Send reads that must be correct, such as a balance check before a
  withdrawal, to the primary every time.

A cache can return stale answers in the same way; see
[Caching](/systems-and-infrastructure/caching) and
[Cache Invalidation](/systems-and-infrastructure/cache-invalidation).

## What if the primary dies?

A replica can be **promoted**: it stops following the old primary, starts
accepting writes, and the other replicas and the application are pointed
at it. With asynchronous replication, the promoted replica may be missing
the last few writes the old primary acknowledged. If a user's rename was
among them, it is gone unless someone reconciles it by hand.

A second danger is the old primary coming back still believing it is in
charge, leaving two machines accepting writes, which is **split-brain**.
Setups guard against it with **fencing**, which cuts the old primary off
so it cannot write, and they try to tell real failure from a brief
network hiccup before promoting. Automating all of this is a topic of
its own; see
[Self-Healing Systems](/systems-and-infrastructure/self-healing-systems).

**Rule of thumb.** Add replicas when reads dominate and slightly old
answers are acceptable, and decide for each read whether it can be stale.
Anything that must see the user's own write, or must be exactly right,
reads from the primary or from a replica known to have caught up.

## Where you'll meet this

A news feed fits replicas well, because nobody notices a timeline that is
a second old, and its one trouble spot is the
author's view of their own post is the one read that needs the primary or
a caught-up replica. A URL shortener has a sharper version, since a new
link is often opened moments after creation, and a lagging replica
answers "not found" for a link that exists. In payments, order history
can come from a replica, while a check that funds or stock remain before
charging belongs on the primary.
