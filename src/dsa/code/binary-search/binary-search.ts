/** Smallest x in [lo, hi) with ok(x) true, or hi if none; ok goes false then true. */
export function firstTrue(lo: number, hi: number, ok: (x: number) => boolean): number {
  while (lo < hi) {
    // Not Math.floor((lo + hi) / 2): in a fixed-width language that sum can overflow.
    const mid = lo + Math.floor((hi - lo) / 2);
    if (ok(mid)) {
      hi = mid; // mid may be the answer, so it has to stay in range
    } else {
      lo = mid + 1; // mid just failed; lo = mid never shrinks a range of one
    }
  }
  return lo;
}

/** First index i with nums[i] >= target in sorted `nums`, or nums.length if none. */
export function lowerBound(nums: number[], target: number): number {
  // >=, not >: with > this returns the index after the last copy of target.
  return firstTrue(0, nums.length, (i) => nums[i] >= target);
}

/** Least truck capacity that ships the packages, in order, within `days`. */
export function minCapacity(weights: number[], days: number): number {
  const enough = (cap: number): boolean => {
    let used = 1;
    let load = 0;
    for (const w of weights) {
      if (load + w > cap) {
        used += 1;
        load = 0;
      }
      load += w;
    }
    return used <= days;
  };
  // Below max(weights) the heaviest package fits on no day, yet enough() can
  // still say yes, so the search must not start lower. sum(weights) always works.
  const total = weights.reduce((a, b) => a + b, 0);
  return firstTrue(Math.max(0, ...weights), total, enough);
}
