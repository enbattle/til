---
title: Top K with a Heap
summary: Finding the k largest or most frequent values in one pass by keeping a small min-heap of the best k seen so far, for O(n log k) time instead of the O(n log n) of sorting everything.
date: 2026-10-01
kind: pattern
---

"Give me the 10 biggest orders", "the 5 most-searched words", "the 3 slowest
requests". Each asks for a handful of items out of a large collection, in
order, without caring how the rest rank. Sorting everything answers it but does
far more work than the question needs. The top-k pattern keeps only the best k
items seen so far, in a small **min-heap**, and lets every new item either
beat the weakest of them or be thrown away.

## Prerequisites

- [Heap and Priority Queue](/dsa/heap): the pattern is a heap of fixed size.
  You need what `push`, `peek` (read the smallest) and replacing the smallest
  cost, and that a min-heap always has its smallest item at the front.
- [Hash Map](/dsa/hash-map): the most-frequent variant first counts how often
  each value occurs, which is a hash map from value to count. That entry also
  explains the big-O notation (O(n), O(log n)) used here.

## The idea

**The k largest.** Walk through the values once and keep a min-heap that never
holds more than k of them. While it holds fewer than k, add the value. After
that, compare the value with the heap's smallest item, the root:

- If the value is larger, the root is no longer one of the k largest, because
  k values at least as big as it have now been seen. Remove the root and add
  the value.
- Otherwise the value can't be one of the k largest: the heap already holds k
  values at least as big. Skip it.

When the walk ends, the heap holds exactly the k largest values, in no
particular order, and one sort of those k items puts them in order.

**Why a min-heap for the largest.** The question asked at every step is "which
of my k keepers is the first to be dropped?", and the answer is the smallest of
them. A min-heap hands over its smallest item in O(1), and can swap it out in
O(log k). A max-heap has the largest item at the front, which is the one you
would never drop, and finding the smallest in it means scanning all k. The
same reasoning flips for the k smallest values: use a max-heap.

Here it is on `nums = [4, 1, 7, 3, 8, 5]` with k = 3:

| Step | Value | Action                 | Heap holds (sorted) | Root |
| ---- | ----- | ---------------------- | ------------------- | ---- |
| 1    | 4     | fewer than 3 kept: add | 4                   | 4    |
| 2    | 1     | fewer than 3 kept: add | 1, 4                | 1    |
| 3    | 7     | fewer than 3 kept: add | 1, 4, 7             | 1    |
| 4    | 3     | 3 > 1: remove 1, add 3 | 3, 4, 7             | 3    |
| 5    | 8     | 8 > 3: remove 3, add 8 | 4, 7, 8             | 4    |
| 6    | 5     | 5 > 4: remove 4, add 5 | 5, 7, 8             | 5    |

The result, sorted largest first, is `[8, 7, 5]`. The "sorted" column is only
for reading the table: inside a heap the items are in heap order, not sorted.

**The k most frequent.** First count how often each distinct value occurs,
with a hash map from value to count. Then run the same capped heap over the
distinct values, ranked by count instead of by the value itself.

Equal counts need a stated rule, or the answer depends on which value the heap
happened to see first. The rule here: **more occurrences ranks higher, and
among equal counts the smaller value ranks higher.** So the weakest keeper,
the one at the root, is the one with the fewest occurrences and, among those,
the largest value. On `nums = [1, 1, 1, 2, 2, 3, 3, 4]` the counts are 1 → 3,
2 → 2, 3 → 2, 4 → 1. With k = 2:

| Step | Value (count) | Action                              | Heap holds | Weakest |
| ---- | ------------- | ----------------------------------- | ---------- | ------- |
| 1    | 1 (3)         | fewer than 2 kept: add              | 1          | 1       |
| 2    | 2 (2)         | fewer than 2 kept: add              | 1, 2       | 2       |
| 3    | 3 (2)         | ties 2 on count, larger value: skip | 1, 2       | 2       |
| 4    | 4 (1)         | fewer occurrences than 2: skip      | 1, 2       | 2       |

The result is `[1, 2]`: value 1 first with 3 occurrences, then 2, which won the
tie with 3 by being smaller.

## When to use it

Use it when you need the best k of n, k is much smaller than n, and you don't
need the rest ordered: the top 10 of a million scores, the most frequent words
in a document, the 100 largest files in a directory tree. Because it looks at
each item once and remembers only k of them, it also works on a stream you
can't hold in memory, such as lines read from a very large file.

**Sorting is the simple alternative**, and it is often the right call: in
Python `sorted(nums, reverse=True)[:k]`, in TypeScript
`[...nums].sort((a, b) => b - a).slice(0, k)`. When n is small, when k is close
to n, when you'll want the whole order anyway, or when the code runs once, the
extra four or five lines of a heap aren't worth it. The heap pays off as n
grows while k stays small. Python's standard library also has the pattern
ready-made as `heapq.nlargest(k, nums)`; this entry writes it out so you can
see what it does. `Counter.most_common(k)` is the most-frequent version, but
it breaks ties by which value appeared first in the input, not by value, so it
gives a different answer than the rule here when counts tie.

