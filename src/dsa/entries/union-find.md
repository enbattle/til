---
title: Union-Find
summary: Tracking which elements belong together as groups merge, by pointing each element at a parent and keeping the trees shallow, so "are these two together?" costs almost constant time.
date: 2026-10-05
kind: data-structure
template: 2
---

Union-find, also called a **disjoint-set union**, keeps elements in groups that never overlap and answers one question fast: are these two in the same group? Groups only merge, never split. That covers whether a new road closes a loop, or how many islands a map has. You'll build it over six elements, watch a plain version go slow, and fix it with two small changes.

## Prerequisites

- [Arrays and strings](/dsa/arrays-and-strings): the whole structure is two arrays indexed by element number, and every step reads `parent[i]` in constant time.

## What it is

Each group is a **set**, named by one of its own members, its **representative**. Two operations matter. `find(x)` returns the name of the set holding `x`, so two elements are together exactly when their `find` results match. `union(a, b)` merges the two sets holding `a` and `b`.

The trick is how it stores who belongs where. Every element keeps one pointer, its **parent**, to another element of its set. Following parents always ends at the representative, the **root**, which is its own parent. So each set is a tree, and the whole structure is a forest in one array, `parent[i]`. At the start every element is its own root. `find` walks up to the root; `union` finds both roots and, if they differ, makes one the parent of the other. One write merges two whole sets, however big.

Run six elements through `union(0, 1)`, `union(2, 3)`, `union(4, 5)` and `union(2, 4)`:

```text
index    0  1  2  3  4  5          0       2
parent   0  0  2  2  2  4          |      / \
                                   1     3   4
                                             |
                                             5
```

Two sets: {0, 1} rooted at 0 and {2, 3, 4, 5} rooted at 2. `find(5)` walks 5, 4, 2.

Why isn't that enough? Link the first root under the second every time, and `union(0, 1)`, `union(1, 2)`, `union(2, 3)` and on up to 1,024 elements builds a single chain `0 → 1 → 2 → … → 1023`. One `find(0)` then walks 1,023 links, and without compression every repeat walks them again. Two changes attack the chain.

**Union by size** decides which root goes under which: the smaller tree hangs under the larger tree's root. An element's depth grows by one only when its tree hangs under one at least as big, so its tree at least doubles each time. A tree can't pass n elements, so no element is more than log₂ n links from its root, 10 for n = 1,024. The same chain of unions now makes a star one link deep.

**Path compression** repairs the paths that are still long. After `find(x)` reaches the root, it points every element it passed straight at it, so the walk you paid for is paid once.

Finish the example with `union(1, 5)`. Element 1's root is 0, and 5 walks 5, 4, 2, so 5 now points directly at 2. The tree under 2 holds 4 elements and the one under 0 holds 2, so 0 goes under 2. A later `find(1)` walks 1, 0, 2 and leaves everything pointing at the root:

```text
after union(1, 5)   parent = [2, 0, 2, 2, 2, 2]
after find(1)       parent = [2, 2, 2, 2, 2, 2]
```

Why not keep a group label per element? Then `find` is one read, but `union` relabels every member of a group, O(n). The rule: when merges are as common as lookups, make the merge one pointer write and let lookups do a little work.

## When to use it

- The problem says "connected", "same group", "components", "provinces" or "merge accounts", and the pairs arrive one at a time, mixed with questions.
- You need the number of groups, or the size of one, while merges keep coming.
- "Does this edge close a cycle?" or "find the redundant connection": an edge whose ends are already together does.
- Kruskal's minimum spanning tree: take edges cheapest first, skipping any whose ends are already together ([Minimum Spanning Trees](/dsa/prim-kruskal)).
- It's the wrong tool if groups must split, since a union can't be undone, or if you need the path between two elements, since parents record membership, not edges. If all the edges are known up front and you ask once, one [breadth-first search](/dsa/breadth-first-search) over the [graph](/dsa/graph) is simpler.

Elements that aren't the numbers 0 to n − 1, such as names, get numbers from a [hash map](/dsa/hash-map) first.

## Operations and costs

With n elements, O(1) means the work doesn't grow with n. [**Amortized**](/dsa/arrays-and-strings) means averaged over a long run. α is the **inverse Ackermann function**, which grows so slowly that it stays under 5 for any n that fits in a computer.

| Operation                 | Amortized | Worst case, one call |
| ------------------------- | --------- | -------------------- |
| Create (`UnionFind(n)`)   | O(n)      | O(n)                 |
| `find(x)`                 | O(α(n))   | O(log n)             |
| `union(a, b)`             | O(α(n))   | O(log n)             |
| `connected`, `size_of`    | O(α(n))   | O(log n)             |
| `count` (a stored number) | O(1)      | O(1)                 |
| Space                     | O(n)      | O(n)                 |

With both changes, m operations cost O(m · α(n)) in total (Tarjan, 1975), so read it as a handful of steps. One call is O(log n) at worst because union by size caps the depth and compression only shortens paths. Drop union by size and the amortized cost is still O(log n); drop compression and you pay the full depth every time.

## Implementation

`sizes[r]` means something only when `r` is a root; elsewhere it's a stale value nothing reads. The TypeScript version uses `Int32Array`, a fixed-length array of 32-bit integers, because the length never changes.

