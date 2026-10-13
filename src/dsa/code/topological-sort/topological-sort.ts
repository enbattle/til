// #region kahn
/** Kahn's algorithm: an order with every edge going forward, or null on a cycle.
 * adj[u] lists the vertices u points at, the directed form of the graph entry's list. */
export function topologicalSort(adj: number[][]): number[] | null {
  const inDegree: number[] = new Array(adj.length).fill(0);
  for (const targets of adj) {
    for (const v of targets) {
      inDegree[v] += 1;
    }
  }
  // A list plus a head index, since shift() moves every item and would make this
  // O(V^2). The list never shrinks, so it holds up to V items.
  const queue: number[] = [];
  for (let u = 0; u < adj.length; u++) {
    if (inDegree[u] === 0) {
      queue.push(u);
    }
  }
  const order: number[] = [];
  let head = 0;
  while (head < queue.length) {
    const u = queue[head];
    head += 1;
    order.push(u);
    for (const v of adj[u]) {
      inDegree[v] -= 1;
      // At 0, not 1: v is ready only when its last prerequisite is placed.
      if (inDegree[v] === 0) {
        queue.push(v);
      }
    }
  }
  // Vertices on a cycle wait on each other and never come out; a short order is
  // not an answer.
  if (order.length === adj.length) {
    return order;
  }
  return null;
}
// #endregion

// #region dfs-order
const UNVISITED = 0;
const ON_PATH = 1;
const FINISHED = 2;

/** Depth-first from u; false if it meets a vertex on the current path. */
function visit(adj: number[][], state: number[], finished: number[], u: number): boolean {
  state[u] = ON_PATH;
  for (const v of adj[u]) {
    // An edge into a finished vertex is fine; only the current path is a loop.
    if (state[v] === ON_PATH) {
      return false;
    }
    if (state[v] === UNVISITED) {
      if (!visit(adj, state, finished, v)) {
        return false;
      }
    }
  }
  state[u] = FINISHED;
  // Appended on exit, when everything u points at is already in the list.
  finished.push(u);
  return true;
}

/** Reverse finishing order of a depth-first search, or null on a cycle. */
export function topologicalSortDfs(adj: number[][]): number[] | null {
  const state: number[] = new Array(adj.length).fill(UNVISITED);
  const finished: number[] = [];
  for (let u = 0; u < adj.length; u++) {
    // Every vertex is a start, since one start rarely reaches the whole graph.
    if (state[u] === UNVISITED) {
      if (!visit(adj, state, finished, u)) {
        return null;
      }
    }
  }
  // Finishing puts each vertex after what it points at; reverse to put it before.
  finished.reverse();
  return finished;
}
// #endregion

// #region course-order
/** An order to take courses 0..n-1; each pair is [course, prerequisite]. */
export function courseOrder(
  n: number,
  prerequisites: [number, number][],
): number[] | null {
  const adj: number[][] = [];
  for (let i = 0; i < n; i++) {
    adj.push([]);
  }
  for (const [course, prerequisite] of prerequisites) {
    // The arrow runs from what comes first to what depends on it.
    adj[prerequisite].push(course);
  }
  return topologicalSort(adj);
}
// #endregion
