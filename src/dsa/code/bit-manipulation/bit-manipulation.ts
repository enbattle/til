const MAX_UINT32 = 0xffffffff;

/** Number of 1 bits in `n`, an integer from 0 to 2**32 - 1. */
export function countSetBits(n: number): number {
  if (!Number.isInteger(n) || n < 0 || n > MAX_UINT32) {
    throw new RangeError('countSetBits needs an integer from 0 to 2**32 - 1');
  }
  let x = n >>> 0;
  let count = 0;
  while (x !== 0) {
    x = (x & (x - 1)) >>> 0;
    count++;
  }
  return count;
}

/** True when `n` is 1, 2, 4, 8, ...; zero and negatives are not. Limit 2**32 - 1. */
export function isPowerOfTwo(n: number): boolean {
  if (!Number.isInteger(n) || n > MAX_UINT32) {
    throw new RangeError('isPowerOfTwo needs an integer up to 2**32 - 1');
  }
  return n > 0 && (n & (n - 1)) === 0;
}

/** The value that appears once when every other appears exactly twice (32-bit ints). */
export function singleNumber(nums: number[]): number {
  if (nums.length === 0) throw new RangeError('singleNumber needs at least one number');
  let result = 0;
  for (const num of nums) {
    if (!Number.isInteger(num) || num !== (num | 0)) {
      throw new RangeError('singleNumber needs 32-bit signed integers');
    }
    result ^= num;
  }
  return result;
}

/** All 2**n subsets; the subset for mask m holds items[i] where bit i of m is 1. */
export function subsets<T>(items: T[]): T[][] {
  const n = items.length;
  if (n > 30) throw new RangeError('subsets supports at most 30 items');
  const result: T[][] = [];
  for (let mask = 0; mask < 1 << n; mask++) {
    const subset: T[] = [];
    for (let i = 0; i < n; i++) {
      if ((mask >> i) & 1) subset.push(items[i]);
    }
    result.push(subset);
  }
  return result;
}
