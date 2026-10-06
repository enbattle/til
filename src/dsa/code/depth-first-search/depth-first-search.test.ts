import { describe, expect, it } from 'vitest';
import {
  type Graph,
  type TreeNode,
  countComponents,
  diameter,
  explore,
  hasCycle,
  hasPathSum,
} from './depth-first-search';

// The depth-first-search entry's TypeScript code. API: `explore(adj, start,
// seen)` marks what start reaches in `seen`; `countComponents(adj)` counts the
// pieces of an undirected graph; `hasCycle(adj)` is true when a directed graph
// loops; `hasPathSum(root, target)` checks the root-to-leaf paths of a tree;
// `diameter(root)` counts the edges of its longest path. `adj[u]` lists the
// neighbors of u.

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

type Edge = [number, number];

function undirected(n: number, edges: Edge[]): Graph {
  const adj: Graph = Array.from({ length: n }, () => []);
  for (const [u, v] of edges) {
    adj[u].push(v);
    if (u !== v) adj[v].push(u);
  }
  return adj;
}

function directed(n: number, edges: Edge[]): Graph {
  const adj: Graph = Array.from({ length: n }, () => []);
  for (const [u, v] of edges) adj[u].push(v);
  return adj;
}

/** Rows that count how many times each one is scanned. */
function counted(adj: Graph): { rows: Graph; scans: number[] } {
  const scans = adj.map(() => 0);
  const rows = adj.map((row, u) => {
    const copy = [...row];
    Object.defineProperty(copy, Symbol.iterator, {
      value: function* () {
        scans[u]++;
        for (let i = 0; i < copy.length; i++) yield copy[i];
      },
    });
    return copy;
  });
  return { rows, scans };
}

function build(values: (number | null)[]): TreeNode | null {
  if (values.length === 0 || values[0] === null) return null;
  const root: TreeNode = { value: values[0], left: null, right: null };
  const waiting = [root];
  let i = 1;
  for (const node of waiting) {
    for (const side of ['left', 'right'] as const) {
      const v = i < values.length ? values[i] : null;
      i++;
      if (v !== null) {
        node[side] = { value: v, left: null, right: null };
        waiting.push(node[side]!);
      }
    }
  }
  return root;
}

const EXAMPLE = [5, 4, 8, 11, null, 13, 4, 7, 2, null, null, 5, 1];
const DIAMOND: Edge[] = [
  [0, 1],
  [0, 2],
  [1, 3],
  [2, 3],
];

function randomEdges(next: () => number, n: number, max: number): Edge[] {
  if (n === 0) return [];
  const count = Math.floor(next() * (max + 1));
  return Array.from({ length: count }, () => [
    Math.floor(next() * n),
    Math.floor(next() * n),
  ]);
}

function chainOfDiamonds(k: number): { n: number; edges: Edge[] } {
  const edges: Edge[] = [];
  for (let i = 0; i < k; i++) {
    const [a, b, c, nxt] = [3 * i, 3 * i + 1, 3 * i + 2, 3 * i + 3];
    edges.push([a, b], [a, c], [b, nxt], [c, nxt]);
  }
  return { n: 3 * k + 1, edges };
}

