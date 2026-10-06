import { describe, expect, it } from 'vitest';
import { insertInterval, maxOverlap, mergeIntervals, type Interval } from './intervals';

const MEETINGS: Interval[] = [
  [8, 10],
  [1, 3],
  [2, 6],
  [15, 18],
  [6, 7],
];

/** A number that counts how often it is read as one (every comparison does). */
let reads = 0;
function counted(intervals: Interval[]): Interval[] {
  reads = 0;
  const wrap = (v: number) => ({ valueOf: () => (reads++, v) }) as unknown as number;
  return intervals.map(([s, e]): Interval => [wrap(s), wrap(e)]);
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomIntervals(random: () => number, size: number): Interval[] {
  const between = (low: number, high: number) =>
    low + Math.floor(random() * (high - low + 1));
  const intervals: Interval[] = [];
  for (let k = between(0, size); k > 0; k--) {
    const start = between(-6, 12);
    intervals.push([start, start + between(0, 6)]);
  }
  return intervals;
}

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
    expect(mergeIntervals(MEETINGS)).toEqual([
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

  it('sorts instead of comparing every pair', () => {
    const random = mulberry32(3);
    const n = 1000;
    const starts = new Set<number>();
    while (starts.size < n) starts.add(Math.floor(random() * 1e4));
    const given = counted(
      [...starts].map((s): Interval => [s, s + Math.floor(random() * 6)]),
    );
    mergeIntervals(given);
    // A sort reads at least 2 (n - 1) and about 2 n log n; every pair would be n * n.
    expect(reads, 'seed 3').toBeGreaterThanOrEqual(2 * (n - 1));
    expect(reads, 'seed 3').toBeLessThanOrEqual(40 * n);
  });
});

describe('maxOverlap (TypeScript)', () => {
  it('handles empty and single inputs', () => {
    expect(maxOverlap([])).toBe(0);
    expect(maxOverlap([[3, 3]])).toBe(1);
  });

  it('handles the worked example', () => {
    expect(maxOverlap(MEETINGS)).toBe(2);
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

  it('sorts and sweeps instead of checking every pair', () => {
    const random = mulberry32(4);
    const n = 1000;
    const starts = new Set<number>();
    while (starts.size < n) starts.add(Math.floor(random() * 1e4));
    const given = counted(
      [...starts].map((s): Interval => [s, s + Math.floor(random() * 2000)]),
    );
    maxOverlap(given);
    // Two sorts and one sweep; a rescan per start would add about n * n reads.
    expect(reads, 'seed 4').toBeGreaterThanOrEqual(2 * (n - 1));
    expect(reads, 'seed 4').toBeLessThanOrEqual(100 * n);
  });
});

describe('insertInterval (TypeScript)', () => {
  it('handles empty input and both ends of the list', () => {
    expect(insertInterval([], [2, 3])).toEqual([[2, 3]]);
    expect(insertInterval([[5, 6]], [1, 2])).toEqual([
      [1, 2],
      [5, 6],
    ]);
    expect(insertInterval([[1, 2]], [5, 6])).toEqual([
      [1, 2],
      [5, 6],
    ]);
  });

  it('fuses what it touches', () => {
    const merged: Interval[] = [
      [1, 7],
      [8, 10],
      [15, 18],
    ];
    expect(insertInterval(merged, [7, 9])).toEqual([
      [1, 10],
      [15, 18],
    ]);
    expect(insertInterval(merged, [11, 14])).toEqual([
      [1, 7],
      [8, 10],
      [11, 14],
      [15, 18],
    ]);
    expect(insertInterval(merged, [0, 20])).toEqual([[0, 20]]);
    expect(insertInterval(merged, [2, 3])).toEqual(merged);
    expect(insertInterval(merged, [10, 15])).toEqual([
      [1, 7],
      [8, 18],
    ]);
  });

  it('does not change the input', () => {
    const merged: Interval[] = [
      [1, 2],
      [4, 5],
    ];
    insertInterval(merged, [2, 4]);
    expect(merged).toEqual([
      [1, 2],
      [4, 5],
    ]);
  });
});

describe('against brute force (TypeScript)', () => {
  it('merge and overlap agree on seeded random interval sets', () => {
    const random = mulberry32(11);
    for (let n = 0; n < 50; n++) {
      const intervals = randomIntervals(random, 8);
      const at = `seed 11, trial ${n}: ${JSON.stringify(intervals)}`;
      expect(mergeIntervals(intervals), at).toEqual(bruteMerge(intervals));
      expect(maxOverlap(intervals), at).toBe(bruteMaxOverlap(intervals));
    }
  });

  it('insert agrees with merging everything again', () => {
    const random = mulberry32(12);
    for (let n = 0; n < 50; n++) {
      const merged = mergeIntervals(randomIntervals(random, 6));
      const start = Math.floor(random() * 23) - 8;
      const added: Interval = [start, start + Math.floor(random() * 7)];
      const at = `seed 12, trial ${n}: ${JSON.stringify(merged)} + ${added}`;
      expect(insertInterval(merged, added), at).toEqual(bruteMerge([...merged, added]));
    }
  });
});
