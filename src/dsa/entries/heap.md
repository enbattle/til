---
title: Heap and Priority Queue
summary: Always knowing the smallest item and removing it in logarithmic time, by keeping a tree in an array where every parent is no larger than its children.
date: 2026-10-01
kind: data-structure
---

A priority queue hands items back by importance rather than by arrival: a
hospital triage list, a job scheduler that runs urgent jobs first, the
"closest unvisited node" step in a shortest-path search. The structure almost
every priority queue is built on is a binary heap, which keeps the smallest
item at the front and pays only a few comparisons per insert and removal to
keep it there. This entry builds one on a plain array, then wraps it in a
priority queue that breaks ties fairly.

## Prerequisites

- [Array and Dynamic Array](/dsa/dynamic-array): the heap lives in one, grows
  by appending at the end and shrinks by popping from the end, and the costs
  below lean on both being O(1) amortized.
- [Binary Tree](/dsa/binary-tree): the heap is a complete binary tree, and the
  entry uses its words (root, parent, child, leaf, height).

## What it is

A **min-heap** is a binary tree with two rules. The **heap property**: every
node's value is no larger than its children's values, so the smallest value in
the whole tree sits at the root. The **shape rule**: the tree is
**complete**, meaning every level is full except possibly the last, and the
last level fills from left to right with no gaps. A **max-heap** is the same
with "no smaller" in place of "no larger". The heap property says nothing
about left versus right, or about cousins: a heap is far less ordered than a
sorted list, and that looseness is what makes it cheap to maintain.

The shape rule is what lets the tree live in an array with no pointers at
all. Number the nodes level by level, left to right, starting from 0 at the
root, and store node `i` at index `i`. Then the children of node `i` are at
`2i + 1` and `2i + 2`, and its parent is at `(i - 1) // 2`, where `//` divides
and rounds down. Here is the heap `[1, 3, 2, 7, 4, 5, 8]` as a tree, each
value with its index:

```text
              1 (0)
           /         \
       3 (1)          2 (2)
       /   \          /   \
   7 (3)  4 (4)   5 (5)  8 (6)
```

Index 1's children are at 3 and 4; index 5's parent is (5 − 1) // 2 = 2. Every
parent is no larger than its children, but the bottom row, 7 4 5 8, isn't
sorted, and the 3 on the left is larger than the 2 on the right. Neither
matters.

Two repair moves keep the rules true. **Sift up** moves an item toward the
root: while it is smaller than its parent, swap the two. **Sift down** moves an
item toward the leaves: while it is larger than its smaller child, swap it
with that child. A **push** appends the new item at the end of the array, the
next free spot on the bottom level, which keeps the shape, then sifts it up. A
**pop** takes the root, moves the last item into the root's place, which again
keeps the shape, then sifts it down.

Here is a pop on the heap above. The root, 1, is the answer. The last item, 8,
moves into index 0:

```text
array [8, 3, 2, 7, 4, 5]

              8
           /     \
          3       2
         / \     /
        7   4   5
```

8's children are 3 and 2. The smaller is 2, so 8 swaps with it. At index 2,
8's only child is 5 (index 5; index 6 is past the end), and 5 is smaller, so
they swap. Index 5 has no children, so the sift stops:

```text
array [2, 3, 5, 7, 4, 8]

              2
           /     \
          3       5
         / \     /
        7   4   8
```

The tree is a heap again, with the next smallest value, 2, at the root.

A complete tree with n nodes has height ⌊log₂ n⌋ (the number of edges from the
root down to the deepest leaf), because each level holds twice as many nodes
as the one above. A sift moves an item at most one level per swap, so a push or
a pop does at most ⌊log₂ n⌋ swaps: 19 for a million items.

**Heapify** builds a heap out of n items in any order. Pushing them one at a
time works, but there is a faster way: put them all in the array as they come,
then sift down every node that has children, starting from the last one and
working back to the root. Nodes `n // 2` onward are leaves, which are
one-node heaps already, so the loop starts at `n // 2 − 1`. Sifting a node down
when both of its subtrees are already heaps makes its whole subtree a heap,
and going backward guarantees the subtrees are done first. For
`[5, 4, 3, 2, 1]`, the loop starts at index 1: its children, 2 and 1, are at
indexes 3 and 4, so 4 swaps with 1, giving `[5, 1, 3, 2, 4]`. At index 0, 5
swaps with its smaller child 1, giving `[1, 5, 3, 2, 4]`, then with 2,
its smaller child at the new position, giving `[1, 2, 3, 5, 4]`.

## Operations and costs

