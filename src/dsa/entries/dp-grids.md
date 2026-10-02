---
title: 'Dynamic Programming: Grids'
summary: Counting or costing every right-and-down route across a grid by filling a table one cell at a time, where each cell is built from the cell above it and the cell to its left, then shrinking the table to one row.
date: 2026-10-01
kind: pattern
---

A grid problem asks for something about routes across a rectangle of cells:
how many routes there are, or which one is cheapest. A route here starts at the
top-left cell, ends at the bottom-right cell, and may only step **right** or
**down**. The number of routes grows explosively with the size of the grid, so
trying them all is out of reach. But every route into a cell arrives from one
of just two neighbours, and that observation turns the whole problem into
filling in a table.

## Prerequisites

- [Dynamic Programming: One Dimension](/dsa/dp-one-dimensional): this entry
  reuses its vocabulary without re-teaching it. A **subproblem** is a smaller
  version of the question, a **recurrence** is the rule that builds a
  subproblem's answer from smaller ones, and **tabulation** fills a table of
  answers from the smallest subproblem up. That entry also shows how to shrink
  a table to a few variables once each step only looks back a fixed distance;
  here the same idea shrinks a two-dimensional table to one row.

## The idea

Give every cell its own subproblem: the answer for the route from the top-left
cell to _that_ cell. Write `(r, c)` for the cell in row `r` and column `c`,
counting from 0 at the top-left. A route to `(r, c)` has to arrive from `(r - 1,
c)`, the cell above, or from `(r, c - 1)`, the cell to the left, because those
are the only cells that can step into it. So the answer for a cell is built
from the answers for those two cells, and each of those is built from its own
two neighbours, and so on back to the start. Filling the table row by row, left
to right, guarantees the cell above and the cell to the left are done before
any cell needs them.

**Unique paths.** Count the routes, treating a cell marked 1 as an obstacle that
no route may enter. Every route into `(r, c)` goes through the cell above or
the cell to the left, and no route goes through both, so the counts add:
`paths[r][c] = paths[r - 1][c] + paths[r][c - 1]`. An obstacle cell gets 0,
since no route ends there. The start gets 1: one route, the empty one. Here is
a 3 by 3 grid with an obstacle in the middle, and the filled table.

```text
grid        paths
0 0 0       1 1 1
0 1 0       1 0 1
0 0 0       1 1 2
```

The first row and first column have only one neighbour each. A cell in the
first row has nothing above it, so its count is just the count of the cell to
its left, and every cell in the first row is reached by the single route that
walks straight along the row. That is why an obstacle in the first row blocks
everything after it: the cell after the obstacle copies the obstacle's 0, the
cell after that copies the 0 again, and the row stays 0 to its end. (Cells
below can still be reached by going down before the obstacle.) The first column
works the same way going down. In the table above, the middle cell is 0 because
of the obstacle, and the bottom-right cell is 1 + 1 = 2, one route through the
cell above it and one through the cell to its left.

**Minimum path sum.** Now every cell holds a cost, and the question is the
smallest total cost of a route, counting the first and last cells. The route
into `(r, c)` should come from whichever neighbour has the cheaper best route:
`cost[r][c] = grid[r][c] + min(cost[r - 1][c], cost[r][c - 1])`. Taking the
cheaper neighbour is safe because the rest of the route, from `(r, c)` onward,
doesn't depend on how you got to `(r, c)`, so a cheaper way in is never worse.
For the grid with rows `[1, 3, 1]`, `[1, 5, 1]` and `[4, 2, 1]`:

| Cell     | Cost of the route into it                               |
| -------- | ------------------------------------------------------- |
| `(0, 0)` | 1                                                       |
| `(0, 1)` | 3 + 1 = 4                                               |
| `(0, 2)` | 1 + 4 = 5                                               |
| `(1, 0)` | 1 + 1 = 2                                               |
| `(1, 1)` | 5 + min(4 above, 2 left) = 7                            |
| `(1, 2)` | 1 + min(5 above, 7 left) = 6                            |
| `(2, 0)` | 4 + 2 = 6                                               |
| `(2, 1)` | 2 + min(7 above, 6 left) = 8                            |
| `(2, 2)` | 1 + min(6 above, 8 left) = 7, the answer: 1, 3, 1, 1, 1 |

**One row is enough.** Filling row `r` needs only row `r - 1` and the cells
already filled in row `r`. So a single array `row` of length `cols` can stand
in for the whole table. At the moment `row[c]` is about to be overwritten it
still holds the value for the cell above, from the previous row; the cell to
the left is `row[c - 1]`, already overwritten with this row's value. Going left
to right is therefore required here, not a convention. Going right to left
would read `row[c - 1]` before it has been updated, so the "left" neighbour
would be the cell above-left instead. On the grid above, a right-to-left pass
gives 3, though the true answer is 7.

## When to use it

