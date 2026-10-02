import { describe, expect, it } from 'vitest';
import { kruskal, prim, totalWeight, type Edge } from './prim-kruskal';

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
    for (let round = 0; round < 400; round++) {
      const { n, edges } = randomConnectedGraph(random);
      const tree = algorithm(n, edges);
      const label = JSON.stringify({ n, edges, tree });
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
    for (let round = 0; round < 100; round++) {
      const { n, edges } = randomConnectedGraph(random);
      const expected = totalWeight(algorithm(n, edges)!);
      expect(totalWeight(algorithm(n, [...edges].reverse())!)).toBe(expected);
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

describe('prim', () => {
  it('gives the same total from any start vertex', () => {
    const random = makeRandom(21);
    for (let round = 0; round < 100; round++) {
      const { n, edges } = randomConnectedGraph(random);
      const expected = totalWeight(kruskal(n, edges)!);
      for (let start = 0; start < n; start++) {
        expect(totalWeight(prim(n, edges, start)!)).toBe(expected);
      }
    }
  });
});
