---
title: Heap and Priority Queue
summary: Keeps the smallest item at the front and removes it in logarithmic time, by storing a tree in an array where every parent is no larger than its children.
date: 2026-10-05
kind: data-structure
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
- The statement says "k largest" or "k smallest" over a stream. A heap of size k holds the answer without sorting everything ([heap patterns](/dsa/heap-patterns)).
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

A complete tree of n nodes has height ⌊log₂ n⌋, since each level holds twice the one above, and a sift moves one level per swap: at most 19 swaps for a million items. Push also appends to a dynamic array, which costs O(n) when it resizes. Pop removes from the array's end, O(1). Another item could be in any branch, so finding it means checking them all. A sorted array loses because each push shifts items to make room, O(n); the heap's looser order is what keeps both push and pop at O(log n).

Heapify being O(n), not O(n log n), is the surprising row. A node sifting down falls only as far as the levels below it, and most nodes have almost none: half are leaves, a quarter can move one level, an eighth two. The total is at most n × (1/4 + 2/8 + 3/16 + …) = n swaps. On 100,000 items in reverse order, heapify makes 99,990 swaps and pushing one at a time makes 1,468,946.

## Implementation

Python's `<` works on numbers and on tuples. TypeScript has no tuples, so its heap stores arrays of numbers and `lessThan` compares them the same way; a plain number is `[5]`. The same class orders `[priority, item]` pairs, as later entries do.

```python region=less-than

```

```typescript region=less-than

```

The constructor is heapify.

```python region=min-heap

```

```typescript region=min-heap

```

Push and pop touch only the array's end; a sift does the rest.

```python region=push-and-pop

```

```typescript region=push-and-pop

```

Moving the last item to the root leaves one item out of place, the case sift down handles. Sift up handles the mirror case, a new item at the bottom.

```python region=sift-up

```

```typescript region=sift-up

```

Sift up compares once per level, since an item has one parent. Going down must choose between two children.

```python region=sift-down

```

```typescript region=sift-down

```

In Python, use `heapq` rather than this class: it works on a plain list with `heapify`, `heappush`, `heappop` and `nsmallest`. It is a min-heap; Python 3.14 added max-heap versions. JavaScript has no built-in heap, so you write one like this.

## Pitfalls

- **Sifting nodes in the wrong order.** The constructor's loop goes from the last parent back to the root. Going forward on `[7, 6, 5, 4, 3, 2, 1]` sifts index 0 before its subtrees are heaps and ends as `[5, 3, 1, 4, 6, 2, 7]`: `peek` returns 5 when the smallest is 1.
- **Swapping with the first child that beats the item.** In the sift-down loop, taking the left child on a pop from `[1, 3, 2, 4, 6, 7, 5]` swaps 5 with 3, not 2, and ends as `[3, 4, 2, 5, 6, 7]`: the new root, 3, sits above its child 2.
- **Removing index 0 directly.** `pop` takes the last item instead. Deleting the front shifts every item left, an O(n) move that breaks every parent-child pair, and the one-line `items[0] = items.pop()` fails on a one-item heap: Python raises `IndexError`, and in TypeScript the heap never empties.
- **Halving with `/` in TypeScript.** `(i - 1) / 2` makes the parent of index 4 `1.5`, and `items[1.5]` is `undefined`, and comparing against it throws a `TypeError`. `Math.floor` rounds down, as Python's `//` does.
