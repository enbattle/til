"""Tests for the depth-first-search entry's Python code.

API: ``explore(adj, start, seen)`` marks what start reaches in ``seen``;
``count_components(adj)`` counts the pieces of an undirected graph;
``has_cycle(adj)`` is True when a directed graph loops; ``has_path_sum(root,
target)`` checks the root-to-leaf paths of a tree; ``diameter(root)`` counts the
edges of its longest path. ``adj[u]`` lists the neighbors of u.
"""

import random
import sys
from dataclasses import dataclass

import pytest

from depth_first_search import count_components, diameter, explore, has_cycle, has_path_sum


@dataclass(eq=False)
class Node:
    value: int
    left: "Node | None" = None
    right: "Node | None" = None


def build(values):
    """A tree from its level order, where None marks a missing child."""
    if not values or values[0] is None:
        return None
    root = Node(values[0])
    waiting, i = [root], 1
    for node in waiting:
        for side in ("left", "right"):
            if i < len(values) and values[i] is not None:
                setattr(node, side, Node(values[i]))
                waiting.append(getattr(node, side))
            i += 1
    return root


def undirected(n, edges):
    adj = [[] for _ in range(n)]
    for u, v in edges:
        adj[u].append(v)
        if u != v:
            adj[v].append(u)
    return adj


def directed(n, edges):
    adj = [[] for _ in range(n)]
    for u, v in edges:
        adj[u].append(v)
    return adj


EXAMPLE = [5, 4, 8, 11, None, 13, 4, 7, 2, None, None, 5, 1]
DIAMOND = [(0, 1), (0, 2), (1, 3), (2, 3)]


class CountingRow(list):
    """A neighbor list that counts how many times it is scanned."""

    scans = 0

    def __iter__(self):
        self.scans += 1
        return super().__iter__()

    def __reversed__(self):
        self.scans += 1
        return super().__reversed__()


class OrderedSet(set):
    """A set that remembers the order vertices were marked in."""

    def __init__(self):
        super().__init__()
        self.order: list[int] = []

    def add(self, item):
        self.order.append(item)
        super().add(item)


def counted(adj):
    return [CountingRow(row) for row in adj]


class CountingNode(Node):
    """A node that counts reads of its left child."""

    reads = 0

    @property
    def left(self):
        type(self).reads += 1
        return self._left

    @left.setter
    def left(self, value):
        self._left = value


def counting_chain(n):
    CountingNode.reads = 0
    root = node = CountingNode(1)
    for _ in range(n - 1):
        node.right = CountingNode(1)
        node = node.right
    return root


# ---- components ------------------------------------------------------------


def test_components_example_and_edges():
    assert count_components(undirected(6, [(0, 1), (1, 2), (3, 4)])) == 3
    assert count_components([]) == 0
    assert count_components([[]]) == 1
    assert count_components(undirected(4, [])) == 4
    assert count_components(undirected(3, [(0, 1), (1, 2), (0, 2)])) == 1
    assert count_components(undirected(2, [(1, 1)])) == 2


def test_explore_marks_only_the_reachable_part():
    seen: set[int] = set()
    explore(undirected(6, [(0, 1), (1, 2), (3, 4)]), 1, seen)
    assert seen == {0, 1, 2}
    explore(undirected(6, [(0, 1), (1, 2), (3, 4)]), 5, seen)
    assert seen == {0, 1, 2, 5}


def test_explore_goes_deep_before_backing_up():
    # Vertex 1 must be fully explored (reaching 3) before 2 is visited. A queue
    # gives 0, 1, 2, 3; marking on push gives 0, 1, 2, 3 with the reversal and
    # 0, 3, 2, 1 without it.
    seen = OrderedSet()
    explore([[1, 2, 3], [0, 3], [0], [0, 1]], 0, seen)
    assert seen.order == [0, 1, 3, 2]


def test_explore_scans_each_vertex_once():
    # Triangle plus a diamond: marking on pop would scan a vertex twice.
    adj = counted(undirected(5, [(0, 1), (0, 2), (1, 2), (2, 3), (1, 3), (3, 4)]))
    assert count_components(adj) == 1
    assert [row.scans for row in adj] == [1] * 5


def test_components_scans_every_row_exactly_once():
    rng = random.Random(7)
    for trial in range(50):
        n = rng.randint(0, 12)
        edges = [(rng.randrange(n), rng.randrange(n)) for _ in range(rng.randint(0, 14))] if n else []
        adj = counted(undirected(n, edges))
        count_components(adj)
        assert [row.scans for row in adj] == [1] * n, f"seed 7 trial {trial}"


def test_components_beat_the_recursion_limit():
    n = 10 * sys.getrecursionlimit()
    path = undirected(n, [(i, i + 1) for i in range(n - 1)])
    assert count_components(path) == 1


def test_components_match_label_merging():
    rng = random.Random(11)
    for trial in range(50):
        n = rng.randint(0, 12)
        edges = [(rng.randrange(n), rng.randrange(n)) for _ in range(rng.randint(0, 14))] if n else []
        groups = [{u} for u in range(n)]
        for u, v in edges:
            a = next(g for g in groups if u in g)
            b = next(g for g in groups if v in g)
            if a is not b:
                a |= b
                groups.remove(b)
        assert count_components(undirected(n, edges)) == len(groups), f"seed 11 trial {trial}"


