---
title: Graph
summary: Points joined by connections, stored either as a list of neighbours per point or as a grid with a cell for every possible connection, and how to pick between the two.
date: 2026-10-01
kind: data-structure
---

A graph is the structure for anything made of things and the connections
between them: intersections joined by roads, people joined by friendships, web
pages joined by links, software packages joined by "depends on". Most graph
problems are about walking those connections, and how fast a walk can go
depends on how the graph is stored. This entry covers the storing: the two
standard layouts, what each operation costs in each, and how to choose. Walking
a graph, breadth-first and depth-first, comes in later entries that build on
this one.

## Prerequisites

- [Hash Map](/dsa/hash-map), for the adjacency list: it maps each vertex to
  its list of neighbours, so finding a vertex's list is O(1) on average.
- [Array and Dynamic Array](/dsa/dynamic-array), for the neighbour lists
  themselves (appending is amortized O(1), removing from the middle shifts the
  items after it) and for the rows of the adjacency matrix.

## What it is

A **graph** is a set of **vertices** (also called nodes) and a set of
**edges**, where each edge connects two vertices. Two vertices joined by an
edge are **neighbours**, or **adjacent**. A vertex can be anything that can
serve as a key: a number, a city name, a user ID. Two letters carry most of
the arithmetic below: **V** is the number of vertices and **E** the number of
edges.

Edges come in a few flavours:

- An **undirected** edge goes both ways. If Ada is friends with Bob, Bob is
  friends with Ada.
- A **directed** edge, often called an arc, goes one way: u → v. Following
  someone on a social network, a one-way street and "package A depends on
  package B" are directed. A graph is either directed or undirected as a whole.
- A **weighted** edge carries a number, such as a road's length in kilometres
  or a link's latency in milliseconds. An unweighted edge is just there or not.
- A **self-loop** connects a vertex to itself. Most graphs don't have them,
  but a state machine where a state can stay put does.

The **degree** of a vertex is its number of neighbours. In a directed graph
that splits into the **out-degree** (edges leaving it) and the **in-degree**
(edges arriving); this entry's `degree` is the out-degree.

There are two standard ways to store one. Take this undirected graph of four
vertices and four edges, 0–1, 0–2, 1–2 and 2–3:

```text
0 --- 1
 \   /
  \ /
   2 --- 3
```

An **adjacency list** gives each vertex a list of its neighbours. An undirected
edge u–v is stored twice, as v in u's list and u in v's:

```text
0: [1, 2]
1: [0, 2]
2: [0, 1, 3]
3: [2]
```

That is 8 entries for 4 edges: 2E, which is also the sum of the degrees,
2 + 2 + 3 + 1 = 8. An **adjacency matrix** is a V × V grid where the cell in
row u, column v is 1 if there's an edge from u to v and 0 if not:

```text
     0  1  2  3
0 [  0  1  1  0 ]
1 [  1  0  1  0 ]
2 [  1  1  0  1 ]
3 [  0  0  1  0 ]
```

Sixteen cells, eight of them 1. An undirected graph's matrix is symmetric
across the diagonal from top left to bottom right, because every edge sets two
cells. If the same four edges were directed (0 → 1, 0 → 2, 1 → 2, 2 → 3),
each would be stored once: the lists become `0: [1, 2]`, `1: [2]`, `2: [3]`,
`3: []`, 4 entries for 4 edges, and the matrix loses its symmetry.

For a weighted graph, each list entry becomes a pair, `(neighbour, weight)`,
and each matrix cell holds the weight. The matrix then needs a separate marker
for "no edge", such as infinity or `None`, because 0 can be a real weight: a
free transfer between two bus lines still exists.

How many edges a graph has compared with how many it could have decides which
layout wins. An undirected graph without self-loops has at most
V(V − 1) / 2 edges: 499,500 for 1,000 vertices. A graph with close to that
many is **dense**; one whose E is closer to V than to V² is **sparse**. Road
maps and social networks are sparse: an intersection meets a handful of roads,
however many intersections the country has.

## Operations and costs

