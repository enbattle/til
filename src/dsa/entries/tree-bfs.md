---
title: Tree Breadth-First Search
summary: Visiting a tree one depth at a time with a queue, which answers questions about levels (the rightmost node of each, the nearest leaf, a zigzag reading order) without exploring more of the tree than the answer needs.
date: 2026-10-01
kind: pattern
---

Breadth-first search (BFS) on a tree visits every node at depth 0, then every
node at depth 1, then depth 2, and so on, working outward from the root. The
[binary tree](/dsa/binary-tree) entry already writes plain level order, the list
of values grouped by level. This entry is about the questions where going level
by level is the point rather than a way to print the tree: what you see from the
right side, how close the nearest leaf is, and how to read each level in
alternating directions. All three are the same loop with one small change.

## Prerequisites

- [Binary Tree](/dsa/binary-tree): nodes, children, leaves, levels and depth,
  and the level-order list format (`[1, 2, 3, 4, None, 5, 6, None, 7]`) that
  `build_tree` below turns into nodes. That entry's `level_order` is the loop
  this one modifies.
- [Stacks and queues](/dsa/stacks-and-queues): BFS hands nodes through a
  first-in, first-out queue, and the Python code uses `collections.deque`
  because removing from the front of a plain list is slow.

## The idea

A tree has no shortcut to "everything at depth d", so BFS builds it as it goes.
A queue starts holding the root. Taking a node off the front and adding its
children to the back means every node at depth d leaves the queue before any node
at depth d + 1, because the depth d + 1 nodes were added later. At the moment a
pass begins, the queue holds exactly one whole level, nothing more. Counting how
many nodes that is, and taking exactly that many, processes one level per pass
and leaves the next level queued behind it.

This entry uses one tree throughout, the same one as the binary tree entry,
written as the list `[1, 2, 3, 4, None, 5, 6, None, 7]`:

```text
        1          depth 0
       / \
      2   3        depth 1
     /   / \
    4   5   6      depth 2
     \
      7            depth 3
```

**Depth counts edges**, the links between a parent and a child, as in every
tree entry here. The root has depth 0, the empty tree has depth -1 and a single
node has depth 0. Many problem sites count nodes instead, which makes every
depth one larger and the empty tree 0; read the statement before trusting an
answer, because the two conventions disagree on every input.

Each of the three problems uses the level structure differently:

- **Right-side view.** Imagine standing to the right of the tree. At each depth
  you see the node farthest right, which is the last node of that level in
  left-to-right order. In the example that is 1, 3, 6, 7. Notice 7: it hangs
  off the left side of the tree, but nothing at depth 3 hides it, so it is
  visible. Following only right children would stop at 6 and miss it.
- **Minimum depth.** The depth of the **nearest leaf**, a node with no children.
  In the example the leaves are 7, 5 and 6, at depths 3, 2 and 2, so the answer
  is 2. Because BFS finishes a level before starting the next, the first leaf it
  meets is at the smallest depth, and it can stop right there.
- **Zigzag level order.** The level order list, but depth 0 is read left to
  right, depth 1 right to left, depth 2 left to right again. The example gives
  `[[1], [3, 2], [4, 5, 6], [7]]`.

The same BFS passes on the example, level by level:

| Pass | Depth | Queue at the start | Last node | Leaf found?                 |
| ---- | ----- | ------------------ | --------- | --------------------------- |
| 1    | 0     | 1                  | 1         | no                          |
| 2    | 1     | 2, 3               | 3         | no                          |
| 3    | 2     | 4, 5, 6            | 6         | 5: stop and return 2        |
| 4    | 3     | 7                  | 7         | (min_depth never gets here) |

Right-side view is the "last node" column read to the end: 1, 3, 6, 7. Minimum
depth stops in pass 3 at node 5, having taken 1, 2, 3, 4 and 5 off the queue,
five of the seven nodes. Zigzag takes the same four levels and reverses the
second.

## When to use it

Reach for tree BFS when the question is about a level, or about distance from the
root, and the answer for a level depends on the nodes in that level together:
the last or first node of each level, the largest value in each level, the
average of each level, connecting each node to its right neighbor. The phrase
"nearest" or "shortest" (the minimum depth, the closest leaf, the fewest steps)
is the other signal, because BFS reaches nodes in order of distance and can stop
at the first hit.

