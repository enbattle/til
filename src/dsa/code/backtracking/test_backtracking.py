"""Tests for the backtracking entry's Python code.

API (each result is a list of lists, in the fixed order the entry documents):
- ``subsets(values)``: every subset of distinct values, each in input order,
  depth first: the empty subset, then everything starting with the first
  value, and so on.
- ``permutations(values)``: every ordering of distinct values, in the order
  ``itertools.permutations`` yields them.
- ``combination_sum(candidates, target)``: every combination of positive
  candidates (each reusable) adding to target, each combination ascending,
  the combinations in lexicographic order.
"""

import itertools
import math
import random

import pytest

from backtracking import combination_sum, permutations, subsets


def expected_subsets(values):
    positions = itertools.chain.from_iterable(
        itertools.combinations(range(len(values)), size) for size in range(len(values) + 1)
    )
    return [[values[i] for i in chosen] for chosen in sorted(positions)]


def expected_combination_sum(candidates, target):
    options = sorted(set(candidates))
    found = []
    longest = target // options[0] if options else 0
    for size in range(longest + 1):
        for combo in itertools.combinations_with_replacement(options, size):
            if sum(combo) == target:
                found.append(list(combo))
    return sorted(found)


def test_subsets_small_example_in_documented_order():
    assert subsets([1, 2, 3]) == [
        [],
        [1],
        [1, 2],
        [1, 2, 3],
        [1, 3],
        [2],
        [2, 3],
        [3],
    ]


def test_subsets_empty_and_single():
    assert subsets([]) == [[]]
    assert subsets([7]) == [[], [7]]


def test_subsets_agree_with_itertools_on_random_inputs():
    rng = random.Random(11)
    for _ in range(200):
        values = rng.sample(range(-20, 20), rng.randint(0, 8))
        assert subsets(values) == expected_subsets(values)


def test_subsets_count_is_two_to_the_n():
    assert len(subsets(list(range(10)))) == 2**10


def test_permutations_small_example_in_documented_order():
    assert permutations([1, 2, 3]) == [
        [1, 2, 3],
        [1, 3, 2],
        [2, 1, 3],
        [2, 3, 1],
        [3, 1, 2],
        [3, 2, 1],
    ]


def test_permutations_empty_and_single():
    assert permutations([]) == [[]]
    assert permutations([7]) == [[7]]


def test_permutations_agree_with_itertools_on_random_inputs():
    rng = random.Random(12)
    for _ in range(200):
        values = rng.sample(range(-20, 20), rng.randint(0, 6))
        assert permutations(values) == [list(p) for p in itertools.permutations(values)]


def test_permutations_follow_input_positions_not_value_order():
    assert permutations([3, 1]) == [[3, 1], [1, 3]]


def test_permutations_count_is_n_factorial():
    assert len(permutations(list(range(7)))) == math.factorial(7)


def test_results_do_not_share_lists():
    for result in (subsets([1, 2]), permutations([1, 2])):
        result[0].append(99)
        assert all(99 not in other for other in result[1:])


def test_inputs_are_not_changed():
    values = [3, 1, 2]
    subsets(values)
    permutations(values)
    candidates = [3, 2]
    combination_sum(candidates, 7)
    assert values == [3, 1, 2]
    assert candidates == [3, 2]


def test_combination_sum_classic_example():
    assert combination_sum([2, 3, 6, 7], 7) == [[2, 2, 3], [7]]
    assert combination_sum([2, 3, 5], 8) == [[2, 2, 2, 2], [2, 3, 3], [3, 5]]


def test_combination_sum_unsorted_and_repeated_candidates():
    assert combination_sum([3, 2, 3], 6) == [[2, 2, 2], [3, 3]]


def test_combination_sum_target_zero_is_the_empty_combination():
    assert combination_sum([2, 3], 0) == [[]]
    assert combination_sum([], 0) == [[]]


def test_combination_sum_no_solution():
    assert combination_sum([], 5) == []
    assert combination_sum([2, 4], 7) == []
    assert combination_sum([5], 3) == []
    assert combination_sum([2], -2) == []


def test_combination_sum_single_candidate():
    assert combination_sum([1], 4) == [[1, 1, 1, 1]]


def test_combination_sum_rejects_non_positive_candidates():
    with pytest.raises(ValueError):
        combination_sum([0, 2], 4)
    with pytest.raises(ValueError):
        combination_sum([-1, 2], 4)


def test_combination_sum_agrees_with_brute_force_on_random_inputs():
    rng = random.Random(13)
    for _ in range(300):
        candidates = [rng.randint(1, 8) for _ in range(rng.randint(0, 5))]
        target = rng.randint(0, 14)
        assert combination_sum(candidates, target) == expected_combination_sum(
            candidates, target
        )
