/** [start, end], half-open: includes start, not end. */
export type Interval = [number, number];

/** A largest set of pairwise non-overlapping intervals (start < end each). */
export function selectIntervals(intervals: Interval[]): Interval[] {
  const chosen: Interval[] = [];
  const byEnd = [...intervals].sort((a, b) => a[1] - b[1]);
  for (const [start, end] of byEnd) {
    const last = chosen[chosen.length - 1];
    if (last === undefined || start >= last[1]) {
      chosen.push([start, end]);
    }
  }
  return chosen;
}

/**
 * Can you get from index 0 to the last index? `jumps[i]` >= 0 is the longest
 * jump from i; any shorter jump is allowed too. An empty array has no last index.
 */
export function canReachEnd(jumps: number[]): boolean {
  if (jumps.length === 0) return false;
  let farthest = 0;
  for (let i = 0; i < jumps.length; i++) {
    if (i > farthest) return false;
    farthest = Math.max(farthest, i + jumps[i]);
  }
  return true;
}

/**
 * Coins used by always taking the largest coin that fits, or null if stuck.
 *
 * This is NOT always the fewest coins; see the entry. Coins are positive,
 * amount is not negative.
 */
export function greedyCoinCount(coins: number[], amount: number): number | null {
  let remaining = amount;
  let count = 0;
  for (const coin of [...coins].sort((a, b) => b - a)) {
    count += Math.floor(remaining / coin);
    remaining %= coin;
  }
  return remaining === 0 ? count : null;
}
