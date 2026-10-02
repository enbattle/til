/** Ways to climb n stairs taking 1 or 2 steps at a time, by plain recursion. */
export function climbNaive(n: number): number {
  if (n <= 1) return 1;
  return climbNaive(n - 1) + climbNaive(n - 2);
}

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

/** The same count, filled in bottom-up from the smallest subproblem. */
export function climbTable(n: number): number {
  const ways: number[] = new Array(n + 1).fill(1);
  for (let k = 2; k <= n; k++) {
    ways[k] = ways[k - 1] + ways[k - 2];
  }
  return ways[n];
}

/** The same count, keeping only the last two table entries. */
export function climb(n: number): number {
  let twoBack = 1;
  let oneBack = 1;
  for (let k = 2; k <= n; k++) {
    [twoBack, oneBack] = [oneBack, twoBack + oneBack];
  }
  return oneBack;
}

/** Largest total from non-negative amounts, no two adjacent houses taken. */
export function rob(nums: number[]): number {
  let skipped = 0;
  let best = 0;
  for (const amount of nums) {
    [skipped, best] = [best, Math.max(best, skipped + amount)];
  }
  return best;
}

/** Length of the longest strictly increasing subsequence of `nums`. */
export function lisLength(nums: number[]): number {
  if (nums.length === 0) return 0;
  const endingAt: number[] = new Array(nums.length).fill(1);
  for (let i = 1; i < nums.length; i++) {
    for (let j = 0; j < i; j++) {
      if (nums[j] < nums[i]) endingAt[i] = Math.max(endingAt[i], endingAt[j] + 1);
    }
  }
  return Math.max(...endingAt);
}
