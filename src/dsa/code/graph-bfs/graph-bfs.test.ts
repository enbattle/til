import { describe, expect, it } from 'vitest';
import { bfsDistances, nearestTarget, shortestPath, type Graph } from './graph-bfs';

// API:
// - `bfsDistances(graph, source)`: Map of fewest edges from `source` to each
//   reachable vertex (the source maps to 0).
// - `shortestPath(graph, source, target)`: a path with the fewest edges, source
//   first, or `null` when `target` is unreachable.
// - `nearestTarget(grid)`: multi-source BFS; steps to the nearest 'T', `null`
//   for walls and cells that cannot reach a target.

/** Small seeded generator (mulberry32) so failures are reproducible. */
function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function graphOf(entries: Record<number, number[]>): Graph {
  return new Map(Object.entries(entries).map(([k, v]) => [Number(k), v]));
}

/** Repeated relaxation: keep improving distances until nothing changes. */
function bruteDistances(graph: Graph, source: number): Map<number, number> {
  const dist = new Map<number, number>([[source, 0]]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [v, neighbours] of graph) {
      const dv = dist.get(v);
      if (dv === undefined) continue;
      for (const w of neighbours) {
        const dw = dist.get(w);
        if (dw === undefined || dw > dv + 1) {
          dist.set(w, dv + 1);
          changed = true;
        }
      }
    }
  }
  return dist;
}

function bruteGrid(grid: string[]): (number | null)[][] {
  const rows = grid.length;
  const cols = rows > 0 ? grid[0].length : 0;
  const dist = grid.map((row) => [...row].map((ch) => (ch === 'T' ? 0 : Infinity)));
  let changed = true;
  while (changed) {
    changed = false;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c] === '#') continue;
        for (const [nr, nc] of [
          [r + 1, c],
          [r - 1, c],
          [r, c + 1],
          [r, c - 1],
        ]) {
          if (nr < 0 || nr >= rows || nc < 0 || nc >= cols || grid[nr][nc] === '#')
            continue;
          if (dist[nr][nc] + 1 < dist[r][c]) {
            dist[r][c] = dist[nr][nc] + 1;
            changed = true;
          }
        }
      }
    }
  }
  return dist.map((row, r) =>
    row.map((d, c) => (grid[r][c] === '#' || d === Infinity ? null : d)),
  );
}

function randomGraph(
  rand: () => number,
  n: number,
  edges: number,
  directed: boolean,
): Graph {
  const graph: Graph = new Map();
  for (let v = 0; v < n; v++) graph.set(v, []);
  for (let i = 0; i < edges; i++) {
    const a = Math.floor(rand() * n);
    const b = Math.floor(rand() * n); // a === b gives a self-loop
    graph.get(a)!.push(b);
    if (!directed) graph.get(b)!.push(a);
  }
  return graph;
}

