---
title: Breadth-First Search
summary: Exploring a graph or grid in rings outward from one or many starts with a queue, so the first route found to anything uses the fewest steps.
date: 2026-10-05
kind: algorithm
template: 2
---

Breadth-first search (BFS) visits everything one step from the start, then everything two steps away, then three, and so on. You'll run it two ways on small examples: on a graph, to find a path with the fewest edges, and on a grid, to find how long a spread from several sources takes. Both are one loop around a queue.

## Prerequisites

- [Graph](/dsa/graph): the search reads an adjacency list, one list of neighbors per vertex, with vertices numbered 0 to n - 1. A grid is a graph whose neighbors come from coordinates.
- [Stacks and queues](/dsa/stacks-and-queues): a queue gives items back in arrival order, and BFS needs removing from the front to be cheap.

## The idea

A queue holds the vertices that are found but not yet scanned. Take one from the front, look at each neighbor, and add every neighbor you haven't seen to the back. Since the queue is first in, first out, everything one edge from the start is scanned before anything two edges away, and the first time you reach a vertex is by a route with the fewest edges.

That only works because every step adds exactly 1. The queue holds vertices at distance d, then at d + 1, never mixed, so the order of reaching vertices is the order of their distances. If edges had weights, the first route to a vertex could be beaten by a route with more edges that costs less, and the queue order would no longer be the cost order. That is a job for Dijkstra's algorithm.

Here is the running graph, undirected, with 7 edges:

```text
0: [1, 2]    1: [0, 3]    2: [0, 3, 4]
3: [1, 2, 5]    4: [2, 5]    5: [3, 4]
```

Search from 0 for 5, recording each vertex's **parent**, the vertex it was first reached from:

| Pop | Scans   | Newly queued (parent) | Queue after |
| --- | ------- | --------------------- | ----------- |
| 0   | 1, 2    | 1 (0), 2 (0)          | 1, 2        |
| 1   | 0, 3    | 3 (1)                 | 2, 3        |
| 2   | 0, 3, 4 | 4 (2)                 | 3, 4        |
| 3   | 1, 2, 5 | 5 (3)                 | 4, 5        |

Vertex 5 is found while scanning 3, so the search stops. Following parents back, 5 to 3 to 1 to 0, gives the path 0, 1, 3, 5: 3 edges. On a tree, drop the visited set, since a node has only one way in; [Binary tree](/dsa/binary-tree) builds its levels with the same queue idea.

## When to use it

- The statement asks for the fewest steps, moves, hops or edges between two things when every step costs the same.
- The input is a maze, a grid or a graph of states (word ladder, knight moves) and "minimum number of moves" is the question.
- Something spreads from several places at once and you want the time until it covers everything: rotting fruit, fire, flooding, "distance to the nearest gate".
- You want a tree's minimum depth or its nearest leaf: BFS stops at the first leaf it pops, where a depth-first walk must visit the whole tree to be sure.
- Steps have different costs, so a fewest-edges path isn't the cheapest one. That is Dijkstra's job, not this one's.

## Walkthrough

The graph search needs a queue and a record of what it has reached. A dictionary from vertex to parent does both jobs.

```python
from collections import deque


def shortest_path(adj: list[list[int]], source: int, target: int) -> list[int] | None:
    """A path from source to target with the fewest edges, or None."""
    # parent doubles as the visited set, and a vertex goes in when it is
    # queued, not when it is popped: marked later, a vertex that two queued
    # neighbors both reach is queued twice and its neighbors scanned twice.
    parent: dict[int, int | None] = {source: None}
    queue = deque([source])
    # Stop once target is found: its parent is already a shortest route,
    # and waiting to pop it would scan every vertex queued ahead of it.
    while queue and target not in parent:
        v = queue.popleft()  # a list's pop(0) shifts every item, O(n) a pop
        for w in adj[v]:
            if w not in parent:
                parent[w] = v
                queue.append(w)
```

```typescript
export function shortestPath(
  adj: number[][],
  source: number,
  target: number,
): number[] | null {
  // parent doubles as the visited set, and a vertex goes in when it is
  // queued, not when it is popped: marked later, a vertex that two queued
  // neighbors both reach is queued twice and its neighbors scanned twice.
  const parent = new Map<number, number | null>([[source, null]]);
  const queue = [source];
  // Stop once target is found: its parent is already a shortest route,
  // and waiting to pop it would scan every vertex queued ahead of it.
  // head walks the array instead of shift(): shift moves every item, O(n) a pop.
  for (let head = 0; head < queue.length && !parent.has(target); head++) {
    for (const w of adj[queue[head]]) {
      if (!parent.has(w)) {
        parent.set(w, queue[head]);
        queue.push(w);
      }
    }
  }
```

In the table, vertex 3 is queued while scanning 1, so when 2 scans it later, 3 is already in `parent` and is skipped. This run popped 4 of the 6 vertices and read 10 of the 14 adjacency entries before it stopped. The queue only found the target; the path comes from walking the parents.

```python
    if target not in parent:
        return None
    path: list[int] = []
    node: int | None = target
    while node is not None:
        path.append(node)
        node = parent[node]
    # Parents point back toward the source, so the walk comes out reversed.
    return path[::-1]
```

