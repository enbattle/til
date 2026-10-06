---
title: Sorting
summary: Merge sort for a guaranteed stable O(n log n) order, quickselect for the k-th smallest without sorting the rest, and counting sort when keys are small integers.
date: 2026-10-05
kind: algorithm
template: 2
---

Sorting is two jobs: putting everything in order, and finding one rank without ordering the rest. You'll run both on `[4, 7, 2, 4, 9, 1, 4]`, which sorts to `[1, 2, 4, 4, 4, 7, 9]`: merge sort for the first job, quickselect for the second.

## Prerequisites

- [Arrays and strings](/dsa/arrays-and-strings): slicing and indexing, and the big-O notation Complexity uses. You also need recursion: a function that calls itself on a smaller input.

## The idea

**Merge sort** rests on one fact: merging two sorted lists is easy, because the smallest item left is always at the front of one of them. A one-item list is already sorted, so split in half until you reach single items, then merge back up. The example splits into `[4, 7, 2]` and `[4, 9, 1, 4]`, which sort to `[2, 4, 7]` and `[1, 4, 4, 9]`. The final merge keeps one index per list and takes the smaller front item:

| Step | Left front | Right front | Taken            |
| ---- | ---------- | ----------- | ---------------- |
| 1    | 2          | 1           | 1 (right)        |
| 2    | 2          | 4           | 2 (left)         |
| 3    | 4          | 4           | 4 (left, a tie)  |
| 4    | 7          | 4           | 4 (right)        |
| 5    | 7          | 4           | 4 (right)        |
| 6    | 7          | 9           | 7 (left), then 9 |

Step 3 is a tie, and taking the left item is what makes the sort **stable**: equal items keep their input order, so the 4 that came first still comes first. That matters when you sort records by one field after another.

The merge can also count **inversions**, pairs where an earlier item is larger than a later one. Whenever you take from the right, every item still waiting on the left is larger and came earlier, so you add `len(left) - i`: 3 at step 1, then 1 each at steps 4 and 5, which makes 5 pairs across the halves. Another 2 and 3 sit inside the halves, 10 in all.

**Quickselect** answers "what is the k-th smallest?", counting k from 0. Pick a random item as the **pivot** and **partition**: smaller values to its left, equal ones in the middle, larger to the right. Say the first pivot drawn is a 4. The array becomes `[2, 1, 4, 4, 4, 9, 7]`, and the three 4s are in their final places. For `k = 5`, index 5 is past the middle, so only `[9, 7]` can hold the answer. One or two more rounds leave 7 at index 5, and the rest is never touched again. Recursing into both outer zones instead of one is quicksort: expected O(n log n), in place, not stable.

**Counting sort** skips comparing. When keys are integers in a small known range 0 to `m`, tally each key in an array of size `m + 1` and write the keys back out in order; the example's tallies for 1, 2, 4, 7, 9 are 1, 1, 3, 1, 1. To carry records along, turn the tallies into running totals that give each key its first slot, then place records in input order, which keeps it stable. It costs O(n + m), under the floor for sorts that only compare: about log2(n!) comparisons, so 13 for these 7 items. Radix sort applies it one digit at a time to bigger integers; bucket sort spreads evenly distributed numbers over buckets. There's no code here.

## When to use it

Call the built-in first. Python's `sorted` and `list.sort` are guaranteed stable and use Timsort, a merge sort that exploits runs already in order; they take `key=` and `reverse=`. JavaScript's `Array.prototype.sort` has had to be stable since ES2019. Pass it a comparator like `(a, b) => a - b`, because the default compares as strings: `[10, 9, 1].sort()` gives `[1, 10, 9]`. Write the algorithms yourself when:

- The data is a linked list (merging needs no random access) or too big for memory: sort chunks, then merge them as streams.
- The statement counts or reasons about out-of-order pairs: merge with a count.
- You need the median, a percentile or the k-th smallest of an array in memory: quickselect is expected O(n) where sorting is O(n log n). Neither standard library has one. For the k best of a stream, or a small k over data too big to hold, keep a heap of size k ([Heap patterns](/dsa/heap-patterns)).
- Keys are small integers (ages, scores, letters): counting sort. A billion possible keys means a billion counters, so it needs a small range.
- Many sorted lists to merge: k-way merge, in [Heap patterns](/dsa/heap-patterns).
- Three values to group ("sort colors"): one partition does it.

