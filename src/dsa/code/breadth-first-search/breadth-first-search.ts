// #region shortest-path
export function shortestPath(
  adj: number[][],
  source: number,
  target: number,
): number[] | null {
  const n = adj.length;
  // Check first: parent[n] is undefined, so the path walk would never end.
  if (source < 0 || source >= n || target < 0 || target >= n) {
    throw new RangeError('source and target must be vertices 0 to n - 1');
  }
  // parent[v] is the vertex v was first reached from, or -1 if not reached
  // yet, so it doubles as the visited list. The source is its own parent:
  // that marks it as reached, so it is never queued again, and
  // parent[target] === -1 is false when source === target.
  // A vertex is marked when it is queued, not when it is popped: marked
  // later, a vertex that two queued neighbors both reach is queued twice
  // and its neighbors scanned twice.
  const parent = new Array<number>(n).fill(-1);
  parent[source] = source;
  const queue = [source];
  // head walks the array instead of shift(): shift moves every item, O(n) a pop.
  let head = 0;
  // Stop once target is found: its parent is already a shortest route,
  // and waiting to pop it would scan every vertex queued ahead of it.
  while (head < queue.length && parent[target] === -1) {
    const v = queue[head];
    head += 1;
    for (const w of adj[v]) {
      if (parent[w] === -1) {
        parent[w] = v;
        queue.push(w);
      }
    }
  }
  // #endregion

  // #region path-from-parents
  if (parent[target] === -1) return null;
  const path = [target];
  let node = target;
  while (node !== source) {
    node = parent[node];
    path.push(node);
  }
  // Parents point back toward the source, so the walk comes out reversed.
  path.reverse();
  return path;
}
// #endregion

// #region minutes-to-rot
/** Minutes until every fresh cell (1) rots, or -1 if one never does. */
export function minutesToRot(grid: number[][]): number {
  const rows = grid.length;
  let cols = 0;
  if (rows > 0) {
    cols = grid[0].length;
  }
  const rotted: boolean[][] = [];
  for (let r = 0; r < rows; r++) {
    rotted.push(new Array<boolean>(cols).fill(false));
  }
  // Every rotten cell starts in the queue, so one search spreads from all of
  // them at once; a search per source repeats work and needs a merge of answers.
  const queue: [number, number][] = [];
  let fresh = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === 2) {
        queue.push([r, c]);
      } else if (grid[r][c] === 1) {
        fresh += 1;
      }
    }
  }
  const directions = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  // head walks the array instead of shift(): shift moves every item, O(n) a pop.
  let head = 0;
  let minutes = 0;
  while (head < queue.length && fresh > 0) {
    // Fix the count now: cells rotted this minute join the queue, so
    // reading queue.length again would run them in the same minute.
    const count = queue.length - head;
    for (let i = 0; i < count; i++) {
      const [r, c] = queue[head];
      head += 1;
      for (const [dr, dc] of directions) {
        const nr = r + dr;
        const nc = c + dc;
        // Bounds before indexing: grid[-1] is undefined here, and indexing it
        // throws. Marked when queued, as in shortestPath.
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
        if (grid[nr][nc] === 1 && !rotted[nr][nc]) {
          rotted[nr][nc] = true;
          fresh -= 1;
          queue.push([nr, nc]);
        }
      }
    }
    minutes += 1;
  }
  if (fresh > 0) return -1;
  return minutes;
}
// #endregion
