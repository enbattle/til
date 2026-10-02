/** A binary min-heap on an array: `less(a, b)` says a belongs nearer the root. */
export class MinHeap<T> {
  private readonly items: T[] = [];
  private readonly less: (a: T, b: T) => boolean;

  constructor(less: (a: T, b: T) => boolean) {
    this.less = less;
  }

  get size(): number {
    return this.items.length;
  }

  peek(): T | undefined {
    return this.items[0];
  }

  push(item: T): void {
    this.items.push(item);
    this.siftUp(this.items.length - 1);
  }

  /** Overwrites the root with `item` and sifts it down. The heap must not be empty. */
  replaceTop(item: T): void {
    this.items[0] = item;
    this.siftDown(0);
  }

  toArray(): T[] {
    return [...this.items];
  }

  private siftUp(start: number): void {
    let i = start;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.less(this.items[i], this.items[parent])) return;
      [this.items[i], this.items[parent]] = [this.items[parent], this.items[i]];
      i = parent;
    }
  }

  private siftDown(start: number): void {
    const items = this.items;
    let i = start;
    for (;;) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = left + 1;
      if (left < items.length && this.less(items[left], items[smallest])) {
        smallest = left;
      }
      if (right < items.length && this.less(items[right], items[smallest])) {
        smallest = right;
      }
      if (smallest === i) return;
      [items[i], items[smallest]] = [items[smallest], items[i]];
      i = smallest;
    }
  }
}

/** The k largest values of `nums`, largest first; all of them if k >= nums.length. */
export function topKLargest(nums: number[], k: number): number[] {
  if (k <= 0) return [];
  const heap = new MinHeap<number>((a, b) => a < b);
  for (const value of nums) {
    if (heap.size < k) {
      heap.push(value);
    } else if (value > heap.peek()!) {
      heap.replaceTop(value);
    }
  }
  return heap.toArray().sort((a, b) => b - a);
}

type Entry = [value: number, count: number];

/** True if `a` ranks below `b`: fewer occurrences, or as many and a larger value. */
function ranksBelow(a: Entry, b: Entry): boolean {
  return a[1] < b[1] || (a[1] === b[1] && a[0] > b[0]);
}

/** The k most frequent values, most frequent first; equal counts, smaller first. */
export function topKFrequent(nums: number[], k: number): number[] {
  if (k <= 0) return [];
  const counts = new Map<number, number>();
  for (const value of nums) counts.set(value, (counts.get(value) ?? 0) + 1);
  const heap = new MinHeap<Entry>(ranksBelow);
  for (const entry of counts) {
    if (heap.size < k) {
      heap.push(entry);
    } else if (ranksBelow(heap.peek()!, entry)) {
      heap.replaceTop(entry);
    }
  }
  return heap
    .toArray()
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .map(([value]) => value);
}
