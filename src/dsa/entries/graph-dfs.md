---
title: Graph Depth-First Search
summary: Exploring a graph by following one connection as deep as it goes before backing up, using an explicit stack, to count connected groups (components, grid islands) and to detect cycles in a directed graph.
date: 2026-10-01
kind: pattern
---

Depth-first search (DFS) is a way of visiting every vertex reachable from a
starting vertex. From the current vertex you step to a neighbour, from there to
one of its neighbours, and keep going deeper until you reach a vertex with
nothing new to visit. Then you back up to the most recent vertex that still has
an unexplored neighbour and go deep again from there. Backing up always
returns to the latest unfinished vertex, which is the behaviour of a
[stack](/dsa/stacks-and-queues), so a stack is all the machinery it needs. This entry uses
it for two jobs: counting the separate pieces of a graph, and finding out
whether a directed graph contains a loop.

## Prerequisites

- [Graph](/dsa/graph), for vertices, edges, directed and undirected edges, and
  the adjacency list (a map from each vertex to its list of neighbours) that
  the code here walks. That entry covers storing a graph but not walking one;
  this is where walking starts. The code uses a plain dictionary (`Map` in
  TypeScript) instead of that entry's class, to stay short.
- [Stacks and queues](/dsa/stacks-and-queues), for last in, first out: `push` adds to the top, `pop`
  removes the top, and both are O(1). A Python list and a TypeScript array do
  this with `append` / `pop` and `push` / `pop`.

## The idea

**Connected components.** In an undirected graph, a **connected component** is
a maximal group of vertices where any one can reach any other by following
edges. Take six vertices and edges 0-1, 1-2 and 3-4, with vertex 5 alone. There
are three components: {0, 1, 2}, {3, 4} and {5}. To count them, walk through
the vertices; whenever you meet one you have not visited, you have found a new
component, so add one and run DFS from it to visit the whole component and mark
every vertex in it. Later in the walk those vertices are skipped. The count is
the number of times a fresh DFS had to start.

**Islands on a grid.** A grid of land (1) and water (0) cells is a graph in
disguise: each cell is a vertex, and a land cell shares an edge with the land
cells directly above, below, left and right of it (diagonals do not count).
An **island** is a connected component of land cells, so counting islands is
counting components, with neighbours computed from coordinates instead of read
from a stored list. In this grid, `1` is land, and there are three islands: the
2 by 2 block, the single cell in row 2, and the pair at the end of row 3.

```text
1 1 0 0 0
1 1 0 0 0
0 0 1 0 0
0 0 0 1 1
```

**Cycles in a directed graph.** A **cycle** is a path that leads from a vertex
back to itself, such as 1 → 2 → 1. In a directed graph, edges are one-way and
DFS can find cycles by tracking where each vertex stands. Each vertex is in one
of three **states**:

- **unvisited**: DFS has not reached it yet;
- **on the path**: DFS has entered it and not yet finished it, so it lies on
  the chain of vertices from the start to where DFS is now;
- **finished**: DFS has explored everything reachable from it and backed out.

An edge from the current vertex to a vertex that is **on the path** is a cycle:
that vertex leads, through the path, to the current one, and the edge leads
back. An edge to an unvisited vertex means going deeper. An edge to a finished
vertex is harmless.

Why three states and not two (seen and not seen)? Take the diamond: edges
0 → 1, 0 → 2, 1 → 3 and 2 → 3. There is no cycle, since every edge points
away from 0. But DFS reaches vertex 3 twice, once through vertex 1 and again
through vertex 2. With only a seen flag, the second arrival looks like running
into a vertex already met, and reports a cycle that does not exist. With three
states, 3 is
finished by the time 2 reaches it, and a finished vertex is ignored. In an
undirected graph the question differs (an edge back to the vertex you came from
is not a cycle), and this entry covers only the directed case.

## When to use it

Use DFS when the question is about what is reachable or how a graph is shaped,
not about shortest routes: how many groups, is everything connected, can A reach
B, is there a loop. Typical cases are counting islands, regions or friend
groups, flood fill (repainting a connected region of a picture), checking that
a network is one piece, and spotting circular dependencies in a build system or
a set of courses with prerequisites, which is the cycle check above.

Cycle detection is also the first half of **topological sorting**, ordering
vertices so that every edge points forward. That is a later entry; it builds on
the three-state DFS below.

DFS does not find shortest paths in an unweighted graph; for that, use
breadth-first search, which explores in order of distance from the start.

## Walkthrough

```python
def count_components(graph: dict[int, list[int]]) -> int:
    """Connected components of an undirected graph given as vertex -> neighbours.

    Every vertex, including isolated ones, must be a key of `graph`.
    """
    seen: set[int] = set()
    count = 0
    for start in graph:
        if start in seen:
            continue
        count += 1
        seen.add(start)
        stack = [start]
```

