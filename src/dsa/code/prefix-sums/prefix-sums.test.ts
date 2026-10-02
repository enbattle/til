import { describe, expect, it } from 'vitest';
import { buildPrefix, countSubarraysWithSum, rangeSum } from './prefix-sums';

// API:
// - `buildPrefix(nums)`: array of length nums.length + 1, prefix[i] = sum of
//   the first i elements, prefix[0] = 0.
// - `rangeSum(prefix, left, right)`: sum of nums[left..right], both included;
//   throws RangeError for a bad range.
// - `countSubarraysWithSum(nums, k)`: number of non-empty contiguous subarrays
//   that add up to exactly k.

function bruteCount(nums: number[], k: number): number {
  let count = 0;
  for (let i = 0; i < nums.length; i++) {
    let total = 0;
    for (let j = i; j < nums.length; j++) {
      total += nums[j];
      if (total === k) count++;
    }
  }
  return count;
}

function seededRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

describe('buildPrefix (TypeScript)', () => {
  it('has a leading zero', () => {
    expect(buildPrefix([3, 1, 4])).toEqual([0, 3, 4, 8]);
  });

  it('handles empty and single-element input', () => {
    expect(buildPrefix([])).toEqual([0]);
    expect(buildPrefix([7])).toEqual([0, 7]);
  });

  it('handles negative numbers', () => {
    expect(buildPrefix([2, -5, 3])).toEqual([0, 2, -3, 0]);
  });
});

describe('rangeSum (TypeScript)', () => {
  it('answers inclusive ranges', () => {
    const prefix = buildPrefix([3, 1, 4, 1, 5]);
    expect(rangeSum(prefix, 0, 4)).toBe(14);
    expect(rangeSum(prefix, 1, 3)).toBe(6);
    expect(rangeSum(prefix, 0, 0)).toBe(3);
    expect(rangeSum(prefix, 4, 4)).toBe(5);
  });

  it('rejects bad ranges', () => {
    const prefix = buildPrefix([1, 2, 3]);
    for (const [left, right] of [
      [-1, 1],
      [2, 1],
      [0, 3],
      [3, 3],
    ]) {
      expect(() => rangeSum(prefix, left, right)).toThrow(RangeError);
    }
    expect(() => rangeSum(buildPrefix([]), 0, 0)).toThrow(RangeError);
  });

  it('agrees with a direct sum on many random inputs', () => {
    const random = seededRandom(11);
    for (let n = 0; n < 300; n++) {
      const length = 1 + Math.floor(random() * 12);
      const nums = Array.from({ length }, () => Math.floor(random() * 19) - 9);
      const prefix = buildPrefix(nums);
      const left = Math.floor(random() * length);
      const right = left + Math.floor(random() * (length - left));
      const direct = nums.slice(left, right + 1).reduce((a, b) => a + b, 0);
      expect(rangeSum(prefix, left, right)).toBe(direct);
    }
  });
});

describe('countSubarraysWithSum (TypeScript)', () => {
  it('handles empty and single-element input', () => {
    expect(countSubarraysWithSum([], 0)).toBe(0);
    expect(countSubarraysWithSum([5], 5)).toBe(1);
    expect(countSubarraysWithSum([5], 4)).toBe(0);
  });

  it('returns 0 when nothing adds up', () => {
    expect(countSubarraysWithSum([1, 2, 3], 100)).toBe(0);
  });

  it('counts the whole array and every single element', () => {
    expect(countSubarraysWithSum([1, 2, 3], 6)).toBe(1);
    expect(countSubarraysWithSum([2, 2, 2], 2)).toBe(3);
  });

  it('counts repeated prefix sums', () => {
    expect(countSubarraysWithSum([1, 1, 1], 2)).toBe(2);
    expect(countSubarraysWithSum([1, -1, 1, -1], 0)).toBe(4);
  });

  it('does not count the empty subarray when k is 0', () => {
    expect(countSubarraysWithSum([1, 2], 0)).toBe(0);
    expect(countSubarraysWithSum([0, 0, 0], 0)).toBe(6);
  });

  it('handles negative numbers', () => {
    expect(countSubarraysWithSum([1, -1, 0], 0)).toBe(3);
    expect(countSubarraysWithSum([3, -2, 2, 1], 1)).toBe(3);
  });

  it('does not change the input', () => {
    const nums = [1, 2, 3];
    countSubarraysWithSum(nums, 3);
    expect(nums).toEqual([1, 2, 3]);
  });

  it('agrees with a brute-force count on many random inputs', () => {
    const random = seededRandom(5);
    for (let n = 0; n < 400; n++) {
      const length = Math.floor(random() * 11);
      const nums = Array.from({ length }, () => Math.floor(random() * 9) - 4);
      const k = Math.floor(random() * 13) - 6;
      expect(countSubarraysWithSum(nums, k)).toBe(bruteCount(nums, k));
    }
  });
});
