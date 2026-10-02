import { describe, expect, it } from 'vitest';
import { countComponents, countIslands, hasCycle } from './graph-dfs';

// API:
// - `countComponents(graph: Map<number, number[]>): number`: connected
//   components of an undirected graph; every vertex is a key of the map.
// - `countIslands(grid: number[][]): number`: groups of 1-cells joined up,
//   down, left or right.
// - `hasCycle(graph: Map<number, number[]>): boolean`: whether a directed
//   graph has a cycle.

type Graph = Map<number, number[]>;

function makeGraph(n: number): Graph {
  return new Map(Array.from({ length: n }, (_, v) => [v, [] as number[]]));
}

function undirected(n: number, edges: [number, number][]): Graph {
  const graph = makeGraph(n);
  for (const [u, v] of edges) {
    graph.get(u)!.push(v);
    graph.get(v)!.push(u);
  }
  return graph;
}

function directed(n: number, edges: [number, number][]): Graph {
  const graph = makeGraph(n);
  for (const [u, v] of edges) graph.get(u)!.push(v);
  return graph;
}

/** A small seeded generator, so a failure can be replayed. */
function seeded(seed: number) {
  let state = seed;
  return (bound: number) => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return Math.floor((state / 2147483648) * bound);
  };
}

/** Vertices reachable from `source` by a breadth-first search, source included. */
function reachable(graph: Graph, source: number): Set<number> {
  const found = new Set([source]);
  const queue = [source];
  for (let head = 0; head < queue.length; head++) {
    for (const next of graph.get(queue[head])!) {
      if (!found.has(next)) {
        found.add(next);
        queue.push(next);
      }
    }
  }
  return found;
}

/** Distinct reachability sets: in an undirected graph, one per component. */
function bruteComponents(graph: Graph): number {
  const sets = new Set<string>();
  for (const vertex of graph.keys()) {
    sets.add([...reachable(graph, vertex)].sort((a, b) => a - b).join(','));
  }
  return sets.size;
}

/** A cycle exists exactly when some vertex can reach itself by 1+ edges. */
function bruteHasCycle(graph: Graph): boolean {
  for (const [vertex, neighbours] of graph) {
    for (const next of neighbours) {
      if (reachable(graph, next).has(vertex)) return true;
    }
  }
  return false;
}

/** Relabel each land cell to the smallest label among its neighbours until stable. */
function bruteIslands(grid: number[][]): number {
  const label = grid.map((row, r) => row.map((x, c) => (x === 1 ? r * 100 + c : -1)));
  let changed = true;
  while (changed) {
    changed = false;
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        if (label[r][c] < 0) continue;
        for (const [nr, nc] of [
          [r + 1, c],
          [r, c + 1],
          [r - 1, c],
          [r, c - 1],
        ]) {
          const near = label[nr]?.[nc] ?? -1;
          if (near >= 0 && near < label[r][c]) {
            label[r][c] = near;
            changed = true;
          }
        }
      }
    }
  }
  return new Set(label.flat().filter((x) => x >= 0)).size;
}

describe('countComponents (TypeScript)', () => {
  it('returns 0 for an empty graph', () => {
    expect(countComponents(new Map())).toBe(0);
  });

  it('counts a single vertex and isolated vertices', () => {
    expect(countComponents(new Map([[0, []]]))).toBe(1);
    expect(countComponents(undirected(5, []))).toBe(5);
  });

  it('counts components in small examples', () => {
    expect(
      countComponents(
        undirected(6, [
          [0, 1],
          [1, 2],
          [3, 4],
        ]),
      ),
    ).toBe(3);
    expect(
      countComponents(
        undirected(4, [
          [0, 1],
          [1, 2],
          [2, 3],
        ]),
      ),
    ).toBe(1);
  });

  it('handles self-loops and parallel edges', () => {
    expect(
      countComponents(
        undirected(2, [
          [0, 0],
          [1, 1],
        ]),
      ),
    ).toBe(2);
    expect(
      countComponents(
        undirected(2, [
          [0, 1],
          [0, 1],
          [1, 0],
        ]),
      ),
    ).toBe(1);
  });

  it('handles non-contiguous vertex labels', () => {
    const graph: Graph = new Map([
      [10, [20]],
      [20, [10]],
      [7, []],
    ]);
    expect(countComponents(graph)).toBe(2);
  });

  it('agrees with a reachability brute force on many random graphs', () => {
    const next = seeded(1);
    for (let trial = 0; trial < 400; trial++) {
      const n = next(13);
      const edges: [number, number][] = [];
      const edgeCount = n === 0 ? 0 : next(15);
      for (let k = 0; k < edgeCount; k++) edges.push([next(n), next(n)]);
      const graph = undirected(n, edges);
      expect(countComponents(graph)).toBe(bruteComponents(graph));
    }
  });

  it('does not overflow the call stack on a very long path', () => {
    const n = 200_000;
    const edges: [number, number][] = [];
    for (let i = 0; i < n - 1; i++) edges.push([i, i + 1]);
    expect(countComponents(undirected(n, edges))).toBe(1);
  });
});

