---
title: Binary Tree
summary: Nodes that each point to at most two children, where the tree's height, not its node count, sets the cost of walking it and whether recursion survives.
date: 2026-10-05
kind: data-structure
template: 2
---

A binary tree is a linked list that branches: each node points to up to two nodes below it instead of one. File systems and HTML documents are trees, and most tree questions come down to visiting every node in the right order. You'll build one from the list format interview problems use, write the walks that matter, and see how a tree that is too deep breaks the easy way of writing them.

## Prerequisites

- [Linked list](/dsa/linked-list): a tree node is a list node with two next pointers, and the same rules about references apply.
- [Stacks and queues](/dsa/stacks-and-queues): `inorder` replaces recursion with a stack you manage yourself.

You also need **recursion**, a function that calls itself on a smaller piece of the problem. Each call that hasn't returned holds a **frame** on the **call stack**, the memory that tracks every running call.

## What it is

A **binary tree** is a set of **nodes**, each holding a value and two references, **left** and **right**, to its **children**, either of which may be empty. The node a child hangs from is its **parent**. One node, the **root**, has no parent; a node with no children is a **leaf**; a node with everything below it is a **subtree**. A node's **depth** is the number of edges (parent-child links) from the root down to it, and its **height** is the number of edges on the longest path down to a leaf. The tree's height is the root's, and the empty tree gets -1, so a leaf is 0. LeetCode's "maximum depth" counts nodes instead, one more, so check which a problem means.

The running example, which a problem hands you as a level-order list with `None` for a missing child, `[1, 2, 3, 4, None, 5, 6, None, 7]`:

```text
        1          depth 0
       / \
      2   3        depth 1
     /   / \
    4   5   6      depth 2
     \
      7            depth 3
```

The leaves are 7, 5 and 6, and the height is 3, along the path 1, 2, 4, 7. Two shapes matter. In a **balanced** tree the subtree heights differ by at most one at every node; in a **degenerate** one every node has at most one child, so it's a linked list. Level d holds at most 2^d nodes, so a million nodes can fit in height 19, while a degenerate tree of a million has height 999,999. Anything that walks one root-to-leaf path costs time in the height, so shape decides speed. (A [heap](/dsa/heap) is a **complete** tree, packed left, so it fits in an array.)

**Traversing** means visiting every node once. Three orders go **depth first**, finishing one subtree before the other, and differ only in when the node is visited:

| Order     | Visit                     | On the example         |
| --------- | ------------------------- | ---------------------- |
| Preorder  | node, left, right         | 1, 2, 4, 7, 3, 5, 6    |
| Inorder   | left, node, right         | 4, 7, 2, 1, 5, 3, 6    |
| Postorder | left, right, node         | 7, 4, 2, 5, 6, 3, 1    |
| Level     | each depth, left to right | 1 / 2, 3 / 4, 5, 6 / 7 |

Preorder meets a parent first, which is how you copy a tree. Inorder lists a [binary search tree](/dsa/binary-search-tree) in sorted order. Postorder meets both children first, which suits a value built from the subtrees up, like a height. Level order, or **breadth first**, goes one depth at a time.

## When to use it

- The data is hierarchical: folders, an org chart, a nested comment thread.
- The statement says root, subtree, ancestor, leaf or depth, or hands you a level-order list.
- A node's answer depends on its children's (height, size, a path sum): postorder, usually recursive.
- You need the nodes row by row, such as the average of each level: level order.
- The tree may be a chain of a million nodes: use a loop and your own stack.

## Operations and costs

n is the number of nodes, h the height and w the widest level. Extra space is memory beyond the tree and the returned list.

| Operation                  | Time, average and worst | Extra space |
| -------------------------- | ----------------------- | ----------- |
| `build_tree`               | O(n)                    | O(w)        |
| `inorder`                  | O(n)                    | O(h)        |
| `level_order`              | O(n)                    | O(w)        |
| `height`                   | O(n)                    | O(h)        |
| Find a value (no ordering) | O(n)                    | O(h)        |
| The tree itself            |                         | O(n)        |

