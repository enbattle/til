---
title: Consistent Hashing
summary: A hashing scheme where adding or removing a node reshuffles only a small slice of the data instead of nearly all of it.
date: 2026-09-15
---

Spreading keys across a set of nodes (cache servers, database shards)
usually starts with the obvious approach: `node = hash(key) % number_of_nodes`.
It works fine right up until the node count changes — a server is added,
one crashes — at which point the modulo result changes for almost every
key at once. **Consistent hashing** is a different way of assigning keys
to nodes specifically so that a node joining or leaving only reshuffles a
small, proportional slice of the data, not nearly all of it.

## Why the naive approach falls apart the moment a node changes

With `hash(key) % n`, changing `n` from 4 to 5 changes the result of that
formula for the overwhelming majority of keys, even though only one node
actually joined. Nearly the entire dataset needs to move or re-cache in
one go — and this tends to happen at exactly the worst time, right after
a node has just failed and the system is already under stress from
losing capacity.

## Placing nodes and keys on the same ring

Consistent hashing avoids this by hashing both the nodes and the keys
onto the same fixed circular range — a **ring** — using the same hash
function. A key belongs to whichever node's position comes first going
clockwise from the key's own position on the ring. Adding a new node
only takes over the keys between its position and the position of the
node that was previously its clockwise neighbor; removing a node only
affects the keys that were assigned to it, which fall to the next node
clockwise instead. Every other key on the ring, belonging to every other
node, is completely unaffected.

## Virtual nodes: keeping the ring balanced with few physical nodes

In practice, each physical node is hashed onto _multiple_ points on the
ring rather than just one — commonly called **virtual nodes**. Without
this, a physical node could end up owning a disproportionately large or
small arc of the ring purely by where its single hash happened to land;
spreading each physical node across many points averages that luck out,
so load balances evenly even with only a handful of physical machines.

## Why this beats the naive approach

That's the entire benefit over `hash(key) % n`: adding or removing a
node becomes a small, local, proportional change instead of a
full-dataset reshuffle — which is what makes horizontally scaling a
cache or a set of database shards an ordinary, low-risk operation
instead of something that needs to be scheduled as risky maintenance.
This is the mechanism underneath distributed caches, distributed
databases spreading data across [shards](/systems-and-infrastructure/partitioning-vs-sharding),
and load balancers that need to keep routing a given client to the same
backend instance even as instances come and go.
