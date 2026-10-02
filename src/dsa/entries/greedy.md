---
title: Greedy
summary: Committing to the locally best choice at every step and never revisiting it, which gives fast, simple algorithms exactly when an exchange argument shows the choice can't hurt, and wrong answers when it doesn't.
date: 2026-10-01
kind: pattern
---

A **greedy** algorithm builds an answer one decision at a time and, at each
step, takes whichever option looks best right now. It never goes back to
change an earlier decision. That makes greedy algorithms short and fast, since
there is nothing to search or undo, but it also means they are correct only
when something proves that the "best right now" choice can't ruin the rest of
the answer. Without that proof, a greedy algorithm is a guess that happens to
pass your examples. This entry shows two problems where the proof exists and
one where it doesn't, so you can see what the proof looks like and what its
absence looks like.

## Prerequisites

- [Intervals](/dsa/intervals): the first problem sorts a list of intervals by
  one endpoint, which that entry covers along with merging and counting
  overlap. It uses the inclusive convention, and the section on conventions
  below says where this entry differs.

## The idea

Greedy needs two properties. The problem must have **optimal substructure**:
after you make one choice, what's left is a smaller problem of the same kind,
so solving it well finishes a good answer. And the choice must be **safe**:
some best overall answer includes it. The usual way to show a choice is safe is
an **exchange argument**: take any best answer, swap its first decision for the
greedy one, and show the answer is still valid and no worse.

**Interval scheduling.** You have a set of requests, each a time range, such as
meetings that all want the same room, and you want to hold as many as possible.
Two requests conflict if they overlap. Several rules are tempting: take the
earliest start, take the shortest, or take the one that ends first. Only the
last one is right.

The rule is to sort by **end** and take each interval that doesn't overlap the
ones already taken. Here the intervals are half-open: `(1, 4)` means from 1
up to but not including 4, so `(1, 4)` and `(4, 6)` touch without
overlapping. Take `(1, 4), (3, 5), (0, 6), (5, 7), (8, 9), (5, 9)`. Sorted by
end that is `(1, 4), (3, 5), (0, 6), (5, 7), (8, 9), (5, 9)`, and `last end`
is the end of the most recently taken interval:

| Next   | Last end | Starts at or after it? | Decision | Taken so far           |
| ------ | -------- | ---------------------- | -------- | ---------------------- |
| (1, 4) | none     | n/a                    | take     | (1, 4)                 |
| (3, 5) | 4        | 3 >= 4, no             | skip     | (1, 4)                 |
| (0, 6) | 4        | 0 >= 4, no             | skip     | (1, 4)                 |
| (5, 7) | 4        | 5 >= 4, yes            | take     | (1, 4), (5, 7)         |
| (8, 9) | 7        | 8 >= 7, yes            | take     | (1, 4), (5, 7), (8, 9) |
| (5, 9) | 9        | 5 >= 9, no             | skip     | (1, 4), (5, 7), (8, 9) |

Three meetings. No set of four exists, because every interval not taken
overlaps one that was, and the taken ones leave no room for a fourth.

Why is earliest end safe? Let `g` be the interval that ends first. Take any
best answer `O`, and let `f` be the first interval in it by time. Since `g`
ends first of all, it ends no later than `f` does. Every other interval in `O`
starts at or after `f` ends, so it starts at or after `g` ends too. Replacing
`f` with `g` therefore creates no overlap, and `O` keeps its size. So some best
answer contains `g`. Now drop `g` and everything that overlaps it, and what is
left is the same problem on the intervals starting at or after `g` ends, so the
argument repeats.

Now the other two rules. Sorting by start fails on `(0, 10), (1, 2), (3, 4),
(5, 6)`: it takes the early `(0, 10)`, which blocks all the others, and holds 1
meeting where 3 fit. Sorting by length fails on `(0, 5), (4, 7), (6, 11)`: the
shortest is `(4, 7)`, which overlaps both of the others, so it holds 1 where
`(0, 5)` and `(6, 11)` make 2. In both cases the argument above breaks at the
same spot: the first interval chosen can block more than the one it replaced.