Every operation touches each node a constant number of times, so all are O(n). A plain tree says nothing about where a value is, so finding one means looking everywhere; a binary search tree adds the order that makes a search follow one path. The space columns pull opposite ways. Depth first holds the current path: h, about log₂ n if balanced and n - 1 for a chain. Level order holds a whole level: 1 for a chain, about n/2 for a perfect tree.

## Implementation

The node is a small class. There is no tree class: a tree is a reference to its root, and the empty tree is `None` (`null`), which keeps every function a plain function of a node.

```python
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Generic, TypeVar

T = TypeVar("T")


# eq=False compares nodes by identity. The generated __eq__ would walk both
# subtrees, which overflows the stack on a deep tree. repr=False, same reason.
@dataclass(eq=False, repr=False)
class TreeNode(Generic[T]):
    """One node: a value and a left and a right child, or None."""

    value: T
    left: "TreeNode[T] | None" = None
    right: "TreeNode[T] | None" = None
```

```typescript
/** One node: a value and a left and a right child, or null. */
export class TreeNode<T> {
  constructor(
    public value: T,
    public left: TreeNode<T> | null = null,
    public right: TreeNode<T> | null = null,
  ) {}
}
```

Building takes the list a level at a time. After the root, each node of the current level takes the next two values, left then right, and a gap gets no node, so it has no pair below. On the example, 1 takes 2 and 3; 2 takes 4 and a gap; 3 takes 5 and 6; 4 takes a gap and 7. That's all 9 values.

```python
def _child(value: T | None, born: list[TreeNode[T]]) -> TreeNode[T] | None:
    # `is None`, not falsy: 0 and "" are real values that must get a node.
    if value is None:
        return None
    node = TreeNode(value)
    born.append(node)
    return node


def build_tree(values: Sequence[T | None]) -> TreeNode[T] | None:
    """Build a tree from its level order, where None marks a missing child."""
    items = iter(values)
    first = next(items, None)
    root = None if first is None else TreeNode(first)
    level = [] if root is None else [root]
    while level:
        born: list[TreeNode[T]] = []
        # Values come in pairs, and only for nodes that exist, so a gap
        # costs two entries fewer one level down, not two Nones.
        for node in level:
            node.left = _child(next(items, None), born)
            node.right = _child(next(items, None), born)
        level = born
    # Values left over once no node is waiting for children have no parent.
    if list(items):
        raise ValueError("a value has no parent")
    return root
```

```typescript
/** Build a tree from its level order, where null marks a missing child. */
export function buildTree<T>(values: readonly (T | null)[]): TreeNode<T> | null {
  let i = 0;
  const take = (): T | null => (i < values.length ? values[i++] : null);
  const child = (value: T | null, born: TreeNode<T>[]): TreeNode<T> | null => {
    // === null, not falsy: 0 and "" are real values that must get a node.
    if (value === null) return null;
    const node = new TreeNode(value);
    born.push(node);
    return node;
  };
  const first = take();
  const root: TreeNode<T> | null = first === null ? null : new TreeNode<T>(first);
  let level: TreeNode<T>[] = root === null ? [] : [root];
  while (level.length > 0) {
    const born: TreeNode<T>[] = [];
    // Values come in pairs, and only for nodes that exist, so a gap
    // costs two entries fewer one level down, not two nulls.
    for (const node of level) {
      node.left = child(take(), born);
      node.right = child(take(), born);
    }
    level = born;
  }
  // Values left over once no node is waiting for children have no parent.
  if (i < values.length) throw new RangeError('a value has no parent');
  return root;
}
```

A trailing gap is optional, but `[1, None, None, 4]` describes no tree, so both versions raise. Now a postorder walk, where recursion earns its place.

```python
def height(node: TreeNode[T] | None) -> int:
    # -1 for the empty tree, so a leaf is 0 and the formula needs no special
    # case. Recursion is as deep as the tree is tall, so a chain overflows.
    return -1 if node is None else 1 + max(height(node.left), height(node.right))
```

