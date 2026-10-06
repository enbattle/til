"""Tests for the dynamic-programming-shapes entry's Python code.

API: ``min_path_sum(grid)`` is the cheapest right/down path total, 0 for an empty
grid; ``knapsack_01(weights, values, capacity)`` is the best value using each
item at most once; ``min_coins(coins, amount)`` is the fewest coins with reuse,
or -1; ``edit_distance(a, b)`` is the insert/delete/replace distance.
"""

import random
from itertools import combinations

import pytest

from dynamic_programming_shapes import (
    edit_distance,
    knapsack_01,
    min_coins,
    min_path_sum,
)

EXAMPLE_GRID = [[1, 3, 1], [1, 5, 1], [4, 2, 1]]


class Budget:
    """Counts reads and raises past a limit, so brute force fails instead of hanging."""

    def __init__(self, limit):
        self.limit = limit
        self.reads = 0

    def tick(self):
        self.reads += 1
        if self.reads > self.limit:
            raise AssertionError(f"more than {self.limit} reads")


class CountingList(list):
    """A list that counts every element read, by index or by iteration."""

    def __init__(self, items, budget):
        super().__init__(items)
        self.budget = budget

    def __getitem__(self, index):
        self.budget.tick()
        return super().__getitem__(index)

    def __iter__(self):
        for item in super().__iter__():
            self.budget.tick()
            yield item


# ---- grid ----


def brute_path_sum(grid):
    rows, cols = len(grid), len(grid[0])
    best = None
    for downs in combinations(range(rows + cols - 2), rows - 1):
        r = c = 0
        total = grid[0][0]
        for step in range(rows + cols - 2):
            r, c = (r + 1, c) if step in downs else (r, c + 1)
            total += grid[r][c]
        best = total if best is None else min(best, total)
    return best


def test_grid_known_cases():
    assert min_path_sum(EXAMPLE_GRID) == 7
    assert min_path_sum([]) == 0
    assert min_path_sum([[]]) == 0
    assert min_path_sum([[5]]) == 5
    assert min_path_sum([[1, 2, 3]]) == 6
    assert min_path_sum([[1], [2], [3]]) == 6
    assert min_path_sum([[0, 0], [0, 0]]) == 0
    assert min_path_sum([[7, 7], [7, 7]]) == 21


def test_grid_large_ints_built_at_runtime():
    big = int("1000")
    grid = [[big, big, 1], [1, big, 1], [big, 1, 1]]
    assert min_path_sum(grid) == 2 * big + 3
    assert min_path_sum([[big]]) == big


def test_grid_matches_brute_force():
    seed = 21
    rng = random.Random(seed)
    for trial in range(50):
        rows, cols = rng.randint(1, 5), rng.randint(1, 5)
        grid = [[rng.randint(0, 9) for _ in range(cols)] for _ in range(rows)]
        assert min_path_sum(grid) == brute_path_sum(grid), f"seed {seed}, trial {trial}: {grid}"


def test_grid_work_grows_with_the_cells_not_the_paths():
    # The budget is 3 reads per cell. Any table, rolled row or memoized
    # recursion fits; brute force re-reads cells along every path (over
    # 700,000 paths here), so it runs into the budget and raises.
    size = 12
    budget = Budget(3 * size * size)
    grid = [CountingList([1] * size, budget) for _ in range(size)]
    assert min_path_sum(grid) == 2 * size - 1


def test_grid_is_not_changed():
    grid = [row[:] for row in EXAMPLE_GRID]
    min_path_sum(grid)
    assert grid == EXAMPLE_GRID


# ---- knapsack ----


def brute_knapsack(weights, values, capacity):
    best = 0
    for size in range(len(weights) + 1):
        for chosen in combinations(range(len(weights)), size):
            if sum(weights[i] for i in chosen) <= capacity:
                best = max(best, sum(values[i] for i in chosen))
    return best


def test_knapsack_known_cases():
    assert knapsack_01([1, 3, 4], [2, 4, 5], 4) == 6
    assert knapsack_01([], [], 10) == 0
    assert knapsack_01([2], [9], 0) == 0
    assert knapsack_01([5], [9], 4) == 0
    assert knapsack_01([5], [9], 5) == 9
    assert knapsack_01([2, 2, 2], [3, 3, 3], 4) == 6
    assert knapsack_01([1, 1], [0, 0], 5) == 0


def test_knapsack_uses_each_item_once():
    # Sweeping the row upward would pick the lone item three times and say 9.
    assert knapsack_01([2], [3], 6) == 3
    assert knapsack_01([1, 3, 4], [2, 4, 5], 4) != 8


def test_knapsack_beats_taking_the_most_valuable_item_first():
    assert knapsack_01([1, 3, 4], [2, 4, 5], 4) > 5


def test_knapsack_large_ints_built_at_runtime():
    big = int("1000")
    assert knapsack_01([int("3"), int("3")], [big, big], int("6")) == 2 * big
    assert knapsack_01([int("7")], [big], int("6")) == 0


