import { describe, expect, it } from 'vitest';
import { minutesToRot, shortestPath } from './breadth-first-search';

// The breadth-first-search entry's TypeScript code. API:
// `shortestPath(adj, source, target)` takes an adjacency list (vertices 0 to
// n - 1, as in the graph entry) and returns a path with the fewest edges,
// source first, or null; `minutesToRot(grid)` takes rows of 0 (empty), 1
// (fresh) and 2 (rotten) and returns the minutes until no fresh cell is left, or -1.

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

// The running example: two shortest routes from 0 to 5 exist, and 3 is reached
// from both 1 and 2 before it is popped.
const EXAMPLE = [
  [1, 2],
  [0, 3],
  [0, 3, 4],
  [1, 2, 5],
  [2, 5],
  [3, 4],
];

/**
 * An adjacency list that counts row reads. Reading a row past the limit, or
 * past the end of a row, throws, so a mutant that loops cannot hang vitest.
 */
function counting(rows: number[][]): { adj: number[][]; reads: () => number } {
  let reads = 0;
  const adj = new Proxy(rows, {
    get(target, key, receiver) {
      if (typeof key === 'string' && /^\d+$/.test(key)) {
        reads++;
        // A search that forgot its visited set would loop forever on a cycle.
        if (reads > 20 * rows.length + 20) throw new Error('row read too often');
      }
      return Reflect.get(target, key, receiver);
    },
  });
  return { adj, reads: () => reads };
}

/** Fewest edges to every vertex, by repeated relaxation (no queue). */
function distances(adj: number[][], source: number): Map<number, number> {
  const dist = new Map<number, number>([[source, 0]]);
  let changed = true;
  while (changed) {
    changed = false;
    adj.forEach((row, v) => {
      const dv = dist.get(v);
      if (dv === undefined) return;
      for (const w of row) {
        const dw = dist.get(w);
        if (dw === undefined || dw > dv + 1) {
          dist.set(w, dv + 1);
          changed = true;
        }
      }
    });
  }
  return dist;
}

function randomGraph(random: () => number): number[][] {
  const n = 1 + Math.floor(random() * 8);
  const adj: number[][] = Array.from({ length: n }, () => []);
  const edges = Math.floor(random() * 15);
  for (let i = 0; i < edges; i++) {
    const u = Math.floor(random() * n);
    const v = Math.floor(random() * n);
    adj[u].push(v);
    if (random() < 0.5) adj[v].push(u);
  }
  return adj;
}

/** A grid whose cell reads are counted, and capped against a runaway loop. */
function countingGrid(rows: number[][]): { grid: number[][]; reads: () => number } {
  let reads = 0;
  const grid = rows.map(
    (row) =>
      new Proxy(row, {
        get(target, key, receiver) {
          if (typeof key === 'string' && /^\d+$/.test(key)) {
            reads++;
            if (reads > 10_000) throw new Error('cells read far too often');
          }
          return Reflect.get(target, key, receiver);
        },
      }),
  );
  return { grid, reads: () => reads };
}

/** Minutes by spreading rot one minute at a time over the whole grid. */
function simulate(grid: number[][]): number {
  const g = grid.map((row) => [...row]);
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (let minutes = 0; ; minutes++) {
    const spread: [number, number][] = [];
    g.forEach((row, r) =>
      row.forEach((cell, c) => {
        if (cell === 1 && dirs.some(([dr, dc]) => g[r + dr]?.[c + dc] === 2)) {
          spread.push([r, c]);
        }
      }),
    );
    if (spread.length === 0) return g.some((row) => row.includes(1)) ? -1 : minutes;
    for (const [r, c] of spread) g[r][c] = 2;
  }
}

