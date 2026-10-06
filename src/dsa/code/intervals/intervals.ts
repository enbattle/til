/** [start, end], both ends included. */
export type Interval = [number, number];

/** Merges intervals that share at least one point; the result is sorted and disjoint. */
export function mergeIntervals(intervals: Interval[]): Interval[] {
  const merged: Interval[] = [];
  // Sorted by start, on a copy, numerically: sort() mutates, and with no
  // comparator it compares text, so [10, 12] would land before [2, 3].
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  for (const [start, end] of sorted) {
    const last = merged[merged.length - 1];
    // <=, not <: with inclusive ends, [2, 6] and [6, 7] share the point 6.
    if (last !== undefined && start <= last[1]) {
      // max, not end: a nested [2, 3] inside [1, 10] must not shrink it.
      last[1] = Math.max(last[1], end);
    } else {
      merged.push([start, end]);
    }
  }
  return merged;
}

/** The most intervals that contain one common point (0 for no intervals). */
export function maxOverlap(intervals: Interval[]): number {
  // Sorted apart: which end belongs to which start never matters for counting.
  const starts = intervals.map(([start]) => start).sort((a, b) => a - b);
  const ends = intervals.map(([, end]) => end).sort((a, b) => a - b);
  let best = 0;
  let finished = 0;
  for (let i = 0; i < starts.length; i++) {
    // <, not <=: an end equal to this start still contains the point.
    // finished never moves back, since later starts are no smaller.
    while (ends[finished] < starts[i]) finished++;
    best = Math.max(best, i + 1 - finished);
  }
  return best;
}

/** Adds one interval to a sorted, disjoint list, fusing what it touches. */
export function insertInterval(merged: Interval[], added: Interval): Interval[] {
  let [start, end] = added;
  const out: Interval[] = [];
  let i = 0;
  // Strictly before: an interval ending at start still shares that point.
  while (i < merged.length && merged[i][1] < start) out.push(merged[i++]);
  while (i < merged.length && merged[i][0] <= end) {
    // min and max both: added may sit inside or stretch past either side.
    start = Math.min(start, merged[i][0]);
    end = Math.max(end, merged[i][1]);
    i++;
  }
  out.push([start, end]);
  return out.concat(merged.slice(i));
}
