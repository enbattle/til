"""docs/specs/dsa-tab.md, criterion 12: the two-pointers entry's Python code.

API:
- ``pair_with_sum(nums, target) -> tuple[int, int] | None``: the indices
  ``(i, j)``, ``i < j``, of two elements of the sorted list ``nums`` that add
  up to ``target`` (opposite-end pointers), or ``None``.
- ``dedupe_sorted(nums) -> int``: removes duplicates from the sorted list in
  place (same-direction pointers) and returns the count ``k`` of unique
  values, which are then ``nums[:k]`` in order.
"""

import random

import pytest

from two_pointers import dedupe_sorted, pair_with_sum


def brute_force_pairs(nums, target):
    return [
        (i, j)
        for i in range(len(nums))
        for j in range(i + 1, len(nums))
        if nums[i] + nums[j] == target
    ]


def assert_valid_pair(nums, target):
    result = pair_with_sum(nums, target)
    if not brute_force_pairs(nums, target):
        assert result is None
        return
    assert result is not None
    i, j = result
    assert 0 <= i < j < len(nums)
    assert nums[i] + nums[j] == target


def test_finds_a_pair_in_a_sorted_list():
    assert_valid_pair([1, 3, 4, 6, 8, 11], 10)


def test_finds_the_only_pair_at_the_two_ends():
    assert pair_with_sum([1, 5, 9, 20], 21) == (0, 3)


def test_finds_the_only_pair_in_the_middle():
    assert pair_with_sum([1, 4, 6, 50], 10) == (1, 2)


def test_empty_list():
    assert pair_with_sum([], 0) is None


def test_single_element_is_not_used_twice():
    assert pair_with_sum([3], 6) is None


def test_no_pair_adds_up():
    assert pair_with_sum([1, 2, 4, 8], 15) is None
    assert pair_with_sum([1, 3], 6) is None


def test_equal_values_at_two_indices():
    assert pair_with_sum([2, 2], 4) == (0, 1)
    assert_valid_pair([1, 3, 3, 5], 6)


def test_negative_numbers_and_zero():
    assert_valid_pair([-8, -3, 0, 2, 7], -1)
    assert_valid_pair([-4, -1, 0, 0, 3], 0)
    assert pair_with_sum([-5, -2], -7) == (0, 1)


def test_agrees_with_brute_force():
    rng = random.Random(7)
    for _ in range(300):
        nums = sorted(rng.randint(-10, 10) for _ in range(rng.randint(0, 8)))
        assert_valid_pair(nums, rng.randint(-20, 20))


def test_does_not_change_the_input():
    nums = [1, 2, 3, 4]
    pair_with_sum(nums, 7)
    assert nums == [1, 2, 3, 4]


@pytest.mark.parametrize(
    ("given", "expected"),
    [
        ([], []),
        ([5], [5]),
        ([1, 2, 3], [1, 2, 3]),
        ([7, 7, 7, 7], [7]),
        ([1, 1, 2, 3, 3, 3, 4], [1, 2, 3, 4]),
        ([-3, -3, 0, 0, 2], [-3, 0, 2]),
        ([0, 0, 1, 1, 1, 2, 2, 3, 3, 4], [0, 1, 2, 3, 4]),
    ],
)
def test_dedupe_sorted(given, expected):
    nums = list(given)
    k = dedupe_sorted(nums)
    assert k == len(expected)
    assert nums[:k] == expected


def test_dedupe_works_in_place():
    nums = [1, 1, 2]
    same = nums
    dedupe_sorted(nums)
    assert nums is same
    assert nums[:2] == [1, 2]
