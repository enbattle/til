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
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.less(this.items[i], this.items[parent])) break;
      [this.items[i], this.items[parent]] = [this.items[parent], this.items[i]];
      i = parent;
    }
  }

  /** Removes and returns the root. The heap must not be empty. */
  pop(): T {
    const items = this.items;
    const top = items[0];
    const last = items.pop()!;
    if (items.length > 0) {
      items[0] = last;
      let i = 0;
      for (;;) {
        let best = i;
        const left = 2 * i + 1;
        const right = left + 1;
        if (left < items.length && this.less(items[left], items[best])) best = left;
        if (right < items.length && this.less(items[right], items[best])) best = right;
        if (best === i) break;
        [items[i], items[best]] = [items[best], items[i]];
        i = best;
      }
    }
    return top;
  }
}

/** The median of the numbers added so far: O(log n) per add, O(1) per read. */
export class RunningMedian {
  private readonly lower = new MinHeap<number>((a, b) => a > b); // max-heap
  private readonly upper = new MinHeap<number>((a, b) => a < b); // min-heap

  get size(): number {
    return this.lower.size + this.upper.size;
  }

  add(value: number): void {
    this.lower.push(value);
    this.upper.push(this.lower.pop());
    if (this.upper.size > this.lower.size) {
      this.lower.push(this.upper.pop());
    }
  }

  /** The middle value, or the mean of the two middle values. Throws if empty. */
  median(): number {
    if (this.lower.size === 0) throw new Error('median of an empty stream');
    if (this.lower.size > this.upper.size) return this.lower.peek()!;
    return (this.lower.peek()! + this.upper.peek()!) / 2;
  }
}
