---
title: Graph Breadth-First Search
summary: Exploring a graph in rings around a starting point, using a queue so that every vertex is first reached by a route with the fewest edges, from one source or from many at once.
date: 2026-10-01
kind: pattern
---

Breadth-first search, usually shortened to **BFS**, visits a graph in rings.
First the starting vertex, then everything one edge away, then everything two
edges away, and so on outward. Because it never reaches a vertex by a longer
route while a shorter one exists, the ring a vertex is found in is exactly its
distance from the start. This entry covers BFS from one starting vertex, the
path it finds, and a variant that starts from many vertices at once on a grid.

## Prerequisites

- [Graph](/dsa/graph): vertices, edges, and the adjacency list (a map from
  each vertex to the list of its neighbours) that the code here walks. The
  entry covers how a graph is stored but not how to traverse it, which is what
  this one adds.
- [Queue and Deque](/dsa/queue-and-deque): BFS is a loop around a queue, and
  the code relies on `popleft` taking constant time. The TypeScript version
  avoids removing from the front of an array, for the same reason that entry
  gives against `pop(0)`.

## The idea

A **queue** returns items in the order they were added. BFS keeps a queue of
vertices that have been found but whose neighbours haven't been looked at yet.
It repeatedly takes the front vertex, looks at each of its neighbours, and
adds the ones it hasn't seen before to the back, recording each one's distance
as one more than the front vertex's.

Here is a small undirected graph, as an adjacency list. Vertices 6 and 7 are
joined to each other but not to the rest.

```text
0: [1, 2]      3: [1, 2, 5]
1: [0, 3]      4: [2, 5]
2: [0, 3, 4]   5: [3, 4]
6: [7]         7: [6]
```

Searching from vertex 0:

| Step | Taken from queue | New vertices found (distance)  | Queue afterwards |
| ---- | ---------------- | ------------------------------ | ---------------- |
| 0    | (start)          | 0 (distance 0)                 | 0                |
| 1    | 0                | 1 (distance 1), 2 (distance 1) | 1, 2             |
| 2    | 1                | 3 (distance 2)                 | 2, 3             |
| 3    | 2                | 4 (distance 2)                 | 3, 4             |
| 4    | 3                | 5 (distance 3)                 | 4, 5             |
| 5    | 4                | none: 2 and 5 already seen     | 5                |
| 6    | 5                | none: 3 and 4 already seen     | (empty)          |

The queue never holds more than two distinct distances at once. While it
holds distance-1 vertices, it can only be adding distance-2 ones behind them,
and the distance-1 vertices all leave before any distance-2 vertex is taken.
So vertices come out in order of distance, and the first time a vertex is
found is by a route with the fewest edges. Vertices 6 and 7 are never found,
so they get no distance at all.

**Recovering the path.** The distance says how far, not which way. To get the
route, store with each vertex the one it was found from, its **parent**. Here
1 and 2 have parent 0, 3 has parent 1 (found while taking 1, before 2 got
its turn), 4 has parent 2, and 5 has parent 3. Following parents back from 5
gives 5, 3, 1, 0, and reversing that gives the path 0, 1, 3, 5, which has 3
edges.

**Many starting points.** Put several vertices in the queue at the start, all
at distance 0. The rings then grow from every one of them at the same time, and
each vertex gets the distance to whichever starting vertex is nearest. On a
grid, where each cell is a vertex and neighbouring cells (up, down, left,
right) are joined unless one is a wall, this answers "how far is each cell
from the closest exit?" in a single search. Running a separate search from
every exit would repeat the same cells once per exit.

## When to use it

Use it whenever the question is "fewest steps": the fewest moves in a maze or
puzzle, the fewest connections between two people in a social network, the
fewest edits between two words when each edit is an edge. It also answers "what
can I reach from here at all?" for any graph, though a depth-first search does
that too. The multi-source form fits "distance to the nearest X" over a grid
or graph: nearest fire station, nearest water cell, time for a rot to spread
through a grid of fruit.

It is the wrong tool when edges have different costs, such as roads of
different lengths. BFS counts edges, so it treats a 1 km road and a 500 km
road alike. Dijkstra's algorithm handles costs. It keeps the vertices in a
[heap](/dsa/heap) ordered by the cheapest distance found so far, lowers a
vertex's distance when a cheaper route turns up, and settles a vertex only
when it comes off the heap. That last part is the opposite of BFS's "mark when
added" rule, so swapping this entry's queue for a heap is not enough. The
Pitfalls section gives an example of BFS getting it wrong.

## Walkthrough

```python
from collections import deque

Graph = dict[int, list[int]]


def bfs_distances(graph: Graph, source: int) -> dict[int, int]:
    """Fewest edges from source to every vertex reachable from it."""
    dist = {source: 0}
    queue = deque([source])
```

```typescript
export type Graph = Map<number, number[]>;

/** Fewest edges from `source` to every vertex reachable from it. */
export function bfsDistances(graph: Graph, source: number): Map<number, number> {
  const dist = new Map<number, number>([[source, 0]]);
  const queue = [source];
```

