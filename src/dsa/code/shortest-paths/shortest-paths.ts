// #region graph
import { MinHeap } from '../heap/heap';

/** graph[u] holds a [v, weight] pair per edge. */
export type Graph = number[][][];
// #endregion

// #region dijkstra
/** Cheapest cost from source to every vertex, Infinity if unreachable.
 * Weights must not be negative. */
export function dijkstra(graph: Graph, source: number): number[] {
  const dist = new Array<number>(graph.length).fill(Infinity);
  dist[source] = 0;
  const heap = new MinHeap();
  heap.push([0, source]);
  while (heap.size() > 0) {
    const [d, u] = heap.pop();
    // A heap can't lower an entry in place, so an improved vertex is pushed
    // again and its older, higher entry is skipped when it surfaces.
    if (d > dist[u]) continue;
    for (const [v, w] of graph[u]) {
      // Strict: with <=, a zero-weight cycle would push forever.
      if (d + w < dist[v]) {
        dist[v] = d + w;
        heap.push([d + w, v]);
      }
    }
  }
  return dist;
}
// #endregion

// #region bellman-ford
/** Cheapest cost from source to every vertex, Infinity if unreachable, or null
 * if a negative cycle is reachable from source. Weights may be negative. */
export function bellmanFord(graph: Graph, source: number): number[] | null {
  const n = graph.length;
  const dist = new Array<number>(n).fill(Infinity);
  dist[source] = 0;
  // Round k fixes every cheapest route of k edges, and a route has at most
  // n - 1 edges, so a change in round n can only come from a negative cycle.
  for (let round = 0; round < n; round++) {
    let changed = false;
    for (let u = 0; u < n; u++) {
      for (const [v, w] of graph[u]) {
        // Infinity + w is Infinity, so a vertex not reached yet relaxes nothing.
        if (dist[u] + w < dist[v]) {
          dist[v] = dist[u] + w;
          changed = true;
        }
      }
    }
    // A round with no change leaves the next one unchanged too.
    if (!changed) return dist;
  }
  return null;
}
// #endregion
