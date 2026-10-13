import { describe, expect, it, vi } from 'vitest';
import { MinHeap } from '../heap/heap';
import { mergeSorted, runningMedians, topKLargest } from './heap-patterns';

// The heap-patterns entry's TypeScript code. API: `topKLargest(items, k)`
// (largest first), `mergeSorted(lists)` and `runningMedians(stream)`.

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

const randInt = (r: () => number, lo: number, hi: number) =>
  lo + Math.floor(r() * (hi - lo + 1));
const ascending = (xs: number[]) => [...xs].sort((a, b) => a - b);

/** Run fn, returning the largest size any MinHeap reached (measured after each push). */
function largestHeap(fn: () => void): number {
  let largest = 0;
  const realPush = MinHeap.prototype.push;
  const push = vi.spyOn(MinHeap.prototype, 'push').mockImplementation(function (
    this: MinHeap,
    item: number[],
  ) {
    realPush.call(this, item);
    largest = Math.max(largest, this.size());
  });
  try {
    fn();
  } finally {
    push.mockRestore();
  }
  return largest;
}

/** Reading an array past its length is a bug in the code under test: fail fast. */
function strict(xs: number[]): number[] {
  return new Proxy(xs, {
    get(target, prop, receiver) {
      if (
        typeof prop === 'string' &&
        /^\d+$/.test(prop) &&
        Number(prop) >= target.length
      ) {
        throw new RangeError(`read index ${prop} of ${target.length}`);
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

describe('topKLargest', () => {
  it('finds the running example', () => {
    expect(topKLargest([4, 1, 7, 3, 8, 5], 3)).toEqual([8, 7, 5]);
  });

  it('handles the edges', () => {
    expect(topKLargest([], 3)).toEqual([]);
    expect(topKLargest([5], 1)).toEqual([5]);
    expect(topKLargest([5, 6], 5)).toEqual([6, 5]);
    expect(topKLargest([5, 6], 0)).toEqual([]);
    expect(topKLargest([5, 6], -1)).toEqual([]);
  });

  it('handles duplicates, negatives and does not change its input', () => {
    const nums = [3, 3, 3, 1];
    expect(topKLargest(nums, 2)).toEqual([3, 3]);
    expect(nums).toEqual([3, 3, 3, 1]);
    expect(topKLargest([-4, -1, -9], 2)).toEqual([-1, -4]);
  });

  it('matches sorting on random input', () => {
    const seed = 11;
    const r = rng(seed);
    for (let trial = 0; trial < 50; trial++) {
      const nums = Array.from({ length: randInt(r, 0, 30) }, () => randInt(r, -20, 20));
      const k = randInt(r, 0, 35);
      const want = ascending(nums).reverse().slice(0, k);
      expect(topKLargest(nums, k), `seed=${seed} trial=${trial} ${nums} ${k}`).toEqual(
        want,
      );
    }
  });

  it('keeps a heap and replaces rarely on shuffled input, not a sort', () => {
    // Sorting never pops a heap's array. On shuffled input the root is replaced
    // about k ln(n / k) times (~30 here), then the final drain pops k more.
    const r = rng(5);
    const nums = Array.from({ length: 2000 }, (_, i) => i);
    for (let i = nums.length - 1; i > 0; i--) {
      const j = randInt(r, 0, i);
      [nums[i], nums[j]] = [nums[j], nums[i]];
    }
    const pop = vi.spyOn(Array.prototype, 'pop');
    try {
      topKLargest(nums, 5);
      expect(pop.mock.calls.length).toBeGreaterThanOrEqual(5);
      expect(pop.mock.calls.length).toBeLessThan(200);
    } finally {
      pop.mockRestore();
    }
    // Pushing every item and popping k would pass the pop bound, so cap the size.
    expect(largestHeap(() => topKLargest(nums, 5))).toBe(5);
  });
});

describe('mergeSorted', () => {
  it('merges the running example', () => {
    expect(mergeSorted([[1, 4, 7], [3, 8], [5]])).toEqual([1, 3, 4, 5, 7, 8]);
  });

  it('handles the edges', () => {
    expect(mergeSorted([])).toEqual([]);
    expect(mergeSorted([[]])).toEqual([]);
    expect(mergeSorted([[], [], []])).toEqual([]);
    expect(mergeSorted([[2, 4]])).toEqual([2, 4]);
    expect(mergeSorted([[], [1], []])).toEqual([1]);
    expect(mergeSorted([[5], [1, 2, 3, 4]])).toEqual([1, 2, 3, 4, 5]);
  });

  it('keeps duplicates', () => {
    expect(mergeSorted([[2, 2], [2], [2, 2]])).toEqual([2, 2, 2, 2, 2]);
  });

  it('does not change its input', () => {
    const lists = [[1, 4], [2]];
    mergeSorted(lists);
    expect(lists).toEqual([[1, 4], [2]]);
  });

  it('never reads past the end of a list', () => {
    const lists = [strict([1, 4]), strict([]), strict([2, 3])];
    expect(mergeSorted(lists)).toEqual([1, 2, 3, 4]);
  });

  it('matches sorting on random lists', () => {
    const seed = 23;
    const r = rng(seed);
    for (let trial = 0; trial < 50; trial++) {
      const lists = Array.from({ length: randInt(r, 0, 6) }, () =>
        ascending(Array.from({ length: randInt(r, 0, 6) }, () => randInt(r, -9, 9))),
      );
      const want = ascending(lists.flat());
      expect(
        mergeSorted(lists),
        `seed=${seed} trial=${trial} ${JSON.stringify(lists)}`,
      ).toEqual(want);
    }
  });

  it('pops a heap once per item, not a concatenate-and-sort', () => {
    // Concatenate-and-sort never pops a heap's array; the real merge pops once per item.
    const lists = Array.from({ length: 50 }, (_, i) =>
      Array.from({ length: 20 }, (_, j) => i + 50 * j),
    );
    const pop = vi.spyOn(Array.prototype, 'pop');
    try {
      const merged = mergeSorted(lists);
      const pops = pop.mock.calls.length;
      expect(merged).toEqual(ascending(lists.flat()));
      expect(pops).toBe(merged.length);
    } finally {
      pop.mockRestore();
    }
    // Pushing every item up front would also pop once per item, so cap the size.
    expect(largestHeap(() => mergeSorted(lists))).toBe(lists.length);
  });
});

describe('runningMedians', () => {
  it('follows the running example', () => {
    expect(runningMedians([4, 1, 7, 3, 8, 5])).toEqual([4, 2.5, 4, 3.5, 4, 4.5]);
  });

  it('handles the edges', () => {
    expect(runningMedians([])).toEqual([]);
    expect(runningMedians([7])).toEqual([7]);
    expect(runningMedians([2, 2, 2, 2])).toEqual([2, 2, 2, 2]);
    expect(runningMedians([1.5, 2.5])).toEqual([1.5, 2]);
    expect(runningMedians([-5, -1])).toEqual([-5, -3]);
  });

  it('handles ascending and descending input', () => {
    expect(runningMedians([1, 2, 3, 4, 5])).toEqual([1, 1.5, 2, 2.5, 3]);
    expect(runningMedians([5, 4, 3, 2, 1])).toEqual([5, 4.5, 4, 3.5, 3]);
  });

  it('matches the median of each sorted prefix on random streams', () => {
    const seed = 31;
    const r = rng(seed);
    for (let trial = 0; trial < 50; trial++) {
      const stream = Array.from({ length: randInt(r, 0, 25) }, () => randInt(r, -15, 15));
      const want = stream.map((_, i) => {
        const s = ascending(stream.slice(0, i + 1));
        const m = Math.floor(s.length / 2);
        return s.length % 2 === 1 ? s[m] : (s[m - 1] + s[m]) / 2;
      });
      expect(runningMedians(stream), `seed=${seed} trial=${trial} ${stream}`).toEqual(
        want,
      );
    }
  });

  it('keeps the stream in two heaps, popping one or two per value', () => {
    // Sorting each prefix never pops a heap's array; each add pops 1 or 2 times.
    const pop = vi.spyOn(Array.prototype, 'pop');
    try {
      const n = 101;
      const r = rng(3);
      runningMedians(Array.from({ length: n }, () => randInt(r, 0, 999)));
      expect(pop.mock.calls.length).toBeGreaterThanOrEqual(n);
      expect(pop.mock.calls.length).toBeLessThanOrEqual(2 * n);
    } finally {
      pop.mockRestore();
    }
  });
});
