"""Tests for the shortest-paths entry's Python code.

API: ``dijkstra(graph, source)`` and ``bellman_ford(graph, source)`` take
``graph[u]`` as a list of ``(v, weight)`` pairs and return the cheapest cost
from source to every vertex (``math.inf`` if unreachable). ``bellman_ford``
returns ``None`` when a negative cycle is reachable from source.
"""

import heapq
import math
import random

import pytest

import shortest_paths
from shortest_paths import bellman_ford, dijkstra

INF = math.inf
# The entry's running example, and the same shape with a negative edge.
RUN = [[(1, 4), (2, 1)], [(3, 1)], [(1, 2), (3, 5)], []]
NEG = [[(1, 2), (2, 3)], [(3, 1)], [(1, -2)], []]
NEG_CYCLE = [[(1, 2), (2, 3)], [(2, 1)], [(1, -2)]]


class CountingGraph(list):
    """Counts reads of graph[u], one per time a vertex is scanned for edges."""

    reads = 0
    limit = 10**9

    def __getitem__(self, u):
        self.reads += 1
        if self.reads > self.limit:
            raise RuntimeError("scanned past the read limit")
        return super().__getitem__(u)


def counted(graph, limit=10**9) -> CountingGraph:
    g = CountingGraph(graph)
    g.limit = limit
    return g


def floyd_warshall(graph):
    """Brute force: all-pairs costs; dist[i][i] < 0 marks a negative cycle."""
    n = len(graph)
    d = [[INF] * n for _ in range(n)]
    for u in range(n):
        d[u][u] = 0
        for v, w in graph[u]:
            d[u][v] = min(d[u][v], w)
    for k in range(n):
        for i in range(n):
            for j in range(n):
                if d[i][k] + d[k][j] < d[i][j]:
                    d[i][j] = d[i][k] + d[k][j]
    return d


def random_graph(rng, n, lo, hi, edges):
    graph = [[] for _ in range(n)]
    for _ in range(edges):
        graph[rng.randrange(n)].append((rng.randrange(n), rng.randint(lo, hi)))
    return graph


@pytest.mark.parametrize("solve", [dijkstra, bellman_ford])
class TestBothAlgorithms:
    def test_running_example(self, solve):
        assert solve(RUN, 0) == [0, 3, 1, 4]

    def test_single_vertex(self, solve):
        assert solve([[]], 0) == [0]

    def test_unreachable_vertices_stay_infinite(self, solve):
        assert solve([[(1, 5)], [], [(0, 1)]], 0) == [0, 5, INF]

    def test_source_is_not_vertex_zero(self, solve):
        assert solve([[], [(0, 2)], [(1, 3)]], 2) == [5, 3, 0]

    def test_parallel_edges_and_self_loops(self, solve):
        graph = [[(1, 9), (1, 4), (0, 7), (1, 6)], [(1, 3)]]
        assert solve(graph, 0) == [0, 4]

    def test_zero_weight_edges_and_cycle(self, solve):
        # The read limit turns a relaxation that never ends into a failure.
        graph = counted([[(1, 0)], [(2, 0)], [(0, 0), (3, 5)], []], limit=1000)
        assert solve(graph, 0) == [0, 0, 0, 5]

    def test_large_weights(self, solve):
        big = int("1000")
        assert solve([[(1, big)], [(2, big)], []], 0) == [0, 1000, 2000]


def test_dijkstra_matches_floyd_warshall_on_random_graphs():
    for seed in range(50):
        rng = random.Random(seed)
        n = rng.randint(1, 8)
        graph = random_graph(rng, n, 0, 9, rng.randint(0, 20))
        source = rng.randrange(n)
        want = floyd_warshall(graph)[source]
        got = dijkstra(counted(graph, 1000), source)  # the limit stops a loop
        assert got == want, f"seed={seed} graph={graph}"


