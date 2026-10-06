"""Tests for the prefix-sums entry's Python code.

API: ``build_prefix(nums)`` returns n + 1 running totals starting at 0;
``range_sum(prefix, left, right)`` is the sum of nums[left..right], both ends
included, and raises IndexError for a bad range;
``count_subarrays_with_sum(nums, k)`` counts non-empty contiguous subarrays
that add up to exactly k.
"""

import random
from itertools import accumulate

import pytest

from prefix_sums import build_prefix, count_subarrays_with_sum, range_sum

RUNNING = [3, -1, 2, 1, -2, 4]


def brute_count(nums, k):
    return sum(
        1
        for i in range(len(nums))
        for j in range(i, len(nums))
        if sum(nums[i : j + 1]) == k
    )


class CountingList(list):
    """A list that records how it is read, to prove the structure is used."""

    def __init__(self, items):
        super().__init__(items)
        self.index_reads = 0
        self.yielded = 0

    def __getitem__(self, index):
        self.index_reads += 1
        return super().__getitem__(index)

    def __iter__(self):
        for item in super().__iter__():
            self.yielded += 1
            yield item


def test_prefix_of_the_running_example():
    assert build_prefix(RUNNING) == [0, 3, 2, 4, 5, 3, 7]


def test_prefix_of_empty_and_single():
    assert build_prefix([]) == [0]
    assert build_prefix([7]) == [0, 7]


def test_prefix_with_negatives_and_duplicates():
    assert build_prefix([2, -5, 3]) == [0, 2, -3, 0]
    assert build_prefix([4, 4, 4]) == [0, 4, 8, 12]


def test_prefix_matches_accumulate_on_random_inputs():
    rng = random.Random(3)
    for trial in range(50):
        nums = [rng.randint(-9, 9) for _ in range(rng.randint(0, 12))]
        assert build_prefix(nums) == [0, *accumulate(nums)], (
            f"seed 3, trial {trial}: {nums}"
        )


def test_range_sum_examples():
    prefix = build_prefix(RUNNING)
    assert range_sum(prefix, 1, 3) == 2
    assert range_sum(prefix, 0, 5) == 7
    assert range_sum(prefix, 0, 0) == 3
    assert range_sum(prefix, 5, 5) == 4


def test_range_sum_rejects_bad_ranges():
    prefix = build_prefix([1, 2, 3])
    for left, right in [(-1, 1), (2, 1), (0, 3), (3, 3), (-1, -1)]:
        with pytest.raises(IndexError):
            range_sum(prefix, left, right)
    with pytest.raises(IndexError):
        range_sum(build_prefix([]), 0, 0)


def test_range_sum_agrees_with_sum_on_random_inputs():
    rng = random.Random(11)
    for trial in range(50):
        nums = [rng.randint(-9, 9) for _ in range(rng.randint(1, 12))]
        prefix = build_prefix(nums)
        left = rng.randrange(len(nums))
        right = rng.randrange(left, len(nums))
        assert range_sum(prefix, left, right) == sum(nums[left : right + 1]), (
            f"seed 11, trial {trial}: {nums}, {left}..{right}"
        )


def test_range_sum_reads_two_entries_however_long_the_range():
    prefix = CountingList(build_prefix(list(range(1, 201))))
    assert range_sum(prefix, 0, 199) == 200 * 201 // 2
    assert prefix.index_reads == 2
    assert prefix.yielded == 0


def test_build_prefix_reads_each_element_once():
    nums = CountingList(range(1, 51))
    build_prefix(nums)
    assert nums.yielded == 50
    assert nums.index_reads == 0


def test_count_empty_and_single():
    assert count_subarrays_with_sum([], 0) == 0
    assert count_subarrays_with_sum([5], 5) == 1
    assert count_subarrays_with_sum([5], 4) == 0


def test_count_the_running_example():
    assert count_subarrays_with_sum(RUNNING, 3) == 4


def test_count_nothing_found():
    assert count_subarrays_with_sum([1, 2, 3], 100) == 0


def test_count_whole_array_and_every_element():
    assert count_subarrays_with_sum([1, 2, 3], 6) == 1
    assert count_subarrays_with_sum([2, 2, 2], 2) == 3


def test_count_duplicates_of_a_prefix_sum():
    assert count_subarrays_with_sum([1, 1, 1], 2) == 2
    assert count_subarrays_with_sum([1, -1, 1, -1], 0) == 4


def test_count_zero_target_ignores_the_empty_subarray():
    assert count_subarrays_with_sum([1, 2], 0) == 0
    assert count_subarrays_with_sum([0, 0, 0], 0) == 6


def test_count_with_negatives():
    assert count_subarrays_with_sum([1, -1, 0], 0) == 3
    assert count_subarrays_with_sum([3, -2, 2, 1], 1) == 3


def test_count_compares_totals_by_value_not_identity():
    # int("1000") builds a new object each time; small ints are cached,
    # so only a large one catches `is` written where `==` is meant.
    big = int("1000")
    nums = [big, -big, int("1000"), int("1000")]
    assert count_subarrays_with_sum(nums, int("2000")) == 2
    assert count_subarrays_with_sum(nums, 0) == 2


def test_count_does_not_change_the_input():
    nums = [1, 2, 3]
    count_subarrays_with_sum(nums, 3)
    assert nums == [1, 2, 3]


def test_count_agrees_with_brute_force():
    rng = random.Random(5)
    for trial in range(50):
        nums = [rng.randint(-4, 4) for _ in range(rng.randint(0, 10))]
        k = rng.randint(-6, 6)
        assert count_subarrays_with_sum(nums, k) == brute_count(nums, k), (
            f"seed 5, trial {trial}: {nums}, k {k}"
        )


def test_count_makes_one_pass_over_the_input():
    # Nested loops over indices or slices read the input again and again.
    nums = CountingList([(i % 7) - 3 for i in range(60)])
    count_subarrays_with_sum(nums, 2)
    assert nums.yielded == 60
    assert nums.index_reads == 0
