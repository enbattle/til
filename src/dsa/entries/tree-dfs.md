---
title: Tree Depth-First Search
summary: The two shapes of tree recursion, passing state down the path from the root and returning values up from the subtrees, shown on root-to-leaf path sums and the diameter of a tree.
date: 2026-10-01
kind: pattern
---

Depth-first search on a tree means going all the way down one branch before
trying the next, which is what a recursive function on a node does without any
help. The [Binary Tree](/dsa/binary-tree) entry already writes the visiting
orders. This entry is about what you do with them: nearly every tree problem
is one of two shapes, and recognising which one you have tells you most of the
code. In the first shape information flows down, from a node to its children.
In the second it flows up, from the children back to the node.

## Prerequisites

- [Binary Tree](/dsa/binary-tree): the node class, building a tree from a
  level-order list, recursion on trees, and the definition of height, which
  counts edges and gives the empty tree -1. Everything below assumes them.

## The idea

Both shapes use the same skeleton: a function of a node that handles the empty
tree first, then calls itself on the left and right children. They differ in
where the answer lives.

**Passing state down.** The question is about a whole path from the root, so
each call needs to know what the path above it looks like. The example is
**root-to-leaf paths with a given sum**: every path that starts at the root,
ends at a **leaf** (a node with no children) and has node values adding up to
a target. The function carries two pieces of state. The first is `remaining`,
the target minus the values on the path so far, passed as an argument, so each
call gets its own copy and nothing needs undoing. The second is the path
itself, a list kept outside the recursion and shared by every call. Appending
a node on the way in and removing it on the way out keeps that list equal to
the path from the root to the current node at every moment. This undo step is
called **backtracking**.

Take the tree `[5, 4, 8, 11, None, 13, 4, 7, 2, None, None, 5, 1]` in
level-order form and a target of 22:

```text
          5
        /   \
       4     8
      /     / \
    11    13   4
    / \       / \
   7   2     5   1
```

The search visits 5, 4, 11, 7 first, finds that 7 is a leaf and the path
doesn't add to 22, steps back to 11, tries 2, and so on. At each leaf:

| Leaf | Path when it is reached | `remaining` | Recorded? |
| ---- | ----------------------- | ----------- | --------- |
| 7    | 5, 4, 11, 7             | -5          | no        |
| 2    | 5, 4, 11, 2             | 0           | yes       |
| 13   | 5, 8, 13                | -4          | no        |
| 5    | 5, 8, 4, 5              | 0           | yes       |
| 1    | 5, 8, 4, 1              | 4           | no        |

The answer is `[5, 4, 11, 2]` and `[5, 8, 4, 5]`. Node 4 on the left has a
child, so it is not a path end however its sum looks. The target is hit only
at a leaf, with `remaining` equal to 0.

**Returning values up.** The question is about the tree as a whole, and each
subtree can summarise itself in one number. The example is the **diameter**:
the number of edges on the longest path between any two nodes. That path need
not pass through the root. Like height in every tree entry, the diameter
counts edges, so an empty tree and a single node both have diameter 0, and a
parent with one leaf child has diameter 1. (Sources that count nodes get an
answer one larger.)

The longest path has a highest node, the one where it turns from going up to
going down. From that node, the path runs down its left subtree as far as it
can, and down its right subtree as far as it can. Its length in edges is the
left subtree's height + the right subtree's height + 2, the two extra edges
being the links from the node to its two children. The diameter is the largest
of that quantity over all nodes. Heights are computed bottom up anyway, so one
traversal does both jobs: each call **returns** its own height to its parent
and **updates** a best answer kept outside, as a side effect, using the two
heights it just received. On the example:

