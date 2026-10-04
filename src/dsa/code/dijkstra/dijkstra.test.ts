import { describe, expect, it } from 'vitest';
import { dijkstra, MinHeap, shortestPath, type Graph } from './dijkstra';

// API: `dijkstra(graph, source)` returns `[dist, parent]` Maps holding only the
// vertices reachable from `source`; `shortestPath(graph, source, target)` returns
// a list of vertices or null. A graph maps a vertex to [neighbour, weight] pairs.
// The reference is a brute-force relaxation: lower every distance along every
// edge until nothing changes.

function graphOf(entries: [number, [number, number][]][]): Graph {
  return new Map(entries);
}

function relaxUntilStable(graph: Graph, source: number): Map<number, number> {
  const dist = new Map<number, number>([[source, 0]]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [v, edges] of graph) {
      const dv = dist.get(v);
      if (dv === undefined) continue;
      for (const [w, weight] of edges) {
        const known = dist.get(w);
        if (known === undefined || dv + weight < known) {
          dist.set(w, dv + weight);
          changed = true;
        }
      }
    }
  }
  return dist;
}

function makeRandom(start: number): () => number {
  let seed = start;
  return () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
}

function randomGraph(seed: number): [Graph, number] {
  const random = makeRandom(seed);
  const int = (low: number, high: number) =>
    low + Math.floor(random() * (high - low + 1));
  const n = int(1, 9);
  const graph: Graph = new Map();
  for (let v = 0; v < n; v++) if (random() < 0.9) graph.set(v, []);
  const edgeCount = int(0, 3 * n);
  for (let i = 0; i < edgeCount; i++) {
    // Endpoints are drawn independently, so self-loops and parallel edges both
    // occur; weights include 0.
    const v = int(0, n - 1);
    const w = int(0, n - 1);
    if (!graph.has(v)) graph.set(v, []);
    graph.get(v)!.push([w, int(0, 9)]);
  }
  return [graph, int(0, n - 1)];
}

/** The cost of a route, taking the cheapest of any parallel edges. */
function routeCost(graph: Graph, path: number[]): number {
  let total = 0;
  for (let i = 0; i + 1 < path.length; i++) {
    const weights = graph
      .get(path[i])!
      .filter(([nb]) => nb === path[i + 1])
      .map(([, wt]) => wt);
    total += Math.min(...weights);
  }
  return total;
}

function toObject(m: Map<number, number | null>): Record<number, number | null> {
  return Object.fromEntries(m);
}

