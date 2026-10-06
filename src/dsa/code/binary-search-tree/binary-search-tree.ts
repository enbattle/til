export class Node {
  left: Node | null = null;
  right: Node | null = null;
  constructor(public key: number) {}
}

/** The node holding key (null if absent) and its parent. */
export function find(root: Node | null, key: number): [Node | null, Node | null] {
  // A node can't unlink itself, so the walk carries its parent along.
  let parent: Node | null = null;
  let node = root;
  while (node !== null && node.key !== key) {
    parent = node;
    node = key < node.key ? node.left : node.right;
  }
  return [parent, node];
}

export function contains(root: Node | null, key: number): boolean {
  return find(root, key)[1] !== null;
}

/** Returns the root, which is new only when the tree was empty. */
export function insert(root: Node | null, key: number): Node {
  const [parent, node] = find(root, key);
  // A second copy would break the strict smaller/larger rule.
  if (node !== null) return root as Node;
  const added = new Node(key);
  if (parent === null) return added;
  if (key < parent.key) parent.left = added;
  else parent.right = added;
  return root as Node;
}

/** Returns the root, which changes when the root itself was removed. */
export function remove(root: Node | null, key: number): Node | null {
  let [parent, node] = find(root, key);
  if (node === null) return root;
  if (node.left !== null && node.right !== null) {
    // The smallest key on the right is the only one that can take this
    // node's place with every left key still smaller. Start the parent
    // at node: the successor may be node.right itself.
    parent = node;
    let successor = node.right;
    while (successor.left !== null) {
      parent = successor;
      successor = successor.left;
    }
    // Copy the key up rather than relink, so node's links stay valid.
    node.key = successor.key;
    node = successor;
  }
  // Zero or one child now: a successor has no left child by construction.
  const child = node.left ?? node.right;
  if (parent === null) return child;
  if (parent.left === node) parent.left = child;
  else parent.right = child;
  return root;
}

export function* inOrder(root: Node | null): Generator<number> {
  // An explicit stack: recursion overflows on a long chain of nodes.
  const stack: Node[] = [];
  let node = root;
  while (stack.length > 0 || node !== null) {
    while (node !== null) {
      stack.push(node);
      node = node.left;
    }
    node = stack.pop() as Node;
    yield node.key;
    node = node.right;
  }
}

export function isValid(root: Node | null): boolean {
  // Bounds come from every ancestor, not just the parent: 50 with left
  // child 30 and 30's right child 60 passes every parent-child check.
  const stack: [Node | null, number, number][] = [[root, -Infinity, Infinity]];
  while (stack.length > 0) {
    const [node, lo, hi] = stack.pop() as [Node | null, number, number];
    if (node === null) continue;
    if (!(lo < node.key && node.key < hi)) return false;
    stack.push([node.left, lo, node.key]);
    stack.push([node.right, node.key, hi]);
  }
  return true;
}
