---
title: Topological Sort
summary: Lining up the vertices of a directed graph so every edge points from an earlier vertex to a later one, which is possible exactly when there is no cycle, and is how you order courses, build steps or tasks that depend on each other.
date: 2026-10-01
kind: algorithm
---

Some jobs must happen before others: you take Algebra before Calculus, compile
a library before the program that uses it. Draw each "A must come before B" as
an arrow from A to B and you have a directed graph. A **topological order** is a
line-up of all its vertices in which every arrow points forward, from an earlier
position to a later one. This entry shows two ways to produce one, and both
also notice when none exists.

## Prerequisites

- [Graph Depth-First Search](/dsa/graph-dfs), for the walk that goes deep
  before backing up, the explicit stack that replaces recursion, and the three
  states (unvisited, on the path, finished) that detect a cycle in a directed
  graph. The DFS method below is that cycle detection with one extra line.
- [Queue and Deque](/dsa/queue-and-deque), for first in, first out: items leave
  in the order they arrived. Kahn's method keeps its ready vertices in one. In
  Python the queue is a `deque`, whose `popleft` is O(1).

The graph is the adjacency list from that entry: a dictionary (a `Map` in
TypeScript) from each vertex to the list of vertices its edges point at.

## The idea

A topological order exists exactly when the graph has no **cycle**, a path that
leads from a vertex back to itself. If A must precede B and B must precede A,
no line-up can satisfy both. With no cycle, one always exists, and the two
methods below are two ways to build it.

The order is rarely unique. With edges 0 → 1 and 0 → 2, both `0, 1, 2` and
`0, 2, 1` are valid. So the code needs a tie rule, and the rule is part of what
it does; the two rules are stated exactly below.

**Kahn's algorithm.** The **in-degree** of a vertex is the number of edges
pointing into it. A vertex with in-degree 0 has nothing that must come before
it, so it can go first. Put every such vertex in a queue. Take one off the
front, append it to the output, and delete its outgoing edges, which means
subtracting 1 from the in-degree of each vertex it points at. Any vertex that
drops to 0 is now ready and joins the back of the queue. Repeat until the queue
is empty.

If the output has all V vertices, it is a topological order. If it has fewer,
the leftover vertices never reached in-degree 0, because each waits on another
leftover one: the graph has a cycle. Take edges 0 → 1, 1 → 2, 2 → 1. Vertex 0
has in-degree 0, vertex 1 has 2 and vertex 2 has 1. Output 0, and vertex 1
drops to 1. The queue is empty with 1 of 3 vertices out, so there is a cycle.

The tie rule: the queue starts with the in-degree-0 vertices in the order the
code lists the vertices (the dictionary's keys in order, then vertices that
appear only as edge targets, in the order they are met), and each later vertex
joins the queue at the moment its in-degree reaches 0. Ties go to whichever
became ready first.

**The DFS method.** Run depth-first search from every unvisited vertex. A
vertex is **finished** when all the vertices reachable from it have been
finished first. So in the order vertices finish, every vertex comes after
everything it points to. That is the order backwards: reverse the list of
finished vertices and every edge points forward. The same three states as in
the DFS entry catch a cycle: an edge to a vertex that is **on the path**
(entered, not finished) leads back to where DFS already is.

The tie rule: start vertices are tried in the same listed order, and each
vertex's neighbours in the order of its edge list. Reversing the finishing
order then flips ties: of two neighbours explored one after the other, the
later one ends up earlier in the output.

Here is `{0: [2, 1], 1: [3], 2: [3], 3: []}`, edges 0 → 2, 0 → 1, 1 → 3, 2 → 3.
Kahn starts with in-degrees 0, 1, 1, 2 for vertices 0 to 3:

| Take | Output so far | Edges removed | In-degrees (0, 1, 2, 3) | Queue after |
| ---- | ------------- | ------------- | ----------------------- | ----------- |
|      |               |               | 0, 1, 1, 2              | 0           |
| 0    | 0             | 0 → 2, 0 → 1  | 0, 0, 0, 2              | 2, 1        |
| 2    | 0, 2          | 2 → 3         | 0, 0, 0, 1              | 1           |
| 1    | 0, 2, 1       | 1 → 3         | 0, 0, 0, 0              | 3           |
| 3    | 0, 2, 1, 3    |               | 0, 0, 0, 0              |             |

