---
title: Heap and Priority Queue
summary: Keeps the smallest item at the front and removes it in logarithmic time, by storing a tree in an array where every parent is no larger than its children.
date: 2026-10-05
kind: data-structure
template: 2
---

A priority queue hands items back by importance rather than arrival, like a scheduler that runs urgent jobs first. Nearly every one is built on a binary heap. You'll build a min-heap from `[7, 6, 5, 4, 3, 2, 1]`, remove its smallest, and add one back.

## Prerequisites

- [Arrays and strings](/dsa/arrays-and-strings): the heap lives in an array, grows by appending and shrinks by removing from the end, and the costs below lean on both.
- [Binary tree](/dsa/binary-tree): the heap is a complete binary tree, and the entry uses its words (root, parent, child, leaf).

## What it is

A **min-heap** is a binary tree with two rules. The **heap property**: every node is no larger than its children, so the smallest value sits at the root. The **shape rule**: the tree is **complete**, meaning every level is full except possibly the last, which fills left to right with no gaps. A max-heap swaps "larger" for "smaller". Nothing orders left against right, so a heap is far looser than a sorted list, and that looseness is what makes it cheap to maintain.

The shape rule lets the tree live in an array with no pointers. Number the nodes level by level from 0 at the root. Node `i` is stored at index `i`, its children are at `2i + 1` and `2i + 2`, and its parent is at `(i - 1) // 2`. Our example, heapified (below), is `[1, 3, 2, 4, 6, 7, 5]`:

```text
         1 (0)
      /         \
   3 (1)       2 (2)
   /    \      /    \
4 (3)  6 (4) 7 (5)  5 (6)
```

Two repair moves keep the rules true. **Sift up** moves an item toward the root: while it is smaller than its parent, swap them. **Sift down** moves an item toward the leaves: while it is larger than its smaller child, swap it with that child.

- **Push** appends at the end, the next free spot on the bottom level, which keeps the shape, then sifts up. Pushing `1` onto `[2, 3, 5, 4, 6, 7]` lands at index 6, under its parent 5, so they swap, then it swaps with 2: `[1, 3, 2, 4, 6, 7, 5]`.
- **Pop** takes the root as the answer, moves the last item into the root's place, which keeps the shape, and sifts it down. From `[1, 3, 2, 4, 6, 7, 5]`, the last item, 5, goes to the root. Its children are 3 and 2, so it swaps with 2. At index 2 its only child is 7 (index 6 is gone), which is larger, so it stops: `[2, 3, 5, 4, 6, 7]`.
- **Heapify** builds a heap from n items in any order. Sift down every node that has children, from the last one back to the root. On `[7, 6, 5, 4, 3, 2, 1]` that is index 2, then 1, then 0, and it takes 4 swaps. Pushing the same seven items one at a time takes 10.

A **priority queue** is a heap of `(priority, counter, item)` entries, the counter going up on each push. A bare heap isn't stable: equal priorities don't come out in insertion order. The counter breaks ties, and since no two entries compare equal, the comparison never reaches `item`, which may not define `<`.

## When to use it

- You repeatedly need the smallest or largest item of a collection that keeps changing: scheduling by deadline, "next closest node", merging sorted streams.
- The statement says "k largest" or "k smallest" over a stream. A heap of size k holds the answer without sorting everything.
- You need the extreme once: scan instead. You need the whole order: sort. You must find or delete arbitrary items: use a [binary search tree](/dsa/binary-search-tree).

## Operations and costs

n is the number of items.

| Operation                   | Average  | Worst case        |
| --------------------------- | -------- | ----------------- |
| `peek` (read the smallest)  | O(1)     | O(1)              |
| `push`                      | O(log n) | O(n), on a resize |
| `pop` (remove the smallest) | O(log n) | O(log n)          |
| Heapify n items             | O(n)     | O(n)              |
| Find or remove another item | O(n)     | O(n)              |
| Space                       | O(n)     | O(n)              |

A complete tree of n nodes has height ⌊log₂ n⌋, since each level holds twice the one above, and a sift moves one level per swap: at most 19 swaps for a million items. Push also appends to a dynamic array, which costs O(n) when it resizes. Pop removes from the array's end, O(1). Another item could be in any branch, so finding it means checking them all.

Heapify being O(n), not O(n log n), is the surprising row. A node sifting down falls only as far as the levels below it, and most nodes have almost none: half are leaves, a quarter can move one level, an eighth two. The total is at most n × (1/4 + 2/8 + 3/16 + …) = n swaps. On 100,000 items in reverse order, heapify makes 99,990 swaps and pushing one at a time makes 1,468,946.

## Implementation

The Python heap compares with `<` alone, as `heapq` does. JavaScript's `<` only means something for numbers and strings, so the TypeScript heap takes a `less` function.

```python
from collections.abc import Iterable
from typing import Any, Generic, Protocol, TypeVar


class SupportsLessThan(Protocol):
    def __lt__(self, other: Any, /) -> bool: ...


T = TypeVar("T", bound=SupportsLessThan)


class MinHeap(Generic[T]):
    """A binary min-heap in a list: the node at i has children 2i+1 and 2i+2."""

    def __init__(self, items: Iterable[T] = ()) -> None:
        # list() copies, so the caller's list isn't rearranged behind their back.
        self._items: list[T] = list(items)
        # Indexes n // 2 and up are leaves, already one-node heaps. Going backward
        # means both subtrees of a node are heaps by the time it sifts down.
        for i in reversed(range(len(self._items) // 2)):
            self._sift_down(i)

    def __len__(self) -> int:
        return len(self._items)

    def peek(self) -> T:
        # Raise rather than return None, which a caller may have pushed.
        if not self._items:
            raise IndexError("peek at an empty heap")
        return self._items[0]
```

