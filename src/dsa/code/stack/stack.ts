/** A last-in, first-out stack on a dynamic array (a JavaScript array). */
export class Stack<T> {
  private items: T[] = [];

  push(item: T): void {
    this.items.push(item);
  }

  pop(): T {
    if (this.items.length === 0) {
      throw new RangeError('pop from an empty stack');
    }
    return this.items.pop() as T;
  }

  peek(): T {
    if (this.items.length === 0) {
      throw new RangeError('peek at an empty stack');
    }
    return this.items[this.items.length - 1];
  }

  get size(): number {
    return this.items.length;
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }
}

const CLOSER_TO_OPENER: ReadonlyMap<string, string> = new Map([
  [')', '('],
  [']', '['],
  ['}', '{'],
]);
const OPENERS = new Set(CLOSER_TO_OPENER.values());

/** True if every bracket in text is closed by its partner, in the right order. */
export function isBalanced(text: string): boolean {
  const stack = new Stack<string>();
  for (const ch of text) {
    if (OPENERS.has(ch)) {
      stack.push(ch);
    } else if (CLOSER_TO_OPENER.has(ch)) {
      if (stack.isEmpty() || stack.pop() !== CLOSER_TO_OPENER.get(ch)) {
        return false;
      }
    }
  }
  return stack.isEmpty();
}