def test_knapsack_matches_brute_force():
    seed = 22
    rng = random.Random(seed)
    for trial in range(50):
        n = rng.randint(0, 7)
        weights = [rng.randint(1, 6) for _ in range(n)]
        values = [rng.randint(0, 9) for _ in range(n)]
        capacity = rng.randint(0, 15)
        want = brute_knapsack(weights, values, capacity)
        where = f"seed {seed}, trial {trial}: {weights} {values} {capacity}"
        assert knapsack_01(weights, values, capacity) == want, where


def test_knapsack_work_grows_with_the_states_not_the_subsets():
    # The states are items x capacities (275); the budget is 6 reads per
    # state, shared by both lists. A 2-D table or a memoized recursion fits.
    # Brute force, even stopping once the bag is full, makes over 300,000 calls.
    n, capacity = 25, 10
    budget = Budget(6 * n * (capacity + 1))
    weights = CountingList([2] * n, budget)
    values = CountingList([3] * n, budget)
    assert knapsack_01(weights, values, capacity) == 15


# ---- coins ----


def brute_min_coins(coins, amount):
    """Breadth-first search over amounts: the number of layers is the answer."""
    seen = {0}
    layer = [0]
    steps = 0
    while layer:
        if amount in seen:
            return steps
        steps += 1
        layer = [a + c for a in layer for c in coins if a + c <= amount and a + c not in seen]
        seen.update(layer)
    return -1


def test_coins_known_cases():
    assert min_coins([1, 3, 4], 6) == 2
    assert min_coins([1, 3, 4], 0) == 0
    assert min_coins([], 0) == 0
    assert min_coins([], 5) == -1
    assert min_coins([2], 3) == -1
    assert min_coins([2], 4) == 2
    assert min_coins([5], 5) == 1
    assert min_coins([1, 2, 5], 11) == 3
    assert min_coins([2, 2, 3], 6) == 2


def test_coins_reuse_a_coin():
    # Sweeping the row downward would never let the 3 repeat and say -1.
    assert min_coins([3], 6) == 2
    assert min_coins([3], 9) == 3


def test_coins_beat_taking_the_largest_coin_first():
    # Greedy pays 4 + 1 + 1, three coins.
    assert min_coins([1, 3, 4], 6) < 3


def test_coins_large_ints_built_at_runtime():
    big = int("1000")
    assert min_coins([big, int("1")], 2 * big + 2) == 4
    assert min_coins([big], big - 1) == -1


def test_coins_matches_brute_force():
    seed = 23
    rng = random.Random(seed)
    for trial in range(50):
        coins = [rng.randint(1, 8) for _ in range(rng.randint(0, 4))]
        amount = rng.randint(0, 25)
        where = f"seed {seed}, trial {trial}: {coins} {amount}"
        assert min_coins(coins, amount) == brute_min_coins(coins, amount), where


def test_coins_work_grows_with_the_amount_not_the_combinations():
    # The states are the amounts (61); the budget is 3 reads of the coin list
    # per coin per amount. Either loop order or a memoized recursion fits;
    # a recursion with no memo tries every sequence of coins and runs out.
    amount, coins = 60, [1, 5, 10]
    budget = Budget(3 * (amount + 1) * len(coins))
    assert min_coins(CountingList(coins, budget), amount) == 6


# ---- edit distance ----


def brute_edit(a, b):
    """The plain recursion, with no table, so keep the strings short."""
    if not a:
        return len(b)
    if not b:
        return len(a)
    if a[-1] == b[-1]:
        return brute_edit(a[:-1], b[:-1])
    return 1 + min(
        brute_edit(a[:-1], b),
        brute_edit(a, b[:-1]),
        brute_edit(a[:-1], b[:-1]),
    )


def test_edit_distance_known_cases():
    assert edit_distance("", "") == 0
    assert edit_distance("", "abc") == 3
    assert edit_distance("abc", "") == 3
    assert edit_distance("a", "a") == 0
    assert edit_distance("a", "b") == 1
    assert edit_distance("abc", "yabd") == 2
    assert edit_distance("kitten", "sitting") == 3
    assert edit_distance("horse", "ros") == 3
    assert edit_distance("aaa", "aa") == 1
    assert edit_distance("abc", "abc") == 0


def test_edit_distance_is_symmetric_and_works_on_lists():
    assert edit_distance("abc", "yabd") == edit_distance("yabd", "abc")
    assert edit_distance(["a", "b"], ["a", "c", "b"]) == 1


def test_edit_distance_matches_brute_force():
    seed = 24
    rng = random.Random(seed)
    for trial in range(50):
        a = "".join(rng.choice("abc") for _ in range(rng.randint(0, 6)))
        b = "".join(rng.choice("abc") for _ in range(rng.randint(0, 6)))
        where = f"seed {seed}, trial {trial}: {a!r} {b!r}"
        assert edit_distance(a, b) == brute_edit(a, b), where


def test_edit_distance_work_grows_with_the_pairs_not_the_alignments():
    # The states are the prefix pairs (about 625); the budget is 4 reads per
    # state, twice what the table needs. A rolled row or a memoized recursion
    # fits; the plain recursion revisits pairs and runs into the budget.
    n = 25
    budget = Budget(4 * n * n)
    a = CountingList(list("a" * n), budget)
    b = CountingList(list("b" * n), budget)
    assert edit_distance(a, b) == n
