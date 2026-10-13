import { describe, expect, it } from 'vitest';
import { MinHeap } from './heap';

// The heap entry's TypeScript code. API: `new MinHeap(items = [])` with `push`,
// `pop`, `peek` (both throw a RangeError when empty) and `size()`. Items are
// arrays of numbers, compared like Python tuples; a plain number is `[5]`.

/** A small seeded generator (mulberry32), so a failing case can be replayed. */
function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const wrap = (xs: number[]) => xs.map((x) => [x]);
const numbers = (xs: number[] = []) => new MinHeap(wrap(xs));
const itemsOf = (h: MinHeap) => (h as unknown as { items: number[][] }).items;
const layout = (h: MinHeap) => itemsOf(h).map((item) => item[0]);
const sorted = (xs: number[]) => xs.slice().sort((a, b) => a - b);
const range = (from: number, to: number) => {
  const out: number[] = [];
  const step = from <= to ? 1 : -1;
  for (let x = from; x !== to + step; x += step) out.push(x);
  return out;
};

/** Pops everything: the first number of each item, smallest first. */
function drain(h: MinHeap): number[] {
  const out: number[] = [];
  while (h.size() > 0) out.push(h.pop()[0]);
  return out;
}

/** The getter counts each time lessThan reads an item's first number (two per comparison). */
let reads = 0;
function counted(value: number): number[] {
  const item: number[] = [];
  Object.defineProperty(item, 0, {
    get() {
      reads++;
      return value;
    },
  });
  return item;
}
const comparisons = () => reads / 2;

/** Every item is no smaller than its parent. */
function expectHeap(h: MinHeap, context = ''): void {
  const items = layout(h);
  let bad = -1;
  for (let i = 1; i < items.length && bad < 0; i++) {
    if (items[i] < items[Math.floor((i - 1) / 2)]) bad = i;
  }
  expect(bad, `${context}index ${bad} of [${items}] is below its parent`).toBe(-1);
}

