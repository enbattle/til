# region node
class Node:
    def __init__(self, key: int) -> None:
        self.key = key
        self.left: Node | None = None
        self.right: Node | None = None
# endregion


# region find
def find(root: Node | None, key: int) -> tuple[Node | None, Node | None]:
    """The parent and the node holding key (None for each if absent)."""
    # A node can't unlink itself, so the walk carries its parent along.
    parent = None
    node = root
    while node is not None and node.key != key:
        parent = node
        if key < node.key:
            node = node.left
        else:
            node = node.right
    return parent, node


def contains(root: Node | None, key: int) -> bool:
    return find(root, key)[1] is not None
# endregion


# region insert
def insert(root: Node | None, key: int) -> Node:
    """Returns the root, which is new only when the tree was empty."""
    if root is None:
        return Node(key)
    node = root
    while True:
        if key == node.key:
            # A second copy would break the strict smaller/larger rule.
            return root
        if key < node.key:
            if node.left is None:
                node.left = Node(key)
                return root
            node = node.left
        else:
            if node.right is None:
                node.right = Node(key)
                return root
            node = node.right
# endregion


# region remove
def remove(root: Node | None, key: int) -> Node | None:
    """Returns the root, which changes when the root itself was removed."""
    parent, node = find(root, key)
    if node is None:
        return root
    if node.left is not None and node.right is not None:
        # The smallest key on the right is the only one that can take this
        # node's place with every left key still smaller. Start the parent
        # at node: the successor may be node.right itself.
        parent = node
        successor = node.right
        while successor.left is not None:
            parent = successor
            successor = successor.left
        # Copy the key up rather than relink, so node's links stay valid.
        node.key = successor.key
        node = successor
    # Zero or one child now: a successor has no left child by construction.
    if node.left is not None:
        child = node.left
    else:
        child = node.right
    if parent is None:
        return child
    if parent.left is node:
        parent.left = child
    else:
        parent.right = child
    return root
# endregion


# region in-order
def in_order(root: Node | None) -> list[int]:
    keys = []
    # An explicit stack: recursion overflows on a long chain of nodes.
    stack = []
    node = root
    while len(stack) > 0 or node is not None:
        while node is not None:
            stack.append(node)
            node = node.left
        node = stack.pop()
        keys.append(node.key)
        node = node.right
    return keys
# endregion


# region is-valid
from math import inf


def is_valid(root: Node | None) -> bool:
    if root is None:
        return True
    # An explicit stack: recursion overflows on a long chain of nodes.
    stack = [(root, -inf, inf)]
    while len(stack) > 0:
        node, low, high = stack.pop()
        # Bounds come from every ancestor, not just the parent: 50 with left
        # child 30 and 30's right child 60 passes every parent-child check.
        if node.key <= low or node.key >= high:
            return False
        if node.left is not None:
            stack.append((node.left, low, node.key))
        if node.right is not None:
            stack.append((node.right, node.key, high))
    return True
# endregion
