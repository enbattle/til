---
title: Quicksort and Quickselect
summary: Sorting in place, and finding the k-th smallest value without sorting everything, by repeatedly splitting the array around a randomly chosen pivot value.
date: 2026-10-01
kind: algorithm
---

Quicksort sorts an array by picking one value, the **pivot**, moving everything
smaller to its left and everything larger to its right, and then sorting those
two sides the same way. **Quickselect** uses the same split to find the k-th
smallest value, but follows only the one side that contains it, so it never
sorts the rest. Both work inside the original array and need no second one.

## Prerequisites

- [Two Pointers](/dsa/two-pointers): the split is done by indexes that walk
  through the array and swap elements, the same bookkeeping as two pointers.

You also need to know what a sorted array is, and that the array is numbered by
index from 0.

## The idea

The split step is called **partitioning**. This entry partitions into three
zones rather than two: values smaller than the pivot, values equal to it, and
values larger. Given `[4, 7, 2, 4, 9, 1, 4]` and the pivot value 4, a correct
partition leaves something like `[2, 1 | 4, 4, 4 | 9, 7]`. The equal zone is
already in its final place, because everything left of it is smaller and
everything right of it is larger. Only the two outer zones still need work.

The partition keeps four zones in `nums[lo:hi]` at all times, using three
indexes: `lt`, `i` and `gt`. Everything in `[lo, lt)` is smaller than the pivot,
`[lt, i)` is equal to it, `[i, gt)` has not been looked at yet, and `[gt, hi)`
is larger. It looks at `nums[i]` and moves it into the right zone: an equal
value stays and `i` moves on; a smaller value swaps with `nums[lt]` and both
`lt` and `i` move on; a larger value swaps with the last unexamined element and
`gt` moves down by one, with `i` staying put. Here is the trace on the example,
with the indexes after each step:

| Step         | `lt` | `i` | `gt` | `nums`                  |
| ------------ | ---- | --- | ---- | ----------------------- |
| start        | 0    | 0   | 7    | `[4, 7, 2, 4, 9, 1, 4]` |
| 4 is equal   | 0    | 1   | 7    | `[4, 7, 2, 4, 9, 1, 4]` |
| 7 is larger  | 0    | 1   | 6    | `[4, 4, 2, 4, 9, 1, 7]` |
| 4 is equal   | 0    | 2   | 6    | `[4, 4, 2, 4, 9, 1, 7]` |
| 2 is smaller | 1    | 3   | 6    | `[2, 4, 4, 4, 9, 1, 7]` |
| 4 is equal   | 1    | 4   | 6    | `[2, 4, 4, 4, 9, 1, 7]` |
| 9 is larger  | 1    | 4   | 5    | `[2, 4, 4, 4, 1, 9, 7]` |
| 1 is smaller | 2    | 5   | 5    | `[2, 1, 4, 4, 4, 9, 7]` |

Now `i == gt`, nothing is unexamined, and the zones are `[2, 1]`, `[4, 4, 4]`
and `[9, 7]`: `lt = 2`, `gt = 5`.

Quicksort calls this on the whole array, then on the left zone and the right
zone. Quickselect for the k-th smallest, counting from 0 (so `k = 0` is the
minimum), asks where index `k` falls. If `k < lt`, the answer is in the left
zone; if `k >= gt`, in the right zone; otherwise index `k` is inside the equal
zone and the answer is the pivot. For the example array, sorted it is
`[1, 2, 4, 4, 4, 7, 9]`, so `k = 5` asks for 7. After the partition above
`k = 5 >= gt = 5`, so only `[9, 7]` is left to search, and one more partition
around 9 and then around 7 leaves 7 at index 5.

