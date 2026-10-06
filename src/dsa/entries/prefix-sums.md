---
title: Prefix Sums
summary: Precompute running totals so a range sum is one subtraction, and count subarrays that hit a target by remembering which totals you have already passed.
date: 2026-10-05
kind: pattern
---

A prefix sum is a running total: the sum of an array from the start up to some
position. Compute them all once and the sum of any stretch is the difference of
two of them. You'll use that for range-sum queries, then add a hash map to count
the stretches that add up to a target in one pass.

## Prerequisites

- [Arrays and strings](/dsa/arrays-and-strings): the totals live in an array,
  and reading any index is the O(1) step everything here rests on. That entry
  also defines big-O notation.
- [Hash map](/dsa/hash-map): the counting version maps each earlier total to how
  often it occurred.

## The idea

You're handed `nums = [3, -1, 2, 1, -2, 4]` and asked for the sum of the
elements at positions 1 through 3, and then for thousands more ranges like it.
Adding up each range costs a loop per question. A **subarray** is a run of
consecutive elements, and the trick is to stop re-adding the same elements.

Build `prefix` once, where `prefix[i]` is the sum of the first `i` elements. It
has one more entry than `nums`, and `prefix[0]` is 0, the sum of nothing:

| `i`         | 0   | 1   | 2   | 3   | 4   | 5   | 6   |
| ----------- | --- | --- | --- | --- | --- | --- | --- |
| `prefix[i]` | 0   | 3   | 2   | 4   | 5   | 3   | 7   |

Now `nums[left..right]`, both ends included, sums to
`prefix[right + 1] - prefix[left]`: everything through `right`, minus everything
before `left`. For positions 1 through 3 that is `prefix[4] - prefix[1]` =
5 - 3 = 2, and indeed -1 + 2 + 1 = 2.

Next question: how many subarrays sum to exactly `k = 3`? A subarray from `a`
through `b` does when `prefix[b + 1] - prefix[a] = 3`, which rearranges to
`prefix[a] = prefix[b + 1] - 3`. So walk the array keeping a running `total`,
and at each step ask how many earlier totals equal `total - 3`. Each one is a
start for a subarray ending here. A hash map from total to the number of times
it has appeared answers that in O(1), and it begins as `{0: 1}`, because the
total before any element is a legitimate start.

| Element | `total` | Need `total - 3` | Seen before | `count` | Map afterwards                   |
| ------- | ------- | ---------------- | ----------- | ------- | -------------------------------- |
| start   |         |                  |             | 0       | `{0: 1}`                         |
| 3       | 3       | 0                | 1           | 1       | `{0: 1, 3: 1}`                   |
| -1      | 2       | -1               | 0           | 1       | `{0: 1, 3: 1, 2: 1}`             |
| 2       | 4       | 1                | 0           | 1       | `{0: 1, 3: 1, 2: 1, 4: 1}`       |
| 1       | 5       | 2                | 1           | 2       | `{0: 1, 3: 1, 2: 1, 4: 1, 5: 1}` |
| -2      | 3       | 0                | 1           | 3       | `{0: 1, 3: 2, 2: 1, 4: 1, 5: 1}` |
| 4       | 7       | 4                | 1           | 4       | 7 added                          |

The four subarrays are `[3]`, `[3, -1, 2, 1, -2]`, `[2, 1]` and `[1, -2, 4]`.

## When to use it

- Many sum queries on an array that doesn't change between them: build once,
  answer each in O(1).
- "How many subarrays have sum `k`", "is there a subarray whose sum is a
  multiple of `m`" (store each total modulo `m`), or "the longest subarray with
  sum `k`" (store each total's first position instead of a count).
- The elements can be negative. A [sliding window](/dsa/sliding-window) moves
  its ends by asking whether the sum is too big or too small, which only works
  when growing the window never lowers the sum. On our array with `k = 3` the
  window passes 3 + (-1) + 2 = 4, shrinks by dropping the 3, and never finds
  the whole `[3, -1, 2, 1, -2]`. Prefix sums compare totals and don't care about
  signs.
- Not for data that changes: an update at position `i` makes every entry after
  it stale.

## Walkthrough

```python
def build_prefix(nums: list[int]) -> list[int]:
    """prefix[i] is the sum of nums[:i], so prefix[0] == 0 and len == n + 1."""
    # Start at 0, not empty: prefix[left] must exist when left is 0, and
    # without it a range from 0 needs prefix[-1], which reads the last total.
    prefix = [0]
    for value in nums:
        prefix.append(prefix[-1] + value)
    return prefix
```

