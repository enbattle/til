"""Tests for the bellman-ford entry's Python code.

API: ``bellman_ford(n, edges, source)``, distances from ``source`` over
directed ``(u, v, weight)`` edges on vertices 0 to n - 1, ``math.inf`` for
unreachable vertices, or ``None`` if a negative cycle is reachable from
``source``. The reference is a brute force over every simple path and cycle.
"""

import math
import random

import pytest

from bellman_ford import bellman_ford

INF = math.inf


def brute_force(n, edges, source):
    """Minimum over all simple paths; None if a reachable simple cycle is negative."""
    out = [[] for _ in range(n)]
    for u, v, w in edges:
        out[u].append((v, w))

    best = [INF] * n
    best[source] = 0

    def paths(u, total, seen):
        for v, w in out[u]:
            if v not in seen:
                best[v] = min(best[v], total + w)
                paths(v, total + w, seen | {v})

    paths(source, 0, {source})

    def has_negative_cycle_through(start):
        def walk(u, total, seen):
            for v, w in out[u]:
                if v == start and total + w < 0:
                    return True
                if v not in seen and walk(v, total + w, seen | {v}):
                    return True
            return False

        return walk(start, 0, {start})

    if any(
        best[s] < INF and has_negative_cycle_through(s) for s in range(n)
    ):
        return None
    return best


def test_textbook_graph_with_negative_edge():
    edges = [(0, 1, 4), (0, 2, 5), (1, 2, -3), (2, 3, 2)]
    assert bellman_ford(4, edges, 0) == [0, 4, 1, 3]


def test_needs_all_n_minus_1_rounds_when_edges_are_listed_backwards():
    edges = [(3, 4, 1), (2, 3, -2), (1, 2, 3), (0, 1, 4), (0, 2, 10)]
    assert bellman_ford(5, edges, 0) == [0, 4, 7, 5, 6]


def test_same_graph_with_edges_in_path_order():
    edges = [(0, 1, 4), (0, 2, 10), (1, 2, 3), (2, 3, -2), (3, 4, 1)]
    assert bellman_ford(5, edges, 0) == [0, 4, 7, 5, 6]


def test_no_vertices_is_an_error():
    with pytest.raises(ValueError):
        bellman_ford(0, [], 0)


def test_source_out_of_range_is_an_error():
    with pytest.raises(ValueError):
        bellman_ford(3, [], 3)
    with pytest.raises(ValueError):
        bellman_ford(3, [], -1)


def test_single_vertex():
    assert bellman_ford(1, [], 0) == [0]


def test_single_vertex_with_zero_or_positive_self_loop():
    assert bellman_ford(1, [(0, 0, 0)], 0) == [0]
    assert bellman_ford(1, [(0, 0, 5)], 0) == [0]


def test_single_vertex_with_negative_self_loop():
    assert bellman_ford(1, [(0, 0, -1)], 0) is None


def test_no_edges_leaves_everything_else_infinite():
    assert bellman_ford(3, [], 1) == [INF, 0, INF]


def test_zero_weight_edges_and_zero_weight_cycle():
    edges = [(0, 1, 0), (1, 2, 0), (2, 0, 0), (2, 3, 0)]
    assert bellman_ford(4, edges, 0) == [0, 0, 0, 0]


def test_edges_are_directed():
    assert bellman_ford(2, [(1, 0, 1)], 0) == [0, INF]


def test_parallel_edges_use_the_cheapest():
    assert bellman_ford(2, [(0, 1, 5), (0, 1, -2), (0, 1, 3)], 0) == [0, -2]


def test_reachable_negative_cycle_returns_none():
    edges = [(0, 1, 1), (1, 2, -3), (2, 1, 1)]
    assert bellman_ford(3, edges, 0) is None


def test_negative_cycle_back_to_the_source_returns_none():
    assert bellman_ford(2, [(0, 1, 1), (1, 0, -2)], 0) is None


def test_unreachable_negative_cycle_is_ignored():
    edges = [(0, 1, 2), (2, 3, -3), (3, 2, 1)]
    assert bellman_ford(4, edges, 0) == [0, 2, INF, INF]


def test_negative_cycle_not_reachable_from_this_source_but_from_another():
    edges = [(0, 1, 2), (2, 3, -3), (3, 2, 1)]
    assert bellman_ford(4, edges, 2) is None


def test_stops_early_when_a_round_changes_nothing():
    class CountingEdges(list):
        passes = 0

        def __iter__(self):
            self.passes += 1
            return super().__iter__()

    # Listed in path order, one round settles the chain and the second changes
    # nothing, so it stops after 2 passes, not the 1999 a full run would make.
    n = 2000
    edges = CountingEdges((i, i + 1, -1) for i in range(n - 1))
    assert bellman_ford(n, edges, 0)[-1] == -(n - 1)
    assert edges.passes == 2


def random_graph(rng):
    n = rng.randint(1, 6)
    count = rng.randint(0, 12)
    if rng.random() < 0.5:
        # Arbitrary weights: negative cycles are common.
        edges = [
            (rng.randrange(n), rng.randrange(n), rng.randint(-5, 10))
            for _ in range(count)
        ]
    else:
        # Weight = non-negative cost + potential[u] - potential[v]: every cycle
        # sums to its costs, so there is no negative cycle, but edges can be
        # negative.
        pot = [rng.randint(-6, 6) for _ in range(n)]
        edges = []
        for _ in range(count):
            u, v = rng.randrange(n), rng.randrange(n)
            edges.append((u, v, rng.randint(0, 6) + pot[u] - pot[v]))
    return n, edges, rng.randrange(n)


def test_agrees_with_brute_force_on_many_random_graphs():
    rng = random.Random(7)
    none_count = 0
    negative_edge_count = 0
    for trial in range(50):
        n, edges, source = random_graph(rng)
        expected = brute_force(n, edges, source)
        assert bellman_ford(n, edges, source) == expected, (
            f"seed 7, trial {trial}: n={n}, edges={edges}, source={source}"
        )
        if expected is None:
            none_count += 1
        elif any(w < 0 for _, _, w in edges):
            negative_edge_count += 1
    # The sample reaches both kinds of graph: a negative cycle, and negative
    # edges with no negative cycle.
    assert none_count >= 5
    assert negative_edge_count >= 10


def test_edge_order_does_not_change_the_answer():
    rng = random.Random(21)
    for trial in range(50):
        n, edges, source = random_graph(rng)
        shuffled = edges[:]
        rng.shuffle(shuffled)
        assert bellman_ford(n, shuffled, source) == bellman_ford(n, edges, source), (
            f"seed 21, trial {trial}: n={n}, edges={edges}, source={source}"
        )