**Jump game.** Given a list of non-negative numbers, you start at index 0 and
`jumps[i]` is the farthest you may jump forward from index `i`; shorter jumps
are allowed too. Can you reach the last index? The greedy idea is to walk
left to right and track `farthest`, the largest index you could reach so far. It
is safe because the reachable indices always form an unbroken run from 0 to
`farthest`: if you can reach index `i`, you can reach every index from `i + 1`
to `i + jumps[i]`, and since `i` is itself inside the run, the new indices join
onto it without a gap. Nothing is lost by remembering only the end of the run.
If you arrive at an index beyond `farthest`, no earlier index could reach it,
and none could reach anything further either, so the walk stops with `False`.

For `[2, 3, 1, 1, 4]`:

| `i` | `jumps[i]` | `i` <= `farthest`? | `farthest` after  |
| --- | ---------- | ------------------ | ----------------- |
| 0   | 2          | 0 <= 0, yes        | max(0, 0 + 2) = 2 |
| 1   | 3          | 1 <= 2, yes        | max(2, 1 + 3) = 4 |
| 2   | 1          | 2 <= 4, yes        | max(4, 2 + 1) = 4 |
| 3   | 1          | 3 <= 4, yes        | max(4, 3 + 1) = 4 |
| 4   | 4          | 4 <= 4, yes        | max(4, 4 + 4) = 8 |

It reached the last index (4), so the answer is `True`. For `[3, 2, 1, 0, 4]`,
`farthest` is 3 after every one of indices 0 to 3, since each of those can reach
no further than index 3. At `i = 4`, the test 4 <= 3 fails and the answer is
`False`: every path runs into the 0 at index 3.

**Where greedy fails: making change.** Pay an amount using the fewest coins.
The greedy rule is to take the largest coin that fits, again and again. With
coins `{1, 3, 4}` and an amount of 6 it takes 4, then has 2 left and takes 1
and 1: three coins. The best is 3 + 3, two coins. Taking the 4 felt right, but
no argument shows it belongs to some best answer, and here it doesn't. Greedy
can also get stuck: with coins `{3, 5}` and an amount of 9 it takes 5, then 3,
has 1 left, and nothing fits, though 3 + 3 + 3 pays it exactly. With coins like
`{1, 5, 10, 25}` the rule happens to give the fewest coins (the tests check
every amount from 0 to 199), which is why it feels like it should always work.
The way to be right for any coin set is to try every coin at every amount and
remember the results, which is [Dynamic Programming: Knapsack](/dsa/dp-knapsack).

**Touching endpoints.** The [Intervals](/dsa/intervals) entry counts ends as
inclusive, so `[1, 3]` and `[3, 5]` overlap at 3. Scheduling usually means the
opposite: a meeting that ends at 3 and one that starts at 3 fit in the same
room. So this entry uses half-open intervals, where touching is allowed, and
the test is `start >= last end`. If your problem uses inclusive ends, the test
becomes `start > last end`. The sort-by-end rule and the proof don't change.

## When to use it

Try greedy when a problem asks for the most, fewest, earliest or cheapest of
something and the choices can be put in an order where taking the first
available is plausibly safe. Scheduling is the common case: the most meetings
in one room, or the fewest arrows needed to burst balloons laid out along a
line (sort by end, then shoot at the earliest end). Reachability along a line,
as in the jump game, is another, and so are problems that settle one position
at a time, such as keeping the largest number after deleting k digits.
Algorithms like Dijkstra's shortest path and Huffman coding are greedy too,
each with its own proof.

Do not trust it on feel. If you can't state the exchange argument in a few
sentences, or you can find a small input where the obvious greedy loses, as
with the coins above, use a method that checks every option, such as
[Dynamic Programming: Knapsack](/dsa/dp-knapsack). A cheap safeguard is to
write the exhaustive version for tiny inputs and compare the two on many random
cases. The tests for this entry do that.

## Walkthrough

```python
Interval = tuple[int, int]  # (start, end), half-open: includes start, not end


def select_intervals(intervals: list[Interval]) -> list[Interval]:
    """A largest set of pairwise non-overlapping intervals (start < end each)."""
    chosen: list[Interval] = []
```

```typescript
/** [start, end], half-open: includes start, not end. */
export type Interval = [number, number];

/** A largest set of pairwise non-overlapping intervals (start < end each). */
export function selectIntervals(intervals: Interval[]): Interval[] {
  const chosen: Interval[] = [];
```

