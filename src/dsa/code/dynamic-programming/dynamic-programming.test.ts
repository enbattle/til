import { describe, expect, it } from 'vitest';
import { housesToRob, rob, robMemo, robTable } from './dynamic-programming';

// The dynamic-programming entry's TypeScript code. API: `robMemo(nums)`
// (top-down) and `rob(nums)` (two variables) return the most money from
// non-negative amounts with no two adjacent houses robbed; `robTable(nums)`
// returns the bottom-up table, where best[i] is the most from houses i onward
// (nums.length + 2 entries, the answer at index 0); `housesToRob(nums)` returns
// the indices of one best choice, ascending.

/** A small seeded generator (mulberry32), so a failing case can be replayed. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomStreet(random: () => number): number[] {
  const length = Math.floor(random() * 11);
  return Array.from({ length }, () => Math.floor(random() * 10));
}

/** The best total over every set of houses with no two adjacent. */
function brute(nums: number[]): number {
  let best = 0;
  for (let mask = 0; mask < 1 << nums.length; mask++) {
    if (mask & (mask >> 1)) continue;
    let total = 0;
    for (let i = 0; i < nums.length; i++) if (mask & (1 << i)) total += nums[i];
    best = Math.max(best, total);
  }
  return best;
}

const solvers: [string, (nums: number[]) => number][] = [
  ['robMemo', robMemo],
  ['rob', rob],
  ['robTable', (nums) => robTable(nums)[0]],
];

const known: [number[], number][] = [
  [[], 0],
  [[7], 7],
  [[0], 0],
  [[9, 1], 9],
  [[1, 9], 9],
  [[2, 3, 2], 4],
  [[3, 4, 3, 1], 6],
  [[5, 1, 1, 5], 10],
  [[2, 7, 9, 3, 1], 12],
  [[4, 4, 4, 4], 8],
  [[0, 0, 0], 0],
];

describe.each(solvers)('%s (TypeScript)', (_name, solve) => {
  it('gives the known answers', () => {
    for (const [nums, want] of known)
      expect(solve(nums), JSON.stringify(nums)).toBe(want);
  });
});

describe('dynamic programming on house robber (TypeScript)', () => {
  it('builds the running example table', () => {
    expect(robTable([3, 4, 3, 1])).toEqual([6, 5, 3, 1, 0, 0]);
    expect(robTable([])).toEqual([0, 0]);
    expect(robTable([7])).toEqual([7, 0, 0]);
  });

  it('reads the houses back out on small cases', () => {
    expect(housesToRob([])).toEqual([]);
    expect(housesToRob([7])).toEqual([0]);
    expect(housesToRob([3, 4, 3, 1])).toEqual([0, 2]);
    expect(housesToRob([1, 9])).toEqual([1]);
    expect(housesToRob([5, 1, 1, 5])).toEqual([0, 3]);
  });

  it('matches brute force in every version, on 50 seeded streets', () => {
    const seed = 7;
    const random = rng(seed);
    for (let trial = 0; trial < 50; trial++) {
      const nums = randomStreet(random);
      const want = brute(nums);
      const where = `seed ${seed}, trial ${trial}: ${JSON.stringify(nums)}`;
      expect(robMemo(nums), where).toBe(want);
      expect(rob(nums), where).toBe(want);
      expect(robTable(nums)[0], where).toBe(want);
    }
  });

  it('fills every table entry with the best from there on, on 50 seeded streets', () => {
    const seed = 8;
    const random = rng(seed);
    for (let trial = 0; trial < 50; trial++) {
      const nums = randomStreet(random);
      const want = [...nums.map((_, i) => brute(nums.slice(i))), 0, 0];
      expect(
        robTable(nums),
        `seed ${seed}, trial ${trial}: ${JSON.stringify(nums)}`,
      ).toEqual(want);
    }
  });

  it('picks a legal best set of houses, on 50 seeded streets', () => {
    const seed = 9;
    const random = rng(seed);
    for (let trial = 0; trial < 50; trial++) {
      const nums = randomStreet(random);
      const chosen = housesToRob(nums);
      const where = `seed ${seed}, trial ${trial}: ${JSON.stringify(nums)} -> ${chosen}`;
      expect(
        chosen.every((i) => i >= 0 && i < nums.length),
        where,
      ).toBe(true);
      expect(
        chosen.every((i, k) => k === 0 || i - chosen[k - 1] > 1),
        where,
      ).toBe(true);
      expect(
        chosen.reduce((sum, i) => sum + nums[i], 0),
        where,
      ).toBe(brute(nums));
    }
  });

  it('starts each memo call empty', () => {
    expect(robMemo([5, 5, 5])).toBe(10);
    expect(robMemo([1])).toBe(1);
    expect(robMemo([2, 1])).toBe(2);
  });

  it('runs out of stack top-down where the loops do not', () => {
    const street = new Array<number>(200000).fill(1);
    expect(() => robMemo(street)).toThrow(RangeError);
    expect(rob(street)).toBe(100000);
    expect(robTable(street)[0]).toBe(100000);
  });

  it.each([1, 0])('solves each house once top-down (amount %i)', (amount) => {
    // Each state reads its house once; without the memo, 20 houses take
    // about 17,700 reads. Zeros check that a stored 0 counts as solved.
    let reads = 0;
    const street = new Proxy(new Array<number>(20).fill(amount), {
      get(target, key, receiver) {
        if (typeof key === 'string' && /^\d+$/.test(key)) reads++;
        return Reflect.get(target, key, receiver);
      },
    });
    expect(robMemo(street)).toBe(amount * 10);
    expect(reads, `amount=${amount} reads=${reads}`).toBe(20);
  });

  it('does not change the input', () => {
    const nums = [3, 4, 3, 1];
    for (const [, solve] of solvers) solve(nums);
    housesToRob(nums);
    expect(nums).toEqual([3, 4, 3, 1]);
  });
});
