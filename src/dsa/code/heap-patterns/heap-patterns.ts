// #region imports
import { MinHeap } from '../heap/heap';
// #endregion

// #region top-k-largest
/** The k largest items, largest first; all of them if there are fewer. */
export function topKLargest(items: number[], k: number): number[] {
  if (k <= 0) return []; // peek() below would throw on an empty heap
  const heap = new MinHeap();
  for (const x of items) {
    if (heap.size() < k) {
      heap.push([x]);
    } else if (heap.peek()[0] < x) {
      // Strict: an equal item can't improve the k, and a swap costs a sift.
      heap.pop();
      heap.push([x]);
    }
  }
  const result: number[] = [];
  while (heap.size() > 0) {
    result.push(heap.pop()[0]);
  }
  return result.reverse(); // a heap pops smallest first
}
// #endregion

// #region merge-sorted
/** One sorted list holding every item of the sorted input lists. */
export function mergeSorted(lists: number[][]): number[] {
  // Each entry is [value, which list, position]. The list index breaks ties on
  // value, so equal values come out in list order (a stable merge).
  const heap = new MinHeap();
  for (let i = 0; i < lists.length; i++) {
    if (lists[i].length > 0) {
      heap.push([lists[i][0], i, 0]);
    }
  }
  const merged: number[] = [];
  while (heap.size() > 0) {
    const [value, i, pos] = heap.pop();
    merged.push(value);
    // A drained list just isn't pushed back; reading past its end would give undefined.
    if (pos + 1 < lists[i].length) {
      heap.push([lists[i][pos + 1], i, pos + 1]);
    }
  }
  return merged;
}
// #endregion

// #region running-medians
/** The median after each value: the mean of the middle two when even. */
export function runningMedians(stream: number[]): number[] {
  // MinHeap is a min-heap, so low stores negated values: its smallest entry is
  // the largest of the smaller half.
  const low = new MinHeap(); // the smaller half
  const high = new MinHeap(); // the larger half
  const medians: number[] = [];
  for (const x of stream) {
    // Through low, then its largest moves to high: wherever x belongs, every
    // item in low stays <= every item in high.
    low.push([-x]);
    const largestSmall = -low.pop()[0];
    high.push([largestSmall]);
    // Low keeps the extra item, so its root is the median of an odd count.
    if (high.size() > low.size()) {
      const smallestLarge = high.pop()[0];
      low.push([-smallestLarge]);
    }
    if (low.size() > high.size()) {
      medians.push(-low.peek()[0]);
    } else {
      medians.push((-low.peek()[0] + high.peek()[0]) / 2);
    }
  }
  return medians;
}
// #endregion