The output is `0, 2, 1, 3`. The DFS method enters 0, goes to 2 first (list
order), then 3; 3 finishes, then 2, then DFS goes back to 0 and visits 1 (whose
only edge, to 3, goes to a finished vertex); 1 finishes, then 0. The finishing
order is `3, 2, 1, 0` and its reverse is `0, 1, 2, 3`. Both are valid and they
differ, which is the tie rule at work.

## When to use it

Whenever items have "must come before" constraints and you need a legal
sequence: course prerequisites, the build order of packages or source files,
the order to run tasks in a pipeline, or the order to evaluate spreadsheet
cells that refer to each other. A package manager and a build tool such as
`make` do this. The cycle report is the other half of the value: "these
prerequisites are circular" is an answer, not a failure.

The real use here is **course scheduling**. Given the number of courses and
pairs `(course, prerequisite)`, return an order in which every course comes
after its prerequisites, or report that none exists. The pair is a "prerequisite
before course" edge, so the graph edge points from the prerequisite to the
course.

Choose Kahn's method when you want the order built front to back, as work
becomes available, or need to know which tasks can run at the same time (the
ones in the queue together). Choose the DFS method when you are already doing
a depth-first walk. For a graph with weights, shortest paths on an acyclic
graph use this order too, but that is a separate algorithm. If the graph is
undirected, the idea doesn't apply: an undirected edge has no direction to
point forward.

## Walkthrough

```python
from collections import deque

UNVISITED, ON_PATH, FINISHED = 0, 1, 2


def all_vertices(graph: dict[int, list[int]]) -> list[int]:
    """Every vertex: the keys in order, then targets that are not keys, as met."""
    vertices = dict.fromkeys(graph)
    for targets in graph.values():
        for target in targets:
            vertices.setdefault(target)
    return list(vertices)
```

```typescript
export type Graph = Map<number, number[]>;

const UNVISITED = 0;
const ON_PATH = 1;
const FINISHED = 2;

/** Every vertex: the keys in order, then targets that are not keys, as met. */
export function allVertices(graph: Graph): number[] {
  const vertices = new Set(graph.keys());
  for (const targets of graph.values()) {
    for (const target of targets) vertices.add(target);
  }
  return [...vertices];
}
```

The adjacency list only has keys for vertices that have edges listed, so a
vertex that appears only as a target, like 2 in `{1: [2]}`, has no key. If the
code counted only the keys, it would drop 2 from the output and, worse, test
for a cycle against the wrong total. This function collects keys first and
then targets. It uses a dictionary with no values and a `Set` because both
remember the order things were added and ignore repeats, which is what makes
the tie rules above exact: the same input always gives the same order. The
three constants name the DFS states so the code reads as `ON_PATH` rather than
as the number 1.

```python
def topological_sort(graph: dict[int, list[int]]) -> list[int] | None:
    """Kahn's algorithm: an order with every edge going forward, or None on a cycle.

    Ties go to the vertex that became ready first; the starting ones are taken
    in `all_vertices` order.
    """
    vertices = all_vertices(graph)
    in_degree = dict.fromkeys(vertices, 0)
    for targets in graph.values():
        for target in targets:
            in_degree[target] += 1
    queue = deque(vertex for vertex in vertices if in_degree[vertex] == 0)
    order: list[int] = []
```

```typescript
/**
 * Kahn's algorithm: an order with every edge going forward, or null on a cycle.
 * Ties go to the vertex that became ready first; the starting ones are taken
 * in `allVertices` order.
 */
export function topologicalSort(graph: Graph): number[] | null {
  const vertices = allVertices(graph);
  const inDegree = new Map<number, number>(vertices.map((vertex) => [vertex, 0]));
  for (const targets of graph.values()) {
    for (const target of targets) inDegree.set(target, inDegree.get(target)! + 1);
  }
  // The output doubles as the queue: `head` is the front, the end is the back.
  const order = vertices.filter((vertex) => inDegree.get(vertex) === 0);
```

Every vertex starts at in-degree 0 and each edge adds 1 to the vertex it
points at, so after the loop each count is the number of edges into it. A
repeated edge is counted twice here and removed twice later, so duplicates
cancel out. The vertices with count 0 are exactly the ones that can go first,
and they are collected in `vertices` order, which is the first half of the tie
rule. The Python version uses a `deque` because taking from the front of a
plain list is O(n), as every remaining item shifts down. The TypeScript version
needs no separate queue: `order` is filled from the back, and a position
counter `head` marks how far the front has advanced, so the vertices behind
`head` are the output so far and the ones from `head` onward are still waiting.

