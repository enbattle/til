import { describe, expect, it } from 'vitest';
import { lowerBound } from './binary-search';

// docs/specs/dsa-tab.md, criterion 12: the binary-search entry's TypeScript
// code. API: `lowerBound(nums: number[], target: number): number`, the first
// index `i` with `nums[i] >= target` in the sorted array `nums`, or
// `nums.length` when there is none (the lower-bound form, half-open range).

/** The lower bound by a linear scan. */
function linear(nums: number[], target: number): number {
  const i = nums.findIndex((x) => x >= target);
  return i === -1 ? nums.length : i;
}

describe('lowerBound (TypeScript)', () => {
  it('returns 0 for an empty array', () => {
    expect(lowerBound([], 5)).toBe(0);
  });

  it('finds a present value', () => {
    expect(lowerBound([1, 3, 5, 7, 9], 7)).toBe(3);
    expect(lowerBound([1, 3, 5, 7, 9], 1)).toBe(0);
    expect(lowerBound([1, 3, 5, 7, 9], 9)).toBe(4);
  });

  it('returns the insertion point for an absent value', () => {
    expect(lowerBound([1, 3, 5, 7, 9], 4)).toBe(2);
  });

  it('returns the first of several duplicates', () => {
    expect(lowerBound([1, 2, 2, 2, 2, 3], 2)).toBe(1);
    expect(lowerBound([4, 4, 4, 4], 4)).toBe(0);
    expect(lowerBound([1, 5, 5], 5)).toBe(1);
  });

  it('returns the length when every element is smaller than the target', () => {
    expect(lowerBound([1, 2, 3], 10)).toBe(3);
    expect(lowerBound([4, 4, 4, 4], 5)).toBe(4);
  });

  it('returns 0 when every element is larger than the target', () => {
    expect(lowerBound([5, 6, 7], 1)).toBe(0);
  });

  it('handles a single element on each side of the target', () => {
    expect(lowerBound([5], 4)).toBe(0);
    expect(lowerBound([5], 5)).toBe(0);
    expect(lowerBound([5], 6)).toBe(1);
  });

  it('handles negative numbers', () => {
    expect(lowerBound([-9, -4, -4, 0, 3], -4)).toBe(1);
    expect(lowerBound([-9, -4, -4, 0, 3], -5)).toBe(1);
  });

  it('agrees with a linear scan for every target on many sorted arrays', () => {
    let seed = 11;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let n = 0; n < 200; n++) {
      const length = Math.floor(random() * 12);
      const nums = Array.from({ length }, () => Math.floor(random() * 11) - 5).sort(
        (a, b) => a - b,
      );
      for (let target = -7; target <= 7; target++) {
        expect(lowerBound(nums, target), `${JSON.stringify(nums)}, ${target}`).toBe(
          linear(nums, target),
        );
      }
    }
  });

  it('terminates on a large array (no infinite loop at two elements)', () => {
    const nums = Array.from({ length: 100_000 }, (_, i) => i * 2);
    expect(lowerBound(nums, 99_999)).toBe(50_000);
    expect(lowerBound([1, 2], 2)).toBe(1);
    expect(lowerBound([1, 2], 3)).toBe(2);
  });
});
