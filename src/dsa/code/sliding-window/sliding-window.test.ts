import { describe, expect, it } from 'vitest';
import { longestWithKDistinct, maxWindowSum, shortestRunAtLeast } from './sliding-window';

// The sliding-window entry's TypeScript code. API: `maxWindowSum(nums, k)` is
// the largest sum of k consecutive values (null if nums is shorter, RangeError
// if k < 1); `shortestRunAtLeast(nums, target)` is the length of the shortest
// run of non-negative values summing to at least target (0 if none, RangeError
// if target < 1); `longestWithKDistinct(nums, k)` is the length of the longest
// run with at most k different values (RangeError if k < 1).

const running = [2, 1, 5, 1, 3, 2];

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

function randomArray(random: () => number, min: number, max: number, minLen: number) {
  const length = minLen + Math.floor(random() * (13 - minLen));
  return Array.from({ length }, () => min + Math.floor(random() * (max - min + 1)));
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** The best (or shortest, or longest) run, found by trying every run. */
function allRuns(nums: number[]): number[][] {
  const runs: number[][] = [];
  for (let i = 0; i < nums.length; i++)
    for (let j = i + 1; j <= nums.length; j++) runs.push(nums.slice(i, j));
  return runs;
}

function bruteMaxSum(nums: number[], k: number): number {
  return Math.max(
    ...allRuns(nums)
      .filter((r) => r.length === k)
      .map(sum),
  );
}

function bruteShortest(nums: number[], target: number): number {
  const lengths = allRuns(nums)
    .filter((r) => sum(r) >= target)
    .map((r) => r.length);
  return lengths.length ? Math.min(...lengths) : 0;
}

function bruteDistinct(nums: number[], k: number): number {
  const lengths = allRuns(nums)
    .filter((r) => new Set(r).size <= k)
    .map((r) => r.length);
  return lengths.length ? Math.max(...lengths) : 0;
}

/** Counts every element read; throws on a read past the end, so a loop that
 * runs off the array fails fast instead of spinning forever. */
function counted(items: number[]): { nums: number[]; reads: () => number } {
  let reads = 0;
  const nums = new Proxy(items, {
    get(target, key, receiver) {
      if (typeof key === 'string' && /^\d+$/.test(key)) {
        if (Number(key) >= target.length) throw new RangeError(`read past end: ${key}`);
        reads++;
      }
      return Reflect.get(target, key, receiver);
    },
  });
  return { nums, reads: () => reads };
}

/** Runs longestWithKDistinct on a guarded copy, so a bug fails instead of hanging. */
function distinct(nums: number[], k: number): number {
  return longestWithKDistinct(counted(nums).nums, k);
}

describe('sliding window (TypeScript)', () => {
  it('maxWindowSum gives the running example', () => {
    expect(maxWindowSum(running, 3)).toBe(9);
    expect(maxWindowSum(running, 1)).toBe(5);
    expect(maxWindowSum(running, 6)).toBe(14);
  });

  it('maxWindowSum handles the edges', () => {
    expect(maxWindowSum([], 1)).toBeNull();
    expect(maxWindowSum([4], 1)).toBe(4);
    expect(maxWindowSum([4], 2)).toBeNull();
    expect(maxWindowSum([-3, -1, -2], 2)).toBe(-3);
    expect(maxWindowSum([-5], 1)).toBe(-5);
    expect(maxWindowSum([2, 2, 2, 2], 2)).toBe(4);
    expect(() => maxWindowSum([1, 2], 0)).toThrow(RangeError);
    expect(() => maxWindowSum([], -1)).toThrow(RangeError);
    expect(() => maxWindowSum([1, 2], 1.5)).toThrow(RangeError);
  });

  it('shortestRunAtLeast gives the running example', () => {
    expect(shortestRunAtLeast(running, 9)).toBe(3);
    expect(shortestRunAtLeast(running, 5)).toBe(1);
    expect(shortestRunAtLeast(running, 14)).toBe(6);
    expect(shortestRunAtLeast(running, 15)).toBe(0);
  });

  it('shortestRunAtLeast handles the edges', () => {
    expect(shortestRunAtLeast([], 1)).toBe(0);
    expect(shortestRunAtLeast([7], 7)).toBe(1);
    expect(shortestRunAtLeast([6], 7)).toBe(0);
    expect(shortestRunAtLeast([0, 0, 0], 1)).toBe(0);
    expect(shortestRunAtLeast([1, 0, 0, 1], 2)).toBe(4);
    expect(shortestRunAtLeast([3, 3, 3], 3)).toBe(1);
    expect(shortestRunAtLeast([1, 1, 1, 1], 2)).toBe(2);
    expect(() => shortestRunAtLeast([1], 0)).toThrow(RangeError);
  });

  it('longestWithKDistinct gives the running example', () => {
    expect(distinct(running, 2)).toBe(3);
    expect(distinct(running, 1)).toBe(1);
    expect(distinct(running, 4)).toBe(6);
  });

  it('longestWithKDistinct handles the edges', () => {
    expect(distinct([], 1)).toBe(0);
    expect(distinct([5], 1)).toBe(1);
    expect(distinct([5, 5, 5], 1)).toBe(3);
    expect(distinct([1, 2, 3], 5)).toBe(3);
    expect(distinct([1, 2, 1, 3, 3], 2)).toBe(3);
    expect(() => distinct([1], 0)).toThrow(RangeError);
  });

  it('maxWindowSum matches brute force, on 50 seeded arrays', () => {
    const seed = 11;
    const random = rng(seed);
    for (let trial = 0; trial < 50; trial++) {
      const nums = randomArray(random, -5, 9, 1);
      const k = 1 + Math.floor(random() * nums.length);
      const where = `seed ${seed}, trial ${trial}: ${JSON.stringify(nums)} k=${k}`;
      expect(maxWindowSum(nums, k), where).toBe(bruteMaxSum(nums, k));
    }
  });

  it('shortestRunAtLeast matches brute force, on 50 seeded arrays', () => {
    const seed = 12;
    const random = rng(seed);
    for (let trial = 0; trial < 50; trial++) {
      const nums = randomArray(random, 0, 5, 0);
      const target = 1 + Math.floor(random() * 15);
      const where = `seed ${seed}, trial ${trial}: ${JSON.stringify(nums)} t=${target}`;
      expect(shortestRunAtLeast(nums, target), where).toBe(bruteShortest(nums, target));
    }
  });

  it('longestWithKDistinct matches brute force, on 50 seeded arrays', () => {
    const seed = 13;
    const random = rng(seed);
    for (let trial = 0; trial < 50; trial++) {
      const nums = randomArray(random, 0, 4, 0);
      const k = 1 + Math.floor(random() * 4);
      const where = `seed ${seed}, trial ${trial}: ${JSON.stringify(nums)} k=${k}`;
      expect(distinct(nums, k), where).toBe(bruteDistinct(nums, k));
    }
  });

  it('the fixed window reads one value in and one out per step', () => {
    // k to fill the first window, then two reads a step. Re-summing every
    // window would read about n * k = 10,000 here.
    const n = 200;
    const k = 50;
    const { nums, reads } = counted(Array.from({ length: n }, (_, i) => i));
    expect(maxWindowSum(nums, k)).toBe(
      sum(Array.from({ length: k }, (_, i) => n - k + i)),
    );
    expect(reads()).toBe(k + 2 * (n - k));
  });

  it('the variable windows move each end at most n times', () => {
    // n reads for the right end plus at most n for the left. Restarting the
    // sum from left on every step, or trying every run, reads far more.
    const n = 200;
    const ones = counted(new Array<number>(n).fill(1));
    expect(shortestRunAtLeast(ones.nums, 3)).toBe(3);
    expect(ones.reads()).toBeGreaterThanOrEqual(n);
    expect(ones.reads()).toBeLessThanOrEqual(2 * n);
    // A long window: trying each start and extending it reads about n^2 / 4.
    const half = counted(new Array<number>(n).fill(1));
    expect(shortestRunAtLeast(half.nums, n / 2)).toBe(n / 2);
    expect(half.reads()).toBeLessThanOrEqual(2 * n);
    const cycle = counted(Array.from({ length: n }, (_, i) => i % 3));
    expect(longestWithKDistinct(cycle.nums, 2)).toBe(2);
    expect(cycle.reads()).toBeGreaterThanOrEqual(n);
    expect(cycle.reads()).toBeLessThanOrEqual(2 * n);
  });

  it('drops a value from the distinct count once it leaves', () => {
    // With a stale zero count kept, counts.size would never fall back to k.
    expect(distinct([1, 2, 3, 4, 5, 5, 5], 2)).toBe(4);
    expect(distinct([1, 2, 1, 2, 3, 3], 2)).toBe(4);
  });

  it('does not change the input', () => {
    const nums = [...running];
    maxWindowSum(nums, 3);
    shortestRunAtLeast(nums, 9);
    distinct(nums, 2);
    expect(nums).toEqual(running);
  });
});
