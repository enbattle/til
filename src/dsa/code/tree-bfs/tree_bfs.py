from collections import deque
from collections.abc import Sequence


class TreeNode:
    """One node: a value and references to a left and a right child, or None."""

    __slots__ = ("value", "left", "right")

    def __init__(
        self,
        value: int,
        left: "TreeNode | None" = None,
        right: "TreeNode | None" = None,
    ) -> None:
        self.value = value
        self.left = left
        self.right = right


def build_tree(values: Sequence[int | None]) -> TreeNode | None:
    """Build a tree from its level order, where None marks a missing child."""
    if not values or values[0] is None:
        return None
    root = TreeNode(values[0])
    queue = deque([root])
    i = 1
    while i < len(values):
        if not queue:
            raise ValueError(f"the value at index {i} has no parent")
        node = queue.popleft()
        if values[i] is not None:
            node.left = TreeNode(values[i])
            queue.append(node.left)
        if i + 1 < len(values) and values[i + 1] is not None:
            node.right = TreeNode(values[i + 1])
            queue.append(node.right)
        i += 2
    return root


def right_side_view(root: TreeNode | None) -> list[int]:
    """The last node of each level, top to bottom: what you see from the right."""
    view: list[int] = []
    queue = deque([root] if root is not None else [])
    while queue:
        view.append(queue[-1].value)
        for _ in range(len(queue)):
            node = queue.popleft()
            if node.left is not None:
                queue.append(node.left)
            if node.right is not None:
                queue.append(node.right)
    return view


def min_depth(root: TreeNode | None) -> int:
    """Edges from the root to the nearest leaf; -1 for an empty tree."""
    queue = deque([root] if root is not None else [])
    depth = 0
    while queue:
        for _ in range(len(queue)):
            node = queue.popleft()
            if node.left is None and node.right is None:
                return depth
            if node.left is not None:
                queue.append(node.left)
            if node.right is not None:
                queue.append(node.right)
        depth += 1
    return -1


def zigzag_level_order(root: TreeNode | None) -> list[list[int]]:
    """Levels top to bottom, alternating left-to-right and right-to-left."""
    levels: list[list[int]] = []
    queue = deque([root] if root is not None else [])
    while queue:
        level: list[int] = []
        for _ in range(len(queue)):
            node = queue.popleft()
            level.append(node.value)
            if node.left is not None:
                queue.append(node.left)
            if node.right is not None:
                queue.append(node.right)
        if len(levels) % 2 == 1:
            level.reverse()
        levels.append(level)
    return levels
