// #region node
export class Node {
  key: number;
  left: Node | null = null;
  right: Node | null = null;

  constructor(key: number) {
    this.key = key;
  }
}
// #endregion

// #region find
/** The parent and the node holding key (null for each if absent). */
export function find(root: Node | null, key: number): [Node | null, Node | null] {
  // A node can't unlink itself, so the walk carries its parent along.
  let parent: Node | null = null;
  let node = root;
  while (node !== null && node.key !== key) {
    parent = node;
    if (key < node.key) {
      node = node.left;
    } else {
      node = node.right;
    }
  }
  return [parent, node];
}

export function contains(root: Node | null, key: number): boolean {
  return find(root, key)[1] !== null;
}
// #endregion

// #region insert
/** Returns the root, which is new only when the tree was empty. */
export function insert(root: Node | null, key: number): Node {
  if (root === null) {
    return new Node(key);
  }
  let node = root;
  while (true) {
    if (key === node.key) {
      // A second copy would break the strict smaller/larger rule.
      return root;
    }
    if (key < node.key) {
      if (node.left === null) {
        node.left = new Node(key);
        return root;
      }
      node = node.left;
    } else {
      if (node.right === null) {
        node.right = new Node(key);
        return root;
      }
      node = node.right;
    }
  }
}
// #endregion

// #region remove
/** Returns the root, which changes when the root itself was removed. */
export function remove(root: Node | null, key: number): Node | null {
  let [parent, node] = find(root, key);
  if (node === null) {
    return root;
  }
  if (node.left !== null && node.right !== null) {
    // The smallest key on the right is the only one that can take this
    // node's place with every left key still smaller. Start the parent
    // at node: the successor may be node.right itself.
    parent = node;
    let successor: Node = node.right;
    while (successor.left !== null) {
      parent = successor;
      successor = successor.left;
    }
    // Copy the key up rather than relink, so node's links stay valid.
    node.key = successor.key;
    node = successor;
  }
  // Zero or one child now: a successor has no left child by construction.
  let child = node.right;
  if (node.left !== null) {
    child = node.left;
  }
  if (parent === null) {
    return child;
  }
  if (parent.left === node) {
    parent.left = child;
  } else {
    parent.right = child;
  }
  return root;
}
// #endregion

// #region in-order
export function inOrder(root: Node | null): number[] {
  const keys: number[] = [];
  // An explicit stack: recursion overflows on a long chain of nodes.
  const stack: Node[] = [];
  let node = root;
  while (stack.length > 0 || node !== null) {
    while (node !== null) {
      stack.push(node);
      node = node.left;
    }
    node = stack[stack.length - 1];
    stack.pop();
    keys.push(node.key);
    node = node.right;
  }
  return keys;
}
// #endregion

// #region is-valid
export function isValid(root: Node | null): boolean {
  if (root === null) {
    return true;
  }
  // An explicit stack: recursion overflows on a long chain of nodes.
  const stack: [Node, number, number][] = [[root, -Infinity, Infinity]];
  while (stack.length > 0) {
    const [node, low, high] = stack[stack.length - 1];
    stack.pop();
    // Bounds come from every ancestor, not just the parent: 50 with left
    // child 30 and 30's right child 60 passes every parent-child check.
    if (node.key <= low || node.key >= high) {
      return false;
    }
    if (node.left !== null) {
      stack.push([node.left, low, node.key]);
    }
    if (node.right !== null) {
      stack.push([node.right, node.key, high]);
    }
  }
  return true;
}
// #endregion
