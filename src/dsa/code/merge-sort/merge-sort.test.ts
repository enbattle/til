import { describe, expect, it } from 'vitest';
import { merge, mergeSort, sortAndCount } from './merge-sort';

// API: `mergeSort(items, key?)` returns a new sorted array and is stable;
// `merge(left, right, key)` merges two sorted arrays; `sortAndCount(nums)`
// returns `[sorted, inversions]`. References: a numeric sort and a pair count.

function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

function bruteInversions(nums: number[]): number {
  let count = 0;
  for (let i = 0; i < nums.length; i++) {
    for (let j = i + 1; j < nums.length; j++) {
      if (nums[i] > nums[j]) count++;
    }
  }
  return count;
}

const ascending = (a: number, b: number) => a - b;

describe('mergeSort (TypeScript)', () => {
  it('handles empty and single-element arrays', () => {
    expect(mergeSort([])).toEqual([]);
    expect(mergeSort([7])).toEqual([7]);
    expect(sortAndCount([])).toEqual([[], 0]);
    expect(sortAndCount([7])).toEqual([[7], 0]);
  });

  it('sorts small examples', () => {
    expect(mergeSort([5, 2, 4, 6, 1, 3])).toEqual([1, 2, 3, 4, 5, 6]);
    expect(mergeSort([2, 1])).toEqual([1, 2]);
    expect(mergeSort([3, 1, 2])).toEqual([1, 2, 3]);
  });

  it('sorts already sorted, reversed and all-equal arrays', () => {
    const up = Array.from({ length: 50 }, (_, i) => i);
    expect(mergeSort(up)).toEqual(up);
    expect(mergeSort([...up].reverse())).toEqual(up);
    expect(mergeSort([4, 4, 4, 4])).toEqual([4, 4, 4, 4]);
  });

  it('sorts numerically, not as strings', () => {
    expect(mergeSort([10, 9, 100, 1])).toEqual([1, 9, 10, 100]);
  });

  it('returns a new array and leaves the input alone', () => {
    const original = [3, 1, 2];
    const result = mergeSort(original);
    expect(original).toEqual([3, 1, 2]);
    expect(result).not.toBe(original);
    const single = [5];
    expect(mergeSort(single)).not.toBe(single);
  });

  it('merges two sorted arrays', () => {
    const id = (x: number) => x;
    expect(merge([1, 4, 9], [2, 3, 10, 11], id)).toEqual([1, 2, 3, 4, 9, 10, 11]);
    expect(merge([], [1, 2], id)).toEqual([1, 2]);
    expect(merge([1, 2], [], id)).toEqual([1, 2]);
    expect(merge([], [], id)).toEqual([]);
  });

  it('agrees with a numeric sort on many random arrays', () => {
    const random = seeded(5);
    for (let n = 0; n < 500; n++) {
      const length = Math.floor(random() * 41);
      const nums = Array.from({ length }, () => Math.floor(random() * 13) - 6);
      expect(mergeSort(nums), JSON.stringify(nums)).toEqual([...nums].sort(ascending));
    }
  });

  it('is stable with keyed records', () => {
    const records = [
      { name: 'b', rank: 2 },
      { name: 'a', rank: 1 },
      { name: 'c', rank: 2 },
      { name: 'd', rank: 1 },
      { name: 'e', rank: 2 },
      { name: 'f', rank: 1 },
    ];
    const names = mergeSort(records, (r) => r.rank).map((r) => r.name);
    expect(names).toEqual(['a', 'd', 'f', 'b', 'c', 'e']);
  });

  it('is stable on many random records', () => {
    const random = seeded(9);
    for (let n = 0; n < 300; n++) {
      const length = Math.floor(random() * 31);
      const records = Array.from({ length }, (_, id) => ({
        rank: Math.floor(random() * 5),
        id,
      }));
      const expected = [...records].sort((a, b) => a.rank - b.rank);
      expect(mergeSort(records, (r) => r.rank)).toEqual(expected);
    }
  });

  it('sorts a large array', () => {
    const random = seeded(3);
    const nums = Array.from({ length: 20_000 }, () => Math.floor(random() * 1001));
    expect(mergeSort(nums)).toEqual([...nums].sort(ascending));
  });
});

describe('sortAndCount (TypeScript)', () => {
  it('counts inversions in small examples', () => {
    expect(sortAndCount([2, 4, 1, 3, 5])).toEqual([[1, 2, 3, 4, 5], 3]);
    expect(sortAndCount([1, 2, 3, 4])).toEqual([[1, 2, 3, 4], 0]);
    expect(sortAndCount([4, 3, 2, 1])).toEqual([[1, 2, 3, 4], 6]);
  });

  it('does not count equal elements', () => {
    expect(sortAndCount([2, 2, 2])).toEqual([[2, 2, 2], 0]);
    expect(sortAndCount([2, 1, 1])).toEqual([[1, 1, 2], 2]);
  });

  it('counts n choose 2 for a reversed array', () => {
    for (const n of [2, 5, 20]) {
      const reversed = Array.from({ length: n }, (_, i) => n - i);
      expect(sortAndCount(reversed)[1]).toBe((n * (n - 1)) / 2);
    }
  });

  it('agrees with a brute-force count on many random arrays', () => {
    const random = seeded(21);
    for (let n = 0; n < 500; n++) {
      const length = Math.floor(random() * 31);
      const nums = Array.from({ length }, () => Math.floor(random() * 11) - 5);
      const [sorted, count] = sortAndCount(nums);
      expect(sorted, JSON.stringify(nums)).toEqual([...nums].sort(ascending));
      expect(count, JSON.stringify(nums)).toBe(bruteInversions(nums));
    }
  });
});
