import { describe, expect, it } from 'vitest';
import {
  type Graph,
  courseOrder,
  topologicalSort,
  topologicalSortDfs,
} from './topological-sort';

// The topological-sort entry's TypeScript code. API: `topologicalSort(adj)` is
// Kahn's algorithm and `topologicalSortDfs(adj)` reverses a depth-first finishing
// order; both return an order with every edge going forward, or null on a cycle.
// `courseOrder(n, prerequisites)` takes [course, prerequisite] pairs. `adj[u]`
// lists the vertices u points at.

const BOTH: [string, (adj: Graph) => number[] | null][] = [
  ['topologicalSort', topologicalSort],
  ['topologicalSortDfs', topologicalSortDfs],
];

// The entry's running example: 0 -> 1, 0 -> 2, 1 -> 3, 2 -> 3, 3 -> 4.
const RUNNING: Graph = [[1, 2], [3], [3], [4], []];
// The same with 4 -> 1 added, which closes the loop 1, 3, 4.
const LOOPING: Graph = [[1, 2], [3], [3], [4], [1]];

/** A small seeded generator (mulberry32), so a failing case can be replayed. */
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

function directed(n: number, edges: [number, number][]): Graph {
  const adj: Graph = Array.from({ length: n }, () => []);
  for (const [u, v] of edges) adj[u].push(v);
  return adj;
}

function goesForward(adj: Graph, order: number[]): boolean {
  const place = new Map(order.map((u, i) => [u, i]));
  if (place.size !== adj.length || order.length !== adj.length) return false;
  return adj.every((targets, u) => targets.every((v) => place.get(u)! < place.get(v)!));
}

/** Rows that count how many times each one is scanned, in one shared counter. */
function counted(adj: Graph): { rows: Graph; scans: { n: number } } {
  const scans = { n: 0 };
  const rows = adj.map((row) => {
    const copy = [...row];
    Object.defineProperty(copy, Symbol.iterator, {
      value: function* () {
        scans.n++;
        for (let i = 0; i < copy.length; i++) yield copy[i];
      },
    });
    return copy;
  });
  return { rows, scans };
}

function existsOrder(adj: Graph): boolean {
  const n = adj.length;
  const used = new Array<boolean>(n).fill(false);
  const order: number[] = [];
  const search = (): boolean => {
    if (order.length === n) return goesForward(adj, order);
    for (let u = 0; u < n; u++) {
      if (used[u]) continue;
      used[u] = true;
      order.push(u);
      const found = search();
      order.pop();
      used[u] = false;
      if (found) return true;
    }
    return false;
  };
  return search();
}

describe.each(BOTH)('%s', (_name, sort) => {
  it('handles the empty graph and one vertex', () => {
    expect(sort([])).toEqual([]);
    expect(sort([[]])).toEqual([0]);
  });

  it('returns null on a cycle', () => {
    expect(sort([[0]])).toBeNull(); // a self-loop
    expect(sort([[1], [0]])).toBeNull();
    expect(sort(LOOPING)).toBeNull();
    // The loop is away from vertex 0 and not reachable from it, so a search that
    // stopped after the first start or ignored later ones would miss it.
    expect(sort([[], [2], [3], [1]])).toBeNull();
  });

  it('handles duplicate edges and disconnected vertices', () => {
    expect(sort([[1, 1], []])).toEqual([0, 1]);
    const adj = [[1, 1], [], [3], []];
    expect(goesForward(adj, sort(adj)!)).toBe(true);
    expect([...sort([[], [], []])!].sort()).toEqual([0, 1, 2]);
  });

  it('does not call a diamond a cycle', () => {
    expect(sort([[1, 2], [3], [3], []])).not.toBeNull();
  });
});

describe('exact orders', () => {
  it('differ between the two methods on the running example', () => {
    // The DFS method reverses the finish order 4, 3, 1, 2, 0.
    expect(topologicalSort(RUNNING)).toEqual([0, 1, 2, 3, 4]);
    expect(topologicalSortDfs(RUNNING)).toEqual([0, 2, 1, 3, 4]);
  });

  it('are first in first out for Kahn', () => {
    // 0 readies 2 then 1. A queue takes 2 first; a stack or a lowest-first scan
    // takes 1 first.
    const adj = [[2, 1], [3], [3], []];
    expect(topologicalSort(adj)).toEqual([0, 2, 1, 3]);
    // The DFS method flips that tie: 1 finishes after 2, so it comes out earlier.
    expect(topologicalSortDfs(adj)).toEqual([0, 1, 2, 3]);
  });
});

