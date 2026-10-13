// #region first-true-setup
/** Smallest x in [lo, hi) with ok(x) true, or hi if none; ok goes false then true. */
export function firstTrue(lo: number, hi: number, ok: (x: number) => boolean): number {
  while (lo < hi) {
    // Not (lo + hi) / 2: in Java or C++ that sum can overflow a 32-bit int.
    const mid = lo + Math.floor((hi - lo) / 2);
    // #endregion
    // #region first-true-narrow
    if (ok(mid)) {
      hi = mid; // mid may be the answer, so it has to stay in range
    } else {
      lo = mid + 1; // mid just failed; lo = mid never shrinks a range of one
    }
  }
  return lo;
}
// #endregion

// #region lower-bound
/** First index i with nums[i] >= target in sorted `nums`, or nums.length if none. */
export function lowerBound(nums: number[], target: number): number {
  // >=, not >: with > this returns the index after the last copy of target.
  return firstTrue(0, nums.length, (i) => nums[i] >= target);
}
// #endregion

// #region min-capacity
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

  let heaviest = 0;
  let total = 0;
  for (const w of weights) {
    if (w > heaviest) {
      heaviest = w;
    }
    total += w;
  }

  // Below the heaviest package, enough() can still say yes (that package just
  // gets its own day), so the search must not start lower. The total always works.
  return firstTrue(heaviest, total, enough);
}
// #endregion