The costs use big-O notation, with n the number of items: O(1) means the work
doesn't grow with n, O(log n) means it grows with the number of times n can be
halved, and O(n) means it grows in proportion to n. **Amortized** means
averaged over a long run of operations, where an occasional expensive one is
paid for by the many cheap ones around it.

| Operation                   | Average            | Worst case        |
| --------------------------- | ------------------ | ----------------- |
| `peek` (read the smallest)  | O(1)               | O(1)              |
| `push`                      | O(log n) amortized | O(n), on a resize |
| `pop` (remove the smallest) | O(log n) amortized | O(n), on a resize |
| Heapify n items             | O(n)               | O(n)              |
| Find or remove another item | O(n)               | O(n)              |
| Space                       | O(n)               | O(n)              |

Push and pop are one sift each, at most one swap per level of a tree whose
height is ⌊log₂ n⌋. The O(n) worst case is the array underneath growing or
shrinking, which is rare for the reasons in
[Array and Dynamic Array](/dsa/dynamic-array). Finding an item other than the
smallest means checking them all: the heap property doesn't say which branch
an item is in.

Heapify being O(n), not O(n log n), is the surprising row. Pushing n items one
at a time costs O(n log n) because most items live near the bottom and a new
bottom item may climb the whole height. Heapify turns that around: it sifts
down, so a node's cost is its **height**, the number of levels below it, and
most nodes have very little below them. About half the nodes are leaves and
cost nothing, a quarter sit one level up and can move at most one level, an
eighth can move at most two, and so on. The total is at most

n × (1/4 + 2/8 + 3/16 + 4/32 + …) = n × 1 = n swaps.

Counting swaps on reverse-sorted input, the worst order for a min-heap, bears
it out. For 15 items, heapify makes 11 swaps and pushing them one by one makes 34. For 100,000 items, heapify makes 99,990 and pushing makes 1,468,946.

## Implementation

Both versions store the items in a language list and use only "is `a` less
than `b`?" to compare them. The Python heap uses `<`, the only comparison
Python's own `heapq` module makes, so it works for numbers, strings, tuples,
or any class that defines `__lt__`. The TypeScript heap takes a `less`
function, since JavaScript's `<` only means something for numbers and strings;
passing `(a, b) => a > b` turns it into a max-heap.

```python
from collections.abc import Iterable
from itertools import count
from typing import Any, Generic, Protocol, TypeVar


class SupportsLessThan(Protocol):
    def __lt__(self, other: Any, /) -> bool: ...


T = TypeVar("T", bound=SupportsLessThan)
V = TypeVar("V")


def parent(i: int) -> int:
    return (i - 1) // 2


def left(i: int) -> int:
    return 2 * i + 1


def right(i: int) -> int:
    return 2 * i + 2
```

```typescript
export const parent = (i: number): number => (i - 1) >> 1;
export const left = (i: number): number => 2 * i + 1;
export const right = (i: number): number => 2 * i + 2;
```

The index formulas follow from numbering level by level. Level k starts at
index 2^k − 1 and holds 2^k nodes, so each node has exactly two slots reserved
for its children right where the next level reaches them. Starting the
numbering at 0 is what makes the children `2i + 1` and `2i + 2`; numbering from
1 would give `2i` and `2i + 1` and waste slot 0. `parent` only runs for i ≥ 1,
since the root has no parent. `SupportsLessThan` tells a type checker that the
heap needs `<` and nothing else.

```python
class MinHeap(Generic[T]):
    """A binary min-heap stored in a list: the smallest item is always at index 0."""

    def __init__(self, items: Iterable[T] = ()) -> None:
        self._items: list[T] = list(items)
        for i in reversed(range(len(self._items) // 2)):
            self._sift_down(i)

    def __len__(self) -> int:
        return len(self._items)

    def peek(self) -> T:
        if not self._items:
            raise IndexError("peek at an empty heap")
        return self._items[0]
```

```typescript
/** A binary min-heap stored in an array: the smallest item is always at index 0. */
export class MinHeap<T> {
  private items: T[];

  /** `less(a, b)` is true when `a` should come out before `b`. */
  constructor(
    private readonly less: (a: T, b: T) => boolean,
    items: Iterable<T> = [],
  ) {
    this.items = [...items];
    for (let i = (this.items.length >> 1) - 1; i >= 0; i--) this.siftDown(i);
  }

  get size(): number {
    return this.items.length;
  }

  peek(): T {
    if (this.items.length === 0) throw new RangeError('peek at an empty heap');
    return this.items[0];
  }
```

The constructor is heapify. It copies the input first (`list(items)`,
`[...items]`), so the caller's list isn't rearranged behind its back, then
sifts down from index `n // 2 − 1` back to 0, as in the example above. `peek`
is one array read, because the smallest item is always at index 0. On an
empty heap it raises, as `heapq`'s `heappop` does, rather than returning
`None` or `undefined`, which a caller could have pushed as a real item.

