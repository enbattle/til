"""The tree-dfs entry's Python code, checked against brute force.

API:
- ``build_tree(values) -> TreeNode | None``: a tree from its level order.
- ``paths_with_sum(root, target) -> list[list[int]]``: every root-to-leaf path
  with that sum, left to right.
- ``diameter(root) -> int``: edges on the longest path between two nodes.
"""

import random
import sys

from tree_dfs import TreeNode, build_tree, diameter, paths_with_sum


def random_level_order(rng, max_nodes, low=-5, high=9):
    """A random tree as a level-order list, with None marking missing children."""
    count = rng.randint(0, max_nodes)
    if count == 0:
        return []
    values = [rng.randint(low, high)]
    waiting = 1  # nodes created that have not been given their child slots yet
    created = 1
    while waiting > 0:
        waiting -= 1
        for _ in range(2):
            if created < count and rng.random() < 0.65:
                values.append(rng.randint(low, high))
                created += 1
                waiting += 1
            else:
                values.append(None)
    while values and values[-1] is None:
        values.pop()
    return values


def brute_force_paths(root, target):
    """Walk with an immutable path (a new tuple per step), no shared state."""
    found = []
    stack = [(root, (root.value,))] if root is not None else []
    while stack:
        node, path = stack.pop()
        if node.left is None and node.right is None:
            if sum(path) == target:
                found.append(list(path))
        for child in (node.right, node.left):
            if child is not None:
                stack.append((child, path + (child.value,)))
    return found


def brute_force_diameter(root):
    """Longest shortest path over all node pairs, by BFS from every node."""
    if root is None:
        return 0
    neighbours = {}
    stack = [root]
    while stack:
        node = stack.pop()
        neighbours.setdefault(id(node), [])
        for child in (node.left, node.right):
            if child is not None:
                neighbours.setdefault(id(child), []).append(id(node))
                neighbours[id(node)].append(id(child))
                stack.append(child)
    longest = 0
    for start in neighbours:
        distance = {start: 0}
        queue = [start]
        for current in queue:
            for other in neighbours[current]:
                if other not in distance:
                    distance[other] = distance[current] + 1
                    queue.append(other)
        longest = max(longest, max(distance.values()))
    return longest


def chain(length, side="left"):
    root = None
    for value in range(length):
        if side == "left":
            root = TreeNode(value, root, None)
        else:
            root = TreeNode(value, None, root)
    return root


def test_build_tree_reads_level_order():
    root = build_tree([1, 2, 3, 4, None, 5, 6, None, 7])
    assert root.value == 1
    assert root.left.value == 2 and root.right.value == 3
    assert root.left.left.value == 4 and root.left.right is None
    assert root.left.left.right.value == 7
    assert root.right.left.value == 5 and root.right.right.value == 6
    assert build_tree([]) is None
    assert build_tree([None]) is None


def test_the_worked_example():
    root = build_tree([5, 4, 8, 11, None, 13, 4, 7, 2, None, None, 5, 1])
    assert paths_with_sum(root, 22) == [[5, 4, 11, 2], [5, 8, 4, 5]]
    assert paths_with_sum(root, 26) == [[5, 8, 13]]
    assert diameter(root) == 6


def test_empty_tree():
    assert paths_with_sum(None, 0) == []
    assert diameter(None) == 0


def test_single_node():
    root = build_tree([7])
    assert paths_with_sum(root, 7) == [[7]]
    assert paths_with_sum(root, 6) == []
    assert diameter(root) == 0


def test_a_line():
    for side in ("left", "right"):
        root = chain(6, side)
        values = []
        node = root
        while node is not None:
            values.append(node.value)
            node = node.left or node.right
        assert paths_with_sum(root, sum(values)) == [values]
        assert paths_with_sum(root, sum(values) + 1) == []
        assert diameter(root) == 5


def test_only_leaves_end_a_path():
    # 1 -> 2 has sum 3 at node 2, but node 2 has a child, so it is not a path.
    root = build_tree([1, 2, None, 5])
    assert paths_with_sum(root, 3) == []
    assert paths_with_sum(root, 8) == [[1, 2, 5]]


def test_negative_values_do_not_end_a_search_early():
    root = build_tree([1, -2, 3, 4, None, -5])
    assert paths_with_sum(root, 3) == [[1, -2, 4]]
    assert paths_with_sum(root, -1) == [[1, 3, -5]]
    root = build_tree([-3, -4, None, 6])
    assert paths_with_sum(root, -1) == [[-3, -4, 6]]


def test_each_path_is_its_own_list():
    root = build_tree([2, 1, 1])
    paths = paths_with_sum(root, 3)
    assert paths == [[2, 1], [2, 1]]
    assert paths[0] is not paths[1]
    paths[0].append(99)
    assert paths[1] == [2, 1]


def test_diameter_can_miss_the_root():
    # The longest path, 5-3-2-4-6, lies inside the left subtree and skips the root.
    root = build_tree([1, 2, None, 3, 4, 5, None, None, 6])
    assert diameter(root) == 4
    assert brute_force_diameter(root) == 4


def test_paths_agree_with_brute_force():
    rng = random.Random(11)
    for trial in range(50):
        values = random_level_order(rng, 14)
        root = build_tree(values)
        for target in range(-12, 25):
            assert paths_with_sum(root, target) == brute_force_paths(root, target), (
                f"seed 11, trial {trial}: {values}, target {target}"
            )


def test_diameter_agrees_with_brute_force():
    rng = random.Random(23)
    for trial in range(50):
        values = random_level_order(rng, 16)
        root = build_tree(values)
        assert diameter(root) == brute_force_diameter(root), (
            f"seed 23, trial {trial}: {values}"
        )


def test_does_not_change_the_tree():
    values = [3, 1, 4, None, 5, 9]
    root = build_tree(values)
    paths_with_sum(root, 9)
    diameter(root)
    assert paths_with_sum(root, 9) == brute_force_paths(root, 9)
    assert root.left.right.value == 5 and root.right.left.value == 9


def test_deep_chain_hits_the_recursion_limit():
    limit = sys.getrecursionlimit()
    assert limit == 1000  # the default; the entry quotes it
    assert diameter(chain(limit - 100)) == limit - 101
    deep = chain(limit + 100)
    try:
        diameter(deep)
    except RecursionError:
        pass
    else:
        raise AssertionError("expected RecursionError on a chain deeper than the limit")