```typescript
/**
 * Connected components of an undirected graph given as vertex -> neighbours.
 * Every vertex, including isolated ones, must be a key of `graph`.
 */
export function countComponents(graph: Map<number, number[]>): number {
  const seen = new Set<number>();
  let count = 0;
  for (const start of graph.keys()) {
    if (seen.has(start)) continue;
    count++;
    seen.add(start);
    const stack = [start];
```

The outer loop visits every vertex as a possible start, which is how isolated
vertices and separate components get found: if the loop only started from
vertex 0, it would never see {3, 4} or {5}. A start that is already in `seen`
belongs to a component counted earlier, so it is skipped. Anything else is new,
so `count` goes up, and the start is marked and put on the stack. Marking at
this moment, not later, matters in the next chunk. The graph must list every
vertex as a key, even those with no edges, or the loop would never see an
isolated vertex.

```python
        while stack:
            vertex = stack.pop()
            for neighbour in graph[vertex]:
                if neighbour not in seen:
                    seen.add(neighbour)
                    stack.append(neighbour)
    return count
```

```typescript
    while (stack.length > 0) {
      const vertex = stack.pop()!;
      for (const neighbour of graph.get(vertex)!) {
        if (!seen.has(neighbour)) {
          seen.add(neighbour);
          stack.push(neighbour);
        }
      }
    }
  }
  return count;
}
```

Run on the six-vertex example, the stack and `seen` evolve like this for the
first start, vertex 0 (the adjacency list is 0: [1], 1: [0, 2], 2: [1]):

| Step | Popped | Pushed | `seen` afterwards | Stack afterwards |
| ---- | ------ | ------ | ----------------- | ---------------- |
| 0    | none   | 0      | {0}               | [0]              |
| 1    | 0      | 1      | {0, 1}            | [1]              |
| 2    | 1      | 2      | {0, 1, 2}         | [2]              |
| 3    | 2      | none   | {0, 1, 2}         | []               |

At step 2 vertex 1 looks at neighbour 0, which is already in `seen`, and at
neighbour 2, which is new. The stack is empty after step 3, so that component
is done and `count` is 1. The outer loop then skips 1 and 2, starts again at 3
(count 2, visiting 4 the same way) and again at 5 (count 3).

A vertex is marked when it is pushed, not when it is popped. If marking waited
until the pop, two edges leading to the same vertex would push it twice, the
stack could hold as many entries as there are edges, and each copy would have
to be checked again on its way out. Marking on push puts each vertex on the
stack once. The `seen` check on neighbour 0 in step 2 is also what stops the
walk from bouncing forever between 0 and 1 over their shared edge, since in an
undirected graph every edge appears in both lists. The price is that the visit
order is no longer strictly depth-first: a vertex pushed early by one
neighbour is skipped when a deeper vertex reaches it, and waits on the stack
instead. For `{0: [1, 2], 1: [0, 3], 2: [0, 4, 3], 3: [2, 1], 4: [2]}` the
order is 0, 2, 3, 4, 1, where true depth-first order would go from 3 straight
to 1. Counting pieces needs only reachability, so this is fine here; when the
order itself matters, as in the cycle check below, the stack has to hold the
path.

Why an explicit stack, not a function that calls itself for each neighbour?
That recursive version is shorter, and each call waits on the **call stack**,
the memory a language keeps for functions that have started and not finished.
That memory is limited. I ran a recursive DFS in Python on a path of 5,000
vertices (each one linked to the next), and with Python's default limit of 1,000
nested calls it raised `RecursionError`. In JavaScript, on the Node 24 I ran, a
function that only calls itself overflowed with a `RangeError` after about
12,000 calls, and the exact figure depends on the engine and the size of each
call. Real inputs, such as a long chain of dependencies or a grid with a
winding corridor of land, can nest far deeper than that. A list used as a stack
lives on the ordinary heap and grows as far as memory allows.

```python
def count_islands(grid: list[list[int]]) -> int:
    """Groups of 1-cells (land) joined up, down, left or right, in a 0/1 grid."""
    rows = len(grid)
    cols = len(grid[0]) if grid else 0
    seen: set[tuple[int, int]] = set()
    count = 0
    for row in range(rows):
        for col in range(cols):
            if grid[row][col] != 1 or (row, col) in seen:
                continue
            count += 1
            seen.add((row, col))
            stack = [(row, col)]
```

