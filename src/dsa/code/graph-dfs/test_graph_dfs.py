"""Tests for graph_dfs: count_components, count_islands and has_cycle.

Graphs are dicts from vertex to a list of neighbours; every vertex is a key.
Grids are lists of lists of 0 (water) and 1 (land).
"""

import random
import sys
from collections import deque

from graph_dfs import count_components, count_islands, has_cycle


def undirected(n, edges):
    graph = {v: [] for v in range(n)}
    for u, v in edges:
        graph[u].append(v)
        graph[v].append(u)
    return graph


def directed(n, edges):
    graph = {v: [] for v in range(n)}
    for u, v in edges:
        graph[u].append(v)
    return graph


def reachable(graph, source):
    """Vertices reachable from source by a breadth-first search, source included."""
    found = {source}
    queue = deque([source])
    while queue:
        for nxt in graph[queue.popleft()]:
            if nxt not in found:
                found.add(nxt)
                queue.append(nxt)
    return found


def brute_components(graph):
    """Distinct reachability sets: in an undirected graph, one per component."""
    return len({frozenset(reachable(graph, v)) for v in graph})


def brute_has_cycle(graph):
    """A cycle exists exactly when some vertex can reach itself by 1+ edges."""
    return any(v in reachable(graph, nxt) for v in graph for nxt in graph[v])


def brute_islands(grid):
    """Label cells by repeated relabelling to the smallest neighbour label."""
    cells = {(r, c) for r, row in enumerate(grid) for c, x in enumerate(row) if x}
    label = {cell: cell for cell in cells}
    changed = True
    while changed:
        changed = False
        for r, c in cells:
            for near in ((r + 1, c), (r, c + 1), (r - 1, c), (r, c - 1)):
                if near in cells and label[near] < label[(r, c)]:
                    label[(r, c)] = label[near]
                    changed = True
    return len(set(label.values()))


def test_components_empty_graph():
    assert count_components({}) == 0


def test_components_single_and_isolated_vertices():
    assert count_components({0: []}) == 1
    assert count_components(undirected(5, [])) == 5


def test_components_examples():
    assert count_components(undirected(6, [(0, 1), (1, 2), (3, 4)])) == 3
    assert count_components(undirected(4, [(0, 1), (1, 2), (2, 3)])) == 1
    assert count_components(undirected(3, [(0, 1), (1, 2), (2, 0)])) == 1


def test_components_self_loop_and_parallel_edges():
    assert count_components(undirected(2, [(0, 0), (1, 1)])) == 2
    assert count_components(undirected(2, [(0, 1), (0, 1), (1, 0)])) == 1


def test_components_non_contiguous_labels():
    assert count_components({10: [20], 20: [10], 7: []}) == 2


def test_components_match_brute_force_on_random_graphs():
    rng = random.Random(1)
    for _ in range(400):
        n = rng.randint(0, 12)
        edges = [
            (rng.randrange(n), rng.randrange(n))
            for _ in range(rng.randint(0, 14) if n else 0)
        ]
        graph = undirected(n, edges)
        assert count_components(graph) == brute_components(graph), graph


def test_components_deep_path_does_not_overflow_the_call_stack():
    n = 5 * sys.getrecursionlimit()
    graph = undirected(n, [(i, i + 1) for i in range(n - 1)])
    assert count_components(graph) == 1


def test_islands_empty_and_all_water():
    assert count_islands([]) == 0
    assert count_islands([[]]) == 0
    assert count_islands([[0, 0, 0], [0, 0, 0]]) == 0


def test_islands_single_cell_and_all_land():
    assert count_islands([[1]]) == 1
    assert count_islands([[1, 1], [1, 1]]) == 1


def test_islands_examples():
    grid = [
        [1, 1, 0, 0, 0],
        [1, 1, 0, 0, 0],
        [0, 0, 1, 0, 0],
        [0, 0, 0, 1, 1],
    ]
    assert count_islands(grid) == 3


def test_islands_diagonal_cells_are_not_joined():
    assert count_islands([[1, 0], [0, 1]]) == 2


def test_islands_does_not_change_the_grid():
    grid = [[1, 0], [1, 1]]
    count_islands(grid)
    assert grid == [[1, 0], [1, 1]]


def test_islands_single_row_and_column():
    assert count_islands([[1, 0, 1, 1, 0, 1]]) == 3
    assert count_islands([[1], [0], [1], [1]]) == 2


def test_islands_match_brute_force_on_random_grids():
    rng = random.Random(2)
    for _ in range(400):
        rows, cols = rng.randint(1, 8), rng.randint(1, 8)
        density = rng.choice([0.2, 0.5, 0.8])
        grid = [[int(rng.random() < density) for _ in range(cols)] for _ in range(rows)]
        assert count_islands(grid) == brute_islands(grid), grid


def test_islands_large_snake_does_not_overflow_the_call_stack():
    n = 3 * sys.getrecursionlimit()
    assert count_islands([[1] * n]) == 1


def test_cycle_empty_and_isolated():
    assert not has_cycle({})
    assert not has_cycle(directed(4, []))


def test_cycle_self_loop():
    assert has_cycle(directed(1, [(0, 0)]))
    assert has_cycle(directed(3, [(0, 1), (2, 2)]))


def test_cycle_simple_loops():
    assert has_cycle(directed(2, [(0, 1), (1, 0)]))
    assert has_cycle(directed(3, [(0, 1), (1, 2), (2, 0)]))
    assert has_cycle(directed(4, [(0, 1), (1, 2), (2, 3), (3, 1)]))


def test_cycle_path_and_tree_have_none():
    assert not has_cycle(directed(4, [(0, 1), (1, 2), (2, 3)]))
    assert not has_cycle(directed(5, [(0, 1), (0, 2), (1, 3), (1, 4)]))


def test_cycle_diamond_is_not_a_cycle():
    # 0 -> 1 -> 3 and 0 -> 2 -> 3: vertex 3 is reached twice, but nothing loops.
    assert not has_cycle(directed(4, [(0, 1), (0, 2), (1, 3), (2, 3)]))


def test_cycle_edge_that_points_back_to_finished_vertex_is_fine():
    assert not has_cycle(directed(3, [(0, 1), (1, 2), (0, 2)]))


def test_cycle_found_after_acyclic_branches():
    assert has_cycle(directed(6, [(0, 1), (2, 3), (3, 4), (4, 2), (5, 0)]))


def test_cycle_matches_brute_force_on_random_graphs():
    rng = random.Random(3)
    seen_cycle = seen_acyclic = False
    for _ in range(600):
        n = rng.randint(0, 9)
        edges = [
            (rng.randrange(n), rng.randrange(n))
            for _ in range(rng.randint(0, 11) if n else 0)
        ]
        graph = directed(n, edges)
        expected = brute_has_cycle(graph)
        assert has_cycle(graph) == expected, graph
        seen_cycle |= expected
        seen_acyclic |= not expected
    assert seen_cycle and seen_acyclic


def test_cycle_deep_path_does_not_overflow_the_call_stack():
    n = 5 * sys.getrecursionlimit()
    path = [(i, i + 1) for i in range(n - 1)]
    assert not has_cycle(directed(n, path))
    assert has_cycle(directed(n, path + [(n - 1, 0)]))
