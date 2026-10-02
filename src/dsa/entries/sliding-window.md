---
title: Sliding Window
summary: Keeping a running answer for a contiguous stretch of an array or string and moving its two ends only forward, so every question about "the best run" is answered in one O(n) pass instead of rescanning each run.
date: 2026-10-01
kind: pattern
---

A **window** is a contiguous stretch of an array or string, described by two
indexes: `left`, the first position inside it, and `right`, the last. Sliding
a window means moving those indexes forward while keeping an answer for what is
currently inside, instead of recomputing that answer from scratch at every
position. Two shapes come up: a **fixed-size** window, which always holds the
same number of elements, and a **variable-size** window, which grows and
shrinks to satisfy a condition.

## Prerequisites

- [Two Pointers](/dsa/two-pointers): the window is two indexes that only move
  forward, the same-direction shape of that entry, with the rule for which one
  to move changed.
- [Hash Map](/dsa/hash-map): the variable window keeps a map from each
  character to how many times it appears inside the window. That entry also
  explains the big-O notation (O(1), O(n)) used here.

## The idea

**Fixed size.** Take `nums = [2, 1, 5, 1, 3, 2]` and ask for the largest sum
of any 3 consecutive values. The slow way adds up every group of three from
scratch: 4 groups, 3 additions each. But two neighbouring groups share all but
one value. Moving the window one step right drops the value that leaves on the
left and adds the value that enters on the right, so the new sum is the old sum
plus one value minus another, a single step whatever the window size.

| `right` | Value in | Value out | Window sum | Window       |
| ------- | -------- | --------- | ---------- | ------------ |
| 2       | (start)  | (start)   | 2+1+5 = 8  | indexes 0..2 |
| 3       | 1        | 2         | 8+1-2 = 7  | indexes 1..3 |
| 4       | 3        | 1         | 7+3-1 = 9  | indexes 2..4 |
| 5       | 2        | 5         | 9+2-5 = 6  | indexes 3..5 |

The largest sum is 9, from `5, 1, 3`. The value leaving is always the one `k`
positions behind `right`, which is why only `right` needs to be a loop
variable.

**Variable size.** Find the length of the longest stretch of a string with no
repeated character. For `"pwwkew"` the answer is 3, from `"wke"`. The window
can't have a fixed size here; the question is how large it can get while still
satisfying the condition "every character appears once". The scan moves `right`
one step at a time, adding the new character. If that character is now in the
window twice, the window is invalid, so `left` moves forward, dropping
characters, until the duplicate is gone:

| `right` | Char | What happens                    | Window (`left`..`right`) | Length |
| ------- | ---- | ------------------------------- | ------------------------ | ------ |
| 0       | p    | no duplicate                    | 0..0 `p`                 | 1      |
| 1       | w    | no duplicate                    | 0..1 `pw`                | 2      |
| 2       | w    | second w; drop p, then drop w   | 2..2 `w`                 | 1      |
| 3       | k    | no duplicate                    | 2..3 `wk`                | 2      |
| 4       | e    | no duplicate                    | 2..4 `wke`               | 3      |
| 5       | w    | second w; drop the w at index 2 | 3..5 `kew`               | 3      |

The best length seen is 3.

**Why it's one pass.** In both shapes `left` and `right` only ever move
forward, never back. `right` takes each of the n positions once, and `left`,
which can never pass `right`, also moves at most n steps over the whole scan.
That is at most 2n moves in total, however often the inner `while` loop runs,
because every step it takes is one `left` can never take again.

## When to use it

The problem asks about a contiguous run (a subarray or a substring), not a
selection of elements scattered across the input. Typical phrasings: the
largest sum of `k` consecutive values, the longest run satisfying a rule, the
shortest run that reaches a target.

For a fixed size the window is always valid, so nothing else is needed. For a
variable size there is a second requirement: the condition must stay broken or
stay fixed in one direction. In the unique-characters problem, once a window
contains a duplicate, making it bigger can't remove the duplicate, and making
it smaller from the left can. That one-way behaviour is what lets `left` move
forward and never reconsider a position it passed. "Find the shortest run of
positive numbers whose sum is at least a target" has it, since adding a
positive number only raises the sum.

It fails when the condition isn't one-way. With negative numbers, "the sum
equals a target" can become true, then false, then true again as the window
grows, so no rule says which end to move. Those problems are usually handled
with [Prefix Sums](/dsa/prefix-sums) and a hash map instead.

## Walkthrough

```python
def max_window_sum(nums: list[int], k: int) -> int | None:
    """Largest sum of k consecutive values in nums, or None if nums has fewer than k."""
    if k < 1:
        raise ValueError("k must be at least 1")
    if k > len(nums):
        return None
    window = sum(nums[:k])
    best = window
```

```typescript
/** Largest sum of `k` consecutive values in `nums`, or null if `nums` is shorter. */
export function maxWindowSum(nums: number[], k: number): number | null {
  if (!Number.isInteger(k) || k < 1) throw new RangeError('k must be at least 1');
  if (k > nums.length) return null;
  let window = 0;
  for (let i = 0; i < k; i++) window += nums[i];
  let best = window;
```

