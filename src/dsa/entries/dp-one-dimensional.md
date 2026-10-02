---
title: 'Dynamic Programming: One Dimension'
summary: Solving a problem by answering a chain of smaller versions of it once each, in order, so that a recursion that repeats itself exponentially becomes a single pass over a one-dimensional table, and often just a couple of variables.
date: 2026-10-01
kind: pattern
---

Dynamic programming (DP) is a way of solving a problem whose answer is built
out of answers to smaller versions of the same problem, when those smaller
versions keep coming up again and again. Instead of recomputing them, you
compute each one once, write the result down, and look it up afterwards. This
entry covers the one-dimensional case: the smaller versions are numbered by a
single integer, so the written-down results form a plain list. Three problems
show the three moves you need: climbing stairs (counting), house robber
(choosing), and the longest increasing subsequence (looking back at everything
before).

## Prerequisites

- [Hash map](/dsa/hash-map): the memoised version below keeps its remembered
  results in a dict (a `Map` in TypeScript), and the Complexity section uses
  big-O notation (O(1), O(n)), which that entry explains. Everything else
  assumed here is recursion (a function that calls itself) and loops over lists.

## The idea

Three words carry the whole technique.

A **subproblem** is a smaller version of the question you were asked. For
climbing stairs, the question is how many ways there are to climb `n` stairs,
taking 1 or 2 steps at a time, and the subproblem for `k` is the same question
about `k` stairs. A **recurrence** is the rule that builds the answer to a
subproblem from the answers to smaller ones. To land on stair `k`, the last
move was either a 1-step from stair `k - 1` or a 2-step from stair `k - 2`, and
those two groups of routes share nothing, so

```text
ways(k) = ways(k - 1) + ways(k - 2)        ways(0) = ways(1) = 1
```

`ways(0) = 1` counts the one way to climb nothing (stay put), and `ways(1) = 1`
is the single 1-step. Those two are the **base cases**, the subproblems small
enough to answer directly. The recurrence is the real work of any DP solution;
the rest is bookkeeping.

**Overlapping subproblems** are what makes DP worth doing. Written as plain
recursion, `ways(5)` calls `ways(4)` and `ways(3)`, and `ways(4)` calls
`ways(3)` again, so the same question is answered twice. Running the plain
version and counting calls to each `k` for `n = 5` gives:

| `k`             | 5   | 4   | 3   | 2   | 1   | 0   |
| --------------- | --- | --- | --- | --- | --- | --- |
| calls to `ways` | 1   | 1   | 2   | 3   | 5   | 3   |

That is 15 calls to produce the answer 8. The waste compounds: `n = 10` takes
177 calls, `n = 20` takes 21,891 and `n = 30` takes 2,692,537. Each extra stair
multiplies the work by about 1.6, which is exponential growth.

There are two ways to stop the repetition, and they compute the same thing in
different orders. **Top-down memoisation** keeps the recursion but checks a
**memo** (a lookup table of answers already found) before computing anything,
so each subproblem is solved once. **Bottom-up tabulation** drops the recursion:
it fills a **table** (a list indexed by `k`) from the base cases upward, so that
when it reaches `k` the two entries it needs are already there. And since
`ways(k)` only reads the last two entries, the table can be shrunk to two
variables that slide forward.

House robber shows the second move. You are given the amount of money in each
house on a street and may take from any set of houses as long as no two are
next to each other. At each house there is a choice: take it, which forbids the
house before, or skip it. Let `best(i)` be the most you can get from the first
`i` houses. Then `best(i) = max(best(i - 1), best(i - 2) + amount)`, where
`amount` is house `i`'s money: either skip it and keep the best so far, or take
it and add it to the best from before its neighbour. For `[2, 7, 9, 3, 1]`,
tracking the pair (best up to two houses ago, best so far):

| House money | `skipped` (before) | `best` (before) | New `best`           |
| ----------- | ------------------ | --------------- | -------------------- |
| 2           | 0                  | 0               | max(0, 0 + 2) = 2    |
| 7           | 0                  | 2               | max(2, 0 + 7) = 7    |
| 9           | 2                  | 7               | max(7, 2 + 9) = 11   |
| 3           | 7                  | 11              | max(11, 7 + 3) = 11  |
| 1           | 11                 | 11              | max(11, 11 + 1) = 12 |

The answer is 12, from houses with 2, 9 and 1. After each row the old `best`
becomes the next row's `skipped`.

