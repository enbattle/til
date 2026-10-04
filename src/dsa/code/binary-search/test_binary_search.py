"""docs/specs/dsa-tab.md, criterion 12: the binary-search entry's Python code.

API: ``lower_bound(nums, target) -> int``, the first index ``i`` with
``nums[i] >= target`` in the sorted list ``nums``, or ``len(nums)`` when there
is none (the lower-bound form, half-open range). It is written out, not a call
to ``bisect``; this test uses ``bisect_left`` as the reference.
"""

import random
from bisect import bisect_left

import binary_search
from binary_search import lower_bound


def test_empty_list():
    assert lower_bound([], 5) == 0


def test_present_value():
    assert lower_bound([1, 3, 5, 7, 9], 7) == 3
    assert lower_bound([1, 3, 5, 7, 9], 1) == 0
    assert lower_bound([1, 3, 5, 7, 9], 9) == 4


def test_absent_value_gives_the_insertion_point():
    assert lower_bound([1, 3, 5, 7, 9], 4) == 2


def test_first_of_several_duplicates():
    assert lower_bound([1, 2, 2, 2, 2, 3], 2) == 1
    assert lower_bound([4, 4, 4, 4], 4) == 0
    assert lower_bound([1, 5, 5], 5) == 1


def test_all_smaller_than_the_target():
    assert lower_bound([1, 2, 3], 10) == 3
    assert lower_bound([4, 4, 4, 4], 5) == 4


def test_all_larger_than_the_target():
    assert lower_bound([5, 6, 7], 1) == 0


def test_single_element():
    assert lower_bound([5], 4) == 0
    assert lower_bound([5], 5) == 0
    assert lower_bound([5], 6) == 1


def test_negative_numbers():
    assert lower_bound([-9, -4, -4, 0, 3], -4) == 1
    assert lower_bound([-9, -4, -4, 0, 3], -5) == 1


def test_agrees_with_bisect_left():
    rng = random.Random(11)
    for trial in range(50):
        nums = sorted(rng.randint(-5, 5) for _ in range(rng.randint(0, 11)))
        for target in range(-7, 8):
            assert lower_bound(nums, target) == bisect_left(nums, target), (
                f"seed 11, trial {trial}: {nums}, {target}"
            )


def test_terminates_on_a_large_list():
    nums = list(range(0, 200_000, 2))
    assert lower_bound(nums, 99_999) == 50_000
    assert lower_bound([1, 2], 2) == 1
    assert lower_bound([1, 2], 3) == 2


def test_does_not_use_bisect():
    assert not any(name.startswith("bisect") for name in vars(binary_search))
