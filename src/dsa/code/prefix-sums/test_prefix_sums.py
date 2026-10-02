import random

import pytest

from prefix_sums import build_prefix, count_subarrays_with_sum, range_sum


def brute_count(nums, k):
    return sum(
        1
        for i in range(len(nums))
        for j in range(i, len(nums))
        if sum(nums[i : j + 1]) == k
    )


def test_prefix_has_a_leading_zero():
    assert build_prefix([3, 1, 4]) == [0, 3, 4, 8]


def test_prefix_of_empty_and_single():
    assert build_prefix([]) == [0]
    assert build_prefix([7]) == [0, 7]


def test_prefix_with_negatives():
    assert build_prefix([2, -5, 3]) == [0, 2, -3, 0]


def test_range_sum_examples():
    prefix = build_prefix([3, 1, 4, 1, 5])
    assert range_sum(prefix, 0, 4) == 14
    assert range_sum(prefix, 1, 3) == 6
    assert range_sum(prefix, 0, 0) == 3
    assert range_sum(prefix, 4, 4) == 5


def test_range_sum_rejects_bad_ranges():
    prefix = build_prefix([1, 2, 3])
    for left, right in [(-1, 1), (2, 1), (0, 3), (3, 3)]:
        with pytest.raises(IndexError):
            range_sum(prefix, left, right)
    with pytest.raises(IndexError):
        range_sum(build_prefix([]), 0, 0)


def test_range_sum_agrees_with_sum_on_random_inputs():
    rng = random.Random(11)
    for _ in range(300):
        nums = [rng.randint(-9, 9) for _ in range(rng.randint(1, 12))]
        prefix = build_prefix(nums)
        left = rng.randrange(len(nums))
        right = rng.randrange(left, len(nums))
        assert range_sum(prefix, left, right) == sum(nums[left : right + 1])


def test_count_empty_and_single():
    assert count_subarrays_with_sum([], 0) == 0
    assert count_subarrays_with_sum([5], 5) == 1
    assert count_subarrays_with_sum([5], 4) == 0


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


def test_count_does_not_change_the_input():
    nums = [1, 2, 3]
    count_subarrays_with_sum(nums, 3)
    assert nums == [1, 2, 3]


def test_count_agrees_with_brute_force():
    rng = random.Random(5)
    for _ in range(400):
        nums = [rng.randint(-4, 4) for _ in range(rng.randint(0, 10))]
        k = rng.randint(-6, 6)
        assert count_subarrays_with_sum(nums, k) == brute_count(nums, k)
