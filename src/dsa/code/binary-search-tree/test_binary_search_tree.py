"""The binary-search-tree entry's Python code.

API: ``BinarySearchTree(keys=())`` with ``insert`` and ``delete`` (each returns
whether the tree changed), ``in``, ``len()``, ``min()`` and ``max()`` (raise
ValueError when empty), iteration in ascending order, ``keys_between(lo, hi)``
(inclusive) and ``height()`` (edges on the longest root-to-leaf path, -1 when empty).
"""

import random

import pytest

from binary_search_tree import BinarySearchTree


def check(tree, expected):
    """The tree holds exactly ``expected`` and the BST invariant holds."""
    expected = sorted(expected)
    assert list(tree) == expected
    assert len(tree) == len(expected)
    for key in expected:
        assert key in tree

    # Every node lies strictly between the bounds its ancestors set. A stack, not
    # recursion, because the sorted-insert test builds a path 3000 nodes deep.
    nodes = 0
    stack = [(tree._root, None, None)]
    while stack:
        node, low, high = stack.pop()
        if node is None:
            continue
        nodes += 1
        assert (low is None or node.key > low) and (high is None or node.key < high)
        stack.append((node.left, low, node.key))
        stack.append((node.right, node.key, high))
    assert nodes == len(expected)


def test_empty_tree():
    tree = BinarySearchTree()
    assert len(tree) == 0
    assert list(tree) == []
    assert 5 not in tree
    assert tree.keys_between(0, 10) == []
    assert tree.height() == -1
    assert tree.delete(5) is False
    with pytest.raises(ValueError):
        tree.min()
    with pytest.raises(ValueError):
        tree.max()


def test_insert_contains_and_sorted_iteration():
    tree = BinarySearchTree([50, 30, 70, 20, 40, 60, 80, 65])
    check(tree, [50, 30, 70, 20, 40, 60, 80, 65])
    assert 45 not in tree
    assert tree.min() == 20
    assert tree.max() == 80
    assert tree.height() == 3


def test_duplicate_inserts_are_ignored():
    tree = BinarySearchTree()
    assert tree.insert(7) is True
    assert tree.insert(7) is False
    assert tree.insert(3) is True
    assert tree.insert(3) is False
    check(tree, [3, 7])


def test_single_node_delete_empties_the_tree():
    tree = BinarySearchTree([1])
    assert tree.delete(1) is True
    check(tree, [])
    assert tree.height() == -1
    assert tree.insert(2) is True
    check(tree, [2])


def test_delete_a_leaf():
    tree = BinarySearchTree([50, 30, 70, 20])
    assert tree.delete(20) is True
    check(tree, [50, 30, 70])


@pytest.mark.parametrize(
    "keys, victim",
    [
        ([50, 30, 20], 30),  # only a left child
        ([50, 30, 40], 30),  # only a right child
        ([50, 70, 60], 70),
        ([50, 70, 80], 70),
        ([50, 30], 50),  # the root, with only a left child
        ([50, 70], 50),  # the root, with only a right child
    ],
)
def test_delete_a_node_with_one_child(keys, victim):
    tree = BinarySearchTree(keys)
    assert tree.delete(victim) is True
    check(tree, [k for k in keys if k != victim])


def test_delete_the_root_with_two_children():
    keys = [50, 30, 70, 20, 40, 60, 80, 65]
    tree = BinarySearchTree(keys)
    assert tree.delete(50) is True
    check(tree, [k for k in keys if k != 50])
    assert tree._root.key == 60
    assert tree._root.right.left.key == 65


def test_delete_two_children_where_the_successor_is_the_right_child():
    tree = BinarySearchTree([50, 30, 70, 20, 40, 80])
    assert tree.delete(50) is True
    check(tree, [30, 70, 20, 40, 80])
    assert tree._root.key == 70
    assert tree._root.right.key == 80


def test_delete_an_inner_node_with_two_children():
    keys = [50, 30, 70, 20, 40, 35, 45, 36]
    tree = BinarySearchTree(keys)
    assert tree.delete(30) is True
    check(tree, [k for k in keys if k != 30])
    assert tree._root.left.key == 35


def test_delete_an_absent_key():
    tree = BinarySearchTree([2, 1, 3])
    assert tree.delete(4) is False
    assert tree.delete(0) is False
    assert tree.delete(2) is True
    assert tree.delete(2) is False
    check(tree, [1, 3])


def test_keys_between_is_inclusive():
    tree = BinarySearchTree([50, 30, 70, 20, 40, 60, 80, 65])
    assert tree.keys_between(30, 65) == [30, 40, 50, 60, 65]
    assert tree.keys_between(31, 64) == [40, 50, 60]
    assert tree.keys_between(0, 100) == [20, 30, 40, 50, 60, 65, 70, 80]
    assert tree.keys_between(65, 65) == [65]
    assert tree.keys_between(66, 69) == []
    assert tree.keys_between(81, 90) == []
    assert tree.keys_between(0, 19) == []
    assert tree.keys_between(60, 40) == []


def test_sorted_inserts_make_a_path():
    n = 3000
    tree = BinarySearchTree(range(n))
    assert tree.height() == n - 1
    check(tree, range(n))
    assert tree.keys_between(n - 3, n + 5) == [n - 3, n - 2, n - 1]
    for key in range(0, n, 2):
        assert tree.delete(key) is True
    check(tree, range(1, n, 2))
    descending = BinarySearchTree(range(n, 0, -1))
    assert descending.height() == n - 1
    assert descending.min() == 1


def test_random_inserts_stay_shallow():
    keys = list(range(1023))
    random.Random(1).shuffle(keys)
    tree = BinarySearchTree(keys)
    assert tree.height() < 40


OPERATIONS = ["insert", "insert", "delete", "delete", "contains", "range"]


def test_matches_a_sorted_set_on_random_operations():
    for seed in range(200):
        rng = random.Random(seed)
        tree = BinarySearchTree()
        model: set[int] = set()
        for _ in range(80):
            op = rng.choice(OPERATIONS)
            key = rng.randint(0, 30)
            if op == "insert":
                assert tree.insert(key) is (key not in model)
                model.add(key)
            elif op == "delete":
                assert tree.delete(key) is (key in model)
                model.discard(key)
            elif op == "contains":
                assert (key in tree) is (key in model)
            else:
                hi = rng.randint(-2, 32)
                expected = sorted(k for k in model if key <= k <= hi)
                assert tree.keys_between(key, hi) == expected
            assert list(tree) == sorted(model)
            assert len(tree) == len(model)
            if model:
                assert tree.min() == min(model)
                assert tree.max() == max(model)
        check(tree, model)
