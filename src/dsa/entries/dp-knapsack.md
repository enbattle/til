---
title: 'Dynamic Programming: Knapsack'
summary: One row of capacities updated in the right direction solves pick-the-best-items, fewest-coins and count-the-ways problems, and the direction of one loop decides whether an item can be used once or many times.
date: 2026-10-01
kind: pattern
---

Knapsack is dynamic programming over a budget. You have a limit (a weight a bag
can carry, an amount of money to make) and a list of things to spend it on, and
you want the best way to spend it: the most value, the fewest pieces, or the
number of different ways. The state is "how much of the budget is used", so
the table is one row long, and the one decision that matters is the direction
you sweep along that row.

## Prerequisites

- [Dynamic Programming: One Dimension](/dsa/dp-one-dimensional): this entry
  relies on its ideas without re-teaching them: a subproblem, a recurrence that
  builds a bigger answer from smaller ones, filling a table from the bottom up,
  and shrinking a table to the part you still need.

## The idea

**0/1 knapsack.** You have items, each with a weight and a value, and a bag
that holds at most `capacity` weight. Each item can go in the bag once or not
at all (that is the "0/1"). Choose items to maximise the total value. Take
weights `[1, 3, 4, 5]`, values `[1, 4, 5, 7]` and capacity 7.

The subproblem is `table[i][c]`: the best value using only the first `i` items
with a bag of capacity `c`. For item `i` there are two choices. Leave it out,
and the answer is `table[i - 1][c]`. Take it (only if its weight fits in `c`),
and you get its value plus the best you can do with the remaining capacity
using earlier items: `table[i - 1][c - weight] + value`. The cell is the
larger of the two. Row 0, with no items, is all zeros.

| item (weight, value) | c=0 | 1   | 2   | 3   | 4   | 5   | 6   | 7   |
| -------------------- | --- | --- | --- | --- | --- | --- | --- | --- |
| none                 | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 0   |
| (1, 1)               | 0   | 1   | 1   | 1   | 1   | 1   | 1   | 1   |
| (3, 4)               | 0   | 1   | 1   | 4   | 5   | 5   | 5   | 5   |
| (4, 5)               | 0   | 1   | 1   | 4   | 5   | 6   | 6   | 9   |
| (5, 7)               | 0   | 1   | 1   | 4   | 5   | 7   | 8   | 9   |

Check one cell. In the (4, 5) row at capacity 7, leaving the item out gives 5
(the cell above). Taking it leaves capacity 3, where the row above holds 4,
and 4 + 5 = 9, the larger. The answer is the bottom-right cell, 9: the items
of weight 3 and 4, which fill the bag exactly.

Each row reads only the row above it, so one row is enough, updated in place.
The catch is the order. When item `i` writes `best[c]`, it reads `best[c -
weight]`, and that cell must still hold the answer from before this item. Cells
with a smaller index are overwritten by this item too, so you must visit
capacities from **high to low**: the smaller indexes haven't been touched yet.

Run it low to high and an item can be used twice. Take a single item of weight
2 and value 3, capacity 4. The right row after the item is `[0, 0, 3, 3, 3]`:
the bag has room for two copies, but there is only one. Going high to low,
`best[4]` reads `best[2]`, still 0, so it becomes 3. Going low to high,
`best[2]` becomes 3 first, then `best[4]` reads that new `best[2]` and becomes
3 + 3 = 6: the same item counted twice, giving `[0, 0, 3, 3, 6]`.

**Unbounded: fewest coins.** Now suppose every item can be used as many times
as you like. That is exactly what the low-to-high order does, so it becomes
the right order here, on purpose: `best[c - weight]` may already include the
current item, and the current item may be added again. Coins fit this shape:
with coins 1, 3 and 4, find the fewest coins that add up to 6. A greedy
strategy, always taking the largest coin that fits, takes 4, then 1, then 1:
three coins. The best is 3 + 3: two coins. The table `fewest[a]`, the fewest
coins for amount `a`, is built from the recurrence "try each coin as the last
one": `fewest[a] = 1 + min(fewest[a - coin])` over the coins that are at most
`a`. For amounts 0 to 6 it reads `[0, 1, 2, 1, 1, 2, 2]`. For amount 6 the
three candidates are 1 + `fewest[5]` = 3, 1 + `fewest[3]` = 2 and 1 +
`fewest[2]` = 3, so the answer is 2. Amounts that can't be made at all (coins
of 2 only, amount 3) are marked with a sentinel, a value that can't be a real
answer, and reported as -1.