Greedy rules do not work here. "Take every other house" fails on
`[5, 1, 1, 5]`: the houses at positions 0 and 2 give 5 + 1 = 6, positions 1 and
3 give 1 + 5 = 6, but taking the two 5s (positions 0 and 3, which are not
adjacent) gives 10. "Always take the largest remaining house" fails on
`[2, 3, 2]`: it takes the 3 and then has nothing left that isn't adjacent,
for 3, while the two 2s give 4. The recurrence works because it never commits
early; it keeps the best answer for both choices until the next house settles
which was better.

The third problem is the **longest strictly increasing subsequence**. A
subsequence keeps some of the elements in their original order, not
necessarily next to each other, and strictly increasing means each kept element
is larger than the one before it (equal values do not count). In
`[10, 9, 2, 5, 3, 7, 101, 18]` the subsequence `2, 5, 7, 101` has length 4.
Here the subproblem is "the longest such subsequence that ends at index `i`",
and its recurrence looks back at every earlier index `j` whose value is
smaller: `ending_at[i] = 1 + max(ending_at[j])` over those `j`, or 1 if there are
none. For that array:

| Index `i`      | 0   | 1   | 2   | 3   | 4   | 5   | 6   | 7   |
| -------------- | --- | --- | --- | --- | --- | --- | --- | --- |
| Value          | 10  | 9   | 2   | 5   | 3   | 7   | 101 | 18  |
| `ending_at[i]` | 1   | 1   | 1   | 2   | 2   | 3   | 4   | 4   |

For example, 7 at index 5 can follow 2 (length 1), 5 (length 2) or 3 (length 2),
so its entry is 2 + 1 = 3. The answer is the largest entry, 4, not the last one:
the longest subsequence need not end at the last element. Each entry here
reads all the earlier ones, so a two-entry sliding window won't do and the
whole table stays.

## When to use it

Reach for DP when a problem asks for a count, a best value (largest, smallest,
cheapest) or a yes/no feasibility over many combinations, and you can describe
the answer for a size-`k` version of the input in terms of smaller sizes. Two
properties have to hold: the problem splits into subproblems whose answers
combine into the whole answer, and the same subproblems recur. Without
recurrence of subproblems, as in merge sort, the plain recursion is already
fast and a memo buys nothing.

The one-dimensional shape fits when a single number identifies a subproblem:
"the first `i` items", "ending at position `i`", "a total of `k`". The
warning signs in a problem statement are "how many ways", "the maximum or
minimum total", and a rule that forbids some neighbours or orderings. If the
locally best choice at each step is never beaten by a different choice once
later items are seen, a greedy rule is enough; the house-robber counterexamples
above are what a failing greedy looks like.

## Walkthrough

```python
def climb_naive(n: int) -> int:
    """Ways to climb n stairs taking 1 or 2 steps at a time, by plain recursion."""
    if n <= 1:
        return 1
    return climb_naive(n - 1) + climb_naive(n - 2)
```

```typescript
/** Ways to climb n stairs taking 1 or 2 steps at a time, by plain recursion. */
export function climbNaive(n: number): number {
  if (n <= 1) return 1;
  return climbNaive(n - 1) + climbNaive(n - 2);
}
```

The recurrence written directly, with both base cases folded into `n <= 1`.
The base case has to catch both 0 and 1. If it caught only `n == 1`, then
`climb_naive(2)` would call `climb_naive(0)`, which would call
`climb_naive(-1)` and never stop. With the base cases right, it is correct but slow: the 15 calls
for `n = 5` become millions at `n = 30`.

```python
def climb_memo(n: int) -> int:
    """The same count, but each subproblem is solved once and remembered."""
    memo: dict[int, int] = {}

    def ways(k: int) -> int:
        if k <= 1:
            return 1
        if k not in memo:
            memo[k] = ways(k - 1) + ways(k - 2)
        return memo[k]

    return ways(n)
```

```typescript
/** The same count, but each subproblem is solved once and remembered. */
export function climbMemo(n: number): number {
  const memo = new Map<number, number>();
  function ways(k: number): number {
    if (k <= 1) return 1;
    let known = memo.get(k);
    if (known === undefined) {
      known = ways(k - 1) + ways(k - 2);
      memo.set(k, known);
    }
    return known;
  }
  return ways(n);
}
```

The only change is the check against `memo` before computing and the store
after. The memo lives inside `climb_memo` rather than at module level so each
call starts empty; a module-level dict would stay filled between calls, which
is harmless here but wrong as soon as the answer depends on extra arguments.
The test is `k not in memo`, not `if memo[k]`: a stored answer of 0 is a
legitimate answer in other problems, and would be mistaken for "not computed".
TypeScript has the same trap, so it compares `memo.get(k)` with `undefined`
instead of testing it for truthiness. With the memo, `ways(5)` makes 9 calls
instead of 15, and in general 2n - 1 calls instead of exponentially many.

