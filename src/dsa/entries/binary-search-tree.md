---
title: Binary Search Tree
summary: A binary tree that keeps every smaller key to a node's left and every larger key to its right, so a lookup drops a whole subtree at each step, as long as the tree stays bushy.
date: 2026-10-01
kind: data-structure
---

A binary search tree keeps keys in sorted order while still letting you add
and remove them cheaply. A sorted array finds a key fast but pays O(n) to insert
one in the middle; a hash map inserts fast but has no idea which key comes
next. A binary search tree does both reasonably well, on one condition: its
shape. This entry builds an unbalanced one, shows the input that ruins it, and
names the trees real libraries use instead.

## Prerequisites

- [Binary Tree](/dsa/binary-tree), for the vocabulary: nodes, the root, left
  and right children, subtrees, leaves and height. This entry adds an ordering
  rule on top of that shape.
- [Binary Search](/dsa/binary-search), for the halving idea. A lookup in a
  well-shaped tree throws away about half the remaining keys at each node, the
  way binary search throws away half the array at each comparison.

## What it is

A **binary search tree** (BST) is a binary tree whose keys obey one rule, the
**BST invariant**: for every node, every key in its left subtree is smaller
than the node's key and every key in its right subtree is larger. Not just the
node's two children: the whole subtree on each side. This version stores
distinct integer keys, so "smaller" and "larger" are strict and inserting a key
that's already there does nothing.

The invariant tells a search which way to go. To look for 65, compare it with
the root. If 65 is smaller, it can only be in the left subtree; if larger, only
in the right. Each comparison rules out the node and one entire subtree, and
the search ends when it finds the key or steps off the bottom of the tree.
Inserting is the same walk: search for the key, and where the search falls off
the tree is exactly where the new node belongs.

Inserting 50, 30, 70, 20, 40, 60, 80 and 65, in that order, builds this tree.
The last insert compares 65 with 50 (go right), 70 (go left) and 60 (go right),
finds no node there, and attaches 65 as 60's right child:

```text
        50
      /    \
    30      70
   /  \    /  \
  20  40  60  80
            \
            65
```

Reading the keys left to right across the drawing gives 20, 30, 40, 50, 60,
65, 70, 80: sorted. That isn't luck. An **inorder traversal** visits a node's
left subtree, then the node, then its right subtree, and the invariant makes
that the sorted order. The smallest key is the one you reach by following left
children from the root until there are none; the largest, by following right
children.

Deleting is the one operation that has to rearrange nodes. Removing a leaf or
a node with one child just unhooks it, but 50 has two children, and pulling it
out would leave two subtrees and one empty spot. Instead, 50's spot takes the
next key up, 60: go right once to 70, then left as far as possible. That key
fits there, being larger than everything on the left and smaller than
everything else on the right. 60's old node, which can't have a left child,
then hands its place to its one child, 65:

```text
        before                      after delete(50)

        50                          60
      /    \                      /    \
    30      70                  30      70
   /  \    /  \                /  \    /  \
  20  40  60  80              20  40  65  80
            \
            65
```

The shape depends entirely on the order the keys arrive. The same eight keys
inserted as 20, 30, 40, 50, 60, 65, 70, 80 give a tree where every node has
only a right child: a linked list leaning to the right, eight levels tall.
A search for 80 then compares with all eight keys. The tree's
**height** is the number of edges on its longest path down from the root, as
in [Binary Tree](/dsa/binary-tree): sorted input (ascending or descending)
gives height n − 1, the worst possible.

Random input does far better. Each new key lands at the end of a path whose
length grows only logarithmically on average: with keys inserted in random
order, the average node sits about 2 ln n ≈ 1.39 log₂ n levels deep. For a
million keys in a random order, a measured run put the average lookup at about
26 nodes and the tallest path near 50, against 20 levels for a perfectly
balanced tree. That's the "average O(log n)" in the table below, and it holds
only if nothing about the input is sorted.