Minimum depth shows why that stopping matters. A depth-first search commits to
one branch and follows it to the bottom before looking anywhere else. Give it a
tree whose root has a one-million-node chain on its left and a single leaf on its
right: going left first, it walks the entire chain before it ever sees the leaf
at depth 1, and even then it can't know the answer without finishing every
branch. BFS takes the root, then the chain's first node and the leaf, sees the
leaf, and returns after three nodes, no matter how long the chain is.

When a question needs a node's children's answers before its own (a height, a
size, a path sum), that is a depth-first, postorder job and BFS has nothing to
add. The same level-by-level loop on a graph, where nodes can be reached more
than one way and need a visited set, is its own entry,
[Graph BFS](/dsa/graph-bfs).

## Walkthrough

```python
from collections import deque
from collections.abc import Sequence


class TreeNode:
    """One node: a value and references to a left and a right child, or None."""

    __slots__ = ("value", "left", "right")

    def __init__(
        self,
        value: int,
        left: "TreeNode | None" = None,
        right: "TreeNode | None" = None,
    ) -> None:
        self.value = value
        self.left = left
        self.right = right
```

```typescript
/** One node: a value and references to a left and a right child, or null. */
export class TreeNode {
  constructor(
    public value: number,
    public left: TreeNode | null = null,
    public right: TreeNode | null = null,
  ) {}
}
```

Each code file carries its own minimal node so it runs on its own. A tree is
just a reference to its root node, and the empty tree is `None` (`null` in
TypeScript), so every function below takes a node or nothing. The quotes around
`"TreeNode | None"` are there because the class mentions itself inside its own
definition, at a moment when the name doesn't exist yet. Values are plain
integers to keep the types out of the way.

```python
def build_tree(values: Sequence[int | None]) -> TreeNode | None:
    """Build a tree from its level order, where None marks a missing child."""
    if not values or values[0] is None:
        return None
    root = TreeNode(values[0])
    queue = deque([root])
    i = 1
    while i < len(values):
        if not queue:
            raise ValueError(f"the value at index {i} has no parent")
        node = queue.popleft()
        if values[i] is not None:
            node.left = TreeNode(values[i])
            queue.append(node.left)
        if i + 1 < len(values) and values[i + 1] is not None:
            node.right = TreeNode(values[i + 1])
            queue.append(node.right)
        i += 2
    return root
```

```typescript
/** Build a tree from its level order, where null marks a missing child. */
export function buildTree(values: readonly (number | null)[]): TreeNode | null {
  const first = values.length > 0 ? values[0] : null;
  if (first === null) return null;
  const root = new TreeNode(first);
  const queue: TreeNode[] = [root];
  let head = 0; // queue[head] is the next node waiting for its children
  for (let i = 1; i < values.length; i += 2) {
    if (head === queue.length) {
      throw new RangeError(`the value at index ${i} has no parent`);
    }
    const node = queue[head++];
    const left = values[i];
    if (left !== null) {
      node.left = new TreeNode(left);
      queue.push(node.left);
    }
    const right = i + 1 < values.length ? values[i + 1] : null;
    if (right !== null) {
      node.right = new TreeNode(right);
      queue.push(node.right);
    }
  }
  return root;
}
```

This is the list-to-tree helper from the binary tree entry in a plainer shape,
and it is itself a BFS: the queue holds the nodes created but still waiting for
their two children, and each pass hands the oldest one the next pair of values.
Only the children of nodes that exist appear in the list, which is why a missing
child creates no node and joins no queue. Two lines are easy to get wrong. The
tests are `is not None` and `!== null` rather than a truthiness test, because a
node holding 0 would otherwise be taken for a gap, and every later pair would go
to the wrong parent. And `i + 1 < len(values)` guards the right child, because a
list may end after a left child, as in `[1, 2]`. The TypeScript version reads its
queue through an index, `head`, instead of removing from the front; the next
chunk explains the trade-off.

