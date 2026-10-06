---
title: Binary Search Tree
summary: A binary tree that keeps smaller keys on each node's left and larger on its right, so search, insert and remove each walk one path, as long as the tree stays bushy.
date: 2026-10-05
kind: data-structure
---

A binary search tree keeps keys sorted while you add and remove them. Build one from the keys `50, 30, 70, 20, 40, 60, 80, 65`, remove from it three ways, and then feed the same keys in a different order to see what breaks it.

## Prerequisites

- [Binary tree](/dsa/binary-tree): the vocabulary (root, child, subtree, leaf, height) and in-order traversal, visiting left subtree, node, right subtree. This entry adds an ordering rule to that shape.
- [Binary search](/dsa/binary-search): the idea of discarding half the candidates with one comparison. A tree does the same by discarding a subtree.

## What it is

Suppose you need a sorted collection that changes. A sorted array finds a key quickly but pays O(n) to insert into the middle, because everything after it shifts. A [hash map](/dsa/hash-map) inserts quickly but has no idea which key comes next. A **binary search tree** (BST) gets both reasonably well.

Its one rule, the **BST invariant**: for every node, every key in its left subtree is smaller and every key in its right subtree is larger. The whole subtrees, not just the two children. This version stores distinct integers, so "smaller" and "larger" are strict.

Inserting the example keys in order builds this tree:

```text
        50
      /    \
    30      70
   /  \    /  \
  20  40  60  80
            \
             65
```

To find 65, compare it with 50 (larger, go right), then 70 (smaller, go left), then 60 (larger, go right), then reach 65. Each comparison throws away a node and one whole side, so you touched 4 of 8 nodes. Inserting is the same walk: where the search falls off the tree is where the new node goes. That's how 65 got attached as 60's right child.

The invariant has a second payoff. An in-order traversal yields `20, 30, 40, 50, 60, 65, 70, 80`, the keys sorted, with no sort step.

Now the catch. Insert the same keys already sorted, `20, 30, 40, 50, 60, 65, 70, 80`, and every key is larger than all before it, so each goes right. You get a chain, a linked list that happens to obey the rule. Finding 80 takes 8 nodes instead of 3. Building the chain costs 0 + 1 + ... + 7 = 28 node visits against 13 for the bushy tree (the depths of the 8 new nodes). The tree's speed is its **height**, and insertion order decides the height.

## When to use it

- You need keys kept in sorted order while inserting and deleting. If you sort once and never change the data, an array is simpler.
- The question asks for something relative to a key: the next larger or smaller key, the largest key at most `x`, the k-th smallest, or every key in a range. A hash map can't do these.
- The input is a tree and the statement says "search tree", or asks you to validate one. Use the ordering to skip subtrees.
- If you only look up exact keys, use a hash map. If you only ever need the smallest, use a [heap](/dsa/heap).

## Operations and costs

Average means keys arrive in random order, which keeps the tree bushy with height O(log n). Worst means sorted order, a chain of height n - 1.

| Operation                     | Average  | Worst |
| ----------------------------- | -------- | ----- |
| Search                        | O(log n) | O(n)  |
| Insert                        | O(log n) | O(n)  |
| Remove                        | O(log n) | O(n)  |
| Smallest or largest key       | O(log n) | O(n)  |
| In-order traversal (all keys) | O(n)     | O(n)  |
| Space                         | O(n)     | O(n)  |

Every row except traversal is one walk down a path, so its cost is the height. Traversal visits each node once.

A **self-balancing** tree (AVL, red-black) rotates nodes after an insert or remove to keep the height O(log n) whatever the order, which makes the worst case match the average. Java's `TreeMap` and C++'s `std::map` are typically red-black trees. In an interview you write the plain version, and when asked what happens on sorted input, you say it degrades to a list and balancing fixes it. The rule: **an ordered structure's cost follows its shape, so ask what keeps the shape in check.**

## Implementation

Search, insert and remove all start by walking to a key, so `find` does that once and returns the node and its parent.

```python
from collections.abc import Iterator
from math import inf

class Node:
    def __init__(self, key: int) -> None:
        self.key = key
        self.left: Node | None = None
        self.right: Node | None = None

def find(root: Node | None, key: int) -> tuple[Node | None, Node | None]:
    """The node holding key (None if absent) and its parent."""
    # A node can't unlink itself, so the walk carries its parent along.
    parent, node = None, root
    while node is not None and node.key != key:
        parent, node = node, (node.left if key < node.key else node.right)
    return parent, node

def contains(root: Node | None, key: int) -> bool:
    return find(root, key)[1] is not None

def insert(root: Node | None, key: int) -> Node:
    """Returns the root, which is new only when the tree was empty."""
    parent, node = find(root, key)
    if node is not None:
        # A second copy would break the strict smaller/larger rule.
        return root
    new = Node(key)
    if parent is None:
        return new
    if key < parent.key:
        parent.left = new
    else:
        parent.right = new
    return root
```

```typescript
export class Node {
  left: Node | null = null;
  right: Node | null = null;
  constructor(public key: number) {}
}

/** The node holding key (null if absent) and its parent. */
export function find(root: Node | null, key: number): [Node | null, Node | null] {
  // A node can't unlink itself, so the walk carries its parent along.
  let parent: Node | null = null;
  let node = root;
  while (node !== null && node.key !== key) {
    parent = node;
    node = key < node.key ? node.left : node.right;
  }
  return [parent, node];
}

export function contains(root: Node | null, key: number): boolean {
  return find(root, key)[1] !== null;
}

/** Returns the root, which is new only when the tree was empty. */
export function insert(root: Node | null, key: number): Node {
  const [parent, node] = find(root, key);
  // A second copy would break the strict smaller/larger rule.
  if (node !== null) return root as Node;
  const added = new Node(key);
  if (parent === null) return added;
  if (key < parent.key) parent.left = added;
  else parent.right = added;
  return root as Node;
}
```