The comment on `Interval` states the half-open convention where the type is
introduced, because the comparison in the next chunk depends on it: with
inclusive ends `(1, 3)` and `(3, 5)` share the point 3 and clash, yet the same
code would still keep both. The
docstring adds that each interval must have `start < end`. An interval with
`start == end` holds no time at all, and the proof above assumes every interval
has some length. The function returns the chosen intervals and not just their
count, so a caller can see which meetings were held, and an empty input just
returns an empty list.

```python
    for start, end in sorted(intervals, key=lambda interval: interval[1]):
        if not chosen or start >= chosen[-1][1]:
            chosen.append((start, end))
    return chosen
```

```typescript
  const byEnd = [...intervals].sort((a, b) => a[1] - b[1]);
  for (const [start, end] of byEnd) {
    const last = chosen[chosen.length - 1];
    if (last === undefined || start >= last[1]) {
      chosen.push([start, end]);
    }
  }
  return chosen;
}
```

The sort key is the end, `interval[1]`; swap in `interval[0]` and the code
becomes the sort-by-start rule that loses on `(0, 10), (1, 2), (3, 4), (5, 6)`.
Because the list is in order of end, the last interval taken has the largest end
of everything taken, so one comparison with `chosen[-1][1]` is enough: if the
new interval starts at or after that end, it starts after all the others end
too. The test is `>=` because of the half-open convention; with `>`, `(1, 3)`
and `(3, 5)` would be treated as a clash and only one of them kept. Intervals
that tie on end can come in either order, since the exchange argument only
needs the first to end no later than the others. In TypeScript, `sort` changes
the array it is called on, so the code sorts a copy made with `[...intervals]`;
Python's `sorted` already returns a new list. Either way the caller's list is
left alone.

```python
def can_reach_end(jumps: list[int]) -> bool:
    """Can you get from index 0 to the last index? jumps[i] >= 0 is the longest
    jump from i; any shorter jump is allowed too. An empty list has no last index."""
    if not jumps:
        return False
    farthest = 0
```

```typescript
/**
 * Can you get from index 0 to the last index? `jumps[i]` >= 0 is the longest
 * jump from i; any shorter jump is allowed too. An empty array has no last index.
 */
export function canReachEnd(jumps: number[]): boolean {
  if (jumps.length === 0) return false;
  let farthest = 0;
```

An empty list has no last index to reach, so the function returns `False`
before anything else; this is a choice, and the docstring records it so the
reader doesn't have to guess. Without the guard the loop below would never run
and the function would return `True` for nothing at all. `farthest` starts at
0 because index 0 is where you begin: it is reachable before any jump is made.

```python
    for i, length in enumerate(jumps):
        if i > farthest:
            return False
        farthest = max(farthest, i + length)
    return True
```

```typescript
  for (let i = 0; i < jumps.length; i++) {
    if (i > farthest) return false;
    farthest = Math.max(farthest, i + jumps[i]);
  }
  return true;
}
```

The check comes before the update, and it is `>`, not `>=`. Index `i` is
reachable when `i <= farthest`, so `i == farthest` is fine: with `[1, 1]` the
walk reaches index 1 exactly at `farthest = 1`. Writing `>=` would fail at once:
at index 0, `farthest` is still 0, so `0 >= 0` rejects every non-empty list,
even `[0]`, where you are already at the end. The
update uses `max` because a later index can reach less far than an earlier one:
at `i = 2` in `[2, 3, 1, 1, 4]` the new reach is 3, but `farthest` is already 4,
and replacing it with 3 would lose that. The function reads each index once,
and never looks back or tries a jump length, since the unbroken run described
in "The idea" says remembering one number is enough. Reaching the last index
without a stop is the only way out of the loop, so the final `True` is correct.

```python
def greedy_coin_count(coins: list[int], amount: int) -> int | None:
    """Coins used by always taking the largest coin that fits, or None if stuck.

    This is NOT always the fewest coins; see the entry. Coins are positive,
    amount is not negative.
    """
    remaining = amount
    count = 0
```

```typescript
/**
 * Coins used by always taking the largest coin that fits, or null if stuck.
 *
 * This is NOT always the fewest coins; see the entry. Coins are positive,
 * amount is not negative.
 */
export function greedyCoinCount(coins: number[], amount: number): number | null {
  let remaining = amount;
  let count = 0;
```