describe('connected components', () => {
  it('counts the example and the edge cases', () => {
    expect(
      countComponents(
        undirected(6, [
          [0, 1],
          [1, 2],
          [3, 4],
        ]),
      ),
    ).toBe(3);
    expect(countComponents([])).toBe(0);
    expect(countComponents([[]])).toBe(1);
    expect(countComponents(undirected(4, []))).toBe(4);
    expect(countComponents(undirected(2, [[1, 1]]))).toBe(2);
    expect(
      countComponents(
        undirected(3, [
          [0, 1],
          [1, 2],
          [0, 2],
        ]),
      ),
    ).toBe(1);
  });

  it('explore marks only the reachable part', () => {
    const adj = undirected(6, [
      [0, 1],
      [1, 2],
      [3, 4],
    ]);
    const seen = new Set<number>();
    explore(adj, 1, seen);
    expect([...seen].sort()).toEqual([0, 1, 2]);
    explore(adj, 5, seen);
    expect([...seen].sort()).toEqual([0, 1, 2, 5]);
  });

  it('goes deep before backing up', () => {
    // Vertex 1 must be fully explored (reaching 3) before 2 is visited. A queue
    // gives 0, 1, 2, 3; marking on push gives 0, 1, 2, 3 with the reversal and
    // 0, 3, 2, 1 without it.
    const seen = new Set<number>();
    explore([[1, 2, 3], [0, 3], [0], [0, 1]], 0, seen);
    expect([...seen]).toEqual([0, 1, 3, 2]);
  });

  it('scans each vertex once even when several neighbors push it', () => {
    // A triangle plus a diamond: marking on pop would scan a vertex twice.
    const { rows, scans } = counted(
      undirected(5, [
        [0, 1],
        [0, 2],
        [1, 2],
        [2, 3],
        [1, 3],
        [3, 4],
      ]),
    );
    expect(countComponents(rows)).toBe(1);
    expect(scans).toEqual([1, 1, 1, 1, 1]);
  });

  it('scans every row exactly once on random graphs', () => {
    const next = seeded(7);
    for (let trial = 0; trial < 50; trial++) {
      const n = Math.floor(next() * 13);
      const { rows, scans } = counted(undirected(n, randomEdges(next, n, 14)));
      countComponents(rows);
      expect(scans, `seed 7 trial ${trial}`).toEqual(Array(n).fill(1));
    }
  });

  it('survives a path far deeper than any call stack', () => {
    const n = 1_000_000;
    const path: Graph = Array.from({ length: n }, (_, i) =>
      [i - 1, i + 1].filter((v) => v >= 0 && v < n),
    );
    expect(countComponents(path)).toBe(1);
  });

  it('matches merging groups edge by edge', () => {
    const next = seeded(11);
    for (let trial = 0; trial < 50; trial++) {
      const n = Math.floor(next() * 13);
      const edges = randomEdges(next, n, 14);
      let groups: Set<number>[] = Array.from({ length: n }, (_, u) => new Set([u]));
      for (const [u, v] of edges) {
        const a = groups.find((g) => g.has(u))!;
        const b = groups.find((g) => g.has(v))!;
        if (a !== b) {
          b.forEach((x) => a.add(x));
          groups = groups.filter((g) => g !== b);
        }
      }
      expect(countComponents(undirected(n, edges)), `seed 11 trial ${trial}`).toBe(
        groups.length,
      );
    }
  });
});

describe('cycle detection', () => {
  it('handles the examples and the edge cases', () => {
    expect(hasCycle(directed(4, DIAMOND))).toBe(false);
    expect(hasCycle(directed(4, [...DIAMOND, [3, 0]]))).toBe(true);
    expect(
      hasCycle(
        directed(3, [
          [0, 1],
          [1, 2],
          [2, 1],
        ]),
      ),
    ).toBe(true);
    expect(hasCycle([])).toBe(false);
    expect(hasCycle([[]])).toBe(false);
    expect(hasCycle([[0]])).toBe(true);
    // The cycle is in a part no earlier start reaches.
    expect(
      hasCycle(
        directed(4, [
          [0, 1],
          [2, 3],
          [3, 2],
        ]),
      ),
    ).toBe(true);
  });

  it('scans each vertex once, however many paths reach it', () => {
    // 2**20 paths run through this chain; a finished vertex must not be re-walked.
    const { n, edges } = chainOfDiamonds(20);
    const { rows, scans } = counted(directed(n, edges));
    expect(hasCycle(rows)).toBe(false);
    expect(scans).toEqual(Array(n).fill(1));
  });

  it('matches peeling off vertices with no way out', () => {
    const next = seeded(13);
    for (let trial = 0; trial < 50; trial++) {
      const n = Math.floor(next() * 9);
      const edges = randomEdges(next, n, 10);
      const left = new Set(Array.from({ length: n }, (_, u) => u));
      for (;;) {
        const sinks = [...left].filter((u) =>
          edges.every(([a, v]) => a !== u || !left.has(v)),
        );
        if (sinks.length === 0) break;
        sinks.forEach((u) => left.delete(u));
      }
      expect(hasCycle(directed(n, edges)), `seed 13 trial ${trial}`).toBe(left.size > 0);
    }
  });

  it('recursion is limited by depth', () => {
    const n = 1_000_000;
    const path: Graph = Array.from({ length: n }, (_, i) => (i + 1 < n ? [i + 1] : []));
    expect(() => hasCycle(path)).toThrow(RangeError);
  });
});

