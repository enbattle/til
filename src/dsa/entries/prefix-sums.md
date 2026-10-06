---
title: Prefix Sums
summary: Precomputing running totals so any range sum is one subtraction, and counting subarrays that hit a target sum in one pass by remembering how often each earlier total occurred.
date: 2026-10-01
kind: pattern
---

A prefix sum is a running total: the sum of an array's elements from the start
up to some position. If you compute all the running totals once, the sum of any
stretch of the array is the difference of two of them, so a question that
looks like it needs a loop over the stretch needs one subtraction instead. The
same idea, with a hash map added, counts the stretches that add up to a given
number in a single pass.

## Prerequisites

- [Arrays and strings](/dsa/arrays-and-strings): the running totals are stored
  in an array, and reading any index of it is the O(1) step everything here
  depends on.
- [Hash Map](/dsa/hash-map): the counting problem keeps a map from each
  earlier running total to how many times it has occurred. That entry also
  explains the big-O notation (O(1), O(n)) used here.

## The idea

A **subarray** is a run of consecutive elements of an array, such as the
elements at positions 1 through 3. Its sum is what most questions in this
family ask about. Computing it from scratch costs one addition per element,
which adds up if you are asked about thousands of ranges.

The fix is to build an array `prefix` once, where `prefix[i]` is the sum of the
first `i` elements of `nums`. It has one more entry than `nums`, and
`prefix[0]` is 0: the sum of zero elements. For `nums = [3, 1, 4, 1, 5]`:

| `i`         | 0   | 1   | 2   | 3   | 4   | 5   |
| ----------- | --- | --- | --- | --- | --- | --- |
| `prefix[i]` | 0   | 3   | 4   | 8   | 9   | 14  |

Now the sum of `nums[left..right]`, with both ends included, is
`prefix[right + 1] - prefix[left]`. The first term is everything up to and
including `right`; the second is everything before `left`; the difference is
what lies between. For positions 1 through 3 that is `prefix[4] - prefix[1]`
= 9 - 3 = 6, and indeed 1 + 4 + 1 = 6.

**Counting subarrays that sum to k.** Take the question "how many subarrays of
`nums` add up to exactly `k`?" A subarray from position `a` to `b` sums to `k`
exactly when `prefix[b + 1] - prefix[a] = k`, which rearranges to
`prefix[a] = prefix[b + 1] - k`. So walk along the array keeping the running
total, and at each position ask how many earlier running totals equal
`total - k`. Each of those is the start of a subarray ending here that sums to
`k`. A hash map from running total to the number of times it has been seen
answers that question in O(1).

The map must start as `{0: 1}`. The total before any element has been added
is 0, and it is a legitimate earlier total: it is the start of every subarray
that begins at position 0. Without that entry, a subarray beginning at the
front of the array can never be counted.

Here is `nums = [1, -1, 1, 2]` with `k = 3`. The answer is 2: the whole array
(1 - 1 + 1 + 2) and its last two elements (1 + 2).

| Element | `total` | `total - k` | Times `total - k` seen before | `count` | Map afterwards       |
| ------- | ------- | ----------- | ----------------------------- | ------- | -------------------- |
| start   |         |             |                               | 0       | `{0: 1}`             |
| 1       | 1       | -2          | 0                             | 0       | `{0: 1, 1: 1}`       |
| -1      | 0       | -3          | 0                             | 0       | `{0: 2, 1: 1}`       |
| 1       | 1       | -2          | 0                             | 0       | `{0: 2, 1: 2}`       |
| 2       | 3       | 0           | 2                             | 2       | `{0: 2, 1: 2, 3: 1}` |

At the last element the total is 3, and 0 has been seen twice: once as the
seed, which gives the whole array, and once after the second element, which
gives the last two.

## When to use it

Reach for prefix sums when a problem asks for many range sums on an array
that doesn't change: build the array once, then each query is O(1). The
counting version fits "how many subarrays have sum k", "is there a subarray
whose sum is a multiple of m" (store each total modulo m instead of the total
itself) and "what is the longest subarray with sum k" (store the first
position of each total instead of a count).

The counting problem is also the case where it matters that elements can be
negative. A [sliding window](/dsa/sliding-window) grows on the right and
shrinks on the left, and it only works when growing the window can never lower
its sum and shrinking can never raise it, so the sum is a reliable signal for
which end to move. That holds when every element is non-negative. With
negatives it breaks: on `[5, -2]` with `k = 3`, a window that shrinks whenever
its sum passes `k` sees 5, drops it, and never finds 5 + (-2) = 3. Prefix sums
don't care about signs, because they compare totals instead of steering a
window.

The array version is for data that stays put. If elements change between
queries, every prefix entry after the changed position is stale.

## Walkthrough

```python
def build_prefix(nums: list[int]) -> list[int]:
    """prefix[i] is the sum of nums[:i], so prefix[0] == 0 and len == len(nums) + 1."""
    prefix = [0]
    for value in nums:
        prefix.append(prefix[-1] + value)
    return prefix
```

```typescript
/** prefix[i] is the sum of the first i elements; prefix[0] is 0, length is n + 1. */
export function buildPrefix(nums: number[]): number[] {
  const prefix = [0];
  for (const value of nums) {
    prefix.push(prefix[prefix.length - 1] + value);
  }
  return prefix;
}
```

