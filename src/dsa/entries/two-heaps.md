---
title: Two Heaps
summary: Keeping the smaller half of a stream in a max-heap and the larger half in a min-heap, so the median is always at the top of one heap or the other and each new number costs O(log n).
date: 2026-10-01
kind: pattern
---

The **median** of a collection of numbers is its middle value once they are
sorted: for 3, 5, 9 it is 5. With an even count there is no single middle, so
the median is the mean of the two middle values: for 3, 5, 8, 9 it is
(5 + 8) / 2 = 6.5. Finding the median of a list you already have is easy: sort
it and read the middle. This entry is about the harder version, a **stream**,
where numbers keep arriving one at a time and after each arrival you must be
able to say the median of everything seen so far. The two-heaps pattern keeps
the numbers split into a smaller half and a larger half, each in a heap, so the
middle is always sitting at the top of one of them.

## Prerequisites

- [Heap and Priority Queue](/dsa/heap): the pattern is two heaps working
  together, so it relies on a heap's push, pop and peek costing O(log n), O(log
  n) and O(1), and on the sift moves that keep the smallest item at the root.
  That entry also explains the big-O notation (O(1), O(log n), O(n)) used here.

## The idea

Picture the numbers seen so far laid out in sorted order. Cut that row in the
middle. The median is made of the largest number in the left half and, when the
count is even, the smallest number in the right half. You never need the rest of
the order: you need only the biggest of the left half and the smallest of the
right half. A heap is exactly a structure that gives you its extreme item
cheaply, so use one for each half:

- `lower` holds the smaller half in a **max-heap**, a heap whose root is the
  largest item. Its root is the largest of the small numbers.
- `upper` holds the larger half in a **min-heap**, whose root is the smallest
  item. Its root is the smallest of the large numbers.

Two rules keep this meaningful after every add. The **order rule**: every number
in `lower` is at most every number in `upper`. The **size rule**: `lower` has
either the same number of items as `upper` or exactly one more. Given both, the
median is `lower`'s root when the count is odd (the extra item is the middle),
and the mean of the two roots when it is even.

The stream 5, 2, 8, 1, 9, 3, with each half written in sorted order for
reading (the heaps themselves are only partly ordered):

| Add | `lower` (max at right) | `upper` (min at left) | Median            |
| --- | ---------------------- | --------------------- | ----------------- |
| 5   | 5                      |                       | 5                 |
| 2   | 2                      | 5                     | (2 + 5) / 2 = 3.5 |
| 8   | 2, 5                   | 8                     | 5                 |
| 1   | 1, 2                   | 5, 8                  | (2 + 5) / 2 = 3.5 |
| 9   | 1, 2, 5                | 8, 9                  | 5                 |
| 3   | 1, 2, 3                | 5, 8, 9               | (3 + 5) / 2 = 4   |

Check the last row against the sorted stream 1, 2, 3, 5, 8, 9: the two middle
values are 3 and 5, and their mean is 4.

## When to use it

Use it when numbers arrive over time and you need the median, or the value at
some fixed fraction of the order, after each arrival: the running median of a
sensor feed, the median latency of the requests so far. It also appears when a
problem asks you to keep "the smallest half" and "the largest half" of a
changing collection apart, for example balancing two groups so that the
maximum of one never exceeds the minimum of the other.

It does not help if you need an arbitrary rank that changes (the 90th
percentile when you also ask for the 10th, or deleting arbitrary values), since
only the two middle values are cheap to reach. And if all the numbers are
already in hand and you want one median once, sorting (O(n log n)) is simpler.
For the k largest items of a stream rather than the middle, see
[Top-K](/dsa/top-k).

## Walkthrough

```python
import heapq
```

