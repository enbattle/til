import { describe, expect, it, vi } from 'vitest';
import { MinHeap, bellmanFord, dijkstra, type Graph } from './shortest-paths';

// The shortest-paths entry's TypeScript code. API: `dijkstra(graph, source)`
// and `bellmanFord(graph, source)` take `graph[u]` as a list of [v, weight]
// pairs and return the cheapest cost from source to every vertex (Infinity if
// unreachable). `bellmanFord` returns null when a negative cycle is reachable.

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

const randInt = (r: () => number, lo: number, hi: number) =>
  lo + Math.floor(r() * (hi - lo + 1));

// The entry's running example, and the same shape with a negative edge.
const RUN: Graph = [
  [
    [1, 4],
    [2, 1],
  ],
  [[3, 1]],
  [
    [1, 2],
    [3, 5],
  ],
  [],
];
const NEG: Graph = [
  [
    [1, 2],
    [2, 3],
  ],
  [[3, 1]],
  [[1, -2]],
  [],
];
const NEG_CYCLE: Graph = [
  [
    [1, 2],
    [2, 3],
  ],
  [[2, 1]],
  [[1, -2]],
];

/** Counts reads of graph[u], one per time a vertex is scanned for edges. */
function counted(graph: Graph, limit = Infinity) {
  const c = { reads: 0 };
  const proxy = new Proxy(graph, {
    get(target, prop, receiver) {
      if (typeof prop === 'string' && /^\d+$/.test(prop)) {
        if (++c.reads > limit) throw new Error('scanned past the read limit');
        if (Number(prop) >= target.length) {
          throw new RangeError(`read index ${prop} of ${target.length}`);
        }
      }
      return Reflect.get(target, prop, receiver);
    },
  });
  return { graph: proxy, c };
}

/** Brute force: all-pairs costs; dist[i][i] < 0 marks a negative cycle. */
function floydWarshall(graph: Graph): number[][] {
  const n = graph.length;
  const d = Array.from({ length: n }, () => new Array<number>(n).fill(Infinity));
  for (let u = 0; u < n; u++) {
    d[u][u] = 0;
    for (const [v, w] of graph[u]) d[u][v] = Math.min(d[u][v], w);
  }
  for (let k = 0; k < n; k++)
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++)
        if (d[i][k] + d[k][j] < d[i][j]) d[i][j] = d[i][k] + d[k][j];
  return d;
}

function randomGraph(r: () => number, n: number, lo: number, hi: number, edges: number) {
  const graph: Graph = Array.from({ length: n }, () => []);
  for (let e = 0; e < edges; e++) {
    graph[randInt(r, 0, n - 1)].push([randInt(r, 0, n - 1), randInt(r, lo, hi)]);
  }
  return graph;
}

describe.each([
  ['dijkstra', dijkstra],
  ['bellmanFord', bellmanFord],
])('%s', (_name, solve) => {
  it('solves the running example', () => {
    expect(solve(RUN, 0)).toEqual([0, 3, 1, 4]);
  });

  it('handles a single vertex', () => {
    expect(solve([[]], 0)).toEqual([0]);
  });

  it('leaves unreachable vertices at Infinity', () => {
    expect(solve([[[1, 5]], [], [[0, 1]]], 0)).toEqual([0, 5, Infinity]);
  });

  it('works from a source that is not vertex 0', () => {
    expect(solve([[], [[0, 2]], [[1, 3]]], 2)).toEqual([5, 3, 0]);
  });

  it('handles parallel edges and self-loops', () => {
    const graph: Graph = [
      [
        [1, 9],
        [1, 4],
        [0, 7],
        [1, 6],
      ],
      [[1, 3]],
    ];
    expect(solve(graph, 0)).toEqual([0, 4]);
  });

  it('handles zero-weight edges and a zero-weight cycle', () => {
    const graph: Graph = [
      [[1, 0]],
      [[2, 0]],
      [
        [0, 0],
        [3, 5],
      ],
      [],
    ];
    // The read limit turns a relaxation that never ends into a failure.
    expect(solve(counted(graph, 1000).graph, 0)).toEqual([0, 0, 0, 5]);
  });
});