**Counting ways.** Counting how many ways to make an amount adds a question:
does the order of the coins matter? With coins 1 and 2 and amount 3, 1 + 2 and
2 + 1 are the same **combination** but two different **orderings**. Counting
combinations gives 2 (1 + 1 + 1 and 1 + 2); counting orderings gives 3 (those
two, plus 2 + 1). The two counts come from the same recurrence with the two
loops swapped, as the walkthrough shows.

## When to use it

Look for a budget (a capacity, a target sum, an amount) and a list of things
each used or not used, where you want an optimum or a count. Choosing which
tasks fit in a time limit, splitting numbers into two groups with equal sums
(subset sum, a 0/1 knapsack where each value equals its weight and the question
is whether the total can be hit exactly), making change, and counting the
number of ways to reach a target all have this shape.

Decide first whether each item is usable once (high to low) or many times (low
to high), and whether you need an optimum (take a `max` or `min`) or a count
(add). It also fits only when the budget is a modest whole number, because the
table is as long as the budget. Greedy choices such as "most valuable per
weight first" are not safe here: the coin example above is a case where taking
the largest coin gives a worse answer.

## Walkthrough

```python
def knapsack_table(weights: list[int], values: list[int], capacity: int) -> int:
    """Best total value of items (each used at most once) weighing at most capacity.

    Weights are positive and capacity is at least 0.
    """
    n = len(weights)
    table = [[0] * (capacity + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        weight, value = weights[i - 1], values[i - 1]
        for c in range(capacity + 1):
            table[i][c] = table[i - 1][c]
            if weight <= c:
                table[i][c] = max(table[i][c], table[i - 1][c - weight] + value)
    return table[n][capacity]
```

```typescript
/** Best total value of items (each used at most once) weighing at most `capacity`. */
export function knapsackTable(
  weights: number[],
  values: number[],
  capacity: number,
): number {
  const n = weights.length;
  const table: number[][] = Array.from({ length: n + 1 }, () =>
    new Array(capacity + 1).fill(0),
  );
  for (let i = 1; i <= n; i++) {
    const weight = weights[i - 1];
    const value = values[i - 1];
    for (let c = 0; c <= capacity; c++) {
      table[i][c] = table[i - 1][c];
      if (weight <= c) {
        table[i][c] = Math.max(table[i][c], table[i - 1][c - weight] + value);
      }
    }
  }
  return table[n][capacity];
}
```

This is the table from "The idea". The table has `n + 1` rows and `capacity +
1` columns, because row 0 means "no items" and column 0 means "no room", and
both need a cell. Item `i` is `weights[i - 1]` because of that shift by one.
Each cell starts as the "leave it out" answer copied from the row above, and
the "take it" option is considered only when `weight <= c`. Without that
guard, `c - weight` would be negative and index from the other end of the list
in Python, silently reading a wrong cell; in TypeScript it reads `undefined`
and the sum becomes `NaN`. The `<=` matters: an item that exactly fills the
bag must still fit.

```python
def knapsack_01(weights: list[int], values: list[int], capacity: int) -> int:
    """The same answer as knapsack_table, keeping one row of capacities."""
    best = [0] * (capacity + 1)
    for weight, value in zip(weights, values):
        for c in range(capacity, weight - 1, -1):
            best[c] = max(best[c], best[c - weight] + value)
    return best[capacity]
```

```typescript
/** The same answer as `knapsackTable`, keeping one row of capacities. */
export function knapsack01(
  weights: number[],
  values: number[],
  capacity: number,
): number {
  const best: number[] = new Array(capacity + 1).fill(0);
  weights.forEach((weight, i) => {
    for (let c = capacity; c >= weight; c--) {
      best[c] = Math.max(best[c], best[c - weight] + values[i]);
    }
  });
  return best[capacity];
}
```

