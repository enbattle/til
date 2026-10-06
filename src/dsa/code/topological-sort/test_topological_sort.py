"""Tests for the topological-sort entry's Python code.

API: ``topological_sort(adj)`` is Kahn's algorithm and ``topological_sort_dfs(adj)``
reverses a depth-first finishing order; both return an order with every edge going
forward, or None on a cycle. ``course_order(n, prerequisites)`` takes (course,
prerequisite) pairs. ``adj[u]`` lists the vertices u points at.
"""

import random
import sys
import time
from itertools import permutations

import pytest

from topological_sort import course_order, topological_sort, topological_sort_dfs

BOTH = [topological_sort, topological_sort_dfs]

# The entry's running example: 0 -> 1, 0 -> 2, 1 -> 3, 2 -> 3, 3 -> 4.
RUNNING = [[1, 2], [3], [3], [4], []]
# The same with 4 -> 1 added, which closes the loop 1, 3, 4.
LOOPING = [[1, 2], [3], [3], [4], [1]]


def directed(n, edges):
    adj = [[] for _ in range(n)]
    for u, v in edges:
        adj[u].append(v)
    return adj


def goes_forward(adj, order):
    place = {u: i for i, u in enumerate(order)}
    return sorted(order) == list(range(len(adj))) and all(
        place[u] < place[v] for u, targets in enumerate(adj) for v in targets
    )


class Row(list):
    """A neighbor list that counts how many times it is scanned."""

    def __init__(self, items, scans):
        super().__init__(items)
        self.scans = scans

    def __iter__(self):
        self.scans[0] += 1
        return super().__iter__()


def counted(adj):
    scans = [0]
    return [Row(row, scans) for row in adj], scans


@pytest.mark.parametrize("sort", BOTH)
def test_empty_and_single_vertex(sort):
    assert sort([]) == []
    assert sort([[]]) == [0]


@pytest.mark.parametrize("sort", BOTH)
def test_cycles_return_none(sort):
    assert sort([[0]]) is None  # a self-loop
    assert sort([[1], [0]]) is None
    assert sort(LOOPING) is None
    # The loop is away from vertex 0 and not reachable from it, so a search that
    # stopped after the first start or ignored later ones would miss it.
    assert sort([[], [2], [3], [1]]) is None


@pytest.mark.parametrize("sort", BOTH)
def test_duplicate_edges_and_disconnected_vertices(sort):
    assert sort([[1, 1], []]) == [0, 1]
    assert goes_forward([[1, 1], [], [3], []], sort([[1, 1], [], [3], []]))
    assert sorted(sort([[], [], []])) == [0, 1, 2]


def test_exact_orders_on_the_running_example():
    # Kahn takes vertices as they become ready; the DFS method reverses the
    # finish order 4, 3, 1, 2, 0, so the two differ on the same graph.
    assert topological_sort(RUNNING) == [0, 1, 2, 3, 4]
    assert topological_sort_dfs(RUNNING) == [0, 2, 1, 3, 4]


def test_kahn_is_first_in_first_out():
    # 0 readies 2 then 1. A queue takes 2 first; a stack or a lowest-first scan
    # takes 1 first.
    assert topological_sort([[2, 1], [3], [3], []]) == [0, 2, 1, 3]
    # The DFS method flips that tie: 1 finishes after 2, so it comes out earlier.
    assert topological_sort_dfs([[2, 1], [3], [3], []]) == [0, 1, 2, 3]


def test_diamond_is_not_a_cycle():
    for sort in BOTH:
        assert sort([[1, 2], [3], [3], []]) is not None


def test_course_order():
    pairs = [(1, 0), (2, 0), (3, 1), (3, 2), (4, 3)]
    assert course_order(5, pairs) == [0, 1, 2, 3, 4]
    assert course_order(3, []) == [0, 1, 2]
    assert course_order(0, []) == []
    assert course_order(2, [(0, 1), (1, 0)]) is None


def test_kahn_scans_each_row_twice():
    # Once to count in-degrees and once when its vertex comes off the queue. This
    # catches a rescan of the rows; a rescan of the in-degree array reads no rows,
    # so the timing test below catches that one.
    for adj in (RUNNING, [[i + 1] for i in range(99)] + [[]]):
        rows, scans = counted(adj)
        assert topological_sort(rows) is not None
        assert scans[0] == 2 * len(adj)


def test_dfs_scans_each_row_once():
    # Finished vertices are never reset, so a chain of diamonds, with two routes
    # through each, still scans each row once; resetting would make it 2^12 walks.
    n = 12
    edges = []
    for i in range(n):
        a = 3 * i
        edges += [(a, a + 1), (a, a + 2), (a + 1, a + 3), (a + 2, a + 3)]
    adj = directed(3 * n + 1, edges)
    for graph in (RUNNING, adj):
        rows, scans = counted(graph)
        assert topological_sort_dfs(rows) is not None
        assert scans[0] == len(graph)


def timed(fn, *args):
    start = time.perf_counter()
    result = fn(*args)
    return result, time.perf_counter() - start


def test_kahn_is_linear_not_quadratic():
    # A chain keeps one vertex ready at a time, so any step that searches all the
    # vertices for the next ready one (even through the in-degree array, which the
    # row counts can't see) does V^2 work: seconds here, milliseconds for Kahn's.
    n = 8000
    chain = [[i + 1] for i in range(n - 1)] + [[]]
    order, elapsed = timed(topological_sort, chain)
    assert order == list(range(n))
    assert elapsed < 0.5
    # A source with n - 1 sinks keeps the queue near n, so popping from the front of
    # a plain list shifts about n items each time.
    n = 100_000
    fan = [list(range(1, n))] + [[] for _ in range(n - 1)]
    order, elapsed = timed(topological_sort, fan)
    assert order == list(range(n))
    assert elapsed < 0.5
    # Last, so a quadratic version fails above instead of grinding through this one:
    # a chain far deeper than the recursion limit, which Kahn's never recurses on.
    n = 50 * sys.getrecursionlimit()
    adj = [[i + 1] for i in range(n - 1)] + [[]]
    assert topological_sort(adj) == list(range(n))


def exists_order(adj):
    return any(goes_forward(adj, p) for p in permutations(range(len(adj))))


def test_matches_brute_force_on_random_graphs():
    rng = random.Random(7)
    seen = {True: 0, False: 0}
    for trial in range(50):
        n = rng.randint(1, 6)
        edges = [(rng.randrange(n), rng.randrange(n)) for _ in range(rng.randint(0, 7))]
        if trial % 2 == 0:
            # Orient along a shuffled labeling, so about half the graphs have an order.
            label = rng.sample(range(n), n)
            edges = [(u, v) if label[u] < label[v] else (v, u) for u, v in edges]
        adj = directed(n, edges)
        expected = exists_order(adj)
        seen[expected] += 1
        for sort in BOTH:
            result = sort(adj)
            msg = f"seed=7 trial={trial} {sort.__name__} adj={adj}"
            if expected:
                assert result is not None and goes_forward(adj, result), msg
            else:
                assert result is None, msg
    assert seen[True] > 10 and seen[False] > 10
