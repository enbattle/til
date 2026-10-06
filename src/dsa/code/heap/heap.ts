/** A binary min-heap in an array: the node at i has children 2i+1 and 2i+2. */
export class MinHeap<T> {
  private items: T[];

  /** `less(a, b)` is true when `a` should come out first; `>` makes a max-heap. */
  constructor(
    private readonly less: (a: T, b: T) => boolean,
    items: Iterable<T> = [],
  ) {
    // The spread copies, so the caller's array isn't rearranged behind their back.
    this.items = [...items];
    // Indexes n >> 1 and up are leaves, already one-node heaps. Going backward
    // means both subtrees of a node are heaps by the time it sifts down.
    for (let i = (this.items.length >> 1) - 1; i >= 0; i--) this.siftDown(i);
  }

  get size(): number {
    return this.items.length;
  }

  peek(): T {
    // Throw rather than return undefined, which a caller may have pushed.
    if (this.items.length === 0) throw new RangeError('peek at an empty heap');
    return this.items[0];
  }

  push(item: T): void {
    this.items.push(item);
    this.siftUp(this.items.length - 1);
  }

  pop(): T {
    if (this.items.length === 0) throw new RangeError('pop from an empty heap');
    // Take the last item, not index 0: deleting the front shifts every item.
    const last = this.items.pop() as T;
    // With one item, items[0] = last would quietly refill the emptied array.
    if (this.items.length === 0) return last;
    const top = this.items[0];
    this.items[0] = last;
    this.siftDown(0);
    return top;
  }

  private siftUp(i: number): void {
    const items = this.items;
    while (i > 0) {
      const parent = (i - 1) >> 1; // / doesn't round: items[1.5] is undefined
      // Strict: an equal parent stays. Stopping is safe, since the parent was
      // already no larger than everything above it.
      if (!this.less(items[i], items[parent])) return;
      [items[i], items[parent]] = [items[parent], items[i]];
      i = parent;
    }
  }

  private siftDown(i: number): void {
    const items = this.items;
    const n = items.length;
    for (let child = 2 * i + 1; child < n; child = 2 * i + 1) {
      // The smaller child, not the first one that beats the item: it moves
      // up and becomes the other child's parent.
      if (child + 1 < n && this.less(items[child + 1], items[child])) child++;
      if (!this.less(items[child], items[i])) return;
      [items[i], items[child]] = [items[child], items[i]];
      i = child;
    }
  }
}