The whole 2-D table collapses to the single list `best`, where `best[c]` holds
the value of the row above until the current item overwrites it. The inner loop
counts down from `capacity`, so `best[c - weight]` always sits at a smaller
index that this item hasn't reached yet, and it still means "without this
item". The loop stops at `weight`, not 0, because below that the item doesn't
fit, and the range's end is `weight - 1` in Python only because Python's
`range` excludes its end. Counting up instead is the bug from "The idea": the
tests use a single item of weight 2 and value 3 at capacity 4, which must
return 3 and not 6.

```python
def unbounded_knapsack(weights: list[int], values: list[int], capacity: int) -> int:
    """Best total value when every item may be used any number of times."""
    best = [0] * (capacity + 1)
    for weight, value in zip(weights, values):
        for c in range(weight, capacity + 1):
            best[c] = max(best[c], best[c - weight] + value)
    return best[capacity]
```

```typescript
/** Best total value when every item may be used any number of times. */
export function unboundedKnapsack(
  weights: number[],
  values: number[],
  capacity: number,
): number {
  const best: number[] = new Array(capacity + 1).fill(0);
  weights.forEach((weight, i) => {
    for (let c = weight; c <= capacity; c++) {
      best[c] = Math.max(best[c], best[c - weight] + values[i]);
    }
  });
  return best[capacity];
}
```

This is the same code with the loop reversed, and that is the whole
difference. Counting up, `best[c - weight]` has already been through this
item, so it may include one or more copies of it, and adding `value` puts in
one more. With the single item (weight 2, value 3) and capacity 4 it returns
6: two copies. The loop's start is still `weight`, since a smaller capacity
can't hold even one copy.

```python
def min_coins(coins: list[int], amount: int) -> int:
    """Fewest coins (each reusable) that sum to amount, or -1 if impossible."""
    unreachable = amount + 1
    fewest = [0] + [unreachable] * amount
    for a in range(1, amount + 1):
        for coin in coins:
            if coin <= a:
                fewest[a] = min(fewest[a], fewest[a - coin] + 1)
    return fewest[amount] if fewest[amount] < unreachable else -1
```

```typescript
/** Fewest coins (each reusable) that sum to `amount`, or -1 if impossible. */
export function minCoins(coins: number[], amount: number): number {
  const unreachable = amount + 1;
  const fewest: number[] = new Array(amount + 1).fill(unreachable);
  fewest[0] = 0;
  for (let a = 1; a <= amount; a++) {
    for (const coin of coins) {
      if (coin <= a) fewest[a] = Math.min(fewest[a], fewest[a - coin] + 1);
    }
  }
  return fewest[amount] < unreachable ? fewest[amount] : -1;
}
```

Amount 0 takes zero coins, so `fewest[0]` is 0, and every other amount starts
as `unreachable`, standing for "no way found yet". The sentinel is `amount +
1` because the best possible answer uses coins of at least 1, so it never
needs more than `amount` coins, and `amount + 1` can never be a real answer.
An unreachable neighbour then yields `unreachable + 1`, which is larger than
the cell's own starting value, so `min` ignores it and no special case is
needed. At the end, a cell that still holds the sentinel means no combination
of coins adds up, and the function returns -1: with coins `[2]` and amount 3,
`fewest[3]` stays 4. Returning the cell itself would hand the caller a number
that looks like a coin count.

```python
def count_combinations(coins: list[int], amount: int) -> int:
    """Ways to make amount where the order of the coins does not matter."""
    ways = [1] + [0] * amount
    for coin in coins:
        for a in range(coin, amount + 1):
            ways[a] += ways[a - coin]
    return ways[amount]
```

```typescript
/** Ways to make `amount` where the order of the coins does not matter. */
export function countCombinations(coins: number[], amount: number): number {
  const ways: number[] = new Array(amount + 1).fill(0);
  ways[0] = 1;
  for (const coin of coins) {
    for (let a = coin; a <= amount; a++) ways[a] += ways[a - coin];
  }
  return ways[amount];
}
```

`ways[a]` is the number of ways to make `a`; there is exactly one way to make
0, the empty selection, and that 1 is what every other count grows from.
With the coins in the outer loop, each pass adds one coin type to the pool and
counts the ways that use it on top of the ways that use only earlier coin
types. A selection is therefore built in one fixed order (all the 1s, then all
the 2s), so 1 + 2 and 2 + 1 can't both appear. For coins `[1, 2]` and amount 3,
the row starts as `[1, 0, 0, 0]`, becomes `[1, 1, 1, 1]` after the 1-coin pass
and `[1, 1, 2, 2]` after the 2-coin pass: 2 combinations.

