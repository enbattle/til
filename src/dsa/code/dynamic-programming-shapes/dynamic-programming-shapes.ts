// #region min-path-sum
/** Smallest total of a right/down path from the top-left to the bottom-right. */
export function minPathSum(grid: number[][]): number {
  if (grid.length === 0 || grid[0].length === 0) return 0;
  const rows = grid.length;
  const cols = grid[0].length;
  // One row is enough: a cell reads only the one above it and the one to
  // its left. row[0] = 0 and Infinity elsewhere let the first row and column
  // fall out of the same formula, with no special cases for the edges.
  const row: number[] = [];
  for (let c = 0; c < cols; c++) {
    row.push(Infinity);
  }
  row[0] = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // Before row[c] is overwritten it still holds the cell above;
      // row[c - 1] has just been overwritten, so it is the cell to the left.
      let best = row[c];
      if (c > 0) {
        best = Math.min(row[c], row[c - 1]);
      }
      row[c] = grid[r][c] + best;
    }
  }
  return row[cols - 1];
}
// #endregion

// #region knapsack-01
/** Best total value of items, each used at most once, weighing <= capacity. */
export function knapsack01(
  weights: number[],
  values: number[],
  capacity: number,
): number {
  const best: number[] = [];
  for (let c = 0; c <= capacity; c++) {
    best.push(0);
  }
  for (let i = 0; i < weights.length; i++) {
    const weight = weights[i];
    const value = values[i];
    // Downward: best[c - weight] must still be the row from before this
    // item. Upward would find it already updated and use the item twice.
    for (let c = capacity; c >= weight; c--) {
      best[c] = Math.max(best[c], best[c - weight] + value);
    }
  }
  return best[capacity];
}
// #endregion

// #region min-coins
/** Fewest coins, each usable any number of times, that sum to amount; -1 if none. */
export function minCoins(coins: number[], amount: number): number {
  // amount + 1 is above every real answer (at most amount coins), and adding
  // 1 to it keeps it above, so "impossible" never looks like a real count.
  const unreachable = amount + 1;
  const fewest: number[] = [];
  for (let a = 0; a <= amount; a++) {
    fewest.push(unreachable);
  }
  fewest[0] = 0;
  for (const coin of coins) {
    // Upward, the opposite of knapsack01: fewest[a - coin] may already
    // include this coin, which is exactly what lets a coin repeat.
    for (let a = coin; a <= amount; a++) {
      fewest[a] = Math.min(fewest[a], fewest[a - coin] + 1);
    }
  }
  if (fewest[amount] === unreachable) return -1;
  return fewest[amount];
}
// #endregion

// #region edit-distance
/** Fewest single-character inserts, deletes and replaces that turn a into b. */
export function editDistance(a: string, b: string): number {
  // table[i][j] is the distance between a[:i] and b[:j]. The first row and
  // column are the base cases: turning "" into j characters takes j inserts.
  const table: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    const line: number[] = [];
    for (let j = 0; j <= b.length; j++) {
      line.push(0);
    }
    table.push(line);
  }
  for (let i = 0; i <= a.length; i++) {
    table[i][0] = i;
  }
  for (let j = 0; j <= b.length; j++) {
    table[0][j] = j;
  }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        // Matching characters cost nothing; taking the diagonal is
        // never worse than any insert or delete here.
        table[i][j] = table[i - 1][j - 1];
      } else {
        const remove = table[i - 1][j]; // delete a[i - 1]
        const insert = table[i][j - 1]; // insert b[j - 1]
        const replace = table[i - 1][j - 1]; // replace a[i - 1] with b[j - 1]
        table[i][j] = 1 + Math.min(remove, insert, replace);
      }
    }
  }
  return table[a.length][b.length];
}
// #endregion
