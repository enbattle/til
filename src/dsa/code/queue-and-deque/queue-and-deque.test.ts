import { describe, expect, it } from 'vitest';
import { Deque, recentCounts } from './queue-and-deque';

// The queue entry's TypeScript code. API: `new Deque<T>(capacity = 8)` with
// `pushBack`, `pushFront`, `popBack`, `popFront`, `peekBack`, `peekFront`
// (each of the last four throws a RangeError when empty), `size`, `capacity`
// and iteration front to back; and `recentCounts(times, window)`.

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

const removers = ['popBack', 'popFront', 'peekBack', 'peekFront'] as const;

describe('Deque (TypeScript)', () => {
  // The pops clear the slot they free, so the buffer never keeps a removed item
  // alive (the Python tests check the same with a weak reference).
  it('leaves every slot empty after draining from both ends, wrapped', () => {
    const d = new Deque<object>(4);
    d.pushBack({});
    d.pushBack({});
    d.pushFront({}); // the head wraps to the last slot
    d.pushFront({});
    d.popFront();
    d.popBack();
    d.popFront();
    d.popBack();
    const { slots } = d as unknown as { slots: unknown[] };
    expect(slots.every((slot) => slot === undefined)).toBe(true);
  });

  it('starts empty with the capacity it was given', () => {
    const d = new Deque<number>(4);
    expect(d.size).toBe(0);
    expect(d.capacity).toBe(4);
    expect([...d]).toEqual([]);
  });

  it('defaults to a positive capacity', () => {
    expect(new Deque<number>().capacity).toBeGreaterThan(0);
  });

  it.each([0, -1, 1.5])('rejects capacity %s', (capacity) => {
    expect(() => new Deque<number>(capacity)).toThrow(RangeError);
  });

  it.each(removers)('%s throws on an empty deque', (method) => {
    const d = new Deque<number>();
    expect(() => d[method]()).toThrow(RangeError);
  });

  it.each(removers)('%s throws again after the deque is drained', (method) => {
    const d = new Deque<number>(2);
    d.pushBack(1);
    d.pushFront(0);
    d.popBack();
    d.popFront();
    expect(d.size).toBe(0);
    expect(() => d[method]()).toThrow(RangeError);
  });

  it('treats one element as both ends', () => {
    const d = new Deque<string>();
    d.pushBack('x');
    expect(d.peekBack()).toBe('x');
    expect(d.peekFront()).toBe('x');
    expect(d.popFront()).toBe('x');
    expect(d.size).toBe(0);
    d.pushFront('y');
    expect(d.peekBack()).toBe('y');
    expect(d.popBack()).toBe('y');
    expect(d.size).toBe(0);
  });

  it('is first in, first out from opposite ends', () => {
    const d = new Deque<number>();
    for (let i = 0; i < 5; i++) d.pushBack(i);
    expect(Array.from({ length: 5 }, () => d.popFront())).toEqual([0, 1, 2, 3, 4]);
  });

  it('is last in, first out from the same end', () => {
    const d = new Deque<number>();
    for (let i = 0; i < 5; i++) d.pushBack(i);
    expect(Array.from({ length: 5 }, () => d.popBack())).toEqual([4, 3, 2, 1, 0]);
    for (let i = 0; i < 5; i++) d.pushFront(i);
    expect(Array.from({ length: 5 }, () => d.popFront())).toEqual([4, 3, 2, 1, 0]);
  });

  it('peeks without removing', () => {
    const d = new Deque<number>();
    d.pushBack(1);
    d.pushBack(2);
    expect(d.peekFront()).toBe(1);
    expect(d.peekBack()).toBe(2);
    expect(d.size).toBe(2);
    expect([...d]).toEqual([1, 2]);
  });

  it('stores undefined, null and falsy values', () => {
    const d = new Deque<number | string | null | undefined>();
    d.pushBack(undefined);
    d.pushBack(0);
    d.pushFront(null);
    d.pushFront('');
    expect(d.size).toBe(4);
    expect([...d]).toEqual(['', null, undefined, 0]);
    expect(d.popBack()).toBe(0);
    expect(d.popBack()).toBeUndefined();
    expect(d.popBack()).toBeNull();
    expect(d.popBack()).toBe('');
  });

  it('wraps around at the back without growing', () => {
    const d = new Deque<number>(4);
    for (let i = 0; i < 4; i++) d.pushBack(i);
    expect(d.popFront()).toBe(0);
    expect(d.popFront()).toBe(1);
    d.pushBack(4); // slot 0
    d.pushBack(5); // slot 1
    expect(d.capacity).toBe(4);
    expect([...d]).toEqual([2, 3, 4, 5]);
    expect(d.peekBack()).toBe(5);
    expect(d.peekFront()).toBe(2);
    expect(d.popBack()).toBe(5);
    expect(d.popBack()).toBe(4);
    expect(d.popBack()).toBe(3);
  });

  it('wraps around at the front without growing', () => {
    const d = new Deque<number>(4);
    d.pushFront(1); // slot 3
    d.pushFront(0); // slot 2
    d.pushBack(2); // slot 0
    expect(d.capacity).toBe(4);
    expect([...d]).toEqual([0, 1, 2]);
    expect(d.peekFront()).toBe(0);
    expect(d.popFront()).toBe(0);
    expect(d.popFront()).toBe(1);
    expect(d.popFront()).toBe(2);
  });

  it("follows the entry's worked example", () => {
    const d = new Deque<number>(4);
    for (const i of [1, 2, 3]) d.pushBack(i);
    expect(d.popFront()).toBe(1);
    expect(d.popFront()).toBe(2);
    d.pushBack(4);
    d.pushBack(5);
    d.pushFront(0);
    expect(d.capacity).toBe(4);
    expect([...d]).toEqual([0, 3, 4, 5]);
    d.pushBack(6);
    expect(d.capacity).toBe(8);
    expect([...d]).toEqual([0, 3, 4, 5, 6]);
  });

  it('grows while wrapped at the back', () => {
    const d = new Deque<number>(4);
    for (let i = 0; i < 4; i++) d.pushBack(i);
    d.popFront();
    d.popFront();
    d.pushBack(4);
    d.pushBack(5); // full, and the items wrap past the end
    d.pushBack(6);
    expect(d.capacity).toBe(8);
    expect([...d]).toEqual([2, 3, 4, 5, 6]);
    expect(Array.from({ length: 5 }, () => d.popFront())).toEqual([2, 3, 4, 5, 6]);
  });

  it('grows while wrapped from a push at the front', () => {
    const d = new Deque<number>(4);
    d.pushBack(2);
    d.pushBack(3);
    d.pushFront(1);
    d.pushFront(0); // full, head at slot 2
    d.pushFront(-1);
    expect(d.capacity).toBe(8);
    expect([...d]).toEqual([-1, 0, 1, 2, 3]);
    expect(Array.from({ length: 5 }, () => d.popBack())).toEqual([3, 2, 1, 0, -1]);
  });

  it('keeps every item in order across many growths', () => {
    const d = new Deque<number>(1);
    for (let i = 0; i < 100; i++) {
      if (i % 2) d.pushBack(i);
      else d.pushFront(i);
    }
    expect(d.size).toBe(100);
    expect(d.capacity).toBe(128);
    const evens = Array.from({ length: 50 }, (_, k) => 98 - 2 * k);
    const odds = Array.from({ length: 50 }, (_, k) => 2 * k + 1);
    expect([...d]).toEqual([...evens, ...odds]);
  });

  it('matches a plain array on random operations', () => {
    for (let seed = 0; seed < 50; seed++) {
      const random = rng(seed);
      const d = new Deque<number>(1 + Math.floor(random() * 4));
      const ref: number[] = [];
      for (let step = 0; step < 300; step++) {
        const at = `seed ${seed}, step ${step}`;
        const op = Math.floor(random() * 6);
        if (op === 0) {
          d.pushBack(step);
          ref.push(step);
        } else if (op === 1) {
          d.pushFront(step);
          ref.unshift(step);
        } else if (ref.length === 0) {
          expect(() => d[removers[op - 2]](), at).toThrow(RangeError);
        } else if (op === 2) {
          expect(d.popBack(), at).toBe(ref.pop());
        } else if (op === 3) {
          expect(d.popFront(), at).toBe(ref.shift());
        } else if (op === 4) {
          expect(d.peekBack(), at).toBe(ref[ref.length - 1]);
        } else {
          expect(d.peekFront(), at).toBe(ref[0]);
        }
        expect(d.size, at).toBe(ref.length);
        expect(d.capacity, at).toBeGreaterThanOrEqual(d.size);
      }
      expect([...d], `seed ${seed}`).toEqual(ref);
    }
  });
});

describe('recentCounts (TypeScript)', () => {
  it("follows the entry's worked example", () => {
    expect(recentCounts([1, 100, 3001, 3002], 3000)).toEqual([1, 2, 3, 3]);
  });

  it('handles the edge cases', () => {
    expect(recentCounts([], 10)).toEqual([]);
    expect(recentCounts([5], 10)).toEqual([1]);
    expect(recentCounts([5, 5, 5], 0)).toEqual([1, 2, 3]);
    expect(recentCounts([0, 10, 11], 10)).toEqual([1, 2, 2]);
  });

  it('matches a brute force count', () => {
    for (let seed = 0; seed < 50; seed++) {
      const random = rng(seed + 1000);
      const n = Math.floor(random() * 61);
      const times = Array.from({ length: n }, () => Math.floor(random() * 201)).sort(
        (a, b) => a - b,
      );
      const window = Math.floor(random() * 51);
      const expected = times.map(
        (t, i) => times.slice(0, i + 1).filter((s) => s >= t - window).length,
      );
      expect(
        recentCounts(times, window),
        `seed ${seed}: ${JSON.stringify({ times, window })}`,
      ).toEqual(expected);
    }
  });
});
