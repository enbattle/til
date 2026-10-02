/** A directed edge from vertex u to vertex v with a weight, as [u, v, weight]. */
export type Edge = [u: number, v: number, weight: number];

/**
 * Shortest distances from `source` over directed edges, vertices 0 to n - 1.
 * Unreachable vertices get Infinity. Returns null if a negative cycle is
 * reachable from `source`, since distances are then undefined.
 */
export function bellmanFord(n: number, edges: Edge[], source: number): number[] | null {
  if (!Number.isInteger(source) || source < 0 || source >= n) {
    throw new RangeError('source must be a vertex from 0 to n - 1');
  }
  const dist: number[] = new Array<number>(n).fill(Infinity);
  dist[source] = 0;
  for (let round = 0; round < n - 1; round++) {
    let changed = false;
    for (const [u, v, w] of edges) {
      if (dist[u] + w < dist[v]) {
        dist[v] = dist[u] + w;
        changed = true;
      }
    }
    if (!changed) return dist;
  }
  for (const [u, v, w] of edges) {
    if (dist[u] + w < dist[v]) return null;
  }
  return dist;
}
