/** table[i][j]: length of the longest palindromic subsequence of s[i..j]. */
export function lpsTable(s: string): number[][] {
  const n = s.length;
  const table = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) table[i][i] = 1;
  for (let length = 2; length <= n; length++) {
    for (let i = 0; i + length <= n; i++) {
      const j = i + length - 1;
      if (s[i] === s[j]) {
        table[i][j] = table[i + 1][j - 1] + 2;
      } else {
        table[i][j] = Math.max(table[i + 1][j], table[i][j - 1]);
      }
    }
  }
  return table;
}

/** Length of the longest palindromic subsequence of `s` (0 for an empty `s`). */
export function lpsLength(s: string): number {
  if (s.length === 0) return 0;
  return lpsTable(s)[0][s.length - 1];
}

/** One longest palindromic subsequence of `s`, read back out of the table. */
export function longestPalindromicSubsequence(s: string): string {
  if (s.length === 0) return '';
  const table = lpsTable(s);
  let i = 0;
  let j = s.length - 1;
  const outer: string[] = [];
  let middle = '';
  while (i <= j) {
    if (i === j) {
      middle = s[i];
      break;
    }
    if (s[i] === s[j]) {
      outer.push(s[i]);
      i++;
      j--;
    } else if (table[i + 1][j] >= table[i][j - 1]) {
      i++;
    } else {
      j--;
    }
  }
  const half = outer.join('');
  return half + middle + [...half].reverse().join('');
}

/** Matrix k is dims[k] x dims[k + 1]. Returns [cost, split] for every range. */
export function matrixChainTables(dims: number[]): [number[][], number[][]] {
  const n = dims.length - 1;
  const cost = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  const split = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let length = 2; length <= n; length++) {
    for (let i = 0; i + length <= n; i++) {
      const j = i + length - 1;
      let best = Infinity;
      for (let k = i; k < j; k++) {
        const total = cost[i][k] + cost[k + 1][j] + dims[i] * dims[k + 1] * dims[j + 1];
        if (total < best) {
          best = total;
          split[i][j] = k;
        }
      }
      cost[i][j] = best;
    }
  }
  return [cost, split];
}

/** Fewest scalar multiplications to multiply the whole chain (0 if no pair). */
export function matrixChainCost(dims: number[]): number {
  const n = dims.length - 1;
  if (n < 1) return 0;
  return matrixChainTables(dims)[0][0][n - 1];
}

/** Bracketed multiplication order for matrices i..j, e.g. '((A1 A2) A3)'. */
export function parenthesize(split: number[][], i: number, j: number): string {
  if (i === j) return `A${i + 1}`;
  const k = split[i][j];
  return `(${parenthesize(split, i, k)} ${parenthesize(split, k + 1, j)})`;
}

/** The fewest multiplications and one order that achieves it. */
export function matrixChainOrder(dims: number[]): [number, string] {
  const n = dims.length - 1;
  if (n < 1) return [0, ''];
  const [cost, split] = matrixChainTables(dims);
  return [cost[0][n - 1], parenthesize(split, 0, n - 1)];
}
