---
title: 'Dynamic Programming: Memoization and Tabulation'
summary: Answering each smaller version of a problem once, by caching a recursion or filling a table from the smallest case up, so an exponential search becomes one visit per subproblem.
date: 2026-10-05
kind: pattern
---

Dynamic programming (DP) solves a problem by answering smaller versions of it,
each exactly once, and building the full answer out of those. You'll solve one
problem, house robber, both ways any DP can be computed: top-down with a cache
and bottom-up with a table, then shrink the table to two variables.

## Prerequisites

- [Hash map](/dsa/hash-map): the top-down version remembers answers in one,
  keyed by the subproblem, and Complexity uses big-O notation, defined in [Arrays and strings](/dsa/arrays-and-strings). You also need recursion: a function that calls itself on a smaller
  input.

## The idea

A street has houses in a row, each holding some money, and you can rob any set of them as long as no two are neighbors. What's the
most you can take? Run it on the street `[3, 4, 3, 1]`.

Your first instinct is probably greedy: rob the richest house, then the
richest one still allowed, and so on. That takes the 4, which rules out both
3s, then the 1, for 5. Robbing the two 3s gives 6. Greedy loses because it
commits before it has seen what the choice costs later.

What you need is the **state**: the few numbers that pin down a subproblem.
To find it, ask what your first decision is and what's left after it. At house `i` you either skip it, and the rest of the problem is
the street from `i + 1`, or rob it, and the rest is the street from `i + 2`,
since its neighbor is now off limits. Either way, what's left is "the best
from some house onward", so one integer describes every subproblem. Call it
`best(i)`. The **recurrence** (the rule that builds an answer from smaller
ones) is the better of the two choices:

```text
best(i) = max(best(i + 1), nums[i] + best(i + 2))      best(i) = 0 once i >= n
```

The **base case**, the subproblem small enough to answer directly, is an empty
street, worth 0. That recipe works on every DP: name the choice, describe
what's left in as few integers as you can, combine the choices (the best, a
sum for "how many ways", an "or" for "is it possible"), and find the smallest
case.

Why not just write that recursion and be done? Because it asks the same
questions over and over. `best(0)` calls `best(2)` directly, and `best(1)`
calls it again. For four houses that's 15 calls; for 30 houses it's 4,356,617
calls, to answer only 30 distinct questions. Those **overlapping subproblems**
are what make DP pay off. There are two ways to answer each one once, and they
run the same recurrence in different orders:

- **Top-down memoization** keeps the recursion and adds a **memo**, a cache of
  answers already found, checked before computing anything.
- **Bottom-up tabulation** drops the recursion and fills a list from the base
  case toward `best(0)`, so whatever an entry needs is already written.

Here is the table for `[3, 4, 3, 1]`, filled from the right:

| `i` | Money | Skip: `best(i + 1)` | Rob: money + `best(i + 2)` | `best(i)` |
| --- | ----- | ------------------- | -------------------------- | --------- |
| 3   | 1     | 0                   | 1 + 0 = 1                  | 1         |
| 2   | 3     | 1                   | 3 + 0 = 3                  | 3         |
| 1   | 4     | 3                   | 4 + 1 = 5                  | 5         |
| 0   | 3     | 5                   | 3 + 3 = 6                  | 6         |

So which do you write in an interview? Start top-down, because it's the
recurrence typed out and it only visits the states it needs. Switch to
bottom-up when the input can be long enough to exhaust the call stack, or when
you're asked for less memory, because only a loop with a known order can be
shrunk. Find the recurrence top-down; ship it bottom-up when depth or memory
matters.

## When to use it

- The question asks for a count, a maximum or minimum, or whether something is
  possible, over many combinations of choices: "how many ways", "the largest
  total", "the fewest coins".
- Each choice limits later ones (no two neighbors, a capacity, no reuse), and
  you can find a small input where the greedy choice loses.
- You can describe what's left after a choice with one or two integers: "from
  index `i` on", "the first `i` items", "an amount `k`".
- Plain recursion would reach the same arguments by different paths. If it
  doesn't, as in merge sort, a memo saves nothing.

## Walkthrough

```python
from functools import cache

def rob_memo(nums: list[int]) -> int:
    """Most money from houses with no two neighbors robbed, top-down."""

    # Defined inside so the cache belongs to this street and starts empty
    # on every call; a module-level cache keyed by i would mix streets up.
    @cache
    def best_from(i: int) -> int:
        # >=, not ==: robbing the last house jumps to len(nums) + 1.
        if i >= len(nums):
            return 0
        return max(best_from(i + 1), nums[i] + best_from(i + 2))

    # One stack frame per house: Python's default limit of 1,000 frames
    # raises RecursionError before 1,000 houses (sooner on 3.11).
    return best_from(0)
```

```typescript
/** Most money from houses with no two neighbors robbed, top-down. */
export function robMemo(nums: number[]): number {
  // Created inside so the memo belongs to this street and starts empty on
  // every call; a module-level memo keyed by i would mix streets up.
  const memo = new Map<number, number>();
  const bestFrom = (i: number): number => {
    // >=, not ===: robbing the last house jumps to nums.length + 1.
    if (i >= nums.length) return 0;
    // Compare with undefined, not truthiness: a stored 0 is a real answer.
    let best = memo.get(i);
    if (best === undefined) {
      best = Math.max(bestFrom(i + 1), nums[i] + bestFrom(i + 2));
      memo.set(i, best);
    }
    return best;
  };
  // One stack frame per house: past several thousand houses (the exact
  // point depends on the engine) this throws a RangeError.
  return bestFrom(0);
}
```

