/** heap.ts's MinHeap without heapify or empty checks: callers test `size` first. */
export class MinHeap<T> {
  private readonly items: T[] = [];

  constructor(private readonly less: (a: T, b: T) => boolean) {}

  get size(): number {
    return this.items.length;
  }

  peek(): T {
    return this.items[0];
  }

  push(item: T): void {
    const a = this.items;
    a.push(item);
    for (let i = a.length - 1; i > 0;) {
      const parent = (i - 1) >> 1;
      if (!this.less(a[i], a[parent])) return;
      [a[i], a[parent]] = [a[parent], a[i]];
      i = parent;
    }
  }

  pop(): T {
    const a = this.items;
    const top = a[0];
    const last = a.pop() as T;
    if (a.length === 0) return top; // a[0] = last would refill the emptied array
    a[0] = last;
    for (let i = 0, c = 1; c < a.length; c = 2 * i + 1) {
      if (c + 1 < a.length && this.less(a[c + 1], a[c])) c++; // the smaller child
      if (!this.less(a[c], a[i])) break;
      [a[i], a[c]] = [a[c], a[i]];
      i = c;
    }
    return top;
  }
}

type Less<T> = (a: T, b: T) => boolean;

/** The k largest items, largest first; all of them if there are fewer. */
export function topKLargest<T>(items: T[], k: number, less: Less<T>): T[] {
  if (k <= 0) return []; // peek() below would read an empty heap
  const heap = new MinHeap(less);
  for (const x of items) {
    if (heap.size < k) heap.push(x);
    // Strict: an equal item can't improve the k, and a swap costs a sift.
    else if (less(heap.peek(), x)) {
      heap.pop();
      heap.push(x);
    }
  }
  const out: T[] = [];
  while (heap.size > 0) out.push(heap.pop());
  return out.reverse(); // a heap pops smallest first
}

/** One sorted list holding every item of the sorted input lists. */
export function mergeSorted<T>(lists: T[][], less: Less<T>): T[] {
  // [value, list, position]. The list index breaks ties on value, so equal
  // values come out in list order (a stable merge).
  const heap = new MinHeap<[T, number, number]>(
    (a, b) => less(a[0], b[0]) || (!less(b[0], a[0]) && a[1] < b[1]),
  );
  lists.forEach((lst, i) => lst.length > 0 && heap.push([lst[0], i, 0]));
  const merged: T[] = [];
  while (heap.size > 0) {
    const [value, i, pos] = heap.pop(); // a drained list just isn't pushed back
    merged.push(value);
    if (pos + 1 < lists[i].length) heap.push([lists[i][pos + 1], i, pos + 1]);
  }
  return merged;
}

/** The median after each value: the mean of the middle two when even. */
export function runningMedians(stream: number[]): number[] {
  const low = new MinHeap<number>((a, b) => a > b); // max-heap of the smaller half
  const high = new MinHeap<number>((a, b) => a < b); // min-heap of the larger half
  return stream.map((x) => {
    // Through low, then its largest moves to high: wherever x belongs, every
    // item in low stays <= every item in high.
    low.push(x);
    high.push(low.pop());
    // Low keeps the extra item, so its root is the median of an odd count.
    if (high.size > low.size) low.push(high.pop());
    return low.size > high.size ? low.peek() : (low.peek() + high.peek()) / 2;
  });
}