```python
    def push(self, item: T) -> None:
        self._items.append(item)
        self._sift_up(len(self._items) - 1)

    def pop(self) -> T:
        if not self._items:
            raise IndexError("pop from an empty heap")
        last = self._items.pop()
        if not self._items:
            return last
        top = self._items[0]
        self._items[0] = last
        self._sift_down(0)
        return top
```

```typescript
  push(item: T): void {
    this.items.push(item);
    this.siftUp(this.items.length - 1);
  }

  pop(): T {
    if (this.items.length === 0) throw new RangeError('pop from an empty heap');
    const last = this.items.pop() as T;
    if (this.items.length === 0) return last;
    const top = this.items[0];
    this.items[0] = last;
    this.siftDown(0);
    return top;
  }
```

Both methods change the array only at its end, where a dynamic array is cheap,
and leave the rest to a sift. `pop` can't just remove index 0, since that
would shift every item left one slot, an O(n) move that also scrambles every
parent-child pair. Moving the last item into the hole instead keeps the tree
complete and leaves exactly one item, the one now at the root, possibly out of
place.

```python
    def _sift_up(self, i: int) -> None:
        items = self._items
        while i > 0 and items[i] < items[parent(i)]:
            items[i], items[parent(i)] = items[parent(i)], items[i]
            i = parent(i)
```

```typescript
  private siftUp(i: number): void {
    const items = this.items;
    while (i > 0 && this.less(items[i], items[parent(i)])) {
      [items[i], items[parent(i)]] = [items[parent(i)], items[i]];
      i = parent(i);
    }
  }
```

Sift up stops at the root (`i > 0`) or as soon as the item is no smaller than
its parent. Stopping there is safe: everything above the parent was already in
heap order, and the parent is no larger than the item, so nothing further up
can be out of place. Using a strict `<` also means an item equal to its parent
stays put, saving a swap that would change nothing.

```python
    def _sift_down(self, i: int) -> None:
        items = self._items
        n = len(items)
        while True:
            smallest = i
            if left(i) < n and items[left(i)] < items[smallest]:
                smallest = left(i)
            if right(i) < n and items[right(i)] < items[smallest]:
                smallest = right(i)
            if smallest == i:
                return
            items[i], items[smallest] = items[smallest], items[i]
            i = smallest
```

```typescript
  private siftDown(i: number): void {
    const items = this.items;
    const n = items.length;
    for (;;) {
      const l = left(i);
      const r = right(i);
      let smallest = i;
      if (l < n && this.less(items[l], items[smallest])) smallest = l;
      if (r < n && this.less(items[r], items[smallest])) smallest = r;
      if (smallest === i) return;
      [items[i], items[smallest]] = [items[smallest], items[i]];
      i = smallest;
    }
  }
}
```

Sift down finds the smallest of three: the item and its up to two children.
Each child is checked against `n` first, since a node near the bottom may have
one child or none. If the item itself is smallest, it's in place; otherwise it
swaps with the smaller child and continues from there. Swapping with the
smaller child, not just any child that beats the item, is what keeps the heap
property between the two children: the one that moves up becomes the parent
of the other.

```python
class PriorityQueue(Generic[V]):
    """Items come out lowest priority first; equal priorities in insertion order."""

    def __init__(self) -> None:
        self._heap: MinHeap[tuple[float, int, V]] = MinHeap()
        self._order = count()

    def __len__(self) -> int:
        return len(self._heap)

    def push(self, item: V, priority: float) -> None:
        self._heap.push((priority, next(self._order), item))

    def peek(self) -> V:
        return self._heap.peek()[2]

    def pop(self) -> V:
        return self._heap.pop()[2]
```

```typescript
interface Entry<V> {
  priority: number;
  order: number;
  item: V;
}

/** Items come out lowest priority first; equal priorities in insertion order. */
export class PriorityQueue<V> {
  private readonly heap = new MinHeap<Entry<V>>(
    (a, b) => a.priority < b.priority || (a.priority === b.priority && a.order < b.order),
  );
  private nextOrder = 0;

  get size(): number {
    return this.heap.size;
  }

  push(item: V, priority: number): void {
    this.heap.push({ priority, order: this.nextOrder++, item });
  }

  peek(): V {
    return this.heap.peek().item;
  }

  pop(): V {
    return this.heap.pop().item;
  }
}
```

