"""Tests for dp_grids: edge shapes plus brute force on seeded random grids."""

import random

import pytest

from dp_grids import min_path_sum, min_path_sum_rolling, unique_paths


def all_paths(grid):
    """Every right/down path as a list of cells' (row, col), corner to corner."""
    rows, cols = len(grid), len(grid[0])
    out = []

    def walk(r, c, path):
        path = path + [(r, c)]
        if (r, c) == (rows - 1, cols - 1):
            out.append(path)
            return
        if r + 1 < rows:
            walk(r + 1, c, path)
        if c + 1 < cols:
            walk(r, c + 1, path)

    walk(0, 0, [])
    return out


def brute_unique_paths(grid):
    return sum(1 for p in all_paths(grid) if all(grid[r][c] != 1 for r, c in p))


def brute_min_path_sum(grid):
    return min(sum(grid[r][c] for r, c in p) for p in all_paths(grid))


def random_grid(rng, low, high):
    rows, cols = rng.randint(1, 5), rng.randint(1, 5)
    return [[rng.randint(low, high) for _ in range(cols)] for _ in range(rows)]


def test_unique_paths_no_obstacles():
    assert unique_paths([[0] * 3 for _ in range(3)]) == 6
    assert unique_paths([[0] * 7 for _ in range(3)]) == 28


def test_unique_paths_center_obstacle():
    assert unique_paths([[0, 0, 0], [0, 1, 0], [0, 0, 0]]) == 2


def test_unique_paths_single_cell():
    assert unique_paths([[0]]) == 1
    assert unique_paths([[1]]) == 0


def test_unique_paths_single_row_and_column():
    assert unique_paths([[0, 0, 0, 0]]) == 1
    assert unique_paths([[0], [0], [0]]) == 1
    assert unique_paths([[0, 1, 0, 0]]) == 0
    assert unique_paths([[0], [0], [1], [0]]) == 0


def test_unique_paths_obstacle_in_first_row_blocks_the_rest_of_it():
    # The obstacle at (0, 1) leaves only the path that goes down first.
    assert unique_paths([[0, 1, 0], [0, 0, 0]]) == 1


def test_unique_paths_blocked_start_or_end():
    assert unique_paths([[1, 0], [0, 0]]) == 0
    assert unique_paths([[0, 0], [0, 1]]) == 0


def test_unique_paths_all_obstacles():
    assert unique_paths([[1, 1], [1, 1]]) == 0


def test_unique_paths_empty():
    assert unique_paths([]) == 0
    assert unique_paths([[]]) == 0


def test_unique_paths_matches_brute_force():
    rng = random.Random(11)
    for _ in range(400):
        grid = random_grid(rng, 0, 1)
        assert unique_paths(grid) == brute_unique_paths(grid), grid


@pytest.mark.parametrize("fn", [min_path_sum, min_path_sum_rolling])
def test_min_path_sum_examples(fn):
    assert fn([[1, 3, 1], [1, 5, 1], [4, 2, 1]]) == 7
    assert fn([[1, 2, 3], [4, 5, 6]]) == 12
    assert fn([[5]]) == 5
    assert fn([[1, 2, 3, 4]]) == 10
    assert fn([[1], [2], [3], [4]]) == 10
    assert fn([[0, 0], [0, 0]]) == 0


@pytest.mark.parametrize("fn", [min_path_sum, min_path_sum_rolling])
def test_min_path_sum_empty(fn):
    assert fn([]) == 0
    assert fn([[]]) == 0


@pytest.mark.parametrize("fn", [min_path_sum, min_path_sum_rolling])
def test_min_path_sum_matches_brute_force(fn):
    rng = random.Random(23)
    for _ in range(400):
        grid = random_grid(rng, 0, 9)
        assert fn(grid) == brute_min_path_sum(grid), grid


def test_min_path_sum_negative_values():
    rng = random.Random(5)
    for _ in range(200):
        grid = random_grid(rng, -5, 5)
        expected = brute_min_path_sum(grid)
        assert min_path_sum(grid) == expected
        assert min_path_sum_rolling(grid) == expected


def test_functions_do_not_change_the_grid():
    grid = [[1, 3, 1], [1, 5, 1], [4, 2, 1]]
    copy = [row[:] for row in grid]
    min_path_sum(grid)
    min_path_sum_rolling(grid)
    unique_paths(grid)
    assert grid == copy
