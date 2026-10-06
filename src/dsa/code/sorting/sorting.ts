/** A new array in ascending key order; equal keys keep their input order. */
export function mergeSort<T>(
  items: readonly T[],
  key: (item: T) => number = (item) => item as unknown as number,
): T[] {
  if (items.length <= 1) return [...items];
  const mid = Math.floor(items.length / 2);
  const left = mergeSort(items.slice(0, mid), key);
  const right = mergeSort(items.slice(mid), key);
  const merged: T[] = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    // <=, not <: on a tie the left item came first in the input, so it
    // goes first. With < the sort still sorts, but stability is gone.
    if (key(left[i]) <= key(right[j])) merged.push(left[i++]);
    else merged.push(right[j++]);
  }
  // At most one of these is non-empty, and its items are already in order
  // and no smaller than anything taken. Skip them and the tail vanishes.
  return merged.concat(left.slice(i), right.slice(j));
}

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
      lt++;
      i++;
    } else if (nums[i] > pivot) {
      // What swaps in from the end is unexamined, so i must stay put.
      gt--;
      [nums[i], nums[gt]] = [nums[gt], nums[i]];
    } else {
      i++;
    }
  }
  return [lt, gt];
}

/** The k-th smallest of nums, counting from 0. Reorders nums in place. */
export function quickselect(
  nums: number[],
  k: number,
  random: () => number = Math.random,
): number {
  if (!Number.isInteger(k) || k < 0 || k >= nums.length) {
    throw new RangeError(`k=${k} out of range for ${nums.length} elements`);
  }
  let lo = 0;
  let hi = nums.length;
  for (;;) {
    // A random pivot means no input is reliably bad. A first-element pivot
    // is the maximum every round on reversed input, so the range shrinks
    // by one a round; sorted input is milder, about n^1.5.
    const pivot = nums[lo + Math.floor(random() * (hi - lo))];
    const [lt, gt] = partition(nums, lo, hi, pivot);
    if (k < lt) hi = lt;
    else if (k >= gt) lo = gt;
    else return nums[k];
  }
}
