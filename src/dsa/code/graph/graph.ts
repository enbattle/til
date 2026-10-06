export type Edge = [number, number];

function check(n: number, edges: Edge[]): void {
  // A bad column on a number[] row would silently grow the row, not fail.
  for (const [u, v] of edges) {
    if (!(u >= 0 && u < n && v >= 0 && v < n)) {
      throw new RangeError(`edge (${u}, ${v}) names a vertex outside 0..${n - 1}`);
    }
  }
}

/** Adjacency list: adj[u] holds the neighbors of u. */
export function buildList(n: number, edges: Edge[], directed = false): number[][] {
  check(n, edges);
  // Array.from calls the function per slot; fill([]) would share one array.
  const adj: number[][] = Array.from({ length: n }, () => []);
  for (const [u, v] of edges) {
    adj[u].push(v);
    // An undirected edge is stored from both ends, or only one end sees it.
    // A self-loop (u === v) is one entry, the same as one matrix cell.
    if (!directed && u !== v) adj[v].push(u);
  }
  return adj;
}

/** Adjacency matrix: m[u][v] is 1 when there is an edge from u to v. */
export function buildMatrix(n: number, edges: Edge[], directed = false): number[][] {
  check(n, edges);
  // Every cell exists up front, which is the V * V space cost.
  const m = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (const [u, v] of edges) {
    m[u][v] = 1;
    if (!directed) m[v][u] = 1;
  }
  return m;
}

export function hasEdgeList(adj: number[][], u: number, v: number): boolean {
  return adj[u].includes(v); // a scan of u's list, so O(deg(u))
}

export function hasEdgeMatrix(m: number[][], u: number, v: number): boolean {
  return m[u][v] === 1; // one cell read, however many edges there are
}

export function neighborsMatrix(m: number[][], u: number): number[] {
  // No list to return: the whole row must be read to find the 1s.
  const out: number[] = [];
  m[u].forEach((cell, v) => {
    if (cell) out.push(v);
  });
  return out;
}

export function* edgesOfList(adj: number[][]): Generator<Edge> {
  for (const [u, row] of adj.entries()) {
    for (const v of row) yield [u, v];
  }
}

export function* edgesOfMatrix(m: number[][]): Generator<Edge> {
  for (const [u, row] of m.entries()) {
    for (const [v, cell] of row.entries()) {
      if (cell) yield [u, v]; // every cell is read, including the zeros
    }
  }
}
