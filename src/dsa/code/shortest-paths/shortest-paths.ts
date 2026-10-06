/** heap.ts's MinHeap without heapify or empty checks: callers test `size` first. */
export class MinHeap<T> {
  private readonly items: T[] = [];

  constructor(private readonly less: (a: T, b: T) => boolean) {}

  get size(): number {
    return this.items.length;
  }

  push(item: T): void {
    const a = this.items;
    a.push(item);
    for (let i = a.length - 1; i > 0;) {
      const parent = (i - 1) >> 1;
      if (!this.less(a[i], a[parent])) return;
      [a[i], a[parent]] = [a[parent], a[i]];
      i = parent;
    }
  }

  pop(): T {
    const a = this.items;
    const top = a[0];
    const last = a.pop() as T;
    if (a.length === 0) return top; // a[0] = last would refill the emptied array
    a[0] = last;
    for (let i = 0, c = 1; c < a.length; c = 2 * i + 1) {
      if (c + 1 < a.length && this.less(a[c + 1], a[c])) c++; // the smaller child
      if (!this.less(a[c], a[i])) break;
      [a[i], a[c]] = [a[c], a[i]];
      i = c;
    }
    return top;
  }
}

/** graph[u] holds a [v, weight] pair per edge. */
export type Graph = [number, number][][];

/** Cheapest cost from source to every vertex, Infinity if unreachable.
 * Weights must not be negative. */
export function dijkstra(graph: Graph, source: number): number[] {
  const dist = new Array<number>(graph.length).fill(Infinity);
  dist[source] = 0;
  const heap = new MinHeap<[number, number]>((a, b) => a[0] < b[0]);
  heap.push([0, source]);
  while (heap.size > 0) {
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
