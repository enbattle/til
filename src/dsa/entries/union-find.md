---
title: Union-Find
summary: Tracking which elements belong together as groups merge, by pointing each element at a parent and keeping the trees flat, so every merge and every "same group?" question costs nearly constant time.
date: 2026-10-01
kind: data-structure
---

Union-find, also called a **disjoint-set union** (DSU), keeps track of a
collection of elements split into groups that never overlap, and answers one
question fast: are these two elements in the same group? Groups only ever
merge, never split. That fits more problems than it sounds like it would:
which computers on a network can reach each other as cables are added, which
pixels belong to the same blob, whether adding a road to a map closes a loop.
This entry builds one over the elements 0 to n − 1 with the two optimizations
that make it fast, and shows what goes wrong without each.

## Prerequisites

- [Array and Dynamic Array](/dsa/dynamic-array): the whole structure is two
  arrays indexed by element number, and every step relies on reading
  `parent[i]` in constant time.

## What it is

The groups are called **sets**, and because no element is in two of them they
are **disjoint**. The structure supports two operations, which give it its
name:

- **find(x)** returns a name for the set that holds `x`. Two elements are in
  the same set exactly when `find` returns the same name for both.
- **union(a, b)** merges the set holding `a` with the set holding `b`.

The name of a set is one of its own members, its **representative**. The
trick is how the structure stores who represents whom. Every element keeps a
pointer to one other element of its set, its **parent**, and following parent
pointers always ends at the representative, which is its own parent. So each
set is a tree with the representative as its **root**, and the whole
structure is a collection of trees, a **forest**. The forest lives in one
array: `parent[i]` is the parent of element `i`.

At the start every element is alone in its own set, so `parent[i] = i` for
every `i`: n trees of one node each. `find(x)` walks up from `x` until it
reaches an element that is its own parent. `union(a, b)` finds both roots and,
if they differ, makes one root the parent of the other. That one write merges
two whole sets, however big they are.

Here is a forest over 6 elements after `union(0, 1)`, `union(2, 3)`,
`union(4, 5)` and `union(2, 4)`, using the code below:

```text
index    0  1  2  3  4  5
parent   0  0  2  2  2  4

   0         2
   |        / \
   1       3   4
               |
               5
```

There are two sets, {0, 1} with root 0 and {2, 3, 4, 5} with root 2.
`find(5)` walks 5 → 4 → 2 and returns 2. Nothing in the tree's shape means
anything beyond "these are in one set": which element is the root and how the
branches hang depend only on the order of the unions.

### Why the plain version is slow

Written the obvious way, `union(a, b)` sets `parent[find(a)] = find(b)` and
`find` just walks. Run `union(0, 1)`, `union(0, 2)`, `union(0, 3)`, and so on:
each time, 0's root becomes a child of the new element, and the forest grows
into one long chain:

```text
0 → 1 → 2 → 3 → … → n−1
```

The k-th union has to walk k − 1 links to find 0's root, so n − 1 unions take
(n − 1)(n − 2) / 2 steps in total: about 50 million for 10,000 elements. A
single `find(0)` at the end walks all n − 1 links. The two optimizations
below each attack that chain from a different side.

**Union by size** decides which root goes under which. Each root records how
many elements its tree holds, and `union` always hangs the smaller tree under
the root of the larger one. On the sequence above, every new element joins
under 0's root, and the forest stays a star of depth 1. In general, an
element's depth grows by one only when its tree is hung under a tree at least
as large, so the tree containing it at least doubles every time. A tree can't
pass n elements, so that happens at most log₂ n times: no element is ever more
than log₂ n links from its root. With n = 1024, that's at most 10 links.
(**Union by rank** is the same idea using an upper bound on the tree's height
instead of its size; either one gives this guarantee.)

**Path compression** fixes the paths that do get long. After `find(x)` has
walked up to the root, it goes along the same path a second time and points
every element on it straight at the root. The walk it just paid for is never
paid again: the next `find` on any of those elements takes one step.

