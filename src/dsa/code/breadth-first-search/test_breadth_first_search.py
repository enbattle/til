"""Tests for the breadth-first-search entry's Python code.

API: ``shortest_path(adj, source, target)`` takes an adjacency list (vertices
0 to n - 1, as in the graph entry) and returns a path with the fewest edges,
source first, or None; ``minutes_to_rot(grid)`` takes rows of 0 (empty), 1
(fresh) and 2 (rotten) and returns the minutes until no fresh cell is left, or
-1.
"""

import random

from breadth_first_search import minutes_to_rot, shortest_path

# The running example: two shortest routes from 0 to 5 exist, and 3 is reached
# from both 1 and 2 before it is popped.
EXAMPLE = [[1, 2], [0, 3], [0, 3, 4], [1, 2, 5], [2, 5], [3, 4]]


class CountingAdj(list):
    """An adjacency list that counts row reads, and stops a runaway loop."""

    def __init__(self, rows):
        super().__init__(rows)
        self.reads = 0

    def __getitem__(self, v):
        self.reads += 1
        # A search that forgot its visited set would loop forever on a cycle.
        if self.reads > 20 * len(self) + 20:
            raise AssertionError("row read far more often than once per vertex")
        return super().__getitem__(v)


def distances(adj, source):
    """Fewest edges to every vertex, by repeated relaxation (no queue)."""
    dist = {source: 0}
    changed = True
    while changed:
        changed = False
        for v, row in enumerate(adj):
            if v not in dist:
                continue
            for w in row:
                if w not in dist or dist[w] > dist[v] + 1:
                    dist[w] = dist[v] + 1
                    changed = True
    return dist


def random_graph(rng):
    n = rng.randint(1, 8)
    adj = [[] for _ in range(n)]
    for _ in range(rng.randint(0, 14)):
        u, v = rng.randrange(n), rng.randrange(n)
        adj[u].append(v)
        if rng.random() < 0.5:
            adj[v].append(u)
    return adj


class CountingGrid(list):
    """A grid whose cell reads are counted, and capped against a runaway loop."""

    def __init__(self, rows):
        super().__init__(CountingRow(self, row) for row in rows)
        self.reads = 0


class CountingRow(list):
    def __init__(self, grid, row):
        super().__init__(row)
        self.grid = grid

    def __getitem__(self, c):
        self.grid.reads += 1
        if self.grid.reads > 10_000:
            raise AssertionError("cells read far too often")
        return super().__getitem__(c)


def simulate(grid):
    """Minutes by spreading rot one minute at a time over the whole grid."""
    g = [row[:] for row in grid]
    minutes = 0
    while True:
        spread = [
            (r, c)
            for r, row in enumerate(g)
            for c, cell in enumerate(row)
            if cell == 1
            and any(
                0 <= r + dr < len(g)
                and 0 <= c + dc < len(row)
                and g[r + dr][c + dc] == 2
                for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1))
            )
        ]
        if not spread:
            return -1 if any(1 in row for row in g) else minutes
        for r, c in spread:
            g[r][c] = 2
        minutes += 1


