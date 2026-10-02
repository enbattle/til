export type Graph = Map<number, number[]>;

/** Fewest edges from `source` to every vertex reachable from it. */
export function bfsDistances(graph: Graph, source: number): Map<number, number> {
  const dist = new Map<number, number>([[source, 0]]);
  const queue = [source];
  for (let head = 0; head < queue.length; head++) {
    const v = queue[head];
    for (const w of graph.get(v) ?? []) {
      if (!dist.has(w)) {
        dist.set(w, dist.get(v)! + 1);
        queue.push(w);
      }
    }
  }
  return dist;
}

/** A path with the fewest edges from `source` to `target`, or null. */
export function shortestPath(
  graph: Graph,
  source: number,
  target: number,
): number[] | null {
  const parent = new Map<number, number | null>([[source, null]]);
  const queue = [source];
  for (let head = 0; head < queue.length && !parent.has(target); head++) {
    const v = queue[head];
    for (const w of graph.get(v) ?? []) {
      if (!parent.has(w)) {
        parent.set(w, v);
        queue.push(w);
      }
    }
  }
  if (!parent.has(target)) return null;
  const path: number[] = [];
  let node: number | null = target;
  while (node !== null) {
    path.push(node);
    node = parent.get(node)!;
  }
  return path.reverse();
}

/**
 * Steps from each cell to its nearest 'T'; walls ('#') and cells that cannot
 * reach a target get null. Moves are up, down, left and right.
 */
export function nearestTarget(grid: string[]): (number | null)[][] {
  const rows = grid.length;
  const cols = rows > 0 ? grid[0].length : 0;
  const dist: (number | null)[][] = Array.from({ length: rows }, () =>
    new Array<number | null>(cols).fill(null),
  );
  const queue: [number, number, number][] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === 'T') {
        dist[r][c] = 0;
        queue.push([r, c, 0]);
      }
    }
  }
  for (let head = 0; head < queue.length; head++) {
    const [r, c, d] = queue[head];
    for (const [nr, nc] of [
      [r + 1, c],
      [r - 1, c],
      [r, c + 1],
      [r, c - 1],
    ]) {
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
        if (grid[nr][nc] !== '#' && dist[nr][nc] === null) {
          dist[nr][nc] = d + 1;
          queue.push([nr, nc, d + 1]);
        }
      }
    }
  }
  return dist;
}
