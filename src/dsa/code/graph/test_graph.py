"""The graph entry's Python code.

API: ``Graph(directed=False)`` (adjacency lists, any hashable vertex) and
``AdjacencyMatrix(n, directed=False)`` (vertices 0 to n - 1), each with
``add_edge`` and ``remove_edge`` (both return whether anything changed),
``has_edge``, ``neighbours``, ``degree``, ``vertices`` and an ``edge_count``
property. ``Graph`` also has ``add_vertex``.
"""

import random

import pytest

from graph import AdjacencyMatrix, Graph


@pytest.mark.parametrize("directed", [False, True])
def test_starts_empty(directed):
    g = Graph(directed)
    assert g.vertices() == []
    assert g.edge_count == 0
    assert g.has_edge("a", "b") is False
    assert g.remove_edge("a", "b") is False
    m = AdjacencyMatrix(0, directed)
    assert m.vertices() == []
    assert m.edge_count == 0


def test_add_vertex_alone_and_twice():
    g = Graph()
    g.add_vertex("a")
    g.add_vertex("a")
    assert g.vertices() == ["a"]
    assert g.neighbours("a") == []
    assert g.degree("a") == 0
    assert g.edge_count == 0


def test_the_worked_example_undirected():
    g = Graph()
    for u, v in [(0, 1), (0, 2), (1, 2), (2, 3)]:
        assert g.add_edge(u, v) is True
    assert g.vertices() == [0, 1, 2, 3]
    assert [g.neighbours(v) for v in range(4)] == [[1, 2], [0, 2], [0, 1, 3], [2]]
    assert [g.degree(v) for v in range(4)] == [2, 2, 3, 1]
    assert g.edge_count == 4
    m = AdjacencyMatrix(4)
    for u, v in [(0, 1), (0, 2), (1, 2), (2, 3)]:
        m.add_edge(u, v)
    assert [[int(m.has_edge(u, v)) for v in range(4)] for u in range(4)] == [
        [0, 1, 1, 0],
        [1, 0, 1, 0],
        [1, 1, 0, 1],
        [0, 0, 1, 0],
    ]
    assert m.edge_count == 4


def test_the_worked_example_directed():
    g = Graph(directed=True)
    for u, v in [(0, 1), (0, 2), (1, 2), (2, 3)]:
        g.add_edge(u, v)
    assert [g.neighbours(v) for v in range(4)] == [[1, 2], [2], [3], []]
    assert g.has_edge(0, 1) is True
    assert g.has_edge(1, 0) is False
    assert g.edge_count == 4
    m = AdjacencyMatrix(4, directed=True)
    for u, v in [(0, 1), (0, 2), (1, 2), (2, 3)]:
        m.add_edge(u, v)
    assert [m.neighbours(v) for v in range(4)] == [[1, 2], [2], [3], []]
    assert m.has_edge(1, 0) is False


def test_undirected_edges_are_symmetric():
    g = Graph()
    g.add_edge("a", "b")
    assert g.has_edge("a", "b") and g.has_edge("b", "a")
    assert g.add_edge("b", "a") is False
    assert g.edge_count == 1
    assert g.remove_edge("b", "a") is True
    assert not g.has_edge("a", "b") and not g.has_edge("b", "a")
    assert g.neighbours("a") == [] and g.neighbours("b") == []
    assert g.edge_count == 0


def test_directed_edges_go_one_way():
    g = Graph(directed=True)
    g.add_edge("a", "b")
    assert g.neighbours("b") == []
    assert g.add_edge("b", "a") is True
    assert g.edge_count == 2
    assert g.remove_edge("a", "b") is True
    assert g.has_edge("b", "a") is True
    assert g.neighbours("a") == []


def test_duplicate_edges_are_ignored():
    g = Graph()
    assert g.add_edge(1, 2) is True
    assert g.add_edge(1, 2) is False
    assert g.neighbours(1) == [2]
    assert g.neighbours(2) == [1]
    assert g.edge_count == 1
    m = AdjacencyMatrix(3)
    assert m.add_edge(1, 2) is True
    assert m.add_edge(2, 1) is False
    assert m.edge_count == 1


@pytest.mark.parametrize("directed", [False, True])
def test_self_loops(directed):
    g = Graph(directed)
    assert g.add_edge("a", "a") is True
    assert g.neighbours("a") == ["a"]
    assert g.degree("a") == 1
    assert g.has_edge("a", "a") is True
    assert g.add_edge("a", "a") is False
    assert g.edge_count == 1
    assert g.remove_edge("a", "a") is True
    assert g.neighbours("a") == []
    assert g.edge_count == 0
    m = AdjacencyMatrix(2, directed)
    assert m.add_edge(1, 1) is True
    assert m.neighbours(1) == [1]
    assert m.degree(1) == 1
    assert m.edge_count == 1
    assert m.remove_edge(1, 1) is True
    assert m.edge_count == 0