This function is here as the counter-example, and its name and docstring say so
rather than leave it looking like a solution. It returns `None` (`null` in
TypeScript) when it gets stuck, as with coins `{3, 5}` and 9, so a caller can
tell "greedy found nothing" from "zero coins". Coins must be positive: a coin of
0 would divide by zero in the next chunk.

```python
    for coin in sorted(coins, reverse=True):
        count += remaining // coin
        remaining %= coin
    return count if remaining == 0 else None
```

```typescript
  for (const coin of [...coins].sort((a, b) => b - a)) {
    count += Math.floor(remaining / coin);
    remaining %= coin;
  }
  return remaining === 0 ? count : null;
}
```

The coins are sorted from largest to smallest because "the largest coin that
fits" has to be tried first, and the caller can pass them in any order. For
each coin, `remaining // coin` is how many of it fit, and `remaining %= coin`
keeps what is left over; a coin bigger than `remaining` fits zero times and
changes nothing, so no `if` is needed. At the end, a leftover means no coin
could finish the job. With `{1, 3, 4}` and 6, the 4 goes in once (`count = 1`,
`remaining = 2`), the 3 doesn't fit, and the 1 goes in twice: 3 coins, though 3
and 3 is 2. The TypeScript version needs `Math.floor` because `/` on numbers
gives a fraction (`6 / 4` is 1.5), where Python's `//` already rounds down.

## Complexity

`select_intervals` is O(n log n) time for n intervals: the sort costs that, and
the pass after it looks at each interval once, O(n). It uses O(n) extra space
for the sorted copy and the result. `can_reach_end` is O(n) time with O(1)
extra space, since it makes one pass with a single number of state.
`greedy_coin_count` is O(k log k) time for k coin values, for the sort, plus
O(k) for the pass, and O(k) space for the sorted copy; it doesn't depend on the
amount.

The exhaustive versions the tests compare against cost far more. Trying every
subset of n intervals is 2^n subsets, each checked for overlap in O(n²), so 20
intervals already means over a million subsets. A search over jump positions
can visit every index and try every jump length from each, O(n²) in the worst
case, against the single pass above. The brute-force oracles are only practical
because the test inputs are tiny: up to 8 intervals, up to 10 jumps, amounts
up to 30. The tests run each greedy function against its oracle on hundreds of
seeded random inputs (400 for intervals, 1,000 for jumps, 500 for coin sets),
including empty input, a single item, ties on end and touching endpoints.

## Pitfalls

- **Picking the sort order by instinct.** Earliest start and shortest first are
  both natural and both wrong for interval scheduling; the examples in "The
  idea" show each holding one meeting where more fit. The tests run both rules
  on random input and check that each loses somewhere.
- **The wrong comparison for the convention.** With half-open intervals
  `start >= last end` is right and `>` drops one of two back-to-back meetings.
  With inclusive ends the test is `start > last end` and `>=` allows an overlap
  at a shared point.
- **Zero-length or backward intervals.** The proof assumes `start < end`, and
  the tests only generate such intervals. An empty `(3, 3)` holds no time, so
  whether it should count as a meeting is a question the code doesn't answer;
  validate the input if it can contain them.
- **`i >= farthest` in the jump game.** With the check before the update, it
  is already true at index 0 (`0 >= 0`), so it rejects every non-empty list,
  `[0]` and `[1, 1]` included.
- **Reading the jump list as exact jump lengths.** Here `jumps[i]` is the
  longest jump allowed. If each jump must be exactly that long, reachable
  indices stop being an unbroken run, and this algorithm gives wrong answers.
- **Assuming greedy works because it passed the examples.** Coins `{1, 3, 4}`
  pass for 1, 2, 3, 4, 5, 7 (7 is 4 + 3) and 8, and fail at 6. Write the
  exhaustive version for tiny inputs and compare before trusting a greedy rule.
- **Forgetting that greedy can fail to finish.** Coin lists without a 1, such
  as `{3, 5}`, can leave a remainder that no coin covers, though a different
  mix would have paid it exactly. The function returns `None` for that, and a
  caller that treats `None` as zero coins is wrong.
