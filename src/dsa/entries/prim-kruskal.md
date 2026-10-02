---
title: Prim and Kruskal
summary: Connecting every vertex of a weighted graph as cheaply as possible, by repeatedly taking the cheapest edge that joins two separate parts, either across the whole graph (Kruskal) or out of one growing tree (Prim).
date: 2026-10-01
kind: algorithm
---

Suppose you must lay cable between a set of towns so that every town can reach
every other, and each possible link has a price. You want the cheapest set of
links that still connects everything. A graph with **vertices** (the towns) and
**edges** (the possible links, each with a **weight**, its price) is exactly
that, and the cheapest connecting set is a **minimum spanning tree** (MST):
a subset of the edges that touches every vertex, contains no cycle, and has the
smallest total weight possible. A graph with n vertices needs exactly n - 1
edges to connect them without a cycle, so that is the size of every spanning
tree. This entry covers the two classic ways to find one, **Kruskal's** and
**Prim's** algorithm. Both are greedy, and the interesting part is why that
works.

The graphs here are **undirected** (an edge works in both directions), have
integer vertices numbered 0 to n - 1, and arrive as a list of `(u, v, weight)`
triples.

## Prerequisites

- [Union-Find](/dsa/union-find): Kruskal asks "are these two vertices already
  connected?" for every edge, and union-find answers it in nearly constant
  time. The code below inlines a small version of that structure with path
  halving and union by size.
- [Heap and Priority Queue](/dsa/heap): Prim always needs the cheapest edge
  among those leaving its tree, which is a pop from a min-heap.

## The idea

**Kruskal** thinks about all the edges at once. Sort them from cheapest to most
expensive and go down the list. Take an edge if its two ends are not yet
connected through the edges taken so far; skip it if they are, because it would
close a cycle. Stop at n - 1 edges. The partial result is a **forest** (several
separate trees) that merges into one tree as the walk goes on.

**Prim** grows a single tree. Start at any vertex. Look at every edge that
leaves the tree, meaning one end is inside it and the other outside, and add the
cheapest one along with its outside vertex. Repeat until every vertex is in.
A min-heap holds the candidate edges. The heap is **lazy**: when a vertex joins,
all its edges to outside vertices go in, and an edge is never removed when its
far end joins the tree some other way. Instead, when such a stale edge is popped
later, the code notices its far end is already inside and throws it away.

**Why taking the cheapest edge is safe.** A **cut** is a split of the vertices
into two non-empty groups, and an edge **crosses** the cut if its ends lie in
different groups. The **cut property**: if the edges chosen so far all lie in
some minimum spanning tree and none of them crosses a cut, then the chosen
edges plus the cheapest edge crossing that cut also lie in some minimum
spanning tree.

The argument is an exchange. Start from a minimum spanning tree `T` that holds
every chosen edge. If it already contains the cheapest crossing edge
`e = (a, b)`, there is nothing to do. Otherwise `T` connects `a` to `b`, so
adding `e` to `T` closes a cycle through `e`. That cycle starts on one side of
the cut and returns to it, so it crosses the cut at some second edge `f`. Since
`e` is the cheapest crossing edge, `f` weighs at least as much as `e`, and `f`
is not a chosen edge, because no chosen edge crosses the cut. Swap `f` out and
`e` in: the result is still connected, still has n - 1 edges, weighs no more
than `T`, and still holds every chosen edge. So the chosen edges plus `e` fit
in one minimum spanning tree, and the greedy step never rules out the best
answer. Both algorithms only ever add an edge that this
argument covers:

- Prim's cut is "the tree" against "everything else", and the edge it pops
  is the cheapest one leaving the tree.
- Kruskal's cut is "the component holding one end of the edge" against
  "everything else". Any cheaper edge leaving that component would have come
  earlier in the sorted list and already merged it, and no chosen edge leaves
  the component, so the cut property applies.

**A worked example.** Four vertices and five edges:
`(0,1,4)`, `(0,2,1)`, `(1,2,2)`, `(1,3,5)`, `(2,3,8)`.

Kruskal goes down the list sorted by weight:

| Edge    | Weight | Ends already connected? | Decision                    |
| ------- | ------ | ----------------------- | --------------------------- |
| `(0,2)` | 1      | no                      | take; total 1               |
| `(1,2)` | 2      | no                      | take; total 3               |
| `(0,1)` | 4      | yes, through 2          | skip, it would make a cycle |
| `(1,3)` | 5      | no                      | take; total 8, 3 edges      |

It stops at 3 edges, so `(2,3,8)` is never looked at. Prim starts at vertex 0:

