---
title: Binary Tree
summary: Nodes that each point to at most two children, visited in four standard orders, where the tree's height decides both the speed of everything built on it and whether recursion survives it.
date: 2026-10-01
kind: data-structure
---

A binary tree is a linked list that branches: each node points to up to two
nodes below it instead of one. File systems, HTML documents and the
expressions a compiler parses are all trees, and most tree interview questions
come down to visiting every node in the right order. This entry builds a tree
from the list format interview problems give you, writes the four standard
visiting orders, and shows the one way a recursive solution can fail on a
tree it handles correctly in principle: the tree is too deep.

## Prerequisites

- [Linked List](/dsa/linked-list): a tree node is a linked-list node with two
  next pointers instead of one, and the same rules about references apply.
- [Queue and Deque](/dsa/queue-and-deque): building a tree and visiting it
  level by level both hand nodes through a first-in, first-out queue.

You also need **recursion**: a function that calls itself on a smaller piece
of the problem, with a base case that stops it. Each call that hasn't returned
yet holds a **frame** on the **call stack**, the memory where the program keeps
each running call's local variables and where to return to.

## What it is

A **binary tree** is a set of **nodes**, each holding a value and two
references, **left** and **right**, to its **children**. Either reference can
be empty (`None` in Python, `null` in TypeScript). The node a child hangs from
is its **parent**. One node, the **root**, has no parent, and every other node
has exactly one. A node with no children is a **leaf**. A node together with
everything below it is a **subtree**, so a node's left child is the root of its
left subtree. An empty tree has no nodes at all.

