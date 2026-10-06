import { describe, expect, it } from 'vitest';
import { MinHeap } from './heap';

// The heap entry's TypeScript code. API: `new MinHeap<T>(less, items = [])` with
// `push`, `pop`, `peek` (both throw a RangeError when empty) and `size`.

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

const lessNumber = (a: number, b: number) => a < b;
const numbers = (items: Iterable<number> = []) => new MinHeap(lessNumber, items);
const itemsOf = <T>(h: MinHeap<T>) => (h as unknown as { items: T[] }).items;
const sorted = (xs: number[]) => [...xs].sort((a, b) => a - b);
const range = (from: number, to: number) =>
  Array.from(
    { length: Math.abs(to - from) + 1 },
    (_, i) => from + i * Math.sign(to - from),
  );

/** A comparison that counts how often it is called. */
function counting() {
  const c = { n: 0, less: (a: number, b: number) => (c.n++, a < b) };
  return c;
}

/** Every item is no smaller than its parent. */
function expectHeap(h: MinHeap<number>, context = ''): void {
  const items = itemsOf(h);
  let bad = -1;
  for (let i = 1; i < items.length && bad < 0; i++) {
    if (items[i] < items[(i - 1) >> 1]) bad = i;
  }
  expect(bad, `${context}index ${bad} of [${items}] is below its parent`).toBe(-1);
}

function drain<T>(h: MinHeap<T>): T[] {
  const out: T[] = [];
  while (h.size > 0) out.push(h.pop());
  return out;
}

