// #region count-set-bits
/** Number of 1 bits in the binary form of `n`, for 0 <= n <= 2**31 - 1. */
export function countSetBits(n: number): number {
  // A negative number has no fixed set of bits to count (in Python the loop
  // below would never end), so reject it in both languages.
  if (n < 0) {
    throw new RangeError('countSetBits needs a non-negative integer');
  }
  let count = 0;
  while (n !== 0) {
    // n - 1 flips the lowest 1 and the 0s beneath it, so the AND clears
    // exactly that one bit. One pass per set bit, not per bit position.
    n = n & (n - 1);
    count += 1;
  }
  return count;
}
// #endregion

// #region is-power-of-two
/** True when `n` is 1, 2, 4, 8, ...; zero and negatives are not. For n <= 2**31 - 1. */
export function isPowerOfTwo(n: number): boolean {
  // n > 0 first: 0 & -1 is 0, so zero would pass the AND test. Keep the
  // parentheses: in JavaScript, === binds tighter than &.
  return n > 0 && (n & (n - 1)) === 0;
}
// #endregion

// #region single-number
/** The value that appears once when every other value appears twice. */
export function singleNumber(nums: number[]): number {
  // An empty list has no lone value; returning 0 would look like an answer.
  if (nums.length === 0) {
    throw new RangeError('singleNumber needs at least one number');
  }
  // Start at 0 because x ^ 0 == x; each pair cancels wherever it sits.
  let result = 0;
  for (const num of nums) {
    result = result ^ num;
  }
  return result;
}
// #endregion

// #region subsets
/** All 2**n subsets; mask m picks items[i] where bit i of m is 1. */
export function subsets(items: number[]): number[][] {
  const result: number[][] = [];
  const total = 2 ** items.length;
  for (let mask = 0; mask < total; mask++) {
    const subset: number[] = [];
    for (let i = 0; i < items.length; i++) {
      // 1 << i is a number with only bit i set, so the AND is nonzero
      // exactly when bit i of the mask is set.
      if ((mask & (1 << i)) !== 0) {
        subset.push(items[i]);
      }
    }
    result.push(subset);
  }
  return result;
}
// #endregion
