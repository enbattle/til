import { describe, expect, it } from 'vitest';
import { longestUniqueSubstring, maxWindowSum } from './sliding-window';

// The sliding-window entry's TypeScript code. API:
// - `maxWindowSum(nums, k): number | null`: the largest sum of `k` consecutive
//   values (fixed-size window); null when `nums` has fewer than `k` values;
//   throws a RangeError when `k` is not a positive integer.
// - `longestUniqueSubstring(text): number`: the length in code points of the
//   longest run with no repeated character (variable-size window).

function seededRandom(start: number) {
  let seed = start;
  return () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
}

function bruteMaxWindowSum(nums: number[], k: number): number | null {
  if (k > nums.length) return null;
  let best = -Infinity;
  for (let i = 0; i + k <= nums.length; i++) {
    let sum = 0;
    for (let j = i; j < i + k; j++) sum += nums[j];
    best = Math.max(best, sum);
  }
  return best;
}

function bruteLongestUnique(text: string): number {
  const chars = Array.from(text);
  let best = 0;
  for (let i = 0; i < chars.length; i++) {
    for (let j = i; j < chars.length; j++) {
      const run = chars.slice(i, j + 1);
      if (new Set(run).size === run.length) best = Math.max(best, run.length);
    }
  }
  return best;
}

describe('maxWindowSum (TypeScript)', () => {
  it('finds the best window in the worked example', () => {
    expect(maxWindowSum([2, 1, 5, 1, 3, 2], 3)).toBe(9);
  });

  it('finds a window at either end', () => {
    expect(maxWindowSum([9, 8, 1, 1, 1], 2)).toBe(17);
    expect(maxWindowSum([1, 1, 1, 8, 9], 2)).toBe(17);
  });

  it('handles a window the size of the whole array', () => {
    expect(maxWindowSum([4, -1, 2], 3)).toBe(5);
  });

  it('handles single-element windows', () => {
    expect(maxWindowSum([3, -2, 7, 1], 1)).toBe(7);
    expect(maxWindowSum([5], 1)).toBe(5);
  });

  it('handles all-negative values', () => {
    expect(maxWindowSum([-5, -2, -8, -1, -9], 2)).toBe(-7);
  });

  it('returns null when the array is empty or shorter than k', () => {
    expect(maxWindowSum([], 1)).toBeNull();
    expect(maxWindowSum([1, 2], 3)).toBeNull();
  });

  it('rejects a k that is not a positive integer', () => {
    expect(() => maxWindowSum([1, 2, 3], 0)).toThrow(RangeError);
    expect(() => maxWindowSum([1, 2, 3], -1)).toThrow(RangeError);
    expect(() => maxWindowSum([1, 2, 3], 1.5)).toThrow(RangeError);
  });

  it('does not change the input', () => {
    const nums = [1, 2, 3, 4];
    maxWindowSum(nums, 2);
    expect(nums).toEqual([1, 2, 3, 4]);
  });

  it('agrees with a brute-force search on many random arrays', () => {
    const random = seededRandom(11);
    for (let n = 0; n < 300; n++) {
      const length = Math.floor(random() * 13);
      const nums = Array.from({ length }, () => Math.floor(random() * 21) - 10);
      const k = 1 + Math.floor(random() * 14);
      expect(maxWindowSum(nums, k)).toBe(bruteMaxWindowSum(nums, k));
    }
  });
});

describe('longestUniqueSubstring (TypeScript)', () => {
  it.each([
    ['', 0],
    ['a', 1],
    ['aaaa', 1],
    ['abcdef', 6],
    ['abcabcbb', 3],
    ['pwwkew', 3],
    ['dvdf', 3],
    ['abba', 2],
    ['tmmzuxt', 5],
  ])('gives the answer for %j', (text, expected) => {
    expect(longestUniqueSubstring(text)).toBe(expected);
  });

  it('counts code points, not UTF-16 units', () => {
    // These two emoji share their first UTF-16 unit.
    expect(longestUniqueSubstring('\u{1F600}\u{1F601}\u{1F600}')).toBe(2);
    expect(longestUniqueSubstring('\u{1F600}b\u{1F601}')).toBe(3);
    expect(longestUniqueSubstring('\u{1F600}\u{1F600}')).toBe(1);
  });

  it('agrees with a brute-force search on many random strings', () => {
    const random = seededRandom(5);
    for (const alphabet of ['ab', 'abcd', 'abcdefgh', 'a\u{1F600}\u{1F601}b']) {
      const letters = Array.from(alphabet);
      for (let n = 0; n < 150; n++) {
        const length = Math.floor(random() * 15);
        const text = Array.from(
          { length },
          () => letters[Math.floor(random() * letters.length)],
        ).join('');
        expect(longestUniqueSubstring(text)).toBe(bruteLongestUnique(text));
      }
    }
  });
});
