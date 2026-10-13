// #region edge-type
import { MinHeap } from '../heap/heap';

/** An undirected weighted edge: [u, v, weight], with vertices numbered 0..n-1. */
export type Edge = [number, number, number];
// #endregion

// #region find
function find(parent: number[], x: number): number {
  while (parent[x] !== x) {
    parent[x] = parent[parent[x]]; // halving: point at the grandparent
    x = parent[x];
  }
  return x;
}
// #endregion

// #region kruskal
/** A minimum spanning tree as a list of edges, or null if disconnected. */
export function kruskal(n: number, edges: Edge[]): Edge[] | null {
  const parent: number[] = [];
  const size: number[] = [];
  for (let i = 0; i < n; i++) {
    parent.push(i);
    size.push(1);
  }
  const sorted = edges.slice();
  sorted.sort((a, b) => a[2] - b[2]);
  const chosen: Edge[] = [];
  for (const edge of sorted) {
    let rootU = find(parent, edge[0]);
    let rootV = find(parent, edge[1]);
    // Roots, not u and v: 0 and 1 can already be linked through 2.
    if (rootU === rootV) continue;
    if (size[rootU] < size[rootV]) [rootU, rootV] = [rootV, rootU]; // shallow trees
    parent[rootV] = rootU;
    size[rootU] += size[rootV];
    chosen.push(edge);
    // A tree has no room for more, and every edge left would close a cycle.
    if (chosen.length === n - 1) break;
  }
  if (chosen.length < n - 1) return null;
  return chosen;
}
// #endregion

// #region adjacency-list
export function prim(n: number, edges: Edge[]): Edge[] | null {
  if (n === 0) return []; // adjacent[0] below would not exist
  const adjacent: number[][][] = [];
  for (let i = 0; i < n; i++) {
    adjacent.push([]);
  }
  for (const [u, v, w] of edges) {
    // Weight first, so the heap orders by it. Both ends: an edge stored
    // once is a one-way street, and Prim would miss vertices behind it.
    adjacent[u].push([w, u, v]);
    adjacent[v].push([w, v, u]);
  }
  // #endregion

  // #region prim-loop
  const inTree: boolean[] = [];
  for (let i = 0; i < n; i++) {
    inTree.push(false);
  }
  inTree[0] = true;
  const heap = new MinHeap();
  for (const edge of adjacent[0]) {
    heap.push(edge);
  }
  const chosen: Edge[] = [];
  while (heap.size() > 0 && chosen.length < n - 1) {
    const [w, u, v] = heap.pop();
    // Stale: a cheaper edge already brought v in, and this one would
    // close a cycle. Edges are never removed from the heap, only skipped.
    if (inTree[v]) continue;
    inTree[v] = true;
    chosen.push([u, v, w]);
    for (const edge of adjacent[v]) {
      const nextTo = edge[2];
      if (!inTree[nextTo]) heap.push(edge); // an edge back into the tree is never used
    }
  }
  if (chosen.length < n - 1) return null;
  return chosen;
}
// #endregion
