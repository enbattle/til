---
title: Sliding Window
summary: Keeping a running answer for a contiguous run of an array and moving its two ends only forward, so a question about the best run takes one pass instead of a rescan per run.
date: 2026-10-05
kind: pattern
template: 2
---

A **window** is a contiguous run of an array, marked by two indexes: `left`, its first position, and `right`, its last. Sliding it means moving those indexes forward while you keep an answer for what's inside, instead of recomputing that answer at every position. You'll use one array, `[2, 1, 5, 1, 3, 2]`, to ask three questions, one fixed-size window and two variable-size ones.

## Prerequisites

- [Two pointers](/dsa/two-pointers): the window is two indexes that move in the same direction, with a new rule for which one moves.
- [Hash map](/dsa/hash-map): the third question keeps a map from each value to how often it appears in the window. Complexity uses big-O notation, defined in [Arrays and strings](/dsa/arrays-and-strings).

## The idea

Start with a fixed size: what's the largest sum of 3 consecutive values? The slow way adds up every group of three from scratch: 4 groups, 2 additions each. But neighboring groups share all but one value. Slide one step right, subtract the value that leaves, add the one that enters, and you have the new sum in one step, however wide the window is.

| `right` | In  | Out | Window sum | Indexes |
| ------- | --- | --- | ---------- | ------- |
| 2       |     |     | 2+1+5 = 8  | 0..2    |
| 3       | 1   | 2   | 8+1-2 = 7  | 1..3    |
| 4       | 3   | 1   | 7+3-1 = 9  | 2..4    |
| 5       | 2   | 5   | 9+2-5 = 6  | 3..5    |

The answer is 9, from `5, 1, 3`. The leaver is always `k` positions behind `right`, so only `right` needs to be a loop variable.

Now let the size vary. What's the shortest run that sums to at least 9? No size is given, so the window grows until it satisfies the condition, then shrinks from the left for as long as it still does, recording its length at each stop:

| `right` | Added | Total | Then                                        | Window | Shortest |
| ------- | ----- | ----- | ------------------------------------------- | ------ | -------- |
| 0       | 2     | 2     |                                             | 0..0   | none     |
| 1       | 1     | 3     |                                             | 0..1   | none     |
| 2       | 5     | 8     |                                             | 0..2   | none     |
| 3       | 1     | 9     | length 4; drop 2, total 7                   | 1..3   | 4        |
| 4       | 3     | 10    | length 4, drop 1; length 3, drop 5, total 4 | 3..4   | 3        |
| 5       | 2     | 6     |                                             | 3..5   | 3        |

The answer is 3. Both ends only ever move forward. `right` visits each of the n positions once, and `left` can't pass `right`, so it moves at most n steps over the whole scan. That's at most 2n moves in total, even though a `while` loop sits inside a `for`: every step the inner loop takes is one `left` never takes again.

Why does shrinking from the left never miss an answer? Because the values are non-negative, so a longer run never has a smaller sum. Once the run from `left` to `right` reaches 9, every other run from `left` that reaches it ends later, so it is longer and can't win. Nothing is lost by moving `left` on. This one-way property is the rule behind the whole pattern: grow while the condition is unmet, shrink while it's met, and it works whenever the condition only ever moves in one direction as the window grows.

The third question swaps the running sum for a map. What's the longest run holding at most 2 different values? Each step adds the value at `right` to a map of counts; if the map now has 3 keys, drop values from the left until it has 2. On our array the answer is 3, from `1, 5, 1`. The shape is the same, with a different thing kept up to date.

## When to use it

- The problem is about a contiguous run, a subarray or substring, and not elements picked from anywhere.
- It asks for the longest, shortest or best such run, or a count of them: "largest sum of `k` in a row", "longest without repeats", "shortest that reaches a target".
- The condition holds or fails monotonically as the run grows: adding to a run can only push it one way. At-most-`k` distinct values, no repeats and a sum of positives at least a target all qualify.
- Brute force is "try every start and end", and the answer for one run is cheap to update from its neighbor's.

## Walkthrough

```python
def max_window_sum(nums: list[int], k: int) -> int | None:
    """Largest sum of k consecutive values, or None if nums has fewer than k."""
    if k < 1:
        raise ValueError("k must be at least 1")
    if k > len(nums):
        return None
    window = sum(nums[:k])
    # Start from the first window, not 0: all-negative input has a negative best.
    best = window
    for right in range(k, len(nums)):
        # The value leaving is k behind right; right - k + 1 is still inside.
        window += nums[right] - nums[right - k]
        best = max(best, window)
    return best
```

```typescript
/** Largest sum of `k` consecutive values, or null if `nums` is shorter. */
export function maxWindowSum(nums: number[], k: number): number | null {
  if (!Number.isInteger(k) || k < 1) throw new RangeError('k must be at least 1');
  if (k > nums.length) return null;
  let window = 0;
  for (let i = 0; i < k; i++) window += nums[i];
  // Start from the first window, not 0: all-negative input has a negative best.
  let best = window;
  for (let right = k; right < nums.length; right++) {
    // The value leaving is k behind right; right - k + 1 is still inside.
    window += nums[right] - nums[right - k];
    best = Math.max(best, window);
  }
  return best;
}
```