describe('shortestPath (TypeScript)', () => {
  it('finds the running example path', () => {
    // 3 is found from 1 first, so the path goes through 1.
    expect(shortestPath(EXAMPLE, 0, 5)).toEqual([0, 1, 3, 5]);
  });

  it('handles the edge cases', () => {
    expect(shortestPath([[]], 0, 0)).toEqual([0]);
    expect(shortestPath([[1], [0]], 0, 0)).toEqual([0]);
    expect(shortestPath([[1], [0]], 0, 1)).toEqual([0, 1]);
    expect(shortestPath([[1], [0], []], 0, 2)).toBeNull();
    expect(shortestPath([[1], []], 1, 0)).toBeNull(); // directed: no way back
    expect(shortestPath([[0, 1], [1]], 0, 1)).toEqual([0, 1]); // self-loops
  });

  it('copes with parallel edges and cycles', () => {
    expect(
      shortestPath(
        [
          [1, 1, 2],
          [0, 2],
          [0, 1],
        ],
        0,
        2,
      ),
    ).toEqual([0, 2]);
    expect(shortestPath([[1], [2], [0]], 0, 2)).toEqual([0, 1, 2]);
  });

  it('matches brute force on 50 seeded random graphs', () => {
    const seed = 11;
    const random = rng(seed);
    for (let trial = 0; trial < 50; trial++) {
      const adj = randomGraph(random);
      for (let source = 0; source < adj.length; source++) {
        const want = distances(adj, source);
        for (let target = 0; target < adj.length; target++) {
          const where = `seed ${seed}, trial ${trial}: ${JSON.stringify(adj)} ${source}->${target}`;
          const path = shortestPath(adj, source, target);
          if (!want.has(target)) {
            expect(path, where).toBeNull();
            continue;
          }
          expect(path, where).not.toBeNull();
          expect(path![0], where).toBe(source);
          expect(path![path!.length - 1], where).toBe(target);
          expect(path!.length, where).toBe(want.get(target)! + 1);
          path!.slice(1).forEach((b, i) => {
            expect(adj[path![i]].includes(b), where).toBe(true);
          });
        }
      }
    }
  });

  it('scans each vertex once', () => {
    // K5 plus an isolated vertex 5: every vertex is reachable from the others
    // by many routes, and the target never turns up. Each of the 5 vertices
    // must be popped and scanned exactly once. Marking on pop re-scans some,
    // and trying every simple path scans far more.
    const rows = [0, 1, 2, 3, 4].map((v) => [0, 1, 2, 3, 4].filter((w) => w !== v));
    const { adj, reads } = counting([...rows, []]);
    expect(shortestPath(adj, 0, 5)).toBeNull();
    expect(reads()).toBe(5);
  });

  it('stops when the target is found', () => {
    // A 100-vertex chain, target one step away: only vertex 0 is scanned.
    const rows = Array.from({ length: 100 }, (_, v) =>
      v > 0 && v < 99 ? [v - 1, v + 1] : [1],
    );
    const { adj, reads } = counting(rows);
    expect(shortestPath(adj, 0, 1)).toEqual([0, 1]);
    expect(reads()).toBe(1);
  });
});

describe('minutesToRot (TypeScript)', () => {
  it('spreads from every source at once on the running example', () => {
    expect(
      minutesToRot([
        [2, 1, 1],
        [1, 1, 0],
        [0, 1, 2],
      ]),
    ).toBe(2);
    // With only the first source, the far corner takes 4 minutes.
    expect(
      minutesToRot([
        [2, 1, 1],
        [1, 1, 0],
        [0, 1, 1],
      ]),
    ).toBe(4);
  });

  it('handles the edge cases', () => {
    expect(minutesToRot([])).toBe(0);
    expect(minutesToRot([[]])).toBe(0);
    expect(minutesToRot([[0]])).toBe(0);
    expect(minutesToRot([[2]])).toBe(0);
    expect(minutesToRot([[1]])).toBe(-1); // fresh, nothing rotten
    expect(
      minutesToRot([
        [2, 2],
        [2, 2],
      ]),
    ).toBe(0);
    expect(minutesToRot([[2, 1, 1, 1]])).toBe(3);
    expect(minutesToRot([[1], [1], [2]])).toBe(2);
    expect(minutesToRot([[2, 0, 1]])).toBe(-1); // a wall of empty cells
  });

  it('does not wrap around the edges', () => {
    expect(
      minutesToRot([
        [2, 0, 1],
        [0, 0, 0],
      ]),
    ).toBe(-1);
    expect(
      minutesToRot([
        [2, 0],
        [0, 0],
        [1, 0],
      ]),
    ).toBe(-1);
  });

  it('does not change the grid', () => {
    const grid = [
      [2, 1],
      [1, 1],
    ];
    expect(minutesToRot(grid)).toBe(2);
    expect(grid).toEqual([
      [2, 1],
      [1, 1],
    ]);
  });

  it('matches minute-by-minute simulation on 50 seeded random grids', () => {
    const seed = 13;
    const random = rng(seed);
    for (let trial = 0; trial < 50; trial++) {
      const rows = 1 + Math.floor(random() * 5);
      const cols = 1 + Math.floor(random() * 5);
      const grid = Array.from({ length: rows }, () =>
        Array.from({ length: cols }, () => [0, 1, 1, 2][Math.floor(random() * 4)]),
      );
      expect(
        minutesToRot(grid),
        `seed ${seed}, trial ${trial}: ${JSON.stringify(grid)}`,
      ).toBe(simulate(grid));
    }
  });

  it('runs one search from every source', () => {
    // The whole first column is rotten and the other 30 cells are fresh. One
    // search reads each cell about once to seed and four neighbors per popped
    // cell, so at most 5 reads per cell. A search per source repeats the
    // spread six times, about 700 reads, and repeated queuing of a cell
    // (marking on pop) also exceeds the bound.
    const { grid, reads } = countingGrid(
      Array.from({ length: 6 }, () => [2, 1, 1, 1, 1, 1]),
    );
    expect(minutesToRot(grid)).toBe(5);
    expect(reads()).toBeGreaterThanOrEqual(36);
    expect(reads()).toBeLessThanOrEqual(5 * 36);
  });
});
