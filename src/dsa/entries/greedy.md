---
title: Greedy
summary: Taking the locally best choice at every step and never revisiting it, which is correct only when you can argue the choice never costs you the best answer.
date: 2026-10-05
kind: pattern
---

A **greedy** algorithm builds an answer one decision at a time, takes whichever
option looks best right now, and never goes back. There's nothing to search or
undo, so the code is short and fast. The catch is that nothing guarantees it's
right: you have to argue it. The argument succeeds on meeting rooms
and a jump game, then fails on coins, which is the signal to reach for DP.

## Prerequisites

- [Intervals](/dsa/intervals): the first problem sorts intervals by one
  endpoint. That entry counts ends as inclusive; this one uses half-open
  intervals, where `(1, 4)` and `(4, 6)` touch without overlapping, because
  that's what a meeting room means.

## The idea

You have one room and these meeting requests, as `(start, end)`:
`(1, 4), (3, 5), (0, 6), (5, 7), (8, 9), (5, 9)`. Hold as many as you can.
Three rules suggest themselves: earliest start, shortest meeting, earliest
end. Only the last is right. Walk the meetings in order of end and keep each
one that starts at or after the end of the last one kept:

| Next   | Last kept end | Starts at or after it? | Decision |
| ------ | ------------- | ---------------------- | -------- |
| (1, 4) | none          | n/a                    | keep     |
| (3, 5) | 4             | 3 >= 4, no             | skip     |
| (0, 6) | 4             | 0 >= 4, no             | skip     |
| (5, 7) | 4             | 5 >= 4, yes            | keep     |
| (8, 9) | 7             | 8 >= 7, yes            | keep     |
| (5, 9) | 9             | 5 >= 9, no             | skip     |

Three meetings: `(1, 4), (5, 7), (8, 9)`. Why can you trust it? The tool is
an **exchange argument**: take any best schedule, swap in the greedy choice,
and show nothing gets worse. Say some best schedule is `(3, 5), (5, 7), (8, 9)`.
Its first meeting, `(3, 5)`, ends after greedy's pick `(1, 4)`, so everything
after it also starts at or after `(1, 4)` ends. Swap them and you get `(1, 4), (5, 7),
(8, 9)`: valid, same size. That works for any best schedule, because the
earliest end finishes no later than whatever that schedule starts with. So
some best schedule contains the greedy pick, and what's left, the meetings
starting at or after 4, is the same problem again.

Now watch the same argument fail on the other rules. Earliest start takes
`(0, 10)` from `(0, 10), (1, 2), (3, 4), (5, 6)` and holds 1 where 3 fit: no best
schedule contains `(0, 10)`, so there's nothing to swap.
Shortest first fails on `(0, 5), (4, 7), (6, 11)`: it takes `(4, 7)` and holds 1
where `(0, 5)` and `(6, 11)` make 2.

Exchange arguments aren't the only proof. In the **jump game** you start at
index 0, `jumps[i]` is the longest jump from `i` (shorter is allowed), and you
want the last index. Track `farthest`, the furthest index reachable so far.
The indices you can reach always form an unbroken run from 0 to `farthest`,
because a shorter jump is always allowed, so one number loses nothing. For `[2, 3, 1, 1, 4]`, `farthest` goes 2, 4, 4, 4,
8, never behind the index you're on, so you arrive. For `[3, 2, 1, 0, 4]` it
sticks at 3, and index 4 is past it.

When does greedy break? Pay 6 with coins `{1, 3, 4}` using the fewest coins,
always taking the largest coin that fits. It takes 4, then 1 and 1: three
coins. Best is 3 + 3, two. The exchange fails because no best answer contains
the 4. Greedy can even get stuck: with `{3, 5}` and 9 it takes 5, then 3,
leaves 1, and nothing fits, though 3 + 3 + 3 works. Real coin systems like
`{1, 5, 10, 25}` happen to work, which is why greedy feels like it should
always. The fix is to try every coin at every amount and remember the results,
which is [dynamic programming](/dsa/dynamic-programming).

## When to use it

- The problem wants the most, fewest, earliest or cheapest of something, and
  the choices can be ordered so that taking the first available is plausibly
  safe. Scheduling is the usual case: most meetings in a room, fewest arrows
  to burst balloons on a line (sort by end, shoot at the earliest end).
- You can say the exchange argument in two or three sentences: "swap my pick
  into any best answer and nothing gets worse". If you can't, you're guessing.
- Reachability along a line, or settling one position at a time.
- Before trusting a rule, hunt for a tiny input where it loses, as `{1, 3, 4}`
  does. If one exists, or the choices interact like coins, use DP.

## Walkthrough

```python
Interval = tuple[int, int]  # half-open: (1, 4) and (4, 6) don't overlap


def select_intervals(intervals: list[Interval]) -> list[Interval]:
    """A largest set of pairwise non-overlapping intervals (start < end each)."""
    chosen: list[Interval] = []
    # By end, not start or length: the interval that ends first leaves the
    # most room, and the other two orders can pick one that blocks several.
    for start, end in sorted(intervals, key=lambda interval: interval[1]):
        # Sorted by end, chosen[-1] ends last of everything taken, so one
        # comparison covers them all. >=, not >: touching intervals both fit.
        if not chosen or start >= chosen[-1][1]:
            chosen.append((start, end))
    return chosen
```

