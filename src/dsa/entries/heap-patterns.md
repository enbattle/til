---
title: Heap Patterns
summary: Three jobs a heap does better than sorting, keeping the best k of a stream, merging sorted lists and tracking a running median, each by holding only the items that can still change the answer.
date: 2026-10-05
kind: pattern
template: 2
---

"The 10 biggest orders", "merge these sorted logs", "the median so far". Each asks for one extreme or middle item, again and again, as data arrives, and sorting everything each time does far more work than the question needs. You'll run one stream, `4, 1, 7, 3, 8, 5`, through three heap shapes: the top 3, a merge of its sorted pieces, and its median after every value.

## Prerequisites

- [Heap and priority queue](/dsa/heap): every shape here is `push`, `pop` and reading the smallest item (`peek`) on a min-heap, at O(log n) a push or pop and O(1) a peek.

## The idea

All three shapes keep a heap small, so its smallest item is always the one you need to decide about next.

**Top k.** To keep the 3 largest of `4, 1, 7, 3, 8, 5`, hold a min-heap of at most 3 items. Once it's full, compare each new value with the root, the smallest keeper. If the value is larger, the root can no longer be among the 3 largest, since 3 other values at least as large have been seen, so replace it; otherwise throw the value away. The stream goes `[4]`, `[1, 4]`, `[1, 4, 7]`, then 3 beats 1 and gives `[3, 4, 7]`, 8 beats 3 and gives `[4, 7, 8]`, 5 beats 4 and gives `[5, 7, 8]`: the top 3 are 8, 7 and 5. Why a min-heap for the largest? The one you need to see is the first to be evicted, which is the smallest keeper. The rule: to keep the k best, hold them in a heap ordered the opposite way, so the one that gets evicted is at the front. For the most frequent values, count them first with a [hash map](/dsa/hash-map) and push `(count, value)` pairs.

**K-way merge.** Split the same numbers into sorted lists: `[1, 4, 7]`, `[3, 8]`, `[5]`. The smallest unmerged value is always at the front of some list, so keep a min-heap of one entry per list, the front value plus where it came from. Pop the smallest, add it to the output, and push the next value from the same list. Heads `1, 3, 5` give 1, then heads `4, 3, 5` give 3, then 4, 5, 7, 8: `[1, 3, 4, 5, 7, 8]`. The heap never holds more than 3 entries, one per list. Why not concatenate and sort? That costs O(N log N) for N items and ignores the order each list already has; the heap pays O(log k) per item.

**Running median.** To get the median after every value, you need the middle of everything so far. Sorting each prefix is too slow, and one heap only exposes an end. Split the values at the middle instead: a max-heap `low` holds the smaller half, a min-heap `high` holds the larger half, and `low` keeps the extra item when the count is odd. Then the median is the root of `low`, or the mean of the two roots. After `4, 1, 7, 3, 8, 5` they hold `{1, 3, 4}` and `{5, 7, 8}`, and the median after each value is `4, 2.5, 4, 3.5, 4, 4.5`. The rule: when you need the middle of a changing set, keep the two halves in two heaps whose roots face each other.

## When to use it

- The statement says "k largest", "k smallest", "k most frequent" or "k closest", especially over a stream or a collection too big to sort.
- You merge k sorted lists, files or streams, or find the k-th smallest across them.
- You need the median of a set that only grows, after every insertion. A sliding window also deletes old values, which two heaps can't do directly: you mark the value dead and discard it when it reaches a root.
- You need one extreme once: scan for it. You need the full order: sort. You need one rank of a fixed array: [quickselect](/dsa/sorting) is O(n) on average.
- In Python's library, `heapq.nlargest(k, items)` and `Counter.most_common(k)` do top k, and `heapq.merge(*lists)` merges lazily and takes a `key`. Write the heap yourself when asked how it works.

## Walkthrough

Python's `heapq` works on a plain list with `heappush`, `heappop` and `heapreplace` (a pop and push in one sift), all min-heap.