describe('MinHeap', () => {
  it('starts empty', () => {
    const h = numbers();
    expect(h.size).toBe(0);
    expect(drain(h)).toEqual([]);
  });

  it.each(['pop', 'peek'] as const)('%s throws on an empty heap', (method) => {
    expect(() => numbers()[method]()).toThrow(RangeError);
    const h = numbers([2, 1]);
    drain(h);
    expect(() => h[method]()).toThrow(RangeError);
  });

  it('handles one item', () => {
    const h = numbers();
    h.push(7);
    expect([h.size, h.peek(), h.pop(), h.size]).toEqual([1, 7, 7, 0]);
    const g = numbers([7]);
    expect([g.pop(), g.size]).toEqual([7, 0]);
  });

  it('peeks without removing', () => {
    const h = numbers([5, 3, 8]);
    expect([h.peek(), h.peek(), h.size]).toEqual([3, 3, 3]);
  });

  it('keeps the smallest on top as items are pushed', () => {
    const h = numbers();
    for (const [x, smallest] of [
      [5, 5],
      [8, 5],
      [3, 3],
      [4, 3],
      [1, 1],
      [9, 1],
    ]) {
      h.push(x);
      expect(h.peek()).toBe(smallest);
      expectHeap(h);
    }
  });

  it('handles duplicates', () => {
    const h = numbers([1000, 2, 2, 1, 1000, 1]);
    expectHeap(h);
    h.push(1000);
    h.push(2);
    expect(drain(h)).toEqual([1, 1, 2, 2, 2, 1000, 1000, 1000]);
    expect(drain(numbers(Array(10).fill(4)))).toEqual(Array(10).fill(4));
  });

  it('handles sorted and reverse-sorted input', () => {
    expect(itemsOf(numbers(range(0, 19)))).toEqual(range(0, 19));
    const h = numbers(range(19, 0));
    expectHeap(h);
    expect(drain(h)).toEqual(range(0, 19));
  });

  it('does not change the input array', () => {
    const data = [3, 1, 2];
    numbers(data).pop();
    expect(data).toEqual([3, 1, 2]);
  });

  it("follows the entry's running example", () => {
    const h = numbers([7, 6, 5, 4, 3, 2, 1]);
    expect(itemsOf(h)).toEqual([1, 3, 2, 4, 6, 7, 5]);
    expect(h.pop()).toBe(1);
    expect(itemsOf(h)).toEqual([2, 3, 5, 4, 6, 7]);
    h.push(1);
    expect(itemsOf(h)).toEqual([1, 3, 2, 4, 6, 7, 5]);
  });

  it('pops from a pair and a triple', () => {
    expect(itemsOf(numbers([2, 1]))).toEqual([1, 2]);
    const h = numbers([1, 2, 3]);
    expect([h.pop(), itemsOf(h)]).toEqual([1, [2, 3]]);
  });

  it('uses the comparison it is given (a max-heap)', () => {
    const h = new MinHeap((a: number, b: number) => a > b, [3, 9, 1, 7]);
    expect(drain(h)).toEqual([9, 7, 3, 1]);
  });

  it('breaks priority ties with a counter', () => {
    type Entry = { priority: number; order: number };
    const h = new MinHeap<Entry>(
      (a, b) =>
        a.priority < b.priority || (a.priority === b.priority && a.order < b.order),
    );
    for (let order = 0; order < 8; order++) h.push({ priority: 0, order });
    expect(drain(h).map((e) => e.order)).toEqual(range(0, 7));
  });

  it.each([7, 1000, 4097])('heapifies %i reversed items in under 2n comparisons', (n) => {
    // Pushing one at a time takes about n log2(n); sorting first leaves a
    // different layout, which the running-example test would catch.
    const c = counting();
    const h = new MinHeap(c.less, range(n, 1));
    expect(c.n).toBeLessThan(2 * n);
    expectHeap(h);
    expect(drain(new MinHeap(lessNumber, itemsOf(h)))).toEqual(range(1, n));
  });

  it('takes more than 2n comparisons when pushing one at a time', () => {
    const c = counting();
    const h = new MinHeap(c.less);
    for (let v = 1000; v > 0; v--) h.push(v);
    expect(c.n).toBeGreaterThan(2000);
  });

  it('touches one path per push and per pop', () => {
    // 1,023 items are 10 levels deep. A push compares once per level it climbs
    // (10 at most), a pop twice per level it falls. A scan would take about 1,000.
    const c = counting();
    const h = new MinHeap(c.less, range(1, 1023));
    c.n = 0;
    h.push(0);
    expect(c.n).toBeLessThanOrEqual(10);
    expect(itemsOf(h).length).toBe(1024);
    c.n = 0;
    expect(h.pop()).toBe(0);
    expect(c.n).toBeLessThanOrEqual(20);
    expect(itemsOf(h).length).toBe(1023);
  });

  it('matches a sorted array on 50 seeded random operation sequences', () => {
    const seed = 1;
    const random = rng(seed);
    const int = () => Math.floor(random() * 21);
    for (let trial = 0; trial < 50; trial++) {
      const start = Array.from({ length: Math.floor(random() * 31) }, int);
      const h = numbers(start);
      let ref = sorted(start);
      for (let step = 0; step < 100; step++) {
        const at = `seed ${seed}, trial ${trial}, step ${step}: `;
        const op = Math.floor(random() * 4);
        if (op <= 1) {
          const x = int();
          h.push(x);
          ref = sorted([...ref, x]);
        } else if (ref.length === 0) {
          expect(() => (op === 2 ? h.pop() : h.peek()), at).toThrow(RangeError);
        } else if (op === 2) {
          expect(h.pop(), at).toBe(ref.shift());
        } else {
          expect(h.peek(), at).toBe(ref[0]);
        }
        expect(h.size, at).toBe(ref.length);
        expectHeap(h, at);
      }
      expect(drain(h), `seed ${seed}, trial ${trial}`).toEqual(ref);
    }
  });

  it('heapify then drain sorts, on 50 seeded random arrays', () => {
    const seed = 2;
    const random = rng(seed);
    for (let trial = 0; trial < 50; trial++) {
      const data = Array.from(
        { length: Math.floor(random() * 201) },
        () => Math.floor(random() * 101) - 50,
      );
      const h = numbers(data);
      expectHeap(h, `seed ${seed}, trial ${trial}: `);
      expect(drain(h), `seed ${seed}, trial ${trial}: [${data}]`).toEqual(sorted(data));
    }
  });
});
