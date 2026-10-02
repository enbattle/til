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
  const waiting = [root]; // nodes still owed children, oldest first
  let nextIndex = 1;
  const attach = (): TreeNode | null => {
    const value = nextIndex < values.length ? values[nextIndex] : null;
    nextIndex++;
    if (value === null) return null;
    const child = new TreeNode(value);
    waiting.push(child);
    return child;
  };
  for (const node of waiting) {
    node.left = attach();
    node.right = attach();
  }
  return root;
}

/** Every root-to-leaf path whose values add up to `target`, left to right. */
export function pathsWithSum(root: TreeNode | null, target: number): number[][] {
  const paths: number[][] = [];
  const path: number[] = [];

  const visit = (node: TreeNode | null, remaining: number): void => {
    if (node === null) return;
    path.push(node.value);
    remaining -= node.value;
    if (node.left === null && node.right === null) {
      if (remaining === 0) paths.push([...path]);
    } else {
      visit(node.left, remaining);
      visit(node.right, remaining);
    }
    path.pop();
  };

  visit(root, target);
  return paths;
}

/** Edges on the longest path between any two nodes; 0 for an empty tree. */
export function diameter(root: TreeNode | null): number {
  let best = 0;

  const height = (node: TreeNode | null): number => {
    if (node === null) return -1;
    const left = height(node.left);
    const right = height(node.right);
    best = Math.max(best, left + right + 2);
    return 1 + Math.max(left, right);
  };

  height(root);
  return best;
}
