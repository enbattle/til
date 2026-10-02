export const parent = (i: number): number => (i - 1) >> 1;
export const left = (i: number): number => 2 * i + 1;
export const right = (i: number): number => 2 * i + 2;

/** A binary min-heap stored in an array: the smallest item is always at index 0. */
export class MinHeap<T> {
  private items: T[];

  /** `less(a, b)` is true when `a` should come out before `b`. */
  constructor(
    private readonly less: (a: T, b: T) => boolean,
    items: Iterable<T> = [],
  ) {
    this.items = [...items];
    for (let i = (this.items.length >> 1) - 1; i >= 0; i--) this.siftDown(i);
  }

  get size(): number {
    return this.items.length;
  }

  peek(): T {
    if (this.items.length === 0) throw new RangeError('peek at an empty heap');
    return this.items[0];
  }

  push(item: T): void {
    this.items.push(item);
    this.siftUp(this.items.length - 1);
  }

  pop(): T {
    if (this.items.length === 0) throw new RangeError('pop from an empty heap');
    const last = this.items.pop() as T;
    if (this.items.length === 0) return last;
    const top = this.items[0];
    this.items[0] = last;
    this.siftDown(0);
    return top;
  }

  private siftUp(i: number): void {
    const items = this.items;
    while (i > 0 && this.less(items[i], items[parent(i)])) {
      [items[i], items[parent(i)]] = [items[parent(i)], items[i]];
      i = parent(i);
    }
  }

  private siftDown(i: number): void {
    const items = this.items;
    const n = items.length;
    for (;;) {
      const l = left(i);
      const r = right(i);
      let smallest = i;
      if (l < n && this.less(items[l], items[smallest])) smallest = l;
      if (r < n && this.less(items[r], items[smallest])) smallest = r;
      if (smallest === i) return;
      [items[i], items[smallest]] = [items[smallest], items[i]];
      i = smallest;
    }
  }
}

interface Entry<V> {
  priority: number;
  order: number;
  item: V;
}

/** Items come out lowest priority first; equal priorities in insertion order. */
export class PriorityQueue<V> {
  private readonly heap = new MinHeap<Entry<V>>(
    (a, b) => a.priority < b.priority || (a.priority === b.priority && a.order < b.order),
  );
  private nextOrder = 0;

  get size(): number {
    return this.heap.size;
  }

  push(item: V, priority: number): void {
    this.heap.push({ priority, order: this.nextOrder++, item });
  }

  peek(): V {
    return this.heap.peek().item;
  }

  pop(): V {
    return this.heap.pop().item;
  }
}
