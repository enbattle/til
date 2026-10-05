/** Most money from houses with no two neighbors robbed, top-down. */
export function robMemo(nums: number[]): number {
  // Created inside so the memo belongs to this street and starts empty on
  // every call; a module-level memo keyed by i would mix streets up.
  const memo = new Map<number, number>();
  const bestFrom = (i: number): number => {
    // >=, not ===: robbing the last house jumps to nums.length + 1.
    if (i >= nums.length) return 0;
    // Compare with undefined, not truthiness: a stored 0 is a real answer.
    let best = memo.get(i);
    if (best === undefined) {
      best = Math.max(bestFrom(i + 1), nums[i] + bestFrom(i + 2));
      memo.set(i, best);
    }
    return best;
  };
  // One stack frame per house: past several thousand houses (the exact
  // point depends on the engine) this throws a RangeError.
  return bestFrom(0);
}

/** The whole table, bottom-up: best[i] is the most from houses i onward. */
export function robTable(nums: number[]): number[] {
  const n = nums.length;
  // Two extra slots so best[i + 2] exists for the last house; both are
  // the empty street, worth 0, which makes them the base cases.
  const best = new Array<number>(n + 2).fill(0);
  // Right to left: best[i] reads best[i + 1] and best[i + 2], which must
  // already be final. Left to right would read zeros not yet filled in.
  for (let i = n - 1; i >= 0; i--) {
    best[i] = Math.max(best[i + 1], nums[i] + best[i + 2]);
  }
  return best;
}

/** Indices of one best set of houses, read back out of the table. */
export function housesToRob(nums: number[]): number[] {
  const best = robTable(nums);
  const chosen: number[] = [];
  let i = 0;
  while (i < nums.length) {
    // Rob house i exactly when that option is what produced best[i].
    if (nums[i] + best[i + 2] >= best[i + 1]) {
      chosen.push(i);
      i += 2;
    } else {
      i += 1;
    }
  }
  return chosen;
}

/** The same answer as robTable(nums)[0], keeping only two entries. */
export function rob(nums: number[]): number {
  let next1 = 0;
  let next2 = 0;
  for (let i = nums.length - 1; i >= 0; i--) {
    // One assignment: both right-hand sides use the old next1. Two
    // statements would overwrite next1 before next2 copies it.
    [next1, next2] = [Math.max(next1, nums[i] + next2), next1];
  }
  return next1;
}
