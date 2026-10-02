"""Tests for tree_bfs: right_side_view, min_depth and zigzag_level_order.

The random tests compare each function with a depth-first brute force on many
seeded random trees of every shape from a line to a bushy tree.
"""

import random

import pytest

from tree_bfs import (
    TreeNode,
    build_tree,
    min_depth,
    right_side_view,
    zigzag_level_order,
)

EXAMPLE = [1, 2, 3, 4, None, 5, 6, None, 7]


# --- depth-first brute force ------------------------------------------------


def levels_dfs(root):
    """Values grouped by depth, each level left to right, by preorder."""
    levels = {}

    def visit(node, depth):
        if node is None:
            return
        levels.setdefault(depth, []).append(node.value)
        visit(node.left, depth + 1)
        visit(node.right, depth + 1)

    visit(root, 0)
    return [levels[d] for d in range(len(levels))]


def right_side_view_dfs(root):
    return [level[-1] for level in levels_dfs(root)]


def zigzag_dfs(root):
    return [
        level[::-1] if depth % 2 else level
        for depth, level in enumerate(levels_dfs(root))
    ]


def min_depth_dfs(node):
    if node is None:
        return -1
    if node.left is None and node.right is None:
        return 0
    if node.left is None:
        return 1 + min_depth_dfs(node.right)
    if node.right is None:
        return 1 + min_depth_dfs(node.left)
    return 1 + min(min_depth_dfs(node.left), min_depth_dfs(node.right))


# --- tree generators --------------------------------------------------------


def random_tree(rng, n, chain_bias):
    """n nodes with distinct values; chain_bias is the odds of extending the
    newest node, so a high bias gives a long thin tree and 0 a bushy one."""
    if n == 0:
        return None
    values = list(range(n))
    rng.shuffle(values)
    root = TreeNode(values[0])
    nodes = [root]
    for value in values[1:]:
        while True:
            parent = nodes[-1] if rng.random() < chain_bias else rng.choice(nodes)
            side = rng.choice(["left", "right"])
            if getattr(parent, side) is None:
                break
        setattr(parent, side, TreeNode(value))
        nodes.append(getattr(parent, side))
    return root


def line(n, side):
    """A tree of n nodes where each node has only a `side` child."""
    root = None
    for value in range(n, 0, -1):
        if side == "left":
            root = TreeNode(value, root, None)
        else:
            root = TreeNode(value, None, root)
    return root


# --- build_tree --------------------------------------------------------------


def test_build_tree_makes_the_example():
    root = build_tree(EXAMPLE)
    assert levels_dfs(root) == [[1], [2, 3], [4, 5, 6], [7]]
    assert root.left.left.right.value == 7


def test_build_tree_keeps_a_zero_value():
    root = build_tree([1, 0, 2, 3])
    assert root.left.value == 0
    assert root.left.left.value == 3


def test_build_tree_rejects_a_value_with_no_parent():
    with pytest.raises(ValueError):
        build_tree([1, None, None, 4])


def test_build_tree_of_nothing():
    assert build_tree([]) is None
    assert build_tree([None]) is None


# --- right_side_view ---------------------------------------------------------


def test_right_side_view_of_the_example():
    # 5 and 6 share a level: the right one wins. 7 is the only node at depth 3
    # and it hangs on the left side of the tree.
    assert right_side_view(build_tree(EXAMPLE)) == [1, 3, 6, 7]


def test_right_side_view_sees_a_left_node_when_the_right_side_is_shorter():
    assert right_side_view(build_tree([1, 2, 3, 4])) == [1, 3, 4]


def test_right_side_view_empty_and_single():
    assert right_side_view(None) == []
    assert right_side_view(TreeNode(9)) == [9]


def test_right_side_view_of_lines():
    assert right_side_view(line(4, "left")) == [1, 2, 3, 4]
    assert right_side_view(line(4, "right")) == [1, 2, 3, 4]


# --- min_depth ---------------------------------------------------------------


def test_min_depth_of_the_example():
    # The leaf 5 (and 6) is at depth 2; the deepest leaf, 7, is at depth 3.
    assert min_depth(build_tree(EXAMPLE)) == 2


def test_min_depth_counts_edges_for_empty_and_single():
    assert min_depth(None) == -1
    assert min_depth(TreeNode(1)) == 0


def test_min_depth_does_not_stop_at_a_missing_child():
    # The root's missing left child is not a leaf: the nearest leaf is 2 below.
    assert min_depth(build_tree([1, None, 2, None, 3])) == 2


def test_min_depth_of_lines_is_their_height():
    assert min_depth(line(5, "left")) == 4
    assert min_depth(line(5, "right")) == 4


def test_min_depth_stops_at_the_first_leaf():
    # A leaf at depth 1 beside a long chain: the answer is 1, not the chain.
    deep = line(50, "left")
    root = TreeNode(0, deep, TreeNode(-1))
    assert min_depth(root) == 1


# --- zigzag_level_order ------------------------------------------------------


def test_zigzag_of_the_example():
    assert zigzag_level_order(build_tree(EXAMPLE)) == [[1], [3, 2], [4, 5, 6], [7]]


def test_zigzag_flips_every_other_level_not_the_first_two():
    tree = build_tree([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15])
    assert zigzag_level_order(tree) == [
        [1],
        [3, 2],
        [4, 5, 6, 7],
        [15, 14, 13, 12, 11, 10, 9, 8],
    ]


def test_zigzag_empty_and_single():
    assert zigzag_level_order(None) == []
    assert zigzag_level_order(TreeNode(7)) == [[7]]


def test_zigzag_of_lines():
    assert zigzag_level_order(line(3, "left")) == [[1], [2], [3]]
    assert zigzag_level_order(line(3, "right")) == [[1], [2], [3]]


# --- random comparison with the brute force -----------------------------------


@pytest.mark.parametrize("seed", range(300))
def test_random_trees_match_the_depth_first_answers(seed):
    rng = random.Random(seed)
    root = random_tree(rng, rng.randint(0, 40), rng.choice([0, 0.5, 0.9]))
    assert right_side_view(root) == right_side_view_dfs(root)
    assert min_depth(root) == min_depth_dfs(root)
    assert zigzag_level_order(root) == zigzag_dfs(root)