describe('courseOrder', () => {
  it('puts each prerequisite first', () => {
    const pairs: [number, number][] = [
      [1, 0],
      [2, 0],
      [3, 1],
      [3, 2],
      [4, 3],
    ];
    expect(courseOrder(5, pairs)).toEqual([0, 1, 2, 3, 4]);
    expect(courseOrder(3, [])).toEqual([0, 1, 2]);
    expect(courseOrder(0, [])).toEqual([]);
    expect(
      courseOrder(2, [
        [0, 1],
        [1, 0],
      ]),
    ).toBeNull();
  });
});

describe('mechanism', () => {
  it('scans each row twice in Kahn: once to count, once off the queue', () => {
    // This catches a rescan of the rows; a rescan of the in-degree array reads no
    // rows, so the timing test below catches that one.
    const chain: Graph = Array.from({ length: 100 }, (_, i) => (i < 99 ? [i + 1] : []));
    for (const adj of [RUNNING, chain]) {
      const { rows, scans } = counted(adj);
      expect(topologicalSort(rows)).not.toBeNull();
      expect(scans.n).toBe(2 * adj.length);
    }
  });

  it('scans each row once in the DFS method, even through diamonds', () => {
    // Finished vertices are never reset, so a chain of diamonds, with two routes
    // through each, still scans each row once; resetting would make it 2^12 walks.
    const edges: [number, number][] = [];
    for (let i = 0; i < 12; i++) {
      const a = 3 * i;
      edges.push([a, a + 1], [a, a + 2], [a + 1, a + 3], [a + 2, a + 3]);
    }
    for (const adj of [RUNNING, directed(37, edges)]) {
      const { rows, scans } = counted(adj);
      expect(topologicalSortDfs(rows)).not.toBeNull();
      expect(scans.n).toBe(adj.length);
    }
  });

  it('does linear work in Kahn, not V^2', () => {
    const time = (adj: Graph) => {
      const start = performance.now();
      const order = topologicalSort(adj)!;
      return { order, ms: performance.now() - start };
    };
    // A chain keeps one vertex ready at a time, so any step that searches all the
    // vertices for the next ready one (even through the in-degree array, which the
    // row counts can't see) does V^2 work: seconds here, milliseconds for Kahn's.
    const n = 50_000;
    const chain: Graph = Array.from({ length: n }, (_, i) => (i < n - 1 ? [i + 1] : []));
    const chained = time(chain);
    expect(chained.order[n - 1]).toBe(n - 1);
    expect(chained.ms).toBeLessThan(500);
    // A source with n - 1 sinks keeps the queue near n, so shifting from the front
    // of a plain array moves about n items each time.
    const m = 100_000;
    const fan: Graph = [Array.from({ length: m - 1 }, (_, i) => i + 1)];
    for (let i = 1; i < m; i++) fan.push([]);
    const fanned = time(fan);
    expect(fanned.order.length).toBe(m);
    expect(fanned.ms).toBeLessThan(500);
    // Last, so a quadratic version fails above instead of grinding through this
    // one: a chain far deeper than any call stack, which Kahn's never recurses on.
    const deep = 1_000_000;
    const long: Graph = Array.from({ length: deep }, (_, i) =>
      i < deep - 1 ? [i + 1] : [],
    );
    const order = topologicalSort(long)!;
    expect(order.length).toBe(deep);
    expect(order[0]).toBe(0);
    expect(order[deep - 1]).toBe(deep - 1);
  });
});

describe('random graphs', () => {
  it('match a brute-force search over every order', () => {
    const rand = seeded(7);
    const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
    let withOrder = 0;
    let withCycle = 0;
    for (let trial = 0; trial < 50; trial++) {
      const n = int(1, 6);
      let edges: [number, number][] = Array.from({ length: int(0, 7) }, () => [
        int(0, n - 1),
        int(0, n - 1),
      ]);
      if (trial % 2 === 0) {
        // Orient along a shuffled labeling, so about half the graphs have an order.
        const label = Array.from({ length: n }, (_, i) => i).sort(() => rand() - 0.5);
        edges = edges.map(([u, v]) => (label[u] < label[v] ? [u, v] : [v, u]));
      }
      const adj = directed(n, edges);
      const expected = existsOrder(adj);
      if (expected) withOrder++;
      else withCycle++;
      for (const [name, sort] of BOTH) {
        const result = sort(adj);
        const msg = `seed=7 trial=${trial} ${name} adj=${JSON.stringify(adj)}`;
        if (expected) {
          expect(result !== null && goesForward(adj, result), msg).toBe(true);
        } else {
          expect(result, msg).toBeNull();
        }
      }
    }
    expect(withOrder).toBeGreaterThan(10);
    expect(withCycle).toBeGreaterThan(10);
  });
});