## Walkthrough

```python
import random
from collections.abc import Callable
from typing import Any, TypeVar

T = TypeVar("T")


def merge_sort(items: list[T], key: Callable[[T], Any] = lambda x: x) -> list[T]:
    """A new list in ascending key order; equal keys keep their input order."""
    if len(items) <= 1:
        return list(items)
    mid = len(items) // 2
    left = merge_sort(items[:mid], key)
    right = merge_sort(items[mid:], key)
    merged: list[T] = []
    i = j = 0
```

```typescript
/** A new array in ascending key order; equal keys keep their input order. */
export function mergeSort<T>(
  items: readonly T[],
  key: (item: T) => number = (item) => item as unknown as number,
): T[] {
  if (items.length <= 1) return [...items];
  const mid = Math.floor(items.length / 2);
  const left = mergeSort(items.slice(0, mid), key);
  const right = mergeSort(items.slice(mid), key);
  const merged: T[] = [];
  let i = 0;
  let j = 0;
```

`mid` rounded down leaves both halves non-empty and shorter, so the recursion ends. Next comes the merge itself.

```python
    while i < len(left) and j < len(right):
        # <=, not <: on a tie the left item came first in the input, so it
        # goes first. With < the sort still sorts, but stability is gone.
        if key(left[i]) <= key(right[j]):
            merged.append(left[i])
            i += 1
        else:
            merged.append(right[j])
            j += 1
    # At most one of these is non-empty, and its items are already in order
    # and no smaller than anything taken. Skip them and the tail vanishes.
    merged.extend(left[i:])
    merged.extend(right[j:])
    return merged
```

```typescript
  while (i < left.length && j < right.length) {
    // <=, not <: on a tie the left item came first in the input, so it
    // goes first. With < the sort still sorts, but stability is gone.
    if (key(left[i]) <= key(right[j])) merged.push(left[i++]);
    else merged.push(right[j++]);
  }
  // At most one of these is non-empty, and its items are already in order
  // and no smaller than anything taken. Skip them and the tail vanishes.
  return merged.concat(left.slice(i), right.slice(j));
}
```

On the example this loop runs the table above and stops at step 6 with `[9]` left over, which `extend` appends. Counting inversions adds `inversions += len(left) - i` in the `else` branch. Quickselect needs a different tool, the partition.

```python
def partition(nums: list[int], lo: int, hi: int, pivot: int) -> tuple[int, int]:
    """Rearrange nums[lo:hi] so nums[lo:lt] < pivot, nums[lt:gt] == pivot and
    nums[gt:hi] > pivot, and return (lt, gt)."""
    lt, i, gt = lo, lo, hi
    while i < gt:
        if nums[i] < pivot:
            # What swaps in from lt is equal to the pivot, so i can move on.
            nums[lt], nums[i] = nums[i], nums[lt]
            lt += 1
            i += 1
        elif nums[i] > pivot:
            # What swaps in from the end is unexamined, so i must stay put.
            gt -= 1
            nums[i], nums[gt] = nums[gt], nums[i]
        else:
            i += 1
    return lt, gt

```

```typescript
/**
 * Rearrange nums[lo, hi) so nums[lo, lt) < pivot, nums[lt, gt) == pivot and
 * nums[gt, hi) > pivot, and return [lt, gt].
 */
export function partition(
  nums: number[],
  lo: number,
  hi: number,
  pivot: number,
): [number, number] {
  let lt = lo;
  let i = lo;
  let gt = hi;
  while (i < gt) {
    if (nums[i] < pivot) {
      // What swaps in from lt is equal to the pivot, so i can move on.
      [nums[lt], nums[i]] = [nums[i], nums[lt]];
      lt++;
      i++;
    } else if (nums[i] > pivot) {
      // What swaps in from the end is unexamined, so i must stay put.
      gt--;
      [nums[i], nums[gt]] = [nums[gt], nums[i]];
    } else {
      i++;
    }
  }
  return [lt, gt];
}
```