```typescript
/** A binary min-heap in an array: the node at i has children 2i+1 and 2i+2. */
export class MinHeap<T> {
  private items: T[];

  /** `less(a, b)` is true when `a` should come out first; `>` makes a max-heap. */
  constructor(
    private readonly less: (a: T, b: T) => boolean,
    items: Iterable<T> = [],
  ) {
    // The spread copies, so the caller's array isn't rearranged behind their back.
    this.items = [...items];
    // Indexes n >> 1 and up are leaves, already one-node heaps. Going backward
    // means both subtrees of a node are heaps by the time it sifts down.
    for (let i = (this.items.length >> 1) - 1; i >= 0; i--) this.siftDown(i);
  }

  get size(): number {
    return this.items.length;
  }

  peek(): T {
    // Throw rather than return undefined, which a caller may have pushed.
    if (this.items.length === 0) throw new RangeError('peek at an empty heap');
    return this.items[0];
  }
```

The constructor is heapify, and `peek` is one array read. Push and pop touch only the end of the array and leave the rest to a sift.

```python
    def push(self, item: T) -> None:
        self._items.append(item)
        self._sift_up(len(self._items) - 1)

    def pop(self) -> T:
        if not self._items:
            raise IndexError("pop from an empty heap")
        # Take the last item, not index 0: deleting the front shifts every item.
        last = self._items.pop()
        # With one item, items[0] = items.pop() would fail: the list is empty.
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
    // Take the last item, not index 0: deleting the front shifts every item.
    const last = this.items.pop() as T;
    // With one item, items[0] = last would quietly refill the emptied array.
    if (this.items.length === 0) return last;
    const top = this.items[0];
    this.items[0] = last;
    this.siftDown(0);
    return top;
  }
```

Moving the last item to the root leaves one item out of place, the case sift down handles. Sift up handles the mirror case, a new item at the bottom.

```python
    def _sift_up(self, i: int) -> None:
        items = self._items
        while i > 0:
            parent = (i - 1) // 2  # // rounds down; / would give a float index
            # Strict <: an equal parent stays. Stopping is safe, since the
            # parent was already no larger than everything above it.
            if not items[i] < items[parent]:
                return
            items[i], items[parent] = items[parent], items[i]
            i = parent
```

```typescript
  private siftUp(i: number): void {
    const items = this.items;
    while (i > 0) {
      const parent = (i - 1) >> 1; // / doesn't round: items[1.5] is undefined
      // Strict: an equal parent stays. Stopping is safe, since the parent was
      // already no larger than everything above it.
      if (!this.less(items[i], items[parent])) return;
      [items[i], items[parent]] = [items[parent], items[i]];
      i = parent;
    }
  }
```

Sift up compares once per level, since an item has one parent. Going down is harder: a node has two children to choose between.

```python
    def _sift_down(self, i: int) -> None:
        items = self._items
        n = len(items)
        while (child := 2 * i + 1) < n:
            # The smaller child, not the first one that beats the item: it moves
            # up and becomes the other child's parent.
            if child + 1 < n and items[child + 1] < items[child]:
                child += 1
            if not items[child] < items[i]:
                return
            items[i], items[child] = items[child], items[i]
            i = child
```

```typescript
  private siftDown(i: number): void {
    const items = this.items;
    const n = items.length;
    for (let child = 2 * i + 1; child < n; child = 2 * i + 1) {
      // The smaller child, not the first one that beats the item: it moves
      // up and becomes the other child's parent.
      if (child + 1 < n && this.less(items[child + 1], items[child])) child++;
      if (!this.less(items[child], items[i])) return;
      [items[i], items[child]] = [items[child], items[i]];
      i = child;
    }
  }
}
```

In Python, use `heapq` rather than this class: it works on a plain list with `heapify`, `heappush`, `heappop` and `nsmallest`. It is a min-heap; Python 3.14 added max-heap versions, and older versions push negated numbers. JavaScript has no built-in heap, so you write one like this.

## Pitfalls

- **Sifting nodes in the wrong order.** The constructor's `reversed(range(...))` goes from the last parent to the root. Going forward on `[7, 6, 5, 4, 3, 2, 1]` sifts index 0 before its subtrees are heaps and ends as `[5, 3, 1, 4, 6, 2, 7]`: `peek` returns 5 when the smallest is 1.
- **Swapping with the first child that beats the item.** In `_sift_down`, taking the left child on a pop from `[1, 3, 2, 4, 6, 7, 5]` swaps 5 with 3, not 2, and ends as `[3, 4, 2, 5, 6, 7]`: the new root, 3, sits above its child 2.
- **Removing index 0 directly.** `pop` takes the last item instead. Deleting the front shifts every item left, an O(n) move that breaks every parent-child pair, and the one-line `items[0] = items.pop()` fails on a one-item heap: Python raises `IndexError`, and in TypeScript the heap never empties.
- **Halving with `/` in TypeScript.** `(i - 1) / 2` makes the parent of index 4 `1.5`, and `items[1.5]` is `undefined`. The comparison is `false`, so the sift stops without an error, and `peek` returns the wrong item. `>> 1` rounds down.
