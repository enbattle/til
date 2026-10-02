/** A source of numbers in [0, 1), like Math.random. Pass a seeded one in tests. */
export type Random = () => number;

/**
 * Rearrange nums[lo, hi) into three zones around the value `pivot`.
 * Returns [lt, gt]: nums[lo, lt) < pivot, nums[lt, gt) == pivot, nums[gt, hi) > pivot.
 */
export function partition(
  nums: number[],
  lo: number,
  hi: number,
  pivot: number,
): [number, number] {
  let lt = lo;
  let i = lo;
  let gt = hi;
  while (i < gt) {
    if (nums[i] < pivot) {
      [nums[lt], nums[i]] = [nums[i], nums[lt]];
      lt++;
      i++;
    } else if (nums[i] > pivot) {
      gt--;
      [nums[i], nums[gt]] = [nums[gt], nums[i]];
    } else {
      i++;
    }
  }
  return [lt, gt];
}

/** Sort `nums` in place, ascending. Not stable. A seeded `random` repeats a run. */
export function quicksort(nums: number[], random: Random = Math.random): void {
  sortRange(nums, 0, nums.length, random);
}

/** Sort nums[lo, hi) in place. */
export function sortRange(nums: number[], lo: number, hi: number, random: Random): void {
  while (hi - lo > 1) {
    const pivot = nums[lo + Math.floor(random() * (hi - lo))];
    const [lt, gt] = partition(nums, lo, hi, pivot);
    if (lt - lo < hi - gt) {
      sortRange(nums, lo, lt, random);
      lo = gt;
    } else {
      sortRange(nums, gt, hi, random);
      hi = lt;
    }
  }
}

/**
 * The k-th smallest of `nums`, counting k from 0 (k = 0 is the minimum).
 * Reorders `nums` in place. Throws a RangeError unless 0 <= k < nums.length.
 */
export function quickselect(
  nums: number[],
  k: number,
  random: Random = Math.random,
): number {
  if (!Number.isInteger(k) || k < 0 || k >= nums.length) {
    throw new RangeError(`k=${k} out of range for ${nums.length} elements`);
  }
  let lo = 0;
  let hi = nums.length;
  while (true) {
    const pivot = nums[lo + Math.floor(random() * (hi - lo))];
    const [lt, gt] = partition(nums, lo, hi, pivot);
    if (k < lt) {
      hi = lt;
    } else if (k >= gt) {
      lo = gt;
    } else {
      return nums[k];
    }
  }
}
