/** Disjoint sets over the elements 0..n-1: union by size, path compression. */
export class UnionFind {
  private readonly parent: Int32Array;
  private readonly sizes: Int32Array;
  private sets: number;

  constructor(n: number) {
    if (!Number.isInteger(n) || n < 0) {
      throw new RangeError('n must be a non-negative integer');
    }
    this.parent = Int32Array.from({ length: n }, (_, i) => i);
    this.sizes = new Int32Array(n).fill(1);
    this.sets = n;
  }

  /** The number of separate sets. */
  get count(): number {
    return this.sets;
  }

  find(x: number): number {
    if (!Number.isInteger(x) || x < 0 || x >= this.parent.length) {
      throw new RangeError(`element ${x} is out of range`);
    }
    let root = x;
    while (this.parent[root] !== root) root = this.parent[root];
    let node = x;
    while (node !== root) {
      const next = this.parent[node];
      this.parent[node] = root;
      node = next;
    }
    return root;
  }

  union(a: number, b: number): boolean {
    let rootA = this.find(a);
    let rootB = this.find(b);
    if (rootA === rootB) return false;
    if (this.sizes[rootA] < this.sizes[rootB]) [rootA, rootB] = [rootB, rootA];
    this.parent[rootB] = rootA;
    this.sizes[rootA] += this.sizes[rootB];
    this.sets--;
    return true;
  }

  connected(a: number, b: number): boolean {
    return this.find(a) === this.find(b);
  }

  sizeOf(x: number): number {
    return this.sizes[this.find(x)];
  }
}

export function countComponents(n: number, edges: Iterable<[number, number]>): number {
  const sets = new UnionFind(n);
  for (const [a, b] of edges) sets.union(a, b);
  return sets.count;
}

export function hasCycle(n: number, edges: Iterable<[number, number]>): boolean {
  const sets = new UnionFind(n);
  for (const [a, b] of edges) {
    if (!sets.union(a, b)) return true;
  }
  return false;
}
