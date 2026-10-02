from collections import deque
from collections.abc import Sequence
from typing import Generic, TypeVar

T = TypeVar("T")


class TreeNode(Generic[T]):
    """One node: a value and references to a left and a right child, or None."""

    __slots__ = ("value", "left", "right")

    def __init__(
        self,
        value: T,
        left: "TreeNode[T] | None" = None,
        right: "TreeNode[T] | None" = None,
    ) -> None:
        self.value = value
        self.left = left
        self.right = right


def _attach(
    values: Sequence[T | None], i: int, queue: deque[TreeNode[T]]
) -> TreeNode[T] | None:
    """The child described by values[i], queued for its own children, or None."""
    if i >= len(values) or values[i] is None:
        return None
    child = TreeNode(values[i])
    queue.append(child)
    return child


def build_tree(values: Sequence[T | None]) -> TreeNode[T] | None:
    """Build a tree from its level order, where None marks a missing child."""
    root = TreeNode(values[0]) if values and values[0] is not None else None
    queue: deque[TreeNode[T]] = deque([root] if root is not None else [])
    i = 1
    while i < len(values):
        if not queue:
            raise ValueError(f"the value at index {i} has no parent")
        node = queue.popleft()
        node.left = _attach(values, i, queue)
        node.right = _attach(values, i + 1, queue)
        i += 2
    return root


def preorder(root: TreeNode[T] | None) -> list[T]:
    values: list[T] = []

    def visit(node: TreeNode[T] | None) -> None:
        if node is None:
            return
        values.append(node.value)
        visit(node.left)
        visit(node.right)

    visit(root)
    return values


def inorder(root: TreeNode[T] | None) -> list[T]:
    values: list[T] = []

    def visit(node: TreeNode[T] | None) -> None:
        if node is None:
            return
        visit(node.left)
        values.append(node.value)
        visit(node.right)

    visit(root)
    return values


def postorder(root: TreeNode[T] | None) -> list[T]:
    values: list[T] = []

    def visit(node: TreeNode[T] | None) -> None:
        if node is None:
            return
        visit(node.left)
        visit(node.right)
        values.append(node.value)

    visit(root)
    return values


def inorder_iterative(root: TreeNode[T] | None) -> list[T]:
    values: list[T] = []
    stack: list[TreeNode[T]] = []
    node = root
    while node is not None or stack:
        while node is not None:
            stack.append(node)
            node = node.left
        node = stack.pop()
        values.append(node.value)
        node = node.right
    return values


def level_order(root: TreeNode[T] | None) -> list[list[T]]:
    levels: list[list[T]] = []
    queue = deque([root] if root is not None else [])
    while queue:
        level: list[T] = []
        for _ in range(len(queue)):
            node = queue.popleft()
            level.append(node.value)
            if node.left is not None:
                queue.append(node.left)
            if node.right is not None:
                queue.append(node.right)
        levels.append(level)
    return levels


def height(root: TreeNode[T] | None) -> int:
    """Edges on the longest path from the root down to a leaf; -1 when empty."""
    if root is None:
        return -1
    return 1 + max(height(root.left), height(root.right))


def size(root: TreeNode[T] | None) -> int:
    if root is None:
        return 0
    return 1 + size(root.left) + size(root.right)