| Node      | Left height | Right height | Candidate (left + right + 2) | Returns |
| --------- | ----------- | ------------ | ---------------------------- | ------- |
| 7         | -1          | -1           | 0                            | 0       |
| 2         | -1          | -1           | 0                            | 0       |
| 11        | 0           | 0            | 2                            | 1       |
| 4 (left)  | 1           | -1           | 2                            | 2       |
| 13        | -1          | -1           | 0                            | 0       |
| 5 (leaf)  | -1          | -1           | 0                            | 0       |
| 1         | -1          | -1           | 0                            | 0       |
| 4 (right) | 0           | 0            | 2                            | 1       |
| 8         | 0           | 1            | 3                            | 2       |
| 5 (root)  | 2           | 2            | 6                            | 3       |

The rows are in the order the calls finish. The diameter is 6, the path 7, 11,
4, 5, 8, 4, 5, from the leaf 7 up through the root and down to the leaf 5.

## When to use it

Use the passing-down shape when the answer depends on the path from the root
to a node: path sums, "the node is on a path that spells this word," the depth
of each node, whether a value is within bounds set by its ancestors. State
that grows as you go down is an argument; state that must be undone when you
step back is a shared list or set with an append and a matching removal.

Use the returning-up shape when a node's answer is built from its children's
answers: height, size, whether the tree is balanced, the largest sum along any
path, the lowest common ancestor of two nodes. The telltale sign is a question
about the "best" or "longest" something anywhere in the tree, which means the
winner may sit in any subtree, not only the root's. Return the one number the
parent needs and record the better answer on the side. The two often mix: a
problem that asks for the longest path whose values add to a target needs the
down-state for the sum and the up-return for the length.

If the problem mentions levels, or the nodes nearest the root, depth first is
the wrong tool and level order (breadth first) fits, because it reaches nodes
in order of depth.

## Walkthrough

```python
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


def build_tree(values: list[int | None]) -> TreeNode | None:
    """Build a tree from its level order, where None marks a missing child."""
    if not values or values[0] is None:
        return None
    root = TreeNode(values[0])
    waiting = [root]  # nodes still owed children, oldest first
    next_index = 1
    for node in waiting:
        for side in ("left", "right"):
            if next_index < len(values) and values[next_index] is not None:
                child = TreeNode(values[next_index])
                setattr(node, side, child)
                waiting.append(child)
            next_index += 1
    return root
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

/** Build a tree from its level order, where null marks a missing child. */
export function buildTree(values: readonly (number | null)[]): TreeNode | null {
  const first = values.length > 0 ? values[0] : null;
  if (first === null) return null;
  const root = new TreeNode(first);
  const waiting = [root]; // nodes still owed children, oldest first
  let nextIndex = 1;
  const attach = (): TreeNode | null => {
    const value = nextIndex < values.length ? values[nextIndex] : null;
    nextIndex++;
    if (value === null) return null;
    const child = new TreeNode(value);
    waiting.push(child);
    return child;
  };
  for (const node of waiting) {
    node.left = attach();
    node.right = attach();
  }
  return root;
}
```

Each code file carries its own small node class and builder so that it runs on
its own. The builder reads the list the way the Binary Tree entry describes:
the values after the root come in pairs, a left and a right, one pair for each
node in level order. Unlike that entry's builder, it doesn't check for a value
with no parent (`[1, None, None, 5]`): it quietly drops the 5, so a mistyped
list builds a smaller tree instead of raising an error. `waiting` is that order. The loop reads a list it is
still appending to, which both languages allow: a node's children join the end
of `waiting` and get their own turn after everything already in line. The
index moves on even for a gap, because a `None` still occupies its slot in the
list; skipping it would hand every later value to the wrong parent. The test
is `is not None` and not a truthiness check, since 0 is a perfectly good node
value and a check like `if values[next_index]` would silently delete it.

```python
def paths_with_sum(root: TreeNode | None, target: int) -> list[list[int]]:
    """Every root-to-leaf path whose values add up to target, left to right."""
    paths: list[list[int]] = []
    path: list[int] = []

    def visit(node: TreeNode | None, remaining: int) -> None:
        if node is None:
            return
        path.append(node.value)
        remaining -= node.value
```

