import { describe, expect, it } from 'vitest';
import {
  bucketSort,
  countingSort,
  insertionSort,
  radixSort,
} from './bucket-counting-sort';

/** A small seeded generator, so a failure reproduces. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

const ascending = (a: number, b: number) => a - b;

describe('countingSort (TypeScript)', () => {
  it('handles empty, single and all-equal input', () => {
    expect(countingSort([], 0, 5)).toEqual([]);
    expect(countingSort([3], 0, 5)).toEqual([3]);
    expect(countingSort([4, 4, 4, 4], 0, 9)).toEqual([4, 4, 4, 4]);
  });

  it('sorts a known example', () => {
    expect(countingSort([4, 1, 3, 4, 3], 0, 5)).toEqual([1, 3, 3, 4, 4]);
  });

  it('handles negatives and values at both ends of the range', () => {
    expect(countingSort([0, -3, 2, -3, 2, -1], -3, 2)).toEqual([-3, -3, -1, 0, 2, 2]);
    expect(countingSort([5, 5, 2, 2, 5], 2, 5)).toEqual([2, 2, 5, 5, 5]);
    expect(countingSort([7, 7], 7, 7)).toEqual([7, 7]);
  });

  it('rejects keys outside the range and an empty range', () => {
    expect(() => countingSort([1, 6], 0, 5)).toThrow(RangeError);
    expect(() => countingSort([1, -1], 0, 5)).toThrow(RangeError);
    expect(() => countingSort([1.5], 0, 5)).toThrow(RangeError);
    expect(() => countingSort([], 3, 2)).toThrow(RangeError);
  });

  it('does not change its input', () => {
    const items = [3, 1, 2];
    countingSort(items, 0, 3);
    expect(items).toEqual([3, 1, 2]);
  });

  it('is stable on records', () => {
    const records = [
      { id: 'b', n: 2 },
      { id: 'a', n: 1 },
      { id: 'c', n: 2 },
      { id: 'd', n: 1 },
      { id: 'e', n: 0 },
      { id: 'f', n: 2 },
    ];
    const ids = countingSort(records, 0, 2, (r) => r.n).map((r) => r.id);
    expect(ids).toEqual(['e', 'a', 'd', 'b', 'c', 'f']);
  });

  it('is stable and matches the stable built-in sort on many random records', () => {
    const random = seeded(3);
    for (let run = 0; run < 300; run++) {
      const length = Math.floor(random() * 25);
      const records = Array.from({ length }, (_, id) => ({
        id,
        n: Math.floor(random() * 9) - 4,
      }));
      const expected = [...records].sort((a, b) => a.n - b.n);
      expect(countingSort(records, -4, 4, (r) => r.n)).toEqual(expected);
    }
  });

  it('matches the built-in sort on many random integer arrays', () => {
    const random = seeded(1);
    for (let run = 0; run < 300; run++) {
      const length = Math.floor(random() * 40);
      const nums = Array.from({ length }, () => Math.floor(random() * 21) - 10);
      expect(countingSort(nums, -10, 10)).toEqual([...nums].sort(ascending));
    }
  });
});

describe('radixSort (TypeScript)', () => {
  it('handles basics', () => {
    expect(radixSort([])).toEqual([]);
    expect(radixSort([5])).toEqual([5]);
    expect(radixSort([0, 0])).toEqual([0, 0]);
    expect(radixSort([170, 45, 75, 90, 802, 24, 2, 66])).toEqual([
      2, 24, 45, 66, 75, 90, 170, 802,
    ]);
  });

  it('works in other bases', () => {
    const nums = [255, 0, 16, 17, 4096, 1];
    const expected = [...nums].sort(ascending);
    expect(radixSort(nums, 2)).toEqual(expected);
    expect(radixSort(nums, 16)).toEqual(expected);
    expect(radixSort(nums, 1000)).toEqual(expected);
  });

  it('rejects negatives, fractions and a base below 2', () => {
    expect(() => radixSort([3, -1])).toThrow(RangeError);
    expect(() => radixSort([2.5])).toThrow(RangeError);
    expect(() => radixSort([3, 1], 1)).toThrow(RangeError);
  });

  it('matches the built-in sort on many random arrays', () => {
    const random = seeded(2);
    for (let run = 0; run < 300; run++) {
      const length = Math.floor(random() * 40);
      const digits = Math.floor(random() * 9);
      const nums = Array.from({ length }, () => Math.floor(random() * 10 ** digits));
      expect(radixSort(nums)).toEqual([...nums].sort(ascending));
    }
  });
});

describe('bucketSort (TypeScript)', () => {
  it('handles basics', () => {
    expect(bucketSort([])).toEqual([]);
    expect(bucketSort([0.5])).toEqual([0.5]);
    expect(bucketSort([0.3, 0.3, 0.3])).toEqual([0.3, 0.3, 0.3]);
    expect(
      bucketSort([0.78, 0.17, 0.39, 0.26, 0.72, 0.94, 0.21, 0.12, 0.23, 0.68]),
    ).toEqual([0.12, 0.17, 0.21, 0.23, 0.26, 0.39, 0.68, 0.72, 0.78, 0.94]);
  });

  it('handles values at the ends of the range', () => {
    expect(bucketSort([0, 0.999999, 0])).toEqual([0, 0, 0.999999]);
    const justBelowOne = 1 - 2 ** -53;
    expect(bucketSort([justBelowOne, 0, justBelowOne])).toEqual([
      0,
      justBelowOne,
      justBelowOne,
    ]);
  });

  it('sorts skewed input that lands in one bucket', () => {
    const values = Array.from({ length: 50 }, (_, i) => 0.9 + i / 1000).reverse();
    expect(bucketSort(values)).toEqual([...values].sort(ascending));
  });

  it('rejects values outside [0, 1) and NaN', () => {
    for (const bad of [1, -0.1, NaN]) {
      expect(() => bucketSort([0.5, bad])).toThrow(RangeError);
    }
  });

  it('matches the built-in sort on many random arrays', () => {
    const random = seeded(6);
    for (let run = 0; run < 300; run++) {
      const values = Array.from({ length: Math.floor(random() * 60) }, random);
      expect(bucketSort(values)).toEqual([...values].sort(ascending));
    }
  });

  it('sorts a long array without exhausting the stack', () => {
    const random = seeded(7);
    const values = Array.from({ length: 200_000 }, random);
    expect(bucketSort(values)).toEqual([...values].sort(ascending));
  });
});

describe('insertionSort (TypeScript)', () => {
  it('sorts in place', () => {
    const random = seeded(4);
    for (let run = 0; run < 200; run++) {
      const items = Array.from({ length: Math.floor(random() * 20) }, random);
      const expected = [...items].sort(ascending);
      insertionSort(items);
      expect(items).toEqual(expected);
    }
  });
});
