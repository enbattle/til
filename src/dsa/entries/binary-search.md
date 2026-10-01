---
title: Binary Search
summary: Finding a position in a sorted array by halving the range that could hold it, so a million elements take about 20 comparisons instead of a million.
date: 2026-09-30
kind: algorithm
---

Binary search finds where a value sits in a sorted array by repeatedly
checking the middle of the part that could still hold it and throwing the
other half away. Checking a million sorted numbers one by one can take a
million comparisons; binary search needs about 20. It is short to write and
easy to get subtly wrong, so this entry spends most of its time on why each
line is the way it is.

## Prerequisites

None. You need to know what an array is, that its elements are numbered by
index starting at 0, and what it means for it to be sorted in ascending order:
each element is at least as large as the one before it.

## The idea

Think of the guessing game where someone picks a number from 1 to 100 and
answers each guess with "higher" or "lower". Guessing 50 first rules out half
the numbers whatever the answer is, and guessing the middle of what's left
each time finds any number in at most 7 guesses, because halving 100 seven
times gets below 1. Binary search plays that game against a sorted array: the
answer to "is the middle element smaller than what I'm looking for?" tells it
which half to drop.

The version here computes the **lower bound**: the first index `i` where
`nums[i] >= target`, or `len(nums)` if every element is smaller. For
`nums = [1, 3, 5, 5, 5, 8]`:

- `target = 5` gives 2, the first of the three 5s.
- `target = 4` gives 2, the index where 4 would be inserted to keep the array
  sorted.
- `target = 9` gives 6, the length of the array: everything is smaller.
- `target = 0` gives 0.

One function answers several questions this way. The target is present if
`i < len(nums)` and `nums[i] == target`. The index `i` is also where to insert
the target, and how many elements are smaller than it. For integers, the
lower bound of `target + 1` minus the lower bound of `target` counts the
copies of `target`: 5 - 2 = 3 fives above.

The search keeps a **half-open range** `[lo, hi)` of indices that may still
hold the answer: it includes `lo` and excludes `hi`, so it holds `hi - lo`
indices and is empty when `lo == hi`. The rule the code maintains, its
**invariant**, is that every element before `lo` is smaller than the target
and every element from `hi` onward is at least the target. Here is the search
for 5 in the array above:

| `lo` | `hi` | `mid` | `nums[mid]` | Decision                          |
| ---- | ---- | ----- | ----------- | --------------------------------- |
| 0    | 6    | 3     | 5           | not smaller: answer ≤ 3, `hi = 3` |
| 0    | 3    | 1     | 3           | smaller: answer > 1, `lo = 2`     |
| 2    | 3    | 2     | 5           | not smaller: answer ≤ 2, `hi = 2` |
| 2    | 2    |       |             | range empty: the answer is 2      |

## When to use it

Use it to look things up in data that is already sorted, or that you sort
once and search many times. Most languages ship it: Python's
`bisect.bisect_left` is exactly this lower bound, and so is C++'s
`std::lower_bound`. Java's `Arrays.binarySearch` returns the index of some
matching element (not necessarily the first when there are duplicates) or a
negative number encoding the insertion point. JavaScript has no built-in
binary search on arrays, so in TypeScript you write it yourself. A database
index is the same idea at a larger scale: it keeps values sorted so a lookup
narrows down instead of scanning, as in
[database indexing](/systems-and-infrastructure/database-indexing).

The bigger payoff in interviews is **binary search on the answer**. It works
whenever a yes/no question about a number flips from "no" to "yes" exactly
once as the number grows. Say you must ship packages, in order, within 5 days,
and you want the smallest truck capacity that makes it. If capacity `c` is
enough, any larger capacity is too, so the answers run no, no, ..., no, yes,
yes. Search the capacities between the heaviest package and the total weight
with the same loop, replacing `nums[mid] < target` by "capacity `mid` is not
enough", which you check by simulating the days. The loop finds the first
"yes".

When there's no order to exploit, it's the wrong tool. An unsorted array you
search only once is cheaper to scan from start to end than to sort first, and
exact-key lookups that never need the order are faster in a
[hash map](/dsa/hash-map).

## Walkthrough

```python
def lower_bound(nums: list[int], target: int) -> int:
    """The first index i with nums[i] >= target in sorted nums, or len(nums) if none."""
    lo, hi = 0, len(nums)
```