```python
    while queue:
        vertex = queue.popleft()
        order.append(vertex)
        for target in graph.get(vertex, []):
            in_degree[target] -= 1
            if in_degree[target] == 0:
                queue.append(target)
    return order if len(order) == len(vertices) else None
```

```typescript
  for (let head = 0; head < order.length; head++) {
    for (const target of graph.get(order[head]) ?? []) {
      const left = inDegree.get(target)! - 1;
      inDegree.set(target, left);
      if (left === 0) order.push(target);
    }
  }
  return order.length === vertices.length ? order : null;
}
```

Taking a vertex out removes its edges, so each target's count drops by one.
The test is `== 0`: a vertex joins the queue at the single moment its last
waiting edge is removed, so it is queued exactly once. Writing `<= 1` fires
one edge too early, while a prerequisite is still waiting. That vertex is
queued before it should be, its edges are removed early, and the count of the
vertex it was waiting on can then reach 0 a second time, queuing it twice; on
`{0: [1], 1: [2], 2: [3], 3: [1]}` the loop 1, 2, 3 repeats forever.
`graph.get(vertex, [])`
(`?? []` in TypeScript) covers vertices that have no key. The last line is the
cycle test: vertices on a cycle, and any vertex that is only reachable through
one, never reach 0, so they never come out, and the output is shorter than the
vertex list. Returning the short output as if it were an answer would be wrong,
so the function returns `None` (`null`).

```python
def topological_sort_dfs(graph: dict[int, list[int]]) -> list[int] | None:
    """The DFS method: reverse the finishing order, or None on a cycle.

    Starts are tried in `all_vertices` order and neighbours in list order.
    """
    vertices = all_vertices(graph)
    state = dict.fromkeys(vertices, UNVISITED)
    finished: list[int] = []
    for start in vertices:
        if state[start] != UNVISITED:
            continue
        state[start] = ON_PATH
        stack = [(start, iter(graph.get(start, [])))]
```

```typescript
/**
 * The DFS method: reverse the finishing order, or null on a cycle.
 * Starts are tried in `allVertices` order and neighbours in list order.
 */
export function topologicalSortDfs(graph: Graph): number[] | null {
  const vertices = allVertices(graph);
  const state = new Map<number, number>(vertices.map((vertex) => [vertex, UNVISITED]));
  const finished: number[] = [];
  for (const start of vertices) {
    if (state.get(start) !== UNVISITED) continue;
    state.set(start, ON_PATH);
    // Each entry is a vertex and how many of its neighbours are already handled.
    const stack: [number, number][] = [[start, 0]];
```

The outer loop starts a fresh DFS from every vertex not yet reached, because
one start rarely reaches the whole graph, and a vertex marked `ON_PATH` or
`FINISHED` by an earlier walk is skipped. Marking the start `ON_PATH` as it is
pushed, not later, means a self-loop (an edge from the start to itself) is
caught on the first look at its neighbours. The recursive version of DFS would
use the call stack; here an explicit `stack` holds, for each vertex on the
path, where it stopped among its neighbours. Python keeps that place in an
iterator (`iter`), which remembers its position; TypeScript keeps an index.
A recursive version fails with "maximum recursion depth exceeded" on a chain of
tens of thousands of vertices, and this one does not.

```python
        while stack:
            vertex, neighbours = stack[-1]
            for neighbour in neighbours:
                if state[neighbour] == ON_PATH:
                    return None
                if state[neighbour] == UNVISITED:
                    state[neighbour] = ON_PATH
                    stack.append((neighbour, iter(graph.get(neighbour, []))))
                    break
            else:
                state[vertex] = FINISHED
                finished.append(vertex)
                stack.pop()
    finished.reverse()
    return finished
```

```typescript
    while (stack.length > 0) {
      const top = stack[stack.length - 1];
      const [vertex, next] = top;
      const neighbours = graph.get(vertex) ?? [];
      if (next === neighbours.length) {
        state.set(vertex, FINISHED);
        finished.push(vertex);
        stack.pop();
        continue;
      }
      top[1]++;
      const neighbour = neighbours[next];
      if (state.get(neighbour) === ON_PATH) return null;
      if (state.get(neighbour) === UNVISITED) {
        state.set(neighbour, ON_PATH);
        stack.push([neighbour, 0]);
      }
    }
  }
  return finished.reverse();
}
```

