---
title: Two Pointers
summary: Moving two positions through a sequence by a rule that retires something at every step, so a search that looks quadratic or memory-hungry becomes one pass in constant space.
date: 2026-10-05
kind: pattern
template: 2
---

Two pointers scans a sequence with two positions at once instead of one. A
**pointer** here is just an array index or a reference to a node, not a memory
address. You'll meet the two shapes the pattern comes in: pointers closing in
from both ends of a sorted array, and pointers chasing each other at different
speeds through a linked list.

## Prerequisites

- [Hash map](/dsa/hash-map): the alternative to compare against, since it
  solves both problems below at the price of O(n) memory, and big-O notation
  is defined in [Arrays and strings](/dsa/arrays-and-strings), which that entry
  builds on.
- [Linked list](/dsa/linked-list): the second shape follows `next` links from
  node to node.

## The idea

**Opposite ends.** Given a sorted array and a target, find two elements that
add up to it. Try every pair and you do about n²/2 sums. Instead, start one
pointer at each end and look at their sum. Run it on `[1, 3, 4, 6, 8, 11]` with
a target of 10:

| Step | `left` | `right` | Sum         | Move                       |
| ---- | ------ | ------- | ----------- | -------------------------- |
| 1    | 0      | 5       | 1 + 11 = 12 | too big: move `right` down |
| 2    | 0      | 4       | 1 + 8 = 9   | too small: move `left` up  |
| 3    | 1      | 4       | 3 + 8 = 11  | too big: move `right` down |
| 4    | 1      | 3       | 3 + 6 = 9   | too small: move `left` up  |
| 5    | 2      | 3       | 4 + 6 = 10  | found: indices 2 and 3     |

Why is it safe to throw an element away? In step 1, 11 is too big even beside
the smallest element there is, so no pair uses it. In step 2, 1 is too small
even beside the largest element still in play. Each comparison retires one
element for good, which is why one pass is enough. It only works because the
array is sorted, which is what lets a sum's size say which end to move.

**Same direction, at different speeds.** A linked list is a chain of nodes,
each holding a value and a link to the next, and its last link is empty. A
**cycle** is when some node links back to an earlier one, so a walk never ends.
To detect one without remembering visited nodes, move a slow pointer one node
per step and a fast pointer two. Take seven nodes, 0 to 6, where node 6 links
back to node 2: a tail of two nodes (0 and 1) leading into a cycle of five.

| Step | `slow` | `fast` | Links `fast` needs to land on `slow` |
| ---- | ------ | ------ | ------------------------------------ |
| 1    | 1      | 2      | (`slow` is still in the tail)        |
| 2    | 2      | 4      | 3                                    |
| 3    | 3      | 6      | 2                                    |
| 4    | 4      | 3      | 1                                    |
| 5    | 5      | 5      | 0: they meet                         |

Once `slow` is inside the cycle, `fast` is too, and the distance `fast` must
cover to reach `slow` falls by exactly one per step. A count that falls by one
can't jump from 1 to -1, so it hits 0: `fast` can't hop over `slow`. If the list
has no cycle, `fast` just runs off the end first.

Two relatives use the same idea. To find where the cycle starts, keep the
meeting node, restart a second pointer at the head and move both one node per
step. When they first met, `slow` had taken a multiple of the cycle's length
in steps, so walking the tail's length `t` more, possibly lapping the cycle,
lands on the start, exactly as the head pointer arrives. Here they land on node
2 after two steps. And a `write` pointer trailing a `read` pointer in one
direction removes duplicates from a sorted array in place.

## When to use it

- The input is sorted, or you can afford to sort it, and the question is about
  pairs: a given sum or difference, or the pair closest to a target. Triplets
  reduce to this: fix one element, then search the elements after it.
- The statement says "in place" or "O(1) extra space", as in removing
  duplicates, moving zeros to the end or merging two sorted arrays.
- Something is compared from both ends: a palindrome check, reversing in
  place, the container holding the most water.
- A linked list has no index, so you want its middle (when `fast` falls off the
  end, `slow` is halfway) or whether it loops. This also covers any sequence
  where each value is computed from the one before.
- The input is unsorted and you need original positions: use a
  [hash map](/dsa/hash-map) instead, since sorting loses them.

## Walkthrough

```python
def pair_with_sum(nums: list[int], target: int) -> tuple[int, int] | None:
    """Indices (i, j), i < j, of two values in sorted nums that add up to target."""
    left, right = 0, len(nums) - 1
    # < not <=: with equal pointers one element would be paired with itself.
    while left < right:
        total = nums[left] + nums[right]
        if total == target:
            return left, right
```

