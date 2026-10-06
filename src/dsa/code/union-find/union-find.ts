/** Disjoint sets over the elements 0..n-1: union by size, path compression. */
export class UnionFind {
  private readonly parent: Int32Array;
  private readonly sizes: Int32Array;
  count: number;

  constructor(n: number) {
    // A root is its own parent.
    this.parent = Int32Array.from({ length: n }, (_, i) => i);
    this.sizes = new Int32Array(n).fill(1); // read only at roots; others go stale
    // Kept up to date, so asking never means calling find on every element.
    this.count = n;
  }

  find(x: number): number {
    // An Int32Array read past its end gives undefined, not an error, and two
    // of them compare equal: connected(10, 11) would quietly say true.
    if (!Number.isInteger(x) || x < 0 || x >= this.parent.length) {
      throw new RangeError(`element ${x} is out of range`);
    }
    let root = x;
    while (this.parent[root] !== root) root = this.parent[root];
    // A second walk, because the root isn't known until the first ends.
    let node = x;
    while (node !== root) {
      const next = this.parent[node]; // saved first: after the write, node's old
      this.parent[node] = root; // parent is gone and the walk would stop
      node = next;
    }
    return root;
  }

  union(a: number, b: number): boolean {
    let rootA = this.find(a);
    let rootB = this.find(b);
    if (rootA === rootB) return false; // merging a set with itself would double its size
    if (this.sizes[rootA] < this.sizes[rootB]) {
      [rootA, rootB] = [rootB, rootA]; // smaller under larger: depth <= log2 n
    }
    this.parent[rootB] = rootA; // the root, not b: only a root speaks for its set
    this.sizes[rootA] += this.sizes[rootB];
    this.count--;
    return true;
  }

  connected(a: number, b: number): boolean {
    return this.find(a) === this.find(b);
  }

  sizeOf(x: number): number {
    return this.sizes[this.find(x)];
  }
}

export function hasCycle(n: number, edges: Iterable<[number, number]>): boolean {
  const sets = new UnionFind(n);
  for (const [a, b] of edges) {
    // An edge whose ends are already connected is a second way across.
    if (!sets.union(a, b)) return true;
  }
  return false;
}