## Operations and costs

Here n is the number of keys, h is the tree's height and k is the number of
keys a range query returns. Every operation walks one path down from the root,
so each costs O(h). The average column assumes keys inserted in random order,
where h is O(log n); the worst case is sorted input, where h = n.

| Operation                           | Average      | Worst case |
| ----------------------------------- | ------------ | ---------- |
| `key in tree`, `insert`, `delete`   | O(log n)     | O(n)       |
| `min()`, `max()`                    | O(log n)     | O(n)       |
| `keys_between(lo, hi)`              | O(log n + k) | O(n)       |
| Iterate all keys in order           | O(n)         | O(n)       |
| Space (the tree)                    | O(n)         | O(n)       |
| Extra space (iteration, range scan) | O(log n)     | O(n)       |

Iterating every key is O(n) in both columns because it visits each node once
and each edge twice, once going down and once coming back up. The range query
is cheaper than iterating and filtering because it never enters a subtree that
lies wholly below `lo`, and it stops at the first key above `hi`. The extra
space for iteration is the stack of nodes still waiting to be visited, which
holds at most one path's worth: O(h).

## Implementation

Both versions loop instead of recursing, for a reason the Tricky lines section
gives. The Python tree supports `in`, `len()` and iteration; the TypeScript one
has `has`, `size` and `Symbol.iterator`, so a `for...of` loop or `[...tree]`
yields the keys in order.

```python
from collections.abc import Iterable, Iterator


class Node:
    """One tree node: a key and links to the left and right subtrees."""

    __slots__ = ("key", "left", "right")

    def __init__(self, key: int) -> None:
        self.key = key
        self.left: Node | None = None
        self.right: Node | None = None


class BinarySearchTree:
    """An unbalanced binary search tree of distinct integer keys."""

    def __init__(self, keys: Iterable[int] = ()) -> None:
        self._root: Node | None = None
        self._size = 0
        for key in keys:
            self.insert(key)

    def __len__(self) -> int:
        return self._size

    def __contains__(self, key: int) -> bool:
        node = self._root
        while node is not None and node.key != key:
            node = node.left if key < node.key else node.right
        return node is not None
```

```typescript
/** One tree node: a key and links to the left and right subtrees. */
export class TreeNode {
  key: number;
  left: TreeNode | null = null;
  right: TreeNode | null = null;

  constructor(key: number) {
    this.key = key;
  }
}

/** An unbalanced binary search tree of distinct numeric keys. */
export class BinarySearchTree implements Iterable<number> {
  private root: TreeNode | null = null;
  private count = 0;

  constructor(keys: Iterable<number> = []) {
    for (const key of keys) this.insert(key);
  }

  get size(): number {
    return this.count;
  }

  has(key: number): boolean {
    let node = this.root;
    while (node !== null && node.key !== key) {
      node = key < node.key ? node.left : node.right;
    }
    return node !== null;
  }
```

An empty tree is a `None` root, not a node with no key, so every method has one
clear test for "nothing here". The search loop has two ways to stop: it finds
the key, or `node` becomes `None` because the path it had to take doesn't
exist. Either way, `node is not None` is the answer. The size is kept in a
field so `len(tree)` doesn't have to walk all n nodes.

```python
    def insert(self, key: int) -> bool:
        parent: Node | None = None
        node = self._root
        while node is not None:
            if key == node.key:
                return False
            parent = node
            node = node.left if key < node.key else node.right
        new = Node(key)
        if parent is None:
            self._root = new
        elif key < parent.key:
            parent.left = new
        else:
            parent.right = new
        self._size += 1
        return True
```

```typescript
  insert(key: number): boolean {
    let parent: TreeNode | null = null;
    let node = this.root;
    while (node !== null) {
      if (key === node.key) return false;
      parent = node;
      node = key < node.key ? node.left : node.right;
    }
    const fresh = new TreeNode(key);
    if (parent === null) {
      this.root = fresh;
    } else if (key < parent.key) {
      parent.left = fresh;
    } else {
      parent.right = fresh;
    }
    this.count++;
    return true;
  }
```

