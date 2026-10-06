---
title: Depth-First Search
summary: Following one connection as deep as it goes before backing up, to reach everything in a graph, spot a cycle, or compute a value from the bottom of a tree upward.
date: 2026-10-05
kind: algorithm
template: 2
---

Depth-first search (DFS) explores by committing: step to a neighbor, then to one of its neighbors, and keep going until you are stuck. Then back up to the nearest place with an unexplored option. Here it counts the pieces of a graph, finds a loop in a directed graph, and answers questions about a tree, which is a graph with a root and no loops.

## Prerequisites

- [Graph](/dsa/graph): vertices, edges and the adjacency list, `adj[u]` holding the neighbors of `u`, which every function here takes.
- [Binary tree](/dsa/binary-tree): the node, and its height convention: edges are counted, and the empty tree is -1.
- [Stacks and queues](/dsa/stacks-and-queues): backing up to the latest unfinished place is last in, first out.

## The idea

Two vertices are in the same **connected component** when edges lead from one to the other. Take six vertices with edges 0-1, 1-2 and 3-4; vertex 5 has none. The adjacency list is `[[1], [0, 2], [1], [4], [3], []]`, and there are three components: {0, 1, 2}, {3, 4} and {5}.

To count them, try every vertex as a start. One that nothing has reached yet begins a new component: explore everything it reaches and mark it **seen**. The count is the number of fresh starts: 0, 3 and 5, with 1, 2 and 4 skipped as already seen. Without the seen set, you would walk 0 to 1 and straight back, forever.

An explicit **stack** is the "back up" step: pop a vertex, push its unseen neighbors, repeat. A function calling itself does the same with the call stack, but that memory is small: Python allows about a thousand nested calls by default, and Node's limit is also far below a million. A list on the heap has no such cap.

Cycles in a **directed** graph need more than "seen". Take the diamond 0→1, 0→2, 1→3, 2→3. DFS reaches vertex 3 twice, once by each route, yet there is no cycle. What matters is whether a vertex is on the **current path**, the chain from the start to where you are. Each vertex is unvisited, on the path, or finished, and only an edge into an on-path vertex closes a loop. Add 3→0 and the search going 0, 1, 3 meets 0 on its own path.

A tree needs no seen set, since each node has one parent, so you just recurse. The question is which way information flows. Some travels **down**: for "does a root-to-leaf path add up to 22?", each node needs what is left of the target. Some comes **up**: a node's height depends on its children's, so each call returns a number to its parent. On the tree `[5, 4, 8, 11, None, 13, 4, 7, 2, None, None, 5, 1]`, the path 5, 4, 11, 2 sums to 22, and the **diameter**, the edges on the longest path between any two nodes, is 6: the path 7, 11, 4, 5, 8, 4, 5.

## When to use it

- The statement asks how many groups, whether everything is connected, or whether A can reach B, with no shortest route needed.
- "Count the islands" or "flood fill" on a grid: each cell is a vertex and its neighbors come from its coordinates.
- Prerequisites or dependencies where a circular one is an error: a cycle check, with [topological sort](/dsa/topological-sort) when you also need an order.
- A tree answer built from the children (height, size, balanced?) or from the path above (sums, bounds).
- You need every path or arrangement: that is [backtracking](/dsa/backtracking), DFS plus undoing.
- The fewest steps between two points: use breadth-first search instead.

## Walkthrough

```python
from typing import Protocol

# adj[u] lists the neighbors of u, the shape the graph entry's build_list returns.
Graph = list[list[int]]


def explore(adj: Graph, start: int, seen: set[int]) -> None:
    """Mark every vertex reachable from start, with a stack that lives on the heap."""
    stack = [start]
    while stack:
        u = stack.pop()
        # Marked on pop, so the order is truly depth-first. A vertex can be
        # pushed by several neighbors first; skip repeats or it is scanned twice.
        if u in seen:
            continue
        seen.add(u)
        # Reversed, so the first neighbor is popped first, as in recursion.
        for v in reversed(adj[u]):
            if v not in seen:
                stack.append(v)


def count_components(adj: Graph) -> int:
    """Groups of vertices that can reach each other, in an undirected graph."""
    seen: set[int] = set()
    count = 0
    # Every vertex is tried as a start, or an isolated one would never be counted.
    for u in range(len(adj)):
        if u not in seen:
            explore(adj, u, seen)
            count += 1
    return count
```