When the answer is a single extreme (k = 1), skip the heap and track the
maximum in one variable. When you need the k-th largest value only, the same
heap works: after the walk, the root is the k-th largest.

## Walkthrough

```python
import heapq
from collections import Counter
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
    this.siftUp(this.items.length - 1);
  }

  /** Overwrites the root with `item` and sifts it down. The heap must not be empty. */
  replaceTop(item: T): void {
    this.items[0] = item;
    this.siftDown(0);
  }

  toArray(): T[] {
    return [...this.items];
  }

  private siftUp(start: number): void {
    let i = start;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.less(this.items[i], this.items[parent])) return;
      [this.items[i], this.items[parent]] = [this.items[parent], this.items[i]];
      i = parent;
    }
  }

  private siftDown(start: number): void {
    const items = this.items;
    let i = start;
    for (;;) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = left + 1;
      if (left < items.length && this.less(items[left], items[smallest])) {
        smallest = left;
      }
      if (right < items.length && this.less(items[right], items[smallest])) {
        smallest = right;
      }
      if (smallest === i) return;
      [items[i], items[smallest]] = [items[smallest], items[i]];
      i = smallest;
    }
  }
}
```

Python ships a min-heap in `heapq`: a set of functions that treat an ordinary
list as a heap, so there is nothing to write. JavaScript has no heap, so the
TypeScript file carries a small one, the same structure the
[Heap and Priority Queue](/dsa/heap) entry builds, including the `less`
function that lets one class rank plain numbers or `[value, count]` pairs. It
leaves out what this pattern never calls, `pop` and building from a starting
list, and adds `replaceTop`, which writes the new item over
the root and sifts it down once. Doing a pop and then a push would sift twice
and, between them, briefly hold k - 1 items. Python's `heapq.heapreplace`
does the same single sift, and also takes the smallest out first, which is why
the loop below can call it without a separate pop.

```python
def top_k_largest(nums: list[int], k: int) -> list[int]:
    """The k largest values of nums, largest first; all of nums if k >= len(nums)."""
    if k <= 0:
        return []
```

```typescript
/** The k largest values of `nums`, largest first; all of them if k >= nums.length. */
export function topKLargest(nums: number[], k: number): number[] {
  if (k <= 0) return [];
```

The guard answers k = 0 and negative k with an empty list. Without it, the
loop below would never add anything (`len(heap) < 0` is false), so the first
value would reach `heap[0]` on an empty list and raise an `IndexError` in
Python. The other end needs no guard: when k is as large as the list or larger,
the heap simply never fills, nothing is ever compared or removed, and every
value comes back.

```python
    heap: list[int] = []
    for value in nums:
        if len(heap) < k:
            heapq.heappush(heap, value)
        elif value > heap[0]:
            heapq.heapreplace(heap, value)
    return sorted(heap, reverse=True)
```

```typescript
  const heap = new MinHeap<number>((a, b) => a < b);
  for (const value of nums) {
    if (heap.size < k) {
      heap.push(value);
    } else if (value > heap.peek()!) {
      heap.replaceTop(value);
    }
  }
  return heap.toArray().sort((a, b) => b - a);
}
```

The `elif` is the whole pattern, and it compares with the root `heap[0]` (in
TypeScript, `heap.peek()`), because the root is the smallest keeper, the one
the newcomer has to beat. A value that only equals the root is skipped by the
strict `>`: for plain numbers an equal value is interchangeable with the one
already kept, so replacing it would be wasted work. Comparing with the largest
keeper instead, or using a max-heap, makes the check meaningless and keeps the
wrong items. The heap's contents are in heap order, not sorted, so the last
line sorts these k items, costing O(k log k), which is small next to the walk.
In TypeScript the `!` after `peek()` tells the compiler the heap isn't empty
here, which holds because `heap.size < k` was false and k is at least 1. The
comparator `(a, b) => b - a` in the final sort puts larger first: without a
comparator, JavaScript's `sort` compares numbers as text, and `[10, 9, 1]`
comes out as `[1, 10, 9]`.

```python
def top_k_frequent(nums: list[int], k: int) -> list[int]:
    """The k most frequent values, most frequent first; equal counts, smaller first."""
    if k <= 0:
        return []
    heap: list[tuple[int, int]] = []
    for value, count in Counter(nums).items():
        entry = (count, -value)
```