```python
from collections.abc import Iterable


class UnionFind:
    """Disjoint sets over the elements 0..n-1: union by size, path compression."""

    def __init__(self, n: int) -> None:
        self._parent = list(range(n))  # a root is its own parent
        self._size = [1] * n  # read only at roots; other entries go stale
        # Kept up to date, so asking never means calling find on every element.
        self.count = n
```

```typescript
/** Disjoint sets over the elements 0..n-1: union by size, path compression. */
export class UnionFind {
  private readonly parent: Int32Array;
  private readonly sizes: Int32Array;
  count: number;

  constructor(n: number) {
    // A root is its own parent.
    this.parent = Int32Array.from({ length: n }, (_, i) => i);
    this.sizes = new Int32Array(n).fill(1); // read only at roots; others go stale
    // Kept up to date, so asking never means calling find on every element.
    this.count = n;
  }
```

Everything starts as its own root in a set of size 1, and `count` starts at n. It changes in one place, when a union merges two sets. `find` comes next.

```python
    def find(self, x: int) -> int:
        # Python reads index -1 as the last element, so without this check
        # find(-1) would quietly return the root of element n - 1.
        if not 0 <= x < len(self._parent):
            raise IndexError(f"element {x} is out of range")
        root = x
        while self._parent[root] != root:
            root = self._parent[root]
        # A second walk, because the root isn't known until the first ends.
        while x != root:
            next_x = self._parent[x]  # saved first: after the write, x's old
            self._parent[x] = root  # parent is gone and the walk would stop
            x = next_x
        return root
```

```typescript
  find(x: number): number {
    // An Int32Array read past its end gives undefined, not an error, and two
    // of them compare equal: connected(10, 11) would quietly say true.
    if (!Number.isInteger(x) || x < 0 || x >= this.parent.length) {
      throw new RangeError(`element ${x} is out of range`);
    }
    let root = x;
    while (this.parent[root] !== root) root = this.parent[root];
    // A second walk, because the root isn't known until the first ends.
    let node = x;
    while (node !== root) {
      const next = this.parent[node]; // saved first: after the write, node's old
      this.parent[node] = root; // parent is gone and the walk would stop
      node = next;
    }
    return root;
  }
```

The first loop climbs; the second walks the same path again and compresses it. `union` builds on it.

```python
    def union(self, a: int, b: int) -> bool:
        root_a, root_b = self.find(a), self.find(b)
        if root_a == root_b:
            return False  # merging a set with itself would double its size
        if self._size[root_a] < self._size[root_b]:
            root_a, root_b = root_b, root_a  # smaller under larger: depth <= log2 n
        self._parent[root_b] = root_a  # the root, not b: only a root speaks for its set
        self._size[root_a] += self._size[root_b]
        self.count -= 1
        return True
```

```typescript
  union(a: number, b: number): boolean {
    let rootA = this.find(a);
    let rootB = this.find(b);
    if (rootA === rootB) return false; // merging a set with itself would double its size
    if (this.sizes[rootA] < this.sizes[rootB]) {
      [rootA, rootB] = [rootB, rootA]; // smaller under larger: depth <= log2 n
    }
    this.parent[rootB] = rootA; // the root, not b: only a root speaks for its set
    this.sizes[rootA] += this.sizes[rootB];
    this.count--;
    return true;
  }
```

On the example, `union(1, 5)` finds roots 0 and 2, swaps because 2 holds more, and hangs 0 under 2 with size 6. The return value says whether two sets really merged, which is how a cycle check learns an edge was redundant.

```python
    def connected(self, a: int, b: int) -> bool:
        return self.find(a) == self.find(b)

    def size_of(self, x: int) -> int:
        return self._size[self.find(x)]


def has_cycle(n: int, edges: Iterable[tuple[int, int]]) -> bool:
    sets = UnionFind(n)
    # An edge whose ends are already connected is a second way across.
    return any(not sets.union(a, b) for a, b in edges)
```

```typescript
  connected(a: number, b: number): boolean {
    return this.find(a) === this.find(b);
  }

  sizeOf(x: number): number {
    return this.sizes[this.find(x)];
  }
}

export function hasCycle(n: number, edges: Iterable<[number, number]>): boolean {
  const sets = new UnionFind(n);
  for (const [a, b] of edges) {
    // An edge whose ends are already connected is a second way across.
    if (!sets.union(a, b)) return true;
  }
  return false;
}
```

`has_cycle(3, [(0, 1), (1, 2), (2, 0)])` merges on the first two edges, then finds 2 and 0 already together and returns true. A self-loop or a repeated edge counts as a cycle too. Unioning every edge and reading `count` gives the number of connected components.

## Pitfalls

- **Pointing `b` instead of its root.** `self._parent[root_b] = root_a` moves a whole set. Write `self._parent[b] = root_a` and only `b` and what hangs below it move, leaving the rest of its old set behind under the old root, so `connected` gives wrong answers.
- **Dropping the same-root check.** Without `if root_a == root_b: return False`, a repeated `union(0, 1)` adds the set's size to itself and decrements `count` again, so `size_of` and `count` drift and `has_cycle` never fires.
- **Overwriting a parent before saving it.** In `find`, `next_x` is read before `self._parent[x] = root`. Swap them and `x` jumps straight to the root after one step, so only the first element on the path gets compressed.
- **Comparing parents instead of roots in `connected`.** `self._parent[a] == self._parent[b]` looks one step up, not at the root. After the four unions in the example, 3 and 5 share a set but their parents are 2 and 4, so `connected(3, 5)` returns false.