Three indexes keep four zones: `[lo, lt)` smaller, `[lt, i)` equal, `[i, gt)` unexamined and `[gt, hi)` larger. Around 4 the example ends as `[2, 1, 4, 4, 4, 9, 7]` with `lt = 2` and `gt = 5`, and the pivot goes in as a value because its own item moves during the swaps. That leaves choosing the pivot and picking a side.

```python
def quickselect(nums: list[int], k: int, rng: random.Random | None = None) -> int:
    """The k-th smallest of nums, counting from 0. Reorders nums in place."""
    if not 0 <= k < len(nums):
        raise IndexError(f"k={k} out of range for {len(nums)} elements")
    rng = rng or random.Random()
    lo, hi = 0, len(nums)
    while True:
        # A random pivot means no input is reliably bad. A first-element pivot
        # is the maximum every round on reversed input, so the range shrinks
        # by one a round; sorted input is milder, about n^1.5.
        lt, gt = partition(nums, lo, hi, nums[rng.randrange(lo, hi)])
        if k < lt:
            hi = lt
        elif k >= gt:
            lo = gt
        else:
            return nums[k]
```

```typescript
/** The k-th smallest of nums, counting from 0. Reorders nums in place. */
export function quickselect(
  nums: number[],
  k: number,
  random: () => number = Math.random,
): number {
  if (!Number.isInteger(k) || k < 0 || k >= nums.length) {
    throw new RangeError(`k=${k} out of range for ${nums.length} elements`);
  }
  let lo = 0;
  let hi = nums.length;
  for (;;) {
    // A random pivot means no input is reliably bad. A first-element pivot
    // is the maximum every round on reversed input, so the range shrinks
    // by one a round; sorted input is milder, about n^1.5.
    const pivot = nums[lo + Math.floor(random() * (hi - lo))];
    const [lt, gt] = partition(nums, lo, hi, pivot);
    if (k < lt) hi = lt;
    else if (k >= gt) lo = gt;
    else return nums[k];
  }
}
```

The range check comes first because an out-of-range `k` never lands in a zone, so Python would fail inside `randrange` and TypeScript would loop forever. The middle zone is why an all-equal array finishes in one pass; a Lomuto-style two-way partition goes quadratic on many duplicates.

## Complexity

| Algorithm     | Time                             | Extra space       |
| ------------- | -------------------------------- | ----------------- |
| Merge sort    | O(n log n), every input          | O(n)              |
| Quickselect   | O(n) expected, O(n²) worst       | O(1)              |
| Quicksort     | O(n log n) expected, O(n²) worst | O(log n) expected |
| Counting sort | O(n + m)                         | O(n + m)          |

Merge sort halves the list about log2 n times (3 levels for 7 items) and each level merges all n items, whatever their order.

Quickselect's rounds cost the size of the range, and a random pivot shrinks it by a constant factor on average, so the total is n + n/2 + ... : a few times n.

## Pitfalls

- **`<` where merge has `<=`.** The sort still sorts, so numbers alone never show it, but `[("a", 2), ("c", 2)]` by number comes out `[("c", 2), ("a", 2)]`.
- **Dropping the two `extend` lines.** The loop ends when one side empties, and without them the other side's items vanish: `merge_sort([4, 7, 2, 4, 9, 1, 4])` returns `[1]`.
- **Advancing `i` after swapping a larger value.** The item swapped in from `gt` is unexamined. With `i += 1` there, `partition` on the example around 4 returns `lt = 1` and `gt = 5`, leaving a stray 1 inside the equal zone, and `quickselect(nums, 1)` can return 1 or 4 instead of 2, depending on the pivot drawn.
- **Taking the first item as the pivot.** Reversed input makes it the maximum every round. For the median of a reversed 1,000 items that is about 376,000 comparisons against about 5,000 with a random pivot; sorted input costs about 53,000.
