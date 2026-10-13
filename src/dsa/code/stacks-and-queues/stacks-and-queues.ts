// #region deque-state
/** Add at the back, remove from either end, in a ring that doubles when full. */
export class Deque {
  private slots: number[];
  private head = 0; // the slot holding the front item
  private count = 0;

  constructor(capacity = 4) {
    // At least 1: doubling zero slots would never make room.
    if (capacity < 1) capacity = 1;
    this.slots = new Array<number>(capacity).fill(0);
  }

  size(): number {
    return this.count;
  }

  private slot(offset: number): number {
    // % sends a position past the last slot back around to slot 0.
    return (this.head + offset) % this.slots.length;
  }
  // #endregion

  // #region add-at-back
  pushBack(item: number): void {
    if (this.count === this.slots.length) {
      this.grow(); // full: the slot after the back is the front's
    }
    this.slots[this.slot(this.count)] = item;
    this.count += 1;
  }
  // #endregion

  // #region read-and-remove
  peekFront(): number {
    // Check the count, not the slot: any value, even 0, could be an item.
    if (this.count === 0) throw new RangeError('empty deque');
    return this.slots[this.head];
  }

  peekBack(): number {
    if (this.count === 0) throw new RangeError('empty deque');
    return this.slots[this.slot(this.count - 1)];
  }

  popFront(): number {
    const item = this.peekFront();
    this.head = this.slot(1);
    this.count -= 1;
    return item;
  }

  popBack(): number {
    const item = this.peekBack();
    this.count -= 1;
    return item;
  }
  // #endregion

  // #region grow
  private grow(): void {
    // Unroll the ring so the front lands in slot 0 of the bigger array.
    const old = this.slots;
    this.slots = new Array<number>(old.length * 2).fill(0);
    for (let i = 0; i < this.count; i++) {
      this.slots[i] = old[(this.head + i) % old.length];
    }
    this.head = 0;
  }
}
// #endregion

// #region is-balanced
const OPENERS = '([{';
const PARTNER = new Map([
  [')', '('],
  [']', '['],
  ['}', '{'],
]); // each closer maps to its opener

/** True if every bracket is closed by its partner, innermost first. */
export function isBalanced(text: string): boolean {
  const stack: string[] = []; // a plain array: push and pop work at the end
  for (const ch of text) {
    if (OPENERS.includes(ch)) {
      stack.push(ch);
    } else if (PARTNER.has(ch)) {
      // A closer with nothing open is a mismatch; check before popping.
      if (stack.length === 0) return false;
      const top = stack.pop();
      if (top !== PARTNER.get(ch)) return false;
    }
  }
  return stack.length === 0; // an opener still on the stack was never closed
}
// #endregion

// #region window-max
/** The maximum of every run of k consecutive items, in O(n). */
export function windowMax(nums: number[], k: number): number[] {
  if (k < 1) throw new RangeError('k must be at least 1');
  const window = new Deque(); // indices; their values fall front to back
  const out: number[] = [];
  for (let i = 0; i < nums.length; i++) {
    // An earlier item no bigger than nums[i] leaves the window before it
    // does, so it can never be the maximum again.
    while (window.size() > 0 && nums[window.peekBack()] <= nums[i]) {
      window.popBack();
    }
    window.pushBack(i);
    // Indices, not values: this is how we know the front has expired.
    if (window.peekFront() <= i - k) window.popFront();
    if (i >= k - 1) out.push(nums[window.peekFront()]);
  }
  return out;
}
// #endregion