```typescript
/** Every root-to-leaf path whose values add up to `target`, left to right. */
export function pathsWithSum(root: TreeNode | null, target: number): number[][] {
  const paths: number[][] = [];
  const path: number[] = [];

  const visit = (node: TreeNode | null, remaining: number): void => {
    if (node === null) return;
    path.push(node.value);
    remaining -= node.value;
```

Two pieces of state, handled in two different ways, on purpose. `remaining`
is a number, and rebinding a parameter inside a call changes only that call's
own copy, so each child receives the right value without any cleanup. `path`
is one list for the whole search, created once outside `visit`. If every call
built a new list for its children (`path + [value]`), the code would be
correct but copy the whole path at every node, O(n·h) work in total for a tree
of n nodes and height h. One shared list makes each step O(1), at the price of
keeping it correct by hand, which is the next chunk's job. The empty-tree check
comes first so that the missing child of a one-child node is handled by the
same line as an empty input, and an empty tree returns no paths.

```python
        if node.left is None and node.right is None:
            if remaining == 0:
                paths.append(path.copy())
        else:
            visit(node.left, remaining)
            visit(node.right, remaining)
        path.pop()

    visit(root, target)
    return paths
```

```typescript
    if (node.left === null && node.right === null) {
      if (remaining === 0) paths.push([...path]);
    } else {
      visit(node.left, remaining);
      visit(node.right, remaining);
    }
    path.pop();
  };

  visit(root, target);
  return paths;
}
```

Three details carry the correctness. First, the sum is checked only at a leaf.
At a node with children, `remaining == 0` means nothing, because the path can
still continue; with the check on every node, the tree `[1, 2, None, 5]` and a
target of 3 would report the path 1, 2, which stops before the leaf 5. Second,
the `pop` runs after both recursive calls and on every route out of the
function that got past the `append`, including leaves. Skip it and the list
never shrinks: the search would reach node 8 with the path `5, 4, 11, 7, 2, 8`
instead of `5, 8`. Third, the copy. `paths.append(path)` stores a reference to
the one shared list, not its contents at that moment, so every recorded path
is the same list. As the search finishes, the pops empty it, and the answer
for the example comes back as `[[], []]`. `path.copy()` (`[...path]` in
TypeScript) freezes the contents at the moment the leaf is reached. The copy
costs O(h) per recorded path, which is fine, since writing the path into the
answer costs that much anyway. The code also has no early exit when
`remaining` goes negative. With negative values a running sum can overshoot the
target and come back: in `[1, -2, 3, 4, None, -5]` the path 1, 3, -5 adds to
-1, although `remaining` is already -2 after the 1 and -5 after the 3.

```python
def diameter(root: TreeNode | None) -> int:
    """Edges on the longest path between any two nodes; 0 for an empty tree."""
    best = 0

    def height(node: TreeNode | None) -> int:
        nonlocal best
        if node is None:
            return -1
        left = height(node.left)
        right = height(node.right)
        best = max(best, left + right + 2)
        return 1 + max(left, right)

    height(root)
    return best
```

```typescript
/** Edges on the longest path between any two nodes; 0 for an empty tree. */
export function diameter(root: TreeNode | null): number {
  let best = 0;

  const height = (node: TreeNode | null): number => {
    if (node === null) return -1;
    const left = height(node.left);
    const right = height(node.right);
    best = Math.max(best, left + right + 2);
    return 1 + Math.max(left, right);
  };

  height(root);
  return best;
}
```

