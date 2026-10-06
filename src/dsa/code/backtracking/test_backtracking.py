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
    for trial in range(50):
        values = rng.sample(range(-20, 20), rng.randint(0, 8))
        assert subsets(values) == expected_subsets(values), f"seed 11, trial {trial}: {values}"


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
    for trial in range(50):
        values = rng.sample(range(-20, 20), rng.randint(0, 6))
        assert permutations(values) == [list(p) for p in itertools.permutations(values)], (
            f"seed 12, trial {trial}: {values}"
        )


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
    for trial in range(50):
        candidates = [rng.randint(1, 8) for _ in range(rng.randint(0, 5))]
        target = rng.randint(0, 14)
        assert combination_sum(candidates, target) == expected_combination_sum(
            candidates, target
        ), f"seed 13, trial {trial}: {candidates}, target {target}"


def test_equal_values_at_different_positions_are_different_choices():
    assert permutations([1, 1]) == [[1, 1], [1, 1]]
    assert subsets([1, 1]) == [[], [1], [1, 1], [1]]


def test_large_target_built_at_runtime_matches_by_value():
    assert combination_sum([int("1000")], int("1000")) == [[1000]]
    assert combination_sum([int("500")], int("1000")) == [[500, 500]]


class Counted(int):
    """An int that counts the comparisons and subtractions made on it."""

    comparisons = 0
    subtractions = 0

    def __rsub__(self, other):
        Counted.subtractions += 1
        return int(other) - int(self)

    def _count(self, other, op):
        Counted.comparisons += 1
        return op(int(self), int(other))

    def __gt__(self, other):
        return self._count(other, int.__gt__)

    def __ge__(self, other):
        return self._count(other, int.__ge__)

    def __lt__(self, other):
        return self._count(other, int.__lt__)

    def __le__(self, other):
        return self._count(other, int.__le__)

    def __eq__(self, other):
        return self._count(other, int.__eq__)

    __hash__ = int.__hash__


def search_cost(candidates, target):
    """(recursive calls, comparisons on candidates) that combination_sum makes."""
    Counted.comparisons = 0
    Counted.subtractions = 0
    combination_sum([Counted(c) for c in candidates], target)
    # Every recursive call but the first is made right after one subtraction.
    return Counted.subtractions + 1, Counted.comparisons


def test_combination_sum_walks_only_the_pruned_tree():
    # [2, 3, 5] with 8 is the entry's 13-call table. Brute force over
    # combinations subtracts nothing (1 call). Stopping only at remaining < 0
    # makes more than 13 calls. A `continue` where the entry has `break`
    # makes the same 13 calls but more comparisons, because it goes on testing
    # candidates after the first one that is too big.
    assert search_cost([2, 3, 5], 8) == (13, 22)
    # With no answer the search still needs 441 calls to find that out.
    # Comparisons include the few the sort and the positivity check make.
    assert search_cost([2, 4], 81) == (441, 483)
    # Doubling the target grows the calls with the square of it, not
    # exponentially: two candidates give C(D + 2, 2) calls at depth D.
    assert search_cost([2, 4], 161)[0] == 1681