```typescript
export function height<T>(node: TreeNode<T> | null): number {
  // -1 for the empty tree, so a leaf is 0 and the formula needs no special
  // case. Recursion is as deep as the tree is tall, so a chain overflows.
  if (node === null) return -1;
  return 1 + Math.max(height(node.left), height(node.right));
}
```

Node 7 gives 0, node 4 gives 1, node 2 gives 2, and the root gives 1 + max(2, 1) = 3. Preorder and postorder are this recursion with the visit moved before or after the two calls. Inorder you'll want as a loop, for trees that could be deep.

```python
def inorder(root: TreeNode[T] | None) -> list[T]:
    """Left subtree, node, right subtree, with an explicit stack, not recursion."""
    out: list[T] = []
    stack: list[TreeNode[T]] = []
    node = root
    while stack or node is not None:
        # Ancestors wait on the stack until their left side is done. The list
        # grows on the heap, so a chain of a million nodes is fine.
        while node is not None:
            stack.append(node)
            node = node.left
        node = stack.pop()
        out.append(node.value)
        node = node.right  # else the loop re-walks the left spine forever
    return out
```

```typescript
/** Left subtree, node, right subtree, with an explicit stack, not recursion. */
export function inorder<T>(root: TreeNode<T> | null): T[] {
  const out: T[] = [];
  const stack: TreeNode<T>[] = [];
  let node = root;
  while (stack.length > 0 || node !== null) {
    // Ancestors wait on the stack until their left side is done. The array
    // grows on the heap, so a chain of a million nodes is fine.
    while (node !== null) {
      stack.push(node);
      node = node.left;
    }
    const top = stack.pop()!;
    out.push(top.value);
    node = top.right; // else the loop re-walks the left spine forever
  }
  return out;
}
```

On the example the stack fills 1, 2, 4, pops 4 and moves right to 7, then pops 7, 2 and 1, and finishes 5, 3, 6. Last, level order, which needs no stack at all.

```python
def level_order(root: TreeNode[T] | None) -> list[list[T]]:
    """Values grouped by depth, left to right."""
    levels: list[list[T]] = []
    level = [] if root is None else [root]
    while level:
        levels.append([node.value for node in level])
        # The next level comes from the whole current one, so depths never mix;
        # a flat queue would have to count where each level ends.
        level = [c for n in level for c in (n.left, n.right) if c is not None]
    return levels
```

```typescript
/** Values grouped by depth, left to right. */
export function levelOrder<T>(root: TreeNode<T> | null): T[][] {
  const levels: T[][] = [];
  let level: TreeNode<T>[] = root === null ? [] : [root];
  while (level.length > 0) {
    levels.push(level.map((node) => node.value));
    // The next level comes from the whole current one, so depths never mix;
    // a flat queue would have to count where each level ends.
    level = level.flatMap((n) => [n.left, n.right]).filter((c) => c !== null);
  }
  return levels;
}
```

The example gives `[[1], [2, 3], [4, 5, 6], [7]]`, and the number of levels is the height plus one.

## Pitfalls

- **Testing a value for falsiness in `_child`.** Writing `if not value` skips a node holding 0 or an empty string, and the tree silently loses it. Test `is None`.
- **Recursing on a tree you didn't build.** `height` uses one frame per level, so a chain of about a thousand nodes overflows the stack in Python (default limit 1,000 frames) and a longer one in Node. Use the loop in `inorder`, or a level count.
- **Forgetting `node = node.right` in `inorder`.** Without it, `node` is still the node just popped, so the inner loop pushes it and its left spine again, and the function never returns. A version that moved right only some of the time would skip 7 or 5 on the example.
- **Starting `height` at 0 for the empty tree.** With `return 0` at the base case, a leaf has height 1 and every answer is one too high, which matches the node-counting convention rather than the edge-counting one this entry uses.