The costs use big-O notation: O(1) means the work doesn't grow with the size
of the graph, and O(V) means it grows in proportion to the number of vertices.
deg(v) is the degree of v. The list's average figures assume the hash map
finds a vertex in O(1); its worst case, every vertex colliding in one bucket,
adds O(V) to each lookup. The matrix does no lookups, so its average and worst
cases are the same.

| Operation           | List, average      | List, worst | Matrix         |
| ------------------- | ------------------ | ----------- | -------------- |
| `add_vertex(v)`     | O(1) amortized     | O(V)        | rebuild: O(V²) |
| `add_edge(u, v)`    | O(deg(u))          | O(V)        | O(1)           |
| `remove_edge(u, v)` | O(deg(u) + deg(v)) | O(V)        | O(1)           |
| `has_edge(u, v)`    | O(deg(u))          | O(V)        | O(1)           |
| `neighbours(v)`     | O(deg(v))          | O(V)        | O(V)           |
| `degree(v)`         | O(1)               | O(V)        | O(V)           |
| Visit every edge    | O(V + E)           | O(V + E)    | O(V²)          |
| Space               | O(V + E)           | O(V + E)    | O(V²)          |

The list pays for an edge check by scanning one neighbour list, which is short
when the graph is sparse. The matrix answers it with one cell read, but pays
for every other question by scanning a whole row, since a row has V cells
whether the vertex has two neighbours or none. "Visit every edge" is what a
breadth-first or depth-first search does, so this row is the one that usually
decides.

Put numbers on it. A sparse graph of 1,000,000 vertices where each has about
10 neighbours has E = 5,000,000 undirected edges, so its adjacency lists hold
2E = 10,000,000 entries. With vertices numbered and stored as 4-byte integers
that is 40 MB, plus a little per vertex for the list itself. The matrix has
V² = 10¹² cells: a terabyte at one byte per cell, as in the code below, and
still 125 GB packed at one bit per cell. Visiting every edge takes about
V + 2E = 11 million steps with lists and 10¹² cell reads with the matrix.

Now a dense graph: 1,000 vertices and 400,000 of the 499,500 possible edges.
The lists hold 800,000 entries, 3.2 MB at 4 bytes each. The matrix has 10⁶
cells, 1 MB at a byte each, and answers every edge check in one step. Once a
graph is dense, the matrix is smaller as well as faster.

## Implementation

Both languages have two classes with the same methods. `Graph` is the
adjacency list: a hash map (`dict`, `Map`) from each vertex to a dynamic array
of its neighbours, accepting any vertex value. `AdjacencyMatrix` takes a fixed
number of vertices, numbered 0 to n − 1, because a grid can't grow without
being rebuilt. `add_edge` and `remove_edge` return whether they changed
anything, the same as `delete` in [Hash Map](/dsa/hash-map). Duplicate edges
are ignored, so each pair of vertices has at most one edge, and both classes
accept self-loops. The code stores no weights; a weighted version stores pairs
or numbers where these store vertices or 1s.

```python
from collections.abc import Hashable
from typing import Generic, TypeVar

V = TypeVar("V", bound=Hashable)


class Graph(Generic[V]):
    """A graph stored as adjacency lists: each vertex maps to a list of neighbours."""

    def __init__(self, directed: bool = False):
        self.directed = directed
        self._adj: dict[V, list[V]] = {}
        self._edge_count = 0

    def add_vertex(self, v: V) -> None:
        self._adj.setdefault(v, [])

    def vertices(self) -> list[V]:
        return list(self._adj)

    @property
    def edge_count(self) -> int:
        return self._edge_count
```

```typescript
/** Removes the first copy of `item` from `list`, which must contain it. */
function removeOne<T>(list: T[], item: T): void {
  list.splice(list.indexOf(item), 1);
}

/** A graph stored as adjacency lists: each vertex maps to an array of neighbours. */
export class Graph<V> {
  readonly directed: boolean;
  private readonly adj = new Map<V, V[]>();
  private edges = 0;

  constructor(directed = false) {
    this.directed = directed;
  }

  addVertex(v: V): void {
    if (!this.adj.has(v)) this.adj.set(v, []);
  }

  vertices(): V[] {
    return [...this.adj.keys()];
  }

  get edgeCount(): number {
    return this.edges;
  }
```

