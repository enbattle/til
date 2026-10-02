export type Graph = Map<number, number[]>;

const UNVISITED = 0;
const ON_PATH = 1;
const FINISHED = 2;

/** Every vertex: the keys in order, then targets that are not keys, as met. */
export function allVertices(graph: Graph): number[] {
  const vertices = new Set(graph.keys());
  for (const targets of graph.values()) {
    for (const target of targets) vertices.add(target);
  }
  return [...vertices];
}

/**
 * Kahn's algorithm: an order with every edge going forward, or null on a cycle.
 * Ties go to the vertex that became ready first; the starting ones are taken
 * in `allVertices` order.
 */
export function topologicalSort(graph: Graph): number[] | null {
  const vertices = allVertices(graph);
  const inDegree = new Map<number, number>(vertices.map((vertex) => [vertex, 0]));
  for (const targets of graph.values()) {
    for (const target of targets) inDegree.set(target, inDegree.get(target)! + 1);
  }
  // The output doubles as the queue: `head` is the front, the end is the back.
  const order = vertices.filter((vertex) => inDegree.get(vertex) === 0);
  for (let head = 0; head < order.length; head++) {
    for (const target of graph.get(order[head]) ?? []) {
      const left = inDegree.get(target)! - 1;
      inDegree.set(target, left);
      if (left === 0) order.push(target);
    }
  }
  return order.length === vertices.length ? order : null;
}

/**
 * The DFS method: reverse the finishing order, or null on a cycle.
 * Starts are tried in `allVertices` order and neighbours in list order.
 */
export function topologicalSortDfs(graph: Graph): number[] | null {
  const vertices = allVertices(graph);
  const state = new Map<number, number>(vertices.map((vertex) => [vertex, UNVISITED]));
  const finished: number[] = [];
  for (const start of vertices) {
    if (state.get(start) !== UNVISITED) continue;
    state.set(start, ON_PATH);
    // Each entry is a vertex and how many of its neighbours are already handled.
    const stack: [number, number][] = [[start, 0]];
    while (stack.length > 0) {
      const top = stack[stack.length - 1];
      const [vertex, next] = top;
      const neighbours = graph.get(vertex) ?? [];
      if (next === neighbours.length) {
        state.set(vertex, FINISHED);
        finished.push(vertex);
        stack.pop();
        continue;
      }
      top[1]++;
      const neighbour = neighbours[next];
      if (state.get(neighbour) === ON_PATH) return null;
      if (state.get(neighbour) === UNVISITED) {
        state.set(neighbour, ON_PATH);
        stack.push([neighbour, 0]);
      }
    }
  }
  return finished.reverse();
}

/**
 * An order to take courses 0..numCourses-1, or null if prerequisites loop.
 * Each pair is [course, prerequisite]: the prerequisite comes first.
 */
export function courseOrder(
  numCourses: number,
  prerequisites: [number, number][],
): number[] | null {
  const graph: Graph = new Map();
  for (let course = 0; course < numCourses; course++) graph.set(course, []);
  for (const [course, prerequisite] of prerequisites) {
    graph.get(prerequisite)!.push(course);
  }
  return topologicalSort(graph);
}