# ---- cycles ----------------------------------------------------------------


def test_cycle_examples():
    assert has_cycle(directed(4, DIAMOND)) is False
    assert has_cycle(directed(4, DIAMOND + [(3, 0)])) is True
    assert has_cycle(directed(3, [(0, 1), (1, 2), (2, 1)])) is True
    assert has_cycle([]) is False
    assert has_cycle([[]]) is False
    assert has_cycle([[0]]) is True
    assert has_cycle(directed(2, [(0, 1), (1, 0)])) is True
    # The cycle is in a part no earlier start reaches.
    assert has_cycle(directed(4, [(0, 1), (2, 3), (3, 2)])) is True


def chain_of_diamonds(k):
    edges = []
    for i in range(k):
        a, b, c, nxt = 3 * i, 3 * i + 1, 3 * i + 2, 3 * i + 3
        edges += [(a, b), (a, c), (b, nxt), (c, nxt)]
    return 3 * k + 1, edges


def test_cycle_scans_each_vertex_once():
    # 2**20 paths run through this chain; a finished vertex must not be re-walked.
    n, edges = chain_of_diamonds(20)
    adj = counted(directed(n, edges))
    assert has_cycle(adj) is False
    assert [row.scans for row in adj] == [1] * n


def test_cycle_matches_peeling_sinks():
    rng = random.Random(13)
    for trial in range(50):
        n = rng.randint(0, 8)
        edges = [(rng.randrange(n), rng.randrange(n)) for _ in range(rng.randint(0, 10))] if n else []
        left = set(range(n))
        while True:
            sinks = {u for u in left if all(v not in left for a, v in edges if a == u)}
            if not sinks:
                break
            left -= sinks
        assert has_cycle(directed(n, edges)) == bool(left), f"seed 13 trial {trial}"


def test_cycle_recursion_is_limited_by_depth():
    n = 10 * sys.getrecursionlimit()
    path = directed(n, [(i, i + 1) for i in range(n - 1)])
    with pytest.raises(RecursionError):
        has_cycle(path)


# ---- trees -----------------------------------------------------------------


def test_path_sum_example():
    root = build(EXAMPLE)
    assert has_path_sum(root, 22) is True
    assert has_path_sum(root, 26) is True  # 5, 8, 13
    assert has_path_sum(root, 27) is True  # 5, 4, 11, 7
    assert has_path_sum(root, 18) is True  # 5, 8, 4, 1
    assert has_path_sum(root, 9) is False  # 5, 4 ends at a node with a child
    assert has_path_sum(root, 5) is False  # the root is not a leaf


def test_path_sum_edges():
    assert has_path_sum(None, 0) is False
    assert has_path_sum(build([7]), 7) is True
    assert has_path_sum(build([7]), 0) is False
    # A node with one child must not count its empty side as a path end.
    assert has_path_sum(build([1, 2]), 1) is False
    assert has_path_sum(build([1, None, 2]), 1) is False
    assert has_path_sum(build([1, -2, 3]), -1) is True
    # Equal values that are not the same small cached int.
    assert has_path_sum(build([int("1000")]), int("1000")) is True


def test_path_sum_matches_enumerating_paths():
    rng = random.Random(17)
    for trial in range(50):
        size = rng.randint(1, 12)
        values = [rng.randint(-5, 9) for _ in range(size)]
        levels = [values[0]] + [v if rng.random() < 0.75 else None for v in values[1:]]
        root = build(levels)
        sums, stack = set(), [(root, 0)]
        while stack:
            node, so_far = stack.pop()
            so_far += node.value
            if node.left is None and node.right is None:
                sums.add(so_far)
            stack += [(c, so_far) for c in (node.left, node.right) if c]
        for target in range(-12, 30):
            assert has_path_sum(root, target) == (target in sums), (
                f"seed 17 trial {trial} target {target}"
            )


def test_diameter_example_and_edges():
    assert diameter(build(EXAMPLE)) == 6
    assert diameter(None) == 0
    assert diameter(build([1])) == 0
    assert diameter(build([1, 2])) == 1
    assert diameter(build([1, 2, 3])) == 2
    # The longest path avoids the root: it turns at node 2.
    assert diameter(build([1, 2, None, 3, 4, 5, None, None, 6, 7])) == 5


def test_diameter_is_one_pass():
    assert diameter(counting_chain(60)) == 59
    assert CountingNode.reads == 60  # one left read per node, not a re-walk each


def test_diameter_matches_pairwise_distances():
    rng = random.Random(19)
    for trial in range(50):
        size = rng.randint(1, 13)
        levels = [0] + [0 if rng.random() < 0.75 else None for _ in range(size - 1)]
        root = build(levels)
        links: dict[Node, list[Node]] = {}
        stack = [root]
        while stack:
            node = stack.pop()
            links.setdefault(node, [])
            for child in (node.left, node.right):
                if child:
                    links.setdefault(child, []).append(node)
                    links[node].append(child)
                    stack.append(child)
        best = 0
        for start in links:
            dist, frontier = {start: 0}, [start]
            for node in frontier:
                for nxt in links[node]:
                    if nxt not in dist:
                        dist[nxt] = dist[node] + 1
                        frontier.append(nxt)
            best = max(best, *dist.values())
        assert diameter(root) == best, f"seed 19 trial {trial}"
