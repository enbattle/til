const MAX_UINT32 = 0xffffffff;

/** Number of 1 bits in the binary form of `n`, an integer in 0..2**32 - 1. */
export function countSetBits(n: number): number {
  // Bitwise operators keep only 32 bits, so anything outside this range
  // (a negative, a fraction, 2**32) would be silently truncated. >>> 0 gives
  // back n only for an integer in 0..2**32 - 1.
  if (n >>> 0 !== n) {
    throw new RangeError('countSetBits needs an integer from 0 to 2**32 - 1');
  }
  let x = n;
  let count = 0;
  while (x !== 0) {
    // x - 1 flips the lowest 1 and the 0s beneath it, so the AND clears
    // exactly that one bit. One pass per set bit, not per bit position.
    // (The result is a signed 32-bit value, which still reaches 0.)
    x &= x - 1;
    count++;
  }
  return count;
}

/** True when `n` is 1, 2, 4, 8, ...; zero and negatives are not. Max 2**32 - 1. */
export function isPowerOfTwo(n: number): boolean {
  // 2**32 + 1 would be truncated to 1 and reported as a power of two.
  if (!Number.isInteger(n) || n > MAX_UINT32) {
    throw new RangeError('isPowerOfTwo needs an integer up to 2**32 - 1');
  }
  // n > 0 first: 0 & -1 is 0, so zero would pass the AND test. The
  // parentheses are required here: === binds tighter than &, so
  // n & (n - 1) === 0 would mean n & ((n - 1) === 0).
  return n > 0 && (n & (n - 1)) === 0;
}

/** The value that appears once when every other value appears twice. */
export function singleNumber(nums: number[]): number {
  // An empty list has no lone value; returning 0 would look like an answer.
  if (nums.length === 0) throw new RangeError('singleNumber needs a number');
  // Start at 0 because x ^ 0 === x; each pair cancels wherever it sits.
  let result = 0;
  for (const num of nums) {
    // ^ works on 32-bit signed ints: 2**31 would wrap to -2**31 and a
    // fraction would be truncated, both without an error.
    if ((num | 0) !== num) throw new RangeError('singleNumber needs int32 values');
    result ^= num;
  }
  return result;
}

/** All 2**n subsets; mask m picks items[i] where bit i of m is 1. */
export function subsets<T>(items: T[]): T[][] {
  const result: T[][] = [];
  // 2 ** n, not 1 << n: 1 << 31 is negative, so the loop would never run.
  for (let mask = 0; mask < 2 ** items.length; mask++) {
    const subset: T[] = [];
    // rest & -rest isolates the lowest set bit; clz32 turns it into its
    // position. Looping over set bits skips the items that are out.
    for (let rest = mask; rest !== 0; rest &= rest - 1) {
      subset.push(items[31 - Math.clz32(rest & -rest)]);
    }
    result.push(subset);
  }
  return result;
}
