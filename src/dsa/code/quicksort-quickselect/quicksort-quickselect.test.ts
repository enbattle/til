import { describe, expect, it } from 'vitest';
import { partition, quicksort, quickselect } from './quicksort-quickselect';

// API: `partition(nums, lo, hi, pivot): [lt, gt]` (three-way, in place),
// `quicksort(nums, random?)` (in place) and `quickselect(nums, k, random?)` with k
// counted from 0. The reference answer is a numeric sort.

/** A small seeded generator, so a failing run can be repeated. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

const ascending = (a: number, b: number) => a - b;

function sortedCopy(nums: number[], seed = 0): number[] {
  const out = [...nums];
  quicksort(out, seeded(seed));
  return out;
}

function randomLists(
  seed: number,
  count: number,
  maxLen: number,
  maxValue: number,
): number[][] {
  const random = seeded(seed);
  return Array.from({ length: count }, () =>
    Array.from({ length: Math.floor(random() * (maxLen + 1)) }, () =>
      Math.floor(random() * (maxValue + 1)),
    ),
  );
}

describe('partition (TypeScript)', () => {
  it('makes three zones around the pivot', () => {
    const nums = [5, 1, 5, 9, 3, 5, 7, 2];
    const [lt, gt] = partition(nums, 0, nums.length, 5);
    expect([...nums].sort(ascending)).toEqual([1, 2, 3, 5, 5, 5, 7, 9]);
    expect(nums.slice(0, lt).every((x) => x < 5)).toBe(true);
    expect(nums.slice(lt, gt).every((x) => x === 5)).toBe(true);
    expect(nums.slice(gt).every((x) => x > 5)).toBe(true);
    expect([lt, gt]).toEqual([3, 6]);
  });

  it('touches only its range', () => {
    const nums = [9, 9, 4, 8, 1, 9, 0, 0];
    const [lt, gt] = partition(nums, 2, 6, 4);
    expect(nums.slice(0, 2)).toEqual([9, 9]);
    expect(nums.slice(6)).toEqual([0, 0]);
    expect(nums.slice(2, 6).sort(ascending)).toEqual([1, 4, 8, 9]);
    expect(nums.slice(2, lt).every((x) => x < 4)).toBe(true);
    expect(nums.slice(gt, 6).every((x) => x > 4)).toBe(true);
  });

  it('gives an empty middle zone when the pivot is absent', () => {
    const nums = [6, 2, 8, 1];
    const [lt, gt] = partition(nums, 0, 4, 5);
    expect([lt, gt]).toEqual([2, 2]);
    expect(nums.slice(0, 2).sort(ascending)).toEqual([1, 2]);
    expect(nums.slice(2).sort(ascending)).toEqual([6, 8]);
  });

  it('handles an empty range', () => {
    expect(partition([], 0, 0, 3)).toEqual([0, 0]);
  });
});

describe('quicksort (TypeScript)', () => {
  it('handles the edge cases', () => {
    expect(sortedCopy([])).toEqual([]);
    expect(sortedCopy([4])).toEqual([4]);
    expect(sortedCopy([2, 1])).toEqual([1, 2]);
    expect(sortedCopy([7, 7, 7, 7, 7])).toEqual([7, 7, 7, 7, 7]);
    const up = Array.from({ length: 20 }, (_, i) => i);
    expect(sortedCopy(up)).toEqual(up);
    expect(sortedCopy([...up].reverse())).toEqual(up);
    expect(sortedCopy([-3, 5, -3, 0, 5, -9])).toEqual([-9, -3, -3, 0, 5, 5]);
  });

  it('sorts in place and returns nothing', () => {
    const nums = [3, 1, 2];
    expect(quicksort(nums, seeded(1))).toBeUndefined();
    expect(nums).toEqual([1, 2, 3]);
  });

  it('matches a numeric sort with heavy duplicates', () => {
    randomLists(21, 50, 40, 4).forEach((nums, seed) => {
      expect(
        sortedCopy(nums, seed),
        `seed 21, trial ${seed}: ${JSON.stringify(nums)}`,
      ).toEqual([...nums].sort(ascending));
    });
  });

  it('matches a numeric sort with few duplicates', () => {
    randomLists(22, 50, 60, 10_000).forEach((nums, seed) => {
      expect(
        sortedCopy(nums, seed),
        `seed 22, trial ${seed}: ${JSON.stringify(nums)}`,
      ).toEqual([...nums].sort(ascending));
    });
  });

  it('sorts without a random argument', () => {
    const nums = [5, 2, 9, 2, 1];
    quicksort(nums);
    expect(nums).toEqual([1, 2, 2, 5, 9]);
  });

  it('gives the same result for the same seed', () => {
    const nums = randomLists(3, 1, 100, 50)[0];
    expect(sortedCopy(nums, 7)).toEqual(sortedCopy(nums, 7));
  });

  it('is fast and shallow on large all-equal, sorted and reversed input', () => {
    const n = 200_000;
    const inputs = [
      Array.from({ length: n }, () => 1),
      Array.from({ length: n }, (_, i) => i),
      Array.from({ length: n }, (_, i) => n - i),
    ];
    for (const nums of inputs) {
      const expected = [...nums].sort(ascending);
      quicksort(nums, seeded(5));
      expect(nums).toEqual(expected);
    }
  });
});

describe('quickselect (TypeScript)', () => {
  it('returns every k on many small lists', () => {
    randomLists(31, 50, 9, 5).forEach((nums, seed) => {
      const expected = [...nums].sort(ascending);
      for (let k = 0; k < nums.length; k++) {
        expect(
          quickselect([...nums], k, seeded(seed)),
          `seed 31, trial ${seed}: ${JSON.stringify(nums)}, k=${k}`,
        ).toBe(expected[k]);
      }
    });
  });

  it('works on larger lists', () => {
    const random = seeded(32);
    for (let seed = 0; seed < 40; seed++) {
      const length = 50 + Math.floor(random() * 250);
      const nums = Array.from({ length }, () => Math.floor(random() * 31));
      const k = Math.floor(random() * length);
      expect(
        quickselect([...nums], k, seeded(seed)),
        `seed 32, trial ${seed}: ${JSON.stringify(nums)}, k=${k}`,
      ).toBe([...nums].sort(ascending)[k]);
    }
  });

  it('finds the minimum and the maximum', () => {
    const nums = [8, 3, 9, 1, 1, 7];
    expect(quickselect([...nums], 0)).toBe(1);
    expect(quickselect([...nums], nums.length - 1)).toBe(9);
  });

  it('handles a single element and all-equal input', () => {
    expect(quickselect([42], 0)).toBe(42);
    expect(
      quickselect(
        Array.from({ length: 1000 }, () => 6),
        500,
      ),
    ).toBe(6);
  });

  it('leaves the answer at index k', () => {
    const nums = [9, 4, 7, 1, 8, 2];
    expect(quickselect(nums, 3)).toBe(7);
    expect(nums[3]).toBe(7);
    expect(nums.slice(0, 3).every((x) => x <= 7)).toBe(true);
    expect(nums.slice(4).every((x) => x >= 7)).toBe(true);
  });

  it('rejects k out of range', () => {
    expect(() => quickselect([], 0)).toThrow(RangeError);
    expect(() => quickselect([1, 2, 3], 3)).toThrow(RangeError);
    expect(() => quickselect([1, 2, 3], -1)).toThrow(RangeError);
    expect(() => quickselect([1, 2, 3], 1.5)).toThrow(RangeError);
  });
});