Two measurements come up constantly, and both count **edges**, the links
between a parent and a child. A node's **depth** is the number of edges from
the root down to it, so the root has depth 0 and its children depth 1. All the
nodes at one depth form a **level**. A node's **height** is the number of edges
on the longest path from it down to a leaf, so a leaf has height 0. The tree's
height is its root's height, and this entry gives the empty tree height -1,
which makes the formula `1 + max(left height, right height)` work for a leaf.
Some sources (and LeetCode's "maximum depth" problem) count nodes on that path
instead of edges, which gives every answer one more; check which one a problem
means.

Here is the tree this entry uses as its example:

```text
        1          depth 0
       / \
      2   3        depth 1
     /   / \
    4   5   6      depth 2
     \
      7            depth 3
```

The root is 1, the leaves are 7, 5 and 6, and the tree's height is 3: the path
1, 2, 4, 7 has three edges. Node 2 has height 2 and node 3 has height 1.

A few shapes have names, because they decide what a tree can be used for:

- **Full**: every node has zero or two children, never one. The example isn't
  full, since 2 and 4 each have one child.
- **Complete**: every level is full except possibly the last, and the last
  level's nodes are packed to the left. A [heap](/dsa/heap) relies on this
  shape, because it lets the tree live in a plain array with no gaps.
- **Perfect**: every level is full. A perfect tree of height h has
  2^(h+1) - 1 nodes, half of them (rounded up) leaves.
- **Balanced** (height-balanced): at every node, the heights of the left and
  right subtrees differ by at most one. The example is not balanced: node 2's
  left subtree has height 1 and its right subtree, empty, has height -1.
- **Degenerate**: every node has at most one child, so the tree is a linked
  list leaning left or right, and n nodes make a tree of height n - 1.

The difference between those last two is the point of this entry. Level d can
hold at most 2^d nodes, so a tree of n nodes is at least about log₂ n deep, and
a balanced or complete tree stays close to that: a complete tree of a million
nodes has height 19. A degenerate tree of a million nodes has height 999,999.
Every operation that walks from the root down a path costs time in proportion
to the height, so the shape, not the number of nodes, decides whether a tree is
fast.

**Traversing** a tree means visiting every node once. Three orders go **depth
first**, finishing one subtree before starting the other, and differ only in
when a node is visited relative to its two subtrees:

| Order     | Visit                     | On the example         |
| --------- | ------------------------- | ---------------------- |
| Preorder  | node, left, right         | 1, 2, 4, 7, 3, 5, 6    |
| Inorder   | left, node, right         | 4, 7, 2, 1, 5, 3, 6    |
| Postorder | left, right, node         | 7, 4, 2, 5, 6, 3, 1    |
| Level     | each depth, left to right | 1 / 2, 3 / 4, 5, 6 / 7 |

Each has a use. Preorder sees a parent before its children, which is how you
copy a tree or print it as an indented outline. Inorder sees everything on a
node's left before the node and everything on its right after, so on a
[binary search tree](/dsa/binary-search-tree) it lists the values in sorted
order. Postorder sees both children before their parent, which is what you
need to compute something from the subtrees up (a height, a size, the total
size of a folder) or to free a tree bottom up. **Level order**, also called
breadth first, visits the tree one depth at a time.

## Operations and costs

n is the number of nodes and h the tree's height. **Extra space** is memory
beyond the tree and the output list: the call stack's frames for a recursive
function, or the explicit stack or queue for an iterative one. h is about
log₂ n for a balanced tree and n - 1 for a degenerate one, which is where the
two space columns come from.

| Operation                    | Time | Extra space, balanced | Extra space, degenerate |
| ---------------------------- | ---- | --------------------- | ----------------------- |
| `build_tree(values)`         | O(n) | O(n)                  | O(1) Python, O(n) TS    |
| Preorder, inorder, postorder | O(n) | O(log n)              | O(n)                    |
| `inorder_iterative`          | O(n) | O(log n)              | O(n)                    |
| `level_order`                | O(n) | O(n)                  | O(1)                    |
| `height`, `size`             | O(n) | O(log n)              | O(n)                    |
| Find a value (no ordering)   | O(n) | O(log n)              | O(n)                    |
| Space for the tree itself    | O(n) | O(n)                  | O(n)                    |

Every operation here touches each node a constant number of times, so each is
O(n) time. Nothing about a plain binary tree says where a value is, so finding
one means looking everywhere; a binary search tree adds the ordering that
makes a search follow one path.

The space columns are opposites, and that's worth remembering. A depth-first
traversal holds one frame (or stack entry) per node on the path from the root
to where it is, so its space is O(h): small for a bushy tree, n for a chain. A
level-order traversal holds the nodes of about one level at a time. A chain's
levels have one node each, but a perfect tree's last level holds half of all
its nodes, so level order needs O(n) space exactly where depth first needs the
least. Python's `build_tree` has the same queue, so its extra space follows
level order's. The TypeScript `buildTree` reads its queue through a `head`
index instead of shifting it, and that array never shrinks, so it holds every
node it built: O(n) extra space on every shape, the price of O(1) dequeues.

## Implementation

The Python node is a small class with `__slots__`, like the linked-list node;
the TypeScript one declares its three fields in the constructor's parameter
list.

```python
from collections import deque
from collections.abc import Sequence
from typing import Generic, TypeVar

T = TypeVar("T")


class TreeNode(Generic[T]):
    """One node: a value and references to a left and a right child, or None."""

    __slots__ = ("value", "left", "right")

    def __init__(
        self,
        value: T,
        left: "TreeNode[T] | None" = None,
        right: "TreeNode[T] | None" = None,
    ) -> None:
        self.value = value
        self.left = left
        self.right = right
```

```typescript
/** One node: a value and references to a left and a right child, or null. */
export class TreeNode<T> {
  constructor(
    public value: T,
    public left: TreeNode<T> | null = null,
    public right: TreeNode<T> | null = null,
  ) {}
}
```

There is no separate tree class. A tree is just a reference to its root node,
and an empty tree is `None`. That keeps every function below a plain function
of a node, which is also the shape interview problems use, and it makes
recursion natural: a node's left child is a tree in its own right. The quotes
around `"TreeNode[T] | None"` are there because the class refers to itself
inside its own definition; before Python 3.14, the annotations on a `def` are
evaluated when the `def` runs, and at that moment the name `TreeNode` doesn't
exist yet. TypeScript's `public value: T` in the parameter list declares the
field and assigns it in one step.

Interview problems write a tree as a list in level order, with `None` (or
`null`) where a child is missing: the example is
`[1, 2, 3, 4, None, 5, 6, None, 7]`, the format LeetCode uses. Only the
children of nodes that exist are listed, so the values after the root come in
pairs, one pair per node in level order: a left child and a right child.

```python
def _attach(
    values: Sequence[T | None], i: int, queue: deque[TreeNode[T]]
) -> TreeNode[T] | None:
    """The child described by values[i], queued for its own children, or None."""
    if i >= len(values) or values[i] is None:
        return None
    child = TreeNode(values[i])
    queue.append(child)
    return child


def build_tree(values: Sequence[T | None]) -> TreeNode[T] | None:
    """Build a tree from its level order, where None marks a missing child."""
    root = TreeNode(values[0]) if values and values[0] is not None else None
    queue: deque[TreeNode[T]] = deque([root] if root is not None else [])
    i = 1
    while i < len(values):
        if not queue:
            raise ValueError(f"the value at index {i} has no parent")
        node = queue.popleft()
        node.left = _attach(values, i, queue)
        node.right = _attach(values, i + 1, queue)
        i += 2
    return root
```

```typescript
/** Build a tree from its level order, where null marks a missing child. */
export function buildTree<T>(values: readonly (T | null)[]): TreeNode<T> | null {
  const first = values.length > 0 ? values[0] : null;
  const root = first === null ? null : new TreeNode(first);
  const queue: TreeNode<T>[] = root === null ? [] : [root];
  let head = 0; // queue[head] is the next node waiting for its children
  const attach = (i: number): TreeNode<T> | null => {
    const value = i < values.length ? values[i] : null;
    if (value === null) return null;
    const child = new TreeNode(value);
    queue.push(child);
    return child;
  };
  for (let i = 1; i < values.length; i += 2) {
    if (head === queue.length) {
      throw new RangeError(`the value at index ${i} has no parent`);
    }
    const node = queue[head++];
    node.left = attach(i);
    node.right = attach(i + 1);
  }
  return root;
}
```

The queue holds the nodes that have been created but haven't received their
children yet, in the order they were created, which is level order. Each pass
takes the oldest one and gives it the next pair of values. A missing child
creates no node and joins no queue, which is why the list never needs entries
for the children of a gap. Building the example:

| Node taken | Pair (indices) | Children attached | Queue afterwards |
| ---------- | -------------- | ----------------- | ---------------- |
| 1          | 2, 3 (1, 2)    | left 2, right 3   | 2, 3             |
| 2          | 4, None (3, 4) | left 4            | 3, 4             |
| 3          | 5, 6 (5, 6)    | left 5, right 6   | 4, 5, 6          |
| 4          | None, 7 (7, 8) | right 7           | 5, 6, 7          |

At index 9 the list runs out, and 5, 6 and 7 stay childless. A list that ends
after a left child, like `[1, 2]`, is fine: `_attach` treats an index past the
end as a gap, so a trailing `None` is optional. A list with values left over
after every node has had its pair, like `[1, None, None, 4]`, describes no
tree, and the queue runs dry with values still unread, so both versions raise.
The TypeScript version keeps its queue in a plain array with a `head` index
rather than calling `shift()`, which can move every remaining element.

```python
def preorder(root: TreeNode[T] | None) -> list[T]:
    values: list[T] = []

    def visit(node: TreeNode[T] | None) -> None:
        if node is None:
            return
        values.append(node.value)
        visit(node.left)
        visit(node.right)

    visit(root)
    return values


def inorder(root: TreeNode[T] | None) -> list[T]:
    values: list[T] = []

    def visit(node: TreeNode[T] | None) -> None:
        if node is None:
            return
        visit(node.left)
        values.append(node.value)
        visit(node.right)

    visit(root)
    return values


def postorder(root: TreeNode[T] | None) -> list[T]:
    values: list[T] = []

    def visit(node: TreeNode[T] | None) -> None:
        if node is None:
            return
        visit(node.left)
        visit(node.right)
        values.append(node.value)

    visit(root)
    return values
```

```typescript
export function preorder<T>(root: TreeNode<T> | null): T[] {
  const values: T[] = [];
  const visit = (node: TreeNode<T> | null): void => {
    if (node === null) return;
    values.push(node.value);
    visit(node.left);
    visit(node.right);
  };
  visit(root);
  return values;
}

export function inorder<T>(root: TreeNode<T> | null): T[] {
  const values: T[] = [];
  const visit = (node: TreeNode<T> | null): void => {
    if (node === null) return;
    visit(node.left);
    values.push(node.value);
    visit(node.right);
  };
  visit(root);
  return values;
}

export function postorder<T>(root: TreeNode<T> | null): T[] {
  const values: T[] = [];
  const visit = (node: TreeNode<T> | null): void => {
    if (node === null) return;
    visit(node.left);
    visit(node.right);
    values.push(node.value);
  };
  visit(root);
  return values;
}
```

The three functions are the same function with one line moved: the line that
records the node goes before, between or after the two recursive calls. The
base case is the empty tree, not the leaf. Checking `node is None` once at the
top means the calls on a leaf's two missing children simply return, so no code
has to ask whether a child exists before calling. Each function collects into
one list through an inner `visit` rather than returning a list from every
call and joining them, which would copy values again at every level, O(n·h)
in total instead of O(n).

The recursion is where depth matters. While `visit` is at a node of depth d,
the call stack holds d + 1 unfinished `visit` calls, one for each node on the
path from the root. On a degenerate tree of n nodes that's n frames at once,
and both languages limit the call stack. Python stops at a recursion limit of
1000 frames by default (`sys.getrecursionlimit()`), and in Python 3.14 on the
machine this entry was written on, `inorder` handled a left-leaning chain of 997 nodes and
raised `RecursionError` at 998. JavaScript engines limit the stack's memory
instead, so the depth varies with the frame size; in Node 24 here, the
TypeScript `inorder` handled a 9,741-node chain and threw a `RangeError`
("Maximum call stack size exceeded") just past that. A balanced tree never
gets near either limit: a million nodes is about 20 frames deep.

```python
def inorder_iterative(root: TreeNode[T] | None) -> list[T]:
    values: list[T] = []
    stack: list[TreeNode[T]] = []
    node = root
    while node is not None or stack:
        while node is not None:
            stack.append(node)
            node = node.left
        node = stack.pop()
        values.append(node.value)
        node = node.right
    return values
```

```typescript
export function inorderIterative<T>(root: TreeNode<T> | null): T[] {
  const values: T[] = [];
  const stack: TreeNode<T>[] = [];
  let node = root;
  while (node !== null || stack.length > 0) {
    while (node !== null) {
      stack.push(node);
      node = node.left;
    }
    const top = stack.pop() as TreeNode<T>;
    values.push(top.value);
    node = top.right;
  }
  return values;
}
```

When a tree may be deep, replace the call stack with a stack you own. A list
can grow to millions of entries, limited only by memory. The stack holds only
the ancestors still waiting to be recorded: the nodes whose left side is being
visited. The recursive version keeps a frame for those and also for every
ancestor whose right side is being visited, so on a right-leaning chain
recursion goes n deep while this stack never holds more than one node. The inner loop walks
left as far as it can, pushing each node, because inorder must record the
leftmost node first. Then the top of the stack is the next node in order: pop
it, record it, and move to its right subtree, which gets the same treatment.
On the example:

| Stack after walking left | Popped and recorded | Then move to |
| ------------------------ | ------------------- | ------------ |
| 1, 2, 4                  | 4                   | 7            |
| 1, 2, 7                  | 7                   | None         |
| 1, 2                     | 2                   | None         |
| 1                        | 1                   | 3            |
| 3, 5                     | 5                   | None         |
| 3                        | 3                   | 6            |
| 6                        | 6                   | None         |

The output is 4, 7, 2, 1, 5, 3, 6, the same as the recursive version. The
TypeScript `as TreeNode<T>` tells the compiler what the loop already
guarantees: `pop()` is typed as possibly `undefined`, but the inner loop has
just pushed at least one node or the outer condition saw a non-empty stack.

```python
def level_order(root: TreeNode[T] | None) -> list[list[T]]:
    levels: list[list[T]] = []
    queue = deque([root] if root is not None else [])
    while queue:
        level: list[T] = []
        for _ in range(len(queue)):
            node = queue.popleft()
            level.append(node.value)
            if node.left is not None:
                queue.append(node.left)
            if node.right is not None:
                queue.append(node.right)
        levels.append(level)
    return levels
```

```typescript
export function levelOrder<T>(root: TreeNode<T> | null): T[][] {
  const levels: T[][] = [];
  let level = root === null ? [] : [root];
  while (level.length > 0) {
    levels.push(level.map((node) => node.value));
    const next: TreeNode<T>[] = [];
    for (const node of level) {
      if (node.left !== null) next.push(node.left);
      if (node.right !== null) next.push(node.right);
    }
    level = next;
  }
  return levels;
}
```

Level order can't be written with a stack, because a stack hands back the node
added most recently, which sends the traversal down one branch. A queue hands
back the oldest node, so every node at depth d leaves the queue before any
node at depth d + 1. The answer here is grouped by level, so the Python
version needs to know where one level ends: at the start of each pass the
queue holds exactly one whole level, and `range(len(queue))` takes that many
nodes, leaving the children added meanwhile for the next pass. The TypeScript
version keeps the two levels in separate arrays instead, which needs no queue
at all and no `shift()`.

```python
def height(root: TreeNode[T] | None) -> int:
    """Edges on the longest path from the root down to a leaf; -1 when empty."""
    if root is None:
        return -1
    return 1 + max(height(root.left), height(root.right))


def size(root: TreeNode[T] | None) -> int:
    if root is None:
        return 0
    return 1 + size(root.left) + size(root.right)
```

```typescript
/** Edges on the longest path from the root down to a leaf; -1 when empty. */
export function height<T>(root: TreeNode<T> | null): number {
  if (root === null) return -1;
  return 1 + Math.max(height(root.left), height(root.right));
}

export function size<T>(root: TreeNode<T> | null): number {
  if (root === null) return 0;
  return 1 + size(root.left) + size(root.right);
}
```

`height` and `size` are postorder in disguise: each needs both subtrees'
answers before it can produce its own. Most tree questions have this shape.
Decide what an empty tree returns, then how a node combines its children's
answers with its own. On the example, `height` returns 0 at 7, 5 and 6, then 1
at 4 and 3, 2 at 2, and 1 + max(2, 1) = 3 at the root. Like the recursive
traversals, both are n frames deep on a degenerate tree.

## Invariants

These hold for every tree the functions build or accept:

- **Every node except the root has exactly one parent, and the root has
  none.** Two parents sharing a child would make the traversals visit it
  twice, and a reference back up to an ancestor would make them loop forever.
  `build_tree` creates each node once and attaches it once.
- **Following child references from the root reaches every node** of the tree,
  each by exactly one path. That path is what depth and level count.
- **Left and right are different positions.** A node with only a left child
  and a node with only a right child are different trees with different
  inorder sequences, which is why the list format keeps a `None` for a missing
  left child instead of skipping it.

## Tricky lines

- `values[i] is None` in `_attach`, not `not values[i]`, and `value === null`
  in the TypeScript `attach`, not `!value`. The shorter tests also reject 0,
  `""` and `False`, so a node holding 0 silently becomes a gap. Worse, every
  later pair then goes to the wrong parent: in `[1, 0, 2, 3]` the 3 belongs to
  0, but with 0 skipped the queue hands it to 2.
- `range(len(queue))` in `level_order`, rather than `while queue` for the inner
  loop. `range` reads the length once, when the pass starts. An inner loop that
  re-checked the queue would keep taking the children it just added, and the
  whole tree would come back as a single level.
- `while node is not None or stack:` in `inorder_iterative`. Testing only the
  stack ends the loop before it starts, because the stack is empty when the
  function begins. It also stops too early later: on the example, after 1 is
  popped the stack is empty while `node` is 3, so 5, 3 and 6 would be lost.
- `return -1` for an empty tree in `height`. Returning 0 counts nodes instead
  of edges and makes every height one larger. That is the other convention
  rather than a bug, but mixing the two in one solution is an off-by-one: a
  balance check comparing a node-count height with an edge-count one would
  call a balanced tree unbalanced.
- `if not queue: raise ValueError(...)` in `build_tree`. Without it, a
  malformed list fails inside `popleft` with "pop from an empty deque", which
  says nothing about the input. In TypeScript the failure is worse:
  `queue[head++]` reads `undefined`, and the code fails with a `TypeError` on
  setting `left` of `undefined`.

## When to use it

In interviews, binary trees are mostly the input. The question gives you a
root and asks for something computed from it: its height, whether it is
balanced, the values level by level, the path with the largest sum. Nearly
every answer is one of the traversals above with work added at the visit,
and the first decision is which order the work needs: postorder when a node
needs its children's answers, preorder when children need something from their
parent (the depth so far, the path so far), level order when the question
mentions levels or the nearest anything. Mention the recursion depth when the
tree could be degenerate, and offer the explicit stack.

In real code you rarely build a bare binary tree to store data, because it
gives no fast way to find anything. The useful trees add a rule on top of this
shape: a [binary search tree](/dsa/binary-search-tree) orders values so a
search follows one path, a [heap](/dsa/heap) keeps the smallest value at the
root, and database indexes use [B-trees](/systems-and-infrastructure/database-indexing),
which give each node many children so the tree stays only a few levels deep.
Trees whose nodes can have any number of children are handled the same way,
with a list of children in place of `left` and `right`.