describe('countIslands (TypeScript)', () => {
  it('returns 0 for empty and all-water grids', () => {
    expect(countIslands([])).toBe(0);
    expect(countIslands([[]])).toBe(0);
    expect(
      countIslands([
        [0, 0, 0],
        [0, 0, 0],
      ]),
    ).toBe(0);
  });

  it('counts a single cell and an all-land grid', () => {
    expect(countIslands([[1]])).toBe(1);
    expect(
      countIslands([
        [1, 1],
        [1, 1],
      ]),
    ).toBe(1);
  });

  it('counts islands in an example grid', () => {
    const grid = [
      [1, 1, 0, 0, 0],
      [1, 1, 0, 0, 0],
      [0, 0, 1, 0, 0],
      [0, 0, 0, 1, 1],
    ];
    expect(countIslands(grid)).toBe(3);
  });

  it('does not join diagonal cells', () => {
    expect(
      countIslands([
        [1, 0],
        [0, 1],
      ]),
    ).toBe(2);
  });

  it('does not change the grid', () => {
    const grid = [
      [1, 0],
      [1, 1],
    ];
    countIslands(grid);
    expect(grid).toEqual([
      [1, 0],
      [1, 1],
    ]);
  });

  it('handles a single row and a single column', () => {
    expect(countIslands([[1, 0, 1, 1, 0, 1]])).toBe(3);
    expect(countIslands([[1], [0], [1], [1]])).toBe(2);
  });

  it('agrees with a relabelling brute force on many random grids', () => {
    const next = seeded(2);
    for (let trial = 0; trial < 400; trial++) {
      const rows = 1 + next(8);
      const cols = 1 + next(8);
      const density = [20, 50, 80][next(3)];
      const grid = Array.from({ length: rows }, () =>
        Array.from({ length: cols }, () => (next(100) < density ? 1 : 0)),
      );
      expect(countIslands(grid)).toBe(bruteIslands(grid));
    }
  });

  it('does not overflow the call stack on a very long snake of land', () => {
    expect(countIslands([new Array(200_000).fill(1)])).toBe(1);
  });
});

describe('hasCycle (TypeScript)', () => {
  it('is false for an empty graph and for isolated vertices', () => {
    expect(hasCycle(new Map())).toBe(false);
    expect(hasCycle(directed(4, []))).toBe(false);
  });

  it('finds a self-loop', () => {
    expect(hasCycle(directed(1, [[0, 0]]))).toBe(true);
    expect(
      hasCycle(
        directed(3, [
          [0, 1],
          [2, 2],
        ]),
      ),
    ).toBe(true);
  });

  it('finds simple loops', () => {
    expect(
      hasCycle(
        directed(2, [
          [0, 1],
          [1, 0],
        ]),
      ),
    ).toBe(true);
    expect(
      hasCycle(
        directed(4, [
          [0, 1],
          [1, 2],
          [2, 3],
          [3, 1],
        ]),
      ),
    ).toBe(true);
  });

  it('is false for a path and a tree', () => {
    expect(
      hasCycle(
        directed(4, [
          [0, 1],
          [1, 2],
          [2, 3],
        ]),
      ),
    ).toBe(false);
    expect(
      hasCycle(
        directed(5, [
          [0, 1],
          [0, 2],
          [1, 3],
          [1, 4],
        ]),
      ),
    ).toBe(false);
  });

  it('does not report a diamond as a cycle', () => {
    const diamond = directed(4, [
      [0, 1],
      [0, 2],
      [1, 3],
      [2, 3],
    ]);
    expect(hasCycle(diamond)).toBe(false);
  });

  it('does not report an edge to a finished vertex as a cycle', () => {
    const edges: [number, number][] = [
      [0, 1],
      [1, 2],
      [0, 2],
    ];
    expect(hasCycle(directed(3, edges))).toBe(false);
  });

  it('finds a cycle after acyclic branches', () => {
    const edges: [number, number][] = [
      [0, 1],
      [2, 3],
      [3, 4],
      [4, 2],
      [5, 0],
    ];
    expect(hasCycle(directed(6, edges))).toBe(true);
  });

  it('agrees with a reach-yourself brute force on many random graphs', () => {
    const next = seeded(3);
    let sawCycle = false;
    let sawAcyclic = false;
    for (let trial = 0; trial < 600; trial++) {
      const n = next(10);
      const edges: [number, number][] = [];
      const edgeCount = n === 0 ? 0 : next(12);
      for (let k = 0; k < edgeCount; k++) edges.push([next(n), next(n)]);
      const graph = directed(n, edges);
      const expected = bruteHasCycle(graph);
      expect(hasCycle(graph)).toBe(expected);
      if (expected) sawCycle = true;
      else sawAcyclic = true;
    }
    expect(sawCycle && sawAcyclic).toBe(true);
  });

  it('does not overflow the call stack on a very long path', () => {
    const n = 200_000;
    const path: [number, number][] = [];
    for (let i = 0; i < n - 1; i++) path.push([i, i + 1]);
    expect(hasCycle(directed(n, path))).toBe(false);
    expect(hasCycle(directed(n, [...path, [n - 1, 0]]))).toBe(true);
  });
});
