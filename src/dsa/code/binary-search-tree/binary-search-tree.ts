/** One tree node: a key and links to the left and right subtrees. */
export class TreeNode {
  key: number;
  left: TreeNode | null = null;
  right: TreeNode | null = null;

  constructor(key: number) {
    this.key = key;
  }
}

/** An unbalanced binary search tree of distinct numeric keys. */
export class BinarySearchTree implements Iterable<number> {
  private root: TreeNode | null = null;
  private count = 0;

  constructor(keys: Iterable<number> = []) {
    for (const key of keys) this.insert(key);
  }

  get size(): number {
    return this.count;
  }

  has(key: number): boolean {
    let node = this.root;
    while (node !== null && node.key !== key) {
      node = key < node.key ? node.left : node.right;
    }
    return node !== null;
  }

  insert(key: number): boolean {
    let parent: TreeNode | null = null;
    let node = this.root;
    while (node !== null) {
      if (key === node.key) return false;
      parent = node;
      node = key < node.key ? node.left : node.right;
    }
    const fresh = new TreeNode(key);
    if (parent === null) {
      this.root = fresh;
    } else if (key < parent.key) {
      parent.left = fresh;
    } else {
      parent.right = fresh;
    }
    this.count++;
    return true;
  }

  delete(key: number): boolean {
    let parent: TreeNode | null = null;
    let node = this.root;
    while (node !== null && node.key !== key) {
      parent = node;
      node = key < node.key ? node.left : node.right;
    }
    if (node === null) return false;
    if (node.left !== null && node.right !== null) {
      let successorParent = node;
      let successor = node.right;
      while (successor.left !== null) {
        successorParent = successor;
        successor = successor.left;
      }
      node.key = successor.key;
      parent = successorParent;
      node = successor;
    }
    const child = node.left ?? node.right;
    if (parent === null) {
      this.root = child;
    } else if (parent.left === node) {
      parent.left = child;
    } else {
      parent.right = child;
    }
    this.count--;
    return true;
  }

  min(): number | undefined {
    let node = this.root;
    if (node === null) return undefined;
    while (node.left !== null) node = node.left;
    return node.key;
  }

  max(): number | undefined {
    let node = this.root;
    if (node === null) return undefined;
    while (node.right !== null) node = node.right;
    return node.key;
  }

  *[Symbol.iterator](): Iterator<number> {
    const stack: TreeNode[] = [];
    let node = this.root;
    while (stack.length > 0 || node !== null) {
      while (node !== null) {
        stack.push(node);
        node = node.left;
      }
      node = stack.pop()!;
      yield node.key;
      node = node.right;
    }
  }

  /** Every key k with lo <= k <= hi, in ascending order. */
  keysBetween(lo: number, hi: number): number[] {
    const result: number[] = [];
    const stack: TreeNode[] = [];
    let node = this.root;
    while (stack.length > 0 || node !== null) {
      while (node !== null) {
        if (node.key < lo) {
          node = node.right;
        } else {
          stack.push(node);
          node = node.left;
        }
      }
      const next = stack.pop();
      if (next === undefined || next.key > hi) break;
      result.push(next.key);
      node = next.right;
    }
    return result;
  }

  /** Edges on the longest path down from the root; -1 for an empty tree. */
  height(): number {
    let level = this.root === null ? [] : [this.root];
    let height = -1;
    while (level.length > 0) {
      height++;
      level = level.flatMap((n) => [n.left, n.right]).filter((c) => c !== null);
    }
    return height;
  }
}
