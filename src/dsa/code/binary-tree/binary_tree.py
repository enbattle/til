# region tree-node
class TreeNode:
    """One node: a value and a left and a right child, or None."""

    def __init__(
        self,
        value: int,
        left: "TreeNode | None" = None,
        right: "TreeNode | None" = None,
    ):
        self.value = value
        self.left = left
        self.right = right
# endregion


# region build-tree
def build_tree(values: list[int | None]) -> TreeNode | None:
    """Build a tree from its level order, where None marks a missing child."""
    if len(values) == 0:
        return None
    if values[0] is None:
        if len(values) > 1:
            raise ValueError("a value has no parent")
        return None

    root = TreeNode(values[0])
    level = [root]  # the nodes of one level, waiting for their children
    i = 1
    # Values come in pairs, and only for nodes that exist, so a gap
    # costs two entries fewer one level down, not two Nones.
    while len(level) > 0 and i < len(values):
        next_level = []
        for node in level:
            # `is not None`, not truthiness: 0 is a real value that must get a node.
            if i < len(values) and values[i] is not None:
                node.left = TreeNode(values[i])
                next_level.append(node.left)
            i += 1

            if i < len(values) and values[i] is not None:
                node.right = TreeNode(values[i])
                next_level.append(node.right)
            i += 1
        level = next_level

    # Values left over once no node is waiting for children have no parent.
    if i < len(values):
        raise ValueError("a value has no parent")
    return root
# endregion


# region height
def height(node: TreeNode | None) -> int:
    # -1 for the empty tree, so a leaf is 0 and the formula needs no special
    # case. Recursion is as deep as the tree is tall, so a chain overflows.
    if node is None:
        return -1
    return 1 + max(height(node.left), height(node.right))
# endregion


# region inorder
def inorder(root: TreeNode | None) -> list[int]:
    """Left subtree, node, right subtree, with an explicit stack, not recursion."""
    out = []
    stack = []
    node = root
    while len(stack) > 0 or node is not None:
        # Ancestors wait on the stack until their left side is done. The list
        # grows on the heap, so a chain of a million nodes is fine.
        while node is not None:
            stack.append(node)
            node = node.left
        top = stack[len(stack) - 1]
        stack.pop()
        out.append(top.value)
        node = top.right  # else every right subtree is dropped
    return out
# endregion


# region level-order
def level_order(root: TreeNode | None) -> list[list[int]]:
    """Values grouped by depth, left to right."""
    levels = []
    if root is None:
        return levels

    level = [root]
    while len(level) > 0:
        values = []
        # Children go in a fresh list, so the next level never mixes with
        # this one, and only one level is held at a time.
        next_level = []
        for node in level:
            values.append(node.value)
            if node.left is not None:
                next_level.append(node.left)
            if node.right is not None:
                next_level.append(node.right)
        levels.append(values)
        level = next_level
    return levels
# endregion