describe('bfsDistances and shortestPath (TypeScript)', () => {
  it('computes distances on a small graph', () => {
    const graph = graphOf({ 0: [1, 2], 1: [3], 2: [3], 3: [4], 4: [] });
    expect(bfsDistances(graph, 0)).toEqual(
      new Map([
        [0, 0],
        [1, 1],
        [2, 1],
        [3, 2],
        [4, 3],
      ]),
    );
  });

  it('leaves an unreachable vertex out and returns null for its path', () => {
    const graph = graphOf({ 0: [1], 1: [], 2: [0] });
    expect(bfsDistances(graph, 0).has(2)).toBe(false);
    expect(shortestPath(graph, 0, 2)).toBeNull();
  });

  it('handles self-loops and cycles', () => {
    const graph = graphOf({ 0: [0, 1], 1: [1, 0, 2], 2: [2] });
    expect(bfsDistances(graph, 0).get(2)).toBe(2);
    expect(shortestPath(graph, 0, 2)).toEqual([0, 1, 2]);
  });

  it('handles a disconnected graph', () => {
    const graph = graphOf({ 0: [1], 1: [0], 2: [3], 3: [2] });
    expect(bfsDistances(graph, 0).size).toBe(2);
    expect(shortestPath(graph, 0, 3)).toBeNull();
    expect(shortestPath(graph, 2, 3)).toEqual([2, 3]);
  });

  it('returns [source] when source equals target', () => {
    expect(shortestPath(graphOf({ 0: [1], 1: [0] }), 0, 0)).toEqual([0]);
    expect(shortestPath(new Map(), 5, 5)).toEqual([5]);
  });

  it('copes with a source or target missing from the graph', () => {
    expect(bfsDistances(new Map(), 7)).toEqual(new Map([[7, 0]]));
    expect(shortestPath(new Map(), 7, 8)).toBeNull();
    expect(shortestPath(graphOf({ 0: [1], 1: [] }), 0, 99)).toBeNull();
  });

  it('prefers the path with fewest edges', () => {
    const graph = graphOf({ 0: [1, 4], 1: [2], 2: [3], 3: [5], 4: [5], 5: [] });
    expect(shortestPath(graph, 0, 5)).toEqual([0, 4, 5]);
  });

  it('matches repeated relaxation on seeded random graphs', () => {
    const rand = seeded(2024);
    for (let trial = 0; trial < 50; trial++) {
      const n = 1 + Math.floor(rand() * 12);
      const graph = randomGraph(rand, n, Math.floor(rand() * 3 * n), rand() < 0.5);
      const source = Math.floor(rand() * n);
      const at = `seed 2024, trial ${trial}, source ${source}`;
      const expected = bruteDistances(graph, source);
      expect(bfsDistances(graph, source), at).toEqual(expected);
      for (let target = 0; target < n; target++) {
        const path = shortestPath(graph, source, target);
        const d = expected.get(target);
        const atTarget = `${at}, target ${target}`;
        if (d === undefined) {
          expect(path, atTarget).toBeNull();
          continue;
        }
        expect(path, atTarget).not.toBeNull();
        expect(path!.length - 1, atTarget).toBe(d);
        expect(path![0], atTarget).toBe(source);
        expect(path![path!.length - 1], atTarget).toBe(target);
        for (let i = 0; i + 1 < path!.length; i++) {
          expect(graph.get(path![i]), atTarget).toContain(path![i + 1]);
        }
      }
    }
  });
});

describe('nearestTarget (TypeScript)', () => {
  it('measures from the nearest of several targets', () => {
    expect(nearestTarget(['T.#.', '..#.', '...T'])).toEqual([
      [0, 1, null, 2],
      [1, 2, null, 1],
      [2, 2, 1, 0],
    ]);
  });

  it('lets walls block and cut off cells', () => {
    expect(nearestTarget(['T#.', '##.', '...'])).toEqual([
      [0, null, null],
      [null, null, null],
      [null, null, null],
    ]);
  });

  it('handles an all-wall grid and a grid with no targets', () => {
    expect(nearestTarget(['###', '###'])).toEqual([
      [null, null, null],
      [null, null, null],
    ]);
    expect(nearestTarget(['...', '.#.'])).toEqual([
      [null, null, null],
      [null, null, null],
    ]);
  });

  it('handles empty, single-cell and all-target grids', () => {
    expect(nearestTarget([])).toEqual([]);
    expect(nearestTarget(['T'])).toEqual([[0]]);
    expect(nearestTarget(['.'])).toEqual([[null]]);
    expect(nearestTarget(['TT', 'TT'])).toEqual([
      [0, 0],
      [0, 0],
    ]);
  });

  it('matches repeated relaxation on seeded random grids', () => {
    const rand = seeded(7);
    const weightSets = [
      [1, 1, 1],
      [6, 3, 1],
      [3, 5, 0],
      [5, 4, 1],
    ];
    for (let trial = 0; trial < 50; trial++) {
      const rows = 1 + Math.floor(rand() * 8);
      const cols = 1 + Math.floor(rand() * 8);
      const w = weightSets[Math.floor(rand() * weightSets.length)];
      const total = w[0] + w[1] + w[2];
      const grid: string[] = [];
      for (let r = 0; r < rows; r++) {
        let row = '';
        for (let c = 0; c < cols; c++) {
          const x = rand() * total;
          row += x < w[0] ? '.' : x < w[0] + w[1] ? '#' : 'T';
        }
        grid.push(row);
      }
      expect(nearestTarget(grid), `seed 7, trial ${trial}: ${grid.join('/')}`).toEqual(
        bruteGrid(grid),
      );
    }
  });
});
