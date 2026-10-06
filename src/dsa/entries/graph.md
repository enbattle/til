---
title: Graph
summary: Things joined by connections, stored as a list of neighbors per vertex or as a grid with a cell for every possible connection, and why the list is the default.
date: 2026-10-05
kind: data-structure
template: 2
---

A graph models things and the connections between them: intersections and roads, people and friendships, courses and prerequisites. Nearly every graph problem comes down to walking those connections, and how fast you can walk depends on how you store them. You'll store one four-vertex graph both standard ways and price every operation.

## Prerequisites

- [Arrays and strings](/dsa/arrays-and-strings): both layouts are arrays inside arrays, and the list's costs rest on amortized O(1) appends; that entry defines amortized and big-O.
- [Hash map](/dsa/hash-map): for labeled vertices and a set per vertex answering "is v here?" in O(1) on average.

## What it is

A **graph** is a set of **vertices** (nodes) and a set of **edges**, each joining two vertices. Two vertices joined by an edge are **neighbors**. **V** is the number of vertices and **E** the number of edges. An edge is **undirected** when it works both ways, like a friendship, and **directed** when it goes one way, like "course A requires course B". A vertex's **degree**, written deg(v), is its number of neighbors. Weighted edges, which carry a distance or a cost, come at the end of this section.

Take vertices 0 to 3 with undirected edges 0-1, 0-2, 1-2 and 2-3:

```text
0 --- 1
 \   /
   2 --- 3
```

An **adjacency list** gives each vertex a list of its neighbors. An undirected edge goes in both lists, because from vertex 1 you must be able to see 0:

```text
0: [1, 2]    1: [0, 2]    2: [0, 1, 3]    3: [2]
```

That's 8 entries for 4 edges, which is 2E, and also the sum of the degrees: 2 + 2 + 3 + 1. An **adjacency matrix** is a V by V grid whose cell in row u and column v is 1 when there's an edge from u to v:

```text
      0  1  2  3
  0 [ 0  1  1  0 ]
  1 [ 1  0  1  0 ]
  2 [ 1  1  0  1 ]
  3 [ 0  0  1  0 ]
```

Sixteen cells, eight of them 1, symmetric across the diagonal because each edge sets two cells. Make the same four edges directed (0 to 1, 0 to 2, 1 to 2, 2 to 3) and the lists hold 4 entries, the matrix has four 1s, and the symmetry is gone.

Weights fit both layouts. The list stores `(neighbor, weight)` pairs; the matrix stores the weight in the cell, and needs a marker such as `None` for "no edge", since 0 can be a real weight.

## When to use it

- The statement describes pairwise relationships: prerequisites, friends, roads, links, dependencies, "can you get from A to B".
- The input is `n` plus a list of pairs such as `[[0, 1], [0, 2]]`. Build an adjacency list from it before doing anything else.
- The vertices are names or ids rather than 0 to n - 1: use a hash map from vertex to list instead of an array of lists.
- A grid or board (a maze, an island map) is a graph too, but needs neither layout: a cell's neighbors come from its coordinates.
- Reach for the matrix when V is small (a few thousand at most, since it holds V² cells), when the graph is dense, or when the main question is "is there an edge between u and v?". An algorithm that fills a table of distances between every pair of vertices already needs a V by V table.

The rule: store only the edges that exist unless the graph is so full that a cell for every possible one costs little extra.

## Operations and costs

Time is in terms of V, E and deg(v). When two figures are given, the first is the average and the second the worst case; the worst case is a list append that has to resize.

| Operation               | Adjacency list                           | Adjacency matrix |
| ----------------------- | ---------------------------------------- | ---------------- |
| `add_edge(u, v)`        | O(1) amortized; O(deg(u) + deg(v)) worst | O(1)             |
| `remove_edge(u, v)`     | O(deg(u) + deg(v)), scan then shift      | O(1)             |
| `has_edge(u, v)`        | O(deg(u)), a scan of u's list            | O(1)             |
| list the neighbors of v | O(deg(v))                                | O(V), whole row  |
| `degree(v)`             | O(1), the list's length                  | O(V), whole row  |
| visit every edge        | O(V + E)                                 | O(V²)            |
| space                   | O(V + E)                                 | O(V²)            |

