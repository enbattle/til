import { describe, expect, it } from 'vitest';
import { MinHeap, PriorityQueue, left, parent, right } from './heap';

// The heap entry's TypeScript code. API: `parent`, `left`, `right` (index
// arithmetic); `new MinHeap<T>(less, items = [])` with `push`, `pop`, `peek`
// (both throw a RangeError when empty) and `size`; `new PriorityQueue<V>()`
// with `push(item, priority)`, `pop`, `peek` and `size`, equal priorities
// coming out in insertion order.

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

/** Every item is no smaller than its parent. */
function expectHeap(h: MinHeap<number>, context = ''): void {
  const items = itemsOf(h);
  let bad = -1;
  for (let i = 1; i < items.length && bad < 0; i++) {
    if (items[i] < items[parent(i)]) bad = i;
  }
  expect(bad, `${context}index ${bad} of [${items}] is below its parent`).toBe(-1);
}

function drain<T>(h: { size: number; pop(): T }): T[] {
  const out: T[] = [];
  while (h.size > 0) out.push(h.pop());
  return out;
}

const sorted = (xs: number[]) => [...xs].sort((a, b) => a - b);

describe('index arithmetic', () => {
  it('finds children and parents', () => {
    expect([left(0), right(0), left(1), right(1), left(2), right(2)]).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
    for (let i = 1; i < 100; i++) {
      expect([left(parent(i)), right(parent(i))]).toContain(i);
      expect(parent(left(i))).toBe(i);
      expect(parent(right(i))).toBe(i);
    }
  });
});

