---
title: Monotonic Stack
summary: A stack of indices kept in sorted order, so each element is pushed once and popped once and "what is the next larger value to my right?" is answered for every position in one O(n) pass.
date: 2026-10-01
kind: pattern
---

A monotonic stack is an ordinary stack with one rule: before you push a new
item, you pop every item that would break the order you want the stack to have.
"Monotonic" means the stack only ever goes one way, here from larger at the
bottom to smaller at the top. The pattern answers questions of the form "for
each position, where is the nearest element to its right that is bigger?" in a
single pass, where the obvious approach is a loop inside a loop.

## Prerequisites

- [Stack](/dsa/stack): the push, pop and peek (look at the top without removing
  it) operations used throughout. Everything else is defined below, including
  the big-O notation (O(1), O(n)) in the Complexity section.

## The idea

Take the **next greater element** problem. Given a list of numbers, for each
position `i` find the index of the first value to its right that is strictly
larger than `nums[i]`, or `-1` if there is none. For `[2, 1, 2, 4, 3]` the
answer is `[3, 2, 3, -1, -1]`: the first 2 is beaten by the 4 at index 3, the 1
by the 2 at index 2, and nothing beats the 4 or the 3.

The brute-force answer scans right from every position until it finds a larger
value, which is O(n²) on input like `[5, 4, 3, 2, 1]` where nothing is ever
found. The stack removes the repeated scanning. Walk through the list once,
left to right, and keep a stack of the positions that are still **waiting**:
they have not yet met a larger value. When a new value arrives, it is the
answer for every waiting position whose value is smaller than it. Those
positions are on top of the stack, so you pop them, record the new position as
their answer, and then push the new position, which is itself now waiting.

Three decisions make this work.

**The stack holds indices, not values.** The answer for a position is another
position, so the stack must remember where each waiting value was. Given an
index you can always read the value with `nums[index]`, but given only a value
you cannot recover the index, because values repeat. The days-until-warmer
variant below also needs the distance `j - i`, which only indices give you.

**The values on the stack never increase from bottom to top.** Before a new
value `x` is pushed, everything smaller than `x` has been popped, so whatever
remains underneath is at least `x`. The stack is therefore sorted, largest at
the bottom, and the smallest waiting value is always on top. That order is why
the pops stop early: the first stack entry that is not smaller than `x` is
followed, underneath, only by entries at least as large, so none of them can
be answered by `x` either.

**Equal values.** This entry asks for a _strictly_ larger value, so a value
equal to the new one is not answered by it and stays on the stack. That means
the stack is non-increasing, not strictly decreasing: two equal values can sit
next to each other. The pop condition is `<`, not `<=`. If you want the next
greater _or equal_ element instead, `<=` is the right test.

Here is `[73, 74, 75, 71, 69, 72, 76, 73]` (daily temperatures), with the stack
shown as indices, bottom first. A day's answer is filled in when it is popped.

| `i` | Value | Pops (index, answer set to `i`) | Stack after pushing `i` |
| --- | ----- | ------------------------------- | ----------------------- |
| 0   | 73    | none                            | `[0]`                   |
| 1   | 74    | 0                               | `[1]`                   |
| 2   | 75    | 1                               | `[2]`                   |
| 3   | 71    | none (75 is not below 71)       | `[2, 3]`                |
| 4   | 69    | none (71 is not below 69)       | `[2, 3, 4]`             |
| 5   | 72    | 4, then 3                       | `[2, 5]`                |
| 6   | 76    | 5, then 2                       | `[6]`                   |
| 7   | 73    | none (76 is not below 73)       | `[6, 7]`                |

Indices 6 and 7 are still on the stack when the list ends, so nothing larger
came after them and they keep `-1`. The result is `[1, 2, 6, 5, 5, 6, -1, -1]`.
Subtracting each index from its answer gives the days to wait,
`[1, 1, 4, 2, 1, 1, 0, 0]`: day 2 (75) waits until day 6 (76), which is
6 - 2 = 4 days.

## When to use it

The signal is a question about the **nearest** element on one side that is
larger or smaller than the current one. The same loop, scanned from the right
or with the comparison flipped, gives the next smaller element, the previous
greater element and the previous smaller element. Typical problems are
days until a warmer temperature, the stock span (how many consecutive days,
counting today and going back, had a price no higher than today's, so the
first day's span is 1), the largest rectangle in a histogram (the nearest
shorter bar on each side bounds how wide a bar can stretch), and the maximum in
every window of fixed size, which uses the same idea with a deque.

If you need the nearest match for one query only, a plain scan is enough. If
the question is about the nearest element with a given _value_ instead of a
greater one, a [hash map](/dsa/hash-map) of last positions fits better.

## Walkthrough

```python
def next_greater(nums: list[int]) -> list[int]:
    """For each i, the index of the first value to its right that is larger, or -1."""
    answer = [-1] * len(nums)
    stack: list[int] = []  # indices of values still waiting for a larger one
```

