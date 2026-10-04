import { describe, expect, it } from 'vitest';
import { MinHeap, topKFrequent, topKLargest } from './top-k';

// The top-k entry's TypeScript code. API:
// - `topKLargest(nums, k)`: the k largest values, largest first (duplicates
//   count separately); `[]` for k <= 0; every value, sorted, if k >= nums.length.
// - `topKFrequent(nums, k)`: the k most frequent distinct values, most frequent
//   first; values with equal counts come smaller value first.
// - `MinHeap<T>`: `push`, `peek`, `replaceTop`, `size`, `toArray`.

function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

function sortLargest(nums: number[], k: number): number[] {
  return [...nums].sort((a, b) => b - a).slice(0, Math.max(k, 0));
}

function sortFrequent(nums: number[], k: number): number[] {
  const counts = new Map<number, number>();
  for (const value of nums) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.keys()]
    .sort((a, b) => counts.get(b)! - counts.get(a)! || a - b)
    .slice(0, Math.max(k, 0));
}

describe('topKLargest (TypeScript)', () => {
  it('returns the k largest, largest first', () => {
    expect(topKLargest([5, 1, 9, 3, 7], 2)).toEqual([9, 7]);
  });

  it('handles empty and single-element input', () => {
    expect(topKLargest([], 3)).toEqual([]);
    expect(topKLargest([4], 1)).toEqual([4]);
    expect(topKLargest([4], 5)).toEqual([4]);
  });

  it('counts duplicates separately', () => {
    expect(topKLargest([5, 5, 5, 1], 2)).toEqual([5, 5]);
    expect(topKLargest([2, 2, 2], 2)).toEqual([2, 2]);
  });

  it('handles negative values', () => {
    expect(topKLargest([-5, -1, -9], 2)).toEqual([-1, -5]);
  });

  it('returns nothing for k = 0 or a negative k', () => {
    expect(topKLargest([1, 2, 3], 0)).toEqual([]);
    expect(topKLargest([1, 2, 3], -2)).toEqual([]);
  });

  it('returns everything, sorted, for k = n and k > n', () => {
    expect(topKLargest([3, 1, 2], 3)).toEqual([3, 2, 1]);
    expect(topKLargest([3, 1, 2], 10)).toEqual([3, 2, 1]);
  });

  it('does not change the input', () => {
    const nums = [4, 8, 1, 9];
    topKLargest(nums, 2);
    expect(nums).toEqual([4, 8, 1, 9]);
  });

  it('matches sorting on many seeded random inputs', () => {
    const random = seededRandom(11);
    for (let n = 0; n < 50; n++) {
      const nums = Array.from({ length: Math.floor(random() * 21) }, () =>
        Math.floor(random() * 21 - 10),
      );
      const k = Math.floor(random() * 26);
      expect(
        topKLargest(nums, k),
        `seed 11, trial ${n}: ${JSON.stringify({ nums, k })}`,
      ).toEqual(sortLargest(nums, k));
    }
  });

  it('matches sorting for every k from 0 past n', () => {
    const random = seededRandom(12);
    const nums = Array.from({ length: 30 }, () => Math.floor(random() * 51));
    for (let k = 0; k < 35; k++) {
      expect(topKLargest(nums, k)).toEqual(sortLargest(nums, k));
    }
  });
});

describe('topKFrequent (TypeScript)', () => {
  it('returns the k most frequent values', () => {
    expect(topKFrequent([1, 1, 1, 2, 2, 3], 2)).toEqual([1, 2]);
  });

  it('handles empty and single-element input', () => {
    expect(topKFrequent([], 2)).toEqual([]);
    expect(topKFrequent([7], 1)).toEqual([7]);
    expect(topKFrequent([7, 7], 4)).toEqual([7]);
  });

  it('breaks ties toward the smaller value', () => {
    expect(topKFrequent([3, 1, 2], 1)).toEqual([1]);
    expect(topKFrequent([3, 3, 1, 1, 2, 2], 2)).toEqual([1, 2]);
    expect(topKFrequent([5, 5, 9, 9, 4], 2)).toEqual([5, 9]);
  });

  it('orders equal counts smaller value first in the result', () => {
    expect(topKFrequent([9, 9, 4, 4, 7], 3)).toEqual([4, 9, 7]);
  });

  it('handles negative values', () => {
    expect(topKFrequent([-1, -1, -2, -2, -3], 2)).toEqual([-2, -1]);
  });

  it('handles k = 0, a negative k, k = distinct count and k above it', () => {
    const nums = [1, 1, 2, 3, 3, 3];
    expect(topKFrequent(nums, 0)).toEqual([]);
    expect(topKFrequent(nums, -1)).toEqual([]);
    expect(topKFrequent(nums, 3)).toEqual([3, 1, 2]);
    expect(topKFrequent(nums, 9)).toEqual([3, 1, 2]);
  });

  it('matches sorting on many seeded random inputs', () => {
    const random = seededRandom(13);
    for (let n = 0; n < 50; n++) {
      const nums = Array.from({ length: Math.floor(random() * 31) }, () =>
        Math.floor(random() * 13 - 6),
      );
      const k = Math.floor(random() * 16);
      expect(
        topKFrequent(nums, k),
        `seed 13, trial ${n}: ${JSON.stringify({ nums, k })}`,
      ).toEqual(sortFrequent(nums, k));
    }
  });
});

describe('MinHeap (TypeScript)', () => {
  it('keeps the smallest at the root and each parent below its children', () => {
    const random = seededRandom(5);
    const heap = new MinHeap<number>((a, b) => a < b);
    const pushed: number[] = [];
    for (let n = 0; n < 200; n++) {
      const value = Math.floor(random() * 100);
      heap.push(value);
      pushed.push(value);
      expect(heap.peek()).toBe(Math.min(...pushed));
      const items = heap.toArray();
      for (let i = 1; i < items.length; i++) {
        expect(items[(i - 1) >> 1]).toBeLessThanOrEqual(items[i]);
      }
    }
    expect(heap.size).toBe(200);
  });

  it('replaceTop swaps out the root and restores the order', () => {
    const heap = new MinHeap<number>((a, b) => a < b);
    for (const value of [2, 5, 3, 9, 8]) heap.push(value);
    heap.replaceTop(7);
    expect(heap.peek()).toBe(3);
    expect(heap.toArray().sort((a, b) => a - b)).toEqual([3, 5, 7, 8, 9]);
  });

  it('peeks undefined when empty', () => {
    expect(new MinHeap<number>((a, b) => a < b).peek()).toBeUndefined();
  });
});
