"""Tests for the binary-search-tree entry's Python code.

API: nodes are `Node(key)` with `left` and `right`; `insert(root, key)` and
`remove(root, key)` return the (possibly new) root, `contains(root, key)` is
a bool, `find(root, key)` returns (parent, node), `in_order(root)` yields keys
ascending and `is_valid(root)` checks the ordering rule against every ancestor.
"""

import random

import pytest

import binary_search_tree as bst
from binary_search_tree import Node, contains, find, in_order, insert, is_valid, remove

EXAMPLE = [50, 30, 70, 20, 40, 60, 80, 65]


def build(keys):
    root = None
    for key in keys:
        root = insert(root, key)
    return root


def keys_of(root):
    return list(in_order(root))


def height(root):
    """Edges on the longest downward path; -1 for an empty tree."""
    level = [] if root is None else [root]
    edges = -1
    while level:
        edges += 1
        level = [c for n in level for c in (n.left, n.right) if c is not None]
    return edges


def shape(node):
    if node is None:
        return None
    return (node.key, shape(node.left), shape(node.right))


def test_empty_tree():
    assert keys_of(None) == []
    assert not contains(None, 5)
    assert remove(None, 5) is None
    assert is_valid(None)
    assert find(None, 5) == (None, None)
    assert height(None) == -1


def test_single_node():
    root = insert(None, 7)
    assert (root.key, root.left, root.right) == (7, None, None)
    assert contains(root, 7) and not contains(root, 6)
    assert remove(root, 6) is root
    assert remove(root, 7) is None
    assert height(root) == 0


def test_the_running_example_shape():
    root = build(EXAMPLE)
    assert shape(root) == (
        50,
        (30, (20, None, None), (40, None, None)),
        (70, (60, None, (65, None, None)), (80, None, None)),
    )
    assert keys_of(root) == [20, 30, 40, 50, 60, 65, 70, 80]
    assert height(root) == 3


def test_the_same_keys_in_sorted_order_make_a_chain():
    root = build(sorted(EXAMPLE))
    assert keys_of(root) == sorted(EXAMPLE)
    assert height(root) == len(EXAMPLE) - 1


def test_find_returns_the_parent():
    root = build(EXAMPLE)
    parent, node = find(root, 65)
    assert (parent.key, node.key) == (60, 65)
    assert find(root, 50)[0] is None
    parent, node = find(root, 66)
    assert (parent.key, node) == (65, None)


def test_contains_present_and_absent():
    root = build(EXAMPLE)
    for key in EXAMPLE:
        assert contains(root, key)
    for key in [0, 25, 66, 100]:
        assert not contains(root, key)


def test_duplicate_insert_changes_nothing():
    root = build(EXAMPLE)
    before = shape(root)
    assert insert(root, 40) is root
    assert insert(root, 50) is root
    assert shape(root) == before


def test_keys_compare_by_value_not_identity():
    # int("1000") builds a fresh object each time; small ints are cached.
    root = build([int("1000"), int("500"), int("1500")])
    assert contains(root, int("1000"))
    assert contains(root, int("1500"))
    assert insert(root, int("500")) is root
    assert keys_of(root) == [500, 1000, 1500]
    root = remove(root, int("1000"))
    assert keys_of(root) == [500, 1500]


def test_negative_and_zero_keys():
    root = build([0, -5, 5, -10, 10])
    assert keys_of(root) == [-10, -5, 0, 5, 10]
    assert contains(root, -10)


def test_remove_a_leaf():
    root = remove(build(EXAMPLE), 20)
    assert keys_of(root) == [30, 40, 50, 60, 65, 70, 80]
    assert root.left.left is None


def test_remove_a_node_with_one_child():
    root = remove(build(EXAMPLE), 60)
    assert keys_of(root) == [20, 30, 40, 50, 65, 70, 80]
    assert root.right.left.key == 65


def test_remove_a_node_with_two_children_uses_the_successor():
    root = remove(build(EXAMPLE), 50)
    assert shape(root) == (
        60,
        (30, (20, None, None), (40, None, None)),
        (70, (65, None, None), (80, None, None)),
    )


def test_remove_when_the_successor_is_the_right_child():
    root = remove(build([50, 30, 70, 80]), 50)
    assert shape(root) == (70, (30, None, None), (80, None, None))


def test_remove_the_root_with_one_child_and_missing_keys():
    root = build([10, 20])
    assert remove(root, 99) is root
    root = remove(root, 10)
    assert shape(root) == (20, None, None)


def test_removing_everything_leaves_an_empty_tree():
    root = build(EXAMPLE)
    for key in EXAMPLE:
        root = remove(root, key)
        assert is_valid(root)
    assert root is None


def test_a_long_chain_does_not_overflow_the_stack():
    keys = list(range(1500))
    root = build(keys)
    assert keys_of(root) == keys
    assert is_valid(root)
    assert height(root) == 1499


def test_is_valid_rejects_a_far_ancestor_violation():
    # Every parent-child pair is ordered, but 60 sits left of 50.
    root = Node(50)
    root.left = Node(30)
    root.left.right = Node(60)
    assert not is_valid(root)
    root.left.right = Node(40)
    assert is_valid(root)


def test_is_valid_rejects_equal_keys_and_swapped_children():
    root = Node(5)
    root.right = Node(5)
    assert not is_valid(root)
    root = Node(5)
    root.left, root.right = Node(8), Node(2)
    assert not is_valid(root)


def test_random_inserts_and_removes_match_a_set():
    seed = 11
    rng = random.Random(seed)
    for trial in range(50):
        root, model = None, set()
        for step in range(40):
            key = rng.randint(0, 25)
            if rng.random() < 0.6:
                root = insert(root, key)
                model.add(key)
            else:
                root = remove(root, key)
                model.discard(key)
            where = f"seed={seed} trial={trial} step={step} key={key}"
            assert keys_of(root) == sorted(model), where
            assert is_valid(root), where
            assert contains(root, key) == (key in model), where


class Spy(Node):
    """A node that records which nodes had their key read."""

    reads: list[int] = []

    @property
    def key(self):
        Spy.reads.append(id(self))
        return self._key

    @key.setter
    def key(self, value):
        self._key = value


@pytest.fixture
def perfect_tree(monkeypatch):
    """Fifteen keys 1..15 in a perfect tree of height 3, every key read logged."""
    monkeypatch.setattr(bst, "Node", Spy)
    root = build([8, 4, 12, 2, 6, 10, 14, 1, 3, 5, 7, 9, 11, 13, 15])
    assert height(root) == 3
    return root


def visited(action):
    Spy.reads = []
    action()
    return len(set(Spy.reads))


def test_a_lookup_visits_only_the_nodes_on_one_path(perfect_tree):
    root = perfect_tree
    # Exactly depth + 1: more means it wandered, fewer means it didn't search.
    depths = {8: 0, 4: 1, 12: 1, 2: 2, 10: 2, 1: 3, 7: 3, 15: 3}
    for key, depth in depths.items():
        assert visited(lambda: contains(root, key)) == depth + 1, key
    for key in [0, 16]:
        assert visited(lambda: contains(root, key)) == 4, key


def test_insert_and_remove_stay_on_one_path(perfect_tree):
    root = perfect_tree
    assert visited(lambda: insert(root, 16)) == 4
    assert visited(lambda: remove(root, 1)) <= 4
    assert visited(lambda: remove(root, 8)) <= 4
    assert visited(lambda: remove(root, 12)) <= 4


def test_in_order_visits_every_node_once(perfect_tree):
    assert visited(lambda: keys_of(perfect_tree)) == 15
