---
title: Heap Patterns
summary: Three jobs a heap does better than sorting, keeping the best k of a stream, merging sorted lists and tracking a running median, each by holding only the items that can still change the answer.
date: 2026-10-05
kind: pattern
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
- You need the median of a set that only grows, after every insertion. A sliding window also deletes old values, which two heaps can't do directly.
- You need one extreme once: scan for it. You need the full order: sort. You need one rank of a fixed array: [quickselect](/dsa/sorting) is O(n) on average.
- In Python's library, `heapq.nlargest(k, items)` and `Counter.most_common(k)` do top k, and `heapq.merge(*lists)` merges lazily and takes a `key`. Write the heap yourself when asked how it works.

## Walkthrough

Python's `heapq` works on a plain list with `heappush`, `heappop` and `heapreplace` (a pop and push in one sift), all min-heap.

```python region=part-1

```

```typescript region=min-heap

```

JavaScript has no built-in heap, so this is the [heap](/dsa/heap) entry's class, trimmed: no heapify, and no empty checks, since every caller tests `size` first.

```python region=top-k-largest

```

```typescript region=part-2

```

The heap holds at most k items, and a rejected value costs one comparison with the root. The merge reuses the same heap with richer entries.

```python region=merge-sorted

```

```typescript region=merge-sorted

```

On `[[1, 4, 7], [3, 8], [5]]` the heap starts as `(1, 0, 0)`, `(3, 1, 0)`, `(5, 2, 0)`. Popping 1 replaces it with `(4, 0, 1)`; when 5 is popped, list 2 is empty and the heap shrinks to two entries. The median needs two heaps instead of one.

```python region=running-medians

```

```typescript region=running-medians

```

Python's `heapq` is min-heap only, so `low` stores negatives. (Python 3.14 adds public max-heap functions; negation works on any version.) TypeScript flips the comparison instead. On the example, the third value, 7, goes into `low`, comes out as its largest and lands in `high`, which now outnumbers `low` 2 to 1, so 4 moves back: `low` is `{1, 4}`, `high` is `{7}`, and the median is 4.

## Complexity

With n items and a heap of k: top k is O(n log k) time and O(k) space, against O(n log n) for sorting. Merging N items from k lists is O(N log k) time and O(k) space beyond the output. The running median costs O(log n) per value, three or five heap operations on heaps of at most n / 2 + 1 items, and O(n) space. Reading the median is O(1).

## Pitfalls

- **A max-heap for the k largest.** In `top_k_largest`, the heap must be a min-heap, so `heap[0]` is the keeper to beat. With the best item at the root, you can't tell which keeper to evict without scanning all k.
- **Leaving a drained list in the heap.** In `merge_sorted`, `heappop` removes an entry whose list is exhausted. Skipping it leaves the same head at the root, so the loop adds it forever. Reading `lists[i][pos + 1]` without the length check fails too: Python raises `IndexError`, while JavaScript reads `undefined` and pushes it into the heap.
- **Routing a value to a half by guessing.** Pushing each value straight into whichever heap is smaller (`low` on a tie) breaks the rule that nothing in `low` exceeds anything in `high`. On `4, 1, 7` it puts 7 into `low` next to 4, and reads the median as 7, not 4. Pushing through `low` first makes the two halves ordered, wherever the value belongs.
- **Forgetting a sign.** In `running_medians`, `low[0]` is the negative of the largest small value. Returning it without `-` gives -4 for the first median of the running example, where 4 is right.