The list pays for an edge check by scanning one short list; the matrix answers in one cell read but pays for every other question by reading a row of V cells, however few neighbors the vertex has. Visiting every edge is what a search does, so that row usually decides.

Put numbers on it. A road-style graph has 1,000,000 vertices with about 10 neighbors each, so E = 5,000,000 and the lists hold 2E = 10,000,000 entries. Visiting every edge takes about V + 2E = 11 million steps. The matrix has 10¹² cells, a terabyte at one byte each, and visiting every edge reads all of them. Now a dense graph: 1,000 vertices and 400,000 of the 499,500 possible edges. The lists hold 800,000 entries and the matrix 1,000,000 cells, so the matrix costs little more and answers every edge check in one read.

A matrix also has a fixed V: a new vertex means a new row and a new cell in every row, so a growing graph belongs in lists.

## Implementation

Both languages store vertices as numbers 0 to n - 1, and both layouts are built from the same edge list.

```python
from collections.abc import Iterator

Edge = tuple[int, int]

def check(n: int, edges: list[Edge]) -> None:
    # Python reads adj[-1] as the last vertex, so a bad id would not fail.
    for u, v in edges:
        if not (0 <= u < n and 0 <= v < n):
            raise ValueError(f"edge ({u}, {v}) names a vertex outside 0..{n - 1}")

def build_list(n: int, edges: list[Edge], directed: bool = False) -> list[list[int]]:
    """Adjacency list: adj[u] holds the neighbors of u."""
    check(n, edges)
    # A comprehension makes n separate lists; [[]] * n would share one.
    adj: list[list[int]] = [[] for _ in range(n)]
    for u, v in edges:
        adj[u].append(v)
        # An undirected edge is stored from both ends, or only one end sees it.
        # A self-loop (u == v) is one entry, the same as one matrix cell.
        if not directed and u != v:
            adj[v].append(u)
    return adj
```

```typescript
export type Edge = [number, number];

function check(n: number, edges: Edge[]): void {
  // A bad column on a number[] row would silently grow the row, not fail.
  for (const [u, v] of edges) {
    if (!(u >= 0 && u < n && v >= 0 && v < n)) {
      throw new RangeError(`edge (${u}, ${v}) names a vertex outside 0..${n - 1}`);
    }
  }
}

/** Adjacency list: adj[u] holds the neighbors of u. */
export function buildList(n: number, edges: Edge[], directed = false): number[][] {
  check(n, edges);
  // Array.from calls the function per slot; fill([]) would share one array.
  const adj: number[][] = Array.from({ length: n }, () => []);
  for (const [u, v] of edges) {
    adj[u].push(v);
    // An undirected edge is stored from both ends, or only one end sees it.
    // A self-loop (u === v) is one entry, the same as one matrix cell.
    if (!directed && u !== v) adj[v].push(u);
  }
  return adj;
}
```

On the running example this returns the lists above, and with `directed` set `[[1, 2], [2], [3], []]`. The matrix builder takes the same arguments but allocates all V² cells before it reads an edge.

```python
def build_matrix(n: int, edges: list[Edge], directed: bool = False) -> list[list[int]]:
    """Adjacency matrix: m[u][v] is 1 when there is an edge from u to v."""
    check(n, edges)
    # Every cell exists up front, which is the V * V space cost.
    m = [[0] * n for _ in range(n)]
    for u, v in edges:
        m[u][v] = 1
        if not directed:
            m[v][u] = 1
    return m
```

