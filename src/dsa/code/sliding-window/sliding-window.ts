// #region max-window-sum
/** Largest sum of `k` consecutive values, or null if `nums` is shorter. */
export function maxWindowSum(nums: number[], k: number): number | null {
  if (k < 1) throw new RangeError('k must be at least 1');
  if (k > nums.length) return null;
  let window = 0;
  for (let i = 0; i < k; i++) {
    window += nums[i];
  }
  // Start from the first window, not 0: all-negative input has a negative best.
  let best = window;
  for (let right = k; right < nums.length; right++) {
    // The value leaving is k behind right; right - k + 1 is still inside.
    window += nums[right] - nums[right - k];
    best = Math.max(best, window);
  }
  return best;
}
// #endregion

// #region shortest-run-at-least
/**
 * Length of the shortest run summing to >= target, or 0 if none.
 * Needs non-negative values, so growing a run never lowers its sum.
 */
export function shortestRunAtLeast(nums: number[], target: number): number {
  if (target < 1) throw new RangeError('target must be at least 1');
  let shortest = nums.length + 1; // longer than any run; 0 here would win every min
  let total = 0;
  let left = 0;
  for (let right = 0; right < nums.length; right++) {
    total += nums[right];
    // while, not if: after one drop the run may still reach the target,
    // and a shorter run would be missed.
    while (total >= target) {
      shortest = Math.min(shortest, right - left + 1);
      total -= nums[left];
      left += 1;
    }
  }
  if (shortest > nums.length) return 0;
  return shortest;
}
// #endregion

// #region longest-with-k-distinct
/** Length of the longest run holding at most `k` different values. */
export function longestWithKDistinct(nums: number[], k: number): number {
  if (k < 1) throw new RangeError('k must be at least 1');
  const counts = new Map<number, number>();
  let left = 0;
  let best = 0;
  for (let right = 0; right < nums.length; right++) {
    const value = nums[right];
    counts.set(value, (counts.get(value) ?? 0) + 1);
    while (counts.size > k) {
      const gone = nums[left];
      const remaining = (counts.get(gone) ?? 0) - 1;
      counts.set(gone, remaining);
      if (remaining === 0) {
        counts.delete(gone); // a key left at 0 still counts as distinct
      }
      left += 1;
    }
    best = Math.max(best, right - left + 1);
  }
  return best;
}
// #endregion