def test_bellman_ford_matches_floyd_warshall_on_negative_weights():
    cycles = 0
    for seed in range(50):
        rng = random.Random(seed)
        n = rng.randint(1, 7)
        graph = random_graph(rng, n, -3, 8, rng.randint(0, 14))
        source = rng.randrange(n)
        fw = floyd_warshall(graph)
        reachable = [v for v in range(n) if fw[source][v] < INF]
        cyclic = any(fw[v][v] < 0 for v in reachable)
        cycles += cyclic
        got = bellman_ford(counted(graph, 1000), source)
        want = None if cyclic else fw[source]
        assert got == want, f"seed={seed} graph={graph} source={source}"
    assert 0 < cycles < 50  # the trials must reach both outcomes


class TestDijkstraMechanism:
    def test_uses_a_heap_with_one_push_per_improvement(self, monkeypatch):
        pushes, pops = [], []
        real_push, real_pop = heapq.heappush, heapq.heappop
        monkeypatch.setattr(
            shortest_paths.heapq,
            "heappush",
            lambda h, x: (pushes.append(x), real_push(h, x))[1],
        )
        monkeypatch.setattr(
            shortest_paths.heapq,
            "heappop",
            lambda h: (pops.append(1), real_pop(h))[1],
        )
        dijkstra(RUN, 0)
        # Pushes after the source: 1@4, 2@1, 1@3, 3@6, 3@4. Every entry pops.
        assert sorted(pushes) == [(1, 2), (3, 1), (4, 1), (4, 3), (6, 3)]
        assert len(pops) == 6  # the source's entry plus the five pushes

    def test_scans_each_vertex_once_so_stale_entries_are_skipped(self):
        graph = counted(RUN)
        dijkstra(graph, 0)
        # Two entries are stale when they pop: (4, 1) and (6, 3). Without the
        # skip they would be scanned again, making six reads.
        assert graph.reads == 4

    def test_scan_count_on_a_larger_graph(self):
        n = 30
        graph = [[(v, 1 + (u * v) % 5) for v in range(n) if v != u] for u in range(n)]
        counter = counted(graph)
        dijkstra(counter, 0)
        assert counter.reads == n

    def test_a_negative_edge_forces_a_second_scan(self):
        graph = counted(NEG)
        assert dijkstra(graph, 0) == [0, 1, 3, 2]
        assert graph.reads == 5  # four vertices, but vertex 1 is scanned twice

    def test_a_negative_cycle_never_finishes(self):
        graph = counted(NEG_CYCLE, limit=1000)
        with pytest.raises(RuntimeError):
            dijkstra(graph, 0)


class TestBellmanFordMechanism:
    def test_negative_edge(self):
        assert bellman_ford(NEG, 0) == [0, 1, 3, 2]

    def test_negative_cycle_returns_none(self):
        assert bellman_ford(counted(NEG_CYCLE, 1000), 0) is None

    def test_negative_self_loop_is_a_cycle(self):
        graph = counted([[(1, 1)], [(1, -1)]], 1000)
        assert bellman_ford(graph, 0) is None

    def test_cycle_unreachable_from_source_is_ignored(self):
        graph = [[(1, 4)], [], [(3, -2)], [(2, -2)]]
        assert bellman_ford(graph, 0) == [0, 4, INF, INF]

    def test_cheapest_route_needing_n_minus_1_rounds(self):
        # The path n-1 -> ... -> 0 is scanned against its direction, so each
        # round fixes one more vertex: n - 1 changing rounds, then a quiet one.
        n = 6
        graph = [[(u - 1, 2)] if u > 0 else [] for u in range(n)]
        assert bellman_ford(graph, n - 1) == [2 * (n - 1 - v) for v in range(n)]

    def test_rounds_stop_when_nothing_changes(self):
        graph = counted(RUN)
        bellman_ford(graph, 0)
        # Rounds 1 and 2 change something, round 3 doesn't: 3 rounds x 4 vertices.
        assert graph.reads == 12

    def test_a_cycle_costs_exactly_n_rounds(self):
        graph = counted(NEG_CYCLE, 1000)
        assert bellman_ford(graph, 0) is None
        assert graph.reads == 3 * 3
