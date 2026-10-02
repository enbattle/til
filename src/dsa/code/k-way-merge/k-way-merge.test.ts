import { describe, expect, it } from 'vitest';
import { kthSmallest, MinHeap, mergeSorted } from './k-way-merge';

// The k-way-merge entry's TypeScript code. API:
// - `mergeSorted(lists: number[][]): number[]`: the sorted merge of sorted arrays.
// - `kthSmallest(lists: number[][], k: number): number | null`: the k-th smallest
//   value (1-based) across sorted arrays, or `null` if k is below 1 or above the
//   total count.
// - `MinHeap<T>`: a binary min-heap taking a `less` function.

function makeRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

function randomLists(random: () => number): number[][] {
  const count = Math.floor(random() * 7);
  return Array.from({ length: count }, () => {
    const length = Math.floor(random() * 7);
    return Array.from({ length }, () => Math.floor(random() * 17) - 8).sort(
      (a, b) => a - b,
    );
  });
}

describe('mergeSorted (TypeScript)', () => {
  it('merges three lists', () => {
    expect(
      mergeSorted([
        [1, 4, 7],
        [2, 5, 8],
        [3, 6, 9],
      ]),
    ).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('merges lists of different lengths', () => {
    expect(mergeSorted([[1, 10, 20, 30], [5], [2, 3]])).toEqual([1, 2, 3, 5, 10, 20, 30]);
  });

  it('handles no lists, all-empty lists and some empty lists', () => {
    expect(mergeSorted([])).toEqual([]);
    expect(mergeSorted([[], [], []])).toEqual([]);
    expect(mergeSorted([[], [2, 4], [], [1, 3]])).toEqual([1, 2, 3, 4]);
  });

  it('returns a copy of a single list', () => {
    const lists = [[1, 2, 2, 5]];
    const result = mergeSorted(lists);
    expect(result).toEqual([1, 2, 2, 5]);
    expect(result).not.toBe(lists[0]);
  });

  it('keeps every duplicate across lists', () => {
    expect(mergeSorted([[1, 1, 3], [1, 3, 3], [3]])).toEqual([1, 1, 1, 3, 3, 3, 3]);
  });

  it('handles negative values', () => {
    expect(
      mergeSorted([
        [-5, -1],
        [-3, 0, 2],
      ]),
    ).toEqual([-5, -3, -1, 0, 2]);
  });

  it('does not change the input', () => {
    const lists = [[1, 3], [2]];
    mergeSorted(lists);
    expect(lists).toEqual([[1, 3], [2]]);
  });

  it('agrees with sorting the concatenation on many random inputs', () => {
    const random = makeRandom(11);
    for (let n = 0; n < 500; n++) {
      const lists = randomLists(random);
      const expected = lists.flat().sort((a, b) => a - b);
      expect(mergeSorted(lists)).toEqual(expected);
    }
  });
});

describe('kthSmallest (TypeScript)', () => {
  it('finds the first, middle and last values', () => {
    const lists = [
      [1, 4, 7],
      [2, 5, 8],
      [3, 6, 9],
    ];
    expect(kthSmallest(lists, 1)).toBe(1);
    expect(kthSmallest(lists, 5)).toBe(5);
    expect(kthSmallest(lists, 9)).toBe(9);
  });

  it('counts every copy of a duplicate', () => {
    const lists = [
      [1, 1],
      [1, 2],
    ];
    expect([1, 2, 3, 4].map((k) => kthSmallest(lists, k))).toEqual([1, 1, 1, 2]);
  });

  it('returns null when k is out of range or there are no values', () => {
    const lists = [[1, 2], [3]];
    expect(kthSmallest(lists, 0)).toBeNull();
    expect(kthSmallest(lists, -2)).toBeNull();
    expect(kthSmallest(lists, 4)).toBeNull();
    expect(kthSmallest([], 1)).toBeNull();
    expect(kthSmallest([[], []], 1)).toBeNull();
  });

  it('works on a single list', () => {
    expect(kthSmallest([[4, 8, 15]], 2)).toBe(8);
  });

  it('agrees with sorting the concatenation on many random inputs', () => {
    const random = makeRandom(13);
    for (let n = 0; n < 500; n++) {
      const lists = randomLists(random);
      const everything = lists.flat().sort((a, b) => a - b);
      for (let k = -1; k <= everything.length + 2; k++) {
        const expected = k >= 1 && k <= everything.length ? everything[k - 1] : null;
        expect(kthSmallest(lists, k)).toBe(expected);
      }
    }
  });
});

describe('MinHeap (TypeScript)', () => {
  it('pops values in ascending order', () => {
    const random = makeRandom(5);
    const heap = new MinHeap<number>((a, b) => a < b);
    const values = Array.from({ length: 50 }, () => Math.floor(random() * 100));
    for (const value of values) heap.push(value);
    const popped: number[] = [];
    while (heap.size > 0) popped.push(heap.pop()!);
    expect(popped).toEqual([...values].sort((a, b) => a - b));
  });

  it('pop on an empty heap returns undefined', () => {
    expect(new MinHeap<number>((a, b) => a < b).pop()).toBeUndefined();
  });
});
