---
title: Consistent Hashing
summary: Assign keys to servers so that adding or removing a server moves only about 1/n of the keys, instead of nearly all of them.
date: 2026-09-15
---

Suppose you run a [cache](/systems-and-infrastructure/caching) made of 4 servers, holding 1,000,000 cached links. Every request has to find the one server that holds its key, and every client has to agree on which one that is, with no central directory to ask. The obvious answer is a formula: run the key through a **hash function** (a function that turns any key into a big, evenly spread number) and take the remainder after dividing by the server count, `hash(key) % 4`. Servers numbered 0 to 3, one answer per key, no lookups.

## What goes wrong when the server count changes

Traffic grows, so you add a fifth server and the formula becomes `hash(key) % 5`. A key keeps its server only if both formulas give the same number. Over any 20 consecutive hash values, that happens for 4 of them (the hashes ending in remainders 0, 1, 2 and 3 of 20), so 80% of your keys, about 800,000, now point to the wrong server.

Each of those is a cache miss, and every miss falls through to the database behind the cache. Losing a server does the same thing in reverse: `% 4` becomes `% 3`, and only a quarter of the keys stay put. A crash is exactly when you can least afford it, because the database is already absorbing the traffic the dead server used to serve.

So can a key be assigned to a server in a way that doesn't depend on how many servers exist? Nearly, and the trick is to stop dividing.

## Putting servers and keys on a ring

**Consistent hashing** hashes the servers, not just the keys, onto one shared circle called a **ring**: the hash range runs from 0 up to its maximum and then wraps back to 0. Each server lands at a point (hash its name or address). Each key lands at a point too. To find a key's server, start at the key's point and walk clockwise until you reach a server. That server owns the key.

Now add the fifth server. It lands at one point on the ring and takes over only the arc of keys between it and the server just before it, counterclockwise. Those keys used to belong to the next server clockwise from the new one. Everything else stays where it was. If the arcs come out even, that is about 1/5 of the keys, roughly 200,000 instead of 800,000. When a server dies, its keys walk on to the next server clockwise, and no other key moves. In general, a change moves about 1/n of the keys with n servers.

## The catch: uneven arcs, and virtual nodes

Four points dropped on a circle by a hash function rarely land evenly. One server might own 40% of the ring and another 10%, so the big one takes four times the traffic. A failure is worse. All of the dead server's keys fall onto a single neighbor, which can double its own load and tip it over, and then its neighbor inherits that load.

The fix is to give each server many points. A **virtual node** is one such point: server A is hashed as A-1, A-2, and so on up to A-200, say, each placed independently around the ring. Each server now owns hundreds of small arcs scattered everywhere. By the law of averages, its total share lands close to 1/n; with 100 to 200 points each, most servers land within about 10% of the average, and the busiest is often 10–20% over. The same scattering fixes failure: the dead server's arcs border many different neighbors, so its load spreads across the survivors.

Virtual nodes also let you weight servers. A machine with twice the memory gets twice as many points and takes about twice the keys.

## What it costs, and how to use it

Every client (or a router in front of them) needs the same list of servers, hash function and point count to build the same ring, so changing membership means distributing that list. Hundreds of points per server make the ring larger, but a lookup is still a binary search over a sorted array of points, which is cheap. And "only 1/n of the keys move" is a statement about how few keys change owner. For a cache those keys are simply cold; for a database shard, the data has to be copied to its new owner before the swap, which is a separate job (see [partitioning vs. sharding](/systems-and-infrastructure/partitioning-vs-sharding)).

**Rule of thumb.** Use plain `hash % n` only when the number of servers never changes. If servers come and go, put them on a ring with virtual nodes, so a change moves about 1/n of the keys and not most of them.

## Where you'll meet this

- A URL shortener's cache tier is the case above: the miss rate after adding a node decides whether the database behind it holds up, and the ring is what keeps that rate near 1/n.
- A [load balancer](/systems-and-infrastructure/forward-vs-reverse-proxy) in front of a chat service can hash a conversation ID onto the ring so a conversation keeps reaching the server that holds its live state, even as servers are added or drained. Only the conversations on the arcs that moved lose their server.
- A news feed's timeline cache, keyed by user, is spread the same way. Virtual node weights let a newer machine with more memory carry a larger share of users.
