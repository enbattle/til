---
title: Dijkstra's Algorithm
summary: Finding the cheapest route from one vertex to every other in a graph whose edges have non-negative costs, by always finalising the closest vertex not yet finalised, using a heap.
date: 2026-10-01
kind: algorithm
---

Dijkstra's algorithm answers "what is the cheapest way to get from here to
everywhere else?" when every edge has a cost (a weight) that is zero or more:
road lengths, travel times, prices. Where
[breadth-first search](/dsa/graph-bfs) counts edges, this adds up weights. The
trick is to always work on the closest vertex that is still undecided, and a
heap hands that vertex over in logarithmic time. This entry covers the
distances, the route itself, and why a single negative weight breaks the
method.

## Prerequisites

- [Graph Breadth-First Search](/dsa/graph-bfs): the same "explore outward from a
  source" loop, with a distance record and parent links for rebuilding a route.
  That entry also explains why BFS fails on weighted edges, which is the problem
  this one solves.
- [Heap and Priority Queue](/dsa/heap): the structure that removes the smallest
  item in O(log n). The TypeScript code carries a small heap of its own; Python
  uses the standard library's.

## The idea

A **weighted graph** here is a map from each vertex to a list of
`(neighbour, weight)` pairs, one per outgoing edge. The **cost** of a route is
the sum of its edge weights, and the **distance** to a vertex is the cost of
the cheapest route to it.

The algorithm keeps a best-known distance for every vertex it has found.
That number only ever goes down, and it can be too high until the vertex is
**settled**: declared final. Each round it takes the unsettled vertex with the
smallest best-known distance, settles it, and then **relaxes** each of its
edges: if reaching a neighbour through this vertex is cheaper than the best
distance known for that neighbour, lower it. That is the opposite of BFS's
rule. BFS fixes a vertex's distance the moment it is first found; here a
vertex found early can be undercut later, and only coming off the heap makes a
distance final.

Why is the smallest one safe to settle? Suppose vertex `v` has the smallest
best-known distance `d` among the unsettled vertices. Any cheaper route to `v`
would have to leave the settled region through some other unsettled vertex
first, and that vertex's distance is already at least `d`. Edges add zero or
more, so the route cannot come back down below `d`. This is the step that
needs non-negative weights.

**Lazy deletion.** Relaxing lowers a neighbour's distance, so the neighbour
should move up in the heap. A textbook heap with a "decrease-key" operation
does that, but it needs to find the neighbour's entry inside the heap, which
means tracking every entry's position as things move. The lazy version skips
all of it: when a distance improves, **push a new entry** `(distance, vertex)`
and leave the old, now too high, entry where it is. When an entry comes off the
heap whose distance is larger than the vertex's current best, it is **stale**,
a leftover from before an improvement, and is skipped. The cost is that the
heap can hold several entries per vertex, at most one per edge, which is a
small price for a few lines of code.

Here is a small directed graph, as an adjacency list. Vertex 4 has an edge into
3 but nothing leads to 4.

```text
0: [(1, 4), (2, 1)]    2: [(1, 2), (3, 5)]    4: [(3, 1)]
1: [(3, 1)]            3: []
```

Searching from vertex 0, the heap holds `(distance, vertex)` entries:

| Popped | Action                                | Heap afterwards     |
| ------ | ------------------------------------- | ------------------- |
| (0, 0) | settle 0; 1 gets 4, 2 gets 1          | (1,2), (4,1)        |
| (1, 2) | settle 2; 1 improves 4 to 3; 3 gets 6 | (3,1), (4,1), (6,3) |
| (3, 1) | settle 1; 3 improves 6 to 4           | (4,1), (4,3), (6,3) |
| (4, 1) | stale: 4 > dist[1] = 3, skip          | (4,3), (6,3)        |
| (4, 3) | settle 3; no outgoing edges           | (6,3)               |
| (6, 3) | stale: 6 > dist[3] = 4, skip          | (empty)             |

The distances are 0 for vertex 0, 3 for 1, 1 for 2 and 4 for 3. Vertex 4 was
never found, so it gets none. Vertex 1 was found first at cost 4 by the direct
edge and then at cost 3 by going through 2, and the 4 was never trusted
because 1 only came off the heap at 3.

**The route.** As in BFS, record each vertex's **parent**, the vertex whose edge
last lowered its distance. Following parents back from 3 gives 3, 1, 2, 0, and
reversing gives the route 0, 2, 1, 3, with cost 1 + 2 + 1 = 4.

**Negative edges.** Take three vertices with edges 0 to 1 of weight 2, 0 to 2
of weight 3 and 2 to 1 of weight -2. The true cheapest route to 1 is through 2,
at cost 3 - 2 = 1. The version that settles on first pop settles 1 at 2 (it is
the closest unsettled vertex, and the only route to it that the algorithm has
seen), then settles 2 at 3 and finds the improvement too late: the
"nothing can undercut `d`" argument assumed that edges never subtract. The code
below happens to repair this example, because it re-pushes any improvement, but
that rescue is accidental. It can re-process vertices many times, which loses the
time bound, and a cycle whose weights add up to less than zero lowers distances
forever. Graphs with negative edges need
[Bellman-Ford](/dsa/bellman-ford), which this entry does not cover.