Continuing the example, `union(1, 5)` finds root 0 for element 1, and for
element 5 walks 5 → 4 → 2, pointing 5 directly at 2 on the way. The tree under
2 holds 4 elements and the one under 0 holds 2, so 0 goes under 2:

```text
index    0  1  2  3  4  5
parent   2  0  2  2  2  2

        2
     / | | \
    0  3 4  5
    |
    1
```

A later `find(1)` walks 1 → 0 → 2 and then points 1 at 2, which leaves every
element one link from the root: `parent` is `[2, 2, 2, 2, 2, 2]`.

## Operations and costs

The costs use big-O notation, with n the number of elements: O(1) means the
work doesn't grow with n, and O(log n) means it grows with the number of times
n can be halved. **Amortized** means averaged over a long run of operations,
where an occasional expensive one is paid for by the many cheap ones around it.

| Operation               | Amortized | Worst case, one call |
| ----------------------- | --------- | -------------------- |
| Create (`UnionFind(n)`) | O(n)      | O(n)                 |
| `find(x)`               | O(α(n))   | O(log n)             |
| `union(a, b)`           | O(α(n))   | O(log n)             |
| `connected(a, b)`       | O(α(n))   | O(log n)             |
| `size_of(x)` / `sizeOf` | O(α(n))   | O(log n)             |
| `count`                 | O(1)      | O(1)                 |
| Space                   | O(n)      | O(n)                 |

α is the **inverse Ackermann function**. The Ackermann function grows faster
than towers of exponents, and α(n) counts how far along it you must go to
reach n, so α grows extremely slowly: it is at most 4 for any n that could be
stored on a real computer. Robert Tarjan proved in 1975
that with both union by size (or rank) and path compression, any sequence of m
operations on n elements takes O(m · α(n)) time in total. That's nearly
constant per operation, but not constant: α does grow without limit, and later
work showed that no structure for this problem can do better in the worst
case. In practice, read it as "a handful of steps".

The bound needs both optimizations. Union by size alone guarantees the
O(log n) depth from the section above, but repeated finds pay that depth every
time. Path compression alone, with the roots linked in any order, gives
O(log n) amortized. The worst-case column holds because path compression only
ever shortens paths, so the log₂ n depth bound from union by size still
applies to any single call; it's the amortized cost that drops to α(n).

## Implementation

Both versions store the forest as a parent array and the tree sizes as a
second array of the same length. `sizes[r]` is meaningful only when `r` is a
root; for any other element it holds a stale value that nothing reads. The
TypeScript version uses `Int32Array`, a fixed-length array of 32-bit integers,
since the length never changes and every entry is a small whole number.

```python
from collections.abc import Iterable


class UnionFind:
    """Disjoint sets over the elements 0..n-1: union by size, path compression."""

    def __init__(self, n: int):
        if n < 0:
            raise ValueError("n must not be negative")
        self._parent = list(range(n))
        self._size = [1] * n
        self._count = n

    @property
    def count(self) -> int:
        """The number of separate sets."""
        return self._count
```

```typescript
/** Disjoint sets over the elements 0..n-1: union by size, path compression. */
export class UnionFind {
  private readonly parent: Int32Array;
  private readonly sizes: Int32Array;
  private sets: number;

  constructor(n: number) {
    if (!Number.isInteger(n) || n < 0) {
      throw new RangeError('n must be a non-negative integer');
    }
    this.parent = Int32Array.from({ length: n }, (_, i) => i);
    this.sizes = new Int32Array(n).fill(1);
    this.sets = n;
  }

  /** The number of separate sets. */
  get count(): number {
    return this.sets;
  }
```

Every element starts as its own parent, in a tree of size 1, and there are n
sets. The number of sets is kept in a counter rather than computed when asked,
because computing it means calling `find` on every element; the counter only
changes in one place, when a union actually merges two sets. `n = 0` is
allowed and gives an empty structure with no elements to ask about.