Whether the graph is directed is fixed when it's created, since every edge
method depends on it. `setdefault` inserts an empty list only if the vertex is
new, so adding a vertex twice leaves its edges alone; a plain
`self._adj[v] = []` would wipe them. The edge count is kept in its own field
because working it out means summing every list (and halving it, for an
undirected graph, except for self-loops). Python's `dict` and JavaScript's
`Map` both iterate in insertion order, so `vertices()` lists vertices in the
order they were added. JavaScript has no `list.remove`, so the TypeScript file
starts with a small `removeOne` helper.

```python
    def neighbours(self, v: V) -> list[V]:
        return list(self._adj[v])

    def degree(self, v: V) -> int:
        return len(self._adj[v])

    def has_edge(self, u: V, v: V) -> bool:
        return v in self._adj.get(u, ())
```

```typescript
  private listOf(v: V): V[] {
    const list = this.adj.get(v);
    if (list === undefined) throw new RangeError(`unknown vertex ${String(v)}`);
    return list;
  }

  neighbours(v: V): V[] {
    return [...this.listOf(v)];
  }

  degree(v: V): number {
    return this.listOf(v).length;
  }

  hasEdge(u: V, v: V): boolean {
    return this.adj.get(u)?.includes(v) ?? false;
  }
```

Asking for the neighbours or degree of a vertex the graph doesn't have is an
error: Python's `dict` raises `KeyError`, and `listOf` throws a `RangeError`.
Returning an empty list instead would hide a misspelt vertex name. `has_edge`
is the exception: "is there an edge from an unknown vertex?" has a true
answer, no, so it uses `get` with an empty default rather than raising. The
check `v in` the list is a linear scan, which is where the O(deg(u)) cost in
the table comes from.

```python
    def add_edge(self, u: V, v: V) -> bool:
        self.add_vertex(u)
        self.add_vertex(v)
        if v in self._adj[u]:
            return False
        self._adj[u].append(v)
        if not self.directed and u != v:
            self._adj[v].append(u)
        self._edge_count += 1
        return True

    def remove_edge(self, u: V, v: V) -> bool:
        if not self.has_edge(u, v):
            return False
        self._adj[u].remove(v)
        if not self.directed and u != v:
            self._adj[v].remove(u)
        self._edge_count -= 1
        return True
```

```typescript
  addEdge(u: V, v: V): boolean {
    this.addVertex(u);
    this.addVertex(v);
    const out = this.listOf(u);
    if (out.includes(v)) return false;
    out.push(v);
    if (!this.directed && u !== v) this.listOf(v).push(u);
    this.edges++;
    return true;
  }

  removeEdge(u: V, v: V): boolean {
    if (!this.hasEdge(u, v)) return false;
    removeOne(this.listOf(u), v);
    if (!this.directed && u !== v) removeOne(this.listOf(v), u);
    this.edges--;
    return true;
  }
}
```

`add_edge` creates both endpoints if they're missing, which is how most graphs
get built: from a list of edges, with no separate list of vertices. It then
checks for the edge before appending, and in an undirected graph one check is
enough, because the two lists always agree. Removal finds the neighbour with a
scan and then shifts the later entries left, as removing from the middle of a
dynamic array does; that keeps the other neighbours in the order they were
added. For an undirected edge both copies go, or the graph would claim a
one-way edge it was never given.

```python
class AdjacencyMatrix:
    """A graph on vertices 0 to n - 1 stored as an n-by-n grid of 0s and 1s."""

    def __init__(self, n: int, directed: bool = False):
        if n < 0:
            raise ValueError("n must be at least 0")
        self.directed = directed
        self._rows = [bytearray(n) for _ in range(n)]
        self._edge_count = 0

    def _check(self, v: int) -> None:
        if not 0 <= v < len(self._rows):
            raise IndexError(f"vertex {v} is out of range")

    def vertices(self) -> list[int]:
        return list(range(len(self._rows)))

    @property
    def edge_count(self) -> int:
        return self._edge_count
```

