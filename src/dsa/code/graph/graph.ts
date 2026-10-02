/** Removes the first copy of `item` from `list`, which must contain it. */
function removeOne<T>(list: T[], item: T): void {
  list.splice(list.indexOf(item), 1);
}

/** A graph stored as adjacency lists: each vertex maps to an array of neighbours. */
export class Graph<V> {
  readonly directed: boolean;
  private readonly adj = new Map<V, V[]>();
  private edges = 0;

  constructor(directed = false) {
    this.directed = directed;
  }

  addVertex(v: V): void {
    if (!this.adj.has(v)) this.adj.set(v, []);
  }

  vertices(): V[] {
    return [...this.adj.keys()];
  }

  get edgeCount(): number {
    return this.edges;
  }

  private listOf(v: V): V[] {
    const list = this.adj.get(v);
    if (list === undefined) throw new RangeError(`unknown vertex ${String(v)}`);
    return list;
  }

  neighbours(v: V): V[] {
    return [...this.listOf(v)];
  }

  degree(v: V): number {
    return this.listOf(v).length;
  }

  hasEdge(u: V, v: V): boolean {
    return this.adj.get(u)?.includes(v) ?? false;
  }

  addEdge(u: V, v: V): boolean {
    this.addVertex(u);
    this.addVertex(v);
    const out = this.listOf(u);
    if (out.includes(v)) return false;
    out.push(v);
    if (!this.directed && u !== v) this.listOf(v).push(u);
    this.edges++;
    return true;
  }

  removeEdge(u: V, v: V): boolean {
    if (!this.hasEdge(u, v)) return false;
    removeOne(this.listOf(u), v);
    if (!this.directed && u !== v) removeOne(this.listOf(v), u);
    this.edges--;
    return true;
  }
}

/** A graph on vertices 0 to n - 1 stored as an n-by-n grid of 0s and 1s. */
export class AdjacencyMatrix {
  readonly directed: boolean;
  private readonly rows: Uint8Array[];
  private edges = 0;

  constructor(n: number, directed = false) {
    if (!Number.isInteger(n) || n < 0) {
      throw new RangeError('n must be a non-negative integer');
    }
    this.directed = directed;
    this.rows = Array.from({ length: n }, () => new Uint8Array(n));
  }

  private check(v: number): void {
    if (!Number.isInteger(v) || v < 0 || v >= this.rows.length) {
      throw new RangeError(`vertex ${v} is out of range`);
    }
  }

  vertices(): number[] {
    return this.rows.map((_, i) => i);
  }

  get edgeCount(): number {
    return this.edges;
  }

  hasEdge(u: number, v: number): boolean {
    this.check(u);
    this.check(v);
    return this.rows[u][v] === 1;
  }

  addEdge(u: number, v: number): boolean {
    if (this.hasEdge(u, v)) return false;
    this.rows[u][v] = 1;
    if (!this.directed) this.rows[v][u] = 1;
    this.edges++;
    return true;
  }

  removeEdge(u: number, v: number): boolean {
    if (!this.hasEdge(u, v)) return false;
    this.rows[u][v] = 0;
    if (!this.directed) this.rows[v][u] = 0;
    this.edges--;
    return true;
  }

  neighbours(v: number): number[] {
    this.check(v);
    const out: number[] = [];
    this.rows[v].forEach((cell, w) => {
      if (cell === 1) out.push(w);
    });
    return out;
  }

  degree(v: number): number {
    return this.neighbours(v).length;
  }
}
