import { describe, expect, it } from 'vitest';
import { bellmanFord, type Edge } from './bellman-ford';

// API: `bellmanFord(n, edges, source)`, distances from `source` over directed
// [u, v, weight] edges on vertices 0 to n - 1, Infinity for unreachable
// vertices, or null if a negative cycle is reachable from `source`. The
// reference is a brute force over every simple path and cycle.

/** Minimum over all simple paths; null if a reachable simple cycle is negative. */
function bruteForce(n: number, edges: Edge[], source: number): number[] | null {
  const out: [number, number][][] = Array.from({ length: n }, () => []);
  for (const [u, v, w] of edges) out[u].push([v, w]);

  const best = new Array<number>(n).fill(Infinity);
  best[source] = 0;
  const paths = (u: number, total: number, seen: Set<number>): void => {
    for (const [v, w] of out[u]) {
      if (seen.has(v)) continue;
      best[v] = Math.min(best[v], total + w);
      paths(v, total + w, new Set(seen).add(v));
    }
  };
  paths(source, 0, new Set([source]));

  const negativeCycleThrough = (start: number): boolean => {
    const walk = (u: number, total: number, seen: Set<number>): boolean => {
      for (const [v, w] of out[u]) {
        if (v === start && total + w < 0) return true;
        if (!seen.has(v) && walk(v, total + w, new Set(seen).add(v))) return true;
      }
      return false;
    };
    return walk(start, 0, new Set([start]));
  };

  for (let s = 0; s < n; s++) {
    if (best[s] < Infinity && negativeCycleThrough(s)) return null;
  }
  return best;
}

function makeRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

describe('bellmanFord (TypeScript)', () => {
  it('handles a textbook graph with a negative edge', () => {
    const edges: Edge[] = [
      [0, 1, 4],
      [0, 2, 5],
      [1, 2, -3],
      [2, 3, 2],
    ];
    expect(bellmanFord(4, edges, 0)).toEqual([0, 4, 1, 3]);
  });

  it('needs all n - 1 rounds when edges are listed backwards', () => {
    const edges: Edge[] = [
      [3, 4, 1],
      [2, 3, -2],
      [1, 2, 3],
      [0, 1, 4],
      [0, 2, 10],
    ];
    expect(bellmanFord(5, edges, 0)).toEqual([0, 4, 7, 5, 6]);
  });

  it('gives the same answer with edges in path order', () => {
    const edges: Edge[] = [
      [0, 1, 4],
      [0, 2, 10],
      [1, 2, 3],
      [2, 3, -2],
      [3, 4, 1],
    ];
    expect(bellmanFord(5, edges, 0)).toEqual([0, 4, 7, 5, 6]);
  });

  it('rejects zero vertices and an out-of-range source', () => {
    expect(() => bellmanFord(0, [], 0)).toThrow(RangeError);
    expect(() => bellmanFord(3, [], 3)).toThrow(RangeError);
    expect(() => bellmanFord(3, [], -1)).toThrow(RangeError);
  });

  it('handles a single vertex, with and without self-loops', () => {
    expect(bellmanFord(1, [], 0)).toEqual([0]);
    expect(bellmanFord(1, [[0, 0, 0]], 0)).toEqual([0]);
    expect(bellmanFord(1, [[0, 0, 5]], 0)).toEqual([0]);
    expect(bellmanFord(1, [[0, 0, -1]], 0)).toBeNull();
  });

  it('leaves everything else infinite when there are no edges', () => {
    expect(bellmanFord(3, [], 1)).toEqual([Infinity, 0, Infinity]);
  });

  it('handles zero-weight edges and a zero-weight cycle', () => {
    const edges: Edge[] = [
      [0, 1, 0],
      [1, 2, 0],
      [2, 0, 0],
      [2, 3, 0],
    ];
    expect(bellmanFord(4, edges, 0)).toEqual([0, 0, 0, 0]);
  });

  it('treats edges as directed', () => {
    expect(bellmanFord(2, [[1, 0, 1]], 0)).toEqual([0, Infinity]);
  });

  it('uses the cheapest of parallel edges', () => {
    const edges: Edge[] = [
      [0, 1, 5],
      [0, 1, -2],
      [0, 1, 3],
    ];
    expect(bellmanFord(2, edges, 0)).toEqual([0, -2]);
  });

  it('returns null for a reachable negative cycle', () => {
    const edges: Edge[] = [
      [0, 1, 1],
      [1, 2, -3],
      [2, 1, 1],
    ];
    expect(bellmanFord(3, edges, 0)).toBeNull();
    expect(
      bellmanFord(
        2,
        [
          [0, 1, 1],
          [1, 0, -2],
        ],
        0,
      ),
    ).toBeNull();
  });

  it('ignores a negative cycle that is unreachable from the source', () => {
    const edges: Edge[] = [
      [0, 1, 2],
      [2, 3, -3],
      [3, 2, 1],
    ];
    expect(bellmanFord(4, edges, 0)).toEqual([0, 2, Infinity, Infinity]);
    expect(bellmanFord(4, edges, 2)).toBeNull();
  });

  it('stops early when a round changes nothing', () => {
    let passes = 0;
    const n = 2000;
    const edges = Array.from({ length: n - 1 }, (_, i): Edge => [i, i + 1, -1]);
    const counted = new Proxy(edges, {
      get(target, prop, receiver) {
        if (prop === Symbol.iterator) passes++;
        return Reflect.get(target, prop, receiver) as unknown;
      },
    });
    expect(bellmanFord(n, counted, 0)?.[n - 1]).toBe(-(n - 1));
    expect(passes).toBe(2);
  });

  it('agrees with a brute force on many random graphs', () => {
    const random = makeRandom(7);
    const randInt = (lo: number, hi: number) => lo + Math.floor(random() * (hi - lo + 1));
    let nulls = 0;
    let negativeEdges = 0;
    for (let trial = 0; trial < 3000; trial++) {
      const n = randInt(1, 6);
      const count = randInt(0, 12);
      const edges: Edge[] = [];
      if (random() < 0.5) {
        for (let i = 0; i < count; i++) {
          edges.push([randInt(0, n - 1), randInt(0, n - 1), randInt(-5, 10)]);
        }
      } else {
        // Non-negative cost plus a potential difference: no negative cycle,
        // but individual edges can be negative.
        const pot = Array.from({ length: n }, () => randInt(-6, 6));
        for (let i = 0; i < count; i++) {
          const u = randInt(0, n - 1);
          const v = randInt(0, n - 1);
          edges.push([u, v, randInt(0, 6) + pot[u] - pot[v]]);
        }
      }
      const source = randInt(0, n - 1);
      const expected = bruteForce(n, edges, source);
      expect(bellmanFord(n, edges, source), JSON.stringify([n, edges, source])).toEqual(
        expected,
      );
      if (expected === null) nulls++;
      else if (edges.some(([, , w]) => w < 0)) negativeEdges++;
    }
    expect(nulls).toBeGreaterThan(100);
    expect(negativeEdges).toBeGreaterThan(100);
  });
});
