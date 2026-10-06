import { describe, expect, it, vi } from 'vitest';
import { MinHeap, mergeSorted, runningMedians, topKLargest } from './heap-patterns';

// The heap-patterns entry's TypeScript code. API: `topKLargest(items, k, less)`
// (largest first), `mergeSorted(lists, less)` and `runningMedians(stream)`.

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

const less = (a: number, b: number) => a < b;
const randInt = (r: () => number, lo: number, hi: number) =>
  lo + Math.floor(r() * (hi - lo + 1));
const ascending = (xs: number[]) => [...xs].sort((a, b) => a - b);

/** A comparison that counts how often it is called. */
function counting() {
  const c = { n: 0, less: (a: number, b: number) => (c.n++, a < b) };
  return c;
}

/** Reading an array past its length is a bug in the code under test: fail fast. */
function strict<T>(xs: T[]): T[] {
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

describe('MinHeap', () => {
  it('pops in order, duplicates included', () => {
    const h = new MinHeap(less);
    for (const x of [5, 3, 8, 3, 1, 9, 1, 0]) h.push(x);
    expect(h.size).toBe(8);
    const out: number[] = [];
    while (h.size > 0) out.push(h.pop());
    expect(out).toEqual([0, 1, 1, 3, 3, 5, 8, 9]);
  });

  it('handles one item', () => {
    const h = new MinHeap(less);
    h.push(7);
    expect([h.peek(), h.pop(), h.size]).toEqual([7, 7, 0]);
  });
});

describe('topKLargest', () => {
  it('finds the running example', () => {
    expect(topKLargest([4, 1, 7, 3, 8, 5], 3, less)).toEqual([8, 7, 5]);
  });

  it('handles the edges', () => {
    expect(topKLargest([], 3, less)).toEqual([]);
    expect(topKLargest([5], 1, less)).toEqual([5]);
    expect(topKLargest([5, 6], 5, less)).toEqual([6, 5]);
    expect(topKLargest([5, 6], 0, less)).toEqual([]);
    expect(topKLargest([5, 6], -1, less)).toEqual([]);
  });

  it('handles duplicates and does not change its input', () => {
    const nums = [3, 3, 3, 1];
    expect(topKLargest(nums, 2, less)).toEqual([3, 3]);
    expect(nums).toEqual([3, 3, 3, 1]);
  });

  it('works on other types with a custom order', () => {
    const words = ['pear', 'fig', 'banana', 'kiwi'];
    const shorter = (a: string, b: string) => a.length < b.length;
    expect(topKLargest(words, 2, shorter)).toEqual(['banana', 'pear']);
  });

  it('matches sorting on random input', () => {
    const seed = 11;
    const r = rng(seed);
    for (let trial = 0; trial < 50; trial++) {
      const nums = Array.from({ length: randInt(r, 0, 30) }, () => randInt(r, -20, 20));
      const k = randInt(r, 0, 35);
      const want = ascending(nums).reverse().slice(0, k);
      expect(
        topKLargest(nums, k, less),
        `seed=${seed} trial=${trial} ${nums} ${k}`,
      ).toEqual(want);
    }
  });

  it('does about one comparison per item, not a sort', () => {
    // On shuffled input nearly every item loses to the root in one comparison, so
    // the total is near n; sorting everything costs about n log2 n (~19,000).
    const r = rng(5);
    const nums = Array.from({ length: 2000 }, (_, i) => i);
    for (let i = nums.length - 1; i > 0; i--) {
      const j = randInt(r, 0, i);
      [nums[i], nums[j]] = [nums[j], nums[i]];
    }
    const c = counting();
    topKLargest(nums, 5, c.less);
    expect(c.n).toBeLessThan(3 * nums.length);
    // Every item past the first k is compared with the root at least once.
    expect(c.n).toBeGreaterThanOrEqual(nums.length - 5);
  });
});

describe('mergeSorted', () => {
  it('merges the running example', () => {
    expect(mergeSorted([[1, 4, 7], [3, 8], [5]], less)).toEqual([1, 3, 4, 5, 7, 8]);
  });

  it('handles the edges', () => {
    expect(mergeSorted([], less)).toEqual([]);
    expect(mergeSorted([[]], less)).toEqual([]);
    expect(mergeSorted([[], [], []], less)).toEqual([]);
    expect(mergeSorted([[2, 4]], less)).toEqual([2, 4]);
    expect(mergeSorted([[], [1], []], less)).toEqual([1]);
    expect(mergeSorted([[5], [1, 2, 3, 4]], less)).toEqual([1, 2, 3, 4, 5]);
  });

  it('keeps duplicates, in list order', () => {
    expect(mergeSorted([[2, 2], [2], [2, 2]], less)).toEqual([2, 2, 2, 2, 2]);
    const byTens = (a: number, b: number) => Math.floor(a / 10) < Math.floor(b / 10);
    expect(mergeSorted([[11, 20], [12], [10, 13]], byTens)).toEqual([11, 12, 10, 13, 20]);
  });

  it('does not change its input', () => {
    const lists = [[1, 4], [2]];
    mergeSorted(lists, less);
    expect(lists).toEqual([[1, 4], [2]]);
  });

  it('never reads past the end of a list', () => {
    const lists = [strict([1, 4]), strict([]), strict([2, 3])];
    expect(mergeSorted(lists, less)).toEqual([1, 2, 3, 4]);
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
        mergeSorted(lists, less),
        `seed=${seed} trial=${trial} ${JSON.stringify(lists)}`,
      ).toEqual(want);
    }
  });

  it('compares about log k per item, not every head', () => {
    // Scanning all 50 heads for each item costs 49 comparisons per item (49,000
    // here); a heap costs at most about 2 log2 50 (~12). A ceiling of 16 separates them.
    const lists = Array.from({ length: 50 }, (_, i) =>
      Array.from({ length: 20 }, (_, j) => i + 50 * j),
    );
    const c = counting();
    // Concatenate-and-sort is cheap here too (the engine's sort merges runs) but
    // never pops a heap's array; the real merge pops once per item.
    const pop = vi.spyOn(Array.prototype, 'pop');
    try {
      const merged = mergeSorted(lists, c.less);
      const pops = pop.mock.calls.length;
      expect(merged).toEqual(ascending(lists.flat()));
      expect(c.n).toBeLessThan(16 * merged.length);
      expect(pops).toBe(merged.length);
    } finally {
      pop.mockRestore();
    }
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
        const m = s.length >> 1;
        return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
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
