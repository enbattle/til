import { describe, expect, it } from 'vitest';
import { Stack, isBalanced } from './stack';

// The stack entry's TypeScript code.
// API: `new Stack<T>()` with `push`, `pop` and `peek` (both throw a RangeError
// on an empty stack), `size` and `isEmpty`; `isBalanced(text)`.

/** A seeded 32-bit linear congruential generator, so failures reproduce. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** Brute force: keep deleting adjacent matched pairs until none are left. */
function balancedByErasing(text: string): boolean {
  let s = [...text].filter((ch) => '()[]{}'.includes(ch)).join('');
  for (;;) {
    const shorter = s.replaceAll('()', '').replaceAll('[]', '').replaceAll('{}', '');
    if (shorter === s) return s === '';
    s = shorter;
  }
}

describe('Stack (TypeScript)', () => {
  it('starts empty', () => {
    const stack = new Stack<number>();
    expect(stack.size).toBe(0);
    expect(stack.isEmpty()).toBe(true);
  });

  it('throws a RangeError on pop or peek of an empty stack', () => {
    expect(() => new Stack<number>().pop()).toThrow(RangeError);
    expect(() => new Stack<number>().pop()).toThrow('empty stack');
    expect(() => new Stack<number>().peek()).toThrow(RangeError);
    expect(() => new Stack<number>().peek()).toThrow('empty stack');
  });

  it('handles one element', () => {
    const stack = new Stack<number>();
    stack.push(42);
    expect(stack.size).toBe(1);
    expect(stack.isEmpty()).toBe(false);
    expect(stack.peek()).toBe(42);
    expect(stack.size).toBe(1);
    expect(stack.pop()).toBe(42);
    expect(stack.isEmpty()).toBe(true);
    expect(() => stack.pop()).toThrow(RangeError);
  });

  it('is last in, first out', () => {
    const stack = new Stack<number>();
    [1, 2, 3].forEach((x) => stack.push(x));
    expect([stack.pop(), stack.pop(), stack.pop()]).toEqual([3, 2, 1]);
  });

  it('stores undefined, null and 0 as ordinary values', () => {
    const stack = new Stack<number | null | undefined>();
    stack.push(undefined);
    stack.push(null);
    stack.push(0);
    expect(stack.pop()).toBe(0);
    expect(stack.pop()).toBeNull();
    expect(stack.peek()).toBeUndefined();
    expect(stack.pop()).toBeUndefined();
    expect(stack.isEmpty()).toBe(true);
    expect(() => stack.pop()).toThrow(RangeError);
  });

  it('is usable again after emptying', () => {
    const stack = new Stack<string>();
    stack.push('a');
    stack.pop();
    stack.push('b');
    expect(stack.peek()).toBe('b');
    expect(stack.size).toBe(1);
  });

  it('matches a plain array on seeded random operation sequences', () => {
    for (let seed = 0; seed < 50; seed++) {
      const random = seededRandom(seed);
      const stack = new Stack<number>();
      const model: number[] = [];
      const steps = 1 + Math.floor(random() * 59);
      for (let step = 0; step < steps; step++) {
        const at = `seed ${seed}, step ${step}`;
        const roll = random();
        if (roll < 0.5) {
          const x = Math.floor(random() * 11) - 5;
          stack.push(x);
          model.push(x);
        } else if (roll < 0.75) {
          if (model.length > 0) expect(stack.pop(), at).toBe(model.pop());
          else expect(() => stack.pop(), at).toThrow(RangeError);
        } else if (model.length > 0) {
          expect(stack.peek(), at).toBe(model[model.length - 1]);
        } else {
          expect(() => stack.peek(), at).toThrow(RangeError);
        }
        expect(stack.size, at).toBe(model.length);
        expect(stack.isEmpty(), at).toBe(model.length === 0);
      }
    }
  });
});

describe('isBalanced (TypeScript)', () => {
  it.each([
    ['', true],
    ['()', true],
    ['([]{})', true],
    ['{[()()]}', true],
    ['(', false],
    ['((()', false],
    [')', false],
    ['())', false],
    ['([)]', false],
    ['(]', false],
    ['}{', false],
    ['a(b[c]d)e', true],
    ['f(x) = [1, 2]', true],
    ['no brackets at all', true],
    ['x)', false],
    ['<>', true],
  ])('isBalanced(%j) is %s', (text, expected) => {
    expect(isBalanced(text)).toBe(expected);
  });

  it('matches a brute-force answer on seeded random strings', () => {
    const random = seededRandom(3);
    const alphabet = '()[]{}x';
    for (let i = 0; i < 50; i++) {
      const length = Math.floor(random() * 11);
      const text = Array.from(
        { length },
        () => alphabet[Math.floor(random() * alphabet.length)],
      ).join('');
      expect(isBalanced(text), `seed 3, trial ${i}: ${JSON.stringify(text)}`).toBe(
        balancedByErasing(text),
      );
    }
  });
});
