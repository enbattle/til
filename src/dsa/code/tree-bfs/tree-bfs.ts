/** One node: a value and references to a left and a right child, or null. */
export class TreeNode {
  constructor(
    public value: number,
    public left: TreeNode | null = null,
    public right: TreeNode | null = null,
  ) {}
}

/** Build a tree from its level order, where null marks a missing child. */
export function buildTree(values: readonly (number | null)[]): TreeNode | null {
  const first = values.length > 0 ? values[0] : null;
  if (first === null) return null;
  const root = new TreeNode(first);
  const queue: TreeNode[] = [root];
  let head = 0; // queue[head] is the next node waiting for its children
  for (let i = 1; i < values.length; i += 2) {
    if (head === queue.length) {
      throw new RangeError(`the value at index ${i} has no parent`);
    }
    const node = queue[head++];
    const left = values[i];
    if (left !== null) {
      node.left = new TreeNode(left);
      queue.push(node.left);
    }
    const right = i + 1 < values.length ? values[i + 1] : null;
    if (right !== null) {
      node.right = new TreeNode(right);
      queue.push(node.right);
    }
  }
  return root;
}

/** The last node of each level, top to bottom: what you see from the right. */
export function rightSideView(root: TreeNode | null): number[] {
  const view: number[] = [];
  let level = root === null ? [] : [root];
  while (level.length > 0) {
    view.push(level[level.length - 1].value);
    const next: TreeNode[] = [];
    for (const node of level) {
      if (node.left !== null) next.push(node.left);
      if (node.right !== null) next.push(node.right);
    }
    level = next;
  }
  return view;
}

/** Edges from the root to the nearest leaf; -1 for an empty tree. */
export function minDepth(root: TreeNode | null): number {
  let level = root === null ? [] : [root];
  let depth = 0;
  while (level.length > 0) {
    const next: TreeNode[] = [];
    for (const node of level) {
      if (node.left === null && node.right === null) return depth;
      if (node.left !== null) next.push(node.left);
      if (node.right !== null) next.push(node.right);
    }
    level = next;
    depth++;
  }
  return -1;
}

/** Levels top to bottom, alternating left-to-right and right-to-left. */
export function zigzagLevelOrder(root: TreeNode | null): number[][] {
  const levels: number[][] = [];
  let level = root === null ? [] : [root];
  while (level.length > 0) {
    const values = level.map((node) => node.value);
    if (levels.length % 2 === 1) values.reverse();
    levels.push(values);
    const next: TreeNode[] = [];
    for (const node of level) {
      if (node.left !== null) next.push(node.left);
      if (node.right !== null) next.push(node.right);
    }
    level = next;
  }
  return levels;
}
