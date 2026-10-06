---
title: Intervals
summary: Treating ranges as [start, end] pairs and sorting them so overlaps become neighbours, which lets one pass merge them and one sweep over the endpoints find the busiest moment.
date: 2026-10-01
kind: pattern
---

An **interval** is a range written as a pair `[start, end]`: a meeting from 9
to 11, a booking from day 3 to day 7, a stretch of a number line. Problems that
hand you a pile of intervals tend to ask the same few questions: which of them
overlap, what do they add up to once overlaps are fused, and how many are
active at once. Sorting is the step that makes all of them tractable.

This entry uses **inclusive** ends over whole numbers: `[1, 3]` contains the
points 1, 2 and 3, so `[1, 3]` and `[3, 5]` overlap at 3 while `[1, 3]` and
`[4, 5]` do not overlap at all, even though nothing sits between them. The
alternative is a **half-open** interval, written `[1, 3)`, which contains its
start but not its end. Half-open ranges are common in code (Python's `range`
and slicing, `Array.prototype.slice` in JavaScript) and the section on pitfalls
says which comparisons flip for them.

## Prerequisites

- [Arrays and strings](/dsa/arrays-and-strings): the input is a list of
  intervals, and both algorithms sort a list and then walk it by index.

## The idea

Two intervals overlap when they share at least one point. For `[a, b]` and
`[c, d]` that holds when `a <= d` and `c <= b`: each one starts no later than
the other ends. Checking every pair of n intervals is O(n²). Sorting by start
removes most of that work.

**Merging.** Sort the intervals by their start. Now take them in order and keep
a list of merged results. The next interval either starts at or before the end
of the last merged interval, in which case it overlaps it and the merged
interval's end becomes the larger of the two ends, or it starts after that end,
in which case it begins a new merged interval. The reason one comparison with
the last result is enough: everything earlier in the sort order starts no later
than the last result does, and nothing earlier can reach past the last result's
end without already having been fused into it. Take
`[[8, 10], [1, 3], [2, 6], [15, 18], [6, 7]]`. Sorted by start it reads
`[1, 3], [2, 6], [6, 7], [8, 10], [15, 18]`:

| Next     | Last merged | Overlap?     | Merged list after         |
| -------- | ----------- | ------------ | ------------------------- |
| [1, 3]   | none        | n/a          | [1, 3]                    |
| [2, 6]   | [1, 3]      | 2 <= 3, yes  | [1, 6]                    |
| [6, 7]   | [1, 6]      | 6 <= 6, yes  | [1, 7]                    |
| [8, 10]  | [1, 7]      | 8 <= 7, no   | [1, 7], [8, 10]           |
| [15, 18] | [8, 10]     | 15 <= 10, no | [1, 7], [8, 10], [15, 18] |

The interval `[6, 7]` touches `[2, 6]` at the single point 6, so it merges.
`[8, 10]` starts one past where `[1, 7]` ends and shares no point with it, so
it stays separate.

**Counting the busiest moment.** Suppose the intervals are meetings and you
want the fewest rooms that fit them all, which equals the most meetings that
contain one common point. Sort all the starts into one list and all the ends
into another, separately; the pairing between a start and its end doesn't
matter for counting. Then sweep through the starts in order. At each start,
the number of meetings running is the number that have started so far (the
current index plus one) minus the number that have already ended. A meeting has
already ended if its end is strictly less than the current start. For the same
example the sorted starts are `1, 2, 6, 8, 15` and the sorted ends are
`3, 6, 7, 10, 18`:

| Start | Ended before it | Started so far | Running |
| ----- | --------------- | -------------- | ------- |
| 1     | 0               | 1              | 1       |
| 2     | 0               | 2              | 2       |
| 6     | 1 (the end 3)   | 3              | 2       |
| 8     | 3 (3, 6, 7)     | 4              | 1       |
| 15    | 4 (3, 6, 7, 10) | 5              | 1       |

The answer is 2. The count only needs checking at a start because it can only
go up when a meeting begins.

