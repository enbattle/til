import { describe, expect, it } from 'vitest';
import {
  climb,
  climbMemo,
  climbNaive,
  climbTable,
  lisLength,
  rob,
} from './dp-one-dimensional';

// The dp-one-dimensional entry's TypeScript code. API:
// - `climbNaive`, `climbMemo`, `climbTable`, `climb`: the number of ways to
//   climb n stairs taking 1 or 2 steps at a time (n >= 0).
// - `rob(nums)`: the largest total from non-negative amounts with no two
//   adjacent indices taken.
// - `lisLength(nums)`: length of the longest strictly increasing subsequence.

function makeRandom(start: number): () => number {
  let seed = start;
  return () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
}

/** Count the step sequences directly, by building every one of them. */
function climbByListing(n: number): number {
  let sequences: number[][] = [[]];
  let done = 0;
  while (sequences.length > 0) {
    const longer: number[][] = [];
    for (const sequence of sequences) {
      const total = sequence.reduce((a, b) => a + b, 0);
      if (total === n) done++;
      else if (total < n) longer.push([...sequence, 1], [...sequence, 2]);
    }
    sequences = longer;
  }
  return done;
}

/** Every subset of the indices 0..size-1, as a list of sorted index lists. */
function subsets(size: number): number[][] {
  const all: number[][] = [];
  for (let mask = 0; mask < 1 << size; mask++) {
    const chosen: number[] = [];
    for (let i = 0; i < size; i++) if (mask & (1 << i)) chosen.push(i);
    all.push(chosen);
  }
  return all;
}

function bruteRob(nums: number[]): number {
  let best = 0;
  for (const chosen of subsets(nums.length)) {
    const apart = chosen.every((index, k) => k === 0 || index - chosen[k - 1] > 1);
    if (apart)
      best = Math.max(
        best,
        chosen.reduce((sum, i) => sum + nums[i], 0),
      );
  }
  return best;
}

function bruteLis(nums: number[]): number {
  let best = 0;
  for (const chosen of subsets(nums.length)) {
    const rising = chosen.every(
      (index, k) => k === 0 || nums[chosen[k - 1]] < nums[index],
    );
    if (rising) best = Math.max(best, chosen.length);
  }
  return best;
}

/** The greedy rule rob is compared with: the better of the two parities. */
function everyOther(nums: number[]): number {
  let even = 0;
  let odd = 0;
  nums.forEach((amount, i) => {
    if (i % 2 === 0) even += amount;
    else odd += amount;
  });
  return Math.max(even, odd);
}

const climbers: [string, (n: number) => number][] = [
  ['climbNaive', climbNaive],
  ['climbMemo', climbMemo],
  ['climbTable', climbTable],
  ['climb', climb],
];

describe.each(climbers)('%s (TypeScript)', (_name, climber) => {
  it('gives the known values', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map(climber)).toEqual([
      1, 1, 2, 3, 5, 8, 13, 21, 34,
    ]);
    expect(climber(20)).toBe(10946);
  });

  it('matches listing every step sequence', () => {
    for (let n = 0; n <= 12; n++) expect(climber(n)).toBe(climbByListing(n));
  });
});

describe('climb versions (TypeScript)', () => {
  it('agree with each other', () => {
    for (let n = 0; n <= 25; n++) {
      expect(climbMemo(n)).toBe(climbNaive(n));
      expect(climbTable(n)).toBe(climbNaive(n));
      expect(climb(n)).toBe(climbNaive(n));
    }
    expect(climbMemo(70)).toBe(climb(70));
    expect(climbTable(70)).toBe(climb(70));
  });

  it('memoised recursion overflows the call stack where the table does not', () => {
    expect(() => climbMemo(200000)).toThrow(RangeError);
    expect(() => climbTable(200000)).not.toThrow();
    expect(climbTable(1000)).toBe(climb(1000));
  });
});

describe('rob (TypeScript)', () => {
  it('handles small cases', () => {
    expect(rob([])).toBe(0);
    expect(rob([7])).toBe(7);
    expect(rob([0])).toBe(0);
    expect(rob([4, 4, 4, 4])).toBe(8);
    expect(rob([2, 7, 9, 3, 1])).toBe(12);
    expect(rob([5, 1, 1, 5])).toBe(10);
    expect(rob([2, 3, 2])).toBe(4);
    expect(rob([9, 1])).toBe(9);
  });

  it('beats taking every other house', () => {
    expect(everyOther([5, 1, 1, 5])).toBe(6);
    expect(rob([5, 1, 1, 5])).toBe(10);
  });

  it('agrees with a search over all subsets on many random inputs', () => {
    const random = makeRandom(11);
    for (let trial = 0; trial < 50; trial++) {
      const nums = Array.from({ length: Math.floor(random() * 12) }, () =>
        Math.floor(random() * 10),
      );
      const where = `seed 11, trial ${trial}: ${JSON.stringify(nums)}`;
      expect(rob(nums), where).toBe(bruteRob(nums));
      expect(rob(nums), where).toBeGreaterThanOrEqual(everyOther(nums));
    }
  });

  it('does not change the input', () => {
    const nums = [3, 1, 4, 1, 5];
    rob(nums);
    expect(nums).toEqual([3, 1, 4, 1, 5]);
  });
});

describe('lisLength (TypeScript)', () => {
  it('handles small cases', () => {
    expect(lisLength([])).toBe(0);
    expect(lisLength([5])).toBe(1);
    expect(lisLength([3, 3, 3, 3])).toBe(1);
    expect(lisLength([5, 4, 3, 2, 1])).toBe(1);
    expect(lisLength([1, 2, 3, 4, 5])).toBe(5);
    expect(lisLength([10, 9, 2, 5, 3, 7, 101, 18])).toBe(4);
    expect(lisLength([1, 2, 2, 3])).toBe(3);
    expect(lisLength([-3, -1, -2, 0])).toBe(3);
  });

  it('agrees with a search over all subsets on many random inputs', () => {
    const random = makeRandom(5);
    for (let trial = 0; trial < 50; trial++) {
      const nums = Array.from(
        { length: Math.floor(random() * 12) },
        () => Math.floor(random() * 11) - 5,
      );
      expect(lisLength(nums), `seed 5, trial ${trial}: ${JSON.stringify(nums)}`).toBe(
        bruteLis(nums),
      );
    }
  });

  it('does not change the input', () => {
    const nums = [3, 1, 4, 1, 5];
    lisLength(nums);
    expect(nums).toEqual([3, 1, 4, 1, 5]);
  });
});
