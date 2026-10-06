---
title: Monotonic Stack
summary: A stack that stays sorted because you pop whatever would break the order before each push, so every position's nearest larger or smaller neighbor falls out of one O(n) pass.
date: 2026-10-05
kind: pattern
template: 2
---

A monotonic stack is an ordinary stack with one rule: before you push, pop everything that would break the order you want. "Monotonic" means the stack only ever runs one way. Run it on the array `[2, 1, 2, 4, 3]` to find each value's next larger value, then flip the comparison to measure the biggest rectangle in a histogram.

## Prerequisites

- [Stacks and queues](/dsa/stacks-and-queues): push, pop and peek (read the top without removing it). The Complexity section uses big-O notation, defined in [Arrays and strings](/dsa/arrays-and-strings).

## The idea

The **next greater element** problem: for each position `i`, find the index of the first value to its right that is strictly larger than `nums[i]`, or `-1` if none is. For `[2, 1, 2, 4, 3]` the answer is `[3, 2, 3, -1, -1]`. The first 2 is beaten by the 4 at index 3, the 1 by the 2 at index 2, and nothing beats the 4 or the 3.

The obvious method scans right from every position until it finds something larger. On `[5, 4, 3, 2, 1]` nothing is ever found, so every scan runs to the end: about n²/2 comparisons, 499,500 for 1,000 numbers. The scan from the 5 already compared against the 4, 3, 2 and 1, and the scan from the 4 repeats most of that.

Instead, walk left to right once and keep the positions that are still **waiting**, meaning they haven't met a larger value yet. When a new value arrives, it is the answer for every waiting position whose value is smaller, and those sit on top of the stack. Pop them, record the new index as their answer, then push the new index, which is now waiting itself.

Why does the stack stay sorted without any sorting? A value is pushed only after everything smaller than it has been popped, so what's underneath is at least as large. The waiting values read non-increasing from bottom to top, with the smallest on top. So you can stop popping at the first entry that isn't smaller than the new value: everything below it is larger or equal. A min-heap of waiting values would work too, but costs O(log n) per operation, and the stack gets the same order for free.

Two choices matter. The stack holds **indices**, not values, because the answer is a position and values repeat. And the pop test is strict `<`, so an equal value keeps waiting; use `<=` to ask for "larger or equal".

Here is the run on `[2, 1, 2, 4, 3]`, with each stack shown bottom first:

| `i` | Value | Pops (index, its answer becomes `i`) | Stack after pushing |
| --- | ----- | ------------------------------------ | ------------------- |
| 0   | 2     | none                                 | `[0]`               |
| 1   | 1     | none (2 is not below 1)              | `[0, 1]`            |
| 2   | 2     | 1                                    | `[0, 2]`            |
| 3   | 4     | 2, then 0                            | `[3]`               |
| 4   | 3     | none (4 is not below 3)              | `[3, 4]`            |

Indices 3 and 4 are still waiting when the input ends, so they keep `-1`.

## When to use it

- The problem asks for the **nearest** element on one side that is larger or smaller than this one: next warmer day, previous lower price, next taller building.
- Each element owns a range that ends at its nearest smaller or larger neighbor, as in the largest rectangle in a histogram or the sum of subarray minimums.
- Flipping `<` to `>`, or scanning from the right, gives the next smaller, previous greater or previous smaller element.

If you need the nearest element with a given _value_ rather than a greater one, a [hash map](/dsa/hash-map) of last positions fits better.

## Walkthrough

```python
def next_greater(nums: list[int]) -> list[int]:
    """For each i, the index of the first larger value to its right, or -1."""
    answer = [-1] * len(nums)
    # Indices, not values: the answer is a position, and equal values repeat.
    stack: list[int] = []
    for i, value in enumerate(nums):
        # while, not if: one new value can answer several waiting positions.
        # <, not <=: an equal value isn't larger, so it keeps waiting.
        while stack and nums[stack[-1]] < value:
            answer[stack.pop()] = i
        stack.append(i)
    return answer
```

```typescript
/** For each i, the index of the first larger value to its right, or -1. */
export function nextGreater(nums: number[]): number[] {
  const answer: number[] = new Array(nums.length).fill(-1);
  // Indices, not values: the answer is a position, and equal values repeat.
  const stack: number[] = [];
  for (let i = 0; i < nums.length; i++) {
    // while, not if: one new value can answer several waiting positions.
    // <, not <=: an equal value isn't larger, so it keeps waiting.
    while (stack.length > 0 && nums[stack[stack.length - 1]] < nums[i]) {
      answer[stack.pop()!] = i;
    }
    stack.push(i);
  }
  return answer;
}
```

Positions left on the stack at the end keep their `-1`, so there's no cleanup pass. The next question is usually a distance.

```python
def days_until_warmer(temps: list[int]) -> list[int]:
    """For each day, how many days until a strictly warmer one; 0 if never."""
    # The -1 check matters: without it a day with no answer gets -1 - i.
    return [0 if j == -1 else j - i for i, j in enumerate(next_greater(temps))]
```