```typescript
/** adj[u] lists the neighbors of u, the shape the graph entry's buildList returns. */
export type Graph = number[][];

/** Mark every vertex reachable from start, with a stack that lives on the heap. */
export function explore(adj: Graph, start: number, seen: Set<number>): void {
  const stack = [start];
  while (stack.length > 0) {
    const u = stack.pop()!;
    // Marked on pop, so the order is truly depth-first. A vertex can be
    // pushed by several neighbors first; skip repeats or it is scanned twice.
    if (seen.has(u)) continue;
    seen.add(u);
    // Reversed, so the first neighbor is popped first, as in recursion.
    for (const v of [...adj[u]].reverse()) {
      if (!seen.has(v)) stack.push(v);
    }
  }
}

/** Groups of vertices that can reach each other, in an undirected graph. */
export function countComponents(adj: Graph): number {
  const seen = new Set<number>();
  let count = 0;
  // Every vertex is tried as a start, or an isolated one would never be counted.
  for (let u = 0; u < adj.length; u++) {
    if (!seen.has(u)) {
      explore(adj, u, seen);
      count++;
    }
  }
  return count;
}
```

On the example, `explore(adj, 0, seen)` visits 0, 1 and 2; the starts 3 and 5 follow, for a count of 3.

```python
UNVISITED, ON_PATH, FINISHED = 0, 1, 2


def has_cycle(adj: Graph) -> bool:
    """Whether a directed graph has a cycle; adj[u] lists u's out-neighbors."""
    state = [UNVISITED] * len(adj)

    def visit(u: int) -> bool:
        state[u] = ON_PATH
        for v in adj[u]:
            # Only an edge back into the current path closes a loop. In the
            # diamond 0>1, 0>2, 1>3, 2>3, reaching 3 twice is not a cycle.
            if state[v] == ON_PATH or (state[v] == UNVISITED and visit(v)):
                return True
        # Stays FINISHED, never reset: resetting re-walks shared subgraphs,
        # which takes exponential time on a chain of diamonds.
        state[u] = FINISHED
        return False

    return any(state[u] == UNVISITED and visit(u) for u in range(len(adj)))
```

```typescript
const UNVISITED = 0;
const ON_PATH = 1;
const FINISHED = 2;

/** Whether a directed graph has a cycle; adj[u] lists u's out-neighbors. */
export function hasCycle(adj: Graph): boolean {
  const state = new Array<number>(adj.length).fill(UNVISITED);
  const visit = (u: number): boolean => {
    state[u] = ON_PATH;
    for (const v of adj[u]) {
      // Only an edge back into the current path closes a loop. In the
      // diamond 0>1, 0>2, 1>3, 2>3, reaching 3 twice is not a cycle.
      if (state[v] === ON_PATH || (state[v] === UNVISITED && visit(v))) return true;
    }
    // Stays FINISHED, never reset: resetting re-walks shared subgraphs,
    // which takes exponential time on a chain of diamonds.
    state[u] = FINISHED;
    return false;
  };
  for (let u = 0; u < adj.length; u++) {
    if (state[u] === UNVISITED && visit(u)) return true;
  }
  return false;
}
```

On the diamond the search enters 0, 1 and 3, finishes 3 and 1, then enters 2. Its edge to 3 meets a finished vertex and is ignored, so the answer is `False`; with 3→0 added, vertex 3 meets 0 on the path and returns `True`. This version recurses to the length of the current path. An explicit-stack version must also remember each vertex's place in its neighbor list, which makes it longer, so reach for `explore` when a graph is deep and only reachability matters.

```python
class TreeNode(Protocol):
    """Anything with these three fields, such as the binary-tree entry's node."""

    value: int
    left: "TreeNode | None"
    right: "TreeNode | None"


def has_path_sum(node: TreeNode | None, remaining: int) -> bool:
    """Whether some root-to-leaf path has values adding up to remaining."""
    if node is None:
        return False
    # An argument, so each call has its own copy and nothing needs undoing.
    remaining -= node.value
    # Test at a leaf, not at None: a node with one child would otherwise
    # count its empty side as a second place for a path to end.
    if node.left is None and node.right is None:
        return remaining == 0
    return has_path_sum(node.left, remaining) or has_path_sum(node.right, remaining)
```