```python
import heapq
from collections.abc import Iterable
```

```typescript
/** heap.ts's MinHeap without heapify or empty checks: callers test `size` first. */
export class MinHeap<T> {
  private readonly items: T[] = [];

  constructor(private readonly less: (a: T, b: T) => boolean) {}

  get size(): number {
    return this.items.length;
  }

  peek(): T {
    return this.items[0];
  }

  push(item: T): void {
    const a = this.items;
    a.push(item);
    for (let i = a.length - 1; i > 0;) {
      const parent = (i - 1) >> 1;
      if (!this.less(a[i], a[parent])) return;
      [a[i], a[parent]] = [a[parent], a[i]];
      i = parent;
    }
  }

  pop(): T {
    const a = this.items;
    const top = a[0];
    const last = a.pop() as T;
    if (a.length === 0) return top; // a[0] = last would refill the emptied array
    a[0] = last;
    for (let i = 0, c = 1; c < a.length; c = 2 * i + 1) {
      if (c + 1 < a.length && this.less(a[c + 1], a[c])) c++; // the smaller child
      if (!this.less(a[c], a[i])) break;
      [a[i], a[c]] = [a[c], a[i]];
      i = c;
    }
    return top;
  }
}
```

JavaScript has no built-in heap, so this is the [heap](/dsa/heap) entry's class, trimmed: no heapify, and no empty checks, since every caller tests `size` first.

```python
def top_k_largest(items: Iterable[int], k: int) -> list[int]:
    """The k largest items, largest first; all of them if there are fewer."""
    if k <= 0:  # heap[0] below would raise on an empty heap
        return []
    heap: list[int] = []
    for x in items:
        if len(heap) < k:
            heapq.heappush(heap, x)
        # Strict: an equal item can't improve the k, and a swap costs a sift.
        elif heap[0] < x:
            heapq.heapreplace(heap, x)
    return sorted(heap, reverse=True)  # a heap is only partly ordered
```

```typescript
type Less<T> = (a: T, b: T) => boolean;

/** The k largest items, largest first; all of them if there are fewer. */
export function topKLargest<T>(items: T[], k: number, less: Less<T>): T[] {
  if (k <= 0) return []; // peek() below would read an empty heap
  const heap = new MinHeap(less);
  for (const x of items) {
    if (heap.size < k) heap.push(x);
    // Strict: an equal item can't improve the k, and a swap costs a sift.
    else if (less(heap.peek(), x)) {
      heap.pop();
      heap.push(x);
    }
  }
  const out: T[] = [];
  while (heap.size > 0) out.push(heap.pop());
  return out.reverse(); // a heap pops smallest first
}
```

The heap holds at most k items, and a rejected value costs one comparison with the root. The merge needs the same heap with richer entries.

```python
def merge_sorted(lists: list[list[int]]) -> list[int]:
    """One sorted list holding every item of the sorted input lists."""
    # The list index breaks ties on value, so equal values come out in list
    # order (a stable merge) and a tuple never has to compare past it.
    heap = [(lst[0], i, 0) for i, lst in enumerate(lists) if lst]
    heapq.heapify(heap)
    merged: list[int] = []
    while heap:
        value, i, pos = heap[0]
        merged.append(value)
        if pos + 1 < len(lists[i]):
            heapq.heapreplace(heap, (lists[i][pos + 1], i, pos + 1))
        else:
            heapq.heappop(heap)  # a drained list must leave, or its head repeats
    return merged
```

```typescript
/** One sorted list holding every item of the sorted input lists. */
export function mergeSorted<T>(lists: T[][], less: Less<T>): T[] {
  // [value, list, position]. The list index breaks ties on value, so equal
  // values come out in list order (a stable merge).
  const heap = new MinHeap<[T, number, number]>(
    (a, b) => less(a[0], b[0]) || (!less(b[0], a[0]) && a[1] < b[1]),
  );
  lists.forEach((lst, i) => lst.length > 0 && heap.push([lst[0], i, 0]));
  const merged: T[] = [];
  while (heap.size > 0) {
    const [value, i, pos] = heap.pop(); // a drained list just isn't pushed back
    merged.push(value);
    if (pos + 1 < lists[i].length) heap.push([lists[i][pos + 1], i, pos + 1]);
  }
  return merged;
}
```

