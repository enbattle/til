/** A binary min-heap on an array: `less(a, b)` says a belongs nearer the root. */
export class MinHeap<T> {
  private readonly items: T[] = [];
  private readonly less: (a: T, b: T) => boolean;

  constructor(less: (a: T, b: T) => boolean) {
    this.less = less;
  }

  get size(): number {
    return this.items.length;
  }

  push(item: T): void {
    this.items.push(item);
    this.siftUp(this.items.length - 1);
  }

  /** Removes and returns the root, or undefined if the heap is empty. */
  pop(): T | undefined {
    if (this.items.length === 0) return undefined;
    const top = this.items[0];
    const last = this.items.pop()!;
    if (this.items.length > 0) {
      this.items[0] = last;
      this.siftDown(0);
    }
    return top;
  }

  private siftUp(start: number): void {
    let i = start;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.less(this.items[i], this.items[parent])) return;
      [this.items[i], this.items[parent]] = [this.items[parent], this.items[i]];
      i = parent;
    }
  }

  private siftDown(start: number): void {
    const items = this.items;
    let i = start;
    for (;;) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = left + 1;
      if (left < items.length && this.less(items[left], items[smallest])) {
        smallest = left;
      }
      if (right < items.length && this.less(items[right], items[smallest])) {
        smallest = right;
      }
      if (smallest === i) return;
      [items[i], items[smallest]] = [items[smallest], items[i]];
      i = smallest;
    }
  }
}

/** Each vertex maps to its outgoing edges as [neighbour, weight] pairs. */
export type Graph = Map<number, [number, number][]>;

type Entry = [distance: number, vertex: number];

/**
 * Cheapest cost from `source` to every vertex reachable from it, and each
 * vertex's parent on a cheapest route. Edge weights must not be negative.
 */
export function dijkstra(
  graph: Graph,
  source: number,
): [Map<number, number>, Map<number, number | null>] {
  const dist = new Map<number, number>([[source, 0]]);
  const parent = new Map<number, number | null>([[source, null]]);
  const heap = new MinHeap<Entry>((a, b) => a[0] < b[0]);
  heap.push([0, source]);
  while (heap.size > 0) {
    const [d, v] = heap.pop()!;
    if (d > dist.get(v)!) continue;
    for (const [w, weight] of graph.get(v) ?? []) {
      const nd = d + weight;
      const known = dist.get(w);
      if (known === undefined || nd < known) {
        dist.set(w, nd);
        parent.set(w, v);
        heap.push([nd, w]);
      }
    }
  }
  return [dist, parent];
}

/** A cheapest route from `source` to `target` as a list of vertices, or null. */
export function shortestPath(
  graph: Graph,
  source: number,
  target: number,
): number[] | null {
  const [, parent] = dijkstra(graph, source);
  if (!parent.has(target)) return null;
  const path: number[] = [];
  let node: number | null = target;
  while (node !== null) {
    path.push(node);
    node = parent.get(node)!;
  }
  return path.reverse();
}
