// #region tree-node
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
// #endregion

// #region build-tree
/** Build a tree from its level order, where null marks a missing child. */
export function buildTree(values: (number | null)[]): TreeNode | null {
  if (values.length === 0) {
    return null;
  }
  if (values[0] === null) {
    if (values.length > 1) {
      throw new RangeError('a value has no parent');
    }
    return null;
  }

  const root = new TreeNode(values[0]);
  let level: TreeNode[] = [root]; // the nodes of one level, waiting for their children
  let i = 1;
  // Values come in pairs, and only for nodes that exist, so a gap
  // costs two entries fewer one level down, not two nulls.
  while (level.length > 0 && i < values.length) {
    const nextLevel: TreeNode[] = [];
    for (const node of level) {
      // !== null, not truthiness: 0 is a real value that must get a node.
      const leftValue = values[i];
      if (i < values.length && leftValue !== null) {
        node.left = new TreeNode(leftValue);
        nextLevel.push(node.left);
      }
      i += 1;

      const rightValue = values[i];
      if (i < values.length && rightValue !== null) {
        node.right = new TreeNode(rightValue);
        nextLevel.push(node.right);
      }
      i += 1;
    }
    level = nextLevel;
  }

  // Values left over once no node is waiting for children have no parent.
  if (i < values.length) {
    throw new RangeError('a value has no parent');
  }
  return root;
}
// #endregion

// #region height
export function height(node: TreeNode | null): number {
  // -1 for the empty tree, so a leaf is 0 and the formula needs no special
  // case. Recursion is as deep as the tree is tall, so a chain overflows.
  if (node === null) {
    return -1;
  }
  return 1 + Math.max(height(node.left), height(node.right));
}
// #endregion

// #region inorder
/** Left subtree, node, right subtree, with an explicit stack, not recursion. */
export function inorder(root: TreeNode | null): number[] {
  const out: number[] = [];
  const stack: TreeNode[] = [];
  let node = root;
  while (stack.length > 0 || node !== null) {
    // Ancestors wait on the stack until their left side is done. The array
    // grows on the heap, so a chain of a million nodes is fine.
    while (node !== null) {
      stack.push(node);
      node = node.left;
    }
    const top = stack[stack.length - 1];
    stack.pop();
    out.push(top.value);
    node = top.right; // else every right subtree is dropped
  }
  return out;
}
// #endregion

// #region level-order
/** Values grouped by depth, left to right. */
export function levelOrder(root: TreeNode | null): number[][] {
  const levels: number[][] = [];
  if (root === null) {
    return levels;
  }

  let level: TreeNode[] = [root];
  while (level.length > 0) {
    const values: number[] = [];
    // Children go in a fresh array, so the next level never mixes with
    // this one, and only one level is held at a time.
    const nextLevel: TreeNode[] = [];
    for (const node of level) {
      values.push(node.value);
      if (node.left !== null) {
        nextLevel.push(node.left);
      }
      if (node.right !== null) {
        nextLevel.push(node.right);
      }
    }
    levels.push(values);
    level = nextLevel;
  }
  return levels;
}
// #endregion
