"""Tests for the dp-knapsack entry's Python code.

Each function is checked against a brute force (all subsets, or a bounded
enumeration of how many times each item or coin is used) on seeded random
small inputs, plus the edge cases: capacity 0, no items, amount 0 and an
impossible amount.
"""

import itertools
import random

from dp_knapsack import (
    count_combinations,
    count_orderings,
    knapsack_01,
    knapsack_table,
    min_coins,
    unbounded_knapsack,
)


def brute_01(weights, values, capacity):
    best = 0
    for picks in itertools.product([0, 1], repeat=len(weights)):
        weight = sum(p * w for p, w in zip(picks, weights))
        if weight <= capacity:
            best = max(best, sum(p * v for p, v in zip(picks, values)))
    return best


def multiplicities(weights, capacity):
    """Every way to choose how many times each item is used, within capacity."""
    ranges = [range(capacity // w + 1) for w in weights]
    for counts in itertools.product(*ranges):
        if sum(k * w for k, w in zip(counts, weights)) <= capacity:
            yield counts


def brute_unbounded(weights, values, capacity):
    return max(
        sum(k * v for k, v in zip(counts, values))
        for counts in multiplicities(weights, capacity)
    )


def brute_min_coins(coins, amount):
    totals = [
        sum(counts)
        for counts in multiplicities(coins, amount)
        if sum(k * c for k, c in zip(counts, coins)) == amount
    ]
    return min(totals) if totals else -1


def brute_combinations(coins, amount):
    return sum(
        1
        for counts in multiplicities(coins, amount)
        if sum(k * c for k, c in zip(counts, coins)) == amount
    )


def brute_orderings(coins, amount):
    if amount == 0:
        return 1
    return sum(brute_orderings(coins, amount - c) for c in coins if c <= amount)


def random_items(rng):
    n = rng.randint(0, 7)
    weights = [rng.randint(1, 9) for _ in range(n)]
    values = [rng.randint(0, 20) for _ in range(n)]
    return weights, values, rng.randint(0, 20)


def random_coins(rng):
    coins = rng.sample(range(1, 9), rng.randint(0, 4))
    return coins, rng.randint(0, 14)


def test_01_worked_example():
    weights, values = [1, 3, 4, 5], [1, 4, 5, 7]
    assert knapsack_table(weights, values, 7) == 9
    assert knapsack_01(weights, values, 7) == 9


def test_01_edge_cases():
    assert knapsack_01([2, 3], [5, 6], 0) == 0
    assert knapsack_table([2, 3], [5, 6], 0) == 0
    assert knapsack_01([], [], 10) == 0
    assert knapsack_table([], [], 10) == 0
    assert knapsack_01([4], [9], 3) == 0
    assert knapsack_01([4], [9], 4) == 9
    assert knapsack_01([1, 2, 3], [1, 2, 3], 100) == 6


def test_01_item_is_used_at_most_once():
    assert knapsack_01([2], [3], 4) == 3
    assert knapsack_table([2], [3], 4) == 3
    assert unbounded_knapsack([2], [3], 4) == 6


def test_01_matches_brute_force():
    rng = random.Random(2024)
    for trial in range(50):
        weights, values, capacity = random_items(rng)
        where = f"seed 2024, trial {trial}: {weights}, {values}, {capacity}"
        expected = brute_01(weights, values, capacity)
        assert knapsack_table(weights, values, capacity) == expected, where
        assert knapsack_01(weights, values, capacity) == expected, where


def test_unbounded_knapsack_basics():
    assert unbounded_knapsack([], [], 5) == 0
    assert unbounded_knapsack([3], [4], 2) == 0
    assert unbounded_knapsack([2, 3], [3, 5], 0) == 0


def test_unbounded_knapsack_matches_brute_force():
    rng = random.Random(7)
    for trial in range(50):
        weights, values, capacity = random_items(rng)
        if not weights:
            continue
        expected = brute_unbounded(weights, values, capacity)
        assert unbounded_knapsack(weights, values, capacity) == expected, (
            f"seed 7, trial {trial}: {weights}, {values}, {capacity}"
        )


def test_min_coins_greedy_counterexample():
    assert min_coins([1, 3, 4], 6) == 2


def test_min_coins_edge_cases():
    assert min_coins([1, 3, 4], 0) == 0
    assert min_coins([], 0) == 0
    assert min_coins([], 5) == -1
    assert min_coins([2], 3) == -1
    assert min_coins([5, 10], 3) == -1
    assert min_coins([7], 7) == 1
    assert min_coins([1], 9) == 9


def test_min_coins_matches_brute_force():
    rng = random.Random(11)
    for trial in range(50):
        coins, amount = random_coins(rng)
        assert min_coins(coins, amount) == brute_min_coins(coins, amount), (
            f"seed 11, trial {trial}: {coins}, {amount}"
        )


def test_ways_worked_example():
    assert count_combinations([1, 2], 3) == 2
    assert count_orderings([1, 2], 3) == 3
    assert count_combinations([1, 2, 3], 4) == 4
    assert count_orderings([1, 2, 3], 4) == 7


def test_ways_edge_cases():
    assert count_combinations([2], 3) == 0
    assert count_orderings([2], 3) == 0
    assert count_combinations([], 0) == 1
    assert count_orderings([], 0) == 1
    assert count_combinations([], 4) == 0
    assert count_orderings([], 4) == 0
    assert count_combinations([1, 2, 5], 0) == 1
    assert count_orderings([1, 2, 5], 0) == 1
    assert count_combinations([3], 9) == 1
    assert count_orderings([3], 9) == 1


def test_ways_match_brute_force():
    rng = random.Random(99)
    for trial in range(50):
        coins, amount = random_coins(rng)
        where = f"seed 99, trial {trial}: {coins}, {amount}"
        assert count_combinations(coins, amount) == brute_combinations(coins, amount), where
        assert count_orderings(coins, amount) == brute_orderings(coins, amount), where


def test_combinations_never_exceed_orderings():
    rng = random.Random(5)
    for trial in range(50):
        coins, amount = random_coins(rng)
        assert count_combinations(coins, amount) <= count_orderings(coins, amount), (
            f"seed 5, trial {trial}: {coins}, {amount}"
        )