```typescript
/** For each day, how many days until a strictly warmer one; 0 if never. */
export function daysUntilWarmer(temps: number[]): number[] {
  // The -1 check matters: without it a day with no answer gets -1 - i.
  return nextGreater(temps).map((j, i) => (j === -1 ? 0 : j - i));
}
```

On the running example `[3, 2, 3, -1, -1]` becomes `[3, 1, 1, 0, 0]`. A stack of values couldn't have done this. Now a problem where the stack does more than find a neighbor.

Given bar heights, find the area of the largest rectangle that fits under the bars. Each bar can stretch left and right until a shorter bar blocks it, which is a next-smaller question, so the stack now holds bars in increasing height, and popping a bar is the moment you learn its right edge.

```python
def largest_rectangle(heights: list[int]) -> int:
    """Area of the biggest rectangle that fits under the bars of a histogram."""
    best = 0
    stack: list[int] = []  # indices of bars, heights strictly increasing
    # One extra step with height 0 pops every bar still waiting; without it
    # the bars left on the stack at the end are never measured.
    for i in range(len(heights) + 1):
        h = heights[i] if i < len(heights) else 0
```

```typescript
/** Area of the biggest rectangle that fits under the bars of a histogram. */
export function largestRectangle(heights: number[]): number {
  let best = 0;
  const stack: number[] = []; // indices of bars, heights strictly increasing
  // One extra step with height 0 pops every bar still waiting; without it
  // the bars left on the stack at the end are never measured.
  for (let i = 0; i <= heights.length; i++) {
    const h = i < heights.length ? heights[i] : 0;
```

A bar popped at step `i` was blocked by bar `i`, so its right edge is just before `i`; its left edge comes from the next entry down.

```python
        while stack and heights[stack[-1]] >= h:
            height = heights[stack.pop()]
            # The new top is the nearest shorter bar on the left, not the
            # popped index: bars between them were popped earlier, as taller.
            left = stack[-1] if stack else -1
            best = max(best, height * (i - left - 1))
        stack.append(i)
    return best
```

```typescript
    while (stack.length > 0 && heights[stack[stack.length - 1]] >= h) {
      const height = heights[stack.pop()!];
      // The new top is the nearest shorter bar on the left, not the
      // popped index: bars between them were popped earlier, as taller.
      const left = stack.length > 0 ? stack[stack.length - 1] : -1;
      best = Math.max(best, height * (i - left - 1));
    }
    stack.push(i);
  }
  return best;
}
```

Run it on `[2, 1, 2, 4, 3]`, where `-1` means no shorter bar to the left:

| `i` | Bar | Pops (height, left, width, area)    | Stack after pushing |
| --- | --- | ----------------------------------- | ------------------- |
| 0   | 2   | none                                | `[0]`               |
| 1   | 1   | 2, -1, 1, 2                         | `[1]`               |
| 2   | 2   | none                                | `[1, 2]`            |
| 3   | 4   | none                                | `[1, 2, 3]`         |
| 4   | 3   | 4, 2, 1, 4                          | `[1, 2, 4]`         |
| 5   | 0   | 3, 2, 2, 6; 2, 1, 3, 6; 1, -1, 5, 5 | `[5]`               |

The answer is 6: height 3 across the last two bars, tied with height 2 across the last three. The test is `>=`, so equal bars pop each other, which is harmless: the last bar of an equal run reaches back to the same left edge and measures the whole run.

## Complexity

All three functions are O(n) time. The `while` inside the `for` looks quadratic, but count operations instead of loops. Each index is pushed once and popped at most once, so the inner loop runs at most n times in total, not n times per value. On `[2, 1, 2, 4, 3]`, `next_greater` makes 5 pushes and 3 pops, with 2 indices left over; `largest_rectangle` pops all 5 bars. For 1,000 elements that is at most 2,000 pushes and pops, against 499,500 comparisons for brute force.

The extra space is O(n): the stack reaches n entries when nothing ever pops, as on the strictly decreasing `[5, 4, 3, 2, 1]` for `next_greater`. `days_until_warmer` adds one more O(n) list.

## Pitfalls

- **`<=` in `next_greater`.** An equal value is treated as larger, so `[2, 2, 3]` returns `[1, 2, -1]` instead of `[2, 2, -1]`: the first 2 reports the second 2 as its answer. Flip it deliberately for the "larger or equal" version, not by accident.
- **`if` instead of `while`.** One new value answers only the top waiting position. On `[2, 1, 2, 4, 3]` the 4 pops index 2 and leaves index 0 behind, so position 0 keeps `-1` instead of 3.
- **Dropping the sentinel in `largest_rectangle`.** Bars still on the stack at the end are never measured. The loop stops after popping the 2 and the 4, and returns 4, not 6.
- **Taking `left` from the popped bar.** Using the popped index instead of the new top ignores the taller bars between them, which were popped earlier. A rectangle can reach back over them, so the width comes out too small: `[2, 1, 2, 4, 3]` returns 4, not 6.
