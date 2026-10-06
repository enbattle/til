---
title: Minimum Spanning Trees
summary: Connecting every vertex of a weighted graph at the lowest total cost, by repeatedly taking the cheapest edge that joins two parts not yet connected.
date: 2026-10-05
kind: algorithm
---

Four towns, five possible cable links, each with a price: connect every town to every other as cheaply as you can. The cheapest set of links is a **minimum spanning tree** (MST): edges that touch every vertex, contain no cycle and weigh the least, which for `n` vertices means exactly `n - 1` edges. Kruskal's and Prim's each build one.

## Prerequisites

- [Graph](/dsa/graph): the input is an undirected weighted graph, a list of `(u, v, weight)` edges that Prim turns into an adjacency list.
- [Union-find](/dsa/union-find): Kruskal asks "are these two already connected?" for every edge.
- [Heap](/dsa/heap): Prim pops the cheapest edge leaving its tree.

## The idea

Both algorithms are [greedy](/dsa/greedy): take the cheapest allowed edge and never reconsider. Greedy often fails, so why is it safe here?

Split the vertices into two non-empty groups, a **cut**. The **cut property** says that if none of the edges you've chosen cross it, the cheapest edge crossing it belongs to some MST that also contains every edge you've chosen. To see why, start from such an MST that lacks that edge `e`, and add `e`. It closes a cycle, and a cycle that crosses the cut once must cross it again, on some other edge `f`. `f` costs at least as much as `e`, because `e` was the cheapest crossing, and it isn't one you've chosen, because none of those cross. Swapping `f` out for `e` leaves a tree that weighs no more and keeps everything you chose. Taking `e` never costs you the best answer, so the only question each step is which cut you're looking across.

Take towns `0` to `3` with links `(0,1,4)`, `(0,2,1)`, `(1,2,2)`, `(1,3,5)`, `(2,3,8)`. The cut `{0}` against the rest is crossed by `(0,1,4)` and `(0,2,1)`, so the weight-1 link is safe. The algorithms differ in which cut they use.

**Kruskal** sorts all the edges by weight and goes down the list, taking an edge unless its ends are already connected, since it would close a cycle. Its cut is the group holding one end of the edge against everything else: anything cheaper leaving that group came earlier and would already have joined it.

| Edge    | Weight | Ends already connected? | Decision                   |
| ------- | ------ | ----------------------- | -------------------------- |
| `(0,2)` | 1      | no                      | take, total 1              |
| `(1,2)` | 2      | no                      | take, total 3              |
| `(0,1)` | 4      | yes, through 2          | skip                       |
| `(1,3)` | 5      | no                      | take, total 8, three edges |

It stops at three edges, so `(2,3,8)` is never looked at.

**Prim** grows one tree from vertex 0. Its cut is the tree against everything else, and a min-heap holds the edges leaving the tree as `(weight, from, to)`. The heap is **lazy**: nothing is removed when a far end joins by another route, and that stale edge is skipped when popped.

| Pop         | `to` in tree? | Decision          | Pushed after         | Tree         |
| ----------- | ------------- | ----------------- | -------------------- | ------------ |
| `(1, 0, 2)` | no            | take              | `(2,2,1)`, `(8,2,3)` | {0, 2}       |
| `(2, 2, 1)` | no            | take              | `(5,1,3)`            | {0, 2, 1}    |
| `(4, 0, 1)` | yes           | stale, skip       |                      | {0, 2, 1}    |
| `(5, 1, 3)` | no            | take, three edges |                      | {0, 2, 1, 3} |

The heap starts with `(1,0,2)` and `(4,0,1)`. Both end with weights 1, 2 and 5, total 8; `(2,3,8)` is never popped.

## When to use it

- The task is to connect everything at the lowest total cost: cabling, roads, "the cheapest way to connect all the points". The answer is a total, not a route.
- Clustering by merging the closest groups: stop Kruskal early and the components are the clusters.
- It isn't a shortest-path tool. The tree minimizes the total, and the path between two vertices inside it can be far longer than the best path in the graph; for routes from a source, see [shortest paths](/dsa/shortest-paths).
- Weights can be negative, because the algorithms only compare them. Ties can change which tree you get but not its total.
- A disconnected graph has no spanning tree, so both functions return `None` (`null`). Kruskal without its final length check returns a minimum spanning forest.

Which one? Kruskal takes a plain edge list and pays for a sort. Prim needs an adjacency list and never sorts. Use whichever matches the shape your data is already in.