```python
def count_orderings(coins: list[int], amount: int) -> int:
    """Ways to make amount where 1 + 2 and 2 + 1 count as different."""
    ways = [1] + [0] * amount
    for a in range(1, amount + 1):
        for coin in coins:
            if coin <= a:
                ways[a] += ways[a - coin]
    return ways[amount]
```

```typescript
/** Ways to make `amount` where 1 + 2 and 2 + 1 count as different. */
export function countOrderings(coins: number[], amount: number): number {
  const ways: number[] = new Array(amount + 1).fill(0);
  ways[0] = 1;
  for (let a = 1; a <= amount; a++) {
    for (const coin of coins) {
      if (coin <= a) ways[a] += ways[a - coin];
    }
  }
  return ways[amount];
}
```

Only the loops changed places, and with them the meaning. With the amount in
the outer loop, `ways[a]` sums over every coin that could be the last one
placed, whatever came before, so each different sequence is counted. For coins
`[1, 2]` the row is `[1, 1, 2, 3]`: `ways[2]` is `ways[1]` (a 1 last) plus
`ways[0]` (a 2 last) = 2, and `ways[3]` is `ways[2]` + `ways[1]` = 3, the
sequences 1 + 1 + 1, 1 + 2 and 2 + 1. The `coin <= a` guard is needed here
for the same reason as in `min_coins`: without it, a coin larger than the
amount reads a negative index.

## Complexity

The 2-D `knapsack_table` does constant work for each of `n + 1` rows times
`capacity + 1` columns: O(n × capacity) time and O(n × capacity) space.
`knapsack_01` does the same work in O(capacity) space, one row. `min_coins`
and the two counting functions take O(amount × number of coins) time and
O(amount) space.

These costs are **pseudo-polynomial**: polynomial in the number the input
contains, not in the size of the input. The capacity is written with a few
digits, but the work grows with its value. A capacity of 1,000 means about
1,000 columns; a capacity of 1,000,000,000 is ten digits and a billion
columns, and each extra digit multiplies the work by ten. Knapsack is a
hard problem in general, and this algorithm is fast only while the capacity
stays modest. For comparison, trying every subset costs O(2^n): 20 items means
about a million subsets, 40 items about a trillion, while the table for 40
items and capacity 1,000 has about 41,000 cells.

## Pitfalls

- **Wrong loop direction.** High to low for 0/1, low to high for unbounded.
  Mixing them up either lets an item in twice (a 0/1 problem with an upward
  loop returns 6 instead of 3 in the example above) or forbids a second copy
  (an unbounded problem with a downward loop).
- **Swapping the two loops when counting.** Coins outside, amounts inside
  counts combinations; amounts outside, coins inside counts orderings. For
  coins 1 and 2 and amount 3 that is 2 against 3, so the wrong order gives a
  wrong answer without any error.
- **Forgetting the unreachable case.** Reporting `fewest[amount]` directly
  returns the sentinel when no combination works. Return -1 instead. Starting
  every cell at 0 instead of the sentinel is worse: `min` then picks 0 for
  every cell, so every amount, possible or not, reports needing no coins.
- **Initialising `ways[0]` to 0.** The single way to make 0 is the base every
  other count builds on; with 0 there, every count stays 0.
- **Trusting greedy.** Taking the biggest coin first returns 3 coins for coins
  1, 3, 4 and amount 6, where 2 is possible. Greedy works only for special coin
  sets, such as common currencies, and the table makes no such assumption.
- **A zero or negative weight or coin.** A coin of 0 makes `a - coin` equal to
  `a`, so a cell is computed from itself, and in the counting functions it
  would add a cell to itself repeatedly. These functions assume every weight
  and coin is a positive whole number.
- **Large counts in TypeScript.** The number of ways grows quickly. Python
  integers have no limit, but a TypeScript `number` is exact only up to 2^53
  (about 9 quadrillion); beyond that, use `BigInt`.
