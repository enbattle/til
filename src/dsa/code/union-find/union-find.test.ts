import { describe, expect, it } from 'vitest';
import { UnionFind, countComponents, hasCycle } from './union-find';

// The union-find entry's TypeScript code. API: `new UnionFind(n)` over the
// elements 0..n-1, with `find` (the set's root), `union` (returns whether two
// separate sets were joined), `connected`, `sizeOf` and a `count` getter (the
// number of sets); plus `countComponents(n, edges)` and `hasCycle(n, edges)`.

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

function componentsBySearch(n: number, edges: [number, number][]): number {
  const neighbours: number[][] = Array.from({ length: n }, () => []);
  for (const [a, b] of edges) {
    neighbours[a].push(b);
    neighbours[b].push(a);
  }
  const seen = new Array<boolean>(n).fill(false);
  let found = 0;
  for (let start = 0; start < n; start++) {
    if (seen[start]) continue;
    found++;
    seen[start] = true;
    const stack = [start];
    while (stack.length > 0) {
      for (const next of neighbours[stack.pop()!]) {
        if (!seen[next]) {
          seen[next] = true;
          stack.push(next);
        }
      }
    }
  }
  return found;
}

describe('UnionFind (TypeScript)', () => {
  it('handles zero elements', () => {
    const sets = new UnionFind(0);
    expect(sets.count).toBe(0);
    expect(() => sets.find(0)).toThrow(RangeError);
  });

  it('rejects a negative or fractional n', () => {
    expect(() => new UnionFind(-1)).toThrow(RangeError);
    expect(() => new UnionFind(2.5)).toThrow(RangeError);
  });

  it('handles one element', () => {
    const sets = new UnionFind(1);
    expect(sets.count).toBe(1);
    expect(sets.find(0)).toBe(0);
    expect(sets.sizeOf(0)).toBe(1);
    expect(sets.connected(0, 0)).toBe(true);
  });

  it('starts with every element in its own set', () => {
    const sets = new UnionFind(5);
    expect(sets.count).toBe(5);
    for (let x = 0; x < 5; x++) {
      expect(sets.find(x)).toBe(x);
      expect(sets.sizeOf(x)).toBe(1);
    }
    expect(sets.connected(0, 1)).toBe(false);
  });

  it('changes nothing on a union of an element with itself', () => {
    const sets = new UnionFind(3);
    expect(sets.union(1, 1)).toBe(false);
    expect(sets.count).toBe(3);
    expect(sets.sizeOf(1)).toBe(1);
  });

  it('joins two sets once', () => {
    const sets = new UnionFind(4);
    expect(sets.union(0, 1)).toBe(true);
    expect(sets.connected(0, 1)).toBe(true);
    expect(sets.count).toBe(3);
    expect(sets.sizeOf(0)).toBe(2);
    expect(sets.sizeOf(1)).toBe(2);
    expect(sets.union(1, 0)).toBe(false);
    expect(sets.union(0, 1)).toBe(false);
    expect(sets.count).toBe(3);
    expect(sets.sizeOf(0)).toBe(2);
  });

  it('is transitive', () => {
    const sets = new UnionFind(6);
    sets.union(0, 1);
    sets.union(2, 3);
    expect(sets.connected(1, 2)).toBe(false);
    sets.union(1, 3);
    expect(sets.connected(0, 2)).toBe(true);
    expect(sets.sizeOf(3)).toBe(4);
    expect(sets.union(0, 2)).toBe(false);
    expect(sets.count).toBe(3);
  });

  it.each([-1, 4, 100, 1.5, NaN])('throws for the out-of-range element %s', (bad) => {
    const sets = new UnionFind(4);
    expect(() => sets.find(bad)).toThrow(RangeError);
    expect(() => sets.union(0, bad)).toThrow(RangeError);
    expect(() => sets.connected(bad, 0)).toThrow(RangeError);
    expect(() => sets.sizeOf(bad)).toThrow(RangeError);
    expect(sets.count).toBe(4);
  });

  it("follows the entry's worked example", () => {
    const sets = new UnionFind(6);
    sets.union(0, 1);
    sets.union(2, 3);
    sets.union(4, 5);
    sets.union(2, 4);
    expect([...parentOf(sets)]).toEqual([0, 0, 2, 2, 2, 4]);
    sets.union(1, 5);
    expect([...parentOf(sets)]).toEqual([2, 0, 2, 2, 2, 2]);
    expect(sets.count).toBe(1);
    expect(sets.find(1)).toBe(2);
    expect([...parentOf(sets)]).toEqual([2, 2, 2, 2, 2, 2]);
  });

  it('puts the smaller tree under the larger', () => {
    const sets = new UnionFind(4);
    sets.union(1, 2);
    sets.union(1, 3);
    sets.union(0, 1);
    expect(sets.find(0)).toBe(1);
    expect(sets.find(1)).toBe(1);
    expect(sets.sizeOf(0)).toBe(4);
  });

  it('compresses the whole path on find', () => {
    const sets = new UnionFind(8);
    const parent = parentOf(sets);
    for (let x = 1; x < 8; x++) parent[x] = x - 1;
    expect(sets.find(7)).toBe(0);
    expect([...parent]).toEqual(new Array(8).fill(0));
  });

  it('keeps trees at most log2(n) deep with union by size', () => {
    const n = 1024;
    const sets = new UnionFind(n);
    for (let width = 1; width < n; width *= 2) {
      for (let start = 0; start < n; start += 2 * width) {
        sets.union(start + width, start);
      }
    }
    expect(sets.count).toBe(1);
    for (let x = 0; x < n; x++) expect(depth(sets, x)).toBeLessThanOrEqual(10);
  });

  it('matches a relabelled label array on 200 seeded random operation sequences', () => {
    for (let seed = 0; seed < 200; seed++) {
      const random = seeded(seed);
      const pick = (k: number) => Math.floor(random() * k);
      const n = pick(25);
      const sets = new UnionFind(n);
      let label = Array.from({ length: n }, (_, i) => i);
      const steps = 1 + pick(60);
      for (let step = 0; step < steps && n > 0; step++) {
        const a = pick(n);
        const b = pick(n);
        const op = pick(4);
        if (op === 0) {
          const joined = label[a] !== label[b];
          expect(sets.union(a, b)).toBe(joined);
          const old = label[b];
          label = label.map((lab) => (lab === old ? label[a] : lab));
        } else if (op === 1) {
          expect(sets.connected(a, b)).toBe(label[a] === label[b]);
        } else if (op === 2) {
          const root = sets.find(a);
          expect(label[root]).toBe(label[a]);
          expect(sets.find(root)).toBe(root);
        } else {
          expect(sets.sizeOf(a)).toBe(label.filter((lab) => lab === label[a]).length);
        }
        expect(sets.count).toBe(new Set(label).size);
        for (let x = 0; x < n; x++) {
          expect(depth(sets, x)).toBeLessThanOrEqual(Math.log2(n));
        }
      }
      expect(sets.count).toBe(new Set(label).size);
    }
  });
});