| Pop (cost, from, to) | `to` in tree? | Decision                           | Tree after   |
| -------------------- | ------------- | ---------------------------------- | ------------ |
| `(1, 0, 2)`          | no            | take; push `(2,2,1)` and `(8,2,3)` | {0, 2}       |
| `(2, 2, 1)`          | no            | take; push `(5,1,3)`               | {0, 2, 1}    |
| `(4, 0, 1)`          | yes           | stale, skip                        | {0, 2, 1}    |
| `(5, 1, 3)`          | no            | take; 3 edges, stop                | {0, 2, 1, 3} |

(The heap starts with `(1,0,2)` and `(4,0,1)`, the two edges out of vertex 0;
the table lists pops in order.) Both end with edges of weights 1, 2 and 5, a
total of 1 + 2 + 5 = 8, and the same three edges: `(0,2)`, `(1,2)` and `(1,3)`.
The skipped edges, `(0,1,4)` and `(2,3,8)`, are the ones that would close a
cycle. The first cut Prim faces is `{0}` against `{1, 2, 3}`, crossed by
`(0,1,4)` and `(0,2,1)`, so by the cut property the weight-1 edge is safe.

## When to use it

Use a minimum spanning tree when the job is to connect everything at the lowest
total cost: network cabling, road or pipe layout, or clustering points by
repeatedly merging the closest groups (stopping Kruskal early gives clusters).
It is not a shortest-path tool. The MST minimizes the total weight of the
tree, and the path between two vertices inside it can be much longer than the
best path in the graph. For shortest paths from a source, see
[Dijkstra](/dsa/dijkstra).

**Ties don't matter for the total.** When several edges have the same weight,
the tree can differ depending on which one wins, but every MST has the same
total weight. If all weights are distinct the MST is unique. The tests compare
totals, not edge lists, for this reason.

**Negative weights are fine.** Both algorithms only compare weights with each
other; they never add weights up while deciding. A negative edge is just a
cheap edge. This differs from Dijkstra, which breaks on negative weights. The
negative-weight tests below include a graph whose answer is -14.

**Which to pick.** Kruskal works from a plain list of edges, needs no adjacency
lists, and its sort is the cost; it suits sparse graphs and cases where the
edges are already sorted or you want the cheapest few. Prim needs an adjacency
list but never sorts all the edges: the heap holds only edges out of the current
tree, so it suits graphs already stored as adjacency lists, and it can start
from any vertex. For most inputs both are fast enough that the choice is about
what shape your data already has.

**If the graph is not connected**, no spanning tree exists, and both functions
here return `None` (`null` in TypeScript). Kruskal gets there because it ends
with fewer than n - 1 edges. Prim gets there because it only reaches the
vertices connected to `start`, so it also ends short. Neither returns a forest
of one tree per component. With 0 or 1 vertices the answer is the empty list,
since no edges are needed.

## Walkthrough

```python
import heapq
from collections.abc import Iterable

Edge = tuple[int, int, int]  # (u, v, weight); undirected, vertices are 0..n-1
```

```typescript
/** An undirected weighted edge: [u, v, weight], with vertices numbered 0..n-1. */
export type Edge = [u: number, v: number, weight: number];

/** A binary min-heap on an array: `less(a, b)` says a belongs nearer the root. */
class MinHeap<T> {
  private readonly items: T[] = [];

  constructor(private readonly less: (a: T, b: T) => boolean) {}

  get size(): number {
    return this.items.length;
  }

  push(item: T): void {
    const items = this.items;
    items.push(item);
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.less(items[i], items[parent])) break;
      [items[i], items[parent]] = [items[parent], items[i]];
      i = parent;
    }
  }

  /** Removes and returns the root. The heap must not be empty. */
  pop(): T {
    const items = this.items;
    const top = items[0];
    const last = items.pop()!;
    if (items.length > 0) {
      items[0] = last;
      let i = 0;
      for (;;) {
        let smallest = i;
        const left = 2 * i + 1;
        const right = left + 1;
        if (left < items.length && this.less(items[left], items[smallest]))
          smallest = left;
        if (right < items.length && this.less(items[right], items[smallest])) {
          smallest = right;
        }
        if (smallest === i) break;
        [items[i], items[smallest]] = [items[smallest], items[i]];
        i = smallest;
      }
    }
    return top;
  }
}
```

Python ships a heap in `heapq`, so only the edge type is needed. It compares
tuples element by element, which is why the heap entries later are laid out
as `(weight, from, to)` with the weight first: the smallest weight comes out
first, and ties fall back to the vertex numbers, which is harmless. JavaScript
has no heap in its standard library, so the TypeScript file carries a small one
whose `less` function says which of two items belongs nearer the top. Prim
passes a comparison on the weight only. The array holds the tree with
the children of index `i` at `2i + 1` and `2i + 2`, as the Heap entry shows.

