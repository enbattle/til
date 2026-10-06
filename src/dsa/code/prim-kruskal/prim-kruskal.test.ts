import { describe, expect, it } from 'vitest';
import { kruskal, prim, type Edge } from './prim-kruskal';

const totalWeight = (tree: Edge[]): number => tree.reduce((sum, e) => sum + e[2], 0);

type Algorithm = (n: number, edges: Edge[]) => Edge[] | null;
const algorithms: [string, Algorithm][] = [
  ['kruskal', (n, edges) => kruskal(n, edges)],
  ['prim', (n, edges) => prim(n, edges)],
];

function makeRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

/** n - 1 edges that join all n vertices (so none closes a cycle). */
function isSpanningTree(n: number, tree: Edge[]): boolean {
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number => {
    while (parent[x] !== x) x = parent[x];
    return x;
  };
  for (const [u, v] of tree) {
    const rootU = find(u);
    const rootV = find(v);
    if (rootU === rootV) return false;
    parent[rootU] = rootV;
  }
  return tree.length === Math.max(n - 1, 0);
}

/** The cheapest total over every subset of n - 1 edges that spans. */
function bruteForceWeight(n: number, edges: Edge[]): number {
  let best = Infinity;
  const subset: Edge[] = [];
  const pick = (from: number): void => {
    if (subset.length === n - 1) {
      if (isSpanningTree(n, subset)) best = Math.min(best, totalWeight(subset));
      return;
    }
    for (let i = from; i < edges.length; i++) {
      subset.push(edges[i]);
      pick(i + 1);
      subset.pop();
    }
  };
  pick(0);
  return best;
}

function randomConnectedGraph(random: () => number): { n: number; edges: Edge[] } {
  const int = (low: number, high: number) =>
    low + Math.floor(random() * (high - low + 1));
  const n = int(2, 6);
  const edges: Edge[] = [];
  for (let v = 1; v < n; v++) edges.push([int(0, v - 1), v, int(-5, 5)]);
  const extras = int(0, 5);
  for (let i = 0; i < extras; i++) edges.push([int(0, n - 1), int(0, n - 1), int(-5, 5)]);
  for (let i = edges.length - 1; i > 0; i--) {
    const j = int(0, i);
    [edges[i], edges[j]] = [edges[j], edges[i]];
  }
  return { n, edges };
}

describe.each(algorithms)('%s (TypeScript)', (_name, algorithm) => {
  it('matches brute force on many random connected graphs', () => {
    const random = makeRandom(7);
    for (let trial = 0; trial < 50; trial++) {
      const { n, edges } = randomConnectedGraph(random);
      const tree = algorithm(n, edges);
      const label = `seed 7, trial ${trial}: ${JSON.stringify({ n, edges, tree })}`;
      expect(tree, label).not.toBeNull();
      expect(isSpanningTree(n, tree!), label).toBe(true);
      for (const [u, v, w] of tree!) {
        const found = edges.some(
          (e) => e[2] === w && ((e[0] === u && e[1] === v) || (e[0] === v && e[1] === u)),
        );
        expect(found, label).toBe(true);
      }
      expect(totalWeight(tree!), label).toBe(bruteForceWeight(n, edges));
    }
  });

  it('handles the empty graph and a single vertex', () => {
    expect(algorithm(0, [])).toEqual([]);
    expect(algorithm(1, [])).toEqual([]);
    expect(
      algorithm(1, [
        [0, 0, 3],
        [0, 0, -3],
      ]),
    ).toEqual([]);
  });

  it('handles two vertices', () => {
    const tree = algorithm(2, [[0, 1, 4]]);
    expect(tree).toHaveLength(1);
    expect(totalWeight(tree!)).toBe(4);
  });

  it('returns every edge when the graph is already a tree', () => {
    const tree = algorithm(5, [
      [0, 1, 5],
      [1, 2, -2],
      [1, 3, 9],
      [3, 4, 1],
    ]);
    expect(tree).toHaveLength(4);
    expect(totalWeight(tree!)).toBe(13);
  });

  it('keeps the cheapest of several parallel edges', () => {
    const tree = algorithm(3, [
      [0, 1, 7],
      [1, 0, 2],
      [0, 1, 5],
      [1, 2, 3],
      [2, 1, 8],
    ]);
    expect(totalWeight(tree!)).toBe(5);
  });

  it('never chooses a self-loop', () => {
    const tree = algorithm(2, [
      [0, 0, -100],
      [0, 1, 4],
      [1, 1, -100],
    ]);
    expect(totalWeight(tree!)).toBe(4);
  });

  it('gives the same total whichever tied edges win', () => {
    const tree = algorithm(4, [
      [0, 1, 1],
      [1, 2, 1],
      [2, 3, 1],
      [3, 0, 1],
      [0, 2, 1],
    ]);
    expect(isSpanningTree(4, tree!)).toBe(true);
    expect(totalWeight(tree!)).toBe(3);
  });

  it('handles negative weights', () => {
    const tree = algorithm(4, [
      [0, 1, -4],
      [1, 2, -1],
      [0, 2, -3],
      [2, 3, 2],
      [1, 3, -7],
    ]);
    expect(totalWeight(tree!)).toBe(-14);
  });

  it('returns null for a disconnected graph', () => {
    expect(algorithm(2, [])).toBeNull();
    expect(
      algorithm(4, [
        [0, 1, 1],
        [2, 3, 1],
      ]),
    ).toBeNull();
    expect(
      algorithm(3, [
        [0, 1, 1],
        [0, 0, 1],
        [1, 1, 1],
      ]),
    ).toBeNull();
  });

  it('gives the same total in any input order', () => {
    const random = makeRandom(3);
    for (let trial = 0; trial < 50; trial++) {
      const { n, edges } = randomConnectedGraph(random);
      const expected = totalWeight(algorithm(n, edges)!);
      expect(
        totalWeight(algorithm(n, [...edges].reverse())!),
        `seed 3, trial ${trial}: ${JSON.stringify({ n, edges })}`,
      ).toBe(expected);
    }
  });
});