```typescript
/** Adjacency matrix: m[u][v] is 1 when there is an edge from u to v. */
export function buildMatrix(n: number, edges: Edge[], directed = false): number[][] {
  check(n, edges);
  // Every cell exists up front, which is the V * V space cost.
  const m = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (const [u, v] of edges) {
    m[u][v] = 1;
    if (!directed) m[v][u] = 1;
  }
  return m;
}
```

Writing a cell twice is harmless, so the matrix needs no `u != v` guard. The queries show the cost difference directly, and a list needs no `neighbors` function because `adj[v]` is already the answer.

```python
def has_edge_list(adj: list[list[int]], u: int, v: int) -> bool:
    return v in adj[u]  # a scan of u's list, so O(deg(u))

def has_edge_matrix(m: list[list[int]], u: int, v: int) -> bool:
    return m[u][v] == 1  # one cell read, however many edges there are

def neighbors_matrix(m: list[list[int]], u: int) -> list[int]:
    # No list to return: the whole row must be read to find the 1s.
    return [v for v, cell in enumerate(m[u]) if cell]
```

```typescript
export function hasEdgeList(adj: number[][], u: number, v: number): boolean {
  return adj[u].includes(v); // a scan of u's list, so O(deg(u))
}

export function hasEdgeMatrix(m: number[][], u: number, v: number): boolean {
  return m[u][v] === 1; // one cell read, however many edges there are
}

export function neighborsMatrix(m: number[][], u: number): number[] {
  // No list to return: the whole row must be read to find the 1s.
  const out: number[] = [];
  m[u].forEach((cell, v) => {
    if (cell) out.push(v);
  });
  return out;
}
```

On the example, `has_edge_list(adj, 2, 3)` scans the three entries of `[0, 1, 3]`, and `neighbors_matrix(m, 2)` reads all four cells of row 2 to return `[0, 1, 3]`. Last, visiting every edge, which is what a traversal does. Each undirected edge is yielded once from each end.

```python
def edges_of_list(adj: list[list[int]]) -> Iterator[Edge]:
    for u, row in enumerate(adj):
        for v in row:
            yield u, v

def edges_of_matrix(m: list[list[int]]) -> Iterator[Edge]:
    for u, row in enumerate(m):
        for v, cell in enumerate(row):
            if cell:  # every cell is read, including the zeros
                yield u, v
```

```typescript
export function* edgesOfList(adj: number[][]): Generator<Edge> {
  for (const [u, row] of adj.entries()) {
    for (const v of row) yield [u, v];
  }
}

export function* edgesOfMatrix(m: number[][]): Generator<Edge> {
  for (const [u, row] of m.entries()) {
    for (const [v, cell] of row.entries()) {
      if (cell) yield [u, v]; // every cell is read, including the zeros
    }
  }
}
```

The list version does 8 steps on the example, one per entry. The matrix version reads all 16 cells to find the same 8 edges.

## Pitfalls

- **Storing an undirected edge once.** Without `adj[v].append(u)`, the edge is visible from u and invisible from v, so a search that starts at v never finds u. Also keep the `u != v` guard: without it a self-loop lands in its own list twice, and the list and the matrix disagree about the graph.
- **Sharing one row.** `[[]] * n` in Python and `new Array(n).fill([])` in TypeScript make n references to one array, so adding 0 to 1 appears to add it to every vertex. The comprehension and `Array.from` in `build_list` make a fresh list per vertex; `build_matrix` needs the same care.
- **Skipping `check`.** Python reads `adj[-1]` as the last vertex, so a bad id quietly edits the wrong one. In TypeScript, `m[u][v] = 1` with `v` past the end grows the row instead of failing.
- **Asking the list "is there an edge?" in a loop.** `v in adj[u]` costs O(deg(u)) per call; asked for every pair, a hub vertex with 100,000 neighbors dominates the run. If edge checks are frequent, keep a set per vertex instead of a list, or use the matrix when V is small.