Without the memo this is the plain recursion and its 15 calls; with it, four
houses take 9 calls (`2n + 1`), since each house is computed once. What's left
is depth: one frame per house before anything returns, which a loop avoids.

```python
def rob_table(nums: list[int]) -> list[int]:
    """The whole table, bottom-up: best[i] is the most from houses i onward."""
    n = len(nums)
    # Two extra slots so best[i + 2] exists for the last house; both are
    # the empty street, worth 0, which makes them the base cases.
    best = [0] * (n + 2)
    # Right to left: best[i] reads best[i + 1] and best[i + 2], which must
    # already be final. Left to right would read zeros not yet filled in.
    for i in reversed(range(n)):
        best[i] = max(best[i + 1], nums[i] + best[i + 2])
    return best
```

```typescript
/** The whole table, bottom-up: best[i] is the most from houses i onward. */
export function robTable(nums: number[]): number[] {
  const n = nums.length;
  // Two extra slots so best[i + 2] exists for the last house; both are
  // the empty street, worth 0, which makes them the base cases.
  const best = new Array<number>(n + 2).fill(0);
  // Right to left: best[i] reads best[i + 1] and best[i + 2], which must
  // already be final. Left to right would read zeros not yet filled in.
  for (let i = n - 1; i >= 0; i--) {
    best[i] = Math.max(best[i + 1], nums[i] + best[i + 2]);
  }
  return best;
}
```

The loop runs the recurrence in the order the recursion finished its calls, so
`[3, 4, 3, 1]` ends as `[6, 5, 3, 1, 0, 0]`, the table above plus the two base
cases, with the answer at index 0. It returns the whole table because the
usual follow-up is "which houses?"

```python
def houses_to_rob(nums: list[int]) -> list[int]:
    """Indices of one best set of houses, read back out of the table."""
    best = rob_table(nums)
    chosen: list[int] = []
    i = 0
    while i < len(nums):
        # Rob house i exactly when that option is what produced best[i].
        if nums[i] + best[i + 2] >= best[i + 1]:
            chosen.append(i)
            i += 2
        else:
            i += 1
    return chosen
```

```typescript
/** Indices of one best set of houses, read back out of the table. */
export function housesToRob(nums: number[]): number[] {
  const best = robTable(nums);
  const chosen: number[] = [];
  let i = 0;
  while (i < nums.length) {
    // Rob house i exactly when that option is what produced best[i].
    if (nums[i] + best[i + 2] >= best[i + 1]) {
      chosen.push(i);
      i += 2;
    } else {
      i += 1;
    }
  }
  return chosen;
}
```

On the running example, house 0 wins its row (3 + 3 = 6 beats 5), so you jump
to house 2, which wins too (3 + 0 beats 1), giving houses 0 and 2. If you only
need the total, though, each entry reads just the two after it, and everything
further right is dead weight.

```python
def rob(nums: list[int]) -> int:
    """The same answer as rob_table(nums)[0], keeping only two entries."""
    next1, next2 = 0, 0
    for amount in reversed(nums):
        # One assignment: both right-hand sides use the old next1. Two
        # statements would overwrite next1 before next2 copies it.
        next1, next2 = max(next1, amount + next2), next1
    return next1
```

```typescript
/** The same answer as robTable(nums)[0], keeping only two entries. */
export function rob(nums: number[]): number {
  let next1 = 0;
  let next2 = 0;
  for (let i = nums.length - 1; i >= 0; i--) {
    // One assignment: both right-hand sides use the old next1. Two
    // statements would overwrite next1 before next2 copies it.
    [next1, next2] = [Math.max(next1, nums[i] + next2), next1];
  }
  return next1;
}
```

`next1` and `next2` are `best[i + 1]` and `best[i + 2]`, sliding one house left
per pass, so an empty street returns 0 with no special case. This works
whenever an entry reads a fixed number of neighbors; a recurrence that reads
every earlier entry keeps its table.

## Complexity

Plain recursion makes `2F(n + 2) - 1` calls, where F is the Fibonacci sequence
(1, 1, 2, 3, 5, 8, ...): 15 for four houses, 4,356,617 for 30. Fibonacci
numbers grow by about 1.618 per step, so that's exponential time.

Every DP costs the number of states times the work per state. Here there are
`n` states with constant work each, so memoization and the table are both
O(n) time. Both use O(n) space: the memo holds `n` answers and the recursion
is `n` frames deep, and the table holds `n + 2` entries. `houses_to_rob` adds
one O(n) walk. `rob` is O(n) time and O(1) space.

## Pitfalls

- **Ending the recursion with `==`.** Robbing the last house calls
  `best_from(n + 1)`, which skips over `n`, so `if i == len(nums)` never
  catches it and the recursion climbs until the stack overflows.
- **Running out of stack top-down.** `return best_from(0)` fails on a street
  of under 1,000 houses in Python and several thousand in Node. Raising
  `sys.setrecursionlimit` may still fail, or crash older interpreters; use the
  table.
- **Filling the table in the wrong direction.** With `for i in range(n)`,
  every `best[i + 1]` it reads is still 0, so each entry becomes its own
  house's money and `[3, 4, 3, 1]` returns 3 with no error. Fill an entry only
  after everything it reads.
- **Updating the two variables one at a time.** Writing `next1 = ...` and then
  `next2 = next1` copies the new value, not the old one, and `[3, 4, 3, 1]`
  returns 11, as if every house were robbed.