Prefix sums could answer this too, but with O(n) extra space; the window needs none.

```python
def shortest_run_at_least(nums: list[int], target: int) -> int:
    """Length of the shortest run summing to >= target, or 0 if none.

    Needs non-negative values, so growing a run never lowers its sum.
    """
    if target < 1:
        raise ValueError("target must be at least 1")
    shortest = len(nums) + 1  # longer than any run; 0 here would win every min
    total = left = 0
    for right in range(len(nums)):
        total += nums[right]
        # while, not if: after one drop the run may still reach the target,
        # and a shorter run would be missed.
        while total >= target:
            shortest = min(shortest, right - left + 1)
            total -= nums[left]
            left += 1
    return shortest if shortest <= len(nums) else 0
```

```typescript
/**
 * Length of the shortest run summing to >= target, or 0 if none.
 * Needs non-negative values, so growing a run never lowers its sum.
 */
export function shortestRunAtLeast(nums: number[], target: number): number {
  if (!Number.isInteger(target) || target < 1) {
    throw new RangeError('target must be at least 1');
  }
  let shortest = nums.length + 1; // longer than any run; 0 here would win every min
  let total = 0;
  let left = 0;
  for (let right = 0; right < nums.length; right++) {
    total += nums[right];
    // while, not if: after one drop the run may still reach the target,
    // and a shorter run would be missed.
    while (total >= target) {
      shortest = Math.min(shortest, right - left + 1);
      total -= nums[left];
      left++;
    }
  }
  return shortest <= nums.length ? shortest : 0;
}
```

The `target < 1` guard keeps the loop honest: with a target of 0, an empty window would already qualify and `left` would run past `right`. Recording the length happens inside the loop, before each drop, because the window is valid exactly then. At `right = 4` the loop runs twice, finding length 4 and then length 3; an `if` stops after the first and returns 4. The last function keeps counts instead of a sum.

```python
def longest_with_k_distinct(nums: list[int], k: int) -> int:
    """Length of the longest run holding at most k different values."""
    if k < 1:
        raise ValueError("k must be at least 1")
    counts: dict[int, int] = {}
    left = best = 0
    for right in range(len(nums)):
        value = nums[right]
        counts[value] = counts.get(value, 0) + 1
        while len(counts) > k:
            gone = nums[left]
            counts[gone] -= 1
            if counts[gone] == 0:
                del counts[gone]  # a key left at 0 still counts as distinct
            left += 1
        best = max(best, right - left + 1)
    return best
```

```typescript
/** Length of the longest run holding at most `k` different values. */
export function longestWithKDistinct(nums: number[], k: number): number {
  if (!Number.isInteger(k) || k < 1) throw new RangeError('k must be at least 1');
  const counts = new Map<number, number>();
  let left = 0;
  let best = 0;
  for (let right = 0; right < nums.length; right++) {
    const value = nums[right];
    counts.set(value, (counts.get(value) ?? 0) + 1);
    while (counts.size > k) {
      const gone = nums[left];
      const remaining = counts.get(gone)! - 1;
      // A key left at 0 would still count as distinct.
      if (remaining === 0) counts.delete(gone);
      else counts.set(gone, remaining);
      left++;
    }
    best = Math.max(best, right - left + 1);
  }
  return best;
}
```

Here the window is checked after growing, so it's repaired and then measured, and `best` takes the length of a valid window. At `right = 4` a third distinct value, 3, arrives; dropping the 1 at index 1 leaves the map at three keys, and only dropping the 5 as well, which removes its key, brings it back to 2.

## Complexity

All three take O(n) time. The brute force adds up every window separately, (n - k + 1) × k additions: about a billion for n = 1,000,000 and k = 1,000, against about a million here.
Space is O(1) for the two sums, and O(k) for the map, which holds at most k + 1 keys at its peak.

## Pitfalls

- **Dropping the wrong value from a fixed window.** The leaver is `nums[right - k]`. Writing `right - k + 1` removes a value still inside the window, and the sum drifts by one element per step, with plausible numbers and no error.
- **`if` instead of `while` when shrinking.** One drop may not repair the window, or may leave it still valid with a shorter answer ahead. On our array the `if` version of `shortest_run_at_least` returns 4, not 3.
- **Starting `best` or `shortest` at the wrong value.** `best = 0` fails on all-negative sums, and `shortest = 0` wins every `min`. Start from the first window, or from a length no run can reach.
- **Leaving a count at 0 in the map.** In `longest_with_k_distinct`, a key stuck at 0 still counts toward `len(counts)`, so the window shrinks too far, or the loop runs `left` off the end of the array (in TypeScript it loops forever). Delete the key when its count hits 0.
- **Using it when the condition isn't one-way.** With negative numbers, "the sum equals a target" can come true, then false, then true again as the window grows, so there's no telling which end to move. "Sum equals a target" is a job for [prefix sums](/dsa/prefix-sums) and a hash map; "shortest run reaching a target" needs prefix sums and a deque, as in [monotonic stack](/dsa/monotonic-stack).
