"""Tests for the quicksort-quickselect entry's Python code.

API: ``partition(nums, lo, hi, pivot) -> (lt, gt)`` (three-way, in place),
``quicksort(nums, rng=None)`` (in place), ``quickselect(nums, k, rng=None)`` with k
counted from 0. The reference answer is ``sorted``.
"""

import random

import pytest
from quicksort_quickselect import partition, quicksort, quickselect


def sorted_by_quicksort(nums: list[int], seed: int = 0) -> list[int]:
    out = list(nums)
    quicksort(out, random.Random(seed))
    return out


def random_lists(seed: int, count: int, max_len: int, max_value: int):
    rng = random.Random(seed)
    for _ in range(count):
        yield [rng.randint(0, max_value) for _ in range(rng.randint(0, max_len))]


def test_partition_makes_three_zones():
    nums = [5, 1, 5, 9, 3, 5, 7, 2]
    lt, gt = partition(nums, 0, len(nums), 5)
    assert sorted(nums) == [1, 2, 3, 5, 5, 5, 7, 9]
    assert all(x < 5 for x in nums[:lt])
    assert all(x == 5 for x in nums[lt:gt])
    assert all(x > 5 for x in nums[gt:])
    assert (lt, gt) == (3, 6)


def test_partition_touches_only_its_range():
    nums = [9, 9, 4, 8, 1, 9, 0, 0]
    lt, gt = partition(nums, 2, 6, 4)
    assert nums[:2] == [9, 9] and nums[6:] == [0, 0]
    assert sorted(nums[2:6]) == [1, 4, 8, 9]
    assert all(x < 4 for x in nums[2:lt]) and all(x > 4 for x in nums[gt:6])


def test_partition_pivot_absent_gives_empty_middle():
    nums = [6, 2, 8, 1]
    lt, gt = partition(nums, 0, 4, 5)
    assert lt == gt == 2
    assert sorted(nums[:2]) == [1, 2] and sorted(nums[2:]) == [6, 8]


def test_partition_empty_range():
    assert partition([], 0, 0, 3) == (0, 0)


def test_quicksort_edge_cases():
    assert sorted_by_quicksort([]) == []
    assert sorted_by_quicksort([4]) == [4]
    assert sorted_by_quicksort([2, 1]) == [1, 2]
    assert sorted_by_quicksort([7, 7, 7, 7, 7]) == [7] * 5
    assert sorted_by_quicksort(list(range(20))) == list(range(20))
    assert sorted_by_quicksort(list(range(20, 0, -1))) == list(range(1, 21))
    assert sorted_by_quicksort([-3, 5, -3, 0, 5, -9]) == [-9, -3, -3, 0, 5, 5]


def test_quicksort_sorts_in_place_and_returns_none():
    nums = [3, 1, 2]
    assert quicksort(nums, random.Random(1)) is None
    assert nums == [1, 2, 3]


def test_quicksort_matches_sorted_with_heavy_duplicates():
    for seed, nums in enumerate(random_lists(21, 300, 40, 4)):
        assert sorted_by_quicksort(nums, seed) == sorted(nums), nums


def test_quicksort_matches_sorted_with_few_duplicates():
    for seed, nums in enumerate(random_lists(22, 200, 60, 10_000)):
        assert sorted_by_quicksort(nums, seed) == sorted(nums), nums


def test_quicksort_without_a_rng_still_sorts():
    nums = [5, 2, 9, 2, 1]
    quicksort(nums)
    assert nums == [1, 2, 2, 5, 9]


def test_quicksort_same_seed_same_result():
    nums = [random.Random(3).randint(0, 50) for _ in range(100)]
    assert sorted_by_quicksort(nums, 7) == sorted_by_quicksort(nums, 7)


def test_quicksort_is_fast_and_shallow_on_large_adversarial_input():
    # All equal, sorted and reversed: quadratic or too deep for a naive version.
    for nums in ([1] * 200_000, list(range(200_000)), list(range(200_000, 0, -1))):
        expected = sorted(nums)
        quicksort(nums, random.Random(5))
        assert nums == expected


def test_quickselect_every_k_on_small_lists():
    for seed, nums in enumerate(random_lists(31, 150, 9, 5)):
        expected = sorted(nums)
        for k in range(len(nums)):
            assert quickselect(list(nums), k, random.Random(seed)) == expected[k], (
                nums,
                k,
            )


def test_quickselect_on_larger_lists():
    rng = random.Random(32)
    for seed in range(40):
        nums = [rng.randint(0, 30) for _ in range(rng.randint(50, 300))]
        k = rng.randrange(len(nums))
        assert quickselect(list(nums), k, random.Random(seed)) == sorted(nums)[k]


def test_quickselect_min_and_max():
    nums = [8, 3, 9, 1, 1, 7]
    assert quickselect(list(nums), 0) == 1
    assert quickselect(list(nums), len(nums) - 1) == 9


def test_quickselect_single_and_all_equal():
    assert quickselect([42], 0) == 42
    assert quickselect([6] * 1000, 500) == 6


def test_quickselect_leaves_the_answer_at_index_k():
    nums = [9, 4, 7, 1, 8, 2]
    assert quickselect(nums, 3) == 7
    assert nums[3] == 7
    assert all(x <= 7 for x in nums[:3]) and all(x >= 7 for x in nums[4:])


def test_quickselect_rejects_k_out_of_range():
    for nums, k in (([], 0), ([1, 2, 3], 3), ([1, 2, 3], -1)):
        with pytest.raises(IndexError):
            quickselect(nums, k)
