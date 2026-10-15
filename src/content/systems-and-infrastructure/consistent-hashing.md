---
title: Consistent Hashing
summary: Assign keys to servers so that adding or removing a server moves only about 1/n of the keys, instead of nearly all of them.
date: 2026-09-15
---

Suppose you run a [cache](/systems-and-infrastructure/caching), a fast store that keeps copies of data from a slower database, spread over 4 servers and holding 1,000,000 short links. Each request must find the server holding its link, and every client must agree on which that is, with no central directory to ask. How do you pick a server for each link so the answer survives adding or losing a server?

This page starts with the obvious formula, shows why it breaks when you add a server, builds the ring that fixes it and the virtual nodes that keep it fair, and ends on what the ring costs.

## The obvious formula

Each link is looked up by its **key**, the short code in its URL. Run the key through a **hash function**, which turns any key into a big number spread evenly over its range, and take the remainder after dividing by the server count: `hash(key) % 4`. Each key gets one answer, with no lookup.

It works, until the number of servers changes.

## What breaks when you add a server

Traffic grows, so you add a fifth server and the formula becomes `hash(key) % 5`. A key keeps its server only when both formulas give the same answer. Lay the hash values out in a row:

```text
hash value     0  1  2  3  4  5  6  7  8  9
hash % 4       0  1  2  3  0  1  2  3  0  1
hash % 5       0  1  2  3  4  0  1  2  3  4
same server?   y  y  y  y  n  n  n  n  n  n
```

Carry the row on and the two first line up again at 20, the smallest positive number both 4 and 5 divide. So the pattern repeats every 20 values, and only 0 to 3 of each 20 match:

```text
keys that stay:  4 ÷ 20 = 20%
keys that move:  100% − 20% = 80%
                 0.8 × 1,000,000 = 800,000 links
```

Each moved link is a **cache miss**: its new server doesn't have it, so the request falls through to the database.

Losing a server is the same in reverse. `% 4` becomes `% 3`, the pattern repeats every 12 values, and only 3 of each 12, a quarter, stay put. A crash is when you can least afford that, because the database is already absorbing the dead server's traffic.

Can a key's server stop depending on the server count? Nearly, if you stop dividing.

## Putting servers and keys on a ring

Picture the hash function's range, from 0 up to its maximum, bent into a circle so the maximum wraps back to 0. Hash each server's name onto this circle, and each key too. To find a key's server, start at the key's point and walk clockwise until you reach a server. The circle is called a **ring**, and placing servers and keys on it this way is **consistent hashing**.

Now add the fifth server. It lands at one point and takes over only the arc between it and the server before it, counterclockwise; those keys used to belong to the next server clockwise. Every other key stays. If the arcs are even:

```text
keys that move:  1,000,000 ÷ 5 = 200,000, instead of 800,000
```

When a server dies, its keys walk on to the next server clockwise, and no other key moves. In general, with n servers a change moves about 1/n of the keys.

The ring keeps moves small. It doesn't keep shares even.

## Uneven arcs, and virtual nodes

Four points dropped on a circle by a hash function rarely land evenly. One server might own 40% of the ring and another 10%, so the first takes 40 ÷ 10 = 4 times the traffic of the second. A failure is worse: all of the dead server's keys fall onto one neighbor, which can double its load and tip it over, passing the load on again.

The fix is to give each server many points. Server A is hashed as A-1, A-2, and so on up to A-200, say, each landing independently, so A owns hundreds of small arcs scattered around the ring. Each point is a **virtual node**. By the law of averages, each server's total share lands close to 1/n: with 100 to 200 points each, most servers come within about 10% of the average, and the busiest is often 10–20% over.

The same scattering helps when a server fails. A dead server's arcs now border many different neighbors, so its load spreads across the survivors.

Virtual nodes also let you weight servers. A machine with twice the memory gets twice the points and takes about twice the keys.

So the ring keeps moves small, and virtual nodes keep shares even. Neither comes free.

## What it costs

Every client, or a router in front of them, needs the same server list, hash function and point count to build the same ring, so changing membership means sending that list to all of them. Hundreds of points per server make the ring bigger, but a lookup is a **binary search**, halving a sorted list of points until it finds the next one, which is cheap.

And "only 1/n of the keys move" counts keys that change owner. In a cache those keys just start cold. In a database split into **shards**, pieces each held by one server, their data has to be copied to the new owner before the switch, a separate job ([partitioning vs. sharding](/systems-and-infrastructure/partitioning-vs-sharding)).

**Rule of thumb.** Use plain `hash % n` only when the number of servers never changes. If servers come and go, put them on a ring with virtual nodes, so a change moves about 1/n of the keys and not most of them.

## Where you'll meet this

- A URL shortener's cache tier is the case above: the miss rate after adding a node decides whether the database behind it holds up, and the ring keeps that rate near 1/n.
- A [load balancer](/systems-and-infrastructure/forward-vs-reverse-proxy), which spreads requests across servers, in front of a chat service can hash a conversation ID onto the ring so a conversation keeps reaching the server that holds its live state, even as servers are added or taken out of service. Only the conversations on the arcs that moved lose their server.
- A news feed's timeline cache, keyed by user, is spread the same way. Virtual node weights let a newer machine with more memory carry a larger share of users.