```typescript
/** Groups of 1-cells (land) joined up, down, left or right, in a 0/1 grid. */
export function countIslands(grid: number[][]): number {
  const rows = grid.length;
  const cols = rows > 0 ? grid[0].length : 0;
  const seen = grid.map((row) => row.map(() => false));
  let count = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (grid[row][col] !== 1 || seen[row][col]) continue;
      count++;
      seen[row][col] = true;
      const stack: [number, number][] = [[row, col]];
```

The shape matches `count_components`, with the vertex list replaced by a scan
over every cell. A cell starts an island only if it is land and not already
seen. Water is skipped, and land that an earlier flood already reached belongs
to an island that was already counted. The `seen` record is kept apart from the
grid, so the caller's grid is not changed; the shortcut of overwriting visited
land with 0 saves memory but destroys the input. Python uses a set of
`(row, col)` pairs and TypeScript a grid of booleans, because a JavaScript
array of numbers cannot serve as a set key by value. The empty grid `[]` and a
grid of empty rows `[[]]` both give zero columns, so the loops never run and
the answer is 0.

```python
            while stack:
                r, c = stack.pop()
                for nr, nc in ((r - 1, c), (r + 1, c), (r, c - 1), (r, c + 1)):
                    inside = 0 <= nr < rows and 0 <= nc < cols
                    if inside and grid[nr][nc] == 1 and (nr, nc) not in seen:
                        seen.add((nr, nc))
                        stack.append((nr, nc))
    return count
```

```typescript
      while (stack.length > 0) {
        const [r, c] = stack.pop()!;
        for (const [nr, nc] of [
          [r - 1, c],
          [r + 1, c],
          [r, c - 1],
          [r, c + 1],
        ]) {
          const inside = nr >= 0 && nr < rows && nc >= 0 && nc < cols;
          if (inside && grid[nr][nc] === 1 && !seen[nr][nc]) {
            seen[nr][nc] = true;
            stack.push([nr, nc]);
          }
        }
      }
    }
  }
  return count;
}
```

The four neighbours are computed on the spot from the coordinates. The bounds
check `inside` has to come before the grid is indexed, because the grid edges
are where this goes wrong. For a cell in the top row, `r - 1` is -1. In Python
`grid[-1]` does not fail: it is the last row (I ran it and got `[0, 0]` for a
two-row grid), so the code would quietly treat the bottom row as adjacent to
the top one and merge islands that are far apart. In JavaScript `grid[-1]` is
`undefined`, and reading `[c]` from it throws a `TypeError`. In both languages,
`and` / `&&` stops at the first false part, so out-of-range coordinates never
reach the indexing. Only the four orthogonal moves are listed; adding the four
diagonals would count the grid `[[1, 0], [0, 1]]` as one island instead of two.

On the 4 by 5 grid shown in "The idea", the scan finds land at row 0, column 0
and floods the 2 by 2 block; it next finds land at row 2, column 2 and floods
just that cell; then land at row 3, column 3, which reaches column 4 beside it.
The answer is 3.

```python
UNVISITED, ON_PATH, FINISHED = 0, 1, 2


def has_cycle(graph: dict[int, list[int]]) -> bool:
    """Whether a directed graph (vertex -> out-neighbours) contains a cycle."""
    state = {vertex: UNVISITED for vertex in graph}
    for start in graph:
        if state[start] != UNVISITED:
            continue
        state[start] = ON_PATH
        stack = [(start, iter(graph[start]))]
```

```typescript
const UNVISITED = 0;
const ON_PATH = 1;
const FINISHED = 2;

/** Whether a directed graph (vertex -> out-neighbours) contains a cycle. */
export function hasCycle(graph: Map<number, number[]>): boolean {
  const state = new Map<number, number>();
  for (const vertex of graph.keys()) state.set(vertex, UNVISITED);
  for (const start of graph.keys()) {
    if (state.get(start) !== UNVISITED) continue;
    state.set(start, ON_PATH);
    // Each entry is a vertex and how many of its neighbours are already handled.
    const stack: [number, number][] = [[start, 0]];
```

The `seen` set becomes a `state` table with the three states from "The idea".
A vertex that is not unvisited has been handled by an earlier start, so it is
skipped, just as in the component count. The stack changes too. Components could
push all of a vertex's neighbours at once, because only reachability mattered.
Here the exact path matters, and the path is the stack itself: the stack holds
the vertices that are entered and not finished, in the order they were entered,
and those are precisely the vertices marked on the path. To keep a vertex on the
stack while its neighbours are explored one at a time, each entry pairs the
vertex with its position in its neighbour list: an iterator in Python, which
remembers where it stopped, and a counter in TypeScript.

