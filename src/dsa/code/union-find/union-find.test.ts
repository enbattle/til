import { describe, expect, it } from 'vitest';
import { UnionFind, hasCycle } from './union-find';

// The union-find entry's TypeScript code. API: `new UnionFind(n)` over the
// elements 0..n-1, with `find` (the set's root), `union` (returns whether two
// separate sets were joined), `connected`, `sizeOf` and a `count` property (the
// number of sets); plus `hasCycle(n, edges)`.

/** A small seeded generator (mulberry32), so a failing sequence can be replayed. */
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

/** The private parent array, read for the tests that check the forest's shape. */
function parentOf(sets: UnionFind): Int32Array {
  return (sets as unknown as { parent: Int32Array }).parent;
}

/** Steps from x up to its root, read without compressing anything. */
function depth(sets: UnionFind, x: number): number {
  const parent = parentOf(sets);
  let steps = 0;
  while (parent[x] !== x) {
    x = parent[x];
    steps++;
  }
  return steps;
}

const maxDepth = (sets: UnionFind, n: number) =>
  Math.max(...Array.from({ length: n }, (_, x) => depth(sets, x)));

/** n a power of two: unions that build the deepest tree union by size allows. */
function binomial(n: number): UnionFind {
  const sets = new UnionFind(n);
  for (let step = 1; step < n; step *= 2) {
    for (let i = 0; i < n; i += 2 * step) sets.union(i, i + step);
  }
  return sets;
}

/** The slow answer: every element carries a label, a union relabels a set. */
function bruteLabels(n: number, pairs: [number, number][]): number[] {
  let label = Array.from({ length: n }, (_, i) => i);
  for (const [a, b] of pairs) {
    const [from, to] = [label[b], label[a]];
    label = label.map((x) => (x === from ? to : x));
  }
  return label;
}

const randomPairs = (rand: () => number, n: number, count: number) =>
  Array.from({ length: count }, (): [number, number] => [
    Math.floor(rand() * n),
    Math.floor(rand() * n),
  ]);

