---
title: Two Pointers
summary: Walking two indices through a sorted array so that every step rules out one element for good, turning pair searches from O(n²) into one O(n) pass with no extra memory.
date: 2026-09-30
kind: pattern
---

Two pointers is a way of scanning an array with two indices at the same time
instead of one. Each index is called a **pointer** here, though it's only an
integer position in the array, not a memory address. The pattern works when a
simple rule tells you, at every step, which pointer to move, and moving it
provably can't skip the answer. It turns many problems that look like they
need a loop inside a loop into a single pass.

## Prerequisites

- [Hash map](/dsa/hash-map): the Complexity section compares this pattern with
  the hash-map solution to the same problem, which is just as fast but needs
  extra memory. That entry also explains the big-O notation (O(1), O(n)) used
  here.

## The idea

There are two common shapes.

**Opposite ends.** One pointer starts at the first element, the other at the
last, and they move toward each other until they meet. The standard example is
the pair-sum problem: given an array sorted in ascending order (each element
at least as large as the one before it) and a target number, find two elements
that add up to the target. Take `nums = [1, 3, 4, 6, 8, 11]` and a target of
10:

| Step | `left` | `right` | Sum         | Move                       |
| ---- | ------ | ------- | ----------- | -------------------------- |
| 1    | 0      | 5       | 1 + 11 = 12 | too big: move `right` down |
| 2    | 0      | 4       | 1 + 8 = 9   | too small: move `left` up  |
| 3    | 1      | 4       | 3 + 8 = 11  | too big: move `right` down |
| 4    | 1      | 3       | 3 + 6 = 9   | too small: move `left` up  |
| 5    | 2      | 3       | 4 + 6 = 10  | found: indices 2 and 3     |

Why is it safe to throw an element away? In step 1, 1 + 11 is too big. Every
other element is at most 11, since the array is sorted, but 11 is too big even
paired with the smallest element there is. So 11 can't be part of any answer,
and `right` moves past it. In step 2, 1 + 8 is too small, and 8 is the largest
element still in play, so 1 is too small to pair with anything left and
`left` moves past it. Each comparison rules out one element for good, which is
why one pass is enough.

**Same direction.** Both pointers start at the front and move the same way,
one ahead of the other. The classic example removes duplicates from a sorted
array **in place**, meaning it rearranges the array it was given instead of
building a new one. A `read` pointer visits every element; a `write` pointer
marks where the next value worth keeping goes. For `[1, 1, 2, 3, 3]`, `read`
skips the second 1 and the second 3, `write` collects 1, 2 and 3 at the front,
and the function returns 3, the number of unique values.

## When to use it

The strongest signal is a sorted array (or one you can afford to sort) and a
question about pairs: two values with a given sum or difference, or the pair
closest to a target. Triplets reduce to pairs: to find three numbers that add
to zero, sort the array, fix each element in turn and run the opposite-ends
search on the elements after it, which is O(n²) instead of the O(n³) of trying
every triple. Opposite ends also fits any check that compares an array or
string from both ends, like testing whether a string is a palindrome or
reversing an array in place.

The same-direction shape fits "in place" and "O(1) extra space" in a problem
statement: removing duplicates or a given value, moving all zeros to the end,
or merging two sorted arrays with one pointer in each. A close relative runs
two pointers at different speeds through a linked list (a chain of nodes, each
holding a link to the next) to find its middle or detect a cycle.

When the input is unsorted and you need the original positions, a
[hash map](/dsa/hash-map) of values already seen usually beats sorting first.

## Walkthrough

```python
def pair_with_sum(nums: list[int], target: int) -> tuple[int, int] | None:
    """Indices (i, j), i < j, of two values in sorted nums that add up to target."""
    left, right = 0, len(nums) - 1
```

```typescript
/** Indices [i, j], i < j, of two values in sorted `nums` that add up to `target`. */
export function pairWithSum(nums: number[], target: number): [number, number] | null {
  let left = 0;
  let right = nums.length - 1;
```

The function returns the two indices rather than the two values, because a
caller who has the indices can always read the values but not the other way
round, and returns `None` (`null` in TypeScript) when no pair exists. The
pointers start at the two ends. For an empty array `right` starts at -1, which
is fine: the loop condition on the next line is false straight away.

