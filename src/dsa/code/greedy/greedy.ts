/** [start, end], half-open: (1, 4) and (4, 6) don't overlap. */
export type Interval = [number, number];

/** A largest set of pairwise non-overlapping intervals (start < end each). */
export function selectIntervals(intervals: Interval[]): Interval[] {
  const chosen: Interval[] = [];
  // By end, not start or length: the interval that ends first leaves the
  // most room, and the other two orders can pick one that blocks several.
  // Copy first: sort changes the array it is called on.
  const byEnd = [...intervals].sort((a, b) => a[1] - b[1]);
  for (const [start, end] of byEnd) {
    const last = chosen[chosen.length - 1];
    // Sorted by end, last ends last of everything taken, so one comparison
    // covers them all. >=, not >: touching intervals both fit.
    if (last === undefined || start >= last[1]) {
      chosen.push([start, end]);
    }
  }
  return chosen;
}

/**
 * Can you get from index 0 to the last index? jumps[i] is the longest
 * jump from i; shorter ones are allowed. An empty array has no last index.
 */
export function canReachEnd(jumps: number[]): boolean {
  if (jumps.length === 0) return false;
  let farthest = 0;
  for (let i = 0; i < jumps.length; i++) {
    // Check before updating, so a gap stops the walk. > and not >=:
    // index farthest itself is reachable (>= rejects index 0).
    if (i > farthest) return false;
    // max, not assignment: a later index can reach less far than an earlier.
    farthest = Math.max(farthest, i + jumps[i]);
  }
  return true;
}

/**
 * Coins used by always taking the largest that fits, or null if stuck.
 * NOT always the fewest coins. Coins are positive, amount is not negative.
 */
export function greedyCoinCount(coins: number[], amount: number): number | null {
  let count = 0;
  // Largest first is the rule itself; the caller's order isn't trusted.
  for (const coin of [...coins].sort((a, b) => b - a)) {
    // A coin can repeat, and one bigger than amount adds 0: no guard needed.
    // Math.floor: / on numbers gives a fraction.
    count += Math.floor(amount / coin);
    amount %= coin;
  }
  // A leftover means nothing fit it; returning count would pay too little.
  return amount === 0 ? count : null;
}
