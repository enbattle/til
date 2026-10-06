/** adj[u] lists the neighbors of u, the shape the graph entry's buildList returns. */
export type Graph = number[][];

/** Mark every vertex reachable from start, with a stack that lives on the heap. */
export function explore(adj: Graph, start: number, seen: Set<number>): void {
  const stack = [start];
  while (stack.length > 0) {
    const u = stack.pop()!;
    // Marked on pop, so the order is truly depth-first. A vertex can be
    // pushed by several neighbors first; skip repeats or it is scanned twice.
    if (seen.has(u)) continue;
    seen.add(u);
    // Reversed, so the first neighbor is popped first, as in recursion.
    for (const v of [...adj[u]].reverse()) {
      if (!seen.has(v)) stack.push(v);
    }
  }
}

/** Groups of vertices that can reach each other, in an undirected graph. */
export function countComponents(adj: Graph): number {
  const seen = new Set<number>();
  let count = 0;
  // Every vertex is tried as a start, or an isolated one would never be counted.
  for (let u = 0; u < adj.length; u++) {
    if (!seen.has(u)) {
      explore(adj, u, seen);
      count++;
    }
  }
  return count;
}

const UNVISITED = 0;
const ON_PATH = 1;
const FINISHED = 2;

/** Whether a directed graph has a cycle; adj[u] lists u's out-neighbors. */
export function hasCycle(adj: Graph): boolean {
  const state = new Array<number>(adj.length).fill(UNVISITED);
  const visit = (u: number): boolean => {
    state[u] = ON_PATH;
    for (const v of adj[u]) {
      // Only an edge back into the current path closes a loop. In the
      // diamond 0>1, 0>2, 1>3, 2>3, reaching 3 twice is not a cycle.
      if (state[v] === ON_PATH || (state[v] === UNVISITED && visit(v))) return true;
    }
    // Stays FINISHED, never reset: resetting re-walks shared subgraphs,
    // which takes exponential time on a chain of diamonds.
    state[u] = FINISHED;
    return false;
  };
  for (let u = 0; u < adj.length; u++) {
    if (state[u] === UNVISITED && visit(u)) return true;
  }
  return false;
}

/** Anything with these three fields, such as the binary-tree entry's node. */
export interface TreeNode {
  value: number;
  left: TreeNode | null;
  right: TreeNode | null;
}

/** Whether some root-to-leaf path has values adding up to remaining. */
export function hasPathSum(node: TreeNode | null, remaining: number): boolean {
  if (node === null) return false;
  // An argument, so each call has its own copy and nothing needs undoing.
  remaining -= node.value;
  // Test at a leaf, not at null: a node with one child would otherwise
  // count its empty side as a second place for a path to end.
  if (node.left === null && node.right === null) return remaining === 0;
  return hasPathSum(node.left, remaining) || hasPathSum(node.right, remaining);
}

/** Edges on the longest path between any two nodes. */
export function diameter(root: TreeNode | null): number {
  let best = 0;
  const height = (node: TreeNode | null): number => {
    // -1 for the empty tree, as in the binary-tree entry, so a leaf is 0.
    if (node === null) return -1;
    const left = height(node.left);
    const right = height(node.right);
    // The longest path turning at this node goes down both sides. Computed
    // here, from heights already returned; calling height() afresh at every
    // node re-walks each subtree, O(n^2) on a chain.
    best = Math.max(best, left + right + 2);
    // A parent can extend only one side, so only the taller one goes up.
    return 1 + Math.max(left, right);
  };
  height(root);
  return best;
}