```python
    while left < right:
        total = nums[left] + nums[right]
        if total == target:
            return left, right
```

```typescript
  while (left < right) {
    const total = nums[left] + nums[right];
    if (total === target) return [left, right];
```

The loop runs while the pointers are on two different elements. The
comparison is a strict `<`: when `left` equals `right` both point at the same
element, and adding an element to itself isn't a pair. With `[3]` and a target
of 6, `<=` would return `(0, 0)`. A match returns straight away, with
`left < right` guaranteed by the loop condition.

```python
        if total < target:
            left += 1
        else:
            right -= 1
    return None
```

```typescript
    if (total < target) {
      left++;
    } else {
      right--;
    }
  }
  return null;
}
```

A sum that's too small can only grow by moving `left` up to a larger value; a
sum that's too big can only shrink by moving `right` down. The `else` covers
exactly the too-big case, since equality returned above. If the pointers meet
without a match, the argument in "The idea" says no pair was skipped, so there
is no pair.

```python
def dedupe_sorted(nums: list[int]) -> int:
    """Dedupe sorted nums in place; return k, the count of unique values in nums[:k]."""
    if not nums:
        return 0
    write = 1
```

```typescript
/** Dedupes sorted `nums` in place; returns k, the count of unique values now first. */
export function dedupeSorted(nums: number[]): number {
  if (nums.length === 0) return 0;
  let write = 1;
```

Now the same-direction shape. The first element is always kept, since nothing
comes before it to duplicate, so `write` starts at 1: position 0 is already
done. That start needs the guard above it. Without it, an empty array would
report one unique value.

```python
    for read in range(1, len(nums)):
        if nums[read] != nums[write - 1]:
            nums[write] = nums[read]
            write += 1
    return write
```

```typescript
  for (let read = 1; read < nums.length; read++) {
    if (nums[read] !== nums[write - 1]) {
      nums[write] = nums[read];
      write++;
    }
  }
  return write;
}
```

The rule that holds on every pass is that `nums[:write]` (the first `write`
elements) holds the unique values seen so far, in order. Because the array is
sorted, equal values sit next to each other, so a new value only has to be
compared with the last one kept, `nums[write - 1]`, not with everything kept
so far. A new value is copied to position `write` and `write` moves up. Since
`write` never passes `read`, the copy only overwrites a slot that has already
been read. The return value `write` is the count of unique values.

## Complexity

`pair_with_sum` runs in O(n) time: each pass through the loop either returns
or moves one pointer one step inward, and the pointers start n - 1 steps apart,
so there are at most n - 1 passes. It uses O(1) extra space, just the two
indices and a sum. `dedupe_sorted` reads each element once, O(n) time, and also
uses O(1) extra space.

Compare the other ways to solve pair-sum. Trying every pair is O(n²): n(n - 1)
/ 2 pairs, about 500,000 for 1,000 elements. A single pass that stores each
value in a hash map and checks whether `target - value` is already there is
O(n) time, like two pointers, but O(n) extra space, and it works on unsorted
input. If the input isn't sorted, two pointers needs a sort first, which costs
O(n log n) and moves the elements away from their original indices.

## Pitfalls

- **Unsorted input.** The argument for discarding an element relies on the
  order. On `[3, 1, 2]` with a target of 3, the scan compares 3 + 2, then
  3 + 1, and stops with no answer, although 1 + 2 = 3.
- **`<=` in the loop condition** lets both pointers land on the same element
  and pair it with itself, as described in the walkthrough.
- **Not moving a pointer after a match.** To collect every pair instead of the
  first, record the match and move both pointers inward (skipping repeated
  values, if each pair of values should appear once). Recording it and moving
  neither loops forever.
- **Expecting a clean array after deduplication.** Only the first `k`
  positions are meaningful: `[1, 1, 2]` becomes `[1, 2, 2]` with `k = 2`. If
  the list itself should shrink, cut it afterwards (`del nums[k:]` in Python,
  `nums.length = k` in TypeScript).
- **Overflow in fixed-width languages.** In Java, C or C++, the sum
  `nums[left] + nums[right]` can exceed the largest 32-bit integer when the
  values are large.
  Python's integers never overflow. JavaScript's numbers hold integers exactly
  up to 2^53, so the TypeScript version is exact for any values below 2^52.