## Walkthrough

Python has `heapq`, so it needs only the edge type. JavaScript has no heap, so the TypeScript carries the [heap entry's](/dsa/heap) `MinHeap`, trimmed.

```python
import heapq
from collections.abc import Iterable

Edge = tuple[int, int, int]  # (u, v, weight); undirected, vertices are 0..n-1
```

```typescript
/** An undirected weighted edge: [u, v, weight], with vertices numbered 0..n-1. */
export type Edge = [u: number, v: number, weight: number];

/** heap.ts's MinHeap without heapify, peek or empty checks: test `size` first. */
class MinHeap<T> {
  private readonly items: T[] = [];

  constructor(private readonly less: (a: T, b: T) => boolean) {}

  get size(): number {
    return this.items.length;
  }

  push(item: T): void {
    const a = this.items;
    a.push(item);
    for (let i = a.length - 1; i > 0;) {
      const parent = (i - 1) >> 1;
      if (!this.less(a[i], a[parent])) return;
      [a[i], a[parent]] = [a[parent], a[i]];
      i = parent;
    }
  }

  pop(): T {
    const a = this.items;
    const top = a[0];
    const last = a.pop() as T;
    if (a.length === 0) return top; // a[0] = last would refill the emptied array
    a[0] = last;
    for (let i = 0, c = 1; c < a.length; c = 2 * i + 1) {
      if (c + 1 < a.length && this.less(a[c + 1], a[c])) c++; // the smaller child
      if (!this.less(a[c], a[i])) break;
      [a[i], a[c]] = [a[c], a[i]];
      i = c;
    }
    return top;
  }
}
```

Kruskal first. It's the [union-find](/dsa/union-find) entry's structure on bare arrays, except `find` uses path halving: one pass that points every other node on the path at its grandparent, instead of that entry's two-pass compression.

```python
def kruskal(n: int, edges: Iterable[Edge]) -> list[Edge] | None:
    """A minimum spanning tree as a list of edges, or None if disconnected."""
    parent = list(range(n))
    size = [1] * n

    def find(x: int) -> int:
        while parent[x] != x:
            parent[x] = parent[parent[x]]  # halving: point at the grandparent
            x = parent[x]
        return x

    chosen: list[Edge] = []
    for u, v, w in sorted(edges, key=lambda e: e[2]):
        root_u, root_v = find(u), find(v)
        # Roots, not u and v: 0 and 1 can already be linked through 2.
        if root_u == root_v:
            continue
        if size[root_u] < size[root_v]:
            root_u, root_v = root_v, root_u  # smaller under larger: shallow trees
        parent[root_v] = root_u
        size[root_u] += size[root_v]
        chosen.append((u, v, w))
        # A tree has no room for more, and every edge left would close a cycle.
        if len(chosen) == n - 1:
            break
    return chosen if len(chosen) == max(n - 1, 0) else None
```

```typescript
/** A minimum spanning tree as a list of edges, or null if disconnected. */
export function kruskal(n: number, edges: Iterable<Edge>): Edge[] | null {
  const parent = Array.from({ length: n }, (_, i) => i);
  const size = new Array<number>(n).fill(1);

  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]]; // halving: point at the grandparent
      x = parent[x];
    }
    return x;
  };

  const chosen: Edge[] = [];
  for (const edge of [...edges].sort((a, b) => a[2] - b[2])) {
    let rootU = find(edge[0]);
    let rootV = find(edge[1]);
    // Roots, not u and v: 0 and 1 can already be linked through 2.
    if (rootU === rootV) continue;
    if (size[rootU] < size[rootV]) [rootU, rootV] = [rootV, rootU]; // shallow trees
    parent[rootV] = rootU;
    size[rootU] += size[rootV];
    chosen.push(edge);
    // A tree has no room for more, and every edge left would close a cycle.
    if (chosen.length === n - 1) break;
  }
  return chosen.length === Math.max(n - 1, 0) ? chosen : null;
}
```

The loop is the table above; the early `break` is why `(2,3,8)` was never looked at.

```python
def prim(n: int, edges: Iterable[Edge]) -> list[Edge] | None:
    """A minimum spanning tree grown from vertex 0, or None if disconnected."""
    if n == 0:  # adjacent[0] below would not exist
        return []
    adjacent: list[list[tuple[int, int, int]]] = [[] for _ in range(n)]
    for u, v, w in edges:
        # Weight first, so the heap orders by it. Both ends: an edge stored
        # once is a one-way street, and Prim would miss vertices behind it.
        adjacent[u].append((w, u, v))
        adjacent[v].append((w, v, u))
```

```typescript
/** A minimum spanning tree grown from vertex 0, or null if disconnected. */
export function prim(n: number, edges: Iterable<Edge>): Edge[] | null {
  if (n === 0) return []; // adjacent[0] below would not exist
  const adjacent: Edge[][] = Array.from({ length: n }, () => []);
  for (const [u, v, w] of edges) {
    // Both ends: an edge stored once is a one-way street, and Prim would
    // miss vertices behind it.
    adjacent[u].push([u, v, w]);
    adjacent[v].push([v, u, w]);
  }
```

Prim needs "which edges leave this vertex?", so the edge list becomes an adjacency list.

```python
    in_tree = [False] * n
    in_tree[0] = True
    heap = list(adjacent[0])
    heapq.heapify(heap)
    chosen: list[Edge] = []
    while heap and len(chosen) < n - 1:
        w, u, v = heapq.heappop(heap)
        # Stale: a cheaper edge already brought v in, and this one would
        # close a cycle. Edges are never removed from the heap, only skipped.
        if in_tree[v]:
            continue
        in_tree[v] = True
        chosen.append((u, v, w))
        for entry in adjacent[v]:
            if not in_tree[entry[2]]:  # an edge back into the tree is never used
                heapq.heappush(heap, entry)
    return chosen if len(chosen) == n - 1 else None
```

```typescript
  const inTree = new Array<boolean>(n).fill(false);
  inTree[0] = true;
  const heap = new MinHeap<Edge>((a, b) => a[2] < b[2]);
  for (const edge of adjacent[0]) heap.push(edge);
  const chosen: Edge[] = [];
  while (heap.size > 0 && chosen.length < n - 1) {
    const edge = heap.pop();
    const v = edge[1];
    // Stale: a cheaper edge already brought v in, and this one would
    // close a cycle. Edges are never removed from the heap, only skipped.
    if (inTree[v]) continue;
    inTree[v] = true;
    chosen.push(edge);
    for (const next of adjacent[v]) {
      if (!inTree[next[1]]) heap.push(next); // an edge back into the tree is never used
    }
  }
  return chosen.length === n - 1 ? chosen : null;
}
```

Each pop is the cheapest edge leaving the tree, unless it's stale, as `(4, 0, 1)` was. Edges come out oriented from the tree to the new vertex, so Prim reports `(2, 1, 2)` where Kruskal reports `(1, 2, 2)`: the same edge. If the heap empties early, the rest of the graph is unreachable from vertex 0.

## Complexity

Let V be the number of vertices and E the number of edges.

**Kruskal** sorts E edges in O(E log E), which is O(E log V) because, with no parallel edges, E is at most about V². Each of the E iterations does two `find` calls; with union by size and path halving each is nearly constant. Space is O(V + E) for `parent` and the sorted copy.

**Prim** pushes each adjacency entry at most once, when the vertex it leaves joins the tree, so there are at most 2E pushes and 2E pops, each O(log E). The total is O(E log E), or O(E log V). Space is O(V + E): the adjacency list holds 2E entries and the heap never holds more.

## Pitfalls

- **Skipping the root comparison in Kruskal.** `root_u == root_v` is the cycle test: 0 and 1 are connected through 2 even though no edge joins them. Without it, `(0,1,4)` is taken on the running example and the result is `(0,2,1)`, `(1,2,2)`, `(0,1,4)`: three edges, a cycle, and vertex 3 never reached.
- **Deleting the stale check in Prim.** Without `if in_tree[v]`, `(4,0,1)` is popped and vertex 1 is added a second time. The result is `(0,2,1)`, `(2,1,2)`, `(0,1,4)`: it stops at `n - 1` edges with a cycle in it, vertex 3 missing and a total of 7.
- **Storing each edge once in Prim.** The second `append` is what makes the graph undirected. Without it, an edge is visible only from the end listed first: vertex 2 joins first but never sees `(1,2,2)`, so Prim falls back on `(0,1,4)` and returns `(0,2,1)`, `(0,1,4)`, `(1,3,5)`, total 10 instead of 8.
- **Sorting without a weight key.** Python's plain `sorted(edges)` orders by `u` first, and TypeScript's plain `.sort()` compares the edges as text, which also starts with `u`. Kruskal then takes `(0,1,4)` first and returns `(0,1,4)`, `(0,2,1)`, `(1,3,5)`, total 10 instead of 8.
