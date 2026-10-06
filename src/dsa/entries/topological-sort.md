---
title: Topological Sort
summary: Lining up the vertices of a directed graph so every edge points forward, which is possible exactly when there is no cycle.
date: 2026-10-05
kind: algorithm
template: 2
---

Some jobs must happen before others: you take Algebra before Calculus, compile a library before the program that uses it. Draw each "A before B" as an arrow from A to B and you have a directed graph. A **topological order** lines up every vertex so that every arrow points forward. You'll build one two ways, and both tell you when none exists.

## Prerequisites

- [Graph](/dsa/graph): directed edges and the adjacency list, where `adj[u]` holds the vertices `u` points at.
- [Depth-first search](/dsa/depth-first-search): the three states, unvisited, on the path and finished, and the recursive walk that the second method records the end of.
- [Stacks and queues](/dsa/stacks-and-queues): the first method keeps its ready vertices in a queue, first in, first out.

## The idea

Take five courses, 0 to 4, where 1 and 2 need 0, 3 needs both 1 and 2, and 4 needs 3. Each prerequisite points at what it unlocks: 0→1, 0→2, 1→3, 2→3, 3→4, so `adj = [[1, 2], [3], [3], [4], []]`. Both `0, 1, 2, 3, 4` and `0, 2, 1, 3, 4` are valid orders; there are usually many, so the code needs a tie rule, and the tests pin it.

An order exists exactly when the graph has no **cycle**, a path that returns to its start. If A must precede B and B must precede A, no line-up satisfies both. With no cycle, one always exists.

**Kahn's algorithm** asks who can go first. The **in-degree** of a vertex is the number of arrows pointing into it, so a vertex with in-degree 0 waits on nothing. Queue every such vertex. Take one off the front, output it, and delete its outgoing arrows by subtracting 1 from each target's in-degree. A target that drops to 0 joins the back. On the example:

| Take | In-degrees of 0 to 4 after | Queue after |
| ---- | -------------------------- | ----------- |
|      | 0, 1, 1, 2, 1              | 0           |
| 0    | 0, 0, 0, 2, 1              | 1, 2        |
| 1    | 0, 0, 0, 1, 1              | 2           |
| 2    | 0, 0, 0, 0, 1              | 3           |
| 3    | 0, 0, 0, 0, 0              | 4           |
| 4    | 0, 0, 0, 0, 0              |             |

Now add a course 1 also needs 4, the arrow 4→1, which makes 1 wait on 0 and 4. Vertex 1 starts at in-degree 2, and taking 0 and then 2 leaves the queue empty with 2 of 5 vertices out. Vertices 1, 3 and 4 each wait on another one of them, which is a cycle.

**The DFS method** runs a depth-first search from every unvisited vertex. A vertex **finishes** when everything it points at has finished, so in finishing order each vertex comes after its targets. Reverse that list and every arrow points forward. From 0 it goes 1, 3, 4, finishing 4, 3, 1; then back at 0 it tries 2, whose arrow to 3 meets a finished vertex and is ignored; 2 finishes, then 0. Finishing order 4, 3, 1, 2, 0, reversed, is `0, 2, 1, 3, 4`. Kahn gave a different valid order. With 4→1 added, vertex 4's arrow meets 1, which is still on the path, so it's a cycle.

## When to use it

- The statement gives "A must come before B" pairs and asks for a valid order or schedule: courses, build steps, task pipelines, spreadsheet cells that refer to each other.
- The question is whether everything can be finished at all: that is cycle detection in a directed graph, and "no order" is the answer.
- You need the best value along paths in an acyclic graph, such as the longest chain of tasks: process vertices in topological order, so every predecessor is done first.
- You need the tasks that can run at once, or the number of rounds: take Kahn's queue a whole batch at a time.
- The graph is undirected: an undirected edge has no direction to point forward, so this is the wrong tool.

Python's `graphlib.TopologicalSorter` does this for you; in an interview you write it.

## Walkthrough

```python
from collections import deque

# adj[u] lists the vertices u points at, the directed form of the graph entry's list.
Graph = list[list[int]]


def topological_sort(adj: Graph) -> list[int] | None:
    """Kahn's algorithm: an order with every edge going forward, or None on a cycle."""
    in_degree = [0] * len(adj)
    for targets in adj:
        for v in targets:
            in_degree[v] += 1
    # A deque, since list.pop(0) shifts every item and would make this O(V^2).
    queue = deque(u for u in range(len(adj)) if in_degree[u] == 0)
    order: list[int] = []
    while queue:
        u = queue.popleft()
        order.append(u)
        for v in adj[u]:
            in_degree[v] -= 1
            # At 0, not 1: v is ready only when its last prerequisite is placed.
            if in_degree[v] == 0:
                queue.append(v)
    # Vertices on a cycle wait on each other and never come out; a short order is
    # not an answer.
    return order if len(order) == len(adj) else None
```

```typescript
/** adj[u] lists the vertices u points at, the directed form of the graph entry's list. */
export type Graph = number[][];

/** Kahn's algorithm: an order with every edge going forward, or null on a cycle. */
export function topologicalSort(adj: Graph): number[] | null {
  const inDegree = new Array<number>(adj.length).fill(0);
  for (const targets of adj) {
    for (const v of targets) inDegree[v]++;
  }
  const order: number[] = [];
  for (let u = 0; u < adj.length; u++) {
    if (inDegree[u] === 0) order.push(u);
  }
  // The output is the queue, with head chasing its end: shift() moves every item
  // and would make this O(V^2).
  for (let head = 0; head < order.length; head++) {
    for (const v of adj[order[head]]) {
      inDegree[v]--;
      // At 0, not 1: v is ready only when its last prerequisite is placed.
      if (inDegree[v] === 0) order.push(v);
    }
  }
  // Vertices on a cycle wait on each other and never come out; a short order is
  // not an answer.
  return order.length === adj.length ? order : null;
}
```

