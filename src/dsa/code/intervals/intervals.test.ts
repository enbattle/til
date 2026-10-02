import { describe, expect, it } from 'vitest';
import { maxOverlap, mergeIntervals, type Interval } from './intervals';

/** Counts the intervals covering every integer point and takes the largest count. */
function bruteMaxOverlap(intervals: Interval[]): number {
  if (intervals.length === 0) return 0;
  const low = Math.min(...intervals.map(([start]) => start));
  const high = Math.max(...intervals.map(([, end]) => end));
  let best = 0;
  for (let x = low; x <= high; x++) {
    const count = intervals.filter(([start, end]) => start <= x && x <= end).length;
    best = Math.max(best, count);
  }
  return best;
}

/** Keeps fusing any two intervals that share a point until none do. */
function bruteMerge(intervals: Interval[]): Interval[] {
  const pending = intervals.map(([start, end]): Interval => [start, end]);
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < pending.length && !changed; i++) {
      for (let j = i + 1; j < pending.length; j++) {
        const [a, b] = [pending[i], pending[j]];
        if (a[0] <= b[1] && b[0] <= a[1]) {
          pending[i] = [Math.min(a[0], b[0]), Math.max(a[1], b[1])];
          pending.splice(j, 1);
          changed = true;
          break;
        }
      }
    }
  }
  return pending.sort((a, b) => a[0] - b[0]);
}

describe('mergeIntervals (TypeScript)', () => {
  it('handles empty and single inputs', () => {
    expect(mergeIntervals([])).toEqual([]);
    expect(mergeIntervals([[4, 4]])).toEqual([[4, 4]]);
  });

  it('merges the worked example', () => {
    const given: Interval[] = [
      [8, 10],
      [1, 3],
      [2, 6],
      [15, 18],
      [6, 7],
    ];
    expect(mergeIntervals(given)).toEqual([
      [1, 7],
      [8, 10],
      [15, 18],
    ]);
  });

  it('merges intervals sharing a point but not adjacent integers', () => {
    expect(
      mergeIntervals([
        [1, 3],
        [3, 5],
      ]),
    ).toEqual([[1, 5]]);
    expect(
      mergeIntervals([
        [1, 3],
        [4, 5],
      ]),
    ).toEqual([
      [1, 3],
      [4, 5],
    ]);
  });

  it('handles nested and duplicate intervals', () => {
    expect(
      mergeIntervals([
        [1, 10],
        [2, 3],
        [4, 5],
      ]),
    ).toEqual([[1, 10]]);
    expect(
      mergeIntervals([
        [2, 3],
        [2, 3],
      ]),
    ).toEqual([[2, 3]]);
    expect(
      mergeIntervals([
        [1, 4],
        [1, 2],
      ]),
    ).toEqual([[1, 4]]);
  });

  it('merges a chain from unsorted input, with negatives', () => {
    expect(
      mergeIntervals([
        [7, 9],
        [1, 4],
        [3, 5],
        [5, 8],
      ]),
    ).toEqual([[1, 9]]);
    expect(
      mergeIntervals([
        [-5, -2],
        [-3, 0],
        [2, 3],
      ]),
    ).toEqual([
      [-5, 0],
      [2, 3],
    ]);
  });

  it('sorts numerically, not as text', () => {
    expect(
      mergeIntervals([
        [10, 12],
        [9, 9],
        [2, 3],
      ]),
    ).toEqual([
      [2, 3],
      [9, 9],
      [10, 12],
    ]);
  });

  it('does not change the input', () => {
    const given: Interval[] = [
      [5, 6],
      [1, 5],
    ];
    mergeIntervals(given);
    expect(given).toEqual([
      [5, 6],
      [1, 5],
    ]);
  });
});

describe('maxOverlap (TypeScript)', () => {
  it('handles empty and single inputs', () => {
    expect(maxOverlap([])).toBe(0);
    expect(maxOverlap([[3, 3]])).toBe(1);
  });

  it('handles the worked example', () => {
    expect(
      maxOverlap([
        [8, 10],
        [1, 3],
        [2, 6],
        [15, 18],
        [6, 7],
      ]),
    ).toBe(2);
  });

  it('counts touching ends as overlapping', () => {
    expect(
      maxOverlap([
        [1, 3],
        [3, 5],
      ]),
    ).toBe(2);
    expect(
      maxOverlap([
        [1, 3],
        [4, 5],
      ]),
    ).toBe(1);
  });

  it('handles nested, identical and disjoint intervals', () => {
    expect(
      maxOverlap([
        [1, 10],
        [2, 9],
        [3, 8],
        [4, 7],
      ]),
    ).toBe(4);
    expect(
      maxOverlap([
        [2, 5],
        [2, 5],
        [2, 5],
      ]),
    ).toBe(3);
    expect(
      maxOverlap([
        [1, 1],
        [2, 2],
        [3, 3],
      ]),
    ).toBe(1);
  });

  it('does not count an interval that ended before a later start', () => {
    expect(
      maxOverlap([
        [1, 2],
        [1, 2],
        [5, 6],
      ]),
    ).toBe(2);
  });
});

describe('both functions against brute force (TypeScript)', () => {
  it('agree on many seeded random interval sets', () => {
    let seed = 11;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const between = (low: number, high: number) =>
      low + Math.floor(random() * (high - low + 1));
    for (let n = 0; n < 1000; n++) {
      const intervals: Interval[] = [];
      for (let k = between(0, 8); k > 0; k--) {
        const start = between(-6, 12);
        intervals.push([start, start + between(0, 6)]);
      }
      expect(mergeIntervals(intervals)).toEqual(bruteMerge(intervals));
      expect(maxOverlap(intervals)).toBe(bruteMaxOverlap(intervals));
    }
  });
});
