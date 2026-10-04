"""Tests for the graph-bfs entry's Python code.

API:
- ``bfs_distances(graph, source) -> dict[int, int]``: fewest edges from source
  to each reachable vertex (the source itself maps to 0).
- ``shortest_path(graph, source, target) -> list[int] | None``: a path with
  the fewest edges, source first, or None when target is unreachable.
- ``nearest_target(grid) -> list[list[int | None]]``: multi-source BFS; steps
  to the nearest 'T', None for walls and cells that cannot reach a target.
"""

import random

from graph_bfs import bfs_distances, nearest_target, shortest_path


def brute_distances(graph, source):
    """Repeated relaxation: keep improving distances until nothing changes."""
    dist = {source: 0}
    changed = True
    while changed:
        changed = False
        for v, neighbours in graph.items():
            if v not in dist:
                continue
            for w in neighbours:
                if w not in dist or dist[w] > dist[v] + 1:
                    dist[w] = dist[v] + 1
                    changed = True
    return dist


def brute_grid(grid):
    rows = len(grid)
    cols = len(grid[0]) if rows else 0
    inf = float("inf")
    dist = [[0 if ch == "T" else inf for ch in row] for row in grid]
    changed = True
    while changed:
        changed = False
        for r in range(rows):
            for c in range(cols):
                if grid[r][c] == "#":
                    continue
                for nr, nc in ((r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1)):
                    if 0 <= nr < rows and 0 <= nc < cols and grid[nr][nc] != "#":
                        if dist[nr][nc] + 1 < dist[r][c]:
                            dist[r][c] = dist[nr][nc] + 1
                            changed = True
    return [
        [None if ch == "#" or d == inf else d for ch, d in zip(grid[r], dist[r])]
        for r in range(rows)
    ]


def random_graph(rng, n, edges, directed):
    graph = {v: [] for v in range(n)}
    for _ in range(edges):
        a, b = rng.randrange(n), rng.randrange(n)  # a == b gives a self-loop
        graph[a].append(b)
        if not directed:
            graph[b].append(a)
    return graph


def assert_valid_path(graph, path, source, target, at=""):
    assert path[0] == source and path[-1] == target, at
    for a, b in zip(path, path[1:]):
        assert b in graph[a], at


def test_distances_small_graph():
    graph = {0: [1, 2], 1: [3], 2: [3], 3: [4], 4: []}
    assert bfs_distances(graph, 0) == {0: 0, 1: 1, 2: 1, 3: 2, 4: 3}


def test_unreachable_vertex_is_absent():
    graph = {0: [1], 1: [], 2: [0]}
    assert bfs_distances(graph, 0) == {0: 0, 1: 1}
    assert shortest_path(graph, 0, 2) is None


def test_self_loop_and_cycle():
    graph = {0: [0, 1], 1: [1, 0, 2], 2: [2]}
    assert bfs_distances(graph, 0) == {0: 0, 1: 1, 2: 2}
    assert shortest_path(graph, 0, 2) == [0, 1, 2]


def test_disconnected_graph():
    graph = {0: [1], 1: [0], 2: [3], 3: [2]}
    assert bfs_distances(graph, 0) == {0: 0, 1: 1}
    assert shortest_path(graph, 0, 3) is None
    assert shortest_path(graph, 2, 3) == [2, 3]


def test_source_equals_target():
    graph = {0: [1], 1: [0]}
    assert shortest_path(graph, 0, 0) == [0]
    assert shortest_path({5: []}, 5, 5) == [5]


def test_source_without_adjacency_entry():
    assert bfs_distances({}, 7) == {7: 0}
    assert shortest_path({}, 7, 7) == [7]
    assert shortest_path({}, 7, 8) is None


def test_target_missing_from_graph():
    assert shortest_path({0: [1], 1: []}, 0, 99) is None


def test_shortest_path_prefers_fewest_edges():
    graph = {0: [1, 4], 1: [2], 2: [3], 3: [5], 4: [5], 5: []}
    assert shortest_path(graph, 0, 5) == [0, 4, 5]


def test_random_graphs_match_relaxation():
    rng = random.Random(2024)
    for trial in range(50):
        n = rng.randint(1, 12)
        graph = random_graph(rng, n, rng.randint(0, 3 * n), rng.random() < 0.5)
        source = rng.randrange(n)
        at = f"seed 2024, trial {trial}, source {source}: {graph}"
        expected = brute_distances(graph, source)
        assert bfs_distances(graph, source) == expected, at
        for target in range(n):
            path = shortest_path(graph, source, target)
            at_target = f"{at}, target {target}"
            if target not in expected:
                assert path is None, at_target
            else:
                assert path is not None, at_target
                assert len(path) - 1 == expected[target], at_target
                assert_valid_path(graph, path, source, target, at_target)


def test_grid_example():
    grid = ["T.#.", "..#.", "...T"]
    assert nearest_target(grid) == [
        [0, 1, None, 2],
        [1, 2, None, 1],
        [2, 2, 1, 0],
    ]


def test_grid_walls_block_and_cut_off():
    grid = ["T#.", "##.", "..."]
    assert nearest_target(grid) == [[0, None, None], [None] * 3, [None] * 3]


def test_grid_all_walls():
    assert nearest_target(["###", "###"]) == [[None] * 3, [None] * 3]


def test_grid_no_targets():
    assert nearest_target(["...", ".#."]) == [[None] * 3, [None, None, None]]


def test_grid_empty_and_single_cell():
    assert nearest_target([]) == []
    assert nearest_target(["T"]) == [[0]]
    assert nearest_target(["."]) == [[None]]


def test_grid_all_targets():
    assert nearest_target(["TT", "TT"]) == [[0, 0], [0, 0]]


def test_random_grids_match_relaxation():
    rng = random.Random(7)
    for trial in range(50):
        rows, cols = rng.randint(1, 8), rng.randint(1, 8)
        weights = rng.choice([(1, 1, 1), (6, 3, 1), (3, 5, 0), (5, 4, 1)])
        grid = [
            "".join(rng.choices(".#T", weights=weights, k=cols)) for _ in range(rows)
        ]
        assert nearest_target(grid) == brute_grid(grid), f"seed 7, trial {trial}: {grid}"
