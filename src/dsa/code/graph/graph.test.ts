import { describe, expect, it } from 'vitest';
import {
  buildList,
  buildMatrix,
  edgesOfList,
  edgesOfMatrix,
  hasEdgeList,
  hasEdgeMatrix,
  neighborsMatrix,
  type Edge,
} from './graph';

// The graph entry's TypeScript code. API: `buildList(n, edges, directed = false)`
// and `buildMatrix(...)` (both throw a RangeError for a vertex outside 0..n-1),
// `hasEdgeList`, `hasEdgeMatrix`, `neighborsMatrix` and the `edgesOfList` /
// `edgesOfMatrix` generators, which yield each stored [u, v] pair.

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

// The entry's running example: 4 vertices, undirected edges 0-1, 0-2, 1-2, 2-3.
const EXAMPLE: Edge[] = [
  [0, 1],
  [0, 2],
  [1, 2],
  [2, 3],
];

/** Wraps each row so every cell read, by index or by iteration, is counted. */
function counted(rows: number[][]): { rows: number[][]; reads: () => number } {
  let reads = 0;
  const wrapped = rows.map(
    (row) =>
      new Proxy(row, {
        get(target, key, receiver) {
          if (typeof key === 'string' && /^\d+$/.test(key)) reads++;
          return Reflect.get(target, key, receiver);
        },
      }),
  );
  return { rows: wrapped, reads: () => reads };
}

const pairs = (it: Iterable<Edge>) =>
  [...new Set([...it].map(([u, v]) => `${u},${v}`))].sort();

describe('the running example', () => {
  it('builds the list', () => {
    expect(buildList(4, EXAMPLE)).toEqual([[1, 2], [0, 2], [0, 1, 3], [2]]);
    expect(buildList(4, EXAMPLE, true)).toEqual([[1, 2], [2], [3], []]);
  });

  it('builds the matrix', () => {
    expect(buildMatrix(4, EXAMPLE)).toEqual([
      [0, 1, 1, 0],
      [1, 0, 1, 0],
      [1, 1, 0, 1],
      [0, 0, 1, 0],
    ]);
    expect(buildMatrix(4, EXAMPLE, true)[2]).toEqual([0, 0, 0, 1]);
  });
});

describe('edge cases', () => {
  it('handles zero and one vertex', () => {
    expect(buildList(0, [])).toEqual([]);
    expect(buildMatrix(0, [])).toEqual([]);
    expect(buildList(1, [])).toEqual([[]]);
    expect(buildMatrix(1, [])).toEqual([[0]]);
    expect([...edgesOfList([])]).toEqual([]);
    expect([...edgesOfMatrix([])]).toEqual([]);
  });

  it('gives every vertex its own row', () => {
    expect(buildList(3, [[0, 1]], true)).toEqual([[1], [], []]);
    expect(buildMatrix(3, [[0, 1]], true)).toEqual([
      [0, 1, 0],
      [0, 0, 0],
      [0, 0, 0],
    ]);
  });

  it('stores a self-loop once in both layouts', () => {
    expect(buildList(2, [[1, 1]])).toEqual([[], [1]]);
    expect(buildMatrix(2, [[1, 1]])).toEqual([
      [0, 0],
      [0, 1],
    ]);
    expect([...edgesOfList(buildList(2, [[1, 1]]))]).toEqual([[1, 1]]);
  });

  it('keeps a duplicate edge in the list but not in the matrix', () => {
    const twice: Edge[] = [
      [0, 1],
      [0, 1],
    ];
    expect(buildList(2, twice)).toEqual([
      [1, 1],
      [0, 0],
    ]);
    expect(buildMatrix(2, twice)).toEqual([
      [0, 1],
      [1, 0],
    ]);
  });

  it('answers hasEdge in both layouts, directed and not', () => {
    const adj = buildList(4, EXAMPLE);
    const m = buildMatrix(4, EXAMPLE);
    for (const [u, v] of [
      [2, 3],
      [3, 2],
    ]) {
      expect(hasEdgeList(adj, u, v)).toBe(true);
      expect(hasEdgeMatrix(m, u, v)).toBe(true);
    }
    expect(hasEdgeList(adj, 0, 3)).toBe(false);
    expect(hasEdgeMatrix(m, 3, 0)).toBe(false);
    const directed = buildList(4, EXAMPLE, true);
    expect(hasEdgeList(directed, 2, 3)).toBe(true);
    expect(hasEdgeList(directed, 3, 2)).toBe(false);
  });

  it.each([
    [0, 3],
    [3, 0],
    [-1, 0],
    [0, -1],
  ] as Edge[])('rejects the vertex in edge (%i, %i)', (u, v) => {
    expect(() => buildList(3, [[u, v]])).toThrow(RangeError);
    expect(() => buildMatrix(3, [[u, v]])).toThrow(RangeError);
  });
});

