import { describe, expect, it } from 'vitest';
import {
  allVertices,
  courseOrder,
  topologicalSort,
  topologicalSortDfs,
  type Graph,
} from './topological-sort';

const sorts = [topologicalSort, topologicalSortDfs];

function graphOf(edges: Record<number, number[]>): Graph {
  return new Map(Object.entries(edges).map(([key, targets]) => [Number(key), targets]));
}

function vertexSet(graph: Graph): number[] {
  const all = new Set(graph.keys());
  for (const targets of graph.values()) for (const t of targets) all.add(t);
  return [...all].sort((a, b) => a - b);
}

/** Every vertex exactly once, and every edge goes from earlier to later. */
function isValid(graph: Graph, order: number[]): boolean {
  if (
    JSON.stringify([...order].sort((a, b) => a - b)) !== JSON.stringify(vertexSet(graph))
  ) {
    return false;
  }
  const position = new Map(order.map((vertex, i) => [vertex, i]));
  for (const [u, targets] of graph) {
    for (const v of targets) if (position.get(u)! >= position.get(v)!) return false;
  }
  return true;
}

function* permutations(items: number[]): Generator<number[]> {
  if (items.length <= 1) {
    yield items;
    return;
  }
  for (let i = 0; i < items.length; i++) {
    const rest = [...items.slice(0, i), ...items.slice(i + 1)];
    for (const tail of permutations(rest)) yield [items[i], ...tail];
  }
}

function someOrderExists(graph: Graph): boolean {
  for (const p of permutations(vertexSet(graph))) if (isValid(graph, p)) return true;
  return false;
}

function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

function randomGraph(random: () => number, acyclic: boolean): Graph {
  const n = Math.floor(random() * 7);
  const ranks = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [ranks[i], ranks[j]] = [ranks[j], ranks[i]];
  }
  const graph: Graph = new Map();
  for (let u = 0; u < n; u++) {
    if (random() < 0.15) continue; // not a key: it can only appear as a target
    const targets: number[] = [];
    for (let v = 0; v < n; v++) {
      if (random() < 0.3 && (!acyclic || ranks[u] < ranks[v])) targets.push(v);
    }
    graph.set(u, targets);
  }
  return graph;
}