`insert` is the search loop with one more variable. When the loop ends, `node`
is `None`, which can't be attached to anything, so the loop keeps `parent`, the
last real node it passed, one step behind. The new node becomes that parent's
left or right child, decided by the same comparison that sent the search down
there. A `None` parent means the loop never ran: the tree was empty and the new
node becomes the root. A key that's already present returns `False` before
anything changes, so the size stays right.

```python
    def delete(self, key: int) -> bool:
        parent: Node | None = None
        node = self._root
        while node is not None and node.key != key:
            parent = node
            node = node.left if key < node.key else node.right
        if node is None:
            return False
        if node.left is not None and node.right is not None:
            successor_parent, successor = node, node.right
            while successor.left is not None:
                successor_parent, successor = successor, successor.left
            node.key = successor.key
            parent, node = successor_parent, successor
        child = node.left if node.left is not None else node.right
        if parent is None:
            self._root = child
        elif parent.left is node:
            parent.left = child
        else:
            parent.right = child
        self._size -= 1
        return True
```

```typescript
  delete(key: number): boolean {
    let parent: TreeNode | null = null;
    let node = this.root;
    while (node !== null && node.key !== key) {
      parent = node;
      node = key < node.key ? node.left : node.right;
    }
    if (node === null) return false;
    if (node.left !== null && node.right !== null) {
      let successorParent = node;
      let successor = node.right;
      while (successor.left !== null) {
        successorParent = successor;
        successor = successor.left;
      }
      node.key = successor.key;
      parent = successorParent;
      node = successor;
    }
    const child = node.left ?? node.right;
    if (parent === null) {
      this.root = child;
    } else if (parent.left === node) {
      parent.left = child;
    } else {
      parent.right = child;
    }
    this.count--;
    return true;
  }
```

Deleting has three cases, sorted by how many children the doomed node has. A
**leaf** (no children) is simply cut off: its parent's link becomes `None`. A
node with **one child** is replaced by that child, which brings its whole
subtree up one level; everything in that subtree was already on the correct
side of the parent, so the invariant survives. Both cases are the same three
lines at the bottom: `child` is the one child, or `None` for a leaf, and it
takes the node's place in the parent's left or right link, or becomes the root
if the node was the root.

A node with **two children** can't be replaced by either child without
orphaning the other. Instead, the node keeps its place and takes a new key: its
**inorder successor**, the smallest key larger than it, which is the leftmost
node of its right subtree. That key is larger than everything in the left
subtree and smaller than everything else in the right, so it fits the node's
position exactly. Then the successor's old node has to go, and it is the easy
kind: being leftmost, it has no left child, so it has at most one child. The
reassignment `parent, node = successor_parent, successor` hands that node to
the one-or-zero-child code below. The before-and-after drawing in What it is
shows this for `delete(50)`.

```python
    def min(self) -> int:
        if self._root is None:
            raise ValueError("min of an empty tree")
        node = self._root
        while node.left is not None:
            node = node.left
        return node.key

    def max(self) -> int:
        if self._root is None:
            raise ValueError("max of an empty tree")
        node = self._root
        while node.right is not None:
            node = node.right
        return node.key
```

```typescript
  min(): number | undefined {
    let node = this.root;
    if (node === null) return undefined;
    while (node.left !== null) node = node.left;
    return node.key;
  }

  max(): number | undefined {
    let node = this.root;
    if (node === null) return undefined;
    while (node.right !== null) node = node.right;
    return node.key;
  }
```

The smallest key has nothing smaller, so it has no left child, and every step
left from the root moves to something smaller; following left links until
there are none lands on it. An empty tree has no minimum, and each language
says so its own way: Python raises `ValueError`, as the built-in `min([])`
does, and TypeScript returns `undefined`, as `[].pop()` does.