## When to use it

Use it for cheapest routes in a graph with non-negative costs: road
navigation, network routing by latency, the cheapest sequence of moves when
each move has a price. One run from a source gives the distance to every
vertex, so it suits "from here to everywhere" questions and also a single
target. When every edge costs the same, plain
[BFS](/dsa/graph-bfs) is simpler and faster, O(V + E) with no heap. When
weights can be negative, it is the wrong tool.

## Walkthrough

```python
import heapq

Graph = dict[int, list[tuple[int, int]]]
```

```typescript
/** A binary min-heap on an array: `less(a, b)` says a belongs nearer the root. */
export class MinHeap<T> {
  private readonly items: T[] = [];
  private readonly less: (a: T, b: T) => boolean;

  constructor(less: (a: T, b: T) => boolean) {
    this.less = less;
  }

  get size(): number {
    return this.items.length;
  }

  push(item: T): void {
    this.items.push(item);
    this.siftUp(this.items.length - 1);
  }

  /** Removes and returns the root, or undefined if the heap is empty. */
  pop(): T | undefined {
    if (this.items.length === 0) return undefined;
    const top = this.items[0];
    const last = this.items.pop()!;
    if (this.items.length > 0) {
      this.items[0] = last;
      this.siftDown(0);
    }
    return top;
  }

  private siftUp(start: number): void {
    let i = start;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.less(this.items[i], this.items[parent])) return;
      [this.items[i], this.items[parent]] = [this.items[parent], this.items[i]];
      i = parent;
    }
  }

  private siftDown(start: number): void {
    const items = this.items;
    let i = start;
    for (;;) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = left + 1;
      if (left < items.length && this.less(items[left], items[smallest])) {
        smallest = left;
      }
      if (right < items.length && this.less(items[right], items[smallest])) {
        smallest = right;
      }
      if (smallest === i) return;
      [items[i], items[smallest]] = [items[smallest], items[i]];
      i = smallest;
    }
  }
}
```

Python ships a heap in `heapq`, which works on a plain list and always returns
the smallest item first. JavaScript has none, so the TypeScript version carries
a small one, built the way the [heap](/dsa/heap) entry describes. Its `less`
function says which of two items belongs nearer the root, so the same class
can order anything; here it will compare distances. Python needs no such
function because `heapq` compares the tuples `(distance, vertex)` itself, by
distance first. The `pop` here moves the last item to the root and sifts it
down, the usual way to remove the root without leaving a hole.

```python
def dijkstra(graph: Graph, source: int) -> tuple[dict[int, int], dict[int, int | None]]:
    """Cheapest cost from source to every vertex reachable from it, and each
    vertex's parent on a cheapest route. Edge weights must not be negative."""
    dist: dict[int, int] = {source: 0}
    parent: dict[int, int | None] = {source: None}
    heap = [(0, source)]
```

```typescript
/** Each vertex maps to its outgoing edges as [neighbour, weight] pairs. */
export type Graph = Map<number, [number, number][]>;

type Entry = [distance: number, vertex: number];

/**
 * Cheapest cost from `source` to every vertex reachable from it, and each
 * vertex's parent on a cheapest route. Edge weights must not be negative.
 */
export function dijkstra(
  graph: Graph,
  source: number,
): [Map<number, number>, Map<number, number | null>] {
  const dist = new Map<number, number>([[source, 0]]);
  const parent = new Map<number, number | null>([[source, null]]);
  const heap = new MinHeap<Entry>((a, b) => a[0] < b[0]);
  heap.push([0, source]);
```

`dist` holds the best-known distance, and a vertex is in it exactly when it has
been found, so there is no separate "seen" set and no value standing for
infinity. `parent` records how each vertex was reached; the source has `None`
(`null`), which is where the route-building loop stops. The heap starts with
the source at distance 0. The entry puts the distance first because that is
what the heap orders by: swapping to `(vertex, distance)` would hand back the
smallest vertex number, not the closest vertex, and give wrong answers without
any error. Vertices are numbers here so that tied distances in Python can fall
back to comparing them; vertices that cannot be compared would need a
tie-breaking counter in the tuple.

```python
    while heap:
        d, v = heapq.heappop(heap)
        if d > dist[v]:
            continue
```

```typescript
  while (heap.size > 0) {
    const [d, v] = heap.pop()!;
    if (d > dist.get(v)!) continue;
```

This is the lazy-deletion check. An entry whose distance `d` is larger than
`dist[v]` was pushed before a cheaper route to `v` turned up; that cheaper route
has its own entry, which came off the heap earlier because it was smaller. So
this entry is stale, and `continue` skips it. Without the check the code would
still produce correct distances, since a stale entry's higher cost never beats
anything, but it would scan the edges of `v` again for nothing. Because
a vertex is only pushed on a strict improvement, at most one of its entries
has `d == dist[v]`, so each vertex's edges are scanned once. Note the test is
`>`, not `!=`: no entry's distance can be below `dist[v]`, since `dist[v]` is
the lowest value ever pushed for it.

