import random

import pytest

from monotonic_stack import days_until_warmer, next_greater


def brute_next_greater(nums):
    result = []
    for i in range(len(nums)):
        found = -1
        for j in range(i + 1, len(nums)):
            if nums[j] > nums[i]:
                found = j
                break
        result.append(found)
    return result


def brute_days(temps):
    return [0 if j == -1 else j - i for i, j in enumerate(brute_next_greater(temps))]


@pytest.mark.parametrize(
    ("given", "expected"),
    [
        ([], []),
        ([5], [-1]),
        ([1, 2, 3], [1, 2, -1]),
        ([3, 2, 1], [-1, -1, -1]),
        ([2, 1, 2, 4, 3], [3, 2, 3, -1, -1]),
        ([2, 2, 2], [-1, -1, -1]),
        ([2, 2, 3], [2, 2, -1]),
        ([-3, -5, -1, -1, 0], [2, 2, 4, 4, -1]),
    ],
)
def test_next_greater(given, expected):
    assert next_greater(given) == expected


def test_next_greater_does_not_change_the_input():
    nums = [4, 1, 5]
    next_greater(nums)
    assert nums == [4, 1, 5]


@pytest.mark.parametrize(
    ("given", "expected"),
    [
        ([], []),
        ([70], [0]),
        ([73, 74, 75, 71, 69, 72, 76, 73], [1, 1, 4, 2, 1, 1, 0, 0]),
        ([30, 40, 50, 60], [1, 1, 1, 0]),
        ([60, 50, 40, 30], [0, 0, 0, 0]),
        ([50, 50, 50], [0, 0, 0]),
        ([50, 50, 51], [2, 1, 0]),
    ],
)
def test_days_until_warmer(given, expected):
    assert days_until_warmer(given) == expected


def test_agrees_with_brute_force_on_many_duplicates():
    rng = random.Random(11)
    for trial in range(50):
        nums = [rng.randint(0, 4) for _ in range(rng.randint(0, 12))]
        at = f"seed 11, trial {trial}: {nums}"
        assert next_greater(nums) == brute_next_greater(nums), at
        assert days_until_warmer(nums) == brute_days(nums), at


def test_agrees_with_brute_force_on_wide_values():
    rng = random.Random(12)
    for trial in range(50):
        nums = [rng.randint(-50, 50) for _ in range(rng.randint(0, 30))]
        assert next_greater(nums) == brute_next_greater(nums), (
            f"seed 12, trial {trial}: {nums}"
        )
