"""The graph entry's Python code.

API: ``build_list(n, edges, directed=False)`` and ``build_matrix(...)`` (both
raise ValueError for a vertex outside 0..n-1), ``has_edge_list``,
``has_edge_matrix``, ``neighbors_matrix`` and the ``edges_of_list`` /
``edges_of_matrix`` generators, which yield each stored (u, v) pair.
"""

import random

import pytest

from graph import (
    build_list,
    build_matrix,
    edges_of_list,
    edges_of_matrix,
    has_edge_list,
    has_edge_matrix,
    neighbors_matrix,
)

# The entry's running example: 4 vertices, undirected edges 0-1, 0-2, 1-2, 2-3.
EXAMPLE = [(0, 1), (0, 2), (1, 2), (2, 3)]


class Row(list):
    """A matrix row that counts every cell read, by index or by iteration."""

    reads = 0

    def __getitem__(self, i):
        Row.reads += 1
        return super().__getitem__(i)

    def __iter__(self):
        for cell in super().__iter__():
            Row.reads += 1
            yield cell


def counted(m):
    Row.reads = 0
    return [Row(r) for r in m]


def test_example_list():
    assert build_list(4, EXAMPLE) == [[1, 2], [0, 2], [0, 1, 3], [2]]
    assert build_list(4, EXAMPLE, directed=True) == [[1, 2], [2], [3], []]


def test_example_matrix():
    assert build_matrix(4, EXAMPLE) == [
        [0, 1, 1, 0],
        [1, 0, 1, 0],
        [1, 1, 0, 1],
        [0, 0, 1, 0],
    ]
    assert build_matrix(4, EXAMPLE, directed=True)[2] == [0, 0, 0, 1]


def test_empty_and_single_vertex():
    assert build_list(0, []) == [] and build_matrix(0, []) == []
    assert build_list(1, []) == [[]] and build_matrix(1, []) == [[0]]
    assert list(edges_of_list([])) == [] and list(edges_of_matrix([])) == []


def test_rows_are_not_shared():
    adj = build_list(3, [(0, 1)], directed=True)
    assert adj == [[1], [], []]
    m = build_matrix(3, [(0, 1)], directed=True)
    assert m == [[0, 1, 0], [0, 0, 0], [0, 0, 0]]


def test_self_loop_is_one_entry_in_both_layouts():
    assert build_list(2, [(1, 1)]) == [[], [1]]
    assert build_matrix(2, [(1, 1)]) == [[0, 0], [0, 1]]
    assert list(edges_of_list(build_list(2, [(1, 1)]))) == [(1, 1)]


def test_duplicate_edge_is_kept_in_the_list_and_idempotent_in_the_matrix():
    assert build_list(2, [(0, 1), (0, 1)]) == [[1, 1], [0, 0]]
    assert build_matrix(2, [(0, 1), (0, 1)]) == [[0, 1], [1, 0]]


def test_has_edge_both_layouts():
    adj, m = build_list(4, EXAMPLE), build_matrix(4, EXAMPLE)
    for has, g in ((has_edge_list, adj), (has_edge_matrix, m)):
        assert has(g, 2, 3) and has(g, 3, 2)
        assert not has(g, 0, 3) and not has(g, 3, 0)
    directed = build_list(4, EXAMPLE, directed=True)
    assert has_edge_list(directed, 2, 3) and not has_edge_list(directed, 3, 2)


def test_large_ints_built_at_runtime_compare_by_value():
    n = int("1001")
    big = int("1000")
    adj = build_list(n, [(big, 1)])
    m = build_matrix(n, [(big, 1)])
    assert has_edge_list(adj, 1, int("1000"))
    assert has_edge_matrix(m, int("1000"), 1)
    assert neighbors_matrix(m, 1) == [big]


@pytest.mark.parametrize("build", [build_list, build_matrix])
@pytest.mark.parametrize("edge", [(0, 3), (3, 0), (-1, 0), (0, -1)])
def test_vertex_out_of_range_raises(build, edge):
    # -1 matters most: Python would quietly use the last vertex.
    with pytest.raises(ValueError):
        build(3, [edge])


def test_list_space_is_one_entry_per_edge_end():
    n = 1000
    edges = [(i, i + 1) for i in range(9)]
    adj = build_list(n, edges)
    assert len(adj) == n
    assert sum(len(row) for row in adj) == 2 * len(edges)
    assert sum(len(row) for row in build_list(n, edges, directed=True)) == 9


def test_matrix_space_is_v_squared_even_with_no_edges():
    m = build_matrix(30, [])
    assert len(m) == 30
    assert all(len(row) == 30 for row in m)


def test_matrix_has_edge_reads_one_cell():
    m = counted(build_matrix(50, [(i, (i * 7) % 50) for i in range(50)]))
    Row.reads = 0
    assert has_edge_matrix(m, 3, 21)
    assert Row.reads == 1


def test_matrix_visits_every_cell_but_list_only_its_entries():
    n, edges = 40, [(i, i + 1) for i in range(39)]
    m = counted(build_matrix(n, edges))
    assert len(list(edges_of_matrix(m))) == 2 * len(edges)
    assert Row.reads == n * n
    adj = [Row(r) for r in build_list(n, edges)]
    Row.reads = 0
    assert len(list(edges_of_list(adj))) == 2 * len(edges)
    assert Row.reads == 2 * len(edges)


def test_neighbors_matrix_scans_the_whole_row():
    m = counted(build_matrix(4, EXAMPLE))
    Row.reads = 0
    assert neighbors_matrix(m, 2) == [0, 1, 3]
    assert Row.reads == 4


def random_edges(rng, n):
    return [(rng.randrange(n), rng.randrange(n)) for _ in range(rng.randrange(0, 3 * n))]


@pytest.mark.parametrize("directed", [False, True])
def test_layouts_agree_with_the_edge_set(directed):
    rng = random.Random(7)
    for trial in range(50):
        n = rng.randrange(1, 12)
        edges = random_edges(rng, n)
        truth = set(edges) if directed else set(edges) | {(v, u) for u, v in edges}
        adj = build_list(n, edges, directed)
        m = build_matrix(n, edges, directed)
        msg = f"seed=7 trial={trial} n={n} directed={directed} edges={edges}"
        for u in range(n):
            for v in range(n):
                assert has_edge_list(adj, u, v) == ((u, v) in truth), msg
                assert has_edge_matrix(m, u, v) == ((u, v) in truth), msg
            assert sorted(set(adj[u])) == neighbors_matrix(m, u), msg
        assert set(edges_of_list(adj)) == truth == set(edges_of_matrix(m)), msg