```python
def right_side_view(root: TreeNode | None) -> list[int]:
    """The last node of each level, top to bottom: what you see from the right."""
    view: list[int] = []
    queue = deque([root] if root is not None else [])
    while queue:
        view.append(queue[-1].value)
        for _ in range(len(queue)):
            node = queue.popleft()
            if node.left is not None:
                queue.append(node.left)
            if node.right is not None:
                queue.append(node.right)
    return view
```

```typescript
/** The last node of each level, top to bottom: what you see from the right. */
export function rightSideView(root: TreeNode | null): number[] {
  const view: number[] = [];
  let level = root === null ? [] : [root];
  while (level.length > 0) {
    view.push(level[level.length - 1].value);
    const next: TreeNode[] = [];
    for (const node of level) {
      if (node.left !== null) next.push(node.left);
      if (node.right !== null) next.push(node.right);
    }
    level = next;
  }
  return view;
}
```

Left children are queued before right children, so each level sits in the queue
left to right and its last entry is its rightmost node. The Python loop reads
that entry, `queue[-1]`, at the start of the pass, when the queue holds exactly
one level. Reading it after the inner loop would find the last node of the next
level instead, because by then the children are queued and the current level is
gone.
`range(len(queue))` fixes the pass size once, before the first `popleft`; an
inner `while queue` would keep taking the children it just added and treat the
whole tree as one level.

The TypeScript version keeps the current level and the next level in two
separate arrays rather than one queue. A pass reads every node of `level`, builds
`next`, and swaps. No pass ever removes from the front of an array, which matters
because `Array.shift()` can be slow: the language specification describes it as
moving every remaining element down one slot. Engines optimize it, so how slow
depends on size. In Node 24 here, emptying a 10,000-element array with `shift()`
took under a millisecond, but 50,000 elements took about 2.7 seconds and 400,000
took about 70 seconds, so an algorithm that looks linear turns quadratic as the
queue grows. A single array read through a `head` index, as `buildTree` does,
also avoids the move, but it never shrinks, and here it would still need a length
snapshot to find each level's end. Two arrays give the level boundary for free
and drop each finished level.

```python
def min_depth(root: TreeNode | None) -> int:
    """Edges from the root to the nearest leaf; -1 for an empty tree."""
    queue = deque([root] if root is not None else [])
    depth = 0
    while queue:
        for _ in range(len(queue)):
            node = queue.popleft()
            if node.left is None and node.right is None:
                return depth
            if node.left is not None:
                queue.append(node.left)
            if node.right is not None:
                queue.append(node.right)
        depth += 1
    return -1
```

```typescript
/** Edges from the root to the nearest leaf; -1 for an empty tree. */
export function minDepth(root: TreeNode | null): number {
  let level = root === null ? [] : [root];
  let depth = 0;
  while (level.length > 0) {
    const next: TreeNode[] = [];
    for (const node of level) {
      if (node.left === null && node.right === null) return depth;
      if (node.left !== null) next.push(node.left);
      if (node.right !== null) next.push(node.right);
    }
    level = next;
    depth++;
  }
  return -1;
}
```

`depth` is the number of passes finished so far, which is exactly the depth of
the level the current pass is working on, starting at 0 for the root. The
function returns the moment it meets a node with no children, and because the
levels are taken in order that node is a nearest leaf. The test needs `and`: a
leaf has no left child and no right child. A node with only one child is not a
leaf, and `or` would call it one: on `[1, None, 2, None, 3]` it would return 0,
claiming the root is a leaf, when the nearest leaf, 3, is two edges down. The
`return -1` after the loop is reached only when the queue was empty to begin
with, since any non-empty finite tree has a leaf, so the empty tree gets -1
without a separate check. To count nodes instead of edges, start `depth` at 1
and return 0 here.

```python
def zigzag_level_order(root: TreeNode | None) -> list[list[int]]:
    """Levels top to bottom, alternating left-to-right and right-to-left."""
    levels: list[list[int]] = []
    queue = deque([root] if root is not None else [])
    while queue:
        level: list[int] = []
        for _ in range(len(queue)):
            node = queue.popleft()
            level.append(node.value)
            if node.left is not None:
                queue.append(node.left)
            if node.right is not None:
                queue.append(node.right)
        if len(levels) % 2 == 1:
            level.reverse()
        levels.append(level)
    return levels
```

