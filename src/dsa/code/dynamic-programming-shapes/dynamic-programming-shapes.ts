/** Smallest total of a right/down path from the top-left to the bottom-right. */
export function minPathSum(grid: number[][]): number {
  if (grid.length === 0 || grid[0].length === 0) return 0;
  // One row is enough: a cell reads only the one above it and the one to
  // its left. row[0] = 0 and Infinity elsewhere let the first row and column
  // fall out of the same formula, with no special cases for the edges.
  const row = [0, ...new Array<number>(grid[0].length - 1).fill(Infinity)];
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[0].length; c++) {
      // Before row[c] is overwritten it still holds the cell above;
      // row[c - 1] has just been overwritten, so it is the cell to the left.
      const best = c === 0 ? row[c] : Math.min(row[c], row[c - 1]);
      row[c] = grid[r][c] + best;
    }
  }
  return row[row.length - 1];
}

/** Best total value of items, each used at most once, weighing <= capacity. */
export function knapsack01(
  weights: number[],
  values: number[],
  capacity: number,
): number {
  const best = new Array<number>(capacity + 1).fill(0);
  for (let i = 0; i < weights.length; i++) {
    const [weight, value] = [weights[i], values[i]];
    // Downward: best[c - weight] must still be the row from before this
    // item. Upward would find it already updated and use the item twice.
    for (let c = capacity; c >= weight; c--) {
      best[c] = Math.max(best[c], best[c - weight] + value);
    }
  }
  return best[capacity];
}

/** Fewest coins, each usable any number of times, that sum to amount; -1 if none. */
export function minCoins(coins: number[], amount: number): number {
  // amount + 1 is above every real answer (at most amount coins), and adding
  // 1 to it keeps it above, so "impossible" never looks like a real count.
  const unreachable = amount + 1;
  const fewest = [0, ...new Array<number>(amount).fill(unreachable)];
  for (const coin of coins) {
    // Upward, the opposite of knapsack01: fewest[a - coin] may already
    // include this coin, which is exactly what lets a coin repeat.
    for (let a = coin; a <= amount; a++) {
      fewest[a] = Math.min(fewest[a], fewest[a - coin] + 1);
    }
  }
  return fewest[amount] < unreachable ? fewest[amount] : -1;
}

/** Fewest single-character inserts, deletes and replaces that turn a into b. */
export function editDistance(a: ArrayLike<string>, b: ArrayLike<string>): number {
  // table[i][j] is the distance between a[:i] and b[:j]. The first row and
  // column are the base cases: turning "" into j characters takes j inserts.
  const table = Array.from({ length: a.length + 1 }, (_, i) => [
    i,
    ...new Array<number>(b.length).fill(0),
  ]);
  table[0] = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        // Matching characters cost nothing; taking the diagonal is
        // never worse than any insert or delete here.
        table[i][j] = table[i - 1][j - 1];
      } else {
        table[i][j] =
          1 +
          Math.min(
            table[i - 1][j], // delete a[i - 1]
            table[i][j - 1], // insert b[j - 1]
            table[i - 1][j - 1], // replace a[i - 1] with b[j - 1]
          );
      }
    }
  }
  return table[a.length][b.length];
}