```python
        while stack:
            vertex, neighbours = stack[-1]
            for neighbour in neighbours:
                if state[neighbour] == ON_PATH:
                    return True
                if state[neighbour] == UNVISITED:
                    state[neighbour] = ON_PATH
                    stack.append((neighbour, iter(graph[neighbour])))
                    break
            else:
                state[vertex] = FINISHED
                stack.pop()
    return False
```

```typescript
    while (stack.length > 0) {
      const top = stack[stack.length - 1];
      const [vertex, next] = top;
      const neighbours = graph.get(vertex)!;
      if (next === neighbours.length) {
        state.set(vertex, FINISHED);
        stack.pop();
        continue;
      }
      top[1]++;
      const neighbour = neighbours[next];
      if (state.get(neighbour) === ON_PATH) return true;
      if (state.get(neighbour) === UNVISITED) {
        state.set(neighbour, ON_PATH);
        stack.push([neighbour, 0]);
      }
    }
  }
  return false;
}
```

Each pass looks at the top of the stack without removing it. Python's
`for ... else` runs the `else` branch only when the loop ran out of neighbours
without a `break`, which is the signal that this vertex is finished, so it is
marked and popped. The `break` after pushing a new neighbour hands control back
to the `while`, which now sees the new vertex on top and goes deeper. When that
vertex finishes and is popped, the old vertex is on top again, and because its
iterator was kept, the loop resumes with the next neighbour, not the first.
The TypeScript version does the same with the counter: it advances `top[1]`
before looking at the neighbour, so when control returns to this vertex the
counter already points past the neighbour that was just explored.

The edge to an on-path vertex returns `True` at once; an edge to a finished
vertex falls through both `if`s and is ignored, and that fall-through is the
diamond case. On the diamond (0 → 1, 0 → 2, 1 → 3, 2 → 3), the search enters 0,
then 1, then 3. Vertex 3 has no neighbours, so it finishes, then 1 finishes.
Back at 0 the next neighbour is 2, which is entered. Its neighbour 3 is
finished, so nothing happens; 2 and 0 then finish and the answer is `False`.
Change `== ON_PATH` to `!= UNVISITED` (the two-state check) and the same run
returns `True` when 2 meets 3, which is the false cycle. On the graph
0 → 1, 1 → 2, 2 → 1, the path grows to 0, 1, 2; then 2 looks at 1, which is on
the path, and the function returns `True`.

## Complexity

With V vertices and E edges, `count_components` and `has_cycle` take O(V + E)
time. Every vertex goes on the stack once and comes off once, and every vertex's
neighbour list is scanned once, so each edge is looked at once (twice for
`count_components`, since an undirected edge is stored in both lists), plus the
outer loop over the V vertices. The extra memory is O(V): the `seen` set or
`state` table holds up to V entries, and the stack never holds more than V
vertices.

`count_islands` takes O(R × C) time for a grid of R rows and C columns: each
cell is pushed at most once, and each pushed cell makes four neighbour checks,
a constant. Memory is O(R × C) in the worst case, an all-land grid, where the
`seen` record ends up with an entry for every cell. The stack holds only cells
that are marked and not yet popped, so it is bounded by the same R × C.

## Pitfalls

- **Recursing on large inputs.** A recursive DFS works on small graphs and
  fails on a long chain, with `RecursionError` in Python at about 1,000 levels
  and `RangeError` in JavaScript at about 12,000 levels in the Node I ran. The explicit
  stack in this entry has no such limit.
- **Marking on pop when only reachability matters.** Marking a vertex when it
  is popped gives true depth-first order, but a vertex can then be pushed once
  for every edge that reaches it, so the stack grows from at most V entries to
  as many as E, and each copy has to be checked against `seen` again after it
  is popped. For counting, mark on push.
- **Two states for cycle detection in a directed graph.** A vertex reached
  twice by different routes, as in the diamond, is reported as a cycle. A vertex
  must be **on the path** to count; once finished, it is safe to meet again.
- **Using the three-state check on an undirected graph.** Every undirected edge
  appears in both directions, so the very first edge walked leads straight back
  to the vertex it came from, which is on the path, and every graph with an
  edge looks cyclic. An undirected cycle needs the parent tracked and
  ignored; that is outside this entry.
- **Forgetting that a vertex may only be a neighbour.** Both functions look up
  every vertex they meet, so a vertex that appears in some list but is missing
  as a key raises `KeyError` in Python, and in TypeScript `graph.get(...)` is
  `undefined`, which fails on the next line. Every vertex must be a key, and
  an isolated vertex maps to an empty list.
- **Indexing before checking the bounds on a grid.** `grid[-1]` silently wraps
  to the last row in Python and is `undefined` in JavaScript, as shown above.
  Check the bounds first.
- **Counting diagonals as neighbours,** or marking land as visited by writing 0
  into the caller's grid, which changes the data the caller still owns.