describe('MinHeap', () => {
  it('starts empty', () => {
    const h = numbers();
    expect(h.size()).toBe(0);
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
    h.push([7]);
    expect([h.size(), h.peek(), h.pop(), h.size()]).toEqual([1, [7], [7], 0]);
    const g = numbers([7]);
    expect([g.pop(), g.size()]).toEqual([[7], 0]);
  });

  it('peeks without removing', () => {
    const h = numbers([5, 3, 8]);
    expect([h.peek(), h.peek(), h.size()]).toEqual([[3], [3], 3]);
  });

  it('keeps the smallest on top as items are pushed', () => {
    const h = numbers();
    const pushes = [5, 8, 3, 4, 1, 9];
    const smallest = [5, 5, 3, 3, 1, 1];
    for (let i = 0; i < pushes.length; i++) {
      h.push([pushes[i]]);
      expect(h.peek()).toEqual([smallest[i]]);
      expectHeap(h);
    }
  });

  it('handles duplicates', () => {
    const h = numbers([1000, 2, 2, 1, 1000, 1]);
    expectHeap(h);
    h.push([1000]);
    h.push([2]);
    expect(drain(h)).toEqual([1, 1, 2, 2, 2, 1000, 1000, 1000]);
    expect(drain(numbers([4, 4, 4, 4, 4, 4, 4, 4, 4, 4]))).toEqual([
      4, 4, 4, 4, 4, 4, 4, 4, 4, 4,
    ]);
  });

  it('handles sorted and reverse-sorted input', () => {
    expect(layout(numbers(range(0, 19)))).toEqual(range(0, 19));
    const h = numbers(range(19, 0));
    expectHeap(h);
    expect(drain(h)).toEqual(range(0, 19));
  });

  it('does not change the input array', () => {
    const data = wrap([3, 1, 2]);
    new MinHeap(data).pop();
    expect(data).toEqual([[3], [1], [2]]);
  });

  it('breaks ties on the next number, like a tuple', () => {
    const h = new MinHeap([
      [2, 20],
      [1, 90],
      [2, 10],
    ]);
    expect([h.pop(), h.pop(), h.pop()]).toEqual([
      [1, 90],
      [2, 10],
      [2, 20],
    ]);
  });

  it('puts a shorter array before a longer one it matches', () => {
    const h = new MinHeap([[1, 2], [1]]);
    expect([h.pop(), h.pop()]).toEqual([[1], [1, 2]]);
    const g = new MinHeap([[1]]);
    g.push([1, 2]);
    g.push([0, 5, 5]);
    expect([g.pop(), g.pop(), g.pop()]).toEqual([[0, 5, 5], [1], [1, 2]]);
  });

  it("follows the entry's running example", () => {
    const h = numbers([7, 6, 5, 4, 3, 2, 1]);
    expect(layout(h)).toEqual([1, 3, 2, 4, 6, 7, 5]);
    expect(h.pop()).toEqual([1]);
    expect(layout(h)).toEqual([2, 3, 5, 4, 6, 7]);
    h.push([1]);
    expect(layout(h)).toEqual([1, 3, 2, 4, 6, 7, 5]);
  });

  it('pops from a pair and a triple', () => {
    expect(layout(numbers([2, 1]))).toEqual([1, 2]);
    const h = numbers([1, 2, 3]);
    expect([h.pop(), layout(h)]).toEqual([[1], [2, 3]]);
  });

  it('breaks priority ties with a counter', () => {
    const h = new MinHeap([]);
    for (let order = 0; order < 8; order++) h.push([0, order]);
    const orders: number[] = [];
    while (h.size() > 0) orders.push(h.pop()[1]);
    expect(orders).toEqual(range(0, 7));
  });

  it('touches one path per push and per pop', () => {
    // 1,023 items are 10 levels deep. A push compares once per level it climbs
    // (10 at most), a pop twice per level it falls. A scan would take about 1,000.
    const h = new MinHeap(range(1, 1023).map(counted));
    reads = 0;
    h.push(counted(0));
    expect(comparisons()).toBeLessThanOrEqual(10);
    expect(itemsOf(h).length).toBe(1024);
    reads = 0;
    expect(h.pop()[0]).toBe(0);
    expect(comparisons()).toBeLessThanOrEqual(20);
    expect(itemsOf(h).length).toBe(1023);
  });

  it('matches a sorted array on 50 seeded random operation sequences', () => {
    const seed = 1;
    const random = rng(seed);
    const int = () => Math.floor(random() * 21);
    for (let trial = 0; trial < 50; trial++) {
      const start: number[] = [];
      const startLength = Math.floor(random() * 31);
      for (let i = 0; i < startLength; i++) start.push(int());
      const h = numbers(start);
      let ref = sorted(start);
      for (let step = 0; step < 100; step++) {
        const at = `seed ${seed}, trial ${trial}, step ${step}: `;
        const op = Math.floor(random() * 4);
        if (op <= 1) {
          const x = int();
          h.push([x]);
          ref = sorted(ref.concat([x]));
        } else if (ref.length === 0) {
          expect(() => (op === 2 ? h.pop() : h.peek()), at).toThrow(RangeError);
        } else if (op === 2) {
          expect(h.pop(), at).toEqual([ref.shift()]);
        } else {
          expect(h.peek(), at).toEqual([ref[0]]);
        }
        expect(h.size(), at).toBe(ref.length);
        expectHeap(h, at);
      }
      expect(drain(h), `seed ${seed}, trial ${trial}`).toEqual(ref);
    }
  });

  it('heapify then drain sorts, on 50 seeded random arrays', () => {
    const seed = 2;
    const random = rng(seed);
    for (let trial = 0; trial < 50; trial++) {
      const data: number[] = [];
      const length = Math.floor(random() * 201);
      for (let i = 0; i < length; i++) data.push(Math.floor(random() * 101) - 50);
      const h = numbers(data);
      expectHeap(h, `seed ${seed}, trial ${trial}: `);
      expect(drain(h), `seed ${seed}, trial ${trial}: [${data}]`).toEqual(sorted(data));
    }
  });
});