The strictly-less comparison is the tie rule. At start 6 the end 6 is not
counted as finished, because `[2, 6]` still contains the point 6 and `[6, 7]`
begins there, so both are running at once. With inclusive ends, a start at a
coordinate is processed before an end at the same coordinate. With half-open
intervals the rule is the opposite: `[2, 6)` stops before 6, so an end at 6
frees its room before a start at 6 takes it.

## When to use it

Reach for this pattern whenever the input is a list of ranges and the question
is about overlap: merging calendar blocks or covered number ranges, finding
free gaps between busy periods (the gaps are the spaces between merged
intervals), checking whether any two bookings clash, or counting simultaneous
meetings, connections or running tasks. Inserting a new interval into an
already merged and sorted list is the same one pass with no sort. Problems about
points on a line that carry a start and an end, such as "how many ranges cover
this value", often become sweeps too.

If the question is only whether a single new interval clashes with a handful of
existing ones, a plain check against each is simpler than sorting. If the
questions are repeated against a changing set, a sorted list or balanced tree
keyed by start answers them without a full re-sort each time.

## Walkthrough

```python
Interval = tuple[int, int]  # (start, end), both ends included


def merge_intervals(intervals: list[Interval]) -> list[Interval]:
    """Merge intervals that share at least one point; result sorted, disjoint."""
    merged: list[Interval] = []
```

```typescript
/** [start, end], both ends included. */
export type Interval = [number, number];

/** Merges intervals that share at least one point; the result is sorted and disjoint. */
export function mergeIntervals(intervals: Interval[]): Interval[] {
  const merged: Interval[] = [];
```

An interval is a two-element tuple in Python and a two-element array in
TypeScript, and the comment states the inclusive convention once, where the
reader first meets the type. Everything below depends on it: change it to
half-open and the comparisons in the next chunk change too. The function builds
a fresh `merged` list instead of rewriting the input, so the caller's list
keeps its original order.

```python
    for start, end in sorted(intervals):
        if merged and start <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], end))
        else:
            merged.append((start, end))
    return merged
```

```typescript
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  for (const [start, end] of sorted) {
    const last = merged[merged.length - 1];
    if (last !== undefined && start <= last[1]) {
      last[1] = Math.max(last[1], end);
    } else {
      merged.push([start, end]);
    }
  }
  return merged;
}
```

The sort is what makes the single comparison with `merged[-1]` valid. `sorted`
returns a new list ordered by start (and by end when two starts tie, since
tuples compare element by element), so the input stays as it was. In
TypeScript, `sort` rearranges the array it is called on, which is why the code
sorts a copy made with `[...intervals]`. It also needs the comparison function
`(a, b) => a[0] - b[0]`: without one, `sort` converts the elements to text and
compares those, so `[10, 12]` lands before `[2, 3]`. The test is `<=`, not
`<`, because with inclusive ends `[2, 6]` and `[6, 7]` share the point 6; `<`
would leave them as two intervals. The new end is `max(...)` and not simply
`end`, because a nested interval such as `[2, 3]` inside `[1, 10]` overlaps the
last merged interval yet ends earlier, and taking its end would shrink the
result to `[1, 3]`. In TypeScript `last[1] = ...` edits the array that was
pushed into `merged`, and `merged.push([start, end])` pushes a fresh array
rather than the one from the input, so the input's own pairs are never
modified.

```python
def max_overlap(intervals: list[Interval]) -> int:
    """The most intervals that contain one common point (0 for no intervals)."""
    starts = sorted(start for start, _ in intervals)
    ends = sorted(end for _, end in intervals)
    best = 0
    finished = 0  # how many intervals ended before the current start
```

```typescript
/** The most intervals that contain one common point (0 for no intervals). */
export function maxOverlap(intervals: Interval[]): number {
  const starts = intervals.map(([start]) => start).sort((a, b) => a - b);
  const ends = intervals.map(([, end]) => end).sort((a, b) => a - b);
  let best = 0;
  let finished = 0; // how many intervals ended before the current start
```

