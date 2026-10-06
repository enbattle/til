/** Push at the back, pop at either end, in a ring that doubles when full. */
export class Deque<T> {
  private slots: (T | undefined)[];
  private head = 0; // the slot holding the front item
  private count = 0;

  constructor(capacity = 4) {
    // At least 1: doubling zero slots would never make room.
    this.slots = new Array<T | undefined>(Math.max(capacity, 1)).fill(undefined);
  }

  get size(): number {
    return this.count;
  }

  private slot(offset: number): number {
    // % sends a position past the last slot back around to slot 0.
    return (this.head + offset) % this.slots.length;
  }

  pushBack(item: T): void {
    // Full: the slot after the back is the front's, so grow before writing.
    if (this.count === this.slots.length) this.grow();
    this.slots[this.slot(this.count)] = item;
    this.count++;
  }

  peekFront(): T {
    // Check the size, not the slot: undefined could be a stored item.
    if (this.count === 0) throw new RangeError('empty deque');
    return this.slots[this.head] as T;
  }

  peekBack(): T {
    if (this.count === 0) throw new RangeError('empty deque');
    return this.slots[this.slot(this.count - 1)] as T;
  }

  popFront(): T {
    const item = this.peekFront();
    this.slots[this.head] = undefined; // don't keep a removed item alive
    this.head = this.slot(1);
    this.count--;
    return item;
  }

  popBack(): T {
    const item = this.peekBack();
    this.slots[this.slot(this.count - 1)] = undefined;
    this.count--;
    return item;
  }

  private grow(): void {
    // Unroll the ring so the front lands in slot 0 of the bigger array.
    const old = this.slots;
    this.slots = new Array<T | undefined>(old.length * 2).fill(undefined);
    for (let i = 0; i < this.count; i++) {
      this.slots[i] = old[(this.head + i) % old.length];
    }
    this.head = 0;
  }
}

const PAIRS: Record<string, string> = { ')': '(', ']': '[', '}': '{' };

/** True if every bracket is closed by its partner, innermost first. */
export function isBalanced(text: string): boolean {
  const stack: string[] = []; // a plain array: push and pop work at the end
  for (const ch of text) {
    if (Object.values(PAIRS).includes(ch)) {
      stack.push(ch);
    } else if (ch in PAIRS) {
      // pop() on an empty array returns undefined, which never equals a
      // bracket, so a closer with nothing open is a mismatch.
      if (stack.pop() !== PAIRS[ch]) return false;
    }
  }
  return stack.length === 0; // an opener still on the stack was never closed
}

/** The maximum of every run of k consecutive items, in O(n). */
export function windowMax(nums: number[], k: number): number[] {
  if (k < 1) throw new RangeError('k must be at least 1');
  const window = new Deque<number>(); // indices; their values fall front to back
  const out: number[] = [];
  for (let i = 0; i < nums.length; i++) {
    // An earlier item no bigger than nums[i] leaves the window before it
    // does, so it can never be the maximum again.
    while (window.size > 0 && nums[window.peekBack()] <= nums[i]) {
      window.popBack();
    }
    window.pushBack(i);
    // Indices, not values: this is how we know the front has expired.
    if (window.peekFront() <= i - k) window.popFront();
    if (i >= k - 1) out.push(nums[window.peekFront()]);
  }
  return out;
}
