/** adj[u] lists the vertices u points at, the directed form of the graph entry's list. */
export type Graph = number[][];

/** Kahn's algorithm: an order with every edge going forward, or null on a cycle. */
export function topologicalSort(adj: Graph): number[] | null {
  const inDegree = new Array<number>(adj.length).fill(0);
  for (const targets of adj) {
    for (const v of targets) inDegree[v]++;
  }
  const order: number[] = [];
  for (let u = 0; u < adj.length; u++) {
    if (inDegree[u] === 0) order.push(u);
  }
  // The output is the queue, with head chasing its end: shift() moves every item
  // and would make this O(V^2).
  for (let head = 0; head < order.length; head++) {
    for (const v of adj[order[head]]) {
      inDegree[v]--;
      // At 0, not 1: v is ready only when its last prerequisite is placed.
      if (inDegree[v] === 0) order.push(v);
    }
  }
  // Vertices on a cycle wait on each other and never come out; a short order is
  // not an answer.
  return order.length === adj.length ? order : null;
}

const UNVISITED = 0;
const ON_PATH = 1;
const FINISHED = 2;

/** Reverse finishing order of a depth-first search, or null on a cycle. */
export function topologicalSortDfs(adj: Graph): number[] | null {
  const state = new Array<number>(adj.length).fill(UNVISITED);
  const finished: number[] = [];

  const visit = (u: number): boolean => {
    state[u] = ON_PATH;
    for (const v of adj[u]) {
      // An edge into a finished vertex is fine; only the current path is a loop.
      if (state[v] === ON_PATH || (state[v] === UNVISITED && !visit(v))) return false;
    }
    state[u] = FINISHED;
    // Appended on exit, when everything u points at is already in the list.
    finished.push(u);
    return true;
  };

  for (let u = 0; u < adj.length; u++) {
    // Every vertex is a start, since one start rarely reaches the whole graph.
    if (state[u] === UNVISITED && !visit(u)) return null;
  }
  // Finishing puts each vertex after what it points at; reverse to put it before.
  return finished.reverse();
}

/** An order to take courses 0..n-1; each pair is [course, prerequisite]. */
export function courseOrder(
  n: number,
  prerequisites: [number, number][],
): number[] | null {
  const adj: Graph = Array.from({ length: n }, () => []);
  for (const [course, prerequisite] of prerequisites) {
    // The arrow runs from what comes first to what depends on it.
    adj[prerequisite].push(course);
  }
  return topologicalSort(adj);
}