describe('tree depth-first search', () => {
  it('finds root-to-leaf sums on the example', () => {
    const root = build(EXAMPLE);
    expect(hasPathSum(root, 22)).toBe(true);
    expect(hasPathSum(root, 26)).toBe(true); // 5, 8, 13
    expect(hasPathSum(root, 27)).toBe(true); // 5, 4, 11, 7
    expect(hasPathSum(root, 18)).toBe(true); // 5, 8, 4, 1
    expect(hasPathSum(root, 9)).toBe(false); // 5, 4 ends at a node with a child
    expect(hasPathSum(root, 5)).toBe(false); // the root is not a leaf
  });

  it('handles empty, single and one-child trees', () => {
    expect(hasPathSum(null, 0)).toBe(false);
    expect(hasPathSum(build([7]), 7)).toBe(true);
    expect(hasPathSum(build([7]), 0)).toBe(false);
    expect(hasPathSum(build([1, 2]), 1)).toBe(false);
    expect(hasPathSum(build([1, null, 2]), 1)).toBe(false);
    expect(hasPathSum(build([1, -2, 3]), -1)).toBe(true);
  });

  it('matches enumerating every path', () => {
    const next = seeded(17);
    for (let trial = 0; trial < 50; trial++) {
      const size = 1 + Math.floor(next() * 12);
      const levels = Array.from({ length: size }, (_, i) => {
        const value = Math.floor(next() * 15) - 5;
        return i === 0 || next() < 0.75 ? value : null;
      });
      const root = build(levels)!;
      const sums = new Set<number>();
      const stack: [TreeNode, number][] = [[root, 0]];
      while (stack.length > 0) {
        const [node, before] = stack.pop()!;
        const total = before + node.value;
        if (node.left === null && node.right === null) sums.add(total);
        for (const child of [node.left, node.right]) {
          if (child !== null) stack.push([child, total]);
        }
      }
      for (let target = -12; target < 30; target++) {
        expect(hasPathSum(root, target), `seed 17 trial ${trial} target ${target}`).toBe(
          sums.has(target),
        );
      }
    }
  });

  it('measures the diameter in edges', () => {
    expect(diameter(build(EXAMPLE))).toBe(6);
    expect(diameter(null)).toBe(0);
    expect(diameter(build([1]))).toBe(0);
    expect(diameter(build([1, 2]))).toBe(1);
    expect(diameter(build([1, 2, 3]))).toBe(2);
    // The longest path avoids the root: it turns at node 2.
    expect(diameter(build([1, 2, null, 3, 4, 5, null, null, 6, 7]))).toBe(5);
  });

  it('visits each node once', () => {
    let reads = 0;
    const chain = (n: number): TreeNode => {
      const make = (i: number): TreeNode => ({
        value: 1,
        get left() {
          reads++;
          return null;
        },
        right: i + 1 < n ? make(i + 1) : null,
      });
      return make(0);
    };
    expect(diameter(chain(60))).toBe(59);
    expect(reads).toBe(60); // one left read per node, not a re-walk each
  });

  it('matches pairwise distances', () => {
    const next = seeded(19);
    for (let trial = 0; trial < 50; trial++) {
      const size = 1 + Math.floor(next() * 13);
      const levels = Array.from({ length: size }, (_, i) =>
        i === 0 || next() < 0.75 ? 0 : null,
      );
      const root = build(levels)!;
      const links = new Map<TreeNode, TreeNode[]>();
      const stack = [root];
      while (stack.length > 0) {
        const node = stack.pop()!;
        if (!links.has(node)) links.set(node, []);
        for (const child of [node.left, node.right]) {
          if (child === null) continue;
          links.set(child, [...(links.get(child) ?? []), node]);
          links.get(node)!.push(child);
          stack.push(child);
        }
      }
      let best = 0;
      for (const start of links.keys()) {
        const dist = new Map([[start, 0]]);
        const frontier = [start];
        for (const node of frontier) {
          for (const other of links.get(node)!) {
            if (!dist.has(other)) {
              dist.set(other, dist.get(node)! + 1);
              frontier.push(other);
            }
          }
        }
        best = Math.max(best, ...dist.values());
      }
      expect(diameter(root), `seed 19 trial ${trial}`).toBe(best);
    }
  });
});
