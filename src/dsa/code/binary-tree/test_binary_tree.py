"""Tests for the binary-tree entry's Python code.

API: ``TreeNode(value, left=None, right=None)``; ``build_tree(values)`` from a
level-order list where None marks a missing child (ValueError when a value has
no parent); ``height(node)`` in edges, -1 for the empty tree; ``inorder(root)``
a list of values; ``level_order(root)`` a list of levels.
"""

import random
import sys

import pytest

from binary_tree import TreeNode, build_tree, height, inorder, level_order

EXAMPLE = [1, 2, 3, 4, None, 5, 6, None, 7]


def shape(node):
    """A nested tuple of the tree, to compare two trees node by node."""
    return None if node is None else (node.value, shape(node.left), shape(node.right))


def random_shape(rng, size):
    """A random tree of `size` nodes as nested tuples with distinct values."""
    counter = iter(range(size))

    def make(n):
        if n == 0:
            return None
        left = rng.randint(0, n - 1)
        value = next(counter)
        return (value, make(left), make(n - 1 - left))

    return make(size)


def to_nodes(t):
    return None if t is None else TreeNode(t[0], to_nodes(t[1]), to_nodes(t[2]))


def to_level_list(t):
    """The level-order list for a nested-tuple tree, trailing Nones trimmed."""
    out, level = [], [t] if t is not None else []
    while level:
        nxt = []
        for node in level:
            for c in (node[1], node[2]) if node is not None else ():
                out.append(None if c is None else c[0])
                if c is not None:
                    nxt.append(c)
        level = nxt
    out.insert(0, t[0] if t is not None else None)
    while out and out[-1] is None:
        out.pop()
    return out


def ref_inorder(t):
    return [] if t is None else ref_inorder(t[1]) + [t[0]] + ref_inorder(t[2])


def ref_height(t):
    return -1 if t is None else 1 + max(ref_height(t[1]), ref_height(t[2]))


def ref_levels(t):
    levels = {}

    def walk(node, depth):
        if node is not None:
            levels.setdefault(depth, []).append(node[0])
            walk(node[1], depth + 1)
            walk(node[2], depth + 1)

    walk(t, 0)
    return [levels[d] for d in sorted(levels)]


def chain(n):
    """A degenerate tree of n nodes leaning left, built without recursion."""
    root = None
    for value in range(n):
        root = TreeNode(value, left=root)
    return root


def test_the_running_example():
    root = build_tree(EXAMPLE)
    assert inorder(root) == [4, 7, 2, 1, 5, 3, 6]
    assert level_order(root) == [[1], [2, 3], [4, 5, 6], [7]]
    assert height(root) == 3
    assert height(root.left) == 2 and height(root.right) == 1


def test_empty_tree():
    assert build_tree([]) is None
    assert build_tree([None]) is None
    assert inorder(None) == []
    assert level_order(None) == []
    assert height(None) == -1


def test_single_node():
    root = build_tree([5])
    assert (root.value, root.left, root.right) == (5, None, None)
    assert inorder(root) == [5]
    assert level_order(root) == [[5]]
    assert height(root) == 0


def test_a_trailing_none_is_optional_and_gaps_are_kept():
    assert shape(build_tree([1, 2])) == (1, (2, None, None), None)
    assert shape(build_tree([1, 2, None, None, None])) == (1, (2, None, None), None)
    assert shape(build_tree([1, None, 2])) == (1, None, (2, None, None))


def test_falsy_values_still_get_nodes():
    root = build_tree([0, "", 0, None, 0])
    assert level_order(root) == [[0], ["", 0], [0]]


def test_duplicates_and_large_ints_are_kept_as_values():
    values = [int("1000"), int("1000"), int("1000")]
    root = build_tree(values)
    assert inorder(root) == [1000, 1000, 1000]
    assert root.left.value == root.value


def test_a_value_with_no_parent_is_an_error():
    for bad in ([None, 1], [1, None, None, 4], [1, None, None, None]):
        with pytest.raises(ValueError):
            build_tree(bad)


def test_nodes_compare_by_identity():
    assert TreeNode(1) != TreeNode(1)


def test_build_tree_matches_the_tree_it_came_from():
    seed = 3
    rng = random.Random(seed)
    for trial in range(50):
        t = random_shape(rng, rng.randint(0, 12))
        values = to_level_list(t)
        got = shape(build_tree(values))
        assert got == t, f"seed {seed}, trial {trial}: {values}"


def test_traversals_match_the_recursive_references():
    seed = 4
    rng = random.Random(seed)
    for trial in range(50):
        t = random_shape(rng, rng.randint(0, 15))
        root = to_nodes(t)
        where = f"seed {seed}, trial {trial}: {to_level_list(t)}"
        assert inorder(root) == ref_inorder(t), where
        assert level_order(root) == ref_levels(t), where
        assert height(root) == ref_height(t), where


def test_build_creates_one_node_per_value():
    seed = 5
    rng = random.Random(seed)
    for trial in range(50):
        t = random_shape(rng, rng.randint(1, 15))
        values = to_level_list(t)
        seen = set()

        def walk(node):
            if node is not None:
                seen.add(id(node))
                walk(node.left)
                walk(node.right)

        walk(build_tree(values))
        want = sum(v is not None for v in values)
        assert len(seen) == want, f"seed {seed}, trial {trial}: {values}"


def test_inorder_and_level_order_survive_a_chain_far_deeper_than_the_stack():
    n = sys.getrecursionlimit() * 100
    root = chain(n)
    assert inorder(root) == list(range(n))
    levels = level_order(root)
    assert len(levels) == n and levels[0] == [n - 1] and levels[-1] == [0]


def test_build_tree_survives_a_deep_chain():
    n = sys.getrecursionlimit() * 100
    values = [0]
    for v in range(1, n):
        values += [v, None]
    root = build_tree(values)
    assert len(level_order(root)) == n


def test_height_recursion_is_as_deep_as_the_tree():
    assert height(chain(500)) == 499
    with pytest.raises(RecursionError):
        height(chain(sys.getrecursionlimit() * 2))
