// #region components
/** adj[u] lists the neighbors of u, the shape the graph entry's buildList returns. */
export type Graph = number[][];

/** Mark every vertex reachable from start, with a stack that lives on the heap. */
export function explore(adj: Graph, start: number, seen: Set<number>): void {
  const stack = [start];
  while (stack.length > 0) {
    const u = stack[stack.length - 1];
    stack.pop();
    // Marked on pop, so the order is truly depth-first. A vertex can be
    // pushed by several neighbors first; skip repeats or it is scanned twice.
    if (seen.has(u)) {
      continue;
    }
    seen.add(u);
    // Reversed, so the first neighbor is popped first, as in recursion.
    const neighbors = adj[u];
    for (let i = neighbors.length - 1; i >= 0; i--) {
      const v = neighbors[i];
      if (!seen.has(v)) {
        stack.push(v);
      }
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
      count += 1;
    }
  }
  return count;
}
// #endregion

// #region has-cycle
const UNVISITED = 0;
const ON_PATH = 1;
const FINISHED = 2;

/** Walk on from u; true if an edge leads back into the current path. */
function visit(adj: Graph, state: number[], u: number): boolean {
  state[u] = ON_PATH;
  for (const v of adj[u]) {
    // Only an edge back into the current path closes a loop. In the
    // diamond 0>1, 0>2, 1>3, 2>3, reaching 3 twice is not a cycle.
    if (state[v] === ON_PATH) {
      return true;
    }
    if (state[v] === UNVISITED) {
      if (visit(adj, state, v)) {
        return true;
      }
    }
  }
  // Stays FINISHED, never reset: resetting re-walks shared subgraphs,
  // which takes exponential time on a chain of diamonds.
  state[u] = FINISHED;
  return false;
}

/** Whether a directed graph has a cycle; adj[u] lists u's out-neighbors. */
export function hasCycle(adj: Graph): boolean {
  const state: number[] = [];
  for (let u = 0; u < adj.length; u++) {
    state.push(UNVISITED);
  }
  for (let u = 0; u < adj.length; u++) {
    if (state[u] === UNVISITED) {
      if (visit(adj, state, u)) {
        return true;
      }
    }
  }
  return false;
}
// #endregion

// #region path-sum
/** One node: a value and a left and a right child, or null. */
export class TreeNode {
  value: number;
  left: TreeNode | null;
  right: TreeNode | null;

  constructor(
    value: number,
    left: TreeNode | null = null,
    right: TreeNode | null = null,
  ) {
    this.value = value;
    this.left = left;
    this.right = right;
  }
}

/** Whether some root-to-leaf path has values adding up to remaining. */
export function hasPathSum(node: TreeNode | null, remaining: number): boolean {
  if (node === null) {
    return false;
  }
  // An argument, so each call has its own copy and nothing needs undoing.
  remaining = remaining - node.value;
  // Test at a leaf, not at null: a node with one child would otherwise
  // count its empty side as a second place for a path to end.
  if (node.left === null && node.right === null) {
    return remaining === 0;
  }
  return hasPathSum(node.left, remaining) || hasPathSum(node.right, remaining);
}
// #endregion

// #region diameter
/** The node's height and the longest path (in edges) anywhere below it. */
function heightAndBest(node: TreeNode | null): [number, number] {
  // -1 for the empty tree, as in the binary-tree entry, so a leaf is 0.
  if (node === null) {
    return [-1, 0];
  }
  const [leftHeight, leftBest] = heightAndBest(node.left);
  const [rightHeight, rightBest] = heightAndBest(node.right);
  // The longest path turning at this node goes down both sides. Computed
  // here, from heights already returned; calling a height function afresh
  // at every node re-walks each subtree, O(n^2) on a chain.
  const throughHere = leftHeight + rightHeight + 2;
  const best = Math.max(leftBest, rightBest, throughHere);
  // A parent can extend only one side, so only the taller one goes up.
  return [1 + Math.max(leftHeight, rightHeight), best];
}

/** Edges on the longest path between any two nodes. */
export function diameter(root: TreeNode | null): number {
  return heightAndBest(root)[1];
}
// #endregion