```typescript
/** Indices [i, j], i < j, of two values in sorted `nums` that add up to `target`. */
export function pairWithSum(nums: number[], target: number): [number, number] | null {
  let left = 0;
  let right = nums.length - 1;
  // < not <=: with equal pointers one element would be paired with itself.
  while (left < right) {
    const total = nums[left] + nums[right];
    if (total === target) return [left, right];
```

The function returns indices, not values, because a caller with the indices can
always read the values. An empty array starts `right` at -1, so the loop never
runs and the answer is "no pair", which is correct.

```python
        # Too small: nums[left] is too small even beside the largest value still
        # in play, so no pair uses it. Too big: nums[right] fails the same way
        # beside the smallest. Either move rules one element out for good.
        if total < target:
            left += 1
        else:
            right -= 1
    return None
```

```typescript
    // Too small: nums[left] is too small even beside the largest value still
    // in play, so no pair uses it. Too big: nums[right] fails the same way
    // beside the smallest. Either move rules one element out for good.
    if (total < target) left++;
    else right--;
  }
  return null;
}
```

On the running example this is the five-row table above, ending at `(2, 3)`.
The loop falls through to `None` only after the pointers meet, which by the
retiring argument means no pair existed. Now the other shape, which needs a
node type to walk.

```python
class ListNode:
    """One node of a singly linked list: a value and a link to the next node."""

    def __init__(self, val: int, next: "ListNode | None" = None) -> None:
        self.val = val
        self.next = next


def has_cycle(head: ListNode | None) -> bool:
    """True when following next from head never reaches the end."""
    slow = fast = head
    # Test fast and fast.next: fast.next.next reads the next of nothing when
    # an odd-length list leaves fast on its last node.
    while fast is not None and fast.next is not None:
```

```typescript
export class ListNode {
  val: number;
  next: ListNode | null;

  constructor(val: number, next: ListNode | null = null) {
    this.val = val;
    this.next = next;
  }
}

/** True when following next from head never reaches the end. */
export function hasCycle(head: ListNode | null): boolean {
  let slow = head;
  let fast = head;
  // Test fast and fast.next: fast.next.next reads the next of nothing when
  // an odd-length list leaves fast on its last node.
  while (fast !== null && fast.next !== null) {
```

An empty list and a single node never enter the loop, so both return `False`.
Inside it, `fast` takes its two hops and `slow` its one.

```python
        slow = slow.next
        fast = fast.next.next
        # After moving, not before: both start at head, so before always matches.
        # `is`, not ==: two different nodes can hold equal values.
        if slow is fast:
            return True
    return False
```

```typescript
    slow = slow!.next;
    fast = fast.next.next;
    // After moving, not before: both start at head, so before always matches.
    // === compares nodes, not values: two different nodes can hold equal values.
    if (slow === fast) return true;
  }
  return false;
}
```

On the seven-node list the loop returns `True` at step 5, the last row of the
second table. In TypeScript, `slow!` tells the compiler that `slow` isn't
`null`; it can't be, because `slow` trails `fast`, which was non-null a moment
ago.

## Complexity

`pair_with_sum` is O(n) time and O(1) space. Each pass either returns or moves
one pointer inward, and they start n - 1 apart, so there are at most n - 1
passes. Trying every pair costs n(n - 1)/2 sums, 499,500 for 1,000 elements. A
hash map is also O(n) time but holds up to n values, and it handles unsorted
input. Sorting first for two pointers costs O(n log n).

`has_cycle` is O(n) time and O(1) space. Without a cycle, `fast` reaches the
end in about n/2 passes. With one, `slow` enters the cycle after the tail's
length, `t` steps, with `fast` already inside. The gap to close is less than
the cycle's length `c` and shrinks by one per step, so they meet within
`t + c = n` steps: 5 for the 7-node example. A visited set is O(n) time too and
simpler to trust, but it stores up to n nodes.

## Pitfalls

- **`<=` in `while left < right`.** Both pointers can land on one element and
  pair it with itself: `[3]` with a target of 6 returns `(0, 0)`.
- **Unsorted input to `pair_with_sum`.** The `total < target` branch assumes the
  order. On `[3, 1, 2]` with a target of 3 it compares 3 + 2, then 3 + 1, and
  returns `None`, although 1 + 2 = 3.
- **Testing only `fast` in the loop condition.** A one-node list enters the
  loop and then reads `fast.next.next`, the `next` of nothing, which crashes in
  both languages.
- **Comparing values, or comparing before moving.** With `slow.val == fast.val`,
  the list `[5, 5, 5]` with no cycle reports one. With the check above the
  moves, both pointers are the head and every list looks cyclic.