The graph is a plain map from a vertex to its list of neighbours. The result
`dist` does two jobs: it holds the answers, and it records which vertices have
been seen, since a vertex has a distance exactly when it has been found. The
source goes into both `dist` and the queue straight away, so it is already
marked as seen before the loop starts. Without that, a neighbour of the source
that points back to it would add the source a second time, with distance 2.

```python
    while queue:
        v = queue.popleft()
        for w in graph.get(v, []):
            if w not in dist:
                dist[w] = dist[v] + 1
                queue.append(w)
    return dist
```

```typescript
  for (let head = 0; head < queue.length; head++) {
    const v = queue[head];
    for (const w of graph.get(v) ?? []) {
      if (!dist.has(w)) {
        dist.set(w, dist.get(v)! + 1);
        queue.push(w);
      }
    }
  }
  return dist;
}
```

The vertex is marked as seen when it is added to the queue, on the same two
lines that give it a distance, not later when it is taken off. Take vertex 3
in the example. It is a neighbour of both 1 and 2. If marking waited until a
vertex was taken from the queue, then when 1 is processed, 3 is not yet marked,
so it is added; when 2 is processed, 3 still isn't marked, since it is still
waiting in the queue, so it is added again. On a complete graph of 50 vertices
(every vertex joined to every other), running both versions gave 1,226
additions to the queue when marking on removal against 50 when marking on
entry. The distances can still come out
right, but only if every later copy is skipped on removal, and the queue can
grow to roughly the number of edges instead of the number of vertices.

`graph.get(v, [])` (`graph.get(v) ?? []` in TypeScript) lets a vertex with no
entry count as having no neighbours, so a source missing from the map gets
distance 0 and nothing else. The TypeScript loop uses a `head` position
instead of removing from the front of the array, so each dequeue is a single
index read. The array only grows, which is fine here because every vertex is
added at most once.

```python
def shortest_path(graph: Graph, source: int, target: int) -> list[int] | None:
    """A path with the fewest edges from source to target, or None."""
    parent: dict[int, int | None] = {source: None}
    queue = deque([source])
    while queue and target not in parent:
        v = queue.popleft()
        for w in graph.get(v, []):
            if w not in parent:
                parent[w] = v
                queue.append(w)
```

```typescript
/** A path with the fewest edges from `source` to `target`, or null. */
export function shortestPath(
  graph: Graph,
  source: number,
  target: number,
): number[] | null {
  const parent = new Map<number, number | null>([[source, null]]);
  const queue = [source];
  for (let head = 0; head < queue.length && !parent.has(target); head++) {
    const v = queue[head];
    for (const w of graph.get(v) ?? []) {
      if (!parent.has(w)) {
        parent.set(w, v);
        queue.push(w);
      }
    }
  }
```

Here `parent` replaces `dist` as the record of what has been seen, and it also
says how each vertex was reached. The source has no parent, so its entry is
`None` (`null`), which is how the path-building loop below knows to stop. The
search can end as soon as the target has a parent, because that parent was
assigned on the shortest route and later vertices can't change it. This is
why the loop condition includes `target not in parent`. If the source is the
target, the loop never runs.

```python
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

A target with no parent was never found, so the answer is `None` (`null`), not
an empty list: an empty list would read as a path of no vertices, and the
caller couldn't tell it from "no path". The parents point backwards, from the
target towards the source, so the loop collects the path in reverse and the
final reverse puts it in order. The test for the end is `node is not None`, not
`while node`, because vertex 0 is a perfectly good vertex and `while node`
would stop early on it.

```python
def nearest_target(grid: list[str]) -> list[list[int | None]]:
    """Steps from each cell to its nearest 'T'; walls ('#') and cells that
    cannot reach a target get None. Moves are up, down, left and right."""
    rows = len(grid)
    cols = len(grid[0]) if rows else 0
    dist: list[list[int | None]] = [[None] * cols for _ in range(rows)]
    queue: deque[tuple[int, int, int]] = deque()
    for r in range(rows):
        for c in range(cols):
            if grid[r][c] == "T":
                dist[r][c] = 0
                queue.append((r, c, 0))
```

```typescript
/**
 * Steps from each cell to its nearest 'T'; walls ('#') and cells that cannot
 * reach a target get null. Moves are up, down, left and right.
 */
export function nearestTarget(grid: string[]): (number | null)[][] {
  const rows = grid.length;
  const cols = rows > 0 ? grid[0].length : 0;
  const dist: (number | null)[][] = Array.from({ length: rows }, () =>
    new Array<number | null>(cols).fill(null),
  );
  const queue: [number, number, number][] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === 'T') {
        dist[r][c] = 0;
        queue.push([r, c, 0]);
      }
    }
  }
```

The grid is a list of strings: `T` marks a target, `#` a wall and anything else
an open cell. The distance table starts all `None` (`null`), meaning "not
reached yet", and that doubles as the seen mark, as before. Every target goes
into the queue at distance 0 before the search starts, which is the whole
difference from single-source BFS. Each queue entry carries its own distance,
so the loop doesn't have to look it up in a table whose entries may be
`None`. The `[None] * cols` inside a comprehension builds a fresh row each
time. Writing `[[None] * cols] * rows` would make every row the same list, and
setting one cell would appear to set it in every row. An empty grid gives
`cols = 0`, so the `if rows` guard stops `grid[0]` failing on it.