```typescript
/** [start, end], half-open: (1, 4) and (4, 6) don't overlap. */
export type Interval = [number, number];

/** A largest set of pairwise non-overlapping intervals (start < end each). */
export function selectIntervals(intervals: Interval[]): Interval[] {
  const chosen: Interval[] = [];
  // By end, not start or length: the interval that ends first leaves the
  // most room, and the other two orders can pick one that blocks several.
  // Copy first: sort changes the array it is called on.
  const byEnd = [...intervals].sort((a, b) => a[1] - b[1]);
  for (const [start, end] of byEnd) {
    const last = chosen[chosen.length - 1];
    // Sorted by end, last ends last of everything taken, so one comparison
    // covers them all. >=, not >: touching intervals both fit.
    if (last === undefined || start >= last[1]) {
      chosen.push([start, end]);
    }
  }
  return chosen;
}
```

This is the table above as code: the sort is the greedy rule, and the loop is
the keep-or-skip column. It returns the meetings, not a count, so the caller
sees which ones are held. The jump game needs no sort, only a running maximum.

```python
def can_reach_end(jumps: list[int]) -> bool:
    """Can you get from index 0 to the last index? jumps[i] is the longest
    jump from i; shorter ones are allowed. An empty list has no last index."""
    if not jumps:
        return False
    farthest = 0
    for i, length in enumerate(jumps):
        # Check before updating, so a gap stops the walk. > and not >=:
        # index farthest itself is reachable (>= rejects index 0).
        if i > farthest:
            return False
        # max, not assignment: a later index can reach less far than an earlier.
        farthest = max(farthest, i + length)
    return True
```

```typescript
/**
 * Can you get from index 0 to the last index? jumps[i] is the longest
 * jump from i; shorter ones are allowed. An empty array has no last index.
 */
export function canReachEnd(jumps: number[]): boolean {
  if (jumps.length === 0) return false;
  let farthest = 0;
  for (let i = 0; i < jumps.length; i++) {
    // Check before updating, so a gap stops the walk. > and not >=:
    // index farthest itself is reachable (>= rejects index 0).
    if (i > farthest) return false;
    // max, not assignment: a later index can reach less far than an earlier.
    farthest = Math.max(farthest, i + jumps[i]);
  }
  return true;
}
```

On `[3, 2, 1, 0, 4]` the loop sets `farthest` to 3 at index 0 and leaves it
there; at `i = 4` the check fails and it returns `False`. Falling out of the
loop means every index was reachable, the last one included. Next, the rule
that looks just as natural and isn't safe.

```python
def greedy_coin_count(coins: list[int], amount: int) -> int | None:
    """Coins used by always taking the largest that fits, or None if stuck.
    NOT always the fewest coins. Coins are positive, amount is not negative."""
    count = 0
    # Largest first is the rule itself; the caller's order isn't trusted.
    for coin in sorted(coins, reverse=True):
        # A coin can repeat, and one bigger than amount adds 0: no guard needed.
        count += amount // coin
        amount %= coin
    # A leftover means nothing fit it; returning count would pay too little.
    return count if amount == 0 else None
```

```typescript
/**
 * Coins used by always taking the largest that fits, or null if stuck.
 * NOT always the fewest coins. Coins are positive, amount is not negative.
 */
export function greedyCoinCount(coins: number[], amount: number): number | null {
  let count = 0;
  // Largest first is the rule itself; the caller's order isn't trusted.
  for (const coin of [...coins].sort((a, b) => b - a)) {
    // A coin can repeat, and one bigger than amount adds 0: no guard needed.
    // Math.floor: / on numbers gives a fraction.
    count += Math.floor(amount / coin);
    amount %= coin;
  }
  // A leftover means nothing fit it; returning count would pay too little.
  return amount === 0 ? count : null;
}
```

With `{1, 3, 4}` and 6: the 4 goes in once, leaving 2; the 3 doesn't fit; the
1 goes in twice. Three coins, though two would do. The correct version asks,
for every amount from 1 up, which last coin gives the fewest. For `{1, 3, 4}`
that table runs 0, 1, 2, 1, 1, 2, 2 for amounts 0 to 6, and at 6 the 3 wins.
It keeps every earlier answer instead of committing to one coin, and that's
the difference between DP and greedy; [dynamic programming](/dsa/dynamic-programming-shapes)
builds it.

## Complexity

`select_intervals` is O(n log n) time for n intervals, all of it the sort; the
pass is O(n). It uses O(n) extra space for the sorted copy and the result.
`can_reach_end` is O(n) time and O(1) space: one pass, one number.
`greedy_coin_count` is O(k log k) for k coin values, independent of the
amount, with O(k) space for the sorted copy. The coin table that replaces it
costs O(amount x k) time, the price of not committing.

## Pitfalls

- **The sort key.** `interval[1]` is the whole proof; change it to
  `interval[0]` and `(0, 10), (1, 2), (3, 4), (5, 6)` keeps one meeting where
  three fit.
- **`>=` against `>` in the keep test.** With half-open intervals, `>` drops
  one of two back-to-back meetings such as `(1, 3)` and `(3, 5)`. With
  inclusive ends, the reverse holds, and `>=` allows an overlap.
- **`i >= farthest` in the jump game.** At index 0, `farthest` is 0, so it
  rejects every non-empty list, `[0]` included.
- **Returning `count` when `amount` is left over.** For `{3, 5}` and 9 the
  loop ends with 1 unpaid. Without the final check it reports two coins for a
  bill it never finished paying.