describe('the worked example from the entry', () => {
  const edges: Edge[] = [
    [0, 1, 4],
    [0, 2, 1],
    [1, 2, 2],
    [1, 3, 5],
    [2, 3, 8],
  ];

  it('kruskal takes 0-2, 1-2, 1-3', () => {
    expect(kruskal(4, edges)).toEqual([
      [0, 2, 1],
      [1, 2, 2],
      [1, 3, 5],
    ]);
  });

  it('prim from 0 takes 0-2, 2-1, 1-3', () => {
    expect(prim(4, edges)).toEqual([
      [0, 2, 1],
      [2, 1, 2],
      [1, 3, 5],
    ]);
  });
});

describe.each(algorithms)('%s (TypeScript), more cases', (_name, algorithm) => {
  it('connects both ends of an edge stored once', () => {
    // (2, 0): Prim starts at 0, so it only finds 2 if both ends are stored.
    const tree = algorithm(3, [
      [2, 0, 1],
      [2, 1, 1],
    ]);
    expect(totalWeight(tree!)).toBe(2);
  });

  it('does not reorder the input', () => {
    const edges: Edge[] = [
      [0, 1, 9],
      [1, 2, 1],
      [0, 2, 5],
    ];
    const before = JSON.stringify(edges);
    algorithm(3, edges);
    expect(JSON.stringify(edges)).toBe(before);
  });
});

/** A weight that counts every conversion to a number, which any comparison makes. */
function countedGraph(): { n: number; edges: Edge[]; calls: () => number } {
  const random = makeRandom(11);
  const int = (hi: number) => Math.floor(random() * hi);
  const n = 300;
  const pairs: [number, number][] = [];
  for (let v = 1; v < n; v++) pairs.push([int(v), v]);
  for (let i = 0; i < n; i++) pairs.push([int(n), int(n)]);
  const weights = pairs.map((_, i) => i);
  for (let i = weights.length - 1; i > 0; i--) {
    const j = int(i + 1);
    [weights[i], weights[j]] = [weights[j], weights[i]];
  }
  let count = 0;
  const edges = pairs.map(([u, v], i): Edge => {
    const weight = { valueOf: () => (count++, weights[i]) };
    return [u, v, weight as unknown as number];
  });
  return { n, edges, calls: () => count };
}

// Sparse on purpose: a heap Prim compares about E log E times, but a Prim that
// scans every crossing edge for the minimum compares about V * E / 2 times, and
// one that scans an array of best-known costs about V * V / 2. A dense graph
// couldn't tell those apart from the heap.
describe('comparison counts on a sparse graph', () => {
  it('kruskal sorts instead of scanning for each minimum', () => {
    const { n, edges, calls } = countedGraph();
    expect(kruskal(n, edges)).toHaveLength(n - 1);
    expect(calls()).toBeLessThanOrEqual(24 * edges.length);
  });

  it('prim keeps comparisons near E log E', () => {
    const { n, edges, calls } = countedGraph();
    expect(prim(n, edges)).toHaveLength(n - 1);
    expect(calls()).toBeLessThanOrEqual(50 * edges.length);
  });
});

describe('kruskal', () => {
  it('does not search the tree built so far for each edge', () => {
    // A star: every edge joins a new leaf to vertex 0. Searching the chosen
    // edges for each new one is O(E * V): about 4 s at this size, against
    // about 5 ms for union-find, so the 500 ms limit has a wide margin.
    const n = 8000;
    const star: Edge[] = Array.from({ length: n - 1 }, (_, i) => [0, i + 1, i + 1]);
    const start = performance.now();
    const tree = kruskal(n, star);
    const elapsed = performance.now() - start;
    expect(tree).toHaveLength(n - 1);
    expect(elapsed).toBeLessThan(500);
  });

  it('stops at n - 1 edges', () => {
    // The sentinel is out of range and heaviest, so it sorts last. Looking at
    // it adds a fourth edge to a tree of three vertices.
    const tree = kruskal(3, [
      [0, 1, 1],
      [1, 2, 2],
      [0, 99, 1e9],
    ]);
    expect(tree).toEqual([
      [0, 1, 1],
      [1, 2, 2],
    ]);
  });
});

describe('prim vs kruskal', () => {
  it('gives the same total on larger random graphs', () => {
    const random = makeRandom(21);
    const int = (lo: number, hi: number) => lo + Math.floor(random() * (hi - lo + 1));
    for (let trial = 0; trial < 50; trial++) {
      const n = int(2, 40);
      const edges: Edge[] = [];
      for (let v = 1; v < n; v++) edges.push([int(0, v - 1), v, int(-50, 50)]);
      for (let i = int(0, 3 * n); i > 0; i--) {
        edges.push([int(0, n - 1), int(0, n - 1), int(-50, 50)]);
      }
      expect(
        totalWeight(prim(n, edges)!),
        `seed 21, trial ${trial}: ${JSON.stringify({ n, edges })}`,
      ).toBe(totalWeight(kruskal(n, edges)!));
    }
  });
});
