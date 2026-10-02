import { describe, expect, it } from 'vitest';
import { daysUntilWarmer, nextGreater } from './monotonic-stack';

function bruteNextGreater(nums: number[]): number[] {
  return nums.map((value, i) => {
    for (let j = i + 1; j < nums.length; j++) {
      if (nums[j] > value) return j;
    }
    return -1;
  });
}

function bruteDays(temps: number[]): number[] {
  return bruteNextGreater(temps).map((j, i) => (j === -1 ? 0 : j - i));
}

function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

describe('nextGreater (TypeScript)', () => {
  it.each([
    [[], []],
    [[5], [-1]],
    [
      [1, 2, 3],
      [1, 2, -1],
    ],
    [
      [3, 2, 1],
      [-1, -1, -1],
    ],
    [
      [2, 1, 2, 4, 3],
      [3, 2, 3, -1, -1],
    ],
    [
      [2, 2, 2],
      [-1, -1, -1],
    ],
    [
      [2, 2, 3],
      [2, 2, -1],
    ],
    [
      [-3, -5, -1, -1, 0],
      [2, 2, 4, 4, -1],
    ],
  ])('maps %j to %j', (given, expected) => {
    expect(nextGreater(given)).toEqual(expected);
  });

  it('does not change the input', () => {
    const nums = [4, 1, 5];
    nextGreater(nums);
    expect(nums).toEqual([4, 1, 5]);
  });

  it('agrees with brute force on many inputs full of duplicates', () => {
    const random = seededRandom(11);
    for (let n = 0; n < 500; n++) {
      const length = Math.floor(random() * 13);
      const nums = Array.from({ length }, () => Math.floor(random() * 5));
      expect(nextGreater(nums)).toEqual(bruteNextGreater(nums));
      expect(daysUntilWarmer(nums)).toEqual(bruteDays(nums));
    }
  });

  it('agrees with brute force on wide values', () => {
    const random = seededRandom(12);
    for (let n = 0; n < 200; n++) {
      const length = Math.floor(random() * 31);
      const nums = Array.from({ length }, () => Math.floor(random() * 101) - 50);
      expect(nextGreater(nums)).toEqual(bruteNextGreater(nums));
    }
  });
});

describe('daysUntilWarmer (TypeScript)', () => {
  it.each([
    [[], []],
    [[70], [0]],
    [
      [73, 74, 75, 71, 69, 72, 76, 73],
      [1, 1, 4, 2, 1, 1, 0, 0],
    ],
    [
      [30, 40, 50, 60],
      [1, 1, 1, 0],
    ],
    [
      [60, 50, 40, 30],
      [0, 0, 0, 0],
    ],
    [
      [50, 50, 50],
      [0, 0, 0],
    ],
    [
      [50, 50, 51],
      [2, 1, 0],
    ],
  ])('maps %j to %j', (given, expected) => {
    expect(daysUntilWarmer(given)).toEqual(expected);
  });
});