```python
    def __iter__(self) -> Iterator[int]:
        stack: list[Node] = []
        node = self._root
        while stack or node is not None:
            while node is not None:
                stack.append(node)
                node = node.left
            node = stack.pop()
            yield node.key
            node = node.right
```

```typescript
  *[Symbol.iterator](): Iterator<number> {
    const stack: TreeNode[] = [];
    let node = this.root;
    while (stack.length > 0 || node !== null) {
      while (node !== null) {
        stack.push(node);
        node = node.left;
      }
      node = stack.pop()!;
      yield node.key;
      node = node.right;
    }
  }
```

The inorder traversal is left subtree, node, right subtree. Written
recursively it's three lines; this version keeps the pending nodes on an
explicit stack. The inner loop walks as far left as it can, stacking each node
it passes, because each of those must wait until everything to its left is
done. The node popped next is the smallest one not yet visited. After yielding
it, its right subtree is the only part of the tree between it and the next node
on the stack, so `node = node.right` starts the same walk there. Both versions
are generators, which hand back one key per request, so a loop that stops after
the first few keys pays only for the nodes it reached, not for the whole tree.

```python
    def keys_between(self, lo: int, hi: int) -> list[int]:
        """Every key k with lo <= k <= hi, in ascending order."""
        result: list[int] = []
        stack: list[Node] = []
        node = self._root
        while stack or node is not None:
            while node is not None:
                if node.key < lo:
                    node = node.right
                else:
                    stack.append(node)
                    node = node.left
            if not stack:
                break
            node = stack.pop()
            if node.key > hi:
                break
            result.append(node.key)
            node = node.right
        return result
```

```typescript
  /** Every key k with lo <= k <= hi, in ascending order. */
  keysBetween(lo: number, hi: number): number[] {
    const result: number[] = [];
    const stack: TreeNode[] = [];
    let node = this.root;
    while (stack.length > 0 || node !== null) {
      while (node !== null) {
        if (node.key < lo) {
          node = node.right;
        } else {
          stack.push(node);
          node = node.left;
        }
      }
      const next = stack.pop();
      if (next === undefined || next.key > hi) break;
      result.push(next.key);
      node = next.right;
    }
    return result;
  }
```

The range query is the inorder traversal with two shortcuts. Going down, a
node below `lo` is skipped along with its entire left subtree, which is even
smaller, and the walk continues into its right subtree, where keys of `lo` or
more may still be. Coming back up, keys arrive in ascending order, so the first
one above `hi` means every later one is too, and the loop stops. With
`keys_between(30, 65)` on the example tree, the walk stacks 50 and 30, steps
past 20 without stacking it, and returns 30, 40, 50, 60 and 65, stopping at
70 without touching 80. The stack can run dry when every key still unvisited
is below `lo` (try `keys_between(81, 90)`), which is the `if not stack` check
in Python and the `next === undefined` check in TypeScript.

```python
    def height(self) -> int:
        """Edges on the longest path down from the root; -1 for an empty tree."""
        level = [] if self._root is None else [self._root]
        height = -1
        while level:
            height += 1
            level = [c for n in level for c in (n.left, n.right) if c is not None]
        return height
```

```typescript
  /** Edges on the longest path down from the root; -1 for an empty tree. */
  height(): number {
    let level = this.root === null ? [] : [this.root];
    let height = -1;
    while (level.length > 0) {
      height++;
      level = level.flatMap((n) => [n.left, n.right]).filter((c) => c !== null);
    }
    return height;
  }
}
```

`height` isn't something a user of a tree usually needs; it's here so the tests
can show the shape problem. It counts levels: start with the list holding the
root, replace the list with all their children, and count how many times that
happens before the list is empty, starting from −1 so a lone root has height
0, the same edge count [Binary Tree](/dsa/binary-tree) uses. The example tree
has height 3 (50 → 70 → 60 → 65).

## Invariants

These hold after every call returns:

- **The BST invariant.** For every node, every key in its left subtree is
  smaller and every key in its right subtree is larger. `insert` keeps it by
  attaching each new key where a search for it would look; `delete` keeps it by
  promoting a child's whole subtree, or by copying in the successor, which fits
  the vacated position exactly.
- **Each key appears at most once.** `insert` returns before adding a key it
  finds, and the two-child delete moves the successor's key rather than copying
  it: the successor's own node is removed straight after.
- **The size equals the number of nodes**: it goes up only when `insert` adds a
  node and down only when `delete` removes one.

## Tricky lines

- `while successor.left is not None` in `delete`. Stopping at `node.right`
  instead of walking to its leftmost node copies the wrong key in. Deleting 50
  from the example would copy 70 into the root, then try to remove the old 70
  node, which has two children; the one-child code keeps 60 and drops 80. The
  tree now has 60 and 65 to the right of a root of 70, though both are smaller,
  and a search for 60, 65 or 80 fails.
- `elif parent.left is node` (TypeScript: `parent.left === node`) when the
  node is spliced out. For the two-child case it's tempting to write
  `successor_parent.left = successor.right`, since the successor is reached by
  going left. But when the right child has no left child, the successor is
  `node.right` itself, attached on the right. Deleting 50 from the tree built
  from 50, 30, 70, 20, 40 and 80 does that: the successor is 70, and the
  hard-coded line would overwrite the root's left link with 80, losing 30, 20
  and 40 and leaving both 70 and 80 in the tree twice. Checking which side the
  node hangs on handles both shapes.
- The loops themselves, in every method. The recursive versions are shorter,
  and they fail on exactly the input this entry warns about: inserting 3,000
  keys in sorted order builds a path 3,000 nodes deep, and a recursive
  `insert` in Python then raises `RecursionError`, because CPython's default
  recursion limit is 1,000 frames. The tests insert 3,000 sorted keys to hold
  the code to that.
- `if node.key < lo: node = node.right` in `keys_between`. Without it, the
  method is a full traversal with a filter, O(n) however few keys are in range.
  It skips a node's left subtree only because that subtree is smaller still;
  pushing the node and filtering it out later would give the same answer at
  full cost.
- `node = stack.pop()!` in the TypeScript iterator. The `!` tells TypeScript
  the stack isn't empty, which the loop guarantees: if `node` is `null`, the
  `while` condition required a non-empty stack, and if it wasn't, the inner
  loop just pushed at least one node.

## When to use it

Reach for a binary search tree when you need a set or map that stays sorted
under inserts and deletes: the next larger key after this one, every booking
between two dates, the smallest value still pending. Each of those is one
O(h) walk, where a hash map would have to look at every key.

Don't ship the unbalanced version above, because real input is often sorted or
nearly sorted (timestamps, IDs from a counter), and that is its worst case.
Libraries use **self-balancing** trees, which add a rule about shape and repair
it with small local rearrangements called rotations after each insert or
delete, keeping the height O(log n) on every input. An **AVL tree** keeps the
heights of every node's two subtrees within one of each other. A **red-black
tree** colors each node red or black under rules that keep the longest path at
most twice the shortest. Java's `TreeMap` is documented as a red-black tree,
with guaranteed log(n) time for `get`, `put` and `remove`. Python's standard
library has no sorted map; in Python you'd use a sorted list with `bisect` for
small data or a third-party package for large.

In interviews the unbalanced BST is the version people expect you to write,
and the questions are about the invariant: validate that a binary tree is a
BST (check each node against bounds its ancestors set, not just against its
children), find the k-th smallest key (an inorder walk that stops at k), or
find the lowest common ancestor of two keys (the first node whose key lies
between them). Databases take the idea further for data on disk: a
[B-tree index](/systems-and-infrastructure/database-indexing) gives each node
hundreds of keys and children, so even a huge table is only a few levels deep
and a lookup reads only a few pages from disk.
