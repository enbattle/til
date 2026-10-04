import random
from collections import Counter
from itertools import combinations

import pytest

from prim_kruskal import Edge, kruskal, prim, total_weight

ALGORITHMS = [kruskal, prim]


def is_spanning_tree(n: int, tree: list[Edge]) -> bool:
    """n - 1 edges that join all n vertices (so none closes a cycle)."""
    parent = list(range(n))

    def find(x: int) -> int:
        while parent[x] != x:
            x = parent[x]
        return x

    for u, v, _ in tree:
        root_u, root_v = find(u), find(v)
        if root_u == root_v:
            return False
        parent[root_u] = root_v
    return len(tree) == max(n - 1, 0)


def normalized(edges: list[Edge]) -> list[Edge]:
    """Each edge with its smaller endpoint first, since Prim orients edges."""
    return [(min(u, v), max(u, v), w) for u, v, w in edges]


def brute_force_weight(n: int, edges: list[Edge]) -> int:
    """The cheapest total over every subset of n - 1 edges that spans."""
    best = None
    for subset in combinations(edges, n - 1):
        if is_spanning_tree(n, list(subset)):
            weight = total_weight(subset)
            if best is None or weight < best:
                best = weight
    assert best is not None
    return best


def random_connected_graph(rng: random.Random) -> tuple[int, list[Edge]]:
    n = rng.randint(2, 6)
    edges: list[Edge] = []
    for v in range(1, n):  # a random tree first, so the graph is connected
        edges.append((rng.randrange(v), v, rng.randint(-5, 5)))
    for _ in range(rng.randint(0, 5)):  # extras: may repeat a pair or be a self-loop
        edges.append((rng.randrange(n), rng.randrange(n), rng.randint(-5, 5)))
    rng.shuffle(edges)
    return n, edges


@pytest.mark.parametrize("algorithm", ALGORITHMS)
class TestSpanningTree:
    def test_matches_brute_force_on_random_connected_graphs(self, algorithm):
        rng = random.Random(7)
        for trial in range(50):
            n, edges = random_connected_graph(rng)
            tree = algorithm(n, edges)
            where = f"seed 7, trial {trial}: {(n, edges, tree)}"
            assert tree is not None, where
            assert is_spanning_tree(n, tree), where
            assert not Counter(normalized(tree)) - Counter(normalized(edges)), where
            assert total_weight(tree) == brute_force_weight(n, edges), where

    def test_empty_graph_and_single_vertex(self, algorithm):
        assert algorithm(0, []) == []
        assert algorithm(1, []) == []
        assert algorithm(1, [(0, 0, 3), (0, 0, -3)]) == []

    def test_two_vertices(self, algorithm):
        tree = algorithm(2, [(0, 1, 4)])
        assert tree is not None
        assert len(tree) == 1
        assert total_weight(tree) == 4

    def test_a_tree_already_returns_every_edge(self, algorithm):
        edges = [(0, 1, 5), (1, 2, -2), (1, 3, 9), (3, 4, 1)]
        tree = algorithm(5, edges)
        assert tree is not None
        assert len(tree) == 4
        assert total_weight(tree) == 13

    def test_parallel_edges_keep_the_cheapest(self, algorithm):
        edges = [(0, 1, 7), (1, 0, 2), (0, 1, 5), (1, 2, 3), (2, 1, 8)]
        tree = algorithm(3, edges)
        assert tree is not None
        assert total_weight(tree) == 5

    def test_self_loops_are_never_chosen(self, algorithm):
        tree = algorithm(2, [(0, 0, -100), (0, 1, 4), (1, 1, -100)])
        assert tree is not None
        assert total_weight(tree) == 4

    def test_ties_give_the_same_total_whichever_edges_win(self, algorithm):
        square = [(0, 1, 1), (1, 2, 1), (2, 3, 1), (3, 0, 1), (0, 2, 1)]
        tree = algorithm(4, square)
        assert tree is not None
        assert is_spanning_tree(4, tree)
        assert total_weight(tree) == 3

    def test_negative_weights(self, algorithm):
        edges = [(0, 1, -4), (1, 2, -1), (0, 2, -3), (2, 3, 2), (1, 3, -7)]
        tree = algorithm(4, edges)
        assert tree is not None
        assert total_weight(tree) == -14  # -7, -4, -3: the three cheapest, no cycle

    def test_disconnected_graph_gives_none(self, algorithm):
        assert algorithm(2, []) is None
        assert algorithm(4, [(0, 1, 1), (2, 3, 1)]) is None
        assert algorithm(3, [(0, 1, 1), (0, 0, 1), (1, 1, 1)]) is None

    def test_the_input_order_does_not_change_the_total(self, algorithm):
        rng = random.Random(3)
        for trial in range(50):
            n, edges = random_connected_graph(rng)
            expected = total_weight(algorithm(n, edges))
            rng.shuffle(edges)
            assert total_weight(algorithm(n, edges)) == expected, f"seed 3, trial {trial}: {(n, edges)}"


def test_the_worked_example_from_the_entry():
    edges = [(0, 1, 4), (0, 2, 1), (1, 2, 2), (1, 3, 5), (2, 3, 8)]
    assert kruskal(4, edges) == [(0, 2, 1), (1, 2, 2), (1, 3, 5)]
    assert prim(4, edges) == [(0, 2, 1), (2, 1, 2), (1, 3, 5)]


def test_prim_gives_the_same_total_from_any_start():
    rng = random.Random(21)
    for trial in range(50):
        n, edges = random_connected_graph(rng)
        expected = total_weight(kruskal(n, edges))
        for start in range(n):
            assert total_weight(prim(n, edges, start)) == expected, f"seed 21, trial {trial}: {(n, edges, start)}"
