export function shortestPath(
  adj: number[][],
  source: number,
  target: number,
): number[] | null {
  // parent doubles as the visited set, and a vertex goes in when it is
  // queued, not when it is popped: marked later, a vertex that two queued
  // neighbors both reach is queued twice and its neighbors scanned twice.
  const parent = new Map<number, number | null>([[source, null]]);
  const queue = [source];
  // Stop once target is found: its parent is already a shortest route,
  // and waiting to pop it would scan every vertex queued ahead of it.
  // head walks the array instead of shift(): shift moves every item, O(n) a pop.
  for (let head = 0; head < queue.length && !parent.has(target); head++) {
    for (const w of adj[queue[head]]) {
      if (!parent.has(w)) {
        parent.set(w, queue[head]);
        queue.push(w);
      }
    }
  }
  if (!parent.has(target)) return null;
  const path: number[] = [];
  for (let node: number | null = target; node !== null; node = parent.get(node)!) {
    path.push(node);
  }
  // Parents point back toward the source, so the walk comes out reversed.
  return path.reverse();
}

/** Minutes until every fresh cell (1) rots, or -1 if one never does. */
export function minutesToRot(grid: number[][]): number {
  const rows = grid.length;
  const cols = rows > 0 ? grid[0].length : 0;
  // Keyed r * cols + c: a Set of [r, c] arrays would compare by reference.
  const seen = new Set<number>();
  const queue: [number, number][] = [];
  let fresh = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === 2) {
        seen.add(r * cols + c);
        queue.push([r, c]);
      } else if (grid[r][c] === 1) fresh++;
    }
  }
  // Every rotten cell starts in the queue, so one search spreads from all of
  // them at once; a search per source repeats work and needs a merge of answers.
  let head = 0;
  let minutes = 0;
  while (head < queue.length && fresh > 0) {
    // Fix the end now: cells rotted this minute join the queue, so reading
    // queue.length again would run them in the same minute.
    for (const end = queue.length; head < end; head++) {
      const [r, c] = queue[head];
      for (const [nr, nc] of [
        [r + 1, c],
        [r - 1, c],
        [r, c + 1],
        [r, c - 1],
      ]) {
        // Bounds before indexing: grid[-1] is undefined here, and indexing it
        // throws. Marked when queued, as in shortestPath.
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
        if (grid[nr][nc] === 1 && !seen.has(nr * cols + nc)) {
          seen.add(nr * cols + nc);
          fresh--;
          queue.push([nr, nc]);
        }
      }
    }
    minutes++;
  }
  return fresh > 0 ? -1 : minutes;
}