```typescript
/** A binary min-heap on an array: `less(a, b)` says a belongs nearer the root. */
export class MinHeap<T> {
  private readonly items: T[] = [];
  private readonly less: (a: T, b: T) => boolean;

  constructor(less: (a: T, b: T) => boolean) {
    this.less = less;
  }

  get size(): number {
    return this.items.length;
  }

  peek(): T | undefined {
    return this.items[0];
  }

  push(item: T): void {
    this.items.push(item);
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.less(this.items[i], this.items[parent])) break;
      [this.items[i], this.items[parent]] = [this.items[parent], this.items[i]];
      i = parent;
    }
  }

  /** Removes and returns the root. The heap must not be empty. */
  pop(): T {
    const items = this.items;
    const top = items[0];
    const last = items.pop()!;
    if (items.length > 0) {
      items[0] = last;
      let i = 0;
      for (;;) {
        let best = i;
        const left = 2 * i + 1;
        const right = left + 1;
        if (left < items.length && this.less(items[left], items[best])) best = left;
        if (right < items.length && this.less(items[right], items[best])) best = right;
        if (best === i) break;
        [items[i], items[best]] = [items[best], items[i]];
        i = best;
      }
    }
    return top;
  }
}
```

Python's standard library already has a heap, `heapq`, so that one import is
the whole setup. Before Python 3.14 it is a min-heap only (3.14 added max-heap
functions; this code also runs on 3.12), and TypeScript has no heap at all, so
the TypeScript side carries one, the same shape as the heap in the Top-K entry.
Its one design choice is that the ordering is a `less` function passed in. A
min-heap built with `(a, b) => a < b` keeps the smallest value at the root; the
same class built with `(a, b) => a > b` keeps the largest at the root, with no
second class and no negating. That is how it will serve as both halves. The
`pop` moves the last item to the root before sifting down; removing the root and
shifting everything left would cost O(n) and break the tree shape.

```python


class RunningMedian:
    """The median of the numbers added so far, in O(log n) per add and O(1) per read."""

    def __init__(self) -> None:
        self._lower: list[float] = []  # max-heap of the smaller half, values negated
        self._upper: list[float] = []  # min-heap of the larger half

    def __len__(self) -> int:
        return len(self._lower) + len(self._upper)
```

```typescript
/** The median of the numbers added so far: O(log n) per add, O(1) per read. */
export class RunningMedian {
  private readonly lower = new MinHeap<number>((a, b) => a > b); // max-heap
  private readonly upper = new MinHeap<number>((a, b) => a < b); // min-heap

  get size(): number {
    return this.lower.size + this.upper.size;
  }
```

To work on any Python 3, `lower` stores each value **negated**: a min-heap
of -5, -2 has -5 at its root, which is the original 5, the largest. Every read
from `lower` must flip the sign back and every write must flip it on the way in,
and forgetting either one is the usual bug with this trick (see Pitfalls). The
TypeScript version needs none of it, because `a > b` as the `less` function
makes the same class a max-heap. Neither side stores a count or the median:
both sizes come straight from the heaps, so they cannot drift out of step.

```python
    def add(self, value: float) -> None:
        heapq.heappush(self._lower, -value)
        heapq.heappush(self._upper, -heapq.heappop(self._lower))
        if len(self._upper) > len(self._lower):
            heapq.heappush(self._lower, -heapq.heappop(self._upper))
```

```typescript
  add(value: number): void {
    this.lower.push(value);
    this.upper.push(this.lower.pop());
    if (this.upper.size > this.lower.size) {
      this.lower.push(this.upper.pop());
    }
  }
```

This is the part worth stepping through, because it never compares the new
value with anything. The value goes into `lower` first, and then the largest
item of `lower` moves across to `upper`. That item might be the new value or an
old one; either way, the item that crosses is the largest of the small side, so
afterwards everything in `lower` is at most everything in `upper`, and the order
rule holds with no `if value < something` branch to get wrong. The move can
leave `upper` one item too big, so the last two lines move `upper`'s smallest
back when `upper` has more items than `lower`. The sizes stay equal or `lower`
one larger, which is the size rule. Take adding 8 to the table's second row,
`lower` = {2}, `upper` = {5}. The 8 goes into `lower` ({2, 8}), then 8 crosses
to `upper` ({5, 8}), `upper` is now larger, so 5, its smallest, moves back:
`lower` = {2, 5}, `upper` = {8}. A simpler rule, "push onto `lower` if the
value is small, `upper` otherwise, then rebalance", also works, but it has
cases to get right: the always-push-then-cross form has none.

