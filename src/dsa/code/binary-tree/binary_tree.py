from collections.abc import Sequence
from dataclasses import dataclass
from typing import Generic, TypeVar

T = TypeVar("T")


# eq=False compares nodes by identity. The generated __eq__ would walk both
# subtrees, which overflows the stack on a deep tree. repr=False, same reason.
@dataclass(eq=False, repr=False)
class TreeNode(Generic[T]):
    """One node: a value and a left and a right child, or None."""

    value: T
    left: "TreeNode[T] | None" = None
    right: "TreeNode[T] | None" = None


def _child(value: T | None, born: list[TreeNode[T]]) -> TreeNode[T] | None:
    # `is None`, not falsy: 0 and "" are real values that must get a node.
    if value is None:
        return None
    node = TreeNode(value)
    born.append(node)
    return node


def build_tree(values: Sequence[T | None]) -> TreeNode[T] | None:
    """Build a tree from its level order, where None marks a missing child."""
    items = iter(values)
    first = next(items, None)
    root = None if first is None else TreeNode(first)
    level = [] if root is None else [root]
    while level:
        born: list[TreeNode[T]] = []
        # Values come in pairs, and only for nodes that exist, so a gap
        # costs two entries fewer one level down, not two Nones.
        for node in level:
            node.left = _child(next(items, None), born)
            node.right = _child(next(items, None), born)
        level = born
    # Values left over once no node is waiting for children have no parent.
    if list(items):
        raise ValueError("a value has no parent")
    return root


def height(node: TreeNode[T] | None) -> int:
    # -1 for the empty tree, so a leaf is 0 and the formula needs no special
    # case. Recursion is as deep as the tree is tall, so a chain overflows.
    return -1 if node is None else 1 + max(height(node.left), height(node.right))


def inorder(root: TreeNode[T] | None) -> list[T]:
    """Left subtree, node, right subtree, with an explicit stack, not recursion."""
    out: list[T] = []
    stack: list[TreeNode[T]] = []
    node = root
    while stack or node is not None:
        # Ancestors wait on the stack until their left side is done. The list
        # grows on the heap, so a chain of a million nodes is fine.
        while node is not None:
            stack.append(node)
            node = node.left
        node = stack.pop()
        out.append(node.value)
        node = node.right  # else the loop re-walks the left spine forever
    return out


def level_order(root: TreeNode[T] | None) -> list[list[T]]:
    """Values grouped by depth, left to right."""
    levels: list[list[T]] = []
    level = [] if root is None else [root]
    while level:
        levels.append([node.value for node in level])
        # The next level comes from the whole current one, so depths never mix;
        # a flat queue would have to count where each level ends.
        level = [c for n in level for c in (n.left, n.right) if c is not None]
    return levels