describe('topological sort (TypeScript)', () => {
  it('handles the empty graph', () => {
    for (const sort of sorts) expect(sort(new Map())).toEqual([]);
  });

  it('handles a single vertex and isolated vertices', () => {
    for (const sort of sorts) {
      expect(sort(graphOf({ 7: [] }))).toEqual([7]);
    }
    // Reversing the finishing order also reverses the order of separate starts.
    const isolated: Graph = new Map([
      [3, []],
      [1, []],
      [2, []],
    ]);
    expect(topologicalSort(isolated)).toEqual([3, 1, 2]);
    expect(topologicalSortDfs(isolated)).toEqual([2, 1, 3]);
  });

  it('reports a self-loop as a cycle', () => {
    for (const sort of sorts) {
      expect(sort(graphOf({ 1: [1] }))).toBeNull();
      expect(sort(graphOf({ 0: [], 1: [1] }))).toBeNull();
    }
  });

  it('reports a two-cycle and a cycle behind a valid start', () => {
    for (const sort of sorts) {
      expect(sort(graphOf({ 1: [2], 2: [1] }))).toBeNull();
      expect(sort(graphOf({ 0: [1], 1: [2], 2: [3], 3: [1] }))).toBeNull();
    }
  });

  it('includes a vertex that appears only as a target', () => {
    for (const sort of sorts) expect(sort(graphOf({ 1: [2] }))).toEqual([1, 2]);
    expect(allVertices(graphOf({ 1: [2, 3], 4: [3, 5] }))).toEqual([1, 4, 2, 3, 5]);
    expect(topologicalSort(graphOf({ 2: [9] }))).toEqual([2, 9]);
  });

  it('does not report the diamond as a cycle', () => {
    const graph = graphOf({ 0: [1, 2], 1: [3], 2: [3], 3: [] });
    for (const sort of sorts) expect(isValid(graph, sort(graph)!)).toBe(true);
  });

  it('tolerates duplicate edges', () => {
    const graph = graphOf({ 0: [1, 1], 1: [2] });
    for (const sort of sorts) expect(sort(graph)).toEqual([0, 1, 2]);
  });

  it('follows the documented tie rules exactly', () => {
    const graph = graphOf({ 0: [2, 1], 1: [3], 2: [3], 3: [] });
    expect(topologicalSort(graph)).toEqual([0, 2, 1, 3]);
    expect(topologicalSortDfs(graph)).toEqual([0, 1, 2, 3]);
    expect(isValid(graph, [0, 2, 1, 3]) && isValid(graph, [0, 1, 2, 3])).toBe(true);
  });

  it('accepts every order of a graph with no edges', () => {
    const graph = graphOf({ 0: [], 1: [], 2: [] });
    for (const p of permutations([0, 1, 2])) expect(isValid(graph, p)).toBe(true);
  });

  it('sorts a long chain without overflowing the call stack', () => {
    const n = 50_000;
    const graph: Graph = new Map();
    for (let i = 0; i < n; i++) graph.set(i, [i + 1]);
    const expected = Array.from({ length: n + 1 }, (_, i) => i);
    for (const sort of sorts) expect(sort(graph)).toEqual(expected);
  });

  it('agrees with brute force on many seeded random graphs', () => {
    const random = seededRandom(2024);
    let sawCycle = false;
    let sawOrder = false;
    for (let i = 0; i < 600; i++) {
      const graph = randomGraph(random, i % 2 === 0);
      const exists = someOrderExists(graph);
      for (const sort of sorts) {
        const order = sort(graph);
        if (exists) {
          expect(order, JSON.stringify([...graph])).not.toBeNull();
          expect(isValid(graph, order!), JSON.stringify([...graph])).toBe(true);
        } else {
          expect(order, JSON.stringify([...graph])).toBeNull();
        }
      }
      if (exists) sawOrder = true;
      else sawCycle = true;
    }
    expect(sawOrder && sawCycle).toBe(true);
  });

  it('always sorts random acyclic graphs', () => {
    const random = seededRandom(7);
    for (let i = 0; i < 300; i++) {
      const graph = randomGraph(random, true);
      for (const sort of sorts) expect(isValid(graph, sort(graph)!)).toBe(true);
    }
  });

  it('orders courses from (course, prerequisite) pairs', () => {
    expect(courseOrder(0, [])).toEqual([]);
    expect(courseOrder(3, [])).toEqual([0, 1, 2]);
    expect(courseOrder(2, [[1, 0]])).toEqual([0, 1]);
    expect(
      courseOrder(2, [
        [1, 0],
        [0, 1],
      ]),
    ).toBeNull();
    expect(courseOrder(1, [[0, 0]])).toBeNull();
    expect(
      courseOrder(4, [
        [1, 0],
        [2, 0],
        [3, 1],
        [3, 2],
      ]),
    ).toEqual([0, 1, 2, 3]);
  });

  it('agrees with brute force on random course pairs', () => {
    const random = seededRandom(99);
    for (let i = 0; i < 300; i++) {
      const n = Math.floor(random() * 7);
      const count = n === 0 ? 0 : Math.floor(random() * 9);
      const pairs: [number, number][] = [];
      for (let k = 0; k < count; k++) {
        pairs.push([Math.floor(random() * n), Math.floor(random() * n)]);
      }
      const graph: Graph = new Map();
      for (let c = 0; c < n; c++) graph.set(c, []);
      for (const [course, prerequisite] of pairs) graph.get(prerequisite)!.push(course);
      const order = courseOrder(n, pairs);
      if (someOrderExists(graph)) expect(isValid(graph, order!)).toBe(true);
      else expect(order).toBeNull();
    }
  });
});