```python
    def median(self) -> float:
        """The middle value, or the mean of the two middle values. Raises if empty."""
        if not self._lower:
            raise ValueError("median of an empty stream")
        if len(self._lower) > len(self._upper):
            return float(-self._lower[0])
        return (-self._lower[0] + self._upper[0]) / 2
```

```typescript
  /** The middle value, or the mean of the two middle values. Throws if empty. */
  median(): number {
    if (this.lower.size === 0) throw new Error('median of an empty stream');
    if (this.lower.size > this.upper.size) return this.lower.peek()!;
    return (this.lower.peek()! + this.upper.peek()!) / 2;
  }
}
```

The empty check tests `lower` alone because of the size rule: `upper` is never
larger, so if `lower` is empty both are, and there is no median to return. An
empty stream raises an error rather than returning 0, which would be a plausible
median and silently wrong. With an odd count `lower` holds the one extra item,
so its root is the middle. With an even count the two roots are the two middle
values, and the mean is taken with `/ 2`, which in Python is true division, so
the result is the float 3.5 and not the 3 that integer division would give. The
odd case also returns a float in Python so the return type is the same on both
branches. Reading the median only looks at the tops, so it takes O(1).

## Complexity

`add` does at most five heap operations (a push, a pop and a push, then
sometimes one more pop and push), each O(log n) for a heap of up to n items, so
an add is O(log n). `median` reads at most two roots: O(1). Feeding n numbers
costs O(n log n) in total, and the structure keeps all n of them, so the space
is O(n).

Compare the obvious alternatives. Sorting the numbers seen so far after every
arrival costs O(n log n) per number, so O(n² log n) for a stream of n. Keeping
one sorted list and inserting each new value at its place does better on
comparisons (finding the place by binary search is O(log n)), but putting the
value there shifts every later item over, which is O(n) per insert, O(n²) for
the stream. A single heap cannot answer at all: it exposes only its smallest
item (or only its largest), and the middle of the order is neither, so reaching
it means popping half the items. The two heaps are the same idea as the sorted
list with the unneeded order thrown away: the median needs only the boundary
between two halves, and a heap maintains an extreme cheaply where a sorted list
maintains the whole order expensively.

## Pitfalls

- **Forgetting a negation in Python.** `lower` holds negated values.
  Reading `self._lower[0]` without the minus sign gives the median's negative;
  pushing `value` rather than `-value` breaks the max-heap behaviour and the
  order rule with no error raised. Wrapping the two heaps in one class, so only
  its own methods touch the negation, keeps this to a few lines.
- **Breaking the size rule.** If `lower` can fall behind `upper`, or run two
  ahead, the roots are no longer the middle values. With a loop that moves one
  item at a time, as here, one rebalancing step is enough after each add, and
  that fact depends on the size rule holding before the add.
- **Choosing the side by comparing the new value.** The alternative to
  push-then-cross is to compare the value with `lower`'s root and push it onto
  the matching heap. It works, but it must handle an empty `lower` first, and
  comparing against the wrong root sends the value to the wrong half and breaks
  the order rule silently. The walkthrough's form has no comparison to get wrong.
- **Returning the wrong thing for an even count.** The median is the mean of the
  two roots, not `lower`'s root and not the smaller or larger root alone. In
  Python, `//` instead of `/` turns 3.5 into 3.
- **Asking for the median of nothing.** There is none. Decide whether to raise,
  as here, or return a sentinel, and say so in the interface.
- **Deleting values.** Heaps remove only their root cheaply. To support removing
  an arbitrary old value, as a sliding-window median needs, the pattern needs
  extra bookkeeping (usually marking values as removed and discarding them when
  they reach a root), and the plain two-heap code above does not handle it.
