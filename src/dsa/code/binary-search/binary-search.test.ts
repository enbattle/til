import { describe, expect, it } from 'vitest';
import { firstTrue, lowerBound, minCapacity } from './binary-search';

// API: `firstTrue(lo, hi, ok)` is the smallest x in [lo, hi) with ok(x), or hi;
// `lowerBound(nums, target)` is the first index with nums[i] >= target in sorted
// nums, or nums.length; `minCapacity(weights, days)` is the least capacity that
// ships positive weights, in order, within days.

/** A small seeded generator (mulberry32) so a failing trial can be replayed. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rand: () => number, lo: number, hi: number): number {
  return lo + Math.floor(rand() * (hi - lo + 1));
}

function daysNeeded(weights: number[], cap: number): number {
  let used = 1;
  let load = 0;
  for (const w of weights) {
    if (load + w > cap) {
      used += 1;
      load = 0;
    }
    load += w;
  }
  return used;
}

function bruteCapacity(weights: number[], days: number): number {
  let cap = Math.max(0, ...weights);
  while (daysNeeded(weights, cap) > days) cap += 1;
  return cap;
}

describe('lowerBound', () => {
  it('answers the running example', () => {
    const nums = [1, 3, 5, 5, 5, 8];
    expect([5, 4, 9, 0].map((t) => lowerBound(nums, t))).toEqual([2, 2, 6, 0]);
  });

  it('handles empty and single-element arrays', () => {
    expect(lowerBound([], 5)).toBe(0);
    expect([4, 5, 6].map((t) => lowerBound([5], t))).toEqual([0, 0, 1]);
  });

  it('handles duplicates and the boundaries', () => {
    expect(lowerBound([4, 4, 4, 4], 4)).toBe(0);
    expect(lowerBound([4, 4, 4, 4], 5)).toBe(4);
    expect(lowerBound([1, 2, 3], 10)).toBe(3);
    expect(lowerBound([5, 6, 7], 1)).toBe(0);
  });

  it('matches a linear scan on seeded random arrays', () => {
    const rand = mulberry32(7);
    for (let trial = 0; trial < 50; trial++) {
      const nums = Array.from({ length: randInt(rand, 0, 15) }, () =>
        randInt(rand, 0, 12),
      ).sort((a, b) => a - b);
      const target = randInt(rand, -1, 13);
      const i = nums.findIndex((x) => x >= target);
      const want = i === -1 ? nums.length : i;
      const msg = `seed 7, trial ${trial}, ${nums}, ${target}`;
      expect(lowerBound(nums, target), msg).toBe(want);
    }
  });

  it('reads logarithmically many elements', () => {
    const base = Array.from({ length: 1000 }, (_, i) => i);
    for (const target of [-5, 0, 499, 500, 999, 5000]) {
      let reads = 0;
      const nums = new Proxy(base, {
        get(t, k, r) {
          if (typeof k === 'string' && /^\d+$/.test(k)) reads += 1;
          return Reflect.get(t, k, r);
        },
      });
      lowerBound(nums, target);
      // floor(log2(1000)) + 1 = 10: a scan would read hundreds.
      expect(reads, `target ${target}`).toBeLessThanOrEqual(10);
    }
  });
});

describe('firstTrue', () => {
  it('covers an empty range, no true value, and all true', () => {
    expect(firstTrue(3, 3, () => true)).toBe(3);
    expect(firstTrue(0, 10, () => false)).toBe(10);
    expect(firstTrue(0, 10, () => true)).toBe(0);
    expect(firstTrue(0, 10, (x) => x * x >= 50)).toBe(8);
  });

  it('asks about the only index of a range of one', () => {
    const calls: number[] = [];
    firstTrue(0, 1, (x) => {
      calls.push(x);
      return false;
    });
    expect(calls).toEqual([0]);
  });
});

describe('minCapacity', () => {
  it('answers the running example', () => {
    expect(minCapacity([3, 2, 2, 4, 1, 4], 3)).toBe(6);
    expect(daysNeeded([3, 2, 2, 4, 1, 4], 5)).toBe(4);
  });

  it('handles the edges', () => {
    expect(minCapacity([], 3)).toBe(0);
    expect(minCapacity([5], 1)).toBe(5);
    expect(minCapacity([1, 2, 3, 4, 5], 1)).toBe(15);
    expect(minCapacity([1, 2, 3, 4, 5], 5)).toBe(5);
    expect(minCapacity([9, 1, 1], 2)).toBe(9);
    expect(minCapacity([4, 1], 3)).toBe(4);
  });

  it('matches a brute-force search on seeded random inputs', () => {
    const rand = mulberry32(11);
    for (let trial = 0; trial < 50; trial++) {
      const weights = Array.from({ length: randInt(rand, 1, 10) }, () =>
        randInt(rand, 1, 9),
      );
      const days = randInt(rand, 1, weights.length);
      const msg = `seed 11, trial ${trial}, ${weights}, ${days}`;
      expect(minCapacity(weights, days), msg).toBe(bruteCapacity(weights, days));
    }
  });
});
