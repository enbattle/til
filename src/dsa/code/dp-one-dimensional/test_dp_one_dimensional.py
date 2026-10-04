"""Tests for the dp-one-dimensional entry's Python code.

API:
- ``climb_naive``, ``climb_memo``, ``climb_table``, ``climb``: the number of
  ways to climb ``n`` stairs taking 1 or 2 steps at a time (``n >= 0``).
- ``rob(nums)``: the largest total from non-negative amounts with no two
  adjacent indices taken.
- ``lis_length(nums)``: length of the longest strictly increasing subsequence.
"""

import random
import sys
from itertools import combinations

import pytest

import dp_one_dimensional
from dp_one_dimensional import climb, climb_memo, climb_naive, climb_table, lis_length, rob

CLIMBERS = [climb_naive, climb_memo, climb_table, climb]


def climb_by_listing(n):
    """Count the step sequences directly, by building every one of them."""
    sequences = [[]]
    done = 0
    while sequences:
        longer = []
        for sequence in sequences:
            total = sum(sequence)
            if total == n:
                done += 1
            elif total < n:
                longer.append(sequence + [1])
                longer.append(sequence + [2])
        sequences = longer
    return done


@pytest.mark.parametrize("climber", CLIMBERS)
def test_climb_known_values(climber):
    assert [climber(n) for n in range(0, 9)] == [1, 1, 2, 3, 5, 8, 13, 21, 34]
    assert climber(20) == 10946


@pytest.mark.parametrize("climber", CLIMBERS)
def test_climb_matches_listing_every_sequence(climber):
    for n in range(0, 13):
        assert climber(n) == climb_by_listing(n)


def test_climb_versions_agree_on_larger_n():
    for n in range(0, 25):
        assert climb_memo(n) == climb_table(n) == climb(n) == climb_naive(n)
    assert climb(300) == climb_table(300) == climb_memo(300)


def test_naive_call_counts(monkeypatch):
    calls = 0
    original = dp_one_dimensional.climb_naive

    def counting(n):
        nonlocal calls
        calls += 1
        return original(n)

    monkeypatch.setattr(dp_one_dimensional, "climb_naive", counting)
    seen = {}
    for n in (2, 3, 4, 5, 10, 20):
        calls = 0
        dp_one_dimensional.climb_naive(n)
        seen[n] = calls
    assert seen == {2: 3, 3: 5, 4: 9, 5: 15, 10: 177, 20: 21891}


def test_memo_runs_out_of_recursion_where_the_table_does_not():
    limit = sys.getrecursionlimit()
    assert climb_table(limit * 3) == climb(limit * 3)
    with pytest.raises(RecursionError):
        climb_memo(limit * 3)
    sys.setrecursionlimit(limit * 8)
    try:
        assert climb_memo(limit * 3) == climb(limit * 3)
    finally:
        sys.setrecursionlimit(limit)


def brute_rob(nums):
    best = 0
    for size in range(len(nums) + 1):
        for chosen in combinations(range(len(nums)), size):
            if all(b - a > 1 for a, b in zip(chosen, chosen[1:])):
                best = max(best, sum(nums[i] for i in chosen))
    return best


def every_other(nums):
    """The greedy rule rob is compared with: the better of the two parities."""
    return max(sum(nums[0::2]), sum(nums[1::2]))


def test_rob_small_cases():
    assert rob([]) == 0
    assert rob([7]) == 7
    assert rob([0]) == 0
    assert rob([4, 4, 4, 4]) == 8
    assert rob([2, 7, 9, 3, 1]) == 12
    assert rob([5, 1, 1, 5]) == 10
    assert rob([2, 3, 2]) == 4
    assert rob([9, 1]) == 9


def test_rob_beats_every_other_house():
    nums = [5, 1, 1, 5]
    assert every_other(nums) == 6
    assert rob(nums) == 10


def test_rob_agrees_with_all_subsets():
    rng = random.Random(11)
    for trial in range(50):
        nums = [rng.randint(0, 9) for _ in range(rng.randint(0, 11))]
        assert rob(nums) == brute_rob(nums), f"seed 11, trial {trial}: {nums}"
        assert rob(nums) >= every_other(nums), f"seed 11, trial {trial}: {nums}"


def test_rob_does_not_change_the_input():
    nums = [3, 1, 4, 1, 5]
    rob(nums)
    assert nums == [3, 1, 4, 1, 5]


def brute_lis(nums):
    best = 0
    for size in range(len(nums) + 1):
        for chosen in combinations(nums, size):
            if all(a < b for a, b in zip(chosen, chosen[1:])):
                best = max(best, size)
    return best


def test_lis_small_cases():
    assert lis_length([]) == 0
    assert lis_length([5]) == 1
    assert lis_length([3, 3, 3, 3]) == 1
    assert lis_length([5, 4, 3, 2, 1]) == 1
    assert lis_length([1, 2, 3, 4, 5]) == 5
    assert lis_length([10, 9, 2, 5, 3, 7, 101, 18]) == 4
    assert lis_length([1, 2, 2, 3]) == 3
    assert lis_length([-3, -1, -2, 0]) == 3


def test_lis_agrees_with_all_subsets():
    rng = random.Random(5)
    for trial in range(50):
        nums = [rng.randint(-5, 5) for _ in range(rng.randint(0, 11))]
        assert lis_length(nums) == brute_lis(nums), f"seed 5, trial {trial}: {nums}"


def test_lis_does_not_change_the_input():
    nums = [3, 1, 4, 1, 5]
    lis_length(nums)
    assert nums == [3, 1, 4, 1, 5]