The inner function is `height`, exactly as in the Binary Tree entry, with one
extra line, the update of `best`. That line sits after both recursive calls
and before the return because it needs both children's heights, which only
exist once the calls have come back. A missing child returns -1, so a leaf's
candidate is -1 + -1 + 2 = 0 and a node with one leaf child scores
0 + -1 + 2 = 1, the one edge to that child, with no special case for either.
The `+ 2` belongs to the -1: if the empty tree returned 0 and the `+ 2` stayed,
a single node would report a diameter of 2. `best` must live outside the
recursion: the winning node may be anywhere, and the function's return value is already spoken for, carrying the height to
the caller. In Python `nonlocal best` is needed because the function assigns
to `best`; without it, `best = max(...)` would create a new local variable and
read it before assignment, raising `UnboundLocalError`. TypeScript's closure
can assign to the outer `let` directly. The answer is `best`, not the return
value of `height(root)`, which is the tree's height and not its diameter: a
tree whose longest path skips the root shows the difference.

Python also caps how deep a recursion may go: `sys.getrecursionlimit()` is
1000 by default, and it counts every active call, including the call on the
empty tree at the bottom. Running both functions here on a chain of nodes that
each have only a left child, the last chain that worked had 997 nodes, and one
with 998 raised `RecursionError`. The exact number depends on how many calls
are already active when you start. A balanced tree of a million nodes is about
20 calls deep and never comes near it, but a degenerate tree is as deep as it
is long. A JavaScript copy of the same `height` limited by Node's stack memory
instead handled a chain of 13,700 nodes and threw `RangeError` ("Maximum call
stack size exceeded") before 13,800, in one run on Node 24 with the default
stack size; the figure changes with the engine, its version, its settings and
how much each call keeps on the stack. The fixes are to raise the limit
(`sys.setrecursionlimit`, which risks crashing the interpreter if set too
high) or to rewrite the traversal with an explicit stack, as
`inorder_iterative` does in the Binary Tree entry.

## Complexity

Both functions visit each node once, doing a constant amount of work per node
besides the copy below, so they take O(n) time for n nodes. Both keep one
frame per node on the path from the root to the current node, so the extra
space is O(h) for height h: about log₂ n for a balanced tree, and n - 1 for a
chain. `paths_with_sum` also holds the shared `path`, at most h + 1 entries,
which is O(h) as well.

The copy is the one cost that isn't constant. Recording a path costs its
length, and a tree can have many matching paths: take a spine of n/2 nodes
with a leaf hanging off each, all with value 0, and a target of 0. Every leaf
is a match, and the copies add up to about n²/8 values. So the worst case for
`paths_with_sum` is O(n·h) time, and the answer itself is that large, so no
method can beat it. Counting the paths instead of listing them needs no copy
and stays O(n).

## Pitfalls

- **Checking the sum at every node, not only at leaves.** A path that adds up
  to the target but stops at a node with children isn't a root-to-leaf path.
  The condition is "no left and no right child and `remaining` is 0".
- **Appending the shared list without copying it.** Every recorded path points
  at the same list, which is empty once the search ends, so the answer is a
  row of empty lists. Copy at the leaf.
- **Forgetting the `pop`, or popping before the recursive calls.** The list
  then holds nodes from other branches (never popped), or a path missing its
  own node while the children run (popped too early).
- **Pruning when `remaining` goes negative.** That is valid only when every
  value is non-negative. With negatives a partial sum can overshoot the target
  and come back, so stop at leaves, not when `remaining` passes zero.
- **Mixing height conventions in the diameter.** The `+ 2` goes with an empty
  tree returning -1. If your height counts nodes (empty tree 0), the candidate
  is `left + right + 1` and the answer is a count of nodes rather than edges.
  Check which one the problem wants, and don't combine the two.
- **Returning `best` from `height`, or `height(root)` from `diameter`.** The
  function's return value is the height, which the parent needs, and the best
  answer travels on the side. A diameter that skips the root, like the left
  subtree of `[1, 2, None, 3, 4, 5, None, None, 6]` (path 5, 3, 2, 4, 6, four
  edges, against three through the root), is the case that exposes this.
- **Trusting recursion on a deep tree.** A chain of about a thousand nodes
  crashes the Python version, as the walkthrough shows. If the input can be
  that skewed, rewrite with an explicit stack.
