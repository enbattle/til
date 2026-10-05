"""Tests for the dynamic-programming entry's Python code.

API: ``rob_memo(nums)`` (top-down) and ``rob(nums)`` (two variables) return the
most money from non-negative amounts with no two adjacent houses robbed;
``rob_table(nums)`` returns the bottom-up table, where ``best[i]`` is the most
from houses ``i`` onward (``len(nums) + 2`` entries, the answer at index 0);
``houses_to_rob(nums)`` returns the indices of one best choice, ascending.
"""

import random
import sys
from itertools import combinations

import pytest

from dynamic_programming import houses_to_rob, rob, rob_memo, rob_table

SOLVERS = [rob_memo, rob, lambda nums: rob_table(nums)[0]]
KNOWN = [
    ([], 0),
    ([7], 7),
    ([0], 0),
    ([9, 1], 9),
    ([1, 9], 9),
    ([2, 3, 2], 4),
    ([3, 4, 3, 1], 6),
    ([5, 1, 1, 5], 10),
    ([2, 7, 9, 3, 1], 12),
    ([4, 4, 4, 4], 8),
    ([0, 0, 0], 0),
]


def brute(nums):
    """The best total over every set of houses with no two adjacent."""
    best = 0
    for size in range(len(nums) + 1):
        for chosen in combinations(range(len(nums)), size):
            if all(b - a > 1 for a, b in zip(chosen, chosen[1:])):
                best = max(best, sum(nums[i] for i in chosen))
    return best


def random_street(rng):
    return [rng.randint(0, 9) for _ in range(rng.randint(0, 10))]


@pytest.mark.parametrize("solve", SOLVERS, ids=["rob_memo", "rob", "rob_table"])
def test_known_streets(solve):
    for nums, want in KNOWN:
        assert solve(nums) == want, nums


def test_the_running_example_table():
    assert rob_table([3, 4, 3, 1]) == [6, 5, 3, 1, 0, 0]
    assert rob_table([]) == [0, 0]
    assert rob_table([7]) == [7, 0, 0]


def test_houses_to_rob_small_cases():
    assert houses_to_rob([]) == []
    assert houses_to_rob([7]) == [0]
    assert houses_to_rob([3, 4, 3, 1]) == [0, 2]
    assert houses_to_rob([1, 9]) == [1]
    assert houses_to_rob([5, 1, 1, 5]) == [0, 3]


def test_all_versions_match_brute_force():
    seed = 7
    rng = random.Random(seed)
    for trial in range(50):
        nums = random_street(rng)
        want = brute(nums)
        where = f"seed {seed}, trial {trial}: {nums}"
        assert rob_memo(nums) == want, where
        assert rob(nums) == want, where
        assert rob_table(nums)[0] == want, where


def test_every_table_entry_is_the_best_from_there_on():
    seed = 8
    rng = random.Random(seed)
    for trial in range(50):
        nums = random_street(rng)
        want = [brute(nums[i:]) for i in range(len(nums))] + [0, 0]
        assert rob_table(nums) == want, f"seed {seed}, trial {trial}: {nums}"


def test_houses_to_rob_is_a_legal_best_choice():
    seed = 9
    rng = random.Random(seed)
    for trial in range(50):
        nums = random_street(rng)
        chosen = houses_to_rob(nums)
        where = f"seed {seed}, trial {trial}: {nums} -> {chosen}"
        assert all(0 <= i < len(nums) for i in chosen), where
        assert all(b - a > 1 for a, b in zip(chosen, chosen[1:])), where
        assert sum(nums[i] for i in chosen) == brute(nums), where


def test_each_memo_call_starts_with_an_empty_cache():
    assert rob_memo([5, 5, 5]) == 10
    assert rob_memo([1]) == 1
    assert rob_memo([2, 1]) == 2


def test_memo_runs_out_of_stack_where_the_loops_do_not():
    street = [1] * (sys.getrecursionlimit() * 2)
    with pytest.raises(RecursionError):
        rob_memo(street)
    assert rob(street) == rob_table(street)[0] == len(street) // 2


class CountingList(list):
    """A list that counts reads by index, to see how often each state runs."""

    def __init__(self, items):
        super().__init__(items)
        self.reads = 0

    def __getitem__(self, index):
        self.reads += 1
        return super().__getitem__(index)


@pytest.mark.parametrize("amount", [1, 0])
def test_memo_solves_each_house_once(amount):
    # Each state reads its house once; without the memo, 20 houses take
    # about 17,700 reads. Zeros check that a stored 0 counts as solved.
    street = CountingList([amount] * 20)
    assert rob_memo(street) == amount * 10
    assert street.reads == 20, f"amount={amount} reads={street.reads}"


def test_inputs_are_not_changed():
    nums = [3, 4, 3, 1]
    for solve in (*SOLVERS, houses_to_rob):
        solve(nums)
    assert nums == [3, 4, 3, 1]