```typescript
type Entry = [value: number, count: number];

/** True if `a` ranks below `b`: fewer occurrences, or as many and a larger value. */
function ranksBelow(a: Entry, b: Entry): boolean {
  return a[1] < b[1] || (a[1] === b[1] && a[0] > b[0]);
}

/** The k most frequent values, most frequent first; equal counts, smaller first. */
export function topKFrequent(nums: number[], k: number): number[] {
  if (k <= 0) return [];
  const counts = new Map<number, number>();
  for (const value of nums) counts.set(value, (counts.get(value) ?? 0) + 1);
  const heap = new MinHeap<Entry>(ranksBelow);
  for (const entry of counts) {
```

Counting comes first: `Counter(nums)` in Python, a `Map` in TypeScript, both
one pass and one entry per distinct value, so the heap below sees each value
once, not once per occurrence. Then the tie-break has to be encoded in what the
heap compares. The heap must put the weakest keeper at the root, and by the
rule that is the fewest occurrences, and among those the largest value. Python
compares tuples element by element, so `(count, -value)` does exactly that:
the smaller count is smaller, and with equal counts the more negative `-value`,
meaning the larger value, is smaller. The negation turns "smaller value ranks
higher" into "smaller tuple ranks lower". It only works for numbers; for
strings, write a comparison like the TypeScript one. TypeScript doesn't need
the trick, because `ranksBelow` spells the rule out and the heap takes it as
its `less`. Dropping the value from the comparison leaves ties to whichever
entry the heap saw first, and the answer then depends on input order.

```python
        if len(heap) < k:
            heapq.heappush(heap, entry)
        elif entry > heap[0]:
            heapq.heapreplace(heap, entry)
    heap.sort(reverse=True)
    return [-negated for _, negated in heap]
```

```typescript
    if (heap.size < k) {
      heap.push(entry);
    } else if (ranksBelow(heap.peek()!, entry)) {
      heap.replaceTop(entry);
    }
  }
  return heap
    .toArray()
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .map(([value]) => value);
}
```

The loop is the one from `top_k_largest` with entries in place of plain
values: an entry replaces the root only if it ranks above it, and with the
tuple key "ranks above" is just `>`. In the example, `(2, -3)` for value 3
is not greater than the root `(2, -2)`, since -3 < -2, so value 3 is skipped
and value 2 stays, as the table shows. The final sort puts the highest-ranked
entry first, which is the reverse of heap order: Python sorts the tuples
descending (largest count first, and at equal counts the largest `-value`,
meaning the smallest value), and TypeScript's comparator says the same in two
steps, count descending, then value ascending. The last line drops the counts
and, in Python, undoes the negation, so the caller gets values back.

## Complexity

Let n be the number of values and k the number to keep (k at least 1).

`top_k_largest` runs in O(n log k) time. Each value costs one comparison with
the root, and a value that gets in costs one heap operation on a heap of at
most k items, which moves at most ⌊log₂ k⌋ levels. The worst case is an
input that keeps beating the root, such as values in ascending order, where
every value after the first k replaces the root. Sorting everything is
O(n log n). For n = 1,000,000 and k = 10, log₂ n is about 19.9 and
log₂ k is about 3.3, so the heap does a sixth of the per-item work in the worst
case, and on shuffled input most values are rejected after a single
comparison. When k is close to n the two are the same, and sorting's lower
constant factors win. The space is O(k) for the heap, against O(n) to sort a
copy. The final sort of the k survivors adds O(k log k), which never exceeds
the walk.

`top_k_frequent` first counts in O(n) time, then runs the heap over the m
distinct values, at most n of them, for O(m log k), then sorts k entries. The
total is O(n + m log k + k log k), which is O(n log k) in the worst case where
all values are distinct. The space is O(m) for the counts plus O(k) for the
heap. The count table, not the heap, is the part that grows with the input, so
here the memory advantage over sorting the counts is small.

## Pitfalls

- **Using a max-heap for the k largest.** Its root is the largest keeper, so
  the check compares a newcomer with the one value you would never drop. The
  result has the wrong values in it. The weakest keeper must sit at the root.
- **No guard for k <= 0.** In Python the loop then reads `heap[0]` on an empty
  heap and raises `IndexError`.
- **Leaving ties to chance in the frequent variant.** Without a rule, two
  values with equal counts rank by whichever the heap saw first, so the same
  input in a different order gives a different answer. State the rule and test
  it; here, smaller value first.
- **Expecting the heap to come out sorted.** A heap's list or array is in heap
  order. Sort the k survivors, as the code does, before returning them.
- **Sorting numbers without a comparator in TypeScript.** `[10, 9, 1].sort()`
  gives `[1, 10, 9]`, since it compares as text. Also, `sort` rearranges the
  array it is called on, so sort a copy (`[...nums]`) if the caller's array
  must stay as it was.
- **Reaching for a heap when k is large.** With k close to n the heap saves
  nothing and costs more per item than a sort. Sorting is fine there.