The signal is a rectangle of cells, moves limited to two directions that never
let you return to a cell (right and down here), and a question that counts
routes or finds the best one. Variants stay in the same family: paths that may
also step diagonally add a third neighbour; a triangle of numbers where each
step goes down-left or down-right is a grid whose row `r` has `r + 1` cells,
where an edge cell has one cell above it to come from and an inner cell two;
counting
routes modulo a number just takes a remainder at each addition.

If a route may move in all four directions, this pattern stops working. A cell's
answer would depend on its neighbour on every side, including ones not filled
in yet, and a route can loop back through cells it has already used. Finding
the best route then becomes a shortest-path problem on a graph: when every
step costs the same, use [Graph Breadth-First Search](/dsa/graph-bfs), which
explores outward from the start one step at a time, and with different costs it
needs a different algorithm again. Counting routes gets no such replacement:
with revisits allowed there are infinitely many, and counting the routes that
never revisit a cell has no known efficient method.

## Walkthrough

```python
def unique_paths(grid: list[list[int]]) -> int:
    """Right/down paths from the top-left to the bottom-right avoiding 1-cells."""
    if not grid or not grid[0]:
        return 0
    rows, cols = len(grid), len(grid[0])
    paths = [[0] * cols for _ in range(rows)]
```

```typescript
/** Right/down paths from the top-left to the bottom-right avoiding 1-cells. */
export function uniquePaths(grid: number[][]): number {
  if (grid.length === 0 || grid[0].length === 0) return 0;
  const rows = grid.length;
  const cols = grid[0].length;
  const paths = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
```

The guard handles a grid with no rows or no cells, where there is no start to
reach, so the answer is 0. Without it, `grid[0]` would fail on an empty list.
The table is built with a comprehension (an `Array.from` in TypeScript) that
makes a fresh list for every row. The tempting shortcut `[[0] * cols] * rows`
repeats a single list `rows` times, so writing to one cell would change the same
column in every row. Every cell starts at 0, which is also the answer for an
unreachable cell, so the loop never needs to write a 0.

```python
    for r in range(rows):
        for c in range(cols):
            if grid[r][c] == 1:
                continue
            if r == 0 and c == 0:
                paths[r][c] = 1
            else:
                from_above = paths[r - 1][c] if r > 0 else 0
                from_left = paths[r][c - 1] if c > 0 else 0
                paths[r][c] = from_above + from_left
    return paths[rows - 1][cols - 1]
```

```typescript
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === 1) continue;
      if (r === 0 && c === 0) {
        paths[r][c] = 1;
      } else {
        const fromAbove = r > 0 ? paths[r - 1][c] : 0;
        const fromLeft = c > 0 ? paths[r][c - 1] : 0;
        paths[r][c] = fromAbove + fromLeft;
      }
    }
  }
  return paths[rows - 1][cols - 1];
}
```

An obstacle is skipped before anything else, leaving its 0 in place. That one
line also covers a blocked start: the start cell is skipped and never gets its
1, so every other cell adds up zeros and the answer is 0. Setting the start to
1 comes before the neighbour sum, because the start has no neighbours to sum.
For every other cell, the `if r > 0` and `if c > 0` tests stand in for the
neighbours that don't exist: in the first row there is no cell above, and
without the `r > 0` test, `paths[-1][c]` in Python would silently read the
_last_ row instead of failing. That row is still all zeros during the first
row, so this particular sum happens to survive, but the habit breaks the
moment a table doesn't start at zero. In TypeScript `paths[-1]` is
`undefined`, and indexing it throws.

```python
def min_path_sum(grid: list[list[int]]) -> int:
    """Smallest total of the cells on a right/down path from corner to corner."""
    if not grid or not grid[0]:
        return 0
    rows, cols = len(grid), len(grid[0])
    cost = [[0] * cols for _ in range(rows)]
    for r in range(rows):
        for c in range(cols):
            if r == 0 and c == 0:
                best = 0
            elif r == 0:
                best = cost[r][c - 1]
            elif c == 0:
                best = cost[r - 1][c]
            else:
                best = min(cost[r - 1][c], cost[r][c - 1])
            cost[r][c] = grid[r][c] + best
    return cost[rows - 1][cols - 1]
```

```typescript
/** Smallest total of the cells on a right/down path from corner to corner. */
export function minPathSum(grid: number[][]): number {
  if (grid.length === 0 || grid[0].length === 0) return 0;
  const rows = grid.length;
  const cols = grid[0].length;
  const cost = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let best: number;
      if (r === 0 && c === 0) best = 0;
      else if (r === 0) best = cost[r][c - 1];
      else if (c === 0) best = cost[r - 1][c];
      else best = Math.min(cost[r - 1][c], cost[r][c - 1]);
      cost[r][c] = grid[r][c] + best;
    }
  }
  return cost[rows - 1][cols - 1];
}
```

