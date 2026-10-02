"""The sliding-window entry's Python code.

API:
- ``max_window_sum(nums, k) -> int | None``: the largest sum of ``k``
  consecutive values (fixed-size window); ``None`` when ``len(nums) < k``;
  ``ValueError`` when ``k < 1``.
- ``longest_unique_substring(text) -> int``: the length in code points of the
  longest run with no repeated character (variable-size window).
"""

import random

import pytest

from sliding_window import longest_unique_substring, max_window_sum


def brute_max_window_sum(nums, k):
    if k > len(nums):
        return None
    return max(sum(nums[i : i + k]) for i in range(len(nums) - k + 1))


def brute_longest_unique(text):
    best = 0
    for i in range(len(text)):
        for j in range(i, len(text)):
            run = text[i : j + 1]
            if len(set(run)) == len(run):
                best = max(best, len(run))
    return best


def test_max_window_sum_example():
    assert max_window_sum([2, 1, 5, 1, 3, 2], 3) == 9


def test_max_window_sum_window_at_each_end():
    assert max_window_sum([9, 8, 1, 1, 1], 2) == 17
    assert max_window_sum([1, 1, 1, 8, 9], 2) == 17


def test_max_window_sum_window_is_the_whole_list():
    assert max_window_sum([4, -1, 2], 3) == 5


def test_max_window_sum_single_element_windows():
    assert max_window_sum([3, -2, 7, 1], 1) == 7
    assert max_window_sum([5], 1) == 5


def test_max_window_sum_negative_values():
    assert max_window_sum([-5, -2, -8, -1, -9], 2) == -7


def test_max_window_sum_too_short_or_empty():
    assert max_window_sum([], 1) is None
    assert max_window_sum([1, 2], 3) is None


def test_max_window_sum_rejects_non_positive_k():
    with pytest.raises(ValueError):
        max_window_sum([1, 2, 3], 0)
    with pytest.raises(ValueError):
        max_window_sum([1, 2, 3], -1)


def test_max_window_sum_does_not_change_the_input():
    nums = [1, 2, 3, 4]
    max_window_sum(nums, 2)
    assert nums == [1, 2, 3, 4]


def test_max_window_sum_agrees_with_brute_force():
    rng = random.Random(11)
    for _ in range(300):
        nums = [rng.randint(-10, 10) for _ in range(rng.randint(0, 12))]
        k = rng.randint(1, 14)
        assert max_window_sum(nums, k) == brute_max_window_sum(nums, k)


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("", 0),
        ("a", 1),
        ("aaaa", 1),
        ("abcdef", 6),
        ("abcabcbb", 3),
        ("pwwkew", 3),
        ("dvdf", 3),
        ("abba", 2),
        ("tmmzuxt", 5),
    ],
)
def test_longest_unique_substring(text, expected):
    assert longest_unique_substring(text) == expected


def test_longest_unique_substring_counts_code_points():
    assert longest_unique_substring("\U0001f600\U0001f601\U0001f600") == 2
    assert longest_unique_substring("\U0001f600b\U0001f601") == 3
    assert longest_unique_substring("\U0001f600\U0001f600") == 1


def test_longest_unique_substring_agrees_with_brute_force():
    rng = random.Random(5)
    for alphabet in ("ab", "abcd", "abcdefgh", "a\U0001f600\U0001f601b"):
        for _ in range(150):
            text = "".join(rng.choice(alphabet) for _ in range(rng.randint(0, 14)))
            assert longest_unique_substring(text) == brute_longest_unique(text)
