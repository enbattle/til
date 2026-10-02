/** Right/down paths from the top-left to the bottom-right avoiding 1-cells. */
export function uniquePaths(grid: number[][]): number {
  if (grid.length === 0 || grid[0].length === 0) return 0;
  const rows = grid.length;
  const cols = grid[0].length;
  const paths = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
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

/** Same answer as minPathSum, keeping one row of length cols. */
export function minPathSumRolling(grid: number[][]): number {
  if (grid.length === 0 || grid[0].length === 0) return 0;
  const rows = grid.length;
  const cols = grid[0].length;
  const row = new Array<number>(cols).fill(0);
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
