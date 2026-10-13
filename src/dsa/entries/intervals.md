---
title: Intervals
summary: Sorting [start, end] ranges so overlaps become neighbors, which turns merging, inserting and counting the busiest moment into one pass.
date: 2026-10-05
kind: pattern
---

An **interval** is a range written `[start, end]`: a meeting from 9 to 11, a
booking from day 3 to day 7. Problems that hand you a pile of them ask a few
questions again and again: which overlap, what do they cover once overlaps are
fused, and how many are active at once. Sorting makes all three a single pass.

## Prerequisites

- [Arrays and strings](/dsa/arrays-and-strings): the input is a list of pairs,
  and every function here sorts a list and walks it by index. Complexity uses
  big-O notation, defined there.

## The idea

Take five room bookings by day: `[8, 10]`, `[1, 3]`, `[2, 6]`, `[15, 18]` and `[6, 7]`.
Ends are **inclusive** here, so `[1, 3]` contains the points 1, 2 and 3, and
`[1, 3]` and `[3, 5]` overlap at 3. Two intervals `[a, b]` and `[c, d]`
overlap when `a <= d` and `c <= b`. Checking every pair is O(n²), and sorting
by start avoids most of it.

**Merging.** Sort by start: `[1, 3], [2, 6], [6, 7], [8, 10], [15, 18]`. Now
you only ever compare the next interval with the last merged one. If it starts
at or before that end, they overlap, so stretch the end. If it starts later,
it opens a new group. One comparison is enough because everything earlier
starts no later than the last group does, and anything that could reach past
its end has already been fused into it.

| Next     | Last merged | Overlap?     | Merged list after         |
| -------- | ----------- | ------------ | ------------------------- |
| [1, 3]   | none        |              | [1, 3]                    |
| [2, 6]   | [1, 3]      | 2 <= 3, yes  | [1, 6]                    |
| [6, 7]   | [1, 6]      | 6 <= 6, yes  | [1, 7]                    |
| [8, 10]  | [1, 7]      | 8 <= 7, no   | [1, 7], [8, 10]           |
| [15, 18] | [8, 10]     | 15 <= 10, no | [1, 7], [8, 10], [15, 18] |

`[6, 7]` merges because it touches `[2, 6]` at the point 6. `[8, 10]` starts
one past 7, shares no point, and stays apart.

**Inserting.** If the list is already merged and sorted, a new interval needs
no sort. Skip everything that ends before it starts, fuse everything that
starts at or before it ends, and copy the rest. Adding `[7, 9]` to the result above
fuses `[1, 7]` and `[8, 10]` into `[1, 10]`.

**Counting the busiest moment.** You want the fewest rooms that fit all five
bookings, which equals the most bookings sharing one day. Sort the starts and
the ends separately: starts `1, 2, 6, 8, 15`, ends `3, 6, 7, 10, 18`. At each
start, the bookings running are those started so far minus those already
ended. You never need to know which end belongs to
which start.

| Start | Ended before it | Started so far | Running |
| ----- | --------------- | -------------- | ------- |
| 1     | 0               | 1              | 1       |
| 2     | 0               | 2              | 2       |
| 6     | 1 (the 3)       | 3              | 2       |
| 8     | 3 (3, 6, 7)     | 4              | 1       |
| 15    | 4 (3, 6, 7, 10) | 5              | 1       |

Two rooms. Only starts need checking, because the count can only rise when a
booking begins. At start 6, the end 6 is not counted as finished: `[2, 6]`
still holds day 6, and `[6, 7]` begins there. Meetings by clock time are
usually half-open (one ending at 6 frees the room for one starting at 6),
which flips this comparison, as Pitfalls says.

Why not walk every integer point and count the intervals over it? That costs
the width of the range times n, and it breaks on huge or fractional
coordinates, while sorting doesn't care how big they are.

## When to use it

- The input is a list of ranges, and the question is about overlap, gaps,
  coverage or how many run at once.
- "Free time between meetings", "fewest rooms", "merge the calendar" and "does
  any booking clash" all fit. A gap is the space between two merged
  intervals.
- A single new range goes into a list that's already sorted: insert it in one
  pass without re-sorting.
- Points with a start and an end, such as "how many ranges cover this value",
  often turn into a sweep over sorted endpoints.

If you only check one new interval against a handful, compare it with each.
If the set changes between questions, keep a sorted structure keyed by start
instead of re-sorting each time.

## Walkthrough

```python region=merge-intervals

```

```typescript region=merge-intervals

```

On the five bookings it returns `[(1, 7), (8, 10), (15, 18)]`, the last row of
the first table. The sorted copy is why the caller's list keeps its order.
Counting is the same idea with the starts and ends pulled apart.

```python region=max-overlap

```

```typescript region=max-overlap

```

`i + 1` is the number started so far and `finished` the number ended, so the
difference is the second table's last column, and the maximum is 2. Because
`finished` only advances, the inner `while` costs n steps over the whole loop,
not n per start. Inserting skips the sort, because the list is already in
order.

```python region=insert-interval

```

```typescript region=insert-interval

```

Inserting `(7, 9)` into `[(1, 7), (8, 10), (15, 18)]` skips nothing, because
7 is not below 7. It fuses `(1, 7)` and `(8, 10)` into `(1, 10)`, stops at 15,
and copies `(15, 18)`. The grown interval is the loop's own `start` and `end`,
so the comparisons use the widened range.

## Complexity

Merging and counting are O(n log n), all of it the sort: Python's `sorted` is
O(n log n) in the worst case, and so is the sort in current JavaScript
engines. The passes after it are O(n). Extra space is O(n) for the merged
list or the two sorted endpoint lists. Inserting into a merged list is O(n)
time and space, with no sort.

## Pitfalls

- **Sorting numbers as text.** In TypeScript, `.sort()` with no comparator
  puts `[10, 12]` before `[2, 3]`, which breaks the one-comparison argument.
  The `(a, b) => a[0] - b[0]` in `mergeIntervals` fixes it.
- **The wrong comparison for the convention.** With inclusive ends, merging on
  `start <= merged[-1][1]` joins `[1, 3]` and `[3, 5]`, and `<` leaves them apart. With
  half-open ranges like `[1, 3)`, where the end is excluded, both flip: merge
  on `<`, and in the sweep let `<=` retire an end at the same coordinate.
- **Keeping the end of a nested interval.** Assigning `end` instead of
  `max(merged[-1][1], end)` shrinks `[1, 10]` plus `[2, 3]` to `[1, 3]`.
- **Pairing sorted starts with unsorted ends.** The sweep sorts the ends on
  their own. Reading each end at its start's original position pairs the wrong
  ones, and the count goes wrong with them.