describe('dijkstra', () => {
  it('matches Floyd-Warshall on random non-negative graphs', () => {
    for (let seed = 0; seed < 50; seed++) {
      const r = rng(seed);
      const n = randInt(r, 1, 8);
      const graph = randomGraph(r, n, 0, 9, randInt(r, 0, 20));
      const source = randInt(r, 0, n - 1);
      expect(
        dijkstra(counted(graph, 1000).graph, source), // the limit stops a loop
        `seed=${seed} graph=${JSON.stringify(graph)}`,
      ).toEqual(floydWarshall(graph)[source]);
    }
  });

  it('pushes once per improvement and pops every entry through a MinHeap', () => {
    const push = vi.spyOn(MinHeap.prototype, 'push');
    const pop = vi.spyOn(MinHeap.prototype, 'pop');
    try {
      dijkstra(RUN, 0);
      // The source's entry plus 1@4, 2@1, 1@3, 3@6 and 3@4; every entry pops.
      const pushed = push.mock.calls.map((c) => c[0]);
      expect(pushed.slice(1).sort()).toEqual(
        [
          [1, 2],
          [3, 1],
          [4, 1],
          [4, 3],
          [6, 3],
        ].sort(),
      );
      expect(pushed).toHaveLength(6);
      expect(pop).toHaveBeenCalledTimes(6);
    } finally {
      push.mockRestore();
      pop.mockRestore();
    }
  });

  it('skips stale entries, so each vertex is scanned once', () => {
    // (4, 1) and (6, 3) are stale when they pop; scanning them makes six reads.
    const { graph, c } = counted(RUN);
    dijkstra(graph, 0);
    expect(c.reads).toBe(4);
  });

  it('scans each vertex once on a larger graph', () => {
    const n = 30;
    const big: Graph = Array.from({ length: n }, (_, u) =>
      Array.from({ length: n }, (_, v) => v)
        .filter((v) => v !== u)
        .map((v): [number, number] => [v, 1 + ((u * v) % 5)]),
    );
    const { graph, c } = counted(big);
    dijkstra(graph, 0);
    expect(c.reads).toBe(n);
  });

  it('scans a vertex twice when a negative edge improves it late', () => {
    const { graph, c } = counted(NEG);
    expect(dijkstra(graph, 0)).toEqual([0, 1, 3, 2]);
    expect(c.reads).toBe(5); // four vertices, but vertex 1 is scanned twice
  });

  it('never finishes on a negative cycle', () => {
    const { graph } = counted(NEG_CYCLE, 1000);
    expect(() => dijkstra(graph, 0)).toThrow('read limit');
  });
});

describe('bellmanFord', () => {
  it('matches Floyd-Warshall on random graphs with negative weights', () => {
    let cycles = 0;
    for (let seed = 0; seed < 50; seed++) {
      const r = rng(seed);
      const n = randInt(r, 1, 7);
      const graph = randomGraph(r, n, -3, 8, randInt(r, 0, 14));
      const source = randInt(r, 0, n - 1);
      const fw = floydWarshall(graph);
      const cyclic = fw[source].some((cost, v) => cost < Infinity && fw[v][v] < 0);
      if (cyclic) cycles++;
      const want = cyclic ? null : fw[source];
      expect(
        bellmanFord(counted(graph, 1000).graph, source),
        `seed=${seed} graph=${JSON.stringify(graph)}`,
      ).toEqual(want);
    }
    expect(cycles).toBeGreaterThan(0);
    expect(cycles).toBeLessThan(50); // the trials must reach both outcomes
  });

  it('handles a negative edge', () => {
    expect(bellmanFord(NEG, 0)).toEqual([0, 1, 3, 2]);
  });

  it('returns null on a negative cycle', () => {
    expect(bellmanFord(counted(NEG_CYCLE, 1000).graph, 0)).toBeNull();
  });

  it('treats a negative self-loop as a cycle', () => {
    const { graph } = counted([[[1, 1]], [[1, -1]]], 1000);
    expect(bellmanFord(graph, 0)).toBeNull();
  });

  it('ignores a negative cycle the source cannot reach', () => {
    const graph: Graph = [[[1, 4]], [], [[3, -2]], [[2, -2]]];
    expect(bellmanFord(graph, 0)).toEqual([0, 4, Infinity, Infinity]);
  });

  it('copes with a route that needs n - 1 changing rounds', () => {
    // The path n-1 -> ... -> 0 is scanned against its direction, so each round
    // fixes one more vertex: n - 1 changing rounds, then a quiet one.
    const n = 6;
    const graph: Graph = Array.from({ length: n }, (_, u) => (u > 0 ? [[u - 1, 2]] : []));
    expect(bellmanFord(graph, n - 1)).toEqual(
      Array.from({ length: n }, (_, v) => 2 * (n - 1 - v)),
    );
  });

  it('stops after the first round that changes nothing', () => {
    const { graph, c } = counted(RUN);
    bellmanFord(graph, 0);
    expect(c.reads).toBe(12); // 3 rounds x 4 vertices
  });

  it('runs exactly n rounds when there is a negative cycle', () => {
    const { graph, c } = counted(NEG_CYCLE, 1000);
    expect(bellmanFord(graph, 0)).toBeNull();
    expect(c.reads).toBe(3 * 3);
  });
});