On the example the queue holds 0, then 1 and 2, then 3, then 4, as the table shows, and the order comes out `0, 1, 2, 3, 4`. With 4→1 added, `order` stops at `[0, 2]`, two of five, and the function returns `None`. Kahn's queue also hands you the tasks that are ready together, which the DFS method can't. Now the same answer from the other direction.

```python
UNVISITED, ON_PATH, FINISHED = 0, 1, 2


def topological_sort_dfs(adj: Graph) -> list[int] | None:
    """Reverse finishing order of a depth-first search, or None on a cycle."""
    state = [UNVISITED] * len(adj)
    finished: list[int] = []

    def visit(u: int) -> bool:
        state[u] = ON_PATH
        for v in adj[u]:
            # An edge into a finished vertex is fine; only the current path is a loop.
            if state[v] == ON_PATH or (state[v] == UNVISITED and not visit(v)):
                return False
        state[u] = FINISHED
        # Appended on exit, when everything u points at is already in the list.
        finished.append(u)
        return True

    for u in range(len(adj)):
        # Every vertex is a start, since one start rarely reaches the whole graph.
        if state[u] == UNVISITED and not visit(u):
            return None
    # Finishing puts each vertex after what it points at; reverse to put it before.
    return finished[::-1]
```

```typescript
const UNVISITED = 0;
const ON_PATH = 1;
const FINISHED = 2;

/** Reverse finishing order of a depth-first search, or null on a cycle. */
export function topologicalSortDfs(adj: Graph): number[] | null {
  const state = new Array<number>(adj.length).fill(UNVISITED);
  const finished: number[] = [];

  const visit = (u: number): boolean => {
    state[u] = ON_PATH;
    for (const v of adj[u]) {
      // An edge into a finished vertex is fine; only the current path is a loop.
      if (state[v] === ON_PATH || (state[v] === UNVISITED && !visit(v))) return false;
    }
    state[u] = FINISHED;
    // Appended on exit, when everything u points at is already in the list.
    finished.push(u);
    return true;
  };

  for (let u = 0; u < adj.length; u++) {
    // Every vertex is a start, since one start rarely reaches the whole graph.
    if (state[u] === UNVISITED && !visit(u)) return null;
  }
  // Finishing puts each vertex after what it points at; reverse to put it before.
  return finished.reverse();
}
```

This is the DFS entry's `has_cycle` with three changes: `finished.append` records each vertex on exit, `visit` returns `True` when no cycle was found, where `has_cycle` returned `True` on finding one, and the list is reversed at the end. Where Kahn gave `0, 1, 2, 3, 4`, this gives `0, 2, 1, 3, 4`, as worked above. Note that the recursion is as deep as the longest path, so a chain of a few thousand vertices overflows Python's default limit and a chain of a million overflows Node's call stack. Kahn's never recurses.

```python
def course_order(n: int, prerequisites: list[tuple[int, int]]) -> list[int] | None:
    """An order to take courses 0..n-1; each pair is (course, prerequisite)."""
    adj: Graph = [[] for _ in range(n)]
    for course, prerequisite in prerequisites:
        # The arrow runs from what comes first to what depends on it.
        adj[prerequisite].append(course)
    return topological_sort(adj)
```

```typescript
/** An order to take courses 0..n-1; each pair is [course, prerequisite]. */
export function courseOrder(
  n: number,
  prerequisites: [number, number][],
): number[] | null {
  const adj: Graph = Array.from({ length: n }, () => []);
  for (const [course, prerequisite] of prerequisites) {
    // The arrow runs from what comes first to what depends on it.
    adj[prerequisite].push(course);
  }
  return topologicalSort(adj);
}
```

Input usually arrives as `(course, prerequisite)` pairs. `course_order(5, [(1, 0), (2, 0), (3, 1), (3, 2), (4, 3)])` builds the example's graph and returns `[0, 1, 2, 3, 4]`.

## Complexity

With V vertices and E edges, both methods take O(V + E) time. Kahn's counts in-degrees with one pass over the edges, dequeues each vertex once, and subtracts once per edge. The DFS method enters each vertex once and looks at each edge once, because a finished vertex is never reset. Both use O(V) extra space: the in-degrees or states, the queue or finished list, and the output. The DFS method's recursion can add up to V frames.

## Pitfalls

- **Skipping the length check.** Without `len(order) == len(adj)`, the example with 4→1 returns `[0, 2]` as though it were an answer.
- **Pointing the arrows backward in `course_order`.** With `adj[course].append(prerequisite)` the example returns `[4, 3, 1, 2, 0]`: a valid order of the reversed graph, with every prerequisite last.
- **Recording a vertex when you enter it.** Moving `finished.append(u)` up to just after `state[u] = ON_PATH` records the order of entry, and reversing that gives `[2, 4, 3, 1, 0]` for the example, with 2 ahead of its prerequisite 0. Only on exit is everything the vertex points at already in the list.
- **Forgetting to reverse.** Without `[::-1]`, the DFS method returns `[4, 3, 1, 2, 0]`, where every arrow points backward.