describe('the costs the entry claims', () => {
  it('stores one list entry per edge end', () => {
    const edges: Edge[] = Array.from({ length: 9 }, (_, i) => [i, i + 1]);
    const adj = buildList(1000, edges);
    expect(adj.length).toBe(1000);
    expect(adj.reduce((sum, row) => sum + row.length, 0)).toBe(18);
    const out = buildList(1000, edges, true);
    expect(out.reduce((sum, row) => sum + row.length, 0)).toBe(9);
  });

  it('allocates V squared cells even with no edges', () => {
    const m = buildMatrix(30, []);
    expect(m.length).toBe(30);
    expect(m.every((row) => row.length === 30)).toBe(true);
  });

  it('reads one cell for a matrix hasEdge', () => {
    const edges: Edge[] = Array.from({ length: 50 }, (_, i) => [i, (i * 7) % 50]);
    const { rows, reads } = counted(buildMatrix(50, edges));
    expect(hasEdgeMatrix(rows, 3, 21)).toBe(true);
    expect(reads()).toBe(1);
  });

  it('visits every matrix cell but only the list entries', () => {
    const edges: Edge[] = Array.from({ length: 39 }, (_, i) => [i, i + 1]);
    const matrix = counted(buildMatrix(40, edges));
    expect([...edgesOfMatrix(matrix.rows)].length).toBe(78);
    expect(matrix.reads()).toBe(40 * 40);
    const list = counted(buildList(40, edges));
    expect([...edgesOfList(list.rows)].length).toBe(78);
    expect(list.reads()).toBe(78);
  });

  it('reads the whole row to list a matrix vertex neighbors', () => {
    const { rows, reads } = counted(buildMatrix(4, EXAMPLE));
    expect(neighborsMatrix(rows, 2)).toEqual([0, 1, 3]);
    expect(reads()).toBe(4);
  });
});

describe('against the edge set on seeded random graphs', () => {
  for (const directed of [false, true]) {
    it(`agrees when directed is ${directed}`, () => {
      const seed = 7;
      const next = rng(seed);
      const below = (k: number) => Math.floor(next() * k);
      for (let trial = 0; trial < 50; trial++) {
        const n = 1 + below(11);
        const edges: Edge[] = Array.from({ length: below(3 * n) }, () => [
          below(n),
          below(n),
        ]);
        const truth = new Set(edges.map(([u, v]) => `${u},${v}`));
        if (!directed) edges.forEach(([u, v]) => truth.add(`${v},${u}`));
        const adj = buildList(n, edges, directed);
        const m = buildMatrix(n, edges, directed);
        const msg = `seed=${seed} trial=${trial} n=${n} directed=${directed} edges=${JSON.stringify(edges)}`;
        for (let u = 0; u < n; u++) {
          for (let v = 0; v < n; v++) {
            expect(hasEdgeList(adj, u, v), msg).toBe(truth.has(`${u},${v}`));
            expect(hasEdgeMatrix(m, u, v), msg).toBe(truth.has(`${u},${v}`));
          }
          const fromList = [...new Set(adj[u])].sort((a, b) => a - b);
          expect(fromList, msg).toEqual(neighborsMatrix(m, u));
        }
        expect(pairs(edgesOfList(adj)), msg).toEqual([...truth].sort());
        expect(pairs(edgesOfMatrix(m)), msg).toEqual([...truth].sort());
      }
    });
  }
});