The four cases are the four ways a cell can have neighbours: none (the start),
only a left one (first row), only an upper one (first column), or both. Using
`min` of two neighbours for every cell would not work at the edges, because a
missing neighbour has no cost to compare with. Pretending a missing neighbour
costs 0 would be wrong too, since a cell on the first row would then be priced
as if it could be entered for free from above. So an edge cell takes its single
neighbour and nothing else. The start's `best` is 0 because the cost of a route
that has only entered the start is just the start's own cell. Nothing about this
needs the costs to be positive: with only right and down moves, no route can
revisit a cell, so negative costs are fine, unlike the shortest-path problems on
general graphs.

```python
def min_path_sum_rolling(grid: list[list[int]]) -> int:
    """Same answer as min_path_sum, keeping one row of length cols."""
    if not grid or not grid[0]:
        return 0
    rows, cols = len(grid), len(grid[0])
    row = [0] * cols
```

```typescript
/** Same answer as minPathSum, keeping one row of length cols. */
export function minPathSumRolling(grid: number[][]): number {
  if (grid.length === 0 || grid[0].length === 0) return 0;
  const rows = grid.length;
  const cols = grid[0].length;
  const row = new Array<number>(cols).fill(0);
```

The only state is one array the width of the grid. Its starting contents are
never read as a real value: the first cell of the first row uses a literal 0,
and every other cell in the first row reads only the cell to its left, which
has already been overwritten by then. So the initial zeros could be anything.

```python
    for r in range(rows):
        for c in range(cols):
            if r == 0 and c == 0:
                best = 0
            elif r == 0:
                best = row[c - 1]
            elif c == 0:
                best = row[c]
            else:
                best = min(row[c], row[c - 1])
            row[c] = grid[r][c] + best
    return row[cols - 1]
```

```typescript
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let best: number;
      if (r === 0 && c === 0) best = 0;
      else if (r === 0) best = row[c - 1];
      else if (c === 0) best = row[c];
      else best = Math.min(row[c], row[c - 1]);
      row[c] = grid[r][c] + best;
    }
  }
  return row[cols - 1];
}
```

This is the table version with `cost[r][c - 1]` renamed `row[c - 1]` and
`cost[r - 1][c]` renamed `row[c]`. Both renames rest on the order of the
loops. When the inner loop reaches `c`, columns `0` to `c - 1` of `row` have
been overwritten with row `r`, and columns `c` onward still hold row `r - 1`.
So `row[c - 1]` is the cell to the left and `row[c]` is the cell above, and
the assignment to `row[c]` is safe because the cell above is not needed again
once this cell is done: the next row's cell below reads the new value, which
is the new above. In the first column there is no left neighbour, so
`best = row[c]` alone is right. The loop must not run over `c` from the right:
that overwrites `row[c]` before `row[c - 1]` has been updated, which makes the
"left" value stale, as the 3 instead of 7 in "The idea" shows.

## Complexity

With `rows` rows and `cols` columns, every version does a constant amount of
work per cell, so time is O(rows × cols). The table versions use
O(rows × cols) extra space for the table. `min_path_sum_rolling` uses
O(cols), one row. You can also pick the shorter side of the grid as the row,
by working down columns, and store min(rows, cols) values.

The alternative is trying every route. With no obstacles, a route to the far
corner of an `n` by `n` grid makes `n - 1` steps right and `n - 1` steps down in
some order, so the count is the number of ways to choose which of the
2(n - 1) steps go down. For `n = 18` that is 34 steps, 17 of them down, and
C(34, 17) = 2,333,606,220 routes. The table needs 18 × 18 = 324 cells.

## Pitfalls

- **Right to left in the rolled row.** Reversing the inner loop makes
  `row[c - 1]` the stale previous-row value. It gives wrong answers (3 instead
  of 7 above) without any error.
- **Reading outside the table at the edges.** At `r = 0` or `c = 0` the
  neighbour is off the grid. In Python a negative index wraps around to the
  other end and returns a plausible but wrong number. In TypeScript a missing
  row (`paths[-1]`) is `undefined` and indexing it throws, while a missing
  column (`row[-1]`) is `undefined` and turns the arithmetic into `NaN`. Handle
  the first row and column explicitly.
- **Forgetting that an obstacle in the first row or column blocks the rest of
  it.** Seeding the whole first row with 1 skips the obstacle check and counts
  routes through it. Fill the first row from the same rule as the other cells,
  so the zero carries along.
- **Not checking the start.** A grid whose first or last cell is an obstacle
  has 0 routes. The code above gets that for free, but a version that hard-codes
  `paths[0][0] = 1` before the obstacle test returns a wrong count when the
  start is blocked.
- **Sharing rows when building the table.** `[[0] * cols] * rows` makes every
  row the same list.
- **Using this for four-direction movement.** Once a route can go up or left,
  cells depend on each other in cycles and no fill order exists. For the best
  route, treat the grid as a graph and search it, as in
  [Graph Breadth-First Search](/dsa/graph-bfs) when steps cost the same; for
  counting routes there is no efficient replacement.
