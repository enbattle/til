"""Tests for the Dijkstra entry's Python code.

API: ``dijkstra(graph, source) -> (dist, parent)`` and
``shortest_path(graph, source, target) -> list[int] | None``. A graph maps a
vertex to a list of ``(neighbour, weight)`` pairs. ``dist`` and ``parent`` hold
only the vertices reachable from the source. The reference is a brute-force
relaxation: lower every distance along every edge until nothing changes.
"""

import random

from dijkstra import dijkstra, shortest_path

Graph = dict[int, list[tuple[int, int]]]


def relax_until_stable(graph: Graph, source: int) -> dict[int, int]:
    dist = {source: 0}
    changed = True
    while changed:
        changed = False
        for v, edges in graph.items():
            if v not in dist:
                continue
            for w, weight in edges:
                if w not in dist or dist[v] + weight < dist[w]:
                    dist[w] = dist[v] + weight
                    changed = True
    return dist


def random_graph(rng: random.Random) -> tuple[Graph, int]:
    n = rng.randint(1, 9)
    graph: Graph = {v: [] for v in range(n) if rng.random() < 0.9}
    for _ in range(rng.randint(0, 3 * n)):
        # Endpoints are drawn independently, so self-loops and parallel edges
        # both occur; weights include 0.
        v, w = rng.randrange(n), rng.randrange(n)
        graph.setdefault(v, []).append((w, rng.randint(0, 9)))
    return graph, rng.randrange(n)


def route_cost(graph: Graph, path: list[int]) -> int:
    """The cost of a route, taking the cheapest of any parallel edges."""
    return sum(
        min(wt for nb, wt in graph[a] if nb == b) for a, b in zip(path, path[1:])
    )


def test_source_alone():
    assert dijkstra({}, 7) == ({7: 0}, {7: None})
    assert dijkstra({7: []}, 7) == ({7: 0}, {7: None})
    assert shortest_path({7: []}, 7, 7) == [7]


def test_worked_example_from_the_entry():
    graph: Graph = {
        0: [(1, 4), (2, 1)],
        1: [(3, 1)],
        2: [(1, 2), (3, 5)],
        3: [],
        4: [(3, 1)],
    }
    dist, parent = dijkstra(graph, 0)
    assert dist == {0: 0, 1: 3, 2: 1, 3: 4}
    assert parent == {0: None, 1: 2, 2: 0, 3: 1}
    assert shortest_path(graph, 0, 3) == [0, 2, 1, 3]


def test_unreachable_vertices_are_absent():
    graph: Graph = {0: [(1, 5)], 1: [], 2: [(0, 1)]}
    dist, parent = dijkstra(graph, 0)
    assert dist == {0: 0, 1: 5}
    assert 2 not in parent
    assert shortest_path(graph, 0, 2) is None
    assert shortest_path(graph, 0, 99) is None


def test_edges_are_directed():
    graph: Graph = {0: [(1, 1)], 1: []}
    assert dijkstra(graph, 1)[0] == {1: 0}


def test_zero_weight_edges_and_zero_weight_cycle():
    graph: Graph = {0: [(1, 0)], 1: [(2, 0), (0, 0)], 2: [(1, 0), (3, 4)], 3: []}
    dist, _ = dijkstra(graph, 0)
    assert dist == {0: 0, 1: 0, 2: 0, 3: 4}
    assert shortest_path(graph, 0, 3) == [0, 1, 2, 3]


def test_parallel_edges_use_the_cheapest():
    graph: Graph = {0: [(1, 9), (1, 3), (1, 5)], 1: []}
    assert dijkstra(graph, 0)[0] == {0: 0, 1: 3}


def test_self_loops_change_nothing():
    graph: Graph = {0: [(0, 0), (0, 5), (1, 2)], 1: [(1, 1)]}
    assert dijkstra(graph, 0) == ({0: 0, 1: 2}, {0: None, 1: 0})


def test_a_cheaper_route_with_more_edges_wins():
    graph: Graph = {0: [(2, 10), (1, 1)], 1: [(2, 1)], 2: []}
    assert dijkstra(graph, 0)[0][2] == 2
    assert shortest_path(graph, 0, 2) == [0, 1, 2]


def test_path_to_the_source_is_just_the_source():
    graph: Graph = {0: [(1, 1)], 1: [(0, 1)]}
    assert shortest_path(graph, 0, 0) == [0]


def test_vertex_zero_in_the_middle_of_a_path():
    graph: Graph = {5: [(0, 1)], 0: [(3, 1)], 3: []}
    assert shortest_path(graph, 5, 3) == [5, 0, 3]


def test_negative_edge_counterexample_from_the_entry():
    # Out of contract. The settle-on-first-pop textbook version would report 2
    # for vertex 1; this code, which lets a lower distance be pushed again, is
    # repaired by the stale-entry check and ends with the true cost 1.
    graph: Graph = {0: [(1, 2), (2, 3)], 1: [], 2: [(1, -2)]}
    assert dijkstra(graph, 0)[0] == {0: 0, 1: 1, 2: 3}


def test_matches_brute_force_relaxation_on_many_random_graphs():
    for seed in range(50):
        graph, source = random_graph(random.Random(seed))
        dist, parent = dijkstra(graph, source)
        assert dist == relax_until_stable(graph, source), f"seed {seed}"
        assert parent.keys() == dist.keys(), f"seed {seed}"
        for v in dist:
            path = shortest_path(graph, source, v)
            assert path is not None and path[0] == source and path[-1] == v, (
                f"seed {seed}, vertex {v}"
            )
            assert route_cost(graph, path) == dist[v], f"seed {seed}, vertex {v}"
            assert len(set(path)) == len(path), f"seed {seed}: path repeats a vertex"