```typescript
/** Levels top to bottom, alternating left-to-right and right-to-left. */
export function zigzagLevelOrder(root: TreeNode | null): number[][] {
  const levels: number[][] = [];
  let level = root === null ? [] : [root];
  while (level.length > 0) {
    const values = level.map((node) => node.value);
    if (levels.length % 2 === 1) values.reverse();
    levels.push(values);
    const next: TreeNode[] = [];
    for (const node of level) {
      if (node.left !== null) next.push(node.left);
      if (node.right !== null) next.push(node.right);
    }
    level = next;
  }
  return levels;
}
```

The traversal is unchanged: children are still queued left then right, so every
level is collected left to right. Only the finished list is flipped, and only on
odd depths. `levels` holds the levels finished so far, so its length is the
depth of the level being built: 0 for the root, which stays left to right, and
the first flip comes at 1. Testing `== 0` would reverse the root and every even
level, handing back the mirror image of the answer. Flipping the finished list
leaves the queue logic identical to plain level order, and costs one reversal
per odd level, linear in that level's size. On the example, depth 1
collects `[2, 3]` and flips it to `[3, 2]`; depths 0, 2 and 3 are untouched.

## Complexity

Let n be the number of nodes. Every node is added to the queue once and taken off
once, with constant work each, so all three functions are O(n) time. Reversing
the odd levels in zigzag adds at most one more touch per node. `min_depth` is
O(n) in the worst case, a tree whose leaves are all at the bottom, but it takes
only the nodes at depths above the nearest leaf plus the nodes before the leaf on
its own level, however big the rest of the tree is.

Extra space is the queue, which holds at most two neighboring levels at once (the
unfinished part of the current level and the children already added of the
next), so it is O(w), where w is the width: the number of nodes in the widest
level. For a perfect tree, one with every level full, the last level holds
(n + 1) / 2 nodes, so w is O(n): a perfect seven-node tree has 4. The running example isn't
perfect, and its widest level (4, 5, 6) has 3. For a chain, w
is 1. That is the opposite of depth-first search, which holds one stack frame per
node on the current path, so about the height h: O(n) on a chain and O(log n) on a
perfect tree. Pick by the tree you expect: BFS is cheap on thin, deep trees and
costly on wide ones. `right_side_view` also returns h + 1 values and
`zigzag_level_order` returns all n, which are output rather than working memory.

## Pitfalls

- **Counting nodes where the code counts edges.** `min_depth` returns 0 for a
  single node and -1 for the empty tree. A judge that counts nodes expects 1 and
  0, so every answer is off by one; check the statement's convention and adjust
  the start value and the empty return together.
- **Calling a node with one child a leaf.** `or` in place of `and` in
  `min_depth` returns early at the first node with any missing child. The same
  mistake in a depth-first version, `1 + min(depth(left), depth(right))` with the
  empty tree as -1, returns 0 for `[1, None, 2]`, which treats the missing left
  child as a path of length -1.
- **Taking the right-side view as the right spine.** Following `.right` from
  the root skips a level whose rightmost node is a left child. On
  `[1, 2, 3, 4]` the answer is `[1, 3, 4]`, and the right spine gives `[1, 3]`.
- **Letting the level grow while counting it.** An inner loop on `len(queue)`
  re-evaluated each time, or `while queue`, merges all levels into one. Fix the
  size at the start of the pass, as `range(len(queue))` does.
- **Flipping on the wrong parity or flipping the queue.** Reverse the finished
  list when the depth is odd, not even, and not the order children are queued.
- **Removing from the front of an array.** `shift()` in TypeScript or `pop(0)` on
  a Python list makes each dequeue cost time in proportion to the queue's length
  on large inputs. Use `deque.popleft()`, or two arrays per level, as above.
- **Reaching for BFS when the answer needs subtree results.** Heights, sizes and
  path sums combine children's answers, which is depth-first work, and a level
  loop forces you to rebuild that bookkeeping by hand.