```typescript
/** Anything with these three fields, such as the binary-tree entry's node. */
export interface TreeNode {
  value: number;
  left: TreeNode | null;
  right: TreeNode | null;
}

/** Whether some root-to-leaf path has values adding up to remaining. */
export function hasPathSum(node: TreeNode | null, remaining: number): boolean {
  if (node === null) return false;
  // An argument, so each call has its own copy and nothing needs undoing.
  remaining -= node.value;
  // Test at a leaf, not at null: a node with one child would otherwise
  // count its empty side as a second place for a path to end.
  if (node.left === null && node.right === null) return remaining === 0;
  return hasPathSum(node.left, remaining) || hasPathSum(node.right, remaining);
}
```

With a target of 22, `remaining` goes 17 at node 5, 13 at 4 and 2 at 11; leaf 7 gives -5, but leaf 2 gives 0, so the answer is `True`. A target of 9 reaches 0 at node 4, which has a child, so it doesn't count. The data flowed down here. Next it flows up.

```python
def diameter(root: TreeNode | None) -> int:
    """Edges on the longest path between any two nodes."""
    best = 0

    def height(node: TreeNode | None) -> int:
        nonlocal best
        # -1 for the empty tree, as in the binary-tree entry, so a leaf is 0.
        if node is None:
            return -1
        left, right = height(node.left), height(node.right)
        # The longest path turning at this node goes down both sides. Computed
        # here, from heights already returned; calling height() afresh at every
        # node re-walks each subtree, O(n^2) on a chain.
        best = max(best, left + right + 2)
        # A parent can extend only one side, so only the taller one goes up.
        return 1 + max(left, right)

    height(root)
    return best
```

```typescript
/** Edges on the longest path between any two nodes. */
export function diameter(root: TreeNode | null): number {
  let best = 0;
  const height = (node: TreeNode | null): number => {
    // -1 for the empty tree, as in the binary-tree entry, so a leaf is 0.
    if (node === null) return -1;
    const left = height(node.left);
    const right = height(node.right);
    // The longest path turning at this node goes down both sides. Computed
    // here, from heights already returned; calling height() afresh at every
    // node re-walks each subtree, O(n^2) on a chain.
    best = Math.max(best, left + right + 2);
    // A parent can extend only one side, so only the taller one goes up.
    return 1 + Math.max(left, right);
  };
  height(root);
  return best;
}
```

Each call returns its height up and records a candidate on the side. Node 11 sees heights 0 and 0, a candidate of 2; node 8 sees 0 and 1, a candidate of 3; the root sees 2 and 2, giving 6, the largest. The best path needn't pass through the root, which is why `best` is kept apart from the return value.

## Complexity

With V vertices and E edges, `count_components` and `has_cycle` take O(V + E) time: each vertex is entered once and each edge looked at once or twice. Space is O(V) for the seen set or state array and the recursion, but `explore`'s stack can hold a vertex once per edge into it, so O(E). The finished marks keep `has_cycle` to one visit per vertex however many paths reach it.

The tree functions take O(n) time and O(h) space for the recursion, where h is the height: about log₂ n for a balanced tree and n - 1 for a chain. A long chain overflows the call stack; a balanced million-node tree does not.

## Pitfalls

- **Marking on pop without the skip check in `explore`.** In a triangle 0, 1, 2 started at 0, vertices 1 and 2 are both pushed, and 1 pushes 2 again before 2 is marked, so 2 is popped and scanned twice. `if u in seen: continue` prevents it. Marking on push instead scans once but is not depth-first. On `[[1, 2, 3], [0, 3], [0], [0, 1]]` from 0, it visits 0, 1, 2, 3 with the reversal and 0, 3, 2, 1 without, where depth-first visits 0, 1, 3, 2.
- **Treating "seen" as "on the path" in `has_cycle`.** With `state[v] != UNVISITED` as the test, the diamond reports a cycle when vertex 2 reaches the finished 3. Resetting a vertex to unvisited on exit avoids that but re-walks shared subgraphs.
- **Ending the path sum at `None`.** If `has_path_sum` returned `remaining == 0` for an empty child, `[1, 2]` with target 1 would be `True`: node 1's empty right side hits 0, yet the only real path adds to 3.
- **Returning the candidate from `diameter`.** Returning `left + right + 2` lets a parent count both sides of a child, and the example gives 9, not 6.
