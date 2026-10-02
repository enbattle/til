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

  /** Removes the root: moves the last item up to it and sifts it down. */
  pop(): T | undefined {
    const top = this.items[0];
    const last = this.items.pop();
    if (this.items.length > 0 && last !== undefined) {
      this.items[0] = last;
      this.siftDown(0);
    }
    return top;
  }

  /** Overwrites the root with `item` and sifts it down. The heap must not be empty. */
  replaceTop(item: T): void {
    this.items[0] = item;
    this.siftDown(0);
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

/** [value, index of its list, position in that list] */
type Entry = [value: number, list: number, pos: number];

/** Smaller value first; equal values go to the lower list index. */
function before(a: Entry, b: Entry): boolean {
  return a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);
}

/** A heap holding the first value of every non-empty list. */
function startHeap(lists: number[][]): MinHeap<Entry> {
  const heap = new MinHeap<Entry>(before);
  lists.forEach((list, i) => {
    if (list.length > 0) heap.push([list[0], i, 0]);
  });
  return heap;
}

/** Replaces the smallest entry with the next value of its list, if it has one. */
function advance(heap: MinHeap<Entry>, lists: number[][]): void {
  const [, i, pos] = heap.peek()!;
  if (pos + 1 < lists[i].length) {
    heap.replaceTop([lists[i][pos + 1], i, pos + 1]);
  } else {
    heap.pop();
  }
}

/** One sorted array holding every value of the sorted input arrays. */
export function mergeSorted(lists: number[][]): number[] {
  const heap = startHeap(lists);
  const merged: number[] = [];
  while (heap.size > 0) {
    merged.push(heap.peek()![0]);
    advance(heap, lists);
  }
  return merged;
}

/** The value at `rank` (1 is the smallest) in the merged order, or null. */
export function kthSmallest(lists: number[][], rank: number): number | null {
  if (rank < 1) return null;
  const heap = startHeap(lists);
  for (let step = 1; step < rank; step++) {
    if (heap.size === 0) return null;
    advance(heap, lists);
  }
  return heap.size > 0 ? heap.peek()![0] : null;
}