```python
    def find(self, x: int) -> int:
        if not 0 <= x < len(self._parent):
            raise IndexError(f"element {x} is out of range")
        root = x
        while self._parent[root] != root:
            root = self._parent[root]
        while x != root:
            next_x = self._parent[x]
            self._parent[x] = root
            x = next_x
        return root
```

```typescript
  find(x: number): number {
    if (!Number.isInteger(x) || x < 0 || x >= this.parent.length) {
      throw new RangeError(`element ${x} is out of range`);
    }
    let root = x;
    while (this.parent[root] !== root) root = this.parent[root];
    let node = x;
    while (node !== root) {
      const next = this.parent[node];
      this.parent[node] = root;
      node = next;
    }
    return root;
  }
```

`find` makes two passes. The first walks up to the root without changing
anything, because until it arrives it doesn't know where to point the path.
The second walks the same path again and points each element straight at the
root. It saves the next element up before overwriting the parent pointer;
overwrite first and the walk jumps to the root after one step, leaving the
rest of the path uncompressed. Many textbooks write `find` recursively in one
line, `parent[x] = find(parent[x])`, which does the same thing on the way back
out of the recursion. With union by size no path is longer than log₂ n links
(about 30 for a billion elements), so the recursive version is safe here; the
loops just skip the cost of a call per link. Without union by size a chain can
grow n long, and recursion would then hit Python's limit (1000 calls by
default) before compression had a chance to flatten it.

```python
    def union(self, a: int, b: int) -> bool:
        root_a, root_b = self.find(a), self.find(b)
        if root_a == root_b:
            return False
        if self._size[root_a] < self._size[root_b]:
            root_a, root_b = root_b, root_a
        self._parent[root_b] = root_a
        self._size[root_a] += self._size[root_b]
        self._count -= 1
        return True
```

```typescript
  union(a: number, b: number): boolean {
    let rootA = this.find(a);
    let rootB = this.find(b);
    if (rootA === rootB) return false;
    if (this.sizes[rootA] < this.sizes[rootB]) [rootA, rootB] = [rootB, rootA];
    this.parent[rootB] = rootA;
    this.sizes[rootA] += this.sizes[rootB];
    this.sets--;
    return true;
  }
```

`union` works on roots, never on `a` and `b` themselves. After the swap,
`root_a` is the root of the larger tree, so the smaller tree always goes
underneath; on a tie, `a`'s root stays on top. The merged size is stored on
the root that survives. The return value says whether two separate sets were
merged, which is how the cycle check further down learns that an edge joined
two elements that were already connected.

```python
    def connected(self, a: int, b: int) -> bool:
        return self.find(a) == self.find(b)

    def size_of(self, x: int) -> int:
        return self._size[self.find(x)]
```

```typescript
  connected(a: number, b: number): boolean {
    return this.find(a) === this.find(b);
  }

  sizeOf(x: number): number {
    return this.sizes[this.find(x)];
  }
}
```

`connected` is the question the structure exists to answer, and it is two
finds. `size_of` reads the size at the root, the only place it's kept up to
date.

### Counting components and finding a cycle

A **graph** is a set of nodes joined by edges; see [Graph](/dsa/graph). In an
**undirected** graph, where an edge links both ways, a **connected component**
is a group of nodes that can all reach each other along edges. Union-find
answers both of the following without building the graph at all: it reads the
edges one at a time.

```python
def count_components(n: int, edges: Iterable[tuple[int, int]]) -> int:
    sets = UnionFind(n)
    for a, b in edges:
        sets.union(a, b)
    return sets.count


def has_cycle(n: int, edges: Iterable[tuple[int, int]]) -> bool:
    sets = UnionFind(n)
    for a, b in edges:
        if not sets.union(a, b):
            return True
    return False
```

```typescript
export function countComponents(n: number, edges: Iterable<[number, number]>): number {
  const sets = new UnionFind(n);
  for (const [a, b] of edges) sets.union(a, b);
  return sets.count;
}

export function hasCycle(n: number, edges: Iterable<[number, number]>): boolean {
  const sets = new UnionFind(n);
  for (const [a, b] of edges) {
    if (!sets.union(a, b)) return true;
  }
  return false;
}
```