The priority queue is a heap of entries, each a priority, a running counter
and the item. A heap on its own isn't **stable**: items that compare equal
don't come out in the order they went in. Push `a`, `b` and `c` with the same
priority and a heap that compares priorities alone pops `a`, `c`, `b`, because
the pop moves the last item, `c`, into the root and nothing makes it give way
to `b`. The counter is a second key that only matters when priorities tie, and
since it never repeats, two entries never compare equal. Python compares the
tuples item by item, so it reaches `next(self._order)` only on a tie and never
reaches the item itself. Pushing `email` at priority 2, `deploy` at 1, `backup`
at 2 and `page` at 1 pops `deploy`, `page`, `email`, `backup`.

## Invariants

These hold after every call returns, and each method relies on them:

- **The heap property:** for every index i ≥ 1, `items[i]` is not less than
  `items[parent(i)]`. This is why `peek` can read index 0 and stop.
- **The shape:** the n items fill indexes 0 to n − 1 with no gaps, which is a
  complete tree. The index formulas depend on it, and push and pop keep it by
  touching only the end of the array.
- **Only one item is out of place, and only during a sift.** Push breaks the
  heap property at the new item only, pop at the new root only, and each sift
  moves that one item until the property holds again.
- **No two priority-queue entries compare equal**, because each has a
  different counter value. That makes the pop order fully determined:
  priority, then insertion order.

## Tricky lines

- `reversed(range(len(self._items) // 2))` in the constructor, and the
  TypeScript loop counting down from `(length >> 1) - 1`. Going forward from
  the root instead sifts nodes whose subtrees aren't heaps yet. On
  `[5, 4, 3, 2, 1]`, index 0 swaps 5 with 3, then index 1 swaps 4 with 1,
  leaving `[3, 1, 5, 2, 4]`: the root, 3, is larger than its child 1, and
  `peek` returns 3 when the smallest is 1.
- Picking the smaller of the two children in `_sift_down`. Swapping with the
  first child that beats the item, the left one, goes wrong in the pop example
  above: 8 at the root swaps with 3, giving `[3, 8, 2, 7, 4, 5]`, and the new
  root, 3, sits above its child 2.
- `last = self._items.pop()` followed by `if not self._items: return last` in
  `pop`. The one-line version, `top = items[0]; items[0] = items.pop()`, fails
  on a heap of one item. In Python the `pop()` empties the list before the
  assignment runs, and `items[0] = ...` raises `IndexError: list assignment
index out of range`. In TypeScript, assigning to index 0 of an empty array
  quietly creates it again, so `[7]` stays `[7]`: `pop` returns 7 and the heap
  still has size 1, forever.
- `(i - 1) >> 1` in the TypeScript `parent`, not `(i - 1) / 2`. JavaScript's
  `/` doesn't round, so the parent of index 4 would be 1.5, and `items[1.5]`
  is `undefined`. `0 < undefined` is `false`, so the sift stops without an
  error: pushing 0 onto `[1, 3, 2, 7]` leaves `[1, 3, 2, 7, 0]`, and `peek`
  returns 1. `>> 1` shifts the bits right by one, which halves and rounds down
  for any non-negative index below 2³¹. Python's `/` would produce `1.5` too,
  but there a float index raises a `TypeError`, so `//` is the fix and the bug
  can't stay hidden.
- `next(self._order)` in the priority-queue entry, and `order` in TypeScript.
  Besides making ties come out in insertion order, it keeps Python from ever
  comparing two items. With `(priority, item)` tuples, two entries with the
  same priority compare their items, and items that don't define `<` (a plain
  `Task` object, say) raise `TypeError: '<' not supported between instances of
'Task' and 'Task'` in the middle of a push.

## When to use it

Use a heap when you repeatedly need the smallest (or largest) item of a set
that keeps changing: merging many sorted lists by always taking the smallest
head, keeping the k largest values seen so far in a heap of size k, scheduling
timers by their deadline, or the shortest-path search that always expands the
closest node next. If you need the smallest only once, a single O(n) scan is
simpler. If you need everything in order, sort. If you need to find or delete
arbitrary items, or walk them in order, a balanced
[binary search tree](/dsa/binary-search-tree) keeps them fully sorted at the
same O(log n) per change.

In Python, use the `heapq` module rather than a class like this one. It works
on a plain list: `heapify(xs)` (in place, in linear time), `heappush`,
`heappop`, `heappushpop` and `heapreplace` for a push and a pop combined, plus
`nsmallest`, `nlargest` and `merge`. It is a min-heap; since Python 3.14 it
also has max-heap versions (`heappush_max`, `heappop_max` and the rest), and
on older versions the usual trick is to push negated numbers. For priority
queues, store `(priority, counter, item)` tuples, as above. The thread-safe
`queue.PriorityQueue` is a lock around `heappush` and `heappop`.

JavaScript's standard library has no heap or priority queue at all, so a class
like the TypeScript one above, or a package, is what you use there.
