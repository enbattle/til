import { describe, expect, it } from 'vitest';
import { mergeSort, partition, quickselect } from './sorting';

// API: `mergeSort(items, key?)` returns a new stable-sorted array;
// `partition(nums, lo, hi, pivot)` returns [lt, gt]; `quickselect(nums, k,
// random?)` returns the k-th smallest, counting from 0.

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ascending = (xs: number[]) => [...xs].sort((a, b) => a - b);

/** An array that throws on a read past its end, so a runaway loop fails fast. */
function guarded(xs: number[]): number[] {
  return new Proxy(xs, {
    get(target, prop, receiver) {
      if (
        typeof prop === 'string' &&
        /^\d+$/.test(prop) &&
        Number(prop) >= target.length
      ) {
        throw new RangeError(`read past the end: index ${prop}`);
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

function shuffled(n: number, random: () => number): number[] {
  const xs = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [xs[i], xs[j]] = [xs[j], xs[i]];
  }
  return xs;
}

describe('mergeSort', () => {
  it('handles empty and single inputs', () => {
    expect(mergeSort([])).toEqual([]);
    expect(mergeSort([7])).toEqual([7]);
  });

  it('sorts the worked example', () => {
    expect(mergeSort([5, 2, 4, 6, 1, 3])).toEqual([1, 2, 3, 4, 5, 6]);
    expect(mergeSort([4, 7, 2, 4, 9, 1, 4])).toEqual([1, 2, 4, 4, 4, 7, 9]);
  });

  it('handles duplicates, sorted, reversed and negative input', () => {
    expect(mergeSort([2, 2, 1, 1, 2])).toEqual([1, 1, 2, 2, 2]);
    expect(mergeSort([1, 2, 3])).toEqual([1, 2, 3]);
    expect(mergeSort([3, 2, 1])).toEqual([1, 2, 3]);
    expect(mergeSort([-1, -5, 0])).toEqual([-5, -1, 0]);
  });

  it('returns a copy and leaves the input alone', () => {
    const items = [3, 1, 2];
    const out = mergeSort(items);
    expect(items).toEqual([3, 1, 2]);
    expect(out).not.toBe(items);
    const one = [4];
    expect(mergeSort(one)).not.toBe(one);
  });

  it('is stable', () => {
    const records = [
      ['a', 2],
      ['b', 1],
      ['c', 2],
      ['d', 1],
      ['e', 2],
    ] as const;
    expect(mergeSort(records, (r) => r[1]).map((r) => r[0])).toEqual([
      'b',
      'd',
      'a',
      'c',
      'e',
    ]);
  });

  it('matches the built-in stable sort on random records', () => {
    const seed = 11;
    const random = mulberry32(seed);
    for (let trial = 0; trial < 50; trial++) {
      const n = Math.floor(random() * 30);
      const records = Array.from({ length: n }, (_, i) => ({
        id: i,
        k: Math.floor(random() * 4),
      }));
      const want = [...records].sort((a, b) => a.k - b.k);
      expect(
        mergeSort(records, (r) => r.k),
        `seed=${seed} trial=${trial}`,
      ).toEqual(want);
    }
  });

  it('matches a numeric sort on random numbers', () => {
    const seed = 12;
    const random = mulberry32(seed);
    for (let trial = 0; trial < 50; trial++) {
      const xs = Array.from({ length: Math.floor(random() * 40) }, () =>
        Math.floor(random() * 40 - 20),
      );
      expect(mergeSort(xs), `seed=${seed} trial=${trial} ${xs}`).toEqual(ascending(xs));
    }
  });

  it('sorts numbers, not strings, by default', () => {
    expect(mergeSort([10, 9, 1])).toEqual([1, 9, 10]);
  });

  it.each(['random', 'reversed', 'sorted'])(
    'makes at most n * ceil(log2 n) comparisons on %s input',
    (shape) => {
      // Mechanism: halving. Insertion or selection sort makes about n^2 / 2
      // (500,000 here) on reversed or random input. The floor is the
      // (n / 2) * log2 n that top-down merging needs even on sorted input
      // (5,120 here); a built-in sort makes only n - 1 comparisons there.
      const n = 1024;
      let xs = Array.from({ length: n }, (_, i) => i);
      if (shape === 'random') xs = shuffled(n, mulberry32(13));
      if (shape === 'reversed') xs.reverse();
      let calls = 0;
      const out = mergeSort(xs, (x) => {
        calls++;
        return x;
      });
      expect(out).toEqual(ascending(xs));
      // Every comparison calls key twice.
      expect(calls).toBeGreaterThanOrEqual(2 * (n / 2) * Math.log2(n));
      expect(calls).toBeLessThanOrEqual(2 * n * Math.ceil(Math.log2(n)));
    },
  );
});

describe('partition', () => {
  it('makes three zones on the worked example', () => {
    const nums = [4, 7, 2, 4, 9, 1, 4];
    const [lt, gt] = partition(nums, 0, nums.length, 4);
    expect([lt, gt]).toEqual([2, 5]);
    expect(ascending(nums.slice(0, lt))).toEqual([1, 2]);
    expect(nums.slice(lt, gt)).toEqual([4, 4, 4]);
    expect(ascending(nums.slice(gt))).toEqual([7, 9]);
  });

  it('handles empty, single, all-equal and sub-range inputs', () => {
    expect(partition([], 0, 0, 1)).toEqual([0, 0]);
    expect(partition([5], 0, 1, 5)).toEqual([0, 1]);
    expect(partition([5], 0, 1, 9)).toEqual([1, 1]);
    expect(partition([5], 0, 1, 1)).toEqual([0, 0]);
    expect(partition([6, 6, 6], 0, 3, 6)).toEqual([0, 3]);
    const nums = [9, 3, 1, 2, 9];
    expect(partition(nums, 1, 4, 2)).toEqual([2, 3]);
    expect([nums[0], nums[4]]).toEqual([9, 9]);
  });

  it('keeps the zones and the elements on random input', () => {
    const seed = 14;
    const random = mulberry32(seed);
    for (let trial = 0; trial < 50; trial++) {
      const nums = Array.from({ length: Math.floor(random() * 20) }, () =>
        Math.floor(random() * 6),
      );
      const before = ascending(nums);
      const pivot = Math.floor(random() * 6);
      const [lt, gt] = partition(guarded(nums), 0, nums.length, pivot);
      const ctx = `seed=${seed} trial=${trial} pivot=${pivot} ${nums}`;
      expect(
        nums.slice(0, lt).every((x) => x < pivot),
        ctx,
      ).toBe(true);
      expect(
        nums.slice(lt, gt).every((x) => x === pivot),
        ctx,
      ).toBe(true);
      expect(
        nums.slice(gt).every((x) => x > pivot),
        ctx,
      ).toBe(true);
      expect(ascending(nums), ctx).toEqual(before);
    }
  });
});

describe('quickselect', () => {
  it('finds every rank of the worked example', () => {
    const nums = [4, 7, 2, 4, 9, 1, 4];
    const got = nums.map((_, k) => quickselect([...nums], k, mulberry32(1)));
    expect(got).toEqual([1, 2, 4, 4, 4, 7, 9]);
  });

  it('handles single and all-equal arrays', () => {
    expect(quickselect([5], 0)).toBe(5);
    expect(quickselect([3, 3, 3, 3], 2)).toBe(3);
  });

  it('throws when k is out of range', () => {
    // Guarded, so a missing check fails on a read instead of looping forever.
    const bad = (nums: number[], k: number) => () => quickselect(guarded(nums), k);
    expect(bad([], 0)).toThrow(/out of range/);
    expect(bad([1, 2, 3], -1)).toThrow(/out of range/);
    expect(bad([1, 2, 3], 3)).toThrow(/out of range/);
    expect(bad([1, 2, 3], 1.5)).toThrow(/out of range/);
  });

  it('matches a numeric sort on random inputs', () => {
    const seed = 15;
    const random = mulberry32(seed);
    for (let trial = 0; trial < 50; trial++) {
      const nums = Array.from({ length: 1 + Math.floor(random() * 29) }, () =>
        Math.floor(random() * 16 - 8),
      );
      const k = Math.floor(random() * nums.length);
      const got = quickselect(guarded([...nums]), k, mulberry32(trial));
      expect(got, `seed=${seed} trial=${trial} k=${k} ${nums}`).toBe(ascending(nums)[k]);
    }
  });

  it('keeps the same elements', () => {
    const nums = [5, 1, 4, 1, 9, 2];
    quickselect(nums, 3, mulberry32(2));
    expect(ascending(nums)).toEqual([1, 1, 2, 4, 5, 9]);
  });

  it.each(['random', 'sorted', 'reversed', 'equal'])(
    'does linear work on %s input',
    (shape) => {
      // Mechanism: partition, then follow one side. Sorting to pick the k-th
      // costs about 10n comparisons on random input and only n - 1 on sorted
      // input, so the 2n floor (measured: 2n on all-equal, over 4n otherwise)
      // rules out a sort there. A first-element pivot costs ~n^2 on reversed
      // input (3.4M comparisons at n = 3000) and ~n^1.5 on sorted (270k); both
      // clear the ceiling. The 9n ceiling holds for these seeds (6.5n measured);
      // it is not a guarantee for every seed.
      // Each comparison reads two numbers, so valueOf is called twice per one.
      const n = 3000;
      let reads = 0;
      const box = (v: number) => ({
        valueOf() {
          reads++;
          return v;
        },
      });
      let values = Array.from({ length: n }, (_, i) => i);
      if (shape === 'random') values = shuffled(n, mulberry32(16));
      if (shape === 'reversed') values.reverse();
      if (shape === 'equal') values = new Array<number>(n).fill(7);
      const nums = values.map(box) as unknown as number[];
      const k = n / 2;
      const got = quickselect(guarded(nums), k, mulberry32(17));
      expect(Number(got)).toBe(ascending(values)[k]);
      expect(reads).toBeGreaterThanOrEqual(2 * 2 * n);
      expect(reads).toBeLessThanOrEqual(2 * 9 * n);
    },
  );
});