How the pivot is chosen decides the speed. If the pivot is always the first
element, a sorted array makes it the smallest value every time: the left zone is
empty and the right zone holds all the rest. The range shrinks by one per
round instead of halving. A 1,000-element sorted array then takes
999 + 998 + ... + 1 = 499,500 comparisons, against about 10,000 (n × log₂ n)
for balanced splits, and the recursion nests 1,000 calls deep. Reversed input
does the same. Choosing the pivot at random makes the cost independent of the
input's order: no particular input is reliably bad, only unlucky draws are.

## When to use it

Quicksort is a good default for sorting an in-memory array of numbers when you
don't need equal elements to keep their original order: it sorts in place and
needs only a small stack, where merge sort needs a second array. It is **not
stable**: partitioning swaps elements across long distances, so two equal values
can end up in a different order than they started. That matters when you sort
records by one field and want ties to stay in their earlier order; for that,
[merge sort](/dsa/merge-sort) is stable. Python's `sorted` and `list.sort` use a
different algorithm (Timsort), so in practice you'd call them; writing it out
is for understanding partition, which also solves problems like
"move all zeros to the end" and "sort an array of 0s, 1s and 2s".

Use quickselect when you need one rank: the median, the 90th percentile, the
k-th smallest. It is expected O(n), where sorting first is O(n log n). Compared
with a heap, it needs the whole array in memory and reorders it, but it does less
work for one answer. For the k smallest or largest values out of a stream, or
when k is small and the data is too big to hold, keep a heap of size k instead:
see [Top-K with a Heap](/dsa/top-k).

## Walkthrough

```python
import random


def partition(nums: list[int], lo: int, hi: int, pivot: int) -> tuple[int, int]:
    """Rearrange nums[lo:hi] into three zones around the value pivot.

    Returns (lt, gt): nums[lo:lt] < pivot, nums[lt:gt] == pivot, nums[gt:hi] > pivot.
    """
    lt, i, gt = lo, lo, hi
```

```typescript
/** A source of numbers in [0, 1), like Math.random. Pass a seeded one in tests. */
export type Random = () => number;

/**
 * Rearrange nums[lo, hi) into three zones around the value `pivot`.
 * Returns [lt, gt]: nums[lo, lt) < pivot, nums[lt, gt) == pivot, nums[gt, hi) > pivot.
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
```

The function takes a range `[lo, hi)` rather than a whole array, because both
algorithms recurse into pieces of the same array and copying pieces would cost
the extra space the in-place design avoids. The pivot is passed as a value, not
an index: the pivot's own element moves during the partition, so an index would
point at something else halfway through. At the start nothing has been sorted
into a zone, so the smaller and equal zones are empty (`lt == i == lo`) and the
larger zone is empty (`gt == hi`); everything is unexamined.

```python
    while i < gt:
        if nums[i] < pivot:
            nums[lt], nums[i] = nums[i], nums[lt]
            lt += 1
            i += 1
        elif nums[i] > pivot:
            gt -= 1
            nums[i], nums[gt] = nums[gt], nums[i]
        else:
            i += 1
    return lt, gt
```

```typescript
  while (i < gt) {
    if (nums[i] < pivot) {
      [nums[lt], nums[i]] = [nums[i], nums[lt]];
      lt++;
      i++;
    } else if (nums[i] > pivot) {
      gt--;
      [nums[i], nums[gt]] = [nums[gt], nums[i]];
    } else {
      i++;
    }
  }
  return [lt, gt];
}
```

The three branches differ in whether `i` advances, and that is the part to get
right. A smaller value swaps with `nums[lt]`, which is the first element of the
equal zone (or `nums[i]` itself when that zone is empty), so what lands at index
`i` has already been classified as equal, and `i` can move on. A larger value
swaps with `nums[gt - 1]`, the last unexamined element, which could be anything,
so `i` must stay and look at it. Advancing `i` there would skip it and can leave
a smaller value stranded in the middle zone. The loop ends at `i < gt`, not
`i < hi`, because everything from `gt` onward was already placed. The equal zone
is what makes duplicates cheap: a two-way partition that sends equal values to
one side splits an all-equal array into nothing and everything else, and falls
into the same n-by-n slide as a bad pivot. Here the whole array lands in the
equal zone in one pass and both recursive calls get empty ranges.