Each pass looks at the top vertex's next neighbour. An `ON_PATH` neighbour
means an edge back into the chain DFS is standing on, which is a cycle, so
return at once. An `UNVISITED` neighbour is pushed and explored first. A
`FINISHED` neighbour is skipped: it is not a cycle, which is why the state
needs three values and not two. With only "seen" and "not seen", the diamond
0 → 1, 0 → 2, 1 → 3, 2 → 3 would look like a cycle when DFS reaches 3 a second
time. When a vertex has no neighbours left, it is marked `FINISHED` and
appended, which is the moment everything it points at has already been
appended. The Python `for ... else` runs the `else` only when the loop was not
cut short by `break`, that is, when every neighbour was handled. Reversing
`finished` at the end turns "finished after everything it points to" into
"comes before everything it points to".

```python
def course_order(
    num_courses: int, prerequisites: list[tuple[int, int]]
) -> list[int] | None:
    """An order to take courses 0..num_courses-1, or None if prerequisites loop.

    Each pair is (course, prerequisite): the prerequisite comes first.
    """
    graph: dict[int, list[int]] = {course: [] for course in range(num_courses)}
    for course, prerequisite in prerequisites:
        graph[prerequisite].append(course)
    return topological_sort(graph)
```

```typescript
/**
 * An order to take courses 0..numCourses-1, or null if prerequisites loop.
 * Each pair is [course, prerequisite]: the prerequisite comes first.
 */
export function courseOrder(
  numCourses: number,
  prerequisites: [number, number][],
): number[] | null {
  const graph: Graph = new Map();
  for (let course = 0; course < numCourses; course++) graph.set(course, []);
  for (const [course, prerequisite] of prerequisites) {
    graph.get(prerequisite)!.push(course);
  }
  return topologicalSort(graph);
}
```

The pair is written `(course, prerequisite)` but the edge must point from what
comes first to what comes after, so the edge is `prerequisite → course`, and
the code appends `course` to the prerequisite's list. Writing
`graph[course].append(prerequisite)` instead reverses every arrow and returns
an order that is valid for the reversed graph: the prerequisites come last.
Every course is given a key up front, even one with no prerequisites and no
dependants, so that it still appears in the output; `course_order(3, [])`
returns `[0, 1, 2]`. For `course_order(4, [(1, 0), (2, 0), (3, 1), (3, 2)])`,
course 3 needs 1 and 2, which each need 0, the graph is `{0: [1, 2], 1: [3],
2: [3], 3: []}`, and Kahn's method returns `[0, 1, 2, 3]`.

## Complexity

Let V be the number of vertices and E the number of edges. Both methods run in
O(V + E) time. Kahn's method counts in-degrees by looking at each edge once,
takes each vertex off the queue once (a vertex joins it only when its count
reaches 0, which happens once), and removes each edge once, so the total is V
plus E. The DFS method enters and finishes each vertex once and looks at each
edge once, also V plus E. Building the vertex list is one pass over the vertices
and edges, which is the same bound. The extra space is O(V) for the in-degree
or state table, the queue or stack, and the output; the input graph itself takes
O(V + E) and is not counted.

## Pitfalls

- **Forgetting vertices that appear only as targets.** In `{1: [2]}`, vertex 2
  has no key. Looping over the keys misses it, so the order is `[1]` and the
  size check passes against the wrong total. `all_vertices` fixes both.
- **Not checking the output size.** After Kahn's loop, a cycle just leaves the
  loop with a short output and no error. The comparison with the vertex count is
  the only place the cycle is noticed.
- **Reversed edges.** Whether an edge points from the prerequisite to the course
  or the other way decides whether the order is right or backwards. State
  which way an edge points before writing any code, as `course_order` does.
- **Two states in DFS.** "Seen" and "not seen" report a diamond as a cycle. The
  on-the-path state is what separates an edge back to the current chain from an
  edge to a vertex finished earlier.
- **Forgetting to reverse the DFS output.** The finishing order has every edge
  pointing backward. Without the final `reverse` the result is a valid order
  of the reversed graph, not of this one.
- **Recursion on deep graphs.** A recursive DFS overflows the call stack on a
  long chain; Python's default limit is 1000 frames. The explicit stack here has
  no such limit, and the tests sort a chain of 50,000 vertices.
- **Expecting one answer.** Valid orders are usually many, so a test that
  compares against one hard-coded list is checking the tie rule, not
  correctness. Check that every vertex appears once and every edge goes
  forward, as the tests here do, unless you mean to pin the rule.
