"""Tests for the top-k entry's Python code.

API:
- ``top_k_largest(nums, k)``: the k largest values, largest first (duplicates
  count separately); ``[]`` for k <= 0; every value, sorted, if k >= len(nums).
- ``top_k_frequent(nums, k)``: the k most frequent distinct values, most
  frequent first; values with equal counts come smaller value first.
"""

import random
from collections import Counter

from top_k import top_k_frequent, top_k_largest


def sort_largest(nums, k):
    return sorted(nums, reverse=True)[: max(k, 0)]


def sort_frequent(nums, k):
    counts = Counter(nums)
    ranked = sorted(counts, key=lambda value: (-counts[value], value))
    return ranked[: max(k, 0)]


def test_largest_basic():
    assert top_k_largest([5, 1, 9, 3, 7], 2) == [9, 7]


def test_largest_empty_and_single():
    assert top_k_largest([], 3) == []
    assert top_k_largest([4], 1) == [4]
    assert top_k_largest([4], 5) == [4]


def test_largest_duplicates_count_separately():
    assert top_k_largest([5, 5, 5, 1], 2) == [5, 5]
    assert top_k_largest([2, 2, 2], 2) == [2, 2]


def test_largest_negative_values():
    assert top_k_largest([-5, -1, -9], 2) == [-1, -5]


def test_largest_k_zero_and_negative():
    assert top_k_largest([1, 2, 3], 0) == []
    assert top_k_largest([1, 2, 3], -2) == []


def test_largest_k_equal_to_and_above_length():
    assert top_k_largest([3, 1, 2], 3) == [3, 2, 1]
    assert top_k_largest([3, 1, 2], 10) == [3, 2, 1]


def test_largest_does_not_change_the_input():
    nums = [4, 8, 1, 9]
    top_k_largest(nums, 2)
    assert nums == [4, 8, 1, 9]


def test_largest_matches_sorting_on_random_inputs():
    rng = random.Random(11)
    for _ in range(500):
        nums = [rng.randint(-10, 10) for _ in range(rng.randint(0, 20))]
        k = rng.randint(0, 25)
        assert top_k_largest(nums, k) == sort_largest(nums, k)


def test_largest_matches_sorting_for_every_k():
    rng = random.Random(12)
    nums = [rng.randint(0, 50) for _ in range(30)]
    for k in range(0, 35):
        assert top_k_largest(nums, k) == sort_largest(nums, k)


def test_frequent_basic():
    assert top_k_frequent([1, 1, 1, 2, 2, 3], 2) == [1, 2]


def test_frequent_empty_and_single():
    assert top_k_frequent([], 2) == []
    assert top_k_frequent([7], 1) == [7]
    assert top_k_frequent([7, 7], 4) == [7]


def test_frequent_ties_go_to_the_smaller_value():
    assert top_k_frequent([3, 1, 2], 1) == [1]
    assert top_k_frequent([3, 3, 1, 1, 2, 2], 2) == [1, 2]
    assert top_k_frequent([5, 5, 9, 9, 4], 2) == [5, 9]


def test_frequent_tie_order_in_the_result():
    assert top_k_frequent([9, 9, 4, 4, 7], 3) == [4, 9, 7]


def test_frequent_negative_values():
    assert top_k_frequent([-1, -1, -2, -2, -3], 2) == [-2, -1]


def test_frequent_k_zero_equal_and_above_distinct_count():
    nums = [1, 1, 2, 3, 3, 3]
    assert top_k_frequent(nums, 0) == []
    assert top_k_frequent(nums, -1) == []
    assert top_k_frequent(nums, 3) == [3, 1, 2]
    assert top_k_frequent(nums, 9) == [3, 1, 2]


def test_frequent_matches_sorting_on_random_inputs():
    rng = random.Random(13)
    for _ in range(500):
        nums = [rng.randint(-6, 6) for _ in range(rng.randint(0, 30))]
        k = rng.randint(0, 15)
        assert top_k_frequent(nums, k) == sort_frequent(nums, k)
