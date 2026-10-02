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


def build_tree(values: list[int | None]) -> TreeNode | None:
    """Build a tree from its level order, where None marks a missing child."""
    if not values or values[0] is None:
        return None
    root = TreeNode(values[0])
    waiting = [root]  # nodes still owed children, oldest first
    next_index = 1
    for node in waiting:
        for side in ("left", "right"):
            if next_index < len(values) and values[next_index] is not None:
                child = TreeNode(values[next_index])
                setattr(node, side, child)
                waiting.append(child)
            next_index += 1
    return root


def paths_with_sum(root: TreeNode | None, target: int) -> list[list[int]]:
    """Every root-to-leaf path whose values add up to target, left to right."""
    paths: list[list[int]] = []
    path: list[int] = []

    def visit(node: TreeNode | None, remaining: int) -> None:
        if node is None:
            return
        path.append(node.value)
        remaining -= node.value
        if node.left is None and node.right is None:
            if remaining == 0:
                paths.append(path.copy())
        else:
            visit(node.left, remaining)
            visit(node.right, remaining)
        path.pop()

    visit(root, target)
    return paths


def diameter(root: TreeNode | None) -> int:
    """Edges on the longest path between any two nodes; 0 for an empty tree."""
    best = 0

    def height(node: TreeNode | None) -> int:
        nonlocal best
        if node is None:
            return -1
        left = height(node.left)
        right = height(node.right)
        best = max(best, left + right + 2)
        return 1 + max(left, right)

    height(root)
    return best
