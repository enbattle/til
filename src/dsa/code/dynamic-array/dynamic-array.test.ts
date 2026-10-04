import { describe, expect, it } from 'vitest';
import { DynamicArray } from './dynamic-array';

// The array entry's TypeScript code, compared against JavaScript's own array.
// API: `new DynamicArray<T>(capacity = 4)` with `length`, `capacity`,
// `get`, `set`, iteration, `push`, `insert(i, v)` (0 <= i <= length),
// `removeAt(i)` and `pop()` (undefined when empty, like Array.prototype.pop).

/** A small seeded random number generator (mulberry32), returning [0, 1). */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function storage<T>(a: DynamicArray<T>): (T | undefined)[] {
  return (a as unknown as { data: (T | undefined)[] }).data;
}

function filled<T>(values: T[], capacity = 4): DynamicArray<T> {
  const a = new DynamicArray<T>(capacity);
  for (const v of values) a.push(v);
  return a;
}

describe('DynamicArray (TypeScript)', () => {
  it('starts empty with the capacity it was given', () => {
    const a = new DynamicArray<number>(4);
    expect(a.length).toBe(0);
    expect(a.capacity).toBe(4);
    expect([...a]).toEqual([]);
  });

  it('defaults to a positive capacity', () => {
    expect(new DynamicArray<number>().capacity).toBeGreaterThan(0);
  });

  it.each([0, -1, 1.5, Number.NaN])('rejects a capacity of %s', (capacity) => {
    expect(() => new DynamicArray<number>(capacity)).toThrow(RangeError);
  });

  it('has no valid index when empty', () => {
    const a = new DynamicArray<string>();
    for (const i of [0, -1, 1]) {
      expect(() => a.get(i)).toThrow(RangeError);
      expect(() => a.set(i, 'x')).toThrow(RangeError);
      expect(() => a.removeAt(i)).toThrow(RangeError);
    }
    expect(a.pop()).toBeUndefined();
    expect(a.length).toBe(0);
  });

  it('holds a single element', () => {
    const a = filled(['only'], 1);
    expect(a.length).toBe(1);
    expect(a.get(0)).toBe('only');
    expect(() => a.get(1)).toThrow(RangeError);
    expect(a.pop()).toBe('only');
    expect(a.length).toBe(0);
    expect(a.capacity).toBe(1);
  });

  it('gets and sets by index, rejecting negative and fractional ones', () => {
    const a = filled([10, 20, 30]);
    expect([a.get(0), a.get(1), a.get(2)]).toEqual([10, 20, 30]);
    a.set(1, 25);
    expect([...a]).toEqual([10, 25, 30]);
    for (const i of [3, -1, 0.5]) expect(() => a.get(i)).toThrow(RangeError);
  });

  it('stores undefined, null and duplicates', () => {
    const a = filled<number | null | undefined>([undefined, 7, 7, null, 7], 2);
    expect(a.length).toBe(5);
    expect([...a]).toEqual([undefined, 7, 7, null, 7]);
    expect(a.removeAt(0)).toBeUndefined();
    expect([...a]).toEqual([7, 7, null, 7]);
  });

  it('doubles the capacity only when full', () => {
    const a = new DynamicArray<number>(1);
    const capacities: number[] = [];
    for (let i = 0; i < 17; i++) {
      a.push(i);
      capacities.push(a.capacity);
    }
    expect(capacities).toEqual([1, 2, 4, 4, 8, 8, 8, 8, ...Array(8).fill(16), 32]);
    expect([...a]).toEqual(Array.from({ length: 17 }, (_, i) => i));
  });

  it('inserts at the front, the middle and the end', () => {
    const a = new DynamicArray<string>(1);
    a.insert(0, 'b');
    a.insert(0, 'a');
    a.insert(2, 'd');
    a.insert(2, 'c');
    expect([...a]).toEqual(['a', 'b', 'c', 'd']);
    expect(a.capacity).toBe(4);
    a.insert(4, 'e');
    expect([...a]).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(a.capacity).toBe(8);
  });

  it.each([-1, 4, 100, 1.5])('rejects inserting at index %s', (index) => {
    const a = filled(['a', 'b', 'c']);
    expect(() => a.insert(index, 'z')).toThrow(RangeError);
    expect([...a]).toEqual(['a', 'b', 'c']);
  });

  it('removes from the front, the middle and the end', () => {
    const a = filled(['a', 'b', 'c', 'd', 'e']);
    expect(a.pop()).toBe('e');
    expect(a.removeAt(0)).toBe('a');
    expect(a.removeAt(1)).toBe('c');
    expect(a.removeAt(1)).toBe('d');
    expect([...a]).toEqual(['b']);
    expect(() => a.removeAt(1)).toThrow(RangeError);
  });

  it('shrinks to half when a quarter full', () => {
    const a = filled(
      Array.from({ length: 16 }, (_, i) => i),
      1,
    );
    expect(a.capacity).toBe(16);
    const seen: [number, number][] = [];
    while (a.length > 0) {
      a.pop();
      seen.push([a.length, a.capacity]);
    }
    expect(seen).toEqual([
      ...Array.from({ length: 11 }, (_, i): [number, number] => [15 - i, 16]),
      [4, 8],
      [3, 8],
      [2, 4],
      [1, 2],
      [0, 1],
    ]);
  });

  it('does not resize on every push and pop at the boundary', () => {
    const a = filled([0, 1, 2, 3, 4], 4);
    expect(a.capacity).toBe(8);
    for (let i = 0; i < 50; i++) {
      a.pop();
      expect(a.capacity).toBe(8);
      a.push(9);
      expect(a.capacity).toBe(8);
    }
  });

  it('clears the slots it no longer uses', () => {
    const a = filled([{}, {}, {}, {}, {}, {}], 8);
    a.pop();
    a.removeAt(0);
    a.removeAt(2);
    expect(storage(a).slice(a.length)).toEqual(
      Array(a.capacity - a.length).fill(undefined),
    );
  });

  it('matches a built-in array on 50 seeded random operation sequences', () => {
    for (let seed = 0; seed < 50; seed++) {
      const rand = seeded(seed);
      const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
      const a = new DynamicArray<number>(int(1, 4));
      const ref: number[] = [];
      for (let step = 0; step < 300; step++) {
        const at = `seed ${seed}, step ${step}`;
        const op = rand();
        if (op < 0.35) {
          const x = int(0, 9);
          a.push(x);
          ref.push(x);
        } else if (op < 0.5) {
          const i = int(0, ref.length);
          const x = int(0, 9);
          a.insert(i, x);
          ref.splice(i, 0, x);
        } else if (op < 0.65) {
          expect(a.pop(), at).toBe(ref.pop());
        } else if (op < 0.8 && ref.length > 0) {
          const i = int(0, ref.length - 1);
          expect(a.removeAt(i), at).toBe(ref.splice(i, 1)[0]);
        } else if (ref.length > 0) {
          const i = int(0, ref.length - 1);
          expect(a.get(i), at).toBe(ref[i]);
          const x = int(0, 9);
          a.set(i, x);
          ref[i] = x;
        }
        expect(a.length, at).toBe(ref.length);
        expect([...a], at).toEqual(ref);
        expect(a.length, at).toBeLessThanOrEqual(a.capacity);
        const unused = storage(a).slice(a.length);
        expect(
          unused.every((v) => v === undefined),
          at,
        ).toBe(true);
      }
    }
  });
});
