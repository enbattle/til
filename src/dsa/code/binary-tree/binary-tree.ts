/** One node: a value and a left and a right child, or null. */
export class TreeNode<T> {
  constructor(
    public value: T,
    public left: TreeNode<T> | null = null,
    public right: TreeNode<T> | null = null,
  ) {}
}

/** Build a tree from its level order, where null marks a missing child. */
export function buildTree<T>(values: readonly (T | null)[]): TreeNode<T> | null {
  let i = 0;
  const take = (): T | null => (i < values.length ? values[i++] : null);
  const child = (value: T | null, born: TreeNode<T>[]): TreeNode<T> | null => {
    // === null, not falsy: 0 and "" are real values that must get a node.
    if (value === null) return null;
    const node = new TreeNode(value);
    born.push(node);
    return node;
  };
  const first = take();
  const root: TreeNode<T> | null = first === null ? null : new TreeNode<T>(first);
  let level: TreeNode<T>[] = root === null ? [] : [root];
  while (level.length > 0) {
    const born: TreeNode<T>[] = [];
    // Values come in pairs, and only for nodes that exist, so a gap
    // costs two entries fewer one level down, not two nulls.
    for (const node of level) {
      node.left = child(take(), born);
      node.right = child(take(), born);
    }
    level = born;
  }
  // Values left over once no node is waiting for children have no parent.
  if (i < values.length) throw new RangeError('a value has no parent');
  return root;
}

export function height<T>(node: TreeNode<T> | null): number {
  // -1 for the empty tree, so a leaf is 0 and the formula needs no special
  // case. Recursion is as deep as the tree is tall, so a chain overflows.
  if (node === null) return -1;
  return 1 + Math.max(height(node.left), height(node.right));
}

/** Left subtree, node, right subtree, with an explicit stack, not recursion. */
export function inorder<T>(root: TreeNode<T> | null): T[] {
  const out: T[] = [];
  const stack: TreeNode<T>[] = [];
  let node = root;
  while (stack.length > 0 || node !== null) {
    // Ancestors wait on the stack until their left side is done. The array
    // grows on the heap, so a chain of a million nodes is fine.
    while (node !== null) {
      stack.push(node);
      node = node.left;
    }
    const top = stack.pop()!;
    out.push(top.value);
    node = top.right; // else the loop re-walks the left spine forever
  }
  return out;
}

/** Values grouped by depth, left to right. */
export function levelOrder<T>(root: TreeNode<T> | null): T[][] {
  const levels: T[][] = [];
  let level: TreeNode<T>[] = root === null ? [] : [root];
  while (level.length > 0) {
    levels.push(level.map((node) => node.value));
    // The next level comes from the whole current one, so depths never mix;
    // a flat queue would have to count where each level ends.
    level = level.flatMap((n) => [n.left, n.right]).filter((c) => c !== null);
  }
  return levels;
}