```typescript
/** The first index i with nums[i] >= target in sorted `nums`, or nums.length. */
export function lowerBound(nums: number[], target: number): number {
  let lo = 0;
  let hi = nums.length;
```

The range starts as every index, `[0, len(nums))`. The invariant holds before
the first comparison because it says nothing yet: no element comes before
index 0, and none sits at or after `len(nums)`. `hi` starts at `len(nums)`, one
past the last index, rather than at the last index, because `len(nums)` is a
possible answer: it's what the function returns when every element is smaller
than the target.

```python
    while lo < hi:
        mid = (lo + hi) // 2
```

```typescript
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
```

The loop runs while the range still holds at least one index. `mid` is the
middle of it, rounded down: Python's `//` divides and rounds down, and in
TypeScript `/` gives a fraction that `Math.floor` rounds down. Rounding down
guarantees `lo <= mid < hi`, so `mid` is always inside the range and never
equal to `hi`, which could be `len(nums)` and past the end of the array.

```python
        if nums[mid] < target:
            lo = mid + 1
        else:
            hi = mid
```

```typescript
    if (nums[mid] < target) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
```

If `nums[mid]` is smaller than the target, so is everything before it (the
array is sorted), so the answer is after `mid`: `lo = mid + 1` drops `mid` and
the whole left half, and everything before the new `lo` is still smaller.
Otherwise `nums[mid]` is at least the target, so `mid` itself might be the
answer. `hi = mid` keeps it reachable, because the answer is allowed to equal
`hi`, and everything from `mid` onward is at least the target. Both branches
shrink the range, `lo` strictly up or `hi` strictly down, so the loop always
ends.

```python
    return lo
```

```typescript
  return lo;
}
```

When the loop stops, `lo == hi`. By the invariant, everything before that
index is smaller than the target and everything from it onward is at least
the target, so it is exactly the first index with `nums[i] >= target`. That is
also correct at the extremes: for an empty array the loop never runs and the
answer is 0, and when every element is smaller, `lo` climbs all the way to
`len(nums)`.

## Complexity

In big-O notation, which describes how the work grows with the input size n
(here the length of the array), binary search takes O(log n) time: log₂ n is
how many times you can halve n before reaching 1, and it grows by just one
each time n doubles. Each pass at least halves the range: a range of s indices
becomes one of at most s / 2, rounded down, on either branch. So the loop runs
at most log₂ n + 1 times, rounded down: 20 passes for a million elements. It
uses O(1) extra space, a fixed amount however long the array is: just `lo`,
`hi` and `mid`.

## Pitfalls

- **Mixing two conventions.** The other common style searches a closed range
  `[lo, hi]` with `hi = len(nums) - 1`, `while lo <= hi` and `hi = mid - 1`.
  Each style is correct on its own; pieces of both are not. Starting this loop
  with `hi = len(nums) - 1` can never return `len(nums)`, so for `[1, 2, 3]`
  and a target of 10 it returns 2 instead of 3.
- **An infinite loop from `lo = mid`.** When the range holds one index
  (`hi == lo + 1`), `mid` rounds down to `lo`, so if `nums[mid]` is smaller
  than the target, `lo = mid` leaves the range unchanged and the loop never
  ends. Searching `[1]` for 5 does this at once: `lo = 0`, `hi = 1`, `mid = 0`,
  forever. A longer array hangs the same way once its range narrows to one
  index whose element is smaller than the target. `lo = mid + 1` is required, and `hi = mid` is safe
  only because `mid` rounds down, which keeps it below `hi`.
- **Overflow in fixed-width languages.** In Java, C or C++, `(lo + hi) / 2`
  with 32-bit integers overflows when `lo + hi` passes 2³¹ - 1 (about 2.1
  billion), which an array of just over a billion elements can reach, and
  `mid` comes out negative. The fix is `lo + (hi - lo) / 2`. Python's integers
  don't overflow, and JavaScript's numbers are exact up to 2⁵³ while array
  lengths stay below 2³², so both versions here are safe as written.
- **Unsorted input.** Nothing checks the order, so an unsorted array gets an
  answer without an error, and the answer means nothing.
- **`<=` where `<` belongs.** Writing `nums[mid] <= target` finds the first
  element strictly greater than the target instead (Python's
  `bisect_right`). That is useful on purpose and a bug by accident.