```python


def kruskal(n: int, edges: Iterable[Edge]) -> list[Edge] | None:
    """A minimum spanning tree as a list of edges, or None if disconnected."""
    parent = list(range(n))
    size = [1] * n

    def find(x: int) -> int:
        while parent[x] != x:
            parent[x] = parent[parent[x]]  # path halving
            x = parent[x]
        return x
```

```typescript
/** A minimum spanning tree as a list of edges, or null if the graph is disconnected. */
export function kruskal(n: number, edges: Iterable<Edge>): Edge[] | null {
  const parent = Array.from({ length: n }, (_, i) => i);
  const size = new Array<number>(n).fill(1);

  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]]; // path halving
      x = parent[x];
    }
    return x;
  };
```

This is the union-find from the previous entry, shrunk to two arrays inside the
function. Every vertex starts as its own root. `find` walks up to the root and,
on the way, points each visited vertex at its grandparent (**path halving**),
which keeps the trees shallow. Without that and the size rule below, a chain of
unions can build a tree n deep, and each `find` then costs O(n) instead of
nearly constant. A set of components here is just a set of vertices already
joined by chosen edges.

```python
    chosen: list[Edge] = []
    for u, v, w in sorted(edges, key=lambda e: e[2]):
        root_u, root_v = find(u), find(v)
        if root_u == root_v:
            continue
        if size[root_u] < size[root_v]:
            root_u, root_v = root_v, root_u
        parent[root_v] = root_u
        size[root_u] += size[root_v]
        chosen.append((u, v, w))
        if len(chosen) == n - 1:
            break
    return chosen if len(chosen) == max(n - 1, 0) else None
```

```typescript
  const chosen: Edge[] = [];
  for (const edge of [...edges].sort((a, b) => a[2] - b[2])) {
    let rootU = find(edge[0]);
    let rootV = find(edge[1]);
    if (rootU === rootV) continue;
    if (size[rootU] < size[rootV]) [rootU, rootV] = [rootV, rootU];
    parent[rootV] = rootU;
    size[rootU] += size[rootV];
    chosen.push(edge);
    if (chosen.length === n - 1) break;
  }
  return chosen.length === Math.max(n - 1, 0) ? chosen : null;
}
```

The sort is by weight alone, and `sorted` and the spread-then-`sort` both work
on a copy, so the caller's list is not reordered. The check compares the
**roots**, not `u` and `v` themselves: two vertices are connected when their
roots match, and comparing the raw vertex numbers would miss that vertices 0
and 1 are linked through 2. A self-loop `(v, v, w)` has equal roots, so it is
skipped like any cycle-closing edge, whatever its weight. The smaller tree
hangs under the larger root so trees stay shallow. The early `break` stops
at n - 1 edges, since a spanning tree has no room for more. The last line
returns `None` when the sorted list ran out first, which means some vertices
were never joined: the graph is disconnected. `max(n - 1, 0)` is there so
that `n = 0` expects zero edges rather than -1. (In TypeScript, the default
`sort` compares as strings, so the comparator `a[2] - b[2]` is required for
numbers, and negative weights work with it.)

```python
def prim(n: int, edges: Iterable[Edge], start: int = 0) -> list[Edge] | None:
    """A minimum spanning tree grown from `start`, or None if disconnected."""
    if n == 0:
        return []
    adjacent: list[list[tuple[int, int, int]]] = [[] for _ in range(n)]
    for u, v, w in edges:
        adjacent[u].append((w, u, v))
        adjacent[v].append((w, v, u))
```

```typescript
/** A minimum spanning tree grown from `start`, or null if the graph is disconnected. */
export function prim(n: number, edges: Iterable<Edge>, start = 0): Edge[] | null {
  if (n === 0) return [];
  const adjacent: Edge[][] = Array.from({ length: n }, () => []);
  for (const [u, v, w] of edges) {
    adjacent[u].push([u, v, w]);
    adjacent[v].push([v, u, w]);
  }
```

Prim needs to ask "which edges leave this vertex?", so the edge list becomes an
**adjacency list**: for each vertex, the edges that touch it. The graph is
undirected, so each edge is stored twice, once from each end, with the weight
first in Python so the heap orders by it. Forgetting the second line makes
the graph directed and Prim then reaches only the vertices you can walk to along
the stored direction. The `n == 0` guard exists because `adjacent[start]` below
would not exist.