```typescript
/** A graph on vertices 0 to n - 1 stored as an n-by-n grid of 0s and 1s. */
export class AdjacencyMatrix {
  readonly directed: boolean;
  private readonly rows: Uint8Array[];
  private edges = 0;

  constructor(n: number, directed = false) {
    if (!Number.isInteger(n) || n < 0) {
      throw new RangeError('n must be a non-negative integer');
    }
    this.directed = directed;
    this.rows = Array.from({ length: n }, () => new Uint8Array(n));
  }

  private check(v: number): void {
    if (!Number.isInteger(v) || v < 0 || v >= this.rows.length) {
      throw new RangeError(`vertex ${v} is out of range`);
    }
  }

  vertices(): number[] {
    return this.rows.map((_, i) => i);
  }

  get edgeCount(): number {
    return this.edges;
  }
```

Each row is a `bytearray` in Python and a `Uint8Array` in TypeScript: fixed
size, one byte per cell, and every cell starts at 0. A Python list of `True`
and `False` would also work, but each slot would hold an 8-byte reference
instead of a byte. All the space goes in at construction: a matrix for n
vertices costs n² bytes before the first edge is added. Every method checks its
vertices against the range 0 to n − 1, and the Tricky lines below say why
Python needs that check most.

```python
    def has_edge(self, u: int, v: int) -> bool:
        self._check(u)
        self._check(v)
        return self._rows[u][v] == 1

    def add_edge(self, u: int, v: int) -> bool:
        if self.has_edge(u, v):
            return False
        self._rows[u][v] = 1
        if not self.directed:
            self._rows[v][u] = 1
        self._edge_count += 1
        return True

    def remove_edge(self, u: int, v: int) -> bool:
        if not self.has_edge(u, v):
            return False
        self._rows[u][v] = 0
        if not self.directed:
            self._rows[v][u] = 0
        self._edge_count -= 1
        return True

    def neighbours(self, v: int) -> list[int]:
        self._check(v)
        return [w for w, cell in enumerate(self._rows[v]) if cell]

    def degree(self, v: int) -> int:
        self._check(v)
        return sum(self._rows[v])
```

```typescript
  hasEdge(u: number, v: number): boolean {
    this.check(u);
    this.check(v);
    return this.rows[u][v] === 1;
  }

  addEdge(u: number, v: number): boolean {
    if (this.hasEdge(u, v)) return false;
    this.rows[u][v] = 1;
    if (!this.directed) this.rows[v][u] = 1;
    this.edges++;
    return true;
  }

  removeEdge(u: number, v: number): boolean {
    if (!this.hasEdge(u, v)) return false;
    this.rows[u][v] = 0;
    if (!this.directed) this.rows[v][u] = 0;
    this.edges--;
    return true;
  }

  neighbours(v: number): number[] {
    this.check(v);
    const out: number[] = [];
    this.rows[v].forEach((cell, w) => {
      if (cell === 1) out.push(w);
    });
    return out;
  }

  degree(v: number): number {
    return this.neighbours(v).length;
  }
}
```

The edge operations are each a cell read and at most two cell writes, with no
scanning: that's the matrix's whole advantage. The undirected case writes both
`[u][v]` and `[v][u]`, keeping the grid symmetric. A self-loop needs no special
case here, because `[u][u]` written twice is still one cell. `neighbours` and
`degree` read the full row, all n cells, and return neighbours in increasing
order, where the list returns them in the order their edges were added.

## Invariants

These hold after every call returns:

- **Undirected graphs are symmetric.** In the list, v is in u's list exactly
  when u is in v's; in the matrix, `[u][v]` equals `[v][u]`. Every edge method
  writes or removes both sides together.
- **No list holds a vertex twice.** `add_edge` checks before it appends, so
  each edge, and each self-loop, appears once in each list it belongs in.
- **Every neighbour is itself a vertex.** `add_edge` adds both endpoints
  before linking them, so following a neighbour never leads to a vertex the
  map doesn't have.