describe('UnionFind', () => {
  it('handles zero elements', () => {
    const sets = new UnionFind(0);
    expect(sets.count).toBe(0);
    expect(() => sets.find(0)).toThrow(RangeError);
    expect(hasCycle(0, [])).toBe(false);
  });

  it('handles one element', () => {
    const sets = new UnionFind(1);
    expect([sets.count, sets.find(0), sets.sizeOf(0)]).toEqual([1, 0, 1]);
    expect(sets.connected(0, 0)).toBe(true);
    expect(sets.union(0, 0)).toBe(false);
    expect([sets.count, sets.sizeOf(0)]).toEqual([1, 1]);
  });

  it.each([-1, 4, 100, 1.5, NaN])('throws on the out-of-range element %s', (x) => {
    const sets = new UnionFind(4);
    expect(() => sets.find(x)).toThrow(RangeError);
    expect(() => sets.connected(0, x)).toThrow(RangeError);
    expect(() => sets.union(x, 0)).toThrow(RangeError);
  });

  it('follows the entry running example', () => {
    const sets = new UnionFind(6);
    for (const [a, b] of [
      [0, 1],
      [2, 3],
      [4, 5],
      [2, 4],
    ]) {
      expect(sets.union(a, b)).toBe(true);
    }
    expect(Array.from(parentOf(sets))).toEqual([0, 0, 2, 2, 2, 4]);
    expect(sets.count).toBe(2);
    expect(sets.union(1, 5)).toBe(true);
    expect(Array.from(parentOf(sets))).toEqual([2, 0, 2, 2, 2, 2]);
    expect(sets.find(1)).toBe(2);
    expect(Array.from(parentOf(sets))).toEqual([2, 2, 2, 2, 2, 2]);
    expect([sets.count, sets.sizeOf(0)]).toEqual([1, 6]);
  });

  it('leaves everything alone when a union repeats', () => {
    const sets = new UnionFind(4);
    expect(sets.union(0, 1)).toBe(true);
    expect(sets.union(1, 0)).toBe(false);
    expect(sets.union(0, 1)).toBe(false);
    expect([sets.count, sets.sizeOf(0), sets.sizeOf(2)]).toEqual([3, 2, 1]);
  });

  it('joins whole sets, not the two elements', () => {
    const sets = new UnionFind(6);
    sets.union(0, 1);
    sets.union(1, 2);
    sets.union(3, 4);
    sets.union(2, 4); // joined through members, neither of them a root
    for (let x = 0; x < 5; x++) expect(sets.connected(0, x)).toBe(true);
    expect(sets.connected(0, 5)).toBe(false);
    expect(sets.sizeOf(3)).toBe(5);
  });

  it('keeps depth logarithmic with union by size', () => {
    // Naive linking (first root under second) makes this a chain n - 1 deep.
    const n = 1024;
    const sets = new UnionFind(n);
    const reverse = new UnionFind(n); // the same chain with the big side second
    for (let i = 0; i < n - 1; i++) {
      sets.union(i, i + 1);
      reverse.union(i + 1, i);
    }
    for (const chain of [sets, reverse]) {
      expect(maxDepth(chain, n)).toBeLessThanOrEqual(Math.log2(n));
    }
    expect(maxDepth(binomial(n), n)).toBe(10);
  });

  it('rewrites one pointer on a union, not a whole set', () => {
    // Two stars of 100: relabeling one of them would change 100 entries.
    const sets = new UnionFind(200);
    for (let i = 1; i < 100; i++) {
      sets.union(0, i);
      sets.union(100, 100 + i);
    }
    const before = Array.from(parentOf(sets));
    sets.union(37, 163);
    const changed = before.flatMap((p, i) => (parentOf(sets)[i] !== p ? [i] : []));
    expect(changed).toEqual([100]);
    expect(maxDepth(sets, 200)).toBeLessThanOrEqual(2);
  });

  it('compresses the whole path on find', () => {
    const sets = binomial(16);
    expect(depth(sets, 15)).toBe(4);
    expect(sets.find(15)).toBe(0);
    expect([15, 14, 12, 8].map((x) => parentOf(sets)[x])).toEqual([0, 0, 0, 0]);
    expect(depth(sets, 15)).toBe(1);
  });

  it('gives the same answers after compression', () => {
    const sets = binomial(64);
    expect(Array.from({ length: 64 }, (_, x) => sets.find(x))).toEqual(Array(64).fill(0));
    expect([sets.count, sets.sizeOf(33)]).toEqual([1, 64]);
  });

  it('matches a relabeling brute force on seeded random unions', () => {
    const rand = seeded(2024);
    for (let trial = 0; trial < 50; trial++) {
      const n = 1 + Math.floor(rand() * 30);
      const pairs = randomPairs(rand, n, Math.floor(rand() * 41));
      const sets = new UnionFind(n);
      pairs.forEach(([a, b], step) => {
        const label = bruteLabels(n, pairs.slice(0, step));
        const msg = `seed 2024, trial ${trial}, step ${step}, union(${a}, ${b})`;
        expect(sets.union(a, b), msg).toBe(label[a] !== label[b]);
      });
      const label = bruteLabels(n, pairs);
      const msg = `seed 2024, trial ${trial}, n=${n}, pairs=${JSON.stringify(pairs)}`;
      expect(sets.count, msg).toBe(new Set(label).size);
      for (let x = 0; x < n; x++) {
        expect(sets.sizeOf(x), msg).toBe(label.filter((l) => l === label[x]).length);
        for (let y = 0; y < n; y++) {
          expect(sets.connected(x, y), msg).toBe(label[x] === label[y]);
        }
      }
    }
  });
});

describe('hasCycle', () => {
  it('handles the fixed cases', () => {
    expect(
      hasCycle(4, [
        [0, 1],
        [1, 2],
        [2, 0],
      ]),
    ).toBe(true);
    expect(
      hasCycle(4, [
        [0, 1],
        [1, 2],
        [2, 3],
      ]),
    ).toBe(false);
    expect(
      hasCycle(2, [
        [0, 1],
        [1, 0],
      ]),
    ).toBe(true); // the same edge twice
    expect(hasCycle(1, [[0, 0]])).toBe(true); // a self-loop
    expect(hasCycle(5, [])).toBe(false);
  });

  it('matches the edges == n - components rule on seeded random graphs', () => {
    const rand = seeded(7);
    for (let trial = 0; trial < 50; trial++) {
      const n = 1 + Math.floor(rand() * 12);
      const edges = randomPairs(rand, n, Math.floor(rand() * 15));
      const components = new Set(bruteLabels(n, edges)).size;
      const msg = `seed 7, trial ${trial}, n=${n}, edges=${JSON.stringify(edges)}`;
      expect(hasCycle(n, edges), msg).toBe(edges.length > n - components);
    }
  });
});
