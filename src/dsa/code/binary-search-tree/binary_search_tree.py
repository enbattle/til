from collections.abc import Iterator
from math import inf


class Node:
    def __init__(self, key: int) -> None:
        self.key = key
        self.left: Node | None = None
        self.right: Node | None = None


def find(root: Node | None, key: int) -> tuple[Node | None, Node | None]:
    """The node holding key (None if absent) and its parent."""
    # A node can't unlink itself, so the walk carries its parent along.
    parent, node = None, root
    while node is not None and node.key != key:
        parent, node = node, (node.left if key < node.key else node.right)
    return parent, node


def contains(root: Node | None, key: int) -> bool:
    return find(root, key)[1] is not None


def insert(root: Node | None, key: int) -> Node:
    """Returns the root, which is new only when the tree was empty."""
    parent, node = find(root, key)
    if node is not None:
        # A second copy would break the strict smaller/larger rule.
        return root
    new = Node(key)
    if parent is None:
        return new
    if key < parent.key:
        parent.left = new
    else:
        parent.right = new
    return root


def remove(root: Node | None, key: int) -> Node | None:
    """Returns the root, which changes when the root itself was removed."""
    parent, node = find(root, key)
    if node is None:
        return root
    if node.left is not None and node.right is not None:
        # The smallest key on the right is the only one that can take this
        # node's place with every left key still smaller. Start the parent
        # at node: the successor may be node.right itself.
        parent, successor = node, node.right
        while successor.left is not None:
            parent, successor = successor, successor.left
        # Copy the key up rather than relink, so node's links stay valid.
        node.key = successor.key
        node = successor
    # Zero or one child now: a successor has no left child by construction.
    child = node.left if node.left is not None else node.right
    if parent is None:
        return child
    if parent.left is node:
        parent.left = child
    else:
        parent.right = child
    return root


def in_order(root: Node | None) -> Iterator[int]:
    # An explicit stack: recursion overflows on a long chain of nodes.
    stack: list[Node] = []
    node = root
    while stack or node is not None:
        while node is not None:
            stack.append(node)
            node = node.left
        node = stack.pop()
        yield node.key
        node = node.right


def is_valid(root: Node | None) -> bool:
    # Bounds come from every ancestor, not just the parent: 50 with left
    # child 30 and 30's right child 60 passes every parent-child check.
    stack = [(root, -inf, inf)]
    while stack:
        node, lo, hi = stack.pop()
        if node is None:
            continue
        if not lo < node.key < hi:
            return False
        stack.append((node.left, lo, node.key))
        stack.append((node.right, node.key, hi))
    return True