```python
        for w, weight in graph.get(v, []):
            nd = d + weight
            if w not in dist or nd < dist[w]:
                dist[w] = nd
                parent[w] = v
                heapq.heappush(heap, (nd, w))
    return dist, parent
```

```typescript
    for (const [w, weight] of graph.get(v) ?? []) {
      const nd = d + weight;
      const known = dist.get(w);
      if (known === undefined || nd < known) {
        dist.set(w, nd);
        parent.set(w, v);
        heap.push([nd, w]);
      }
    }
  }
  return [dist, parent];
}
```

This is the relaxation. `nd` is the cost of reaching the neighbour `w` through
`v`. If `w` has no distance yet, or `nd` is lower, record it, remember `v` as
its parent and push the new entry. The comparison is strict `<`. With `<=`,
a zero-weight edge back to a vertex whose distance already equals `nd` would
push another entry each time, and two vertices joined by zero-weight edges in
both directions would push each other forever. Strictness is also what keeps
the heap's size bounded: every push comes from a strict drop, so
the pushes are limited by the number of edges scanned. `graph.get(v, [])`
(`?? []` in TypeScript) treats a vertex with no entry as having no edges. The
pushed entry carries `nd`, the new distance, not `d`; pushing `d` would file
the neighbour under the wrong priority, and the vertices would no longer come
off in order of distance.

```python
def shortest_path(graph: Graph, source: int, target: int) -> list[int] | None:
    """A cheapest route from source to target as a list of vertices, or None."""
    _, parent = dijkstra(graph, source)
    if target not in parent:
        return None
    path: list[int] = []
    node: int | None = target
    while node is not None:
        path.append(node)
        node = parent[node]
    path.reverse()
    return path
```

```typescript
/** A cheapest route from `source` to `target` as a list of vertices, or null. */
export function shortestPath(
  graph: Graph,
  source: number,
  target: number,
): number[] | null {
  const [, parent] = dijkstra(graph, source);
  if (!parent.has(target)) return null;
  const path: number[] = [];
  let node: number | null = target;
  while (node !== null) {
    path.push(node);
    node = parent.get(node)!;
  }
  return path.reverse();
}
```

The route is rebuilt from the parent links exactly as in BFS: walk from the
target back to the source, then reverse. A target missing from `parent` was
never reached, so the answer is `None` (`null`), not an empty list, which would
read as a route of no vertices. The loop ends on `node is not None`, never
`while node`, since vertex 0 is a valid vertex and is falsy in Python. The
parents are safe to follow because each is set when the cheaper distance is
recorded, from a vertex that has just been settled; the chain therefore ends at
the source and cannot loop, even through zero-weight edges. This version runs the
whole search before building the route. Stopping as soon as the target comes off
the heap is a valid shortcut, since a settled distance is final, but it changes
`dijkstra`'s loop and is left out here.

## Complexity

With a binary heap the time is O((V + E) log V), where V is the number of
vertices and E the number of edges. Every vertex is settled once and its edge
list scanned once, which is O(V + E) work outside the heap. Each push comes from
a successful relaxation, and there is at most one per edge plus the starting
entry, so the heap sees at most E + 1 pushes and as many pops, each O(log(E + 1)).
That is O(log V) when E is at most V², that is, without huge numbers of parallel
edges. On the example above, 5 edges are scanned, there are 6 pushes and 6
pops, and 2 of the pops are stale. The space is O(V + E): the two maps hold at
most V entries, but the lazy heap can hold up to E + 1. A decrease-key heap
would keep it to V, in return for the position bookkeeping. Rebuilding a route
walks at most V parents.

## Pitfalls

- **Negative weights.** The settle step relies on edges never lowering a cost.
  On the three-vertex example, the settle-on-first-pop algorithm reports 2 for
  vertex 1 where the true cost is 1. The code here repairs that example
  by re-pushing, but loses the time bound, and a cycle with a negative total
  runs forever (checked: the code was still popping after 1,000 pops on
  `0 → 1 (1)`, `1 → 2 (-3)`, `2 → 1 (1)`). Use [Bellman-Ford](/dsa/bellman-ford).
- **Skipping the stale check.** The distances stay right, but each stale entry
  triggers a second scan of that vertex's edges, so the work is no longer bounded
  by the edges scanned once each.
- **Marking a vertex done when it is first pushed, as BFS does.** The first
  distance found is often not the cheapest: in the example, 1 is first found at
  4 and its true distance is 3. Distances are final only when popped.
- **`<=` in the relaxation.** Two vertices joined by zero-weight edges in both
  directions then re-push each other without end.
- **Pushing the old distance, or putting the vertex first in the heap entry.** The
  heap then orders by the wrong number and the algorithm silently returns
  wrong distances.
- **Reading the distance of an unreachable vertex.** It is missing from `dist`,
  so `dist[v]` raises `KeyError` in Python, and the TypeScript `Map` gives
  `undefined`. Check first, or treat missing as infinity.
- **Assuming the edges are undirected.** The adjacency list holds directed
  edges. For a two-way road, list the edge under both ends.
