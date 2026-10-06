/** An undirected weighted edge: [u, v, weight], with vertices numbered 0..n-1. */
export type Edge = [u: number, v: number, weight: number];

/** heap.ts's MinHeap without heapify, peek or empty checks: test `size` first. */
class MinHeap<T> {
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

/** A minimum spanning tree as a list of edges, or null if disconnected. */
export function kruskal(n: number, edges: Iterable<Edge>): Edge[] | null {
  const parent = Array.from({ length: n }, (_, i) => i);
  const size = new Array<number>(n).fill(1);

  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]]; // halving: point at the grandparent
      x = parent[x];
    }
    return x;
  };

  const chosen: Edge[] = [];
  for (const edge of [...edges].sort((a, b) => a[2] - b[2])) {
    let rootU = find(edge[0]);
    let rootV = find(edge[1]);
    // Roots, not u and v: 0 and 1 can already be linked through 2.
    if (rootU === rootV) continue;
    if (size[rootU] < size[rootV]) [rootU, rootV] = [rootV, rootU]; // shallow trees
    parent[rootV] = rootU;
    size[rootU] += size[rootV];
    chosen.push(edge);
    // A tree has no room for more, and every edge left would close a cycle.
    if (chosen.length === n - 1) break;
  }
  return chosen.length === Math.max(n - 1, 0) ? chosen : null;
}

/** A minimum spanning tree grown from vertex 0, or null if disconnected. */
export function prim(n: number, edges: Iterable<Edge>): Edge[] | null {
  if (n === 0) return []; // adjacent[0] below would not exist
  const adjacent: Edge[][] = Array.from({ length: n }, () => []);
  for (const [u, v, w] of edges) {
    // Both ends: an edge stored once is a one-way street, and Prim would
    // miss vertices behind it.
    adjacent[u].push([u, v, w]);
    adjacent[v].push([v, u, w]);
  }

  const inTree = new Array<boolean>(n).fill(false);
  inTree[0] = true;
  const heap = new MinHeap<Edge>((a, b) => a[2] < b[2]);
  for (const edge of adjacent[0]) heap.push(edge);
  const chosen: Edge[] = [];
  while (heap.size > 0 && chosen.length < n - 1) {
    const edge = heap.pop();
    const v = edge[1];
    // Stale: a cheaper edge already brought v in, and this one would
    // close a cycle. Edges are never removed from the heap, only skipped.
    if (inTree[v]) continue;
    inTree[v] = true;
    chosen.push(edge);
    for (const next of adjacent[v]) {
      if (!inTree[next[1]]) heap.push(next); // an edge back into the tree is never used
    }
  }
  return chosen.length === n - 1 ? chosen : null;
}
