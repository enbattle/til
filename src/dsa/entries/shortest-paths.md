---
title: Shortest Paths
summary: The cheapest route from one vertex to all the others in a weighted graph, found with a heap when no edge is negative and by repeated relaxation when some are.
date: 2026-10-05
kind: algorithm
---

"The cheapest flight", "the lowest-latency route": a graph whose edges have costs. You'll run one four-vertex graph through two algorithms: Dijkstra, which is fast but needs every cost to be zero or more, and Bellman-Ford, which is slower, accepts negative costs and can tell you when no answer exists.

## Prerequisites

- [Graph](/dsa/graph): directed weighted edges and the adjacency list, here `graph[u]` holding a `(v, weight)` pair per edge out of `u`.
- [Heap](/dsa/heap): Dijkstra takes the cheapest unfinished vertex from a min-heap.
- [Breadth-first search](/dsa/breadth-first-search): the same explore-outward loop, with every edge costing 1.

## The idea

The **cost** of a route is the sum of its edge weights, and the **distance** to a vertex is the cost of its cheapest route. Both algorithms keep a best-known cost per vertex, infinity except 0 at the source, and make one move, **relaxing** an edge `u -> v` of weight `w`: if reaching `u` and crossing the edge beats the best known for `v`, lower it. They differ only in the order they relax. The graph:

```text
0: (1, 4) (2, 1)     1: (3, 1)     2: (1, 2) (3, 5)     3: no edges
```

Vertex 1 is one edge away at cost 4, but going through 2 costs 1 + 2 = 3, so the first route found isn't always cheapest.

**Dijkstra** finishes vertices in order of distance. Take the unfinished vertex with the smallest best-known cost `d` and call it final: a cheaper route would have to leave the finished region through another unfinished vertex, already at least `d`, and edges only add. A min-heap of `(cost, vertex)` entries hands it over. A heap can't lower an entry in place, so an improved vertex gets a second entry, and the old, **stale** one is skipped when it surfaces (lazy deletion).

| Pop    | Action                          | Heap afterward      |
| ------ | ------------------------------- | ------------------- |
| (0, 0) | final; 1 gets 4, 2 gets 1       | (1,2), (4,1)        |
| (1, 2) | final; 1 drops to 3, 3 gets 6   | (3,1), (4,1), (6,3) |
| (3, 1) | final; 3 drops to 4             | (4,1), (4,3), (6,3) |
| (4, 1) | stale: 4 is above 1's cost of 3 | (4,3), (6,3)        |
| (4, 3) | final; no edges out             | (6,3)               |
| (6, 3) | stale: 6 is above 3's cost of 4 | empty               |

The distances are `[0, 3, 1, 4]`: six pops, four scans.

**Why a negative edge breaks it.** Take `0 -> 1` (2), `0 -> 2` (3), `2 -> 1` (-2) and `1 -> 3` (1). The cheapest route to 3 is 0, 2, 1, 3 for 3 - 2 + 1 = 2. Vertex 1 comes off the heap first, at cost 2, before the -2 edge that undercuts it is seen. The answer is `[0, 1, 3, 2]`, but a version that never lowers a finished vertex returns `[0, 2, 3, 3]`. The code below skips only entries priced above the current best, so a vertex whose cost drops is scanned again, which never happens with non-negative weights. That recovers here by scanning vertex 1 twice, but rescans can pile up, and a negative cycle never stops it.

**Bellman-Ford** stops being clever: relax every edge, call that a **round**, and repeat. A cheapest route repeats no vertex, since cutting out a cycle costing zero or more is no worse, so it has at most `V - 1` edges. Round `k` fixes every cheapest route of `k` edges, so `V - 1` rounds finish the job. Scanning vertices 0 to 3:

| Round | Distances for vertices 0 to 3 | Changed? |
| ----- | ----------------------------- | -------- |
| 1     | `[0, 3, 1, 5]`                | yes      |
| 2     | `[0, 3, 1, 4]`                | yes      |
| 3     | `[0, 3, 1, 4]`                | no, stop |

Round 1 passed 5 on to vertex 3 from 1's old cost of 4; round 2 fixes it.

If a cycle reachable from the source has a negative total, nothing is cheapest, and round `V` still changes something. Take `0 -> 1` (2), `0 -> 2` (3), `1 -> 2` (1) and `2 -> 1` (-2): the loop between 1 and 2 costs -1. Distances for vertices 0 to 2 go `[0, 1, 3]`, `[0, 0, 2]`, `[0, -1, 1]`, and the third round is round `V`, still changing.

When every weight is the same, the heap hands vertices out in the order a queue would, so [BFS](/dsa/breadth-first-search) does the same job in O(V + E) with no heap.

## When to use it

- The cheapest or fastest route from one place to every other, over edges with costs. All costs zero or more means Dijkstra.
- Every step costs the same, or the question is "fewest hops": BFS.
- The statement allows negative weights (refunds, discounts), or asks whether a loop can keep gaining. Currency exchange fits: with weight -log(rate), a product of rates becomes a sum, so a profitable loop is a negative cycle. Bellman-Ford.
- "At most `k` stops" means `k + 1` edges: `k + 1` rounds, each reading a copy of the last round's distances so it can't use two new edges.
- Only a negative cycle reachable from the source is noticed. To find one anywhere, start every vertex at 0. An undirected negative edge is itself a negative cycle, since it's two directed edges.

## Walkthrough

```python region=graph

```

```typescript region=graph

```

Python has `heapq`; JavaScript has no built-in heap, so the TypeScript imports the [heap](/dsa/heap) entry's `MinHeap`, whose items are number arrays ordered like Python tuples: `push([cost, vertex])`.

```python region=dijkstra

```

```typescript region=dijkstra

```

To rebuild a route, record `parent[v] = u` where `dist[v]` drops. For one target, stop when it pops: its cost is final.

```python region=bellman-ford

```

```typescript region=bellman-ford

```

Bellman-Ford takes `n` rounds, not `n - 1`, so the last is the check. It returns after the first round that changes nothing (round 3 here), so only a negative cycle reaches the end of the loop. A negative cycle among vertices the source can't reach is never reported. Use a real infinity: a sentinel like `10**9` gets relaxed down by negative edges and makes an unreachable vertex look reachable.

## Complexity

- **Dijkstra: O((V + E) log V) time, O(V + E) space.** Each vertex is scanned once. A push follows a successful relaxation, at most one per edge plus the source's entry, so there are at most E + 1 pushes and pops, each O(log V) (E is at most V squared). The lazy heap holds up to E + 1 entries.
- **Bellman-Ford: O(V · (V + E)) time, O(V) space.** A round touches every vertex and edge once, and there are at most V rounds: O(V · E) when edges outnumber vertices, slow once both are large.

## Pitfalls

- **Skipping the stale check** (`if d > dist[u]: continue`). The distances stay right, but the example rescans vertices 1 and 3.
- **`<=` in the relaxation.** Two vertices joined by zero-weight edges both ways push each other forever.
- **The vertex first in the heap entry.** The heap orders by the first field, so `(v, d + w)` pops by vertex number. Distances stay right, since rescans repair them, but the cheapest-first order and its bound are gone: the example scans 5 vertices instead of 4, and 50 random graphs of 300 vertices and 2,000 edges averaged about 1,190 scans against 300. Cost goes first.
- **Stopping after `n - 1` rounds.** A graph with a negative cycle then returns distances that look fine but mean nothing. Round `n` is the check.
