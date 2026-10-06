import { describe, expect, it, vi } from 'vitest';
import { Deque, isBalanced, windowMax } from './stacks-and-queues';

// API: `new Deque<T>(capacity = 4)` with `pushBack`, `popBack`,
// `popFront`, `peekBack`, `peekFront` (the last four throw a RangeError when
// empty), and `size`; `isBalanced(text)`; `windowMax(nums, k)`.

/** A small seeded generator (mulberry32), so a failing case can be replayed. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const int = (r: () => number, lo: number, hi: number) =>
  lo + Math.floor(r() * (hi - lo + 1));

function drain<T>(d: Deque<T>): T[] {
  const out: T[] = [];
  while (d.size > 0) out.push(d.popFront());
  return out;
}

const slotsOf = (d: Deque<unknown>) => (d as unknown as { slots: unknown[] }).slots;

describe('Deque', () => {
  it('throws on every read when empty', () => {
    const d = new Deque<number>();
    for (const read of [
      () => d.popBack(),
      () => d.popFront(),
      () => d.peekBack(),
      () => d.peekFront(),
    ]) {
      expect(read).toThrow(RangeError);
    }
  });

  it('treats one item as both ends, even when it is undefined', () => {
    const d = new Deque<number | undefined>();
    d.pushBack(undefined);
    expect(d.size).toBe(1);
    expect(d.peekBack()).toBeUndefined();
    expect(d.popFront()).toBeUndefined();
    expect(d.size).toBe(0);
    expect(() => d.popBack()).toThrow(RangeError);
  });

  it('works as a queue and as a stack', () => {
    const d = new Deque<number>();
    for (let i = 0; i < 3; i++) d.pushBack(i);
    expect([d.peekFront(), d.peekBack()]).toEqual([0, 2]);
    expect(d.popBack()).toBe(2);
    expect(drain(d)).toEqual([0, 1]);
  });

  it('wraps around without growing', () => {
    const d = new Deque<number>(4);
    for (let i = 0; i < 4; i++) d.pushBack(i);
    d.popFront();
    d.popFront();
    d.pushBack(4);
    d.pushBack(5); // lands in slot 0, behind the front
    expect(slotsOf(d).length).toBe(4);
    expect(drain(d)).toEqual([2, 3, 4, 5]);
  });

  it('floors the capacity at one', () => {
    const d = new Deque<string>(0);
    d.pushBack('a');
    d.pushBack('b');
    expect(drain(d)).toEqual(['a', 'b']);
  });

  it('keeps the order when it grows from a wrapped ring', () => {
    const d = new Deque<number>(4);
    for (let i = 0; i < 4; i++) d.pushBack(i);
    d.popFront();
    d.pushBack(4); // the ring is full and wrapped
    d.pushBack(5); // forces a grow from the wrapped state
    expect(slotsOf(d).length).toBe(8);
    expect(drain(d)).toEqual([1, 2, 3, 4, 5]);
  });

  it('mechanism: a steady queue reuses its slots', () => {
    const d = new Deque<number>(4);
    const slots = slotsOf(d);
    d.pushBack(0);
    for (let i = 1; i < 1000; i++) {
      d.pushBack(i);
      expect(d.popFront()).toBe(i - 1);
    }
    expect(slotsOf(d).length).toBe(4);
    expect(slotsOf(d)).toBe(slots); // nothing was reallocated
  });

  it('mechanism: capacity doubles and stays proportional to size', () => {
    const d = new Deque<number>(1);
    const sizes = new Set([slotsOf(d).length]);
    for (let i = 0; i < 1000; i++) {
      d.pushBack(i);
      expect(slotsOf(d).length).toBeLessThan(2 * d.size + 1);
      sizes.add(slotsOf(d).length);
    }
    expect([...sizes]).toEqual([1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024]);
  });

  it('clears popped slots', () => {
    const d = new Deque<object>(4);
    d.pushBack({});
    d.pushBack({});
    d.popFront();
    d.popBack();
    expect(slotsOf(d).every((s) => s === undefined)).toBe(true);
  });

  it('matches a plain array on random operations', () => {
    for (let seed = 0; seed < 50; seed++) {
      const r = rng(seed);
      const mine = new Deque<number>(2);
      const real: number[] = [];
      for (let step = 0; step < 200; step++) {
        const op = int(r, 0, 3);
        const where = `seed=${seed} step=${step} op=${op}`;
        if (op < 2) {
          mine.pushBack(step);
          real.push(step);
        } else if (real.length > 0) {
          const got = op === 2 ? mine.popBack() : mine.popFront();
          const want = op === 2 ? real.pop() : real.shift();
          expect(got, where).toBe(want);
        }
        expect(mine.size, where).toBe(real.length);
        if (real.length > 0) {
          expect([mine.peekFront(), mine.peekBack()], where).toEqual([
            real[0],
            real[real.length - 1],
          ]);
        }
      }
    }
  });
});

describe('isBalanced', () => {
  it.each(['', '()', '([]{})', 'a(b)c', '{[()()]}'])('accepts %j', (text) => {
    expect(isBalanced(text)).toBe(true);
  });

  it.each(['(', ')', '(]', '([)]', '(()', '())', '}{'])('rejects %j', (text) => {
    expect(isBalanced(text)).toBe(false);
  });

  it('matches repeated pair removal on random strings', () => {
    const byRemoval = (s: string): boolean => {
      for (;;) {
        const shorter = s.replace('()', '').replace('[]', '').replace('{}', '');
        if (shorter === s) return s === '';
        s = shorter;
      }
    };
    const r = rng(7);
    for (let trial = 0; trial < 50; trial++) {
      let text = '';
      for (let n = int(r, 0, 10); n > 0; n--) text += '()[]{}'[int(r, 0, 5)];
      expect(isBalanced(text), `seed=7 trial=${trial} ${text}`).toBe(byRemoval(text));
    }
  });
});

describe('windowMax', () => {
  it('mechanism: appends each index exactly once', () => {
    // A brute-force max over slices would never touch the deque.
    const spy = vi.spyOn(Deque.prototype, 'pushBack');
    try {
      windowMax(
        Array.from({ length: 2000 }, (_, i) => i),
        500,
      );
      expect(spy).toHaveBeenCalledTimes(2000);
    } finally {
      spy.mockRestore();
    }
  });

  it('handles the entry example', () => {
    expect(windowMax([1, 3, -1, -3, 5, 3, 6, 7], 3)).toEqual([3, 3, 5, 5, 6, 7]);
  });

  it('handles the edges', () => {
    expect(windowMax([], 3)).toEqual([]);
    expect(windowMax([5], 1)).toEqual([5]);
    expect(windowMax([1, 2], 3)).toEqual([]);
    expect(windowMax([4, 4, 4, 4], 2)).toEqual([4, 4, 4]);
    expect(windowMax([1, 2, 3, 4], 4)).toEqual([4]);
    expect(windowMax([3, 2, 1], 1)).toEqual([3, 2, 1]);
    expect(() => windowMax([1], 0)).toThrow(RangeError);
  });

  it('matches brute force on random input', () => {
    const r = rng(11);
    for (let trial = 0; trial < 50; trial++) {
      const nums = Array.from({ length: int(r, 0, 15) }, () => int(r, -5, 5));
      const k = int(r, 1, 6);
      const want: number[] = [];
      for (let i = 0; i + k <= nums.length; i++) {
        want.push(Math.max(...nums.slice(i, i + k)));
      }
      expect(windowMax(nums, k), `seed=11 trial=${trial} ${nums} k=${k}`).toEqual(want);
    }
  });

  it('mechanism: ring pops stay constant-time (no shifting)', () => {
    // A front pop that shifted items would rewrite every slot; count writes.
    const d = new Deque<number>(1024);
    for (let i = 0; i < 1000; i++) d.pushBack(i);
    const slots = slotsOf(d);
    const before = slots.slice();
    d.popFront();
    expect(slots.filter((s, i) => s !== before[i]).length).toBe(1);
  });
});