describe('countComponents and hasCycle (TypeScript)', () => {
  it('count components on small graphs', () => {
    expect(countComponents(0, [])).toBe(0);
    expect(countComponents(1, [])).toBe(1);
    expect(countComponents(5, [])).toBe(5);
    expect(
      countComponents(5, [
        [0, 1],
        [1, 2],
        [3, 4],
      ]),
    ).toBe(2);
    expect(
      countComponents(4, [
        [0, 1],
        [1, 0],
        [2, 2],
      ]),
    ).toBe(3);
  });

  it('detect cycles on small graphs', () => {
    expect(hasCycle(0, [])).toBe(false);
    expect(
      hasCycle(4, [
        [0, 1],
        [1, 2],
        [2, 3],
      ]),
    ).toBe(false);
    expect(
      hasCycle(4, [
        [0, 1],
        [1, 2],
        [2, 0],
      ]),
    ).toBe(true);
    expect(hasCycle(3, [[1, 1]])).toBe(true);
    expect(
      hasCycle(2, [
        [0, 1],
        [1, 0],
      ]),
    ).toBe(true);
  });

  it('match a graph search on 200 seeded random graphs', () => {
    for (let seed = 0; seed < 200; seed++) {
      const random = seeded(1000 + seed);
      const pick = (k: number) => Math.floor(random() * k);
      const n = 1 + pick(14);
      const edges = Array.from({ length: pick(20) }, (): [number, number] => [
        pick(n),
        pick(n),
      ]);
      const components = componentsBySearch(n, edges);
      expect(countComponents(n, edges)).toBe(components);
      // A forest with n nodes and c trees has exactly n - c edges; more means a cycle.
      expect(hasCycle(n, edges)).toBe(edges.length > n - components);
    }
  });
});