describe('dijkstra (TypeScript)', () => {
  it('handles the source alone', () => {
    for (const graph of [graphOf([]), graphOf([[7, []]])]) {
      const [dist, parent] = dijkstra(graph, 7);
      expect(toObject(dist)).toEqual({ 7: 0 });
      expect(toObject(parent)).toEqual({ 7: null });
    }
    expect(shortestPath(graphOf([[7, []]]), 7, 7)).toEqual([7]);
  });

  it('solves the worked example from the entry', () => {
    const graph = graphOf([
      [
        0,
        [
          [1, 4],
          [2, 1],
        ],
      ],
      [1, [[3, 1]]],
      [
        2,
        [
          [1, 2],
          [3, 5],
        ],
      ],
      [3, []],
      [4, [[3, 1]]],
    ]);
    const [dist, parent] = dijkstra(graph, 0);
    expect(toObject(dist)).toEqual({ 0: 0, 1: 3, 2: 1, 3: 4 });
    expect(toObject(parent)).toEqual({ 0: null, 1: 2, 2: 0, 3: 1 });
    expect(shortestPath(graph, 0, 3)).toEqual([0, 2, 1, 3]);
  });

  it('leaves unreachable vertices out', () => {
    const graph = graphOf([
      [0, [[1, 5]]],
      [1, []],
      [2, [[0, 1]]],
    ]);
    const [dist, parent] = dijkstra(graph, 0);
    expect(toObject(dist)).toEqual({ 0: 0, 1: 5 });
    expect(parent.has(2)).toBe(false);
    expect(shortestPath(graph, 0, 2)).toBeNull();
    expect(shortestPath(graph, 0, 99)).toBeNull();
  });

  it('treats edges as directed', () => {
    const graph = graphOf([
      [0, [[1, 1]]],
      [1, []],
    ]);
    expect(toObject(dijkstra(graph, 1)[0])).toEqual({ 1: 0 });
  });

  it('handles zero-weight edges and a zero-weight cycle', () => {
    const graph = graphOf([
      [0, [[1, 0]]],
      [
        1,
        [
          [2, 0],
          [0, 0],
        ],
      ],
      [
        2,
        [
          [1, 0],
          [3, 4],
        ],
      ],
      [3, []],
    ]);
    expect(toObject(dijkstra(graph, 0)[0])).toEqual({ 0: 0, 1: 0, 2: 0, 3: 4 });
    expect(shortestPath(graph, 0, 3)).toEqual([0, 1, 2, 3]);
  });

  it('uses the cheapest of parallel edges', () => {
    const graph = graphOf([
      [
        0,
        [
          [1, 9],
          [1, 3],
          [1, 5],
        ],
      ],
      [1, []],
    ]);
    expect(toObject(dijkstra(graph, 0)[0])).toEqual({ 0: 0, 1: 3 });
  });

  it('ignores self-loops', () => {
    const graph = graphOf([
      [
        0,
        [
          [0, 0],
          [0, 5],
          [1, 2],
        ],
      ],
      [1, [[1, 1]]],
    ]);
    const [dist, parent] = dijkstra(graph, 0);
    expect(toObject(dist)).toEqual({ 0: 0, 1: 2 });
    expect(toObject(parent)).toEqual({ 0: null, 1: 0 });
  });

  it('prefers a cheaper route with more edges', () => {
    const graph = graphOf([
      [
        0,
        [
          [2, 10],
          [1, 1],
        ],
      ],
      [1, [[2, 1]]],
      [2, []],
    ]);
    expect(dijkstra(graph, 0)[0].get(2)).toBe(2);
    expect(shortestPath(graph, 0, 2)).toEqual([0, 1, 2]);
  });

  it('returns just the source as the path to the source', () => {
    const graph = graphOf([
      [0, [[1, 1]]],
      [1, [[0, 1]]],
    ]);
    expect(shortestPath(graph, 0, 0)).toEqual([0]);
  });

  it('builds a path that passes through vertex 0', () => {
    const graph = graphOf([
      [5, [[0, 1]]],
      [0, [[3, 1]]],
      [3, []],
    ]);
    expect(shortestPath(graph, 5, 3)).toEqual([5, 0, 3]);
  });

  it('is repaired by the stale check on the entry negative-edge example', () => {
    // Out of contract. The settle-on-first-pop textbook version would report 2
    // for vertex 1; this code ends with the true cost 1.
    const graph = graphOf([
      [
        0,
        [
          [1, 2],
          [2, 3],
        ],
      ],
      [1, []],
      [2, [[1, -2]]],
    ]);
    expect(toObject(dijkstra(graph, 0)[0])).toEqual({ 0: 0, 1: 1, 2: 3 });
  });

  it('matches brute-force relaxation on many seeded random graphs', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const [graph, source] = randomGraph(seed);
      const [dist, parent] = dijkstra(graph, source);
      expect(dist, `seed ${seed}`).toEqual(relaxUntilStable(graph, source));
      expect([...parent.keys()].sort(), `seed ${seed}`).toEqual([...dist.keys()].sort());
      for (const [v, cost] of dist) {
        const path = shortestPath(graph, source, v)!;
        expect(path[0], `seed ${seed}, vertex ${v}`).toBe(source);
        expect(path[path.length - 1], `seed ${seed}, vertex ${v}`).toBe(v);
        expect(routeCost(graph, path), `seed ${seed}, vertex ${v}`).toBe(cost);
        expect(new Set(path).size, `seed ${seed}: repeats a vertex`).toBe(path.length);
      }
    }
  });
});

describe('MinHeap (TypeScript)', () => {
  it('pops in sorted order and returns undefined when empty', () => {
    const heap = new MinHeap<number>((a, b) => a < b);
    expect(heap.pop()).toBeUndefined();
    const random = makeRandom(3);
    const values = Array.from({ length: 200 }, () => Math.floor(random() * 50));
    for (const value of values) heap.push(value);
    expect(heap.size).toBe(200);
    const popped: number[] = [];
    while (heap.size > 0) popped.push(heap.pop()!);
    expect(popped).toEqual([...values].sort((a, b) => a - b));
  });
});
