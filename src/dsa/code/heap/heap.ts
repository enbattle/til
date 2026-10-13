// #region less-than
function lessThan(a: number[], b: number[]): boolean {
  // Like Python tuples: compare the first numbers, and look at the next ones
  // only on a tie. A heap of plain numbers is a heap of one-number arrays, [5].
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (x < y) return true;
    if (x > y) return false;
  }
  // Equal so far: the shorter array comes first, as with tuples.
  return a.length < b.length;
}
// #endregion

// #region min-heap
/** A binary min-heap in an array: the node at i has children 2i+1 and 2i+2. */
export class MinHeap {
  private items: number[][];

  constructor(items: number[][] = []) {
    // Copy, so the caller's array isn't rearranged behind their back.
    this.items = items.slice();
    // Indexes n / 2 and up are leaves, already one-node heaps. Going backward
    // means both subtrees of a node are heaps by the time it sifts down.
    for (let i = Math.floor(this.items.length / 2) - 1; i >= 0; i--) {
      this.siftDown(i);
    }
  }

  size(): number {
    return this.items.length;
  }

  peek(): number[] {
    // Throw rather than return undefined, which a caller may have pushed.
    if (this.items.length === 0) throw new RangeError('peek at an empty heap');
    return this.items[0];
  }
  // #endregion

  // #region push-and-pop
  push(item: number[]): void {
    this.items.push(item);
    this.siftUp(this.items.length - 1);
  }

  pop(): number[] {
    const last = this.items.pop();
    if (last === undefined) throw new RangeError('pop from an empty heap');
    // Took the last item, not index 0: deleting the front shifts every item.
    // With one item, the array is empty now and there is no root to refill.
    if (this.items.length === 0) return last;
    const top = this.items[0];
    this.items[0] = last;
    this.siftDown(0);
    return top;
  }
  // #endregion

  // #region sift-up
  private siftUp(i: number): void {
    const items = this.items;
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2); // plain / would give a fraction
      // An equal parent stays. Stopping is safe, since the parent was
      // already no larger than everything above it.
      if (!lessThan(items[i], items[parent])) return;
      [items[i], items[parent]] = [items[parent], items[i]];
      i = parent;
    }
  }
  // #endregion

  // #region sift-down
  private siftDown(i: number): void {
    const items = this.items;
    const n = items.length;
    while (2 * i + 1 < n) {
      let child = 2 * i + 1;
      // The smaller child, not the first one that beats the item: it moves
      // up and becomes the other child's parent.
      if (child + 1 < n && lessThan(items[child + 1], items[child])) {
        child = child + 1;
      }
      if (!lessThan(items[child], items[i])) return;
      [items[i], items[child]] = [items[child], items[i]];
      i = child;
    }
  }
}
// #endregion