```python
def quicksort(nums: list[int], rng: random.Random | None = None) -> None:
    """Sort nums in place, ascending. Not stable. A seeded Random repeats a run."""
    sort_range(nums, 0, len(nums), rng or random.Random())


def sort_range(nums: list[int], lo: int, hi: int, rng: random.Random) -> None:
    """Sort nums[lo:hi] in place."""
    while hi - lo > 1:
        lt, gt = partition(nums, lo, hi, nums[rng.randrange(lo, hi)])
```

```typescript
/** Sort `nums` in place, ascending. Not stable. A seeded `random` repeats a run. */
export function quicksort(nums: number[], random: Random = Math.random): void {
  sortRange(nums, 0, nums.length, random);
}

/** Sort nums[lo, hi) in place. */
export function sortRange(nums: number[], lo: number, hi: number, random: Random): void {
  while (hi - lo > 1) {
    const pivot = nums[lo + Math.floor(random() * (hi - lo))];
    const [lt, gt] = partition(nums, lo, hi, pivot);
```

The random number generator is a parameter instead of a global call so a test
can hand in a seeded one and get the same sequence of pivots each run; a failing
random run is then repeatable. The loop stops at fewer than two elements because
zero or one element is already sorted. The pivot is the value at a random index
in `[lo, hi)`, and since it is read from the array, the equal zone has at least
one element, so every partition makes progress: both outer zones are strictly
smaller than the range.

```python
        if lt - lo < hi - gt:
            sort_range(nums, lo, lt, rng)
            lo = gt
        else:
            sort_range(nums, gt, hi, rng)
            hi = lt
```

```typescript
    if (lt - lo < hi - gt) {
      sortRange(nums, lo, lt, random);
      lo = gt;
    } else {
      sortRange(nums, gt, hi, random);
      hi = lt;
    }
  }
}
```

After partitioning there are two zones to sort. The code recurses into the
smaller one and then loops, updating `lo` or `hi`, to handle the larger. Recursing
into the larger one instead would work and still sort correctly, but its stack
depth could reach n on an unlucky run, and a deep stack is a crash in Python
(the default limit is 1,000 calls) and a stack overflow in JavaScript. A zone
that is the smaller of two is at most half the range, so each nested call works
on at most half as many elements as its caller, and the stack is at most log₂ n
calls deep, however the pivots fall. The loop reuses the current call for the
larger side, which costs no stack at all.

```python
def quickselect(nums: list[int], k: int, rng: random.Random | None = None) -> int:
    """The k-th smallest of nums, counting k from 0 (k = 0 is the minimum).

    Reorders nums in place. Raises IndexError unless 0 <= k < len(nums).
    """
    if not 0 <= k < len(nums):
        raise IndexError(f"k={k} out of range for {len(nums)} elements")
    rng = rng or random.Random()
    lo, hi = 0, len(nums)
    while True:
        lt, gt = partition(nums, lo, hi, nums[rng.randrange(lo, hi)])
        if k < lt:
            hi = lt
        elif k >= gt:
            lo = gt
        else:
            return nums[k]
```

```typescript
/**
 * The k-th smallest of `nums`, counting k from 0 (k = 0 is the minimum).
 * Reorders `nums` in place. Throws a RangeError unless 0 <= k < nums.length.
 */
export function quickselect(
  nums: number[],
  k: number,
  random: Random = Math.random,
): number {
  if (!Number.isInteger(k) || k < 0 || k >= nums.length) {
    throw new RangeError(`k=${k} out of range for ${nums.length} elements`);
  }
  let lo = 0;
  let hi = nums.length;
  while (true) {
    const pivot = nums[lo + Math.floor(random() * (hi - lo))];
    const [lt, gt] = partition(nums, lo, hi, pivot);
    if (k < lt) {
      hi = lt;
    } else if (k >= gt) {
      lo = gt;
    } else {
      return nums[k];
    }
  }
}
```

