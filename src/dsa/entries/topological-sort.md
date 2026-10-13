---
title: Topological Sort
summary: Lining up the vertices of a directed graph so every edge points forward, which is possible exactly when there is no cycle.
date: 2026-10-05
kind: algorithm
---

Some jobs must happen before others: you take Algebra before Calculus, compile a library before the program that uses it. Draw each "A before B" as an arrow from A to B and you have a directed graph. A **topological order** lines up every vertex so that every arrow points forward. Two methods build one, and both tell you when none exists.

## Prerequisites

- [Graph](/dsa/graph): directed edges and the adjacency list, where `adj[u]` holds the vertices `u` points at.
- [Depth-first search](/dsa/depth-first-search): the three states, unvisited, on the path and finished, and the recursive walk, whose finishing order the second method records.
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

```python region=kahn

```

```typescript region=kahn

```

On the example the queue holds 0, then 1 and 2, then 3, then 4, as the table shows, and the order comes out `0, 1, 2, 3, 4`. With 4→1 added, `order` stops at `[0, 2]`, two of five, and the function returns `None`. Kahn's queue also hands you the tasks that are ready together, which the DFS method can't. Now the same answer from the other direction.

```python region=dfs-order

```

```typescript region=dfs-order

```

This is the DFS entry's `has_cycle`, with `finished` passed in as one more argument, and three changes: `finished.append` records each vertex on exit, `visit` returns `True` when no cycle was found, where `has_cycle` returned `True` on finding one, and the list is reversed at the end. Where Kahn gave `0, 1, 2, 3, 4`, this gives `0, 2, 1, 3, 4`, as worked above. Note that the recursion is as deep as the longest path, so a chain of about a thousand vertices overflows Python's default limit and a chain of about ten thousand overflows Node's call stack. Kahn's never recurses.

```python region=course-order

```

```typescript region=course-order

```

Input usually arrives as `(course, prerequisite)` pairs. `course_order(5, [(1, 0), (2, 0), (3, 1), (3, 2), (4, 3)])` builds the example's graph and returns `[0, 1, 2, 3, 4]`.

## Complexity

With V vertices and E edges, both methods take O(V + E) time. Kahn's counts in-degrees with one pass over the edges, dequeues each vertex once, and subtracts once per edge. The DFS method enters each vertex once and looks at each edge once, because a finished vertex is never reset. Both use O(V) extra space: the in-degrees or states, the queue or finished list, and the output. The DFS method's recursion can add up to V frames.

## Pitfalls

- **Skipping the length check.** Without `len(order) == len(adj)`, the example with 4→1 returns `[0, 2]` as though it were an answer.
- **Pointing the arrows backward in `course_order`.** With `adj[course].append(prerequisite)` the example returns `[4, 3, 1, 2, 0]`: a valid order of the reversed graph, with every prerequisite last.
- **Recording a vertex when you enter it.** Moving `finished.append(u)` up to just after `state[u] = ON_PATH` records the order of entry, and reversing that gives `[2, 4, 3, 1, 0]` for the example, with 2 ahead of its prerequisite 0. Only on exit is everything the vertex points at already in the list.
- **Forgetting to reverse.** Without `finished.reverse()`, the DFS method returns `[4, 3, 1, 2, 0]`, where every arrow points backward.
