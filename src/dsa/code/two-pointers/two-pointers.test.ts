import { describe, expect, it } from 'vitest';
import { dedupeSorted, pairWithSum } from './two-pointers';

// docs/specs/dsa-tab.md, criterion 12: the two-pointers entry's TypeScript
// code. API:
// - `pairWithSum(nums: number[], target: number): [number, number] | null`:
//   the indices `[i, j]`, `i < j`, of two elements of the sorted array `nums`
//   that add up to `target` (opposite-end pointers), or `null`.
// - `dedupeSorted(nums: number[]): number`: removes duplicates from the sorted
//   array in place (same-direction pointers) and returns the count `k` of
//   unique values, which are then `nums.slice(0, k)` in order.

/** Every pair of indices whose values add up to `target`. */
function bruteForcePairs(nums: number[], target: number): string[] {
  const pairs: string[] = [];
  for (let i = 0; i < nums.length; i++) {
    for (let j = i + 1; j < nums.length; j++) {
      if (nums[i] + nums[j] === target) pairs.push(`${i},${j}`);
    }
  }
  return pairs;
}

function expectValidPair(nums: number[], target: number, label?: string) {
  const result = pairWithSum(nums, target);
  const possible = bruteForcePairs(nums, target);
  if (possible.length === 0) {
    expect(result, label).toBeNull();
    return;
  }
  expect(result, label).not.toBeNull();
  const [i, j] = result!;
  expect(i, label).toBeLessThan(j);
  expect(i, label).toBeGreaterThanOrEqual(0);
  expect(j, label).toBeLessThan(nums.length);
  expect(nums[i] + nums[j], label).toBe(target);
}

describe('pairWithSum (TypeScript)', () => {
  it('finds a pair in a sorted array', () => {
    const nums = [1, 3, 4, 6, 8, 11];
    const result = pairWithSum(nums, 10);
    expect(result).not.toBeNull();
    const [i, j] = result!;
    expect(nums[i] + nums[j]).toBe(10);
    expect(i).toBeLessThan(j);
  });

  it('finds the only pair, at the two ends', () => {
    expect(pairWithSum([1, 5, 9, 20], 21)).toEqual([0, 3]);
  });

  it('finds the only pair, in the middle', () => {
    expect(pairWithSum([1, 4, 6, 50], 10)).toEqual([1, 2]);
  });

  it('returns null for an empty array', () => {
    expect(pairWithSum([], 0)).toBeNull();
  });

  it('returns null for a single element, even when it is half the target', () => {
    expect(pairWithSum([3], 6)).toBeNull();
  });

  it('returns null when no pair adds up', () => {
    expect(pairWithSum([1, 2, 4, 8], 7 + 8)).toBeNull();
    expect(pairWithSum([1, 3], 6)).toBeNull();
  });

  it('uses two different indices holding equal values', () => {
    expect(pairWithSum([2, 2], 4)).toEqual([0, 1]);
    expectValidPair([1, 3, 3, 5], 6);
  });

  it('handles negative numbers and zero', () => {
    expectValidPair([-8, -3, 0, 2, 7], -1);
    expectValidPair([-4, -1, 0, 0, 3], 0);
    expect(pairWithSum([-5, -2], -7)).toEqual([0, 1]);
  });

  it('agrees with a brute-force search on many sorted arrays', () => {
    let seed = 7;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let n = 0; n < 50; n++) {
      const length = Math.floor(random() * 9);
      const nums = Array.from({ length }, () => Math.floor(random() * 21) - 10).sort(
        (a, b) => a - b,
      );
      const target = Math.floor(random() * 41) - 20;
      expectValidPair(
        nums,
        target,
        `seed 7, trial ${n}: ${JSON.stringify({ nums, target })}`,
      );
    }
  });

  it('does not change the input', () => {
    const nums = [1, 2, 3, 4];
    pairWithSum(nums, 7);
    expect(nums).toEqual([1, 2, 3, 4]);
  });
});

describe('dedupeSorted (TypeScript)', () => {
  it.each([
    [[], []],
    [[5], [5]],
    [
      [1, 2, 3],
      [1, 2, 3],
    ],
    [[7, 7, 7, 7], [7]],
    [
      [1, 1, 2, 3, 3, 3, 4],
      [1, 2, 3, 4],
    ],
    [
      [-3, -3, 0, 0, 2],
      [-3, 0, 2],
    ],
    [
      [0, 0, 1, 1, 1, 2, 2, 3, 3, 4],
      [0, 1, 2, 3, 4],
    ],
  ])('dedupes %j in place to %j', (input, expected) => {
    const nums = [...input];
    const k = dedupeSorted(nums);
    expect(k).toBe(expected.length);
    expect(nums.slice(0, k)).toEqual(expected);
  });

  it('works in place on the array it was given', () => {
    const nums = [1, 1, 2];
    const same = nums;
    dedupeSorted(nums);
    expect(nums).toBe(same);
    expect(nums.slice(0, 2)).toEqual([1, 2]);
  });
});
