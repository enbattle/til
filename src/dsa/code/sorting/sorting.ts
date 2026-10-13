// #region split
/** A new array in ascending key order; equal keys keep their input order. */
export function mergeSort(
  items: number[],
  key: (x: number) => number = (x) => x,
): number[] {
  if (items.length <= 1) return items.slice();
  const mid = Math.floor(items.length / 2);
  const left = mergeSort(items.slice(0, mid), key);
  const right = mergeSort(items.slice(mid), key);
  const merged: number[] = [];
  let i = 0;
  let j = 0;
  // #endregion
  // #region merge
  while (i < left.length && j < right.length) {
    // <=, not <: on a tie the left item came first in the input, so it
    // goes first. With < the sort still sorts, but stability is gone.
    if (key(left[i]) <= key(right[j])) {
      merged.push(left[i]);
      i += 1;
    } else {
      merged.push(right[j]);
      j += 1;
    }
  }
  // At most one of these loops runs. Its items are already in order and no
  // smaller than anything taken. Skip them and the tail vanishes.
  while (i < left.length) {
    merged.push(left[i]);
    i += 1;
  }
  while (j < right.length) {
    merged.push(right[j]);
    j += 1;
  }
  return merged;
}
// #endregion

// #region partition
/**
 * Rearrange nums[lo, hi) so nums[lo, lt) < pivot, nums[lt, gt) == pivot and
 * nums[gt, hi) > pivot, and return [lt, gt].
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
      // What swaps in from lt is equal to the pivot, so i can move on.
      [nums[lt], nums[i]] = [nums[i], nums[lt]];
      lt += 1;
      i += 1;
    } else if (nums[i] > pivot) {
      // What swaps in from the end is unexamined, so i must stay put.
      gt -= 1;
      [nums[i], nums[gt]] = [nums[gt], nums[i]];
    } else {
      i += 1;
    }
  }
  return [lt, gt];
}
// #endregion

// #region quickselect
/** The k-th smallest of nums, counting from 0. Reorders nums in place. */
export function quickselect(nums: number[], k: number): number {
  if (k < 0 || k >= nums.length) {
    throw new RangeError(`k=${k} out of range for ${nums.length} elements`);
  }
  let lo = 0;
  let hi = nums.length;
  while (true) {
    // A random pivot means no input is reliably bad. A first-element pivot
    // is the maximum every round on reversed input, so the range shrinks
    // by one a round; sorted input is milder, about n^1.5.
    const pivot = nums[lo + Math.floor(Math.random() * (hi - lo))];
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
// #endregion
