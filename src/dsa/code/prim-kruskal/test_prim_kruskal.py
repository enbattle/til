import random
import time
from collections import Counter
from itertools import combinations

import pytest

from prim_kruskal import Edge, kruskal, prim

ALGORITHMS = [kruskal, prim]


def total_weight(tree: list[Edge]) -> int:
    return sum(w for _, _, w in tree)


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
            weight = total_weight(list(subset))
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


class Counted:
    """A weight that counts every comparison made on it, of any kind."""

    calls = 0

    def __init__(self, value: int) -> None:
        self.value = value

    def _count(self, other: "Counted") -> tuple[int, int]:
        Counted.calls += 1
        return self.value, other.value

    def __lt__(self, other: "Counted") -> bool:
        a, b = self._count(other)
        return a < b

    def __le__(self, other: "Counted") -> bool:
        a, b = self._count(other)
        return a <= b

    def __gt__(self, other: "Counted") -> bool:
        a, b = self._count(other)
        return a > b

    def __ge__(self, other: "Counted") -> bool:
        a, b = self._count(other)
        return a >= b

    def __eq__(self, other: object) -> bool:
        assert isinstance(other, Counted)
        a, b = self._count(other)
        return a == b

    __hash__ = None  # type: ignore[assignment]


def comparisons_on_a_sparse_graph(algorithm) -> tuple[int, int, int]:
    """(comparisons, V, E) on a 300-vertex graph with distinct weights.

    Sparse on purpose: a heap Prim does about E log E comparisons, but a Prim
    that scans every crossing edge for the minimum does about V * E / 2, and
    one that scans an array of best-known costs does about V * V / 2. Neither
    stays under the bound below, which a dense graph couldn't tell apart.
    """
    rng = random.Random(11)
    n = 300
    pairs = [(rng.randrange(v), v) for v in range(1, n)]
    pairs += [(rng.randrange(n), rng.randrange(n)) for _ in range(n)]
    weights = list(range(len(pairs)))
    rng.shuffle(weights)
    edges = [(u, v, Counted(w)) for (u, v), w in zip(pairs, weights)]
    Counted.calls = 0
    tree = algorithm(n, edges)
    assert tree is not None and len(tree) == n - 1
    return Counted.calls, n, len(edges)


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

    def test_an_edge_stored_once_still_connects_both_ends(self, algorithm):
        # (2, 0): Prim starts at 0, so it only finds 2 if both ends are stored.
        tree = algorithm(3, [(2, 0, 1), (2, 1, 1)])
        assert tree is not None
        assert total_weight(tree) == 2

    def test_input_is_not_reordered(self, algorithm):
        edges = [(0, 1, 9), (1, 2, 1), (0, 2, 5)]
        before = list(edges)
        algorithm(3, edges)
        assert edges == before

    def test_the_input_order_does_not_change_the_total(self, algorithm):
        rng = random.Random(3)
        for trial in range(50):
            n, edges = random_connected_graph(rng)
            expected = total_weight(algorithm(n, edges))
            rng.shuffle(edges)
            where = f"seed 3, trial {trial}: {(n, edges)}"
            assert total_weight(algorithm(n, edges)) == expected, where


def test_the_worked_example_pins_the_order_edges_are_taken():
    edges = [(0, 1, 4), (0, 2, 1), (1, 2, 2), (1, 3, 5), (2, 3, 8)]
    # Kruskal: cheapest first. Prim: each edge runs from the tree to the new vertex.
    assert kruskal(4, edges) == [(0, 2, 1), (1, 2, 2), (1, 3, 5)]
    assert prim(4, edges) == [(0, 2, 1), (2, 1, 2), (1, 3, 5)]


def test_kruskal_stops_at_n_minus_1_edges():
    # The sentinel is out of range and heaviest, so it sorts last. Looking at
    # it raises; stopping once the tree is full never does.
    assert kruskal(3, [(0, 1, 1), (1, 2, 2), (0, 99, 10**9)]) == [(0, 1, 1), (1, 2, 2)]


def test_kruskal_cycle_check_does_not_search_the_tree_built_so_far():
    # A star: every edge joins a new leaf to vertex 0. Searching the chosen
    # edges for each new one is O(E * V): about 2.4 s at this size, against
    # about 2 ms for union-find, so the 500 ms limit has a wide margin.
    n = 5000
    star = [(0, v, v) for v in range(1, n)]
    start = time.perf_counter()
    tree = kruskal(n, star)
    elapsed = time.perf_counter() - start
    assert tree is not None and len(tree) == n - 1
    assert elapsed < 0.5, f"{elapsed:.3f}s for {n} vertices"


def test_kruskal_sorts_instead_of_scanning_for_each_minimum():
    calls, n, m = comparisons_on_a_sparse_graph(kruskal)
    # Sorting takes about 4,800 here; a minimum scan per edge taken
    # is about V * E / 2 = 90,000.
    assert calls <= 12 * m, f"{calls} comparisons for {m} edges"


def test_prim_heap_keeps_comparisons_near_e_log_e():
    calls, n, m = comparisons_on_a_sparse_graph(prim)
    assert calls <= 40 * m, f"{calls} comparisons for {m} edges"


def test_prim_gives_the_same_total_as_kruskal_on_larger_graphs():
    rng = random.Random(21)
    for trial in range(50):
        n = rng.randint(2, 40)
        edges = [(rng.randrange(v), v, rng.randint(-50, 50)) for v in range(1, n)]
        edges += [(rng.randrange(n), rng.randrange(n), rng.randint(-50, 50))
                  for _ in range(rng.randint(0, 3 * n))]
        rng.shuffle(edges)
        where = f"seed 21, trial {trial}: {(n, edges)}"
        assert total_weight(prim(n, edges)) == total_weight(kruskal(n, edges)), where
