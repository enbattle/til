---
title: 'Dynamic Programming: Common Shapes'
summary: Most dynamic-programming problems fit one of a few table shapes, such as a grid, a budget or two sequences, and spotting the shape tells you the state, the order to fill it and the recurrence.
date: 2026-10-05
kind: pattern
---

Once you can write a recurrence, the hard part of a new problem is guessing its state. Three shapes hand it to you, and you'll run a small example through each.

## Prerequisites

- [Dynamic Programming: Memoization and Tabulation](/dsa/dynamic-programming): the state, recurrence and base case, filling a table bottom-up, and shrinking it to the part you still read.

## The idea

What does the problem give you to walk along? A grid gives a cell, `(r, c)`. A budget gives how much is spent, one number. Two sequences give a prefix of each, `(i, j)`.

**Grid.** Move only right or down from the top-left to the bottom-right and minimize the sum of the cells you step on. Every cell is entered from above or from the left, so `cost(r, c) = grid[r][c] + min(cost(r - 1, c), cost(r, c - 1))`, and the top-left cell costs just itself. Filled for `[[1, 3, 1], [1, 5, 1], [4, 2, 1]]`:

| 1   | 4   | 5   |
| --- | --- | --- |
| 2   | 7   | 6   |
| 6   | 8   | 7   |

The corner holds the answer, 7. To count paths, replace `min` with a sum.

**Knapsack.** Each item has a weight and a value, the bag holds `capacity`, and each item goes in once. Keep one row, `best[c]`, the most value that fits in `c`, and fold the items in one at a time. With weights `[1, 3, 4]`, values `[2, 4, 5]` and capacity 4:

| After        | c=0 | c=1 | c=2 | c=3 | c=4 |
| ------------ | --- | --- | --- | --- | --- |
| no items     | 0   | 0   | 0   | 0   | 0   |
| item (1 / 2) | 0   | 2   | 2   | 2   | 2   |
| item (3 / 4) | 0   | 2   | 2   | 4   | 6   |
| item (4 / 5) | 0   | 2   | 2   | 4   | 6   |

The answer is 6, the first two items. The most valuable single item is worth only 5.

Coin change is the same row with two changes: a coin can be used any number of times, and the value is "one coin", minimized. Take coins `{1, 3, 4}` and amount 6, the example where [greedy](/dsa/greedy) fails (largest first pays 4 + 1 + 1). Here 7 means unreachable:

| After  | 0   | 1   | 2   | 3   | 4   | 5   | 6   |
| ------ | --- | --- | --- | --- | --- | --- | --- |
| start  | 0   | 7   | 7   | 7   | 7   | 7   | 7   |
| coin 1 | 0   | 1   | 2   | 3   | 4   | 5   | 6   |
| coin 3 | 0   | 1   | 2   | 1   | 2   | 3   | 2   |
| coin 4 | 0   | 1   | 2   | 1   | 1   | 2   | 2   |

Two coins, 3 + 3. When counting ways, loop order matters: amounts outside and coins inside counts orderings, so coins 1, 2 and amount 3 give 3, not 2 combinations.

**Two sequences.** To turn `"abc"` into `"yabd"` with single-character inserts, deletes and replaces, let `table[i][j]` be the distance between the first `i` characters of one string and the first `j` of the other. If the last characters match, the cell copies its diagonal neighbor. Otherwise it is 1 plus the cheapest of three neighbors: above (delete), left (insert) and diagonal (replace). An empty prefix costs one insert or delete per character, which fills the first row and column.

| a \ b | ""  | y   | a   | b   | d   |
| ----- | --- | --- | --- | --- | --- |
| ""    | 0   | 1   | 2   | 3   | 4   |
| a     | 1   | 1   | 1   | 2   | 3   |
| b     | 2   | 2   | 2   | 1   | 2   |
| c     | 3   | 3   | 3   | 2   | 2   |

The answer is 2: insert `y`, replace `c` with `d`. For the longest common subsequence a match is diagonal + 1 and a mismatch is the larger of above and left, with borders of 0 rather than 0 to n.

**Interval DP** has a range `(i, j)` of one sequence as its state, filled by increasing length, and fits when the answer for a stretch depends on where you split it (matrix-chain order, bursting balloons). **State-machine DP** adds a small mode to the index, such as holding a stock or in cooldown, and fits when what you may do next depends on what you did last.

## When to use it

- "Right or down" movement across a grid, asking for a count or a best total: the grid shape. If a path can also go up or left, cells depend on each other in cycles and no fill order exists. Search the grid as a graph instead: [breadth-first search](/dsa/breadth-first-search) when every step costs the same, [shortest paths](/dsa/shortest-paths) when cells have costs. Counting walks then has no finite answer, since revisits allow infinitely many.
- A list of items and a limit (a capacity, a target sum, an amount), where you pick a subset to maximize, minimize, count or just make possible: the knapsack shape.
- Two strings or arrays, asked how alike they are or how to turn one into the other: the two-sequences shape.
- The answer for a stretch depends on a split point: interval DP.
- Rules about what you may do next depend on what you just did: state-machine DP.

## Walkthrough

```python region=min-path-sum

```

```typescript region=min-path-sum

```

On the example the row ends as `[6, 8, 7]`, the last row of the table above. The budget shape keeps a row too, indexed by capacity instead of column.

```python region=knapsack-01

```

```typescript region=knapsack-01

```

The row takes the values of the table above, one item at a time. Coin change keeps the same row and flips the direction.

```python region=min-coins

```

```typescript region=min-coins

```

The row ends as `[0, 1, 2, 1, 1, 2, 2]`, so `min_coins([1, 3, 4], 6)` is 2. The last shape tracks two indexes at once.

```python region=edit-distance

```

```typescript region=edit-distance

```

On `"abc"` and `"yabd"` it returns the corner, 2. To recover the edits themselves, walk back from the corner to the neighbor each cell came from, which needs the whole table. If you only want the distance, one row plus one saved diagonal value is enough.

## Complexity

Every shape does constant work per state, so the time is the number of states. The grid takes O(rows × cols) time and the rolled row O(cols) space, against C(2(n - 1), n - 1) routes through an n by n grid: 2,333,606,220 for n = 18, where the table has 324 cells.

`knapsack_01` takes O(n × capacity) time and O(capacity) space, and `min_coins` O(coins × amount) time and O(amount) space. These are **pseudo-polynomial**: the work grows with the value of the capacity, not its number of digits, so a capacity of a billion is ten digits and a billion cells. Trying every subset costs O(2^n): 40 items is about a trillion, against 40,000 updates at capacity 1,000. `edit_distance` takes O(n × m) time and space for strings of length n and m, one cell per pair of prefixes.

## Pitfalls

- **Sweeping `knapsack_01` upward.** With `range(weight, capacity + 1)` the example returns 8, not 6: the first item is reused four times, because `best[c - weight]` has already been updated.
- **Sweeping `min_coins` downward.** The example returns -1, because every cell reads an amount this coin hasn't reached yet, so no coin ever repeats.
- **Starting the grid row at zeros.** With `[0] * cols` instead of `inf` the example returns 3, not 7: the top row sees a free cell above it and ignores its left neighbor's cost. Without the `c == 0` test, Python's `row[c - 1]` wraps to the last column.
- **Leaving the edit-distance borders at zero.** Without the `table[0][j] = j` loop, `"abc"` to `"yabd"` returns 1, as if building a string from nothing were free.