On `[[1, 4, 7], [3, 8], [5]]` the heap starts as `(1, 0, 0)`, `(3, 1, 0)`, `(5, 2, 0)`. Popping 1 replaces it with `(4, 0, 1)`; when 5 is popped, list 2 is empty and the heap shrinks to two entries. The median needs two heaps instead of one.

```python
def running_medians(stream: Iterable[float]) -> list[float]:
    """The median after each value: the mean of the middle two when even."""
    low: list[float] = []  # max-heap of the smaller half, stored negated
    high: list[float] = []  # min-heap of the larger half
    medians: list[float] = []
    for x in stream:
        # Through low, then its largest moves to high: wherever x belongs, every
        # item in low stays <= every item in high.
        heapq.heappush(low, -x)
        heapq.heappush(high, -heapq.heappop(low))
        # Low keeps the extra item, so its root is the median of an odd count.
        if len(high) > len(low):
            heapq.heappush(low, -heapq.heappop(high))
        if len(low) > len(high):
            medians.append(float(-low[0]))
        else:
            medians.append((-low[0] + high[0]) / 2)
    return medians
```

```typescript
/** The median after each value: the mean of the middle two when even. */
export function runningMedians(stream: number[]): number[] {
  const low = new MinHeap<number>((a, b) => a > b); // max-heap of the smaller half
  const high = new MinHeap<number>((a, b) => a < b); // min-heap of the larger half
  return stream.map((x) => {
    // Through low, then its largest moves to high: wherever x belongs, every
    // item in low stays <= every item in high.
    low.push(x);
    high.push(low.pop());
    // Low keeps the extra item, so its root is the median of an odd count.
    if (high.size > low.size) low.push(high.pop());
    return low.size > high.size ? low.peek() : (low.peek() + high.peek()) / 2;
  });
}
```

Python's `heapq` is min-heap only, so `low` stores negatives. (Python 3.14 adds public max-heap functions; negation works on any version.) TypeScript flips the comparison instead. On the example, the third value, 7, goes into `low`, comes out as its largest and lands in `high`, which now outnumbers `low` 2 to 1, so 4 moves back: `low` is `{1, 4}`, `high` is `{7}`, and the median is 4.

## Complexity

With n items and a heap of k: top k is O(n log k) time and O(k) space, against O(n log n) for sorting. Merging N items from k lists is O(N log k) time and O(k) space beyond the output. The running median costs O(log n) per value, three or five heap operations on heaps of at most n / 2 + 1 items, and O(n) space. Reading the median is O(1).

## Pitfalls

- **A max-heap for the k largest.** In `top_k_largest`, the heap must be a min-heap, so `heap[0]` is the keeper to beat. With the best item at the root, you can't tell which keeper to evict without scanning all k.
- **Leaving a drained list in the heap.** In `merge_sorted`, `heappop` removes an entry whose list is exhausted. Skipping it leaves the same head at the root, so the loop adds it forever. Reading `lists[i][pos + 1]` without the length check fails too: Python raises `IndexError`, while JavaScript reads `undefined` and pushes it into the heap.
- **Routing a value to a half by guessing.** Pushing each value straight into whichever heap is smaller (`low` on a tie) breaks the rule that nothing in `low` exceeds anything in `high`. On `4, 1, 7` it puts 7 into `low` next to 4, and reads the median as 7, not 4. Pushing through `low` first makes the two halves ordered, wherever the value belongs.
- **Forgetting a sign.** In `running_medians`, `low[0]` is the negative of the largest small value. Returning it without `-` gives -4 for the first median of the running example, where 4 is right.