def test_self_loop_next_to_other_neighbours():
    g = Graph()
    g.add_edge("a", "b")
    g.add_edge("a", "a")
    g.add_edge("a", "c")
    assert g.neighbours("a") == ["b", "a", "c"]
    assert g.degree("a") == 3
    assert g.remove_edge("a", "a") is True
    assert g.neighbours("a") == ["b", "c"]
    assert g.neighbours("c") == ["a"]
    assert g.edge_count == 2


def test_removing_an_absent_edge_changes_nothing():
    g = Graph()
    g.add_edge(1, 2)
    g.add_vertex(3)
    assert g.remove_edge(1, 3) is False
    assert g.remove_edge(1, 99) is False
    assert g.remove_edge(99, 1) is False
    assert g.edge_count == 1
    assert g.vertices() == [1, 2, 3]
    m = AdjacencyMatrix(3)
    assert m.remove_edge(0, 1) is False
    assert m.edge_count == 0


def test_remove_keeps_the_other_neighbours_in_order():
    g = Graph()
    for v in [1, 2, 3, 4]:
        g.add_edge(0, v)
    g.remove_edge(0, 2)
    assert g.neighbours(0) == [1, 3, 4]
    assert g.degree(0) == 3


def test_unknown_vertex():
    g = Graph()
    g.add_edge("a", "b")
    with pytest.raises(KeyError):
        g.neighbours("z")
    with pytest.raises(KeyError):
        g.degree("z")
    assert g.has_edge("z", "a") is False
    assert g.has_edge("a", "z") is False
    assert g.vertices() == ["a", "b"]


def test_add_edge_adds_missing_vertices():
    g = Graph(directed=True)
    g.add_edge("x", "y")
    assert g.vertices() == ["x", "y"]
    assert g.degree("y") == 0


def test_neighbours_returns_a_copy():
    g = Graph()
    g.add_edge(1, 2)
    g.neighbours(1).append(3)
    assert g.neighbours(1) == [2]
    assert g.has_edge(1, 3) is False


@pytest.mark.parametrize("bad", [-1, 3, 10])
def test_matrix_rejects_out_of_range_vertices(bad):
    m = AdjacencyMatrix(3)
    with pytest.raises(IndexError):
        m.add_edge(0, bad)
    with pytest.raises(IndexError):
        m.has_edge(bad, 0)
    with pytest.raises(IndexError):
        m.remove_edge(bad, 0)
    with pytest.raises(IndexError):
        m.neighbours(bad)
    with pytest.raises(IndexError):
        m.degree(bad)
    assert m.edge_count == 0
    assert all(m.neighbours(v) == [] for v in range(3))


def test_matrix_rejects_a_negative_size():
    with pytest.raises(ValueError):
        AdjacencyMatrix(-1)


def test_matrix_rows_are_independent():
    m = AdjacencyMatrix(3, directed=True)
    m.add_edge(0, 1)
    assert m.neighbours(0) == [1]
    assert m.neighbours(1) == []
    assert m.neighbours(2) == []


def test_list_and_matrix_match_a_set_of_pairs():
    for seed in range(50):
        rng = random.Random(seed)
        n = rng.randint(1, 7)
        directed = rng.random() < 0.5
        g = Graph(directed)
        for v in range(n):
            g.add_vertex(v)
        m = AdjacencyMatrix(n, directed)
        edges: set[tuple[int, int]] = set()

        def key(u: int, v: int, directed=directed) -> tuple[int, int]:
            return (u, v) if directed else (min(u, v), max(u, v))

        for step in range(rng.randint(0, 60)):
            at = f"seed {seed}, step {step}"
            u, v = rng.randrange(n), rng.randrange(n)
            if rng.random() < 0.6:
                expected = key(u, v) not in edges
                edges.add(key(u, v))
                assert g.add_edge(u, v) is expected, at
                assert m.add_edge(u, v) is expected, at
            else:
                expected = key(u, v) in edges
                edges.discard(key(u, v))
                assert g.remove_edge(u, v) is expected, at
                assert m.remove_edge(u, v) is expected, at
            assert g.edge_count == m.edge_count == len(edges), at
            for a in range(n):
                want = sorted(b for b in range(n) if key(a, b) in edges)
                assert sorted(g.neighbours(a)) == want, at
                assert m.neighbours(a) == want, at
                assert g.degree(a) == m.degree(a) == len(want), at
                for b in range(n):
                    assert g.has_edge(a, b) is m.has_edge(a, b) is (key(a, b) in edges), at