The first window is the only one summed by brute force, and it's also the
first candidate for the answer, so `best` starts there rather than at 0. A
starting value of 0 would be wrong for an array of negative numbers, where the
true answer is below zero. The two guards give the two bad inputs different
answers on purpose. A `k` below 1 is a mistake by the caller, so it raises an
error. An array shorter than `k` is a legitimate question with no answer, so it
returns `None` (`null` in TypeScript). Without the second guard the answer
would be wrong in a different way per language: Python would quietly sum a
short first window, and TypeScript would add `undefined` and return `NaN`.

```python
    for right in range(k, len(nums)):
        window += nums[right] - nums[right - k]
        best = max(best, window)
    return best
```

```typescript
  for (let right = k; right < nums.length; right++) {
    window += nums[right] - nums[right - k];
    best = Math.max(best, window);
  }
  return best;
}
```

The loop starts at `k`, the first index not yet inside the window. When
`right` is 4 with `k = 3`, the window before the step was indexes 1..3 and the
one after is 2..4, so the value that leaves is index 1, which is `right - k`.
Writing `right - k + 1` instead removes a value that is still inside the new
window, and the sum drifts off by one element on every step.

```python
def longest_unique_substring(text: str) -> int:
    """Length, in code points, of the longest run of text with no repeated character."""
    counts: dict[str, int] = {}
    left = 0
    best = 0
```

```typescript
/** Length, in code points, of the longest run of `text` with no repeated character. */
export function longestUniqueSubstring(text: string): number {
  const chars = Array.from(text);
  const counts = new Map<string, number>();
  let left = 0;
  let best = 0;
```

The map counts how many times each character appears between `left` and
`right`. Keys whose count drops to 0 stay in it, so it ends up holding every
character seen so far, which is still at most one per distinct character.
Python's `for` over a string already yields whole characters, called code
points, one per Unicode character. A JavaScript string
is stored as 16-bit units, and many emoji take two of them, so indexing it
directly would split one emoji into two meaningless halves. Worse, two
different emoji such as 😀 and 😁 start with the same unit, and would count as
a repeat. `Array.from(text)` splits by code point, so the TypeScript version
sees the same characters the Python one does. One thing it doesn't do is join a
base emoji with a skin-tone modifier: 👍🏽 is two code points, and counts as 2.

```python
    for right, char in enumerate(text):
        counts[char] = counts.get(char, 0) + 1
        while counts[char] > 1:
            counts[text[left]] -= 1
            left += 1
        best = max(best, right - left + 1)
    return best
```

```typescript
  for (let right = 0; right < chars.length; right++) {
    const char = chars[right];
    counts.set(char, (counts.get(char) ?? 0) + 1);
    while (counts.get(char)! > 1) {
      counts.set(chars[left], counts.get(chars[left])! - 1);
      left++;
    }
    best = Math.max(best, right - left + 1);
  }
  return best;
}
```

Each step adds the character at `right` to the counts, then repairs the window
if that broke it. The repair is a `while`, not an `if`, because one dropped
character may not be enough: in `"pwwkew"` at `right = 2`, the first drop
removes `p`, which doesn't touch the duplicate `w`, and only the second drop
removes the first `w`. With an `if`, `"pwwkew"` and `"abba"` give wrong
lengths. The loop condition looks only at `counts[char]`, the character just added, because
the window was valid before this step and the new character is the only thing
that can have broken it. After the repair, `right - left + 1` is the size of a
valid window ending at `right`, since both ends are included, and `best` keeps
the largest.

## Complexity

`max_window_sum` takes O(n) time: the first window costs k additions and each of
the n - k later steps costs one subtraction and one addition, so about n
operations in all, and it uses O(1) extra space. The brute force adds up every
window separately, (n - k + 1) × k additions, which for n = 1,000,000 and
k = 1,000 is about a billion. The sliding version does about a million.

`longest_unique_substring` takes O(n) time: `right` moves n times, and the
inner `while` loop runs in total at most n times across the whole scan, since
`left` only moves forward and can't pass `right`. Map operations are O(1) on
average (see [Hash Map](/dsa/hash-map)). Space is O(min(n, a)), where a is the
number of distinct characters possible: the map keeps a key for every
character seen so far, and there can't be more of those than there are
positions in the text or distinct characters that exist.
Checking every substring directly is O(n²) substrings, each needing its own
duplicate check.

## Pitfalls

- **Dropping the wrong value from a fixed window.** The value leaving is
  `nums[right - k]`. An off-by-one here still produces plausible numbers, so
  check a small case by hand, like the table above.
- **`if` instead of `while` when shrinking.** One drop may not restore the
  window, as the `"pwwkew"` walkthrough shows. Shrinking until the condition
  holds needs a loop.
- **Starting `best` at 0 for sums.** All-negative input has a negative answer.
  Start from the first window's value, or from negative infinity.
- **Reading the input by UTF-16 units in JavaScript or TypeScript.** `text[i]`
  and `text.length` count 16-bit units, so emoji and rarer characters are split
  or double-counted. Convert with `Array.from(text)` first, and expect a
  character built from several code points (an emoji with a skin tone) to count
  as several.
- **Applying it when the condition isn't one-way.** If growing the window can
  both fix and break the condition, as with a sum target over numbers that can
  be negative, moving `left` forward can skip the answer. Use prefix sums
  instead.
- **Forgetting the empty and too-short inputs.** An empty string has a longest
  run of 0, and an array shorter than `k` has no window at all. Both need an
  explicit answer rather than reading past the end.
