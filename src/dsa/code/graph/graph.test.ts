import { describe, expect, it } from 'vitest';
import { AdjacencyMatrix, Graph } from './graph';

// The graph entry's TypeScript code. API: `new Graph<V>(directed = false)`
// (adjacency lists, any vertex value) and `new AdjacencyMatrix(n, directed =
// false)` (vertices 0 to n - 1), each with `addEdge` and `removeEdge` (both
// return whether anything changed), `hasEdge`, `neighbours`, `degree`,
// `vertices` and an `edgeCount` getter. `Graph` also has `addVertex`.

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

const EXAMPLE: [number, number][] = [
  [0, 1],
  [0, 2],
  [1, 2],
  [2, 3],
];

describe('Graph and AdjacencyMatrix (TypeScript)', () => {
  it.each([false, true])('start empty (directed: %s)', (directed) => {
    const g = new Graph<string>(directed);
    expect(g.vertices()).toEqual([]);
    expect(g.edgeCount).toBe(0);
    expect(g.hasEdge('a', 'b')).toBe(false);
    expect(g.removeEdge('a', 'b')).toBe(false);
    const m = new AdjacencyMatrix(0, directed);
    expect(m.vertices()).toEqual([]);
    expect(m.edgeCount).toBe(0);
  });

  it('adds a vertex on its own, once', () => {
    const g = new Graph<string>();
    g.addVertex('a');
    g.addVertex('a');
    expect(g.vertices()).toEqual(['a']);
    expect(g.neighbours('a')).toEqual([]);
    expect(g.degree('a')).toBe(0);
    expect(g.edgeCount).toBe(0);
  });

  it('builds the undirected worked example', () => {
    const g = new Graph<number>();
    for (const [u, v] of EXAMPLE) expect(g.addEdge(u, v)).toBe(true);
    expect(g.vertices()).toEqual([0, 1, 2, 3]);
    expect([0, 1, 2, 3].map((v) => g.neighbours(v))).toEqual([
      [1, 2],
      [0, 2],
      [0, 1, 3],
      [2],
    ]);
    expect([0, 1, 2, 3].map((v) => g.degree(v))).toEqual([2, 2, 3, 1]);
    expect(g.edgeCount).toBe(4);
    const m = new AdjacencyMatrix(4);
    for (const [u, v] of EXAMPLE) m.addEdge(u, v);
    const grid = [0, 1, 2, 3].map((u) =>
      [0, 1, 2, 3].map((v) => Number(m.hasEdge(u, v))),
    );
    expect(grid).toEqual([
      [0, 1, 1, 0],
      [1, 0, 1, 0],
      [1, 1, 0, 1],
      [0, 0, 1, 0],
    ]);
    expect(m.edgeCount).toBe(4);
  });

  it('builds the directed worked example', () => {
    const g = new Graph<number>(true);
    for (const [u, v] of EXAMPLE) g.addEdge(u, v);
    expect([0, 1, 2, 3].map((v) => g.neighbours(v))).toEqual([[1, 2], [2], [3], []]);
    expect(g.hasEdge(0, 1)).toBe(true);
    expect(g.hasEdge(1, 0)).toBe(false);
    expect(g.edgeCount).toBe(4);
    const m = new AdjacencyMatrix(4, true);
    for (const [u, v] of EXAMPLE) m.addEdge(u, v);
    expect([0, 1, 2, 3].map((v) => m.neighbours(v))).toEqual([[1, 2], [2], [3], []]);
    expect(m.hasEdge(1, 0)).toBe(false);
  });

  it('keeps undirected edges symmetric', () => {
    const g = new Graph<string>();
    g.addEdge('a', 'b');
    expect(g.hasEdge('a', 'b')).toBe(true);
    expect(g.hasEdge('b', 'a')).toBe(true);
    expect(g.addEdge('b', 'a')).toBe(false);
    expect(g.edgeCount).toBe(1);
    expect(g.removeEdge('b', 'a')).toBe(true);
    expect(g.hasEdge('a', 'b')).toBe(false);
    expect(g.hasEdge('b', 'a')).toBe(false);
    expect(g.neighbours('a')).toEqual([]);
    expect(g.neighbours('b')).toEqual([]);
    expect(g.edgeCount).toBe(0);
  });

  it('keeps directed edges one-way', () => {
    const g = new Graph<string>(true);
    g.addEdge('a', 'b');
    expect(g.neighbours('b')).toEqual([]);
    expect(g.addEdge('b', 'a')).toBe(true);
    expect(g.edgeCount).toBe(2);
    expect(g.removeEdge('a', 'b')).toBe(true);
    expect(g.hasEdge('b', 'a')).toBe(true);
    expect(g.neighbours('a')).toEqual([]);
  });

  it('ignores duplicate edges', () => {
    const g = new Graph<number>();
    expect(g.addEdge(1, 2)).toBe(true);
    expect(g.addEdge(1, 2)).toBe(false);
    expect(g.neighbours(1)).toEqual([2]);
    expect(g.neighbours(2)).toEqual([1]);
    expect(g.edgeCount).toBe(1);
    const m = new AdjacencyMatrix(3);
    expect(m.addEdge(1, 2)).toBe(true);
    expect(m.addEdge(2, 1)).toBe(false);
    expect(m.edgeCount).toBe(1);
  });

  it.each([false, true])('stores a self-loop once (directed: %s)', (directed) => {
    const g = new Graph<string>(directed);
    expect(g.addEdge('a', 'a')).toBe(true);
    expect(g.neighbours('a')).toEqual(['a']);
    expect(g.degree('a')).toBe(1);
    expect(g.hasEdge('a', 'a')).toBe(true);
    expect(g.addEdge('a', 'a')).toBe(false);
    expect(g.edgeCount).toBe(1);
    expect(g.removeEdge('a', 'a')).toBe(true);
    expect(g.neighbours('a')).toEqual([]);
    expect(g.edgeCount).toBe(0);
    const m = new AdjacencyMatrix(2, directed);
    expect(m.addEdge(1, 1)).toBe(true);
    expect(m.neighbours(1)).toEqual([1]);
    expect(m.degree(1)).toBe(1);
    expect(m.edgeCount).toBe(1);
    expect(m.removeEdge(1, 1)).toBe(true);
    expect(m.edgeCount).toBe(0);
  });

  it('removes a self-loop without touching the other neighbours', () => {
    const g = new Graph<string>();
    g.addEdge('a', 'b');
    g.addEdge('a', 'a');
    g.addEdge('a', 'c');
    expect(g.neighbours('a')).toEqual(['b', 'a', 'c']);
    expect(g.degree('a')).toBe(3);
    expect(g.removeEdge('a', 'a')).toBe(true);
    expect(g.neighbours('a')).toEqual(['b', 'c']);
    expect(g.neighbours('c')).toEqual(['a']);
    expect(g.edgeCount).toBe(2);
  });

  it('changes nothing when removing an absent edge', () => {
    const g = new Graph<number>();
    g.addEdge(1, 2);
    g.addVertex(3);
    expect(g.removeEdge(1, 3)).toBe(false);
    expect(g.removeEdge(1, 99)).toBe(false);
    expect(g.removeEdge(99, 1)).toBe(false);
    expect(g.edgeCount).toBe(1);
    expect(g.vertices()).toEqual([1, 2, 3]);
    const m = new AdjacencyMatrix(3);
    expect(m.removeEdge(0, 1)).toBe(false);
    expect(m.edgeCount).toBe(0);
  });

  it('keeps the other neighbours in order after a removal', () => {
    const g = new Graph<number>();
    for (const v of [1, 2, 3, 4]) g.addEdge(0, v);
    g.removeEdge(0, 2);
    expect(g.neighbours(0)).toEqual([1, 3, 4]);
    expect(g.degree(0)).toBe(3);
  });

  it('throws for an unknown vertex, but hasEdge answers false', () => {
    const g = new Graph<string>();
    g.addEdge('a', 'b');
    expect(() => g.neighbours('z')).toThrow(RangeError);
    expect(() => g.degree('z')).toThrow(RangeError);
    expect(g.hasEdge('z', 'a')).toBe(false);
    expect(g.hasEdge('a', 'z')).toBe(false);
    expect(g.vertices()).toEqual(['a', 'b']);
  });

  it('adds missing vertices in addEdge', () => {
    const g = new Graph<string>(true);
    g.addEdge('x', 'y');
    expect(g.vertices()).toEqual(['x', 'y']);
    expect(g.degree('y')).toBe(0);
  });

  it('returns a copy from neighbours', () => {
    const g = new Graph<number>();
    g.addEdge(1, 2);
    g.neighbours(1).push(3);
    expect(g.neighbours(1)).toEqual([2]);
    expect(g.hasEdge(1, 3)).toBe(false);
  });

  it.each([-1, 3, 10, 1.5])('matrix rejects vertex %s', (bad) => {
    const m = new AdjacencyMatrix(3);
    expect(() => m.addEdge(0, bad)).toThrow(RangeError);
    expect(() => m.hasEdge(bad, 0)).toThrow(RangeError);
    expect(() => m.removeEdge(bad, 0)).toThrow(RangeError);
    expect(() => m.neighbours(bad)).toThrow(RangeError);
    expect(() => m.degree(bad)).toThrow(RangeError);
    expect(m.edgeCount).toBe(0);
    for (const v of [0, 1, 2]) expect(m.neighbours(v)).toEqual([]);
  });

  it('matrix rejects a bad size', () => {
    expect(() => new AdjacencyMatrix(-1)).toThrow(RangeError);
    expect(() => new AdjacencyMatrix(2.5)).toThrow(RangeError);
  });

  it('keeps matrix rows independent', () => {
    const m = new AdjacencyMatrix(3, true);
    m.addEdge(0, 1);
    expect(m.neighbours(0)).toEqual([1]);
    expect(m.neighbours(1)).toEqual([]);
    expect(m.neighbours(2)).toEqual([]);
  });

  it('list and matrix match a set of pairs on 50 seeded random sequences', () => {
    for (let seed = 0; seed < 50; seed++) {
      const random = seeded(seed);
      const n = 1 + Math.floor(random() * 7);
      const directed = random() < 0.5;
      const g = new Graph<number>(directed);
      for (let v = 0; v < n; v++) g.addVertex(v);
      const m = new AdjacencyMatrix(n, directed);
      const edges = new Set<string>();
      const key = (u: number, v: number) =>
        directed || u <= v ? `${u},${v}` : `${v},${u}`;
      const steps = Math.floor(random() * 61);
      for (let step = 0; step < steps; step++) {
        const u = Math.floor(random() * n);
        const v = Math.floor(random() * n);
        const at = `seed ${seed}, step ${step}`;
        if (random() < 0.6) {
          const expected = !edges.has(key(u, v));
          edges.add(key(u, v));
          expect(g.addEdge(u, v), at).toBe(expected);
          expect(m.addEdge(u, v), at).toBe(expected);
        } else {
          const expected = edges.has(key(u, v));
          edges.delete(key(u, v));
          expect(g.removeEdge(u, v), at).toBe(expected);
          expect(m.removeEdge(u, v), at).toBe(expected);
        }
        expect(g.edgeCount, at).toBe(edges.size);
        expect(m.edgeCount, at).toBe(edges.size);
        for (let a = 0; a < n; a++) {
          const want: number[] = [];
          for (let b = 0; b < n; b++) if (edges.has(key(a, b))) want.push(b);
          expect(
            [...g.neighbours(a)].sort((x, y) => x - y),
            at,
          ).toEqual(want);
          expect(m.neighbours(a), at).toEqual(want);
          expect(g.degree(a), at).toBe(want.length);
          expect(m.degree(a), at).toBe(want.length);
          for (let b = 0; b < n; b++) {
            expect(g.hasEdge(a, b), at).toBe(edges.has(key(a, b)));
            expect(m.hasEdge(a, b), at).toBe(edges.has(key(a, b)));
          }
        }
      }
    }
  });
});
