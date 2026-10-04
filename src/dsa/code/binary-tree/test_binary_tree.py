"""The binary-tree entry's Python code.

API: ``TreeNode(value, left=None, right=None)``; ``build_tree(values)`` from a
level-order list where None marks a missing child (ValueError when a value has
no parent); ``preorder``, ``inorder``, ``postorder``, ``inorder_iterative``
(lists of values), ``level_order`` (a list of levels), ``height`` (edges, -1
for an empty tree) and ``size``.
"""

import random

import pytest

from binary_tree import (
    TreeNode,
    build_tree,
    height,
    inorder,
    inorder_iterative,
    level_order,
    postorder,
    preorder,
    size,
)

# The worked example in the entry:
#         1
#        / \
#       2   3
#      /   / \
#     4   5   6
#      \
#       7
EXAMPLE = [1, 2, 3, 4, None, 5, 6, None, 7]


def shape(node):
    """The tree as nested tuples (value, left, right), for comparing structure."""
    if node is None:
        return None
    return (node.value, shape(node.left), shape(node.right))


def test_empty_tree():
    for values in ([], [None]):
        root = build_tree(values)
        assert root is None
    assert preorder(None) == []
    assert inorder(None) == []
    assert postorder(None) == []
    assert inorder_iterative(None) == []
    assert level_order(None) == []
    assert height(None) == -1
    assert size(None) == 0


def test_one_node():
    root = build_tree([5])
    assert shape(root) == (5, None, None)
    assert preorder(root) == inorder(root) == postorder(root) == [5]
    assert inorder_iterative(root) == [5]
    assert level_order(root) == [[5]]
    assert height(root) == 0
    assert size(root) == 1


def test_build_the_worked_example():
    root = build_tree(EXAMPLE)
    assert shape(root) == (
        1,
        (2, (4, None, (7, None, None)), None),
        (3, (5, None, None), (6, None, None)),
    )


def test_traversals_of_the_worked_example():
    root = build_tree(EXAMPLE)
    assert preorder(root) == [1, 2, 4, 7, 3, 5, 6]
    assert inorder(root) == [4, 7, 2, 1, 5, 3, 6]
    assert inorder_iterative(root) == [4, 7, 2, 1, 5, 3, 6]
    assert postorder(root) == [7, 4, 2, 5, 6, 3, 1]
    assert level_order(root) == [[1], [2, 3], [4, 5, 6], [7]]
    assert height(root) == 3
    assert size(root) == 7


def test_left_only_chain():
    root = build_tree([1, 2, None, 3])
    assert shape(root) == (1, (2, (3, None, None), None), None)
    assert preorder(root) == [1, 2, 3]
    assert inorder(root) == inorder_iterative(root) == [3, 2, 1]
    assert postorder(root) == [3, 2, 1]
    assert level_order(root) == [[1], [2], [3]]
    assert height(root) == 2


def test_right_only_chain():
    root = build_tree([1, None, 2, None, 3])
    assert shape(root) == (1, None, (2, None, (3, None, None)))
    assert preorder(root) == [1, 2, 3]
    assert inorder(root) == inorder_iterative(root) == [1, 2, 3]
    assert postorder(root) == [3, 2, 1]
    assert level_order(root) == [[1], [2], [3]]
    assert height(root) == 2


def test_gaps_skip_the_children_of_missing_nodes():
    # 2 is missing, so the next pair after 3's slot belongs to 3, not to 2.
    root = build_tree([1, None, 3, 4, 5])
    assert shape(root) == (1, None, (3, (4, None, None), (5, None, None)))
    # A trailing None and a missing final right child mean the same thing.
    assert shape(build_tree([1, 2, None])) == shape(build_tree([1, 2]))


def test_falsy_values_are_nodes_not_gaps():
    root = build_tree([0, "", False])
    assert shape(root) == (0, ("", None, None), (False, None, None))
    assert size(root) == 3


def test_duplicate_values():
    root = build_tree([2, 2, 2, None, 2])
    assert preorder(root) == [2, 2, 2, 2]
    assert size(root) == 4
    assert height(root) == 2


def test_hand_built_nodes():
    root = TreeNode("b", TreeNode("a"), TreeNode("c"))
    assert inorder(root) == ["a", "b", "c"]
    assert level_order(root) == [["b"], ["a", "c"]]


@pytest.mark.parametrize(
    "values", [[1, None, None, 4], [None, 1], [1, None, None, None]]
)
def test_a_value_with_no_parent_raises(values):
    with pytest.raises(ValueError):
        build_tree(values)


def left_chain(n):
    """A tree of n nodes where each node is the left child of the one before."""
    values = [0]
    for i in range(1, n):
        values += [i, None]
    return build_tree(values)


def test_deep_tree_breaks_recursion_but_not_the_stack_version():
    root = left_chain(5000)
    assert inorder_iterative(root) == list(range(4999, -1, -1))
    assert [len(level) for level in level_order(root)] == [1] * 5000
    with pytest.raises(RecursionError):
        inorder(root)


# An independent reference: describe each node by its path from the root, a
# string of "L" and "R" steps. Every traversal order is then a sort of the paths.


def random_paths(rng, n):
    """A random tree of n nodes as {path: value}, grown one free child slot at a time."""
    tree = {"": rng.randrange(10)} if n > 0 else {}
    while len(tree) < n:
        parent = rng.choice(list(tree))
        child = parent + rng.choice("LR")
        if child not in tree:
            tree[child] = rng.randrange(10)
    return tree


def by_key(tree, mapping, end):
    def key(path):
        return "".join(mapping[step] for step in path) + end

    return [tree[p] for p in sorted(tree, key=key)]


def level_paths(tree):
    return sorted(tree, key=lambda p: (len(p), p))


def serialize(tree):
    """The level-order list with None gaps, trailing Nones trimmed."""
    values = [tree[""]] if tree else []
    for path in level_paths(tree):
        values += [tree.get(path + "L"), tree.get(path + "R")]
    while values and values[-1] is None:
        values.pop()
    return values


def paths_of(root):
    found, stack = {}, [("", root)]
    while stack:
        path, node = stack.pop()
        if node is not None:
            found[path] = node.value
            stack += [(path + "L", node.left), (path + "R", node.right)]
    return found


def test_matches_the_path_reference_on_random_trees():
    for seed in range(50):
        where = f"seed {seed}"
        rng = random.Random(seed)
        tree = random_paths(rng, rng.randrange(40))
        root = build_tree(serialize(tree))
        assert paths_of(root) == tree, where
        assert preorder(root) == by_key(tree, {"L": "0", "R": "1"}, ""), where
        assert inorder(root) == by_key(tree, {"L": "0", "R": "2"}, "1"), where
        assert inorder_iterative(root) == inorder(root), where
        assert postorder(root) == by_key(tree, {"L": "0", "R": "1"}, "2"), where
        levels = [[] for _ in range(1 + max(map(len, tree), default=-1))]
        for path in level_paths(tree):
            levels[len(path)].append(tree[path])
        assert level_order(root) == levels, where
        assert height(root) == max(map(len, tree), default=-1), where
        assert size(root) == len(tree), where
