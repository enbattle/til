/**
 * Connected components of an undirected graph given as vertex -> neighbours.
 * Every vertex, including isolated ones, must be a key of `graph`.
 */
export function countComponents(graph: Map<number, number[]>): number {
  const seen = new Set<number>();
  let count = 0;
  for (const start of graph.keys()) {
    if (seen.has(start)) continue;
    count++;
    seen.add(start);
    const stack = [start];
    while (stack.length > 0) {
      const vertex = stack.pop()!;
      for (const neighbour of graph.get(vertex)!) {
        if (!seen.has(neighbour)) {
          seen.add(neighbour);
          stack.push(neighbour);
        }
      }
    }
  }
  return count;
}

/** Groups of 1-cells (land) joined up, down, left or right, in a 0/1 grid. */
export function countIslands(grid: number[][]): number {
  const rows = grid.length;
  const cols = rows > 0 ? grid[0].length : 0;
  const seen = grid.map((row) => row.map(() => false));
  let count = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (grid[row][col] !== 1 || seen[row][col]) continue;
      count++;
      seen[row][col] = true;
      const stack: [number, number][] = [[row, col]];
      while (stack.length > 0) {
        const [r, c] = stack.pop()!;
        for (const [nr, nc] of [
          [r - 1, c],
          [r + 1, c],
          [r, c - 1],
          [r, c + 1],
        ]) {
          const inside = nr >= 0 && nr < rows && nc >= 0 && nc < cols;
          if (inside && grid[nr][nc] === 1 && !seen[nr][nc]) {
            seen[nr][nc] = true;
            stack.push([nr, nc]);
          }
        }
      }
    }
  }
  return count;
}

const UNVISITED = 0;
const ON_PATH = 1;
const FINISHED = 2;

/** Whether a directed graph (vertex -> out-neighbours) contains a cycle. */
export function hasCycle(graph: Map<number, number[]>): boolean {
  const state = new Map<number, number>();
  for (const vertex of graph.keys()) state.set(vertex, UNVISITED);
  for (const start of graph.keys()) {
    if (state.get(start) !== UNVISITED) continue;
    state.set(start, ON_PATH);
    // Each entry is a vertex and how many of its neighbours are already handled.
    const stack: [number, number][] = [[start, 0]];
    while (stack.length > 0) {
      const top = stack[stack.length - 1];
      const [vertex, next] = top;
      const neighbours = graph.get(vertex)!;
      if (next === neighbours.length) {
        state.set(vertex, FINISHED);
        stack.pop();
        continue;
      }
      top[1]++;
      const neighbour = neighbours[next];
      if (state.get(neighbour) === ON_PATH) return true;
      if (state.get(neighbour) === UNVISITED) {
        state.set(neighbour, ON_PATH);
        stack.push([neighbour, 0]);
      }
    }
  }
  return false;
}