The starts and the ends are pulled apart and sorted independently. That looks
like it throws away which end belongs to which start, but the count doesn't
need it: "how many ended before this start" is the same number whichever
meeting each end came from. `finished` only ever moves forward, because later
starts are no smaller than earlier ones, so an end that was before one start is
before every later start too. That is why a single counter works instead of a
new search at each start. Empty input leaves both lists empty, so the loop
below never runs and the answer stays 0.

```python
    for i, start in enumerate(starts):
        while ends[finished] < start:
            finished += 1
        best = max(best, i + 1 - finished)
    return best
```

```typescript
  for (let i = 0; i < starts.length; i++) {
    while (ends[finished] < starts[i]) finished++;
    best = Math.max(best, i + 1 - finished);
  }
  return best;
}
```

`i + 1` is the number of intervals started so far, including the current one,
and subtracting `finished` leaves the ones still running. The `while` test is
the tie rule from "The idea": `<` skips an end only when it is strictly before
the start. Writing `<=` would count `[1, 3]` as finished at the start of
`[3, 5]`, report 1 for them, and then be wrong, since both contain 3. The loop
can't run off the end of `ends`. Every interval counted as finished has
`start <= end < current start`, so it began before the current start and sits
earlier in `starts`; at most `i` of them exist, and `ends[finished]` is always
a valid position.

## Complexity

Both functions are dominated by sorting, which is O(n log n) for n intervals
with the language's built-in sort. Python's `sorted` is a stable merge-based
sort (Timsort) with an O(n log n) worst case; the major JavaScript engines'
sorts are O(n log n) too (V8's is also Timsort), though the language standard
doesn't promise a bound. The passes after it are O(n): `merge_intervals` looks at each
interval once, and in `max_overlap` the index `i` advances n times while
`finished` advances at most n times in total, since it never moves backward.
Extra space is O(n): the merged list, or the two sorted lists of endpoints.

Brute force counts coverage at every integer point: for each point from the
smallest start to the largest end, check every interval. That costs O(n · R),
where R is the width of the range. With 1,000 intervals spread across a range
a million wide, that is about a billion checks, against roughly 10,000
comparisons for the sort. It also only works when the endpoints are integers
and R is small; the sort-based versions don't care how large the coordinates
are or whether they are fractions. The test files use the brute-force count as
the oracle: they run both algorithms on 1,000 seeded random interval
sets, with many touching, nested and duplicated intervals, and compare the
answers.

## Pitfalls

- **Forgetting to sort, or sorting wrongly.** The merge pass assumes the
  starts are in order. In JavaScript or TypeScript, `intervals.sort()` with no
  comparison function orders `[10, 12]` before `[2, 3]`, because the elements
  are compared as text. Use `(a, b) => a[0] - b[0]`.
- **Using the wrong overlap test for the convention.** For inclusive ends,
  merging when `start <= last end` is right and `<` leaves touching intervals
  split. For half-open intervals the test becomes `start < last end` if
  touching ones such as `[1, 3)` and `[3, 5)` should stay apart, and `<=` only
  if you also want them fused into one range, since together they cover `[1, 5)`
  with no gap. In the sweep, half-open intervals use `<=` in the `while` test
  because an end at a coordinate is processed before a start there.
- **Keeping the old end when merging a nested interval.** Assigning `end`
  instead of `max(last end, end)` shrinks `[1, 10]` plus `[2, 3]` to `[1, 3]`.
- **Sorting only the starts in the sweep and reading ends by position.** The
  ends need their own sort. Pairing a sorted start with the end at the same
  index gives the wrong pairs, and the count is wrong with them.
- **Mixing up adjacent integers and overlap.** `[1, 3]` and `[4, 5]` cover 1
  to 5 between them with no gap in whole numbers, but they share no point, so
  this entry's merge keeps them apart. If the problem says adjacent ranges
  should fuse, merge on `start <= last end + 1`.
