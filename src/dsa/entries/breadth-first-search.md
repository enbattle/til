---
title: Breadth-First Search
summary: Exploring a graph or grid in rings outward from one or many starts with a queue, so the first route found to anything uses the fewest steps.
date: 2026-10-05
kind: algorithm
---

Breadth-first search (BFS) visits everything one step from the start, then everything two steps away, then three, and so on. You'll run it two ways on small examples: on a graph, to find a path with the fewest edges, and on a grid, to find how long a spread from several sources takes. Both are one loop around a queue.

## Prerequisites

- [Graph](/dsa/graph): the search reads an adjacency list, one list of neighbors per vertex, with vertices numbered 0 to n - 1. A grid is a graph whose neighbors come from coordinates.
- [Stacks and queues](/dsa/stacks-and-queues): a queue gives items back in arrival order, and BFS needs removing from the front to be cheap.

## The idea

A queue holds the vertices that are found but not yet scanned. Take one from the front, look at each neighbor, and add every neighbor you haven't seen to the back. Since the queue is first in, first out, everything one edge from the start is scanned before anything two edges away, and the first time you reach a vertex is by a route with the fewest edges.

That only works because every step adds exactly 1. The queue holds vertices at distance d, then at d + 1, never mixed, so the order of reaching vertices is the order of their distances. If edges had weights, the first route to a vertex could be beaten by a route with more edges that costs less, and the queue order would no longer be the cost order. That is a job for [Dijkstra's algorithm](/dsa/shortest-paths).

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

Vertex 5 is found while scanning 3, so the search stops. Following parents back, 5 to 3 to 1 to 0, gives the path 0, 1, 3, 5: 3 edges. On a tree, drop the visited set, since a node has only one way in; [Binary tree](/dsa/binary-tree) groups its levels the same way, a whole level at a time.

## When to use it

- The statement asks for the fewest steps, moves, hops or edges between two things when every step costs the same.
- The input is a maze, a grid or a graph of states (word ladder, knight moves) and "minimum number of moves" is the question.
- Something spreads from several places at once and you want the time until it covers everything: rotting fruit, fire, flooding, "distance to the nearest gate".
- You want a tree's minimum depth or its nearest leaf: BFS stops at the first leaf it pops, where a depth-first walk must visit the whole tree to be sure.
- Steps have different costs, so a fewest-edges path isn't the cheapest one. That is [Dijkstra's](/dsa/shortest-paths) job, not this one's.

## Walkthrough

The graph search needs a queue and a record of what it has reached. A list holding each vertex's parent, with -1 for "not reached yet", does both jobs. The source is its own parent, which marks it as reached.

```python region=shortest-path

```

```typescript region=shortest-path

```

In the table, vertex 3 is queued while scanning 1, so when 2 scans it later, 3 already has a parent and is skipped. This run popped 4 of the 6 vertices and read 10 of the 14 adjacency entries before it stopped. The queue only found the target; the path comes from walking the parents.

```python region=path-from-parents

```

```typescript region=path-from-parents

```

A target the search never reached still has -1 in `parent`, which is how unreachable shows up. The walk stops on reaching the source. Because the source is its own parent, it counts as reached, so `source == target` returns `[source]` without scanning anything. Now several sources at once, on a grid, where the answer is how many rounds the spread takes.

```python region=minutes-to-rot

```

```typescript region=minutes-to-rot

```

Take the grid `[[2, 1, 1], [1, 1, 0], [0, 1, 2]]`, with two rotten cells. Minute 1 starts with a queue of 2 and rots 3 cells, (0,1), (1,0) and (2,1). Minute 2 starts with 3, rots (0,2) and (1,1), and leaves no fresh cell, so the answer is 2; with only the top-left source, and the bottom-right cell fresh instead of rotten, it would be 4. Taking `len(queue)` at the start of a minute is what turns the queue into a count of minutes.

## Complexity

`shortest_path` is O(V + E) time: each vertex is queued at most once because of `parent`, so each adjacency list is read once, and every entry in it is checked once. The example's 14 entries are 2E for an undirected graph; a directed graph has E. It uses O(V) space for `parent` and the queue, and the path adds at most V more. The early stop doesn't change the worst case, when the target is the last thing found or isn't reachable.

`minutes_to_rot` is O(R × C) time and space for R rows and C columns: each cell is queued at most once, and each queued cell checks four neighbors. Seeding every source first costs nothing extra, which is why one search beats one per source.

## Pitfalls

- **Marking a vertex when you pop it.** In `shortest_path`, `parent[w] = v` is on the line that queues `w`. Move it to the pop and 3 enters the queue twice in the example, and its neighbors are scanned twice; on a dense graph the repeats multiply.
- **Removing from the front of a list.** `queue.pop(0)` in Python and `queue.shift()` in TypeScript move every remaining item, so each pop costs O(n) and a long search becomes quadratic. `deque.popleft` and the head index are O(1).
- **Asking the queue's length again inside the minute loop.** In `minutes_to_rot`, `count = len(queue)` is read once, before the loop. A loop that re-read the length would run the cells just rotted in the same minute, and the example would come back as 1.
- **Indexing before the bounds check.** In `minutes_to_rot`, a neighbor at row -1 reads `grid[-1]`, the last row, in Python, so rot leaks across the edge; in TypeScript the same read throws. The `nr < 0 or nr >= rows` test comes first for both.