Counting `k` from 0 matches array indexes: the answer is what `sorted(nums)[k]`
would hold. For the k-th smallest counted from 1, pass `k - 1`. Quickselect
needs no recursion at all, since it follows one zone and abandons the other, so
a loop narrowing `[lo, hi)` is enough. The range check up front matters because
with `k` outside the array no zone ever contains it, so the range shrinks to
empty: Python then fails with an unrelated error from `rng.randrange(lo, hi)`,
and TypeScript would loop forever. The comparisons use `lt` and `gt` in
the same way as the partition's zones: `k < lt` is strictly inside the smaller
zone, `k >= gt` is inside the larger one, and anything in `[lt, gt)` holds the
pivot value, so `nums[k]` is the answer. Writing `k > gt` would miss the case
where index `gt` is the first larger element and return it, which is wrong.
Returning `nums[k]` or the pivot gives the same value, since every index in the
equal zone holds the pivot. Either way, the partitions already done leave the
array arranged with everything at indexes below `k` no larger than the answer
and everything above no smaller.

## Complexity

With a random pivot, quicksort takes expected O(n log n) time. Each partition
costs time proportional to the size of its range, and the ranges at one depth of
the recursion are disjoint, so a level costs at most n in total. A pivot whose
rank is in the middle half of the range (probability about one half) leaves each
side at most three quarters of it, so the expected number of levels is
O(log n). The worst case is O(n²), when every pivot is close to the smallest or
largest value; with random choices that takes extraordinary bad luck, and with
many duplicates the three-way partition avoids the other common trigger. Extra
space is O(log n) for the stack, because of the smaller-side-first rule above,
plus O(1) for the indexes.

Quickselect takes expected O(n) time. The first partition costs n. With
probability about one half the pivot lands in the middle half, leaving at most
3n/4 elements to search, so on average two rounds shrink the range to three
quarters, and the total is at most about n × 2 × (1 + 3/4 + (3/4)² + ...) = 8n
comparisons in expectation. Its worst case is O(n²) for the same reason as
quicksort's. It uses O(1) extra space, since it loops rather than recurses, and
it reorders the caller's array. A heap-based alternative costs O(n log k) time
and O(k) space.

## Pitfalls

- **A fixed pivot position.** Always taking the first or last element makes
  sorted and reversed input, which is common, the worst case: n(n - 1) / 2
  comparisons and, if recursion follows the big side, n nested calls.
- **Two-way partitioning on duplicates.** A partition with only "smaller" and
  "not smaller" sides makes an array of equal values, or just a few distinct
  ones, quadratic. The equal zone is the fix.
- **Not advancing `i` correctly.** After swapping a larger value from `gt`, `i`
  must not move, because the value that arrived is unexamined; moving `i` can
  leave misplaced values behind and the output is not sorted. After a smaller
  value, `i` must move too: otherwise, when the equal zone is empty, `lt` runs
  ahead of `i` and the swaps write outside the range, an `IndexError` at the
  end of a Python list, holes and a longer array in JavaScript, and silently
  overwritten elements inside a subrange.
- **Recursing into the larger side.** The sort is still correct, but the stack
  can reach n deep on a bad run and crash on large inputs.
- **Expecting stability.** Equal values can swap their relative order. Sort by a
  tuple key including the original index if order among ties matters.
- **Mutating the caller's data unawares.** Both functions rearrange the list they
  are given; quickselect returns one value but leaves the list scrambled. Pass a
  copy (`list(nums)`, `[...nums]`) when the original order is still needed.
- **Mixing up k's base.** Here `k = 0` is the minimum. A caller thinking of the
  "3rd smallest" must pass 2, and `k = len(nums)` raises an error.