```typescript
/** prefix[i] is the sum of the first i elements; prefix[0] is 0, length n + 1. */
export function buildPrefix(nums: number[]): number[] {
  // Start at 0, not empty: prefix[left] must exist when left is 0, and
  // without it a range from 0 needs prefix[-1], which reads undefined.
  const prefix = [0];
  for (const value of nums) {
    prefix.push(prefix[prefix.length - 1] + value);
  }
  return prefix;
}
```

Each entry is the previous one plus one element, so the whole table costs one
pass, and the running example comes out as `[0, 3, 2, 4, 5, 3, 7]`. Now a
query only has to read two entries.

```python
def range_sum(prefix: list[int], left: int, right: int) -> int:
    """Sum of nums[left..right], both ends included."""
    # Check first: a bad index would return a wrong number, not fail
    # (Python reads a negative index from the end).
    if not 0 <= left <= right < len(prefix) - 1:
        raise IndexError("need 0 <= left <= right < len(nums)")
    # right + 1: prefix[right] stops one element short of nums[right].
    return prefix[right + 1] - prefix[left]
```

```typescript
/** Sum of nums[left..right], both ends included. */
export function rangeSum(prefix: number[], left: number, right: number): number {
  // Check first: a bad index would return a wrong number, not fail
  // (JavaScript reads a missing entry as undefined, so the sum is NaN).
  if (!(left >= 0 && left <= right && right < prefix.length - 1)) {
    throw new RangeError('need 0 <= left <= right < nums.length');
  }
  // right + 1: prefix[right] stops one element short of nums[right].
  return prefix[right + 1] - prefix[left];
}
```

The bound is `len(prefix) - 1`, the length of `nums`, because `right` indexes
`nums`. That answers any range in the same two reads. What if you aren't given
ranges at all, and must count the ranges that hit a target? You don't even need
the table.

```python
def count_subarrays_with_sum(nums: list[int], k: int) -> int:
    """How many non-empty contiguous subarrays of nums add up to exactly k."""
    # Seed with the empty start: without {0: 1}, a subarray that begins at
    # index 0 has no earlier total to pair with and is never counted.
    seen = {0: 1}
    total = 0
    count = 0
```

```typescript
/** How many non-empty contiguous subarrays of `nums` add up to exactly `k`. */
export function countSubarraysWithSum(nums: number[], k: number): number {
  // Seed with the empty start: without [0, 1], a subarray that begins at
  // index 0 has no earlier total to pair with and is never counted.
  const seen = new Map<number, number>([[0, 1]]);
  let total = 0;
  let count = 0;
```

The loop needs only the current `total` and a tally of earlier ones, so the
prefix array is never built. The seed is the row marked "start" in the table:
without it the first `3` looks up 0, finds nothing, and `[3]` is missed.

```python
    for value in nums:
        total += value
        # Look up before inserting: with k == 0 the lookup would find the
        # current total itself and count an empty subarray.
        count += seen.get(total - k, 0)
        # A count, not a set: each earlier start with this total is its
        # own subarray.
        seen[total] = seen.get(total, 0) + 1
    return count
```

```typescript
  for (const value of nums) {
    total += value;
    // Look up before inserting: with k === 0 the lookup would find the
    // current total itself and count an empty subarray.
    count += seen.get(total - k) ?? 0;
    // A count, not a set: each earlier start with this total is its
    // own subarray.
    seen.set(total, (seen.get(total) ?? 0) + 1);
  }
  return count;
}
```

Run on the example, `count` climbs 1, 1, 1, 2, 3, 4, matching the table. The
total 3 appears twice, once after `3` and once after `-2`; a later total of 6
would find both starts, which is why the map counts rather than remembers.

## Complexity

| Operation                  | Time          | Space |
| -------------------------- | ------------- | ----- |
| `build_prefix`             | O(n)          | O(n)  |
| `range_sum`, per query     | O(1)          | O(1)  |
| `count_subarrays_with_sum` | O(n) expected | O(n)  |

Answering q queries costs O(n + q) with the table and O(n * q) by adding each
range. The count is O(n) because the map holds at most n + 1 totals and each
lookup and update is O(1) on average. Trying every start and end is O(n²): for
1,000 elements, 500,500 subarrays against about 1,000 steps.

## Pitfalls

- **Leaving out the leading 0.** Without `prefix = [0]`, the formula for a range
  starting at 0 reads `prefix[-1]`, which Python resolves to the last entry and
  TypeScript to `undefined`.
- **Dropping the `{0: 1}` seed.** Every subarray that starts at index 0 is
  missed, so `[5]` with `k = 5` returns 0 instead of 1.
- **Inserting the total before looking it up.** It shows up only when `k` is 0:
  each position then matches itself, and `[1, 2]` returns 2 instead of 0.
- **Storing a set where you need a count.** Several starts can share a total,
  and `[1, -1, 1, -1]` with `k = 0` has four subarrays but only two distinct
  totals.