```typescript
/** For each i, the index of the first value to its right that is larger, or -1. */
export function nextGreater(nums: number[]): number[] {
  const answer: number[] = new Array(nums.length).fill(-1);
  const stack: number[] = []; // indices of values still waiting for a larger one
```

`answer` starts as all `-1`, and the code only overwrites a slot when it finds
the value that beats it. Whatever is left on the stack when the loop ends needs
no cleanup pass, because those positions already hold the right answer. An
empty input gives an empty `answer`, and the loop below never runs.

```python
    for i, value in enumerate(nums):
        while stack and nums[stack[-1]] < value:
            answer[stack.pop()] = i
```

```typescript
  for (let i = 0; i < nums.length; i++) {
    while (stack.length > 0 && nums[stack[stack.length - 1]] < nums[i]) {
      answer[stack.pop()!] = i;
    }
```

The `while` is a loop, not an `if`, because one new value can answer several
waiting positions at once: 72 in the table popped both 4 and 3. With an `if`,
only the top would be popped and 3 would wrongly stay on the stack until some
later, larger value. The comparison is strict. With `<=`, an input like
`[2, 2, 3]` would pop the first 2 as soon as the second 2 arrives and report
that its next greater element is at index 1, a value that is equal, not larger.
The `stack and` check (`stack.length > 0` in TypeScript) guards the peek:
with an empty stack there is no top to read. In TypeScript, the `!` after `pop()`
tells the compiler the stack is not empty here, which the loop condition has
just checked.

```python
        stack.append(i)
    return answer
```

```typescript
    stack.push(i);
  }
  return answer;
}
```

The new index is always pushed, even if it just popped others, because its own
answer is still unknown. Every index goes on exactly once. Pushing after the
pops is also what keeps the stack ordered: everything left underneath is at
least as large as `value`.

```python
def days_until_warmer(temps: list[int]) -> list[int]:
    """For each day, how many days until a strictly warmer one; 0 if never."""
    later = next_greater(temps)
    return [0 if j == -1 else j - i for i, j in enumerate(later)]
```

```typescript
/** For each day, how many days until a strictly warmer one; 0 if never. */
export function daysUntilWarmer(temps: number[]): number[] {
  return nextGreater(temps).map((j, i) => (j === -1 ? 0 : j - i));
}
```

The daily-temperatures question needs the gap between two days, not the day
itself, so it reuses `next_greater` and converts each index into a distance.
The `-1` check matters: without it, a day with no warmer day would report
`-1 - i`, a negative number, instead of 0. Keeping the stack of indices is what
made this a one-line wrapper. A stack of values could not produce the distance.

## Complexity

`next_greater` runs in O(n) time. The `while` inside the `for` looks like it
could make the work O(n²), but it can't: each index is pushed exactly once, in
`stack.append(i)`, and popped at most once, so across the whole scan there are
at most n pushes and n pops. The inner loop's total iterations over all values
of `i` is the number of pops, at most n, not n per value. For the 8 temperatures
above that is 8 pushes and 6 pops, and 2 indices left over. The extra space is
O(n): the `answer` list is n entries, and the stack reaches n entries in the
worst case, a strictly decreasing input like `[5, 4, 3, 2, 1]` where nothing is
ever popped. `days_until_warmer` adds another O(n) list and an O(n) pass, so it
is O(n) time and space as well.

Brute force is O(n²) time (for 1,000 elements, up to about 500,000 comparisons
against at most 2,000 stack operations) and O(1) extra space beyond the output.
The stack trades O(n) memory for the time.

## Pitfalls

- **Storing values instead of indices.** The code can't write the answer slot
  or compute the distance, and with duplicates there is no way to tell which
  occurrence a value was.
- **`<=` instead of `<`.** For strictly greater, an equal value is wrongly
  treated as larger: `[2, 2, 3]` returns `[1, 2, -1]` instead of `[2, 2, -1]`.
  Flip it deliberately for the greater-or-equal version, not by accident.
- **`if` instead of `while`.** Only one waiting position is resolved per new
  value, and later ones get answers that are too far away or missing.
- **Peeking an empty stack.** `nums[stack[-1]]` on an empty list raises
  `IndexError` in Python, and in TypeScript reads `stack[-1]` as `undefined`,
  giving a comparison with `nums[undefined]` that is silently false. Check that
  the stack is non-empty first.
- **Reusing the loop for "previous greater" unchanged.** This scan answers
  "next to the right", at the moment a position is popped. For the nearest
  greater element to the _left_, the answer for `i` is whatever is on top of
  the stack after the pops, read just before `i` is pushed, and the pop test
  must also pop equal values (`<=` instead of `<`). Kept as `<`, an equal
  value stays on the stack and is reported as greater: for `[2, 2]`, index 1
  would get 0 instead of -1.
- **Calling it O(n²) because of the nested loop.** Count pops, not loops: the
  total is bounded by the number of pushes.