- **The edge count equals the number of edges**: each directed edge, each
  undirected edge and each self-loop counts once. It changes only when an edge
  method returns `True`.

## Tricky lines

- `u != v` in `add_edge` (and `u !== v` in TypeScript). Without it, an
  undirected self-loop appends u to its own list twice, so `neighbours` lists
  it twice and `degree` counts 2. Graph theory does count a self-loop twice
  toward an undirected vertex's degree, but this class defines degree as the
  number of neighbours, and the list and matrix would disagree. The same guard
  in `remove_edge` matters more in TypeScript: without it, the second
  `removeOne` looks for a u that's already gone. `indexOf` returns −1, and
  `splice(-1, 1)` counts from the end, so it silently deletes the last
  neighbour in the list. Removing the self-loop from `a: [b, a, c]` leaves
  `[b]` instead of `[b, c]`. Python's `list.remove` raises `ValueError` for a
  missing item instead.
- `if v in self._adj[u]: return False` in `add_edge`. Leave it out and adding
  the same edge twice stores it twice and counts it twice; one
  `remove_edge` then removes one copy, `edge_count` drops by one, and
  `has_edge` still answers yes. Graphs that really need several edges between
  the same two vertices (two flights between the same cities) are
  **multigraphs**, and they usually give each edge an ID rather than allowing
  silent duplicates.
- `return list(self._adj[v])` in `neighbours`, a copy rather than the stored
  list. Returning the stored list lets a caller's `append` add a one-way edge
  to an undirected graph that the count and the other vertex know nothing
  about. The copy costs O(deg(v)), the same as reading the list.
- `[bytearray(n) for _ in range(n)]`, not `[bytearray(n)] * n`. The shorter
  form makes n references to one row, so adding the directed edge 0 → 1 sets
  column 1 in every row, and every vertex appears to have an edge to 1. The
  TypeScript `Array.from` with a function creates a new `Uint8Array` per row
  for the same reason.
- `_check` in the Python matrix. Python reads a negative index from the end,
  so without the check `has_edge(0, -1)` would quietly answer for vertex
  n − 1. TypeScript doesn't wrap, but it fails in two different ways: a bad
  column index into a `Uint8Array` reads `undefined` and a write to it is
  silently ignored, while a bad row index makes `this.rows[u]` undefined and
  the next `[v]` throws a `TypeError`. `check` turns both into the same
  `RangeError`.

## When to use it

Use an adjacency list by default. Almost every graph met in practice is
sparse (road networks, social graphs, the links between web pages, a
project's dependency graph), and the list's O(V + E) space and O(deg(v))
neighbour scan are what the later traversal entries rely on: visiting every
vertex and edge once is O(V + E) only with lists. Interview problems that hand
you an edge list, such as "given `n` courses and their prerequisite pairs",
usually start by building one with a `dict` of lists, or with a list of lists
when the vertices are already numbered 0 to n − 1.

Use a matrix when the graph is dense, when V is small (a few thousand
vertices at most, since the grid is V² bytes), or when the main question is
"is there an edge between u and v?". Algorithms that fill in the shortest
distance between every pair of vertices work on a V × V table anyway, so a
matrix suits them. A grid-shaped problem, such as a maze given as rows of
characters, is a graph too, but usually needs neither layout: a cell's
neighbours are the cells above, below, left and right, worked out from its
coordinates when needed.

If the graph is sparse but edge checks are frequent, replace each neighbour
list with a hash set. `has_edge` and `remove_edge` become O(1) on average, at
the cost of more memory per neighbour. A Python `set` also gives up the
insertion order (a `dict` with `None` values keeps it); a JavaScript `Set`
keeps insertion order, as `Map` does.

Some structures in this tab are graphs with extra rules. A
[binary tree](/dsa/binary-tree) is a connected graph with no cycles where each
node has at most two children, which is why it's stored as nodes with child
pointers rather than either layout here. And when the only question is
whether two vertices are connected while edges keep being added,
[Union-Find](/dsa/union-find) answers it in close to O(1) amortized per
operation without storing the edges at all.