class TestShortestPath:
    def test_running_example(self):
        # 3 is found from 1 first, so the path goes through 1.
        assert shortest_path(EXAMPLE, 0, 5) == [0, 1, 3, 5]

    def test_edge_cases(self):
        assert shortest_path([[]], 0, 0) == [0]
        assert shortest_path([[1], [0]], 0, 0) == [0]
        assert shortest_path([[1], [0]], 0, 1) == [0, 1]
        assert shortest_path([[1], [0], []], 0, 2) is None
        assert shortest_path([[1], []], 1, 0) is None  # directed: no way back
        assert shortest_path([[0, 1], [1]], 0, 1) == [0, 1]  # self-loops

    def test_parallel_edges_and_cycles(self):
        assert shortest_path([[1, 1, 2], [0, 2], [0, 1]], 0, 2) == [0, 2]
        assert shortest_path([[1], [2], [0]], 0, 2) == [0, 1, 2]

    def test_large_vertex_ids_compare_by_value(self):
        n = int("1001")
        adj = [[v + 1] if v + 1 < n else [] for v in range(n)]
        path = shortest_path(adj, int("0"), int("1000"))
        assert path == list(range(1001))

    def test_matches_brute_force_on_random_graphs(self):
        seed = 11
        rng = random.Random(seed)
        for trial in range(50):
            adj = random_graph(rng)
            for source in range(len(adj)):
                want = distances(adj, source)
                for target in range(len(adj)):
                    where = f"seed {seed}, trial {trial}: {adj} {source}->{target}"
                    path = shortest_path(adj, source, target)
                    if target not in want:
                        assert path is None, where
                        continue
                    assert path is not None, where
                    assert path[0] == source and path[-1] == target, where
                    assert len(path) == want[target] + 1, where
                    for a, b in zip(path, path[1:]):
                        assert b in adj[a], where

    def test_scans_each_vertex_once(self):
        # K5 plus an isolated vertex 5: every vertex is reachable from the
        # others by many routes, and the target never turns up. Each of the 5
        # vertices must be popped and scanned exactly once. Marking on pop
        # re-scans some, and trying every simple path scans far more.
        adj = CountingAdj([[w for w in range(5) if w != v] for v in range(5)] + [[]])
        assert shortest_path(adj, 0, 5) is None
        assert adj.reads == 5

    def test_stops_when_the_target_is_found(self):
        # A 100-vertex chain, target one step away: only vertex 0 is scanned.
        adj = CountingAdj([[v - 1, v + 1] if 0 < v < 99 else [1] for v in range(100)])
        assert shortest_path(adj, 0, 1) == [0, 1]
        assert adj.reads == 1


class TestMinutesToRot:
    def test_running_example(self):
        assert minutes_to_rot([[2, 1, 1], [1, 1, 0], [0, 1, 2]]) == 2
        # With only the first source, the far corner takes 4 minutes.
        assert minutes_to_rot([[2, 1, 1], [1, 1, 0], [0, 1, 1]]) == 4

    def test_edge_cases(self):
        assert minutes_to_rot([]) == 0
        assert minutes_to_rot([[]]) == 0
        assert minutes_to_rot([[0]]) == 0
        assert minutes_to_rot([[2]]) == 0
        assert minutes_to_rot([[1]]) == -1  # fresh, nothing rotten
        assert minutes_to_rot([[2, 2], [2, 2]]) == 0
        assert minutes_to_rot([[2, 1, 1, 1]]) == 3
        assert minutes_to_rot([[1], [1], [2]]) == 2
        assert minutes_to_rot([[2, 0, 1]]) == -1  # a wall of empty cells

    def test_does_not_wrap_around_the_edges(self):
        # grid[0][-1] is the fresh cell in Python, but it is not adjacent.
        assert minutes_to_rot([[2, 0, 1], [0, 0, 0]]) == -1
        assert minutes_to_rot([[2, 0], [0, 0], [1, 0]]) == -1

    def test_does_not_change_the_grid(self):
        grid = [[2, 1], [1, 1]]
        assert minutes_to_rot(grid) == 2
        assert grid == [[2, 1], [1, 1]]

    def test_matches_minute_by_minute_simulation_on_random_grids(self):
        seed = 13
        rng = random.Random(seed)
        for trial in range(50):
            rows, cols = rng.randint(1, 5), rng.randint(1, 5)
            grid = [[rng.choice((0, 1, 1, 2)) for _ in range(cols)] for _ in range(rows)]
            assert minutes_to_rot(grid) == simulate(grid), f"seed {seed}, trial {trial}: {grid}"

    def test_one_search_from_every_source(self):
        # The whole first column is rotten and the other 30 cells are fresh.
        # One search reads each cell about once to seed and four neighbors per
        # popped cell, so at most 5 reads per cell. A search per source repeats
        # the spread six times, about 700 reads, and repeated queuing of a
        # cell (marking on pop) also exceeds the bound.
        grid = CountingGrid([[2] + [1] * 5 for _ in range(6)])
        assert minutes_to_rot(grid) == 5
        assert 36 <= grid.reads <= 5 * 36
