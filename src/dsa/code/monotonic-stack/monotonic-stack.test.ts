import { describe, expect, it } from 'vitest';
import { daysUntilWarmer, largestRectangle, nextGreater } from './monotonic-stack';

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

function bruteRectangle(heights: number[]): number {
  let best = 0;
  for (let lo = 0; lo < heights.length; lo++) {
    for (let hi = lo; hi < heights.length; hi++) {
      const width = hi - lo + 1;
      best = Math.max(best, Math.min(...heights.slice(lo, hi + 1)) * width);
    }
  }
  return best;
}

/** A small seeded generator (mulberry32), so a failing case can be replayed. */
function seededRandom(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Wraps an array so every element read, by index or slice, is counted. */
function counting(values: number[]): { array: number[]; reads: () => number } {
  let reads = 0;
  const array = new Proxy(values, {
    get(target, prop, receiver) {
      if (typeof prop === 'string' && /^\d+$/.test(prop)) reads++;
      return Reflect.get(target, prop, receiver);
    },
  });
  return { array, reads: () => reads };
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

  it('agrees with brute force on inputs full of duplicates', () => {
    const random = seededRandom(11);
    for (let n = 0; n < 50; n++) {
      const length = Math.floor(random() * 13);
      const nums = Array.from({ length }, () => Math.floor(random() * 5));
      const at = `seed 11, trial ${n}: [${nums}]`;
      expect(nextGreater(nums), at).toEqual(bruteNextGreater(nums));
      expect(daysUntilWarmer(nums), at).toEqual(bruteDays(nums));
    }
  });

  it('agrees with brute force on wide values', () => {
    const random = seededRandom(12);
    for (let n = 0; n < 50; n++) {
      const length = Math.floor(random() * 31);
      const nums = Array.from({ length }, () => Math.floor(random() * 101) - 50);
      expect(nextGreater(nums), `seed 12, trial ${n}: [${nums}]`).toEqual(
        bruteNextGreater(nums),
      );
    }
  });
});

describe('daysUntilWarmer (TypeScript)', () => {
  it.each([
    [[], []],
    [[70], [0]],
    [
      [2, 1, 2, 4, 3],
      [3, 1, 1, 0, 0],
    ],
    [
      [73, 74, 75, 71, 69, 72, 76, 73],
      [1, 1, 4, 2, 1, 1, 0, 0],
    ],
    [
      [60, 50, 40, 30],
      [0, 0, 0, 0],
    ],
    [
      [50, 50, 51],
      [2, 1, 0],
    ],
  ])('maps %j to %j', (given, expected) => {
    expect(daysUntilWarmer(given)).toEqual(expected);
  });
});

describe('largestRectangle (TypeScript)', () => {
  it.each([
    [[], 0],
    [[0], 0],
    [[7], 7],
    [[2, 1, 2, 4, 3], 6],
    [[2, 1, 5, 6, 2, 3], 10],
    [[2, 2, 2], 6],
    [[1, 2, 3, 4], 6],
    [[4, 3, 2, 1], 6],
    [[0, 0, 0], 0],
    [[3, 0, 3], 3],
  ])('maps %j to %j', (given, expected) => {
    expect(largestRectangle(given)).toBe(expected);
  });

  it('does not change the input', () => {
    const heights = [2, 1, 2];
    largestRectangle(heights);
    expect(heights).toEqual([2, 1, 2]);
  });

  it('agrees with brute force', () => {
    const random = seededRandom(13);
    for (let n = 0; n < 50; n++) {
      const length = Math.floor(random() * 15);
      const heights = Array.from({ length }, () => Math.floor(random() * 7));
      expect(largestRectangle(heights), `seed 13, trial ${n}: [${heights}]`).toBe(
        bruteRectangle(heights),
      );
    }
  });
});

describe('one pass (TypeScript)', () => {
  const n = 500;
  const shapes: Record<string, number[]> = {
    decreasing: Array.from({ length: n }, (_, i) => n - i),
    increasing: Array.from({ length: n }, (_, i) => i),
    equal: new Array<number>(n).fill(7),
  };

  it.each(Object.keys(shapes))(
    'reads each value a constant number of times: %s',
    (shape) => {
      // A rescan from every position reads about n * n / 2 on these inputs.
      const a = counting(shapes[shape]);
      nextGreater(a.array);
      expect(a.reads(), `nextGreater, ${shape}`).toBeGreaterThanOrEqual(n);
      expect(a.reads(), `nextGreater, ${shape}`).toBeLessThanOrEqual(4 * n);
      const b = counting(shapes[shape]);
      largestRectangle(b.array);
      expect(b.reads(), `rectangle, ${shape}`).toBeGreaterThanOrEqual(n);
      expect(b.reads(), `rectangle, ${shape}`).toBeLessThanOrEqual(6 * n);
    },
  );
});