```typescript
  if (!parent.has(target)) return null;
  const path: number[] = [];
  for (let node: number | null = target; node !== null; node = parent.get(node)!) {
    path.push(node);
  }
  // Parents point back toward the source, so the walk comes out reversed.
  return path.reverse();
}
```

A target the search never reached is absent from `parent`, which is how unreachable shows up. The source's parent is `None`, which ends the walk, so `source == target` returns `[source]` without scanning anything. Now several sources at once, on a grid, where the answer is how many rounds the spread takes.

```python
def minutes_to_rot(grid: list[list[int]]) -> int:
    """Minutes until every fresh cell (1) rots, or -1 if one never does.

    Cells are 0 empty, 1 fresh, 2 rotten; rot spreads up, down, left, right.
    """
    rows, cols = len(grid), len(grid[0]) if grid else 0
    seen: set[tuple[int, int]] = set()
    fresh = 0
    for r in range(rows):
        for c in range(cols):
            cell = grid[r][c]
            if cell == 2:
                seen.add((r, c))
            elif cell == 1:
                fresh += 1
    # Every rotten cell starts in the queue, so one search spreads from all of
    # them at once; a search per source repeats work and needs a merge of answers.
    queue = deque(seen)
    minutes = 0
    while queue and fresh:
        # Fix the count now: cells rotted this minute join the queue, so
        # asking len(queue) again would run them in the same minute.
        for _ in range(len(queue)):
            r, c = queue.popleft()
            for nr, nc in ((r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1)):
                # Bounds before indexing: grid[-1] is the last row in Python,
                # not off the edge. Marked when queued, as in shortest_path.
                if 0 <= nr < rows and 0 <= nc < cols and (nr, nc) not in seen:
                    if grid[nr][nc] == 1:
                        seen.add((nr, nc))
                        fresh -= 1
                        queue.append((nr, nc))
        minutes += 1
    return -1 if fresh else minutes
```

```typescript
/** Minutes until every fresh cell (1) rots, or -1 if one never does. */
export function minutesToRot(grid: number[][]): number {
  const rows = grid.length;
  const cols = rows > 0 ? grid[0].length : 0;
  // Keyed r * cols + c: a Set of [r, c] arrays would compare by reference.
  const seen = new Set<number>();
  const queue: [number, number][] = [];
  let fresh = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === 2) {
        seen.add(r * cols + c);
        queue.push([r, c]);
      } else if (grid[r][c] === 1) fresh++;
    }
  }
  // Every rotten cell starts in the queue, so one search spreads from all of
  // them at once; a search per source repeats work and needs a merge of answers.
  let head = 0;
  let minutes = 0;
  while (head < queue.length && fresh > 0) {
    // Fix the end now: cells rotted this minute join the queue, so reading
    // queue.length again would run them in the same minute.
    for (const end = queue.length; head < end; head++) {
      const [r, c] = queue[head];
      for (const [nr, nc] of [
        [r + 1, c],
        [r - 1, c],
        [r, c + 1],
        [r, c - 1],
      ]) {
        // Bounds before indexing: grid[-1] is undefined here, and indexing it
        // throws. Marked when queued, as in shortestPath.
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
        if (grid[nr][nc] === 1 && !seen.has(nr * cols + nc)) {
          seen.add(nr * cols + nc);
          fresh--;
          queue.push([nr, nc]);
        }
      }
    }
    minutes++;
  }
  return fresh > 0 ? -1 : minutes;
}
```

Take the grid `[[2, 1, 1], [1, 1, 0], [0, 1, 2]]`, with two rotten cells. Minute 1 starts with a queue of 2 and rots 3 cells, (0,1), (1,0) and (2,1). Minute 2 starts with 3, rots (0,2) and (1,1), and leaves no fresh cell, so the answer is 2; with only the top-left source it would be 4. Taking `len(queue)` at the start of a minute is what turns the queue into a count of minutes.

## Complexity

`shortest_path` is O(V + E) time: each vertex is queued at most once because of `parent`, so each adjacency list is read once, and every entry in it is checked once. The example's 14 entries are 2E for an undirected graph; a directed graph has E. It uses O(V) space for `parent` and the queue, and the path adds at most V more. The early stop doesn't change the worst case, when the target is the last thing found or isn't reachable.

`minutes_to_rot` is O(R × C) time and space for R rows and C columns: each cell is queued at most once, and each queued cell checks four neighbors. Seeding every source first costs nothing extra, which is why one search beats one per source.

## Pitfalls

- **Marking a vertex when you pop it.** In `shortest_path`, `parent[w] = v` is on the line that queues `w`. Move it to the pop and 3 enters the queue twice in the example, and its neighbors are scanned twice; on a dense graph the repeats multiply.
- **Removing from the front of a list.** `queue.pop(0)` in Python and `queue.shift()` in TypeScript move every remaining item, so each pop costs O(n) and a long search becomes quadratic. `deque.popleft` and the head index are O(1).
- **Asking the queue's length again inside the minute loop.** In `minutes_to_rot`, `range(len(queue))` is evaluated once. A loop that re-read the length would run the cells just rotted in the same minute, and the example would come back as 1.
- **Indexing before the bounds check.** In `minutes_to_rot`, a neighbor at row -1 reads `grid[-1]`, the last row, in Python, so rot leaks across the edge; in TypeScript the same read throws. The `0 <= nr < rows` test comes first for both.
