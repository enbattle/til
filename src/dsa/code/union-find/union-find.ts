// #region setup
/** Disjoint sets over the elements 0..n-1: union by size, path compression. */
export class UnionFind {
  parent: number[] = [];
  sizes: number[] = [];
  count: number;

  constructor(n: number) {
    for (let i = 0; i < n; i++) {
      this.parent.push(i); // a root is its own parent
      this.sizes.push(1); // read only at roots; other entries go stale
    }
    // Kept up to date, so asking never means calling find on every element.
    this.count = n;
  }
  // #endregion

  // #region find
  find(x: number): number {
    let root = x;
    while (this.parent[root] !== root) {
      root = this.parent[root];
    }
    // A second walk, because the root isn't known until the first ends.
    while (x !== root) {
      const nextX = this.parent[x]; // saved first: after the write, x's old
      this.parent[x] = root; // parent is gone and the walk would stop
      x = nextX;
    }
    return root;
  }
  // #endregion

  // #region union
  union(a: number, b: number): boolean {
    let rootA = this.find(a);
    let rootB = this.find(b);
    if (rootA === rootB) {
      return false; // merging a set with itself would double its size
    }
    if (this.sizes[rootA] < this.sizes[rootB]) {
      [rootA, rootB] = [rootB, rootA]; // smaller under larger: depth <= log2 n
    }
    this.parent[rootB] = rootA; // the root, not b: only a root speaks for its set
    this.sizes[rootA] += this.sizes[rootB];
    this.count -= 1;
    return true;
  }
  // #endregion

  // #region connected
  connected(a: number, b: number): boolean {
    return this.find(a) === this.find(b);
  }

  sizeOf(x: number): number {
    return this.sizes[this.find(x)];
  }
}
// #endregion

// #region has-cycle
export function hasCycle(n: number, edges: [number, number][]): boolean {
  const sets = new UnionFind(n);
  for (const [a, b] of edges) {
    // An edge whose ends are already connected is a second way across.
    if (!sets.union(a, b)) {
      return true;
    }
  }
  return false;
}
// #endregion