The recursion has a cost. It goes `n` calls deep before the first base case
returns. Python refuses to go deeper than its recursion limit, 1,000 frames by
default (`sys.getrecursionlimit()`): running it, `climb_memo(998)` works and
`climb_memo(999)` raises `RecursionError`. Raising the limit with
`sys.setrecursionlimit` works for moderate depths but risks crashing the
interpreter when the real stack runs out. TypeScript has the same ceiling
without a setting: in Node 24, `climbMemo(10000)` worked and `climbMemo(12000)`
threw a `RangeError`, and the exact point depends on the engine. The next
version avoids this, because a loop uses no extra stack.

```python
def climb_table(n: int) -> int:
    """The same count, filled in bottom-up from the smallest subproblem."""
    ways = [1] * (n + 1)
    for k in range(2, n + 1):
        ways[k] = ways[k - 1] + ways[k - 2]
    return ways[n]
```

```typescript
/** The same count, filled in bottom-up from the smallest subproblem. */
export function climbTable(n: number): number {
  const ways: number[] = new Array(n + 1).fill(1);
  for (let k = 2; k <= n; k++) {
    ways[k] = ways[k - 1] + ways[k - 2];
  }
  return ways[n];
}
```

Bottom-up flips the order. The table starts as all ones, which fills in both
base cases at once, and the loop starts at 2 because entries 0 and 1 are
already right. The order is what makes it correct: when the loop reaches `k`,
entries `k - 1` and `k - 2` were written on earlier passes. In a bottom-up
solution, getting that order right is the part you have to think about; the
recursive version worked it out for you. For `n = 5` the table ends as
`[1, 1, 2, 3, 5, 8]`. Using `n + 1` slots and not `n` is what makes `ways[n]`
exist, and it is also why `n = 0` works: the table has one slot and the loop
does nothing.

```python
def climb(n: int) -> int:
    """The same count, keeping only the last two table entries."""
    two_back, one_back = 1, 1
    for _ in range(2, n + 1):
        two_back, one_back = one_back, two_back + one_back
    return one_back
```

```typescript
/** The same count, keeping only the last two table entries. */
export function climb(n: number): number {
  let twoBack = 1;
  let oneBack = 1;
  for (let k = 2; k <= n; k++) {
    [twoBack, oneBack] = [oneBack, twoBack + oneBack];
  }
  return oneBack;
}
```

Entry `k` only reads `k - 1` and `k - 2`, so entries older than that are
dead weight. `two_back` and `one_back` hold `ways(k - 2)` and `ways(k - 1)`,
and each pass slides them forward by one. The two assignments must happen
together: writing `two_back = one_back` and then `one_back = two_back +
one_back` as separate statements would add the new `two_back` to itself and
lose the old value. The tuple assignment in Python and the destructuring
assignment in TypeScript evaluate the right side completely before assigning.
The loop never runs for `n = 0` or `n = 1`, so `one_back` is still 1, which is
right for both. This shrinking works only when each entry reads a fixed number
of entries just before it.

```python
def rob(nums: list[int]) -> int:
    """Largest total from non-negative amounts, no two adjacent houses taken."""
    skipped, best = 0, 0
    for amount in nums:
        skipped, best = best, max(best, skipped + amount)
    return best
```

```typescript
/** Largest total from non-negative amounts, no two adjacent houses taken. */
export function rob(nums: number[]): number {
  let skipped = 0;
  let best = 0;
  for (const amount of nums) {
    [skipped, best] = [best, Math.max(best, skipped + amount)];
  }
  return best;
}
```

This is the two-variable form, written directly. `best` is the answer for
the houses seen so far and `skipped` the answer one house earlier, which is
what you are allowed to build on if you take the current house. Both start at
0, the value of an empty street, so an empty list returns 0 with no special
case. In the new `best`, the first option is "skip this house" and the second
"take it and add it to `skipped`". If you wrote `best + amount` for the second
option you would be adding the house to a total that may already include its
neighbour, taking two adjacent houses; the brute-force test fails on exactly
that edit. The code assumes the amounts are not negative; with a negative
amount the `max` simply skips it, which is also correct.

```python
def lis_length(nums: list[int]) -> int:
    """Length of the longest strictly increasing subsequence of nums."""
    if not nums:
        return 0
    ending_at = [1] * len(nums)
```