Each edge says its two ends are in the same component, so unioning every edge
leaves exactly one set per component. With 5 nodes and the edges (0, 1),
(1, 2) and (3, 4), the sets end as {0, 1, 2} and {3, 4}: 2 components.

For the cycle check, an edge whose ends are already connected closes a loop:
there was already a path between them, and the edge is a second way across.
`union` returns `False` exactly then. With 4 nodes and the edges (0, 1), (1, 2)
and (2, 0), the first two unions merge, and the third finds 0 and 2 already in
one set, so the answer is `True`. An edge from a node to itself, or a second
copy of an edge, counts as a cycle under this rule, which is what you want if
the question is "is this a tree?"

## Invariants

These hold after every call returns, and each method relies on them:

- **Following parent pointers from any element ends at its root**, the one
  element of its set that is its own parent, without going round in a loop.
  `union` writes a parent pointer only from one root to a different root, and
  compression only points elements at the root they already reach.
- **Two elements are in the same set exactly when they have the same root.**
  Compression changes which pointers lead to the root, never which root they
  lead to.
- **`size[r]` is the number of elements in the tree under each root `r`.**
  `union` adds the absorbed tree's size to the surviving root; compression
  moves elements within one tree, so no root's count changes.
- **No element is more than log₂ n links below its root**, because of union
  by size. Compression only shortens paths.
- **`count` equals the number of roots**: it starts at n and drops by one
  exactly when `union` turns a root into a child.

## Tricky lines

- `if root_a == root_b: return False` in `union`. Without it, a union of two
  elements already in one set would write `parent[r] = r`, which changes
  nothing, but then add the tree's size to itself and decrement `count`.
  After `union(0, 1)` twice, `size_of(0)` would say 4, `count` would be one
  too low, and `has_cycle` would never see a cycle.
- `self._parent[root_b] = root_a`, not `self._parent[b] = root_a`. Re-pointing
  `b` itself moves only `b` and whatever hangs below it, and leaves the rest of
  `b`'s old set behind under its old root. Only a root speaks for its whole
  set.
- `next_x = self._parent[x]` before `self._parent[x] = root` in `find`. In the
  other order, `x` is set to the root after the first step, and only the first
  element on the path gets compressed.
- The range check at the top of `find`. In Python, `self._parent[-1]` is the
  last element, so without the check `find(-1)` with n = 4 quietly returns 3,
  and element −1 appears to be in 3's set. In TypeScript, an `Int32Array` read
  past its end returns `undefined` instead of throwing, so an unchecked
  `find(10)` returns `undefined`, and `connected(10, 11)` compares
  `undefined === undefined` and answers `true`.
- `if self._size[root_a] < self._size[root_b]`, comparing sizes of roots. Use
  `>` instead and the larger tree goes under the smaller one, so the log₂ n
  depth bound is gone. Every answer stays right, only slower, which is why
  the tests also measure tree depth.

## When to use it

Reach for union-find when groups only ever merge and the question is "are
these two together?" or "how many groups are there?", asked over and over as
the merges arrive. Counting connected components, detecting a cycle as edges
come in, grouping accounts that share an email address, and **Kruskal's
algorithm** for the cheapest set of edges connecting a graph (it adds edges
from cheapest up, skipping any that would close a cycle) are the standard
uses. Interview problems that say "connected", "groups", "provinces" or
"redundant connection" over a list of pairs are usually this.

It is the wrong tool when groups need to split, since there's no way to undo a
union short of rebuilding, or when you need the path between two elements: the
parent pointers record only who is grouped with whom, not which edges connect
them. For those, keep the graph itself and search it with breadth-first or
depth-first search. When all the edges are known up front and you only need
the components once, a single search over the [graph](/dsa/graph) does the job
in O(n + m) time for m edges; union-find earns its place when edges and
questions are interleaved. Elements that aren't already numbered 0 to n − 1, such as names, can be given
numbers with a [hash map](/dsa/hash-map) first.
