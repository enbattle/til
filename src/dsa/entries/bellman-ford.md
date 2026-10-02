---
title: Bellman-Ford
summary: Shortest distances from one vertex when edge weights can be negative, by relaxing every edge V - 1 times, plus one more pass that detects a negative cycle.
date: 2026-10-01
kind: algorithm
---

Bellman-Ford finds the cheapest route from one starting vertex to every other
vertex in a weighted directed graph, and unlike
[Dijkstra's algorithm](/dsa/dijkstra) it still works when some edges have
negative weights: a refund, a discount, a downhill stretch that gives energy
back. The method is blunt. Go through every edge, lower any distance that the
edge improves, and repeat. It is slower than Dijkstra, and in return it can
also tell you when "cheapest" stops meaning anything because a loop of edges
adds up to less than nothing.

## Prerequisites

- [Dijkstra's Algorithm](/dsa/dijkstra), for relaxation (lowering a distance
  when a cheaper route turns up), for shortest distances in a graph with
  non-negative weights, and for the 3-vertex example showing why negative
  edges break its greedy choice. This entry reuses relaxation and replaces
  the heap.
- [Graph](/dsa/graph), for the vocabulary: vertices, directed and weighted
  edges, V for the number of vertices and E for the number of edges.

## The idea

The input here is an **edge list**: a list of `(u, v, weight)` triples, each a
directed edge from vertex `u` to vertex `v`, with vertices numbered 0 to
`n - 1`. The code keeps a `dist` list holding the cheapest known cost of
reaching each vertex from the source. It starts at 0 for the source and
infinity for everything else, meaning "no route found yet".

**Relaxing** an edge `(u, v, w)` asks whether going through `u` beats the
current route to `v`: if `dist[u] + w < dist[v]`, set `dist[v]` to
`dist[u] + w`. An edge out of a vertex still at infinity changes nothing,
because infinity plus any weight is infinity.

Dijkstra relaxes edges in a clever order so each vertex is final the first
time it is taken from the heap. A negative edge ruins that, since a vertex
taken early can still be undercut through a longer route that ends in a
negative edge. Bellman-Ford skips the cleverness: relax **every** edge, in
whatever order the list has them, and call that a **round**. Do `V - 1` rounds.

Why `V - 1` is enough. Suppose the cheapest route to some vertex has `k`
edges. Round 1 certainly gets the first edge of it right, because the source's
distance is already correct. Each later round fixes at least one more edge
along the route, as long as the earlier ones are right: in round `k` the edge
into the `k`-th vertex sees a correct distance for the vertex before it. So
after `k` rounds the distance is correct, however the edges are ordered; a
lucky order only gets there sooner. Now, a cheapest route never needs to
repeat a vertex. If the route went around a cycle, cutting the cycle out
leaves a route that is no more expensive, as long as the cycle's total weight
isn't negative. A route with no repeated vertex has at most `V - 1` edges, so
`V - 1` rounds finish the job.

That condition is the catch. If a cycle reachable from the source has a
negative total, going around it again always lowers the cost, so there is no
cheapest route: the distances of everything on or past the cycle can be pushed
down forever. After `V - 1` rounds that is detectable. If everything is
correct, one more round changes nothing. If some edge can still be relaxed,
the distances are still dropping, and that can only be because of a negative
cycle.

Here is a graph with 5 vertices, source 0, and the edges listed in the order
`(3,4,1)`, `(2,3,-2)`, `(1,2,3)`, `(0,1,4)`, `(0,2,10)`. The list is
deliberately backwards from the direction of travel, which is the worst case
for how many rounds are needed. The columns are `dist` for vertices 0 to 4:

| After round | `dist`           | What changed                                           |
| ----------- | ---------------- | ------------------------------------------------------ |
| start       | [0, ∞, ∞, ∞, ∞]  |                                                        |
| 1           | [0, 4, 10, ∞, ∞] | `(0,1)` gives 4; `(0,2)` gives 10                      |
| 2           | [0, 4, 7, 8, ∞]  | `(2,3)` gives 10 - 2 = 8; then `(1,2)` gives 4 + 3 = 7 |
| 3           | [0, 4, 7, 5, 9]  | `(3,4)` gives 8 + 1 = 9; then `(2,3)` gives 7 - 2 = 5  |
| 4           | [0, 4, 7, 5, 6]  | `(3,4)` gives 5 + 1 = 6                                |

The cheapest route to vertex 4 is 0 → 1 → 2 → 3 → 4, which has 4 edges, or
`V - 1`, and it costs 4 + 3 - 2 + 1 = 6. Each round advanced the correct
distances by one step along it. Round 5 would change nothing. The extra check
round after round 4 finds no edge to relax, so the function returns the
distances.

Now the same graph with the edges listed in travel order, `(0,1,4)`,
`(0,2,10)`, `(1,2,3)`, `(2,3,-2)`, `(3,4,1)`. Round 1 produces
[0, 4, 7, 5, 6] straight away, because each edge sees the distance its
predecessor just settled. Round 2 changes nothing, so there is no reason to
run rounds 3 and 4: that is the early stop.

For the negative cycle, take 3 vertices and the edges `(0,1,1)`, `(1,2,-3)`,
`(2,1,1)`. The loop 1 → 2 → 1 costs -3 + 1 = -2 each time around. Round 1
gives vertex 1 the value 1, then vertex 2 the value 1 - 3 = -2, then relaxing
`(2,1)` lowers vertex 1 to -2 + 1 = -1, so `dist` = [0, -1, -2]. Round 2 (the last, since `V - 1 = 2`) gives
[0, -3, -4]: vertex 2 drops to -1 - 3 = -4, then vertex 1 to -4 + 1 = -3. In
the check round `(1,2,-3)` would give -6, below -4, so the function reports a
negative cycle.

## When to use it

Use it when edges can be negative: shortest paths where some steps give
something back, or currency exchange, where taking logarithms turns a product
of rates into a sum and a profitable loop becomes a negative cycle. It is also
the tool when the question itself is "is there a negative cycle?". Without
negative edges, use [Dijkstra's algorithm](/dsa/dijkstra); it does the same
job much faster. It is also a good fit when the graph arrives as a plain list
of edges, since the algorithm never needs neighbour lookups. Distance-vector
routing protocols, where each router repeatedly improves its table of
distances from what its neighbours report, work on the same relaxation idea.

Its size is the other limit: its cost is the product `V × E`, so a graph with
millions of edges and thousands of vertices is too slow, and a graph that is
dense in edges even more so.

Only cycles reachable from the source matter. Vertices the source can't reach
stay at infinity throughout, so a negative cycle among them is never relaxed
and never noticed. If you need to find any negative cycle in the graph, not
just one the source can reach, a common trick is to start every vertex at 0
instead of only the source.

## Walkthrough

```python
import math

Edge = tuple[int, int, float]


def bellman_ford(n: int, edges: list[Edge], source: int) -> list[float] | None:
    """Shortest distances from source over directed (u, v, weight) edges.

    Vertices are 0 to n - 1. Unreachable vertices get math.inf. Returns None
    if a negative cycle is reachable from source, since distances are then
    undefined.
    """
    if not 0 <= source < n:
        raise ValueError("source must be a vertex from 0 to n - 1")
```

```typescript
/** A directed edge from vertex u to vertex v with a weight, as [u, v, weight]. */
export type Edge = [u: number, v: number, weight: number];

/**
 * Shortest distances from `source` over directed edges, vertices 0 to n - 1.
 * Unreachable vertices get Infinity. Returns null if a negative cycle is
 * reachable from `source`, since distances are then undefined.
 */
export function bellmanFord(n: number, edges: Edge[], source: number): number[] | null {
  if (!Number.isInteger(source) || source < 0 || source >= n) {
    throw new RangeError('source must be a vertex from 0 to n - 1');
  }
```

The result has two shapes on purpose: a list of distances, or `None` / `null`
when a negative cycle is reachable. The alternative, returning distances
anyway, would hand back numbers that depend on how many rounds happened to
run, and a caller who forgot to check a separate flag would use them as if
they meant something. A `None` can't be mistaken for an answer. The
guard on `source` is needed because `dist[source] = 0` in Python with a source
of `-1` would quietly set the last vertex, and with `n = 0` there is no vertex
to start from at all.

```python
    dist = [math.inf] * n
    dist[source] = 0
    for _ in range(n - 1):
        changed = False
        for u, v, w in edges:
            if dist[u] + w < dist[v]:
                dist[v] = dist[u] + w
                changed = True
```

```typescript
  const dist: number[] = new Array<number>(n).fill(Infinity);
  dist[source] = 0;
  for (let round = 0; round < n - 1; round++) {
    let changed = false;
    for (const [u, v, w] of edges) {
      if (dist[u] + w < dist[v]) {
        dist[v] = dist[u] + w;
        changed = true;
      }
    }
```

Unreachable vertices start at infinity rather than at a large integer such as
`10**9`, because infinity is the one value that stays infinity when a weight
is added: `inf + w < dist[v]` is false for every `w`, so an edge out of a
vertex with no route yet is skipped without a special case. A big integer
would let a very negative edge pull an unreachable vertex below it and make it
look reachable. The comparison is strictly `<`, not `<=`: with `<=` an edge
that merely ties would count as a change, and every edge on a cheapest route
ties once its distance is settled (as does every edge between unreachable
vertices, since `inf + w <= inf`). So `changed` would stay true in every round,
the early stop would never fire, and the check pass would report a negative
cycle in almost any graph: `bellman_ford(2, [(0, 1, 5)], 0)` would return
`None`. The loop runs `n - 1` times
because of the bound above; `n - 2` would leave the last vertex of a
longest-possible route unfixed, as the 5-vertex table shows (vertex 4 only
reaches 6 in round 4). Edges are updated in place, so a later edge in the same
round already sees an earlier edge's new value; that only speeds things up and
never gives a wrong distance, since every `dist` value is the cost of some
real route.

```python
        if not changed:
            return dist
```

```typescript
    if (!changed) return dist;
  }
```

If a whole round improved nothing, every edge already satisfies
`dist[u] + w >= dist[v]`, and the next round would see the same numbers and
change nothing again, so no later round can do anything. A graph with a
reachable negative cycle can never reach this state, since some edge on the
cycle can always be relaxed once more. That is why returning `dist` here, with
no check round, is correct. Without the early stop the answer is the same;
only the running time suffers, because every graph pays the full `V - 1`
rounds even when the edges happen to be in a good order.

```python
    for u, v, w in edges:
        if dist[u] + w < dist[v]:
            return None
    return dist
```

```typescript
  for (const [u, v, w] of edges) {
    if (dist[u] + w < dist[v]) return null;
  }
  return dist;
}
```

Reaching this point means `V - 1` rounds all changed something. If there is no
negative cycle, the bound says the distances are final, so no edge can still
improve. So any edge that can improve is proof of a reachable negative cycle,
and only a relaxable edge with a finite `dist[u]` can pass the test, which is
what restricts the check to cycles the source can reach. This pass only looks;
it doesn't update `dist`, since a distance that falls forever has no final
value. A single vertex with a negative self-loop is the smallest case: `n - 1`
is 0 rounds, and the check pass finds `0 + (-1) < 0`.

## Complexity

Each round looks at every edge once, which is O(E), and there are at most
`V - 1` rounds plus the check pass, so the time is O(V × E). For a graph with
1,000 vertices and 5,000 edges that is up to 999 rounds plus the check pass,
1,000 passes of 5,000 edge checks, 5,000,000 in total. The early stop can cut
that to as little as 2 passes when the edges are in a good order, but it
doesn't change the worst case, which is the one to plan for. The space is O(V)
for `dist`; the edge list is the input and isn't copied.

## Pitfalls

- **Treating the result as distances without checking for `None`.** A graph
  with a reachable negative cycle gives `None` in Python and `null` in
  TypeScript. Indexing `None` raises an error, but `null` in a loose
  comparison can slip through quietly. Check for it before using the
  distances.
- **Expecting an undirected edge to work as one entry.** Edges here are
  directed. An undirected edge with a negative weight is itself a negative
  cycle (go across and back: 2 × a negative number), so for undirected graphs
  with a negative edge, Bellman-Ford reports a cycle whether or not the graph
  "really" has one in the problem's sense.
- **Using a large number instead of infinity.** A stand-in like `10**9` can be
  relaxed down by negative edges and make an unreachable vertex look reachable.
  `math.inf` and `Infinity` keep unreachable vertices at infinity.
- **Using `<=` in the relaxation.** Ties count as changes, and every edge of a
  cheapest route ties once settled, so `changed` stays true forever. The early
  stop never fires, and the check pass reports a negative cycle in essentially
  every graph with a reachable edge.
- **Expecting to catch every negative cycle.** Only cycles reachable from the
  source change `dist`. A negative cycle among vertices the source can't reach
  is ignored, and those vertices come back as infinity.
- **Out-of-range vertices in the edge list.** In Python a vertex of `-1`
  indexes the last element and quietly corrupts the result; in TypeScript
  `dist[u]` is `undefined`, and `undefined + w < ...` is always false, so the
  edge is silently skipped. The code trusts the edge list; validate it where
  it is built.