```python

    in_tree = [False] * n
    in_tree[start] = True
    heap = list(adjacent[start])
    heapq.heapify(heap)
    chosen: list[Edge] = []
    while heap and len(chosen) < n - 1:
        w, u, v = heapq.heappop(heap)
        if in_tree[v]:
            continue  # a cheaper edge already brought v in
        in_tree[v] = True
        chosen.append((u, v, w))
        for entry in adjacent[v]:
            if not in_tree[entry[2]]:
                heapq.heappush(heap, entry)
    return chosen if len(chosen) == n - 1 else None
```

```typescript

  const inTree = new Array<boolean>(n).fill(false);
  inTree[start] = true;
  const heap = new MinHeap<Edge>((a, b) => a[2] < b[2]);
  for (const edge of adjacent[start]) heap.push(edge);
  const chosen: Edge[] = [];
  while (heap.size > 0 && chosen.length < n - 1) {
    const edge = heap.pop();
    const v = edge[1];
    if (inTree[v]) continue; // a cheaper edge already brought v in
    inTree[v] = true;
    chosen.push(edge);
    for (const next of adjacent[v]) {
      if (!inTree[next[1]]) heap.push(next);
    }
  }
  return chosen.length === n - 1 ? chosen : null;
}
```

The heap starts as the edges out of `start`. Each pop is the cheapest edge
leaving the tree, unless it is stale. The `if in_tree[v]` line is the lazy part:
a vertex can have several edges in the heap, from different tree vertices, and
the cheapest one is popped first and brings it in. The others are still in the
heap, and when they are popped `v` is already inside. Without this check Prim
would add `v` a second time, putting a cycle into the answer and counting `v`
twice toward n - 1, so it would stop before the tree is complete. In the worked
example `(4, 0, 1)` is exactly this case. Only edges to outside vertices are
pushed, which keeps the heap small, and the loop stops at n - 1 edges, so the
leftover edge `(8, 2, 3)` is never popped. If the heap empties first, the
vertices not yet reached are unreachable from `start`, and the last line returns
`None`. The edges come out oriented from the tree vertex to the new one, so
Prim may report `(2, 1, 2)` where Kruskal reports `(1, 2, 2)`; the same edge.

```python


def total_weight(tree: Iterable[Edge]) -> int:
    return sum(w for _, _, w in tree)
```

```typescript
export function totalWeight(tree: Iterable<Edge>): number {
  let total = 0;
  for (const [, , w] of tree) total += w;
  return total;
}
```

The total weight is the one number that is the same for every correct answer,
whichever algorithm, tie-break or start vertex produced it, which is why the
tests compare it rather than the edge lists. Python's `sum` and the TypeScript
loop do the same job.

## Complexity

Let V be the number of vertices and E the number of edges.

**Kruskal** sorts E edges in O(E log E). With no parallel edges, E is at most
about V², so log E is at most about 2 log V, and the sort is O(E log V) as well.
The loop then does E iterations of two `find` calls and at most one union;
with path halving and union by size each costs close to constant time (the
exact bound is the inverse Ackermann function, which stays below 5 for any
input that fits in memory), so the loop is dominated by the sort. Space is
O(V + E): the two arrays of size V, and the sorted copy of the edges.

**Prim** pushes each stored edge entry at most once, when the vertex it leaves
joins the tree, so there are at most 2E pushes and 2E pops. Each is O(log E),
for O(E log E) total; with no parallel edges that is O(E log V) by the same
argument as for Kruskal. Space is
O(V + E): the adjacency list holds 2E entries and the heap never holds more.

With a similar worst case, the choice comes down to the input's shape, as above.

## Pitfalls

- **Comparing `u` and `v` instead of their roots in Kruskal.** Two vertices are
  connected if they share a root, not only if an edge joins them directly.
  Checking raw vertex numbers lets an edge close a cycle and the result is not
  a tree.
- **Skipping the stale check in Prim.** Without `if in_tree[v]` a vertex is
  added again each time one of its edges is popped, and the tree has a cycle
  and the wrong edge count.
- **Storing each edge once in Prim.** The graph is undirected, so both
  directions go in the adjacency list. With one direction only, vertices that
  can't be reached from `start` along the stored direction are missed and the
  function returns `None` for a graph that is connected.
- **Expecting a forest on a disconnected graph.** These functions return `None`.
  A minimum spanning forest, one tree per component, needs a variant: Kruskal
  without the final length check already produces one, since it simply stops
  when the edges run out.
- **Confusing it with Dijkstra.** The heap in Prim holds the weight of a single
  edge, not the total distance from the start. Using the distance instead
  computes shortest paths, a different tree whose total weight is usually larger.
- **Comparing edge lists in tests.** With ties, or with Prim's orientation,
  correct answers differ in which edges they pick or in which end comes first.
  Compare the total weight and check that the edges form a spanning tree.
- **Assuming a unique answer.** An MST is unique only when all weights are
  distinct; a square with four equal sides has several.