```typescript
/** Length of the longest strictly increasing subsequence of `nums`. */
export function lisLength(nums: number[]): number {
  if (nums.length === 0) return 0;
  const endingAt: number[] = new Array(nums.length).fill(1);
```

`ending_at[i]` is the length of the longest strictly increasing subsequence
that ends exactly at index `i`. Every entry starts at 1, because a single
element is a subsequence of length 1, which also covers the case where nothing
before it is smaller. The early return handles an empty list, which would
otherwise reach `max` of an empty sequence: that raises `ValueError` in Python
and returns `-Infinity` in TypeScript.

```python
    for i in range(1, len(nums)):
        for j in range(i):
            if nums[j] < nums[i]:
                ending_at[i] = max(ending_at[i], ending_at[j] + 1)
    return max(ending_at)
```

```typescript
  for (let i = 1; i < nums.length; i++) {
    for (let j = 0; j < i; j++) {
      if (nums[j] < nums[i]) endingAt[i] = Math.max(endingAt[i], endingAt[j] + 1);
    }
  }
  return Math.max(...endingAt);
}
```

For each `i`, the inner loop tries every earlier index `j` as the element just
before `i`, and keeps the best. The comparison is strict `<`. With `<=`, equal
values would extend a subsequence, and `[3, 3, 3]` would give 3 instead of 1.
Entry `j` is final by the time `i` reads it, because `j < i` and the outer loop
goes left to right. The final `max` is over the whole table: for
`[1, 2, 3, 0]` the last entry is 1 but the answer is 3.

## Complexity

`climb_naive(n)` makes 2 * F(n + 1) - 1 calls, where F is the Fibonacci
sequence (1, 1, 2, 3, 5, 8, ...). Checked against the counts above: n = 5 gives
2 * 8 - 1 = 15 and n = 30 gives 2 * 1,346,269 - 1 = 2,692,537. Fibonacci
numbers grow by a factor of about 1.618 per step, so the time is exponential
in n, with O(n) stack depth.

The memoised and table versions run in O(n) time, since each of the n
subproblems is solved once with a constant amount of work. Both use O(n) extra
space: memoisation a dict of up to n entries plus a stack n calls deep, the
table a list of n + 1 entries. The two-variable `climb` and `rob` are also O(n)
time but use O(1) extra space.

`lis_length` is O(n²) time: the inner loop runs 0 + 1 + ... + (n - 1) =
n(n - 1) / 2 times, which is 499,500 for 1,000 elements. It uses O(n) space for
the table. An O(n log n) method exists, which keeps a sorted list of the
smallest possible final element for each subsequence length and uses
[binary search](/dsa/binary-search) to place each new element. It is not
implemented here. It can recover the subsequence too, with extra bookkeeping (a
predecessor index per element); the O(n²) table above needs only a backward
scan to do the same.

Numbers get big. Python integers are unbounded, so `climb(300)` is exact.
JavaScript numbers hold integers exactly only up to 2^53 - 1, which for stair
counts means `climb(77)` is exact (8,944,394,323,791,464) and `climb(78)` is
not. From n = 1,476 the TypeScript result is `Infinity`.

## Pitfalls

- **A wrong or missing base case.** If `n <= 1` is written `n == 1`, the
  recursion for `n = 2` calls `n = 0`, then `n = -1`, and never ends. In the
  table version, starting the loop at 1 or leaving entries at 0 gives wrong
  counts that look plausible.
- **Memoising in a way that breaks on falsy answers.** `if memo.get(k):` or
  `if (memo.get(k))` treats a stored 0 as missing and recomputes it. Test
  whether the key is present.
- **Hitting the recursion limit.** The memoised version fails just under 1,000
  stairs in Python (limit 1,000 calls by default) and somewhere above 10,000 in
  Node, depending on the engine. Use the table version for large inputs.
- **Wrong fill order bottom-up.** Reading `ways[k + 1]` or an entry not yet
  written gives garbage or an index error. Every entry must be computed after
  the entries it reads.
- **Shrinking the table too early.** Two variables work for stairs and house
  robber because each entry reads only the previous two. The LIS entry reads
  every earlier entry, so reducing its table to a few variables loses data.
- **Reading the LIS answer from the last entry.** The longest subsequence need
  not end at the last element, so the answer is the maximum entry.
- **Applying a greedy rule to house robber.** Both "every other house" and
  "largest first" are wrong, with the counterexamples under The idea.