The list starts as `[0]` instead of empty so that the first element has
something to be added to, and so that `prefix[left]` is a valid lookup when
`left` is 0. An empty `nums` gives `[0]`. Each new entry is the previous entry
plus one element, so building the whole array is one pass. If the leading 0
were left out, the sum starting at position 0 would need a special case, and
forgetting it would be a silent bug: `prefix[-1]` in Python is the last
element, not an error.

```python
def range_sum(prefix: list[int], left: int, right: int) -> int:
    """Sum of nums[left..right], both ends included, from prefix = build_prefix(nums)."""
    if not 0 <= left <= right < len(prefix) - 1:
        raise IndexError("need 0 <= left <= right < len(nums)")
    return prefix[right + 1] - prefix[left]
```

```typescript
/** Sum of nums[left..right], both ends included, from prefix = buildPrefix(nums). */
export function rangeSum(prefix: number[], left: number, right: number): number {
  if (!(left >= 0 && left <= right && right < prefix.length - 1)) {
    throw new RangeError('need 0 <= left <= right < nums.length');
  }
  return prefix[right + 1] - prefix[left];
}
```

The `+ 1` on `right` comes from the extra leading entry: `prefix[right + 1]`
includes `nums[right]`, while `prefix[right]` would stop one element short. The
check exists because an out-of-range index fails badly in both languages: a
negative index in Python reads from the end, and in TypeScript a missing entry
is `undefined`, which turns the subtraction into `NaN` without any error. The
limit is `len(prefix) - 1`, the length of `nums`, not the length of `prefix`,
because `right` is a position in `nums`.

```python
def count_subarrays_with_sum(nums: list[int], k: int) -> int:
    """How many non-empty contiguous subarrays of nums add up to exactly k."""
    seen = {0: 1}
    total = 0
    count = 0
```

```typescript
/** How many non-empty contiguous subarrays of `nums` add up to exactly `k`. */
export function countSubarraysWithSum(nums: number[], k: number): number {
  const seen = new Map<number, number>([[0, 1]]);
  let total = 0;
  let count = 0;
```

The counting version never builds the prefix array. It only needs the running
total so far (`total`) and a tally of the earlier totals (`seen`), so it uses
no second pass and no array of totals, only the map. The map starts as
`{0: 1}` for the reason in "The idea": it stands for the empty stretch before
the first element. Drop it and `count_subarrays_with_sum([5], 5)` returns 0,
because the total 5 is looked up as `5 - 5 = 0`, which isn't there.

```python
    for value in nums:
        total += value
        count += seen.get(total - k, 0)
        seen[total] = seen.get(total, 0) + 1
    return count
```

```typescript
  for (const value of nums) {
    total += value;
    count += seen.get(total - k) ?? 0;
    seen.set(total, (seen.get(total) ?? 0) + 1);
  }
  return count;
}
```

Two details carry the logic. The default of 0 (`.get(..., 0)` in Python,
`?? 0` in TypeScript) is for a total that hasn't been seen, which means no
subarray ends here with that start. And the lookup comes before the insert.
Swap them and the current total is already in the map when it is looked up;
when `k` is 0, `total - k` is `total`, so every position would count a
subarray of zero elements ending at itself. `[1, 2]` with `k = 0` would
return 2 instead of 0. The map stores counts, not just which totals exist,
because several different starting positions can share a total, and each is a
separate subarray.

## Complexity

`build_prefix` is O(n) time and O(n) space for the n + 1 totals. After that,
`range_sum` is O(1) per query: two array reads and one subtraction, however
long the range is. For q queries that is O(n + q), against O(n * q) when each
query adds up its own range.

`count_subarrays_with_sum` makes one pass, and each step is a lookup and an
update in the hash map, which are O(1) on average. So it is O(n) expected time.
The map holds at most n + 1 distinct totals (the seed plus one per element), so
the space is O(n).

The brute-force alternative tries every start and end. An array of 1,000
elements has 1,000 * 1,001 / 2 = 500,500 non-empty subarrays, so even with a
running total per start that is O(n²), about half a million steps against
about a thousand. The tests compare the two on seeded random inputs.

## Pitfalls

- **Leaving out the leading 0.** `prefix[right] - prefix[left - 1]` fails when
  `left` is 0: in Python, `prefix[-1]` silently reads the last entry, and in
  TypeScript it is `undefined`. Keep the extra entry and use
  `prefix[right + 1] - prefix[left]`.
- **Not seeding the map with `{0: 1}`.** Every subarray that starts at position
  0 is missed, so `[5]` with `k = 5` gives 0 instead of 1.
- **Inserting the current total before looking it up.** This only shows up when
  `k` is 0, where it counts empty subarrays. See the walkthrough for an example.
- **Using a sliding window when elements can be negative.** The window's
  shrink-when-too-big rule needs sums that only grow as the window grows. On
  `[1, -1, 1, 2]` with `k = 3` the same shrink-when-too-big window finds only
  one of the two subarrays.
- **Keeping a stale prefix array.** If `nums[i]` changes, every entry from
  `prefix[i + 1]` on is wrong. Rebuild it, or pick a structure built for
  updates; prefix sums suit data that is read many times and written rarely.
- **Overflow in fixed-width languages.** In Java, C or C++, a running total of
  many large values can exceed the 32-bit integer limit even if every element
  fits. Python's integers never overflow, and the TypeScript version is exact
  while every running total stays within ±(2^53 - 1), `Number.MAX_SAFE_INTEGER`.
