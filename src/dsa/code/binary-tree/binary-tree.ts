/** One node: a value and references to a left and a right child, or null. */
export class TreeNode<T> {
  constructor(
    public value: T,
    public left: TreeNode<T> | null = null,
    public right: TreeNode<T> | null = null,
  ) {}
}

/** Build a tree from its level order, where null marks a missing child. */
export function buildTree<T>(values: readonly (T | null)[]): TreeNode<T> | null {
  const first = values.length > 0 ? values[0] : null;
  const root = first === null ? null : new TreeNode(first);
  const queue: TreeNode<T>[] = root === null ? [] : [root];
  let head = 0; // queue[head] is the next node waiting for its children
  const attach = (i: number): TreeNode<T> | null => {
    const value = i < values.length ? values[i] : null;
    if (value === null) return null;
    const child = new TreeNode(value);
    queue.push(child);
    return child;
  };
  for (let i = 1; i < values.length; i += 2) {
    if (head === queue.length) {
      throw new RangeError(`the value at index ${i} has no parent`);
    }
    const node = queue[head++];
    node.left = attach(i);
    node.right = attach(i + 1);
  }
  return root;
}

export function preorder<T>(root: TreeNode<T> | null): T[] {
  const values: T[] = [];
  const visit = (node: TreeNode<T> | null): void => {
    if (node === null) return;
    values.push(node.value);
    visit(node.left);
    visit(node.right);
  };
  visit(root);
  return values;
}

export function inorder<T>(root: TreeNode<T> | null): T[] {
  const values: T[] = [];
  const visit = (node: TreeNode<T> | null): void => {
    if (node === null) return;
    visit(node.left);
    values.push(node.value);
    visit(node.right);
  };
  visit(root);
  return values;
}

export function postorder<T>(root: TreeNode<T> | null): T[] {
  const values: T[] = [];
  const visit = (node: TreeNode<T> | null): void => {
    if (node === null) return;
    visit(node.left);
    visit(node.right);
    values.push(node.value);
  };
  visit(root);
  return values;
}

export function inorderIterative<T>(root: TreeNode<T> | null): T[] {
  const values: T[] = [];
  const stack: TreeNode<T>[] = [];
  let node = root;
  while (node !== null || stack.length > 0) {
    while (node !== null) {
      stack.push(node);
      node = node.left;
    }
    const top = stack.pop() as TreeNode<T>;
    values.push(top.value);
    node = top.right;
  }
  return values;
}

export function levelOrder<T>(root: TreeNode<T> | null): T[][] {
  const levels: T[][] = [];
  let level = root === null ? [] : [root];
  while (level.length > 0) {
    levels.push(level.map((node) => node.value));
    const next: TreeNode<T>[] = [];
    for (const node of level) {
      if (node.left !== null) next.push(node.left);
      if (node.right !== null) next.push(node.right);
    }
    level = next;
  }
  return levels;
}

/** Edges on the longest path from the root down to a leaf; -1 when empty. */
export function height<T>(root: TreeNode<T> | null): number {
  if (root === null) return -1;
  return 1 + Math.max(height(root.left), height(root.right));
}

export function size<T>(root: TreeNode<T> | null): number {
  if (root === null) return 0;
  return 1 + size(root.left) + size(root.right);
}