```python
    while queue:
        r, c, d = queue.popleft()
        for nr, nc in ((r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1)):
            if 0 <= nr < rows and 0 <= nc < cols:
                if grid[nr][nc] != "#" and dist[nr][nc] is None:
                    dist[nr][nc] = d + 1
                    queue.append((nr, nc, d + 1))
    return dist
```

```typescript
  for (let head = 0; head < queue.length; head++) {
    const [r, c, d] = queue[head];
    for (const [nr, nc] of [
      [r + 1, c],
      [r - 1, c],
      [r, c + 1],
      [r, c - 1],
    ]) {
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
        if (grid[nr][nc] !== '#' && dist[nr][nc] === null) {
          dist[nr][nc] = d + 1;
          queue.push([nr, nc, d + 1]);
        }
      }
    }
  }
  return dist;
}
```

This is the same loop as `bfs_distances`, with the four neighbours of a cell
worked out from its position instead of looked up. The bounds check comes
first, so `grid[nr][nc]` is never read off the edge of the grid (in Python a
negative index would not fail but wrap around to the opposite side). The wall
test is part of the same condition that marks the cell, so walls never get a
distance and never enter the queue. Cells that no search reaches, such as a
pocket sealed off by walls, are left as `None`.

Take the grid `["T.#.", "..#.", "...T"]`: three rows of four cells, with a
target `T` in the top-left and bottom-right corners and two walls `#` in
column 2. Coordinates are (row, column), counted from 0. Both targets start at
distance 0. The first ring, taken from the queue in the order the targets were
added, is (1,0) and (0,1) next to the first target and (1,3) and (2,2) next to
the second, all at distance 1. The second ring is (2,0) and (1,1) from (1,0),
(0,3) from (1,3), and (2,1) from (2,2). Cell (0,1) also touches (1,1), but
(1,0) was processed first and had already given (1,1) its distance, so (0,1)
skips it. The result:

| Row | Column 0 | Column 1 | Column 2 | Column 3 |
| --- | -------- | -------- | -------- | -------- |
| 0   | 0        | 1        | wall     | 2        |
| 1   | 1        | 2        | wall     | 1        |
| 2   | 2        | 2        | 1        | 0        |

Cell (2,1) is 2 from the nearer target, the one at the bottom right, though
it is 3 steps from the one at the top left.

## Complexity

BFS from one source on an adjacency list takes O(V + E) time, where V is the
number of vertices and E the number of edges. Each reachable vertex is added to
the queue once and taken out once, which is O(V), and each vertex's neighbour
list is scanned once when it is taken out, so every edge is looked at once
(twice in an undirected graph, once from each end), which is O(E). The
queue and the distance record each hold at most V entries, so the extra space is
O(V). Rebuilding the path walks at most V parents.

The grid version has V = R × C cells, and every cell has at most 4 edges, so
E is at most 4 × R × C and the time is O(R × C), with O(R × C) space for the
distance table and queue. The number of targets doesn't enter the time: a
single search with 1,000 targets costs the same as one with a single target,
while a separate search per target costs 1,000 times as much. On the 3 × 4
grid above, that is 12 cells, 2 targets and 10 open cells, each added to the
queue once.

## Pitfalls

- **Marking a vertex as seen when it is taken off the queue.** A vertex found
  from two different neighbours before its turn is added twice. On a complete
  graph of 50 vertices that was 1,226 queue additions against 50. Mark when
  adding, as the walkthrough does.
- **Forgetting to mark the source.** If the source isn't recorded before the
  loop, a neighbour that links back to it adds it again, and with a parent
  record it would be given a parent, so the path-building loop would never
  reach a `None` and would never stop.
- **Using BFS on weighted edges.** BFS gives fewest edges, not least cost. With
  edges 0 to 2 of weight 10, 0 to 1 of weight 1 and 1 to 2 of weight 1, BFS
  reports the direct edge to 2 as best (1 edge), but the cheapest route is
  through 1 (cost 2). The queue order is correct only because every step adds
  the same amount to the distance; once edges differ, a vertex found early
  can still be reached more cheaply later, and BFS never revisits it. Use
  Dijkstra's algorithm instead. A graph where every edge costs the same, in
  any units, is the case BFS handles.
- **Running a search per target for a "nearest target" question.** It gives
  the right answer at many times the cost. Start all the targets in one queue.
- **Reading a distance for an unreachable vertex.** In the graph version the
  vertex is simply missing from the result, so `dist[v]` raises `KeyError`
  (the TypeScript `Map` returns `undefined`). In the grid version it is
  `None` (`null`). Check before using it.
- **Writing `while node` as the end test of the path loop.** Vertex 0 is
  falsy in Python, so when the source is vertex 0 the loop stops before adding
  it and the path comes out without its first vertex.
