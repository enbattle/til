/** An undirected weighted edge: [u, v, weight], with vertices numbered 0..n-1. */
export type Edge = [u: number, v: number, weight: number];

/** A binary min-heap on an array: `less(a, b)` says a belongs nearer the root. */
class MinHeap<T> {
  private readonly items: T[] = [];

  constructor(private readonly less: (a: T, b: T) => boolean) {}

  get size(): number {
    return this.items.length;
  }

  push(item: T): void {
    const items = this.items;
    items.push(item);
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.less(items[i], items[parent])) break;
      [items[i], items[parent]] = [items[parent], items[i]];
      i = parent;
    }
  }

  /** Removes and returns the root. The heap must not be empty. */
  pop(): T {
    const items = this.items;
    const top = items[0];
    const last = items.pop()!;
    if (items.length > 0) {
      items[0] = last;
      let i = 0;
      for (;;) {
        let smallest = i;
        const left = 2 * i + 1;
        const right = left + 1;
        if (left < items.length && this.less(items[left], items[smallest]))
          smallest = left;
        if (right < items.length && this.less(items[right], items[smallest])) {
          smallest = right;
        }
        if (smallest === i) break;
        [items[i], items[smallest]] = [items[smallest], items[i]];
        i = smallest;
      }
    }
    return top;
  }
}

/** A minimum spanning tree as a list of edges, or null if the graph is disconnected. */
export function kruskal(n: number, edges: Iterable<Edge>): Edge[] | null {
  const parent = Array.from({ length: n }, (_, i) => i);
  const size = new Array<number>(n).fill(1);

  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]]; // path halving
      x = parent[x];
    }
    return x;
  };

  const chosen: Edge[] = [];
  for (const edge of [...edges].sort((a, b) => a[2] - b[2])) {
    let rootU = find(edge[0]);
    let rootV = find(edge[1]);
    if (rootU === rootV) continue;
    if (size[rootU] < size[rootV]) [rootU, rootV] = [rootV, rootU];
    parent[rootV] = rootU;
    size[rootU] += size[rootV];
    chosen.push(edge);
    if (chosen.length === n - 1) break;
  }
  return chosen.length === Math.max(n - 1, 0) ? chosen : null;
}

/** A minimum spanning tree grown from `start`, or null if the graph is disconnected. */
export function prim(n: number, edges: Iterable<Edge>, start = 0): Edge[] | null {
  if (n === 0) return [];
  const adjacent: Edge[][] = Array.from({ length: n }, () => []);
  for (const [u, v, w] of edges) {
    adjacent[u].push([u, v, w]);
    adjacent[v].push([v, u, w]);
  }

  const inTree = new Array<boolean>(n).fill(false);
  inTree[start] = true;
  const heap = new MinHeap<Edge>((a, b) => a[2] < b[2]);
  for (const edge of adjacent[start]) heap.push(edge);
  const chosen: Edge[] = [];
  while (heap.size > 0 && chosen.length < n - 1) {
    const edge = heap.pop();
    const v = edge[1];
    if (inTree[v]) continue; // a cheaper edge already brought v in
    inTree[v] = true;
    chosen.push(edge);
    for (const next of adjacent[v]) {
      if (!inTree[next[1]]) heap.push(next);
    }
  }
  return chosen.length === n - 1 ? chosen : null;
}

export function totalWeight(tree: Iterable<Edge>): number {
  let total = 0;
  for (const [, , w] of tree) total += w;
  return total;
}
