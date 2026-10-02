/** A double-ended queue stored in a circular buffer that doubles when full. */
export class Deque<T> {
  private slots: (T | undefined)[];
  private head = 0; // the slot holding the front item
  private count = 0;

  constructor(capacity = 8) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new RangeError('capacity must be a positive integer');
    }
    this.slots = new Array<T | undefined>(capacity).fill(undefined);
  }

  get size(): number {
    return this.count;
  }

  get capacity(): number {
    return this.slots.length;
  }

  /** The slot holding the item `offset` places behind the front. */
  private index(offset: number): number {
    return (this.head + offset) % this.slots.length;
  }

  pushBack(item: T): void {
    if (this.count === this.slots.length) this.grow();
    this.slots[this.index(this.count)] = item;
    this.count++;
  }

  pushFront(item: T): void {
    if (this.count === this.slots.length) this.grow();
    const n = this.slots.length;
    this.head = (this.head - 1 + n) % n;
    this.slots[this.head] = item;
    this.count++;
  }

  popBack(): T {
    if (this.count === 0) throw new RangeError('pop from an empty deque');
    const i = this.index(this.count - 1);
    const item = this.slots[i] as T;
    this.slots[i] = undefined;
    this.count--;
    return item;
  }

  popFront(): T {
    if (this.count === 0) throw new RangeError('pop from an empty deque');
    const item = this.slots[this.head] as T;
    this.slots[this.head] = undefined;
    this.head = (this.head + 1) % this.slots.length;
    this.count--;
    return item;
  }

  peekBack(): T {
    if (this.count === 0) throw new RangeError('peek at an empty deque');
    return this.slots[this.index(this.count - 1)] as T;
  }

  peekFront(): T {
    if (this.count === 0) throw new RangeError('peek at an empty deque');
    return this.slots[this.head] as T;
  }

  private grow(): void {
    const old = this.slots;
    this.slots = new Array<T | undefined>(old.length * 2).fill(undefined);
    for (let offset = 0; offset < this.count; offset++) {
      this.slots[offset] = old[(this.head + offset) % old.length];
    }
    this.head = 0;
  }

  *[Symbol.iterator](): Iterator<T> {
    for (let offset = 0; offset < this.count; offset++) {
      yield this.slots[this.index(offset)] as T;
    }
  }
}

/** For each time t (in non-decreasing order), count the times in [t - window, t]. */
export function recentCounts(times: Iterable<number>, window: number): number[] {
  const queue = new Deque<number>();
  const counts: number[] = [];
  for (const t of times) {
    queue.pushBack(t);
    while (queue.peekFront() < t - window) queue.popFront();
    counts.push(queue.size);
  }
  return counts;
}