Both `insert` and `remove` return the root, because inserting into an empty tree or removing the root changes which node that is. Callers write `root = insert(root, key)`.

Remove has three cases by how many children the node has. A leaf like 20 is just unlinked. A node with one child, like 60, is replaced by that child, so 65 moves up to 70's left. A node with two children, like 50, can't be unlinked without orphaning a subtree. Instead it takes the key of its **successor**, the smallest key in its right subtree (60 here), and the successor, which has no left child, is removed in its place. The root becomes 60, and 65 moves up as before.

```python
def remove(root: Node | None, key: int) -> Node | None:
    """Returns the root, which changes when the root itself was removed."""
    parent, node = find(root, key)
    if node is None:
        return root
    if node.left is not None and node.right is not None:
        # The smallest key on the right is the only one that can take this
        # node's place with every left key still smaller. Start the parent
        # at node: the successor may be node.right itself.
        parent, successor = node, node.right
        while successor.left is not None:
            parent, successor = successor, successor.left
        # Copy the key up rather than relink, so node's links stay valid.
        node.key = successor.key
        node = successor
    # Zero or one child now: a successor has no left child by construction.
    child = node.left if node.left is not None else node.right
    if parent is None:
        return child
    if parent.left is node:
        parent.left = child
    else:
        parent.right = child
    return root
```

```typescript
/** Returns the root, which changes when the root itself was removed. */
export function remove(root: Node | null, key: number): Node | null {
  let [parent, node] = find(root, key);
  if (node === null) return root;
  if (node.left !== null && node.right !== null) {
    // The smallest key on the right is the only one that can take this
    // node's place with every left key still smaller. Start the parent
    // at node: the successor may be node.right itself.
    parent = node;
    let successor = node.right;
    while (successor.left !== null) {
      parent = successor;
      successor = successor.left;
    }
    // Copy the key up rather than relink, so node's links stay valid.
    node.key = successor.key;
    node = successor;
  }
  // Zero or one child now: a successor has no left child by construction.
  const child = node.left ?? node.right;
  if (parent === null) return child;
  if (parent.left === node) parent.left = child;
  else parent.right = child;
  return root;
}
```

Two more functions finish the entry. `in_order` is [binary tree's `inorder`](/dsa/binary-tree) loop written as a generator, so a caller can stop early: that answers "k-th smallest" and "all keys in a range". `is_valid` checks the invariant, a common interview question in its own right.

```python
def in_order(root: Node | None) -> Iterator[int]:
    # An explicit stack: recursion overflows on a long chain of nodes.
    stack: list[Node] = []
    node = root
    while stack or node is not None:
        while node is not None:
            stack.append(node)
            node = node.left
        node = stack.pop()
        yield node.key
        node = node.right

def is_valid(root: Node | None) -> bool:
    # Bounds come from every ancestor, not just the parent: 50 with left
    # child 30 and 30's right child 60 passes every parent-child check.
    stack = [(root, -inf, inf)]
    while stack:
        node, lo, hi = stack.pop()
        if node is None:
            continue
        if not lo < node.key < hi:
            return False
        stack.append((node.left, lo, node.key))
        stack.append((node.right, node.key, hi))
    return True
```

```typescript
export function* inOrder(root: Node | null): Generator<number> {
  // An explicit stack: recursion overflows on a long chain of nodes.
  const stack: Node[] = [];
  let node = root;
  while (stack.length > 0 || node !== null) {
    while (node !== null) {
      stack.push(node);
      node = node.left;
    }
    node = stack.pop() as Node;
    yield node.key;
    node = node.right;
  }
}

export function isValid(root: Node | null): boolean {
  // Bounds come from every ancestor, not just the parent: 50 with left
  // child 30 and 30's right child 60 passes every parent-child check.
  const stack: [Node | null, number, number][] = [[root, -Infinity, Infinity]];
  while (stack.length > 0) {
    const [node, lo, hi] = stack.pop() as [Node | null, number, number];
    if (node === null) continue;
    if (!(lo < node.key && node.key < hi)) return false;
    stack.push([node.left, lo, node.key]);
    stack.push([node.right, node.key, hi]);
  }
  return true;
}
```

Each node carries the open interval its key must fall in: the root allows anything, going left lowers `hi` to the parent's key, going right raises `lo`. That is how 60 under 30 under 50 gets caught, since its interval is (30, 50).

## Pitfalls

- **Checking only parent and child in `is_valid`.** Without the `lo` and `hi` bounds, the tree 50, left child 30, whose right child is 60 passes: each pair is ordered, yet 60 sits left of 50, and a search for 60 goes right at the root and misses it.
- **Starting `parent` at the original parent in `remove`.** The line `parent, successor = node, node.right` makes the successor's parent the right starting point. Leave `parent` as it was and removing 70, whose successor 80 is its own right child, makes 50 drop its entire right subtree: 60, 65, 70 and 80 vanish.
- **Recursing where the tree can be deep.** A recursive `in_order` is fine on the 8-key chain but overflows the call stack on a long sorted chain, as [binary tree](/dsa/binary-tree) explains. The explicit `stack` has no such limit.
- **Letting `insert` add a duplicate.** `find` stops at the existing node, so without the early `return root` the new node is attached to that node's parent and replaces it. Inserting 30 again would cut off 20 and 40 along with it.