describe('MinHeap (TypeScript)', () => {
  it('starts empty', () => {
    const h = numbers();
    expect(h.size).toBe(0);
    expect(drain(h)).toEqual([]);
  });

  it.each(['pop', 'peek'] as const)('%s throws on an empty heap', (method) => {
    expect(() => numbers()[method]()).toThrow(RangeError);
  });

  it.each(['pop', 'peek'] as const)('%s throws again after a drain', (method) => {
    const h = numbers([2, 1]);
    h.pop();
    h.pop();
    expect(() => h[method]()).toThrow(RangeError);
  });

  it('handles one element', () => {
    const h = numbers();
    h.push(7);
    expect(h.size).toBe(1);
    expect(h.peek()).toBe(7);
    expect(h.pop()).toBe(7);
    expect(h.size).toBe(0);
    const g = numbers([7]);
    expect(g.pop()).toBe(7);
    expect(g.size).toBe(0);
  });

  it('peeks without removing', () => {
    const h = numbers([5, 3, 8]);
    expect(h.peek()).toBe(3);
    expect(h.peek()).toBe(3);
    expect(h.size).toBe(3);
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
    const h = numbers([2, 2, 1, 2, 1, 1]);
    expectHeap(h);
    h.push(1);
    h.push(2);
    expect(drain(h)).toEqual([1, 1, 1, 1, 2, 2, 2, 2]);
    expect(drain(numbers(Array(10).fill(4)))).toEqual(Array(10).fill(4));
  });

  it('leaves already-sorted input as it is', () => {
    const ascending = Array.from({ length: 20 }, (_, i) => i);
    const h = numbers(ascending);
    expect(itemsOf(h)).toEqual(ascending);
    expect(drain(h)).toEqual(ascending);
  });

  it('heapifies reverse-sorted input', () => {
    const h = numbers(Array.from({ length: 20 }, (_, i) => 19 - i));
    expectHeap(h);
    expect(drain(h)).toEqual(Array.from({ length: 20 }, (_, i) => i));
  });

  it('does not change the input array', () => {
    const data = [3, 1, 2];
    numbers(data).pop();
    expect(data).toEqual([3, 1, 2]);
  });

  it("follows the entry's sift-down example", () => {
    const h = numbers([1, 3, 2, 7, 4, 5, 8]);
    expect(itemsOf(h)).toEqual([1, 3, 2, 7, 4, 5, 8]);
    expect(h.pop()).toBe(1);
    expect(itemsOf(h)).toEqual([2, 3, 5, 7, 4, 8]);
  });

  it("follows the entry's heapify example", () => {
    expect(itemsOf(numbers([5, 4, 3, 2, 1]))).toEqual([1, 2, 3, 5, 4]);
  });

  it.each([15, 1000, 4097])('heapifies %i items in under 3n comparisons', (n) => {
    let comparisons = 0;
    const counting = (a: number, b: number) => {
      comparisons++;
      return a < b;
    };
    const h = new MinHeap(
      counting,
      Array.from({ length: n }, (_, i) => n - i),
    );
    expect(comparisons).toBeLessThanOrEqual(3 * n);
    expect(drain(h)).toEqual(Array.from({ length: n }, (_, i) => i + 1));
  });

  it('takes more than 3n comparisons when pushing one at a time', () => {
    let comparisons = 0;
    const h = new MinHeap((a: number, b: number) => {
      comparisons++;
      return a < b;
    });
    for (let v = 1000; v > 0; v--) h.push(v);
    expect(comparisons).toBeGreaterThan(3000);
  });

  it('uses the comparison it is given (a max-heap)', () => {
    const h = new MinHeap((a: number, b: number) => a > b, [3, 9, 1, 7]);
    expect(drain(h)).toEqual([9, 7, 3, 1]);
  });

  it('matches a sorted array on 50 seeded random operation sequences', () => {
    for (let seed = 0; seed < 50; seed++) {
      const random = rng(seed);
      const int = () => Math.floor(random() * 21);
      const start = Array.from({ length: Math.floor(random() * 31) }, int);
      const h = numbers(start);
      let ref = sorted(start);
      for (let step = 0; step < 300; step++) {
        const at = `seed ${seed}, step ${step}: `;
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
      expect(drain(h), `seed ${seed}`).toEqual(ref);
    }
  });

  it('heapify then drain sorts, on 50 seeded random arrays', () => {
    for (let seed = 0; seed < 50; seed++) {
      const random = rng(seed + 1000);
      const data = Array.from(
        { length: Math.floor(random() * 201) },
        () => Math.floor(random() * 101) - 50,
      );
      const h = numbers(data);
      expectHeap(h, `seed ${seed}: `);
      expect(drain(h), `seed ${seed}, input [${data}]`).toEqual(sorted(data));
    }
  });
});

describe('PriorityQueue (TypeScript)', () => {
  it('pops the lowest priority first', () => {
    const pq = new PriorityQueue<string>();
    pq.push('write', 3);
    pq.push('fix', 1);
    pq.push('test', 2);
    expect(pq.size).toBe(3);
    expect(pq.peek()).toBe('fix');
    expect(drain(pq)).toEqual(['fix', 'test', 'write']);
    expect(pq.size).toBe(0);
  });

  it('pops equal priorities in insertion order', () => {
    const pq = new PriorityQueue<string>();
    for (const name of 'abcdefgh') pq.push(name, 5);
    pq.push('first', 1);
    expect(drain(pq)).toEqual(['first', ...'abcdefgh']);
  });

  it.each(['pop', 'peek'] as const)('%s throws when empty', (method) => {
    expect(() => new PriorityQueue<number>()[method]()).toThrow(RangeError);
  });

  it('stores undefined and null', () => {
    const pq = new PriorityQueue<string | null | undefined>();
    pq.push(undefined, 2);
    pq.push(null, 1);
    expect(pq.peek()).toBeNull();
    expect(pq.pop()).toBeNull();
    expect(pq.pop()).toBeUndefined();
  });

  it('matches a stable sort on 50 seeded random operation sequences', () => {
    for (let seed = 0; seed < 50; seed++) {
      const random = rng(seed + 2000);
      const pq = new PriorityQueue<number>();
      const ref: { priority: number; step: number }[] = [];
      for (let step = 0; step < 200; step++) {
        const at = `seed ${seed}, step ${step}`;
        if (random() < 0.6 || ref.length === 0) {
          const priority = Math.floor(random() * 6);
          pq.push(step, priority);
          ref.push({ priority, step });
        } else {
          ref.sort((a, b) => a.priority - b.priority); // stable since ES2019
          expect(pq.pop(), at).toBe(ref.shift()?.step);
        }
        expect(pq.size, at).toBe(ref.length);
      }
    }
  });
});
