/** [start, end], both ends included. */
export type Interval = [number, number];

/** Merges intervals that share at least one point; the result is sorted and disjoint. */
export function mergeIntervals(intervals: Interval[]): Interval[] {
  const merged: Interval[] = [];
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  for (const [start, end] of sorted) {
    const last = merged[merged.length - 1];
    if (last !== undefined && start <= last[1]) {
      last[1] = Math.max(last[1], end);
    } else {
      merged.push([start, end]);
    }
  }
  return merged;
}

/** The most intervals that contain one common point (0 for no intervals). */
export function maxOverlap(intervals: Interval[]): number {
  const starts = intervals.map(([start]) => start).sort((a, b) => a - b);
  const ends = intervals.map(([, end]) => end).sort((a, b) => a - b);
  let best = 0;
  let finished = 0; // how many intervals ended before the current start
  for (let i = 0; i < starts.length; i++) {
    while (ends[finished] < starts[i]) finished++;
    best = Math.max(best, i + 1 - finished);
  }
  return best;
}
