"""Tests for the merge-sort entry's Python code.

API: ``merge_sort(items, key=identity)`` returns a new sorted list and is
stable; ``merge(left, right, key)`` merges two sorted lists;
``sort_and_count(nums)`` returns ``(sorted_list, inversions)``. The references
are ``sorted`` and a brute-force pair count.
"""

import random

from merge_sort import merge, merge_sort, sort_and_count


def brute_inversions(nums: list[int]) -> int:
    return sum(
        1
        for i in range(len(nums))
        for j in range(i + 1, len(nums))
        if nums[i] > nums[j]
    )


def test_empty_and_single():
    assert merge_sort([]) == []
    assert merge_sort([7]) == [7]
    assert sort_and_count([]) == ([], 0)
    assert sort_and_count([7]) == ([7], 0)


def test_small_examples():
    assert merge_sort([5, 2, 4, 6, 1, 3]) == [1, 2, 3, 4, 5, 6]
    assert merge_sort([2, 1]) == [1, 2]
    assert merge_sort([3, 1, 2]) == [1, 2, 3]


def test_already_sorted_and_reversed():
    ascending = list(range(50))
    assert merge_sort(ascending) == ascending
    assert merge_sort(ascending[::-1]) == ascending


def test_all_equal():
    assert merge_sort([4, 4, 4, 4]) == [4, 4, 4, 4]


def test_returns_a_new_list_and_leaves_the_input_alone():
    original = [3, 1, 2]
    result = merge_sort(original)
    assert original == [3, 1, 2]
    assert result is not original
    single = [5]
    assert merge_sort(single) is not single


def test_merge_two_sorted_lists():
    assert merge([1, 4, 9], [2, 3, 10, 11]) == [1, 2, 3, 4, 9, 10, 11]
    assert merge([], [1, 2]) == [1, 2]
    assert merge([1, 2], []) == [1, 2]
    assert merge([], []) == []


def test_agrees_with_sorted_on_many_random_lists():
    rng = random.Random(5)
    for trial in range(50):
        nums = [rng.randint(-6, 6) for _ in range(rng.randint(0, 40))]
        assert merge_sort(nums) == sorted(nums), f"seed 5, trial {trial}: {nums}"


def test_stable_with_keyed_records():
    records = [("b", 2), ("a", 1), ("c", 2), ("d", 1), ("e", 2), ("f", 1)]
    result = merge_sort(records, key=lambda r: r[1])
    assert result == [("a", 1), ("d", 1), ("f", 1), ("b", 2), ("c", 2), ("e", 2)]


def test_stable_agrees_with_sorted_on_many_random_records():
    rng = random.Random(9)
    for trial in range(50):
        records = [(rng.randint(0, 4), i) for i in range(rng.randint(0, 30))]
        assert merge_sort(records, key=lambda r: r[0]) == sorted(
            records, key=lambda r: r[0]
        ), f"seed 9, trial {trial}: {records}"


def test_inversion_examples():
    assert sort_and_count([2, 4, 1, 3, 5]) == ([1, 2, 3, 4, 5], 3)
    assert sort_and_count([1, 2, 3, 4]) == ([1, 2, 3, 4], 0)
    assert sort_and_count([4, 3, 2, 1]) == ([1, 2, 3, 4], 6)


def test_equal_elements_are_not_inversions():
    assert sort_and_count([2, 2, 2]) == ([2, 2, 2], 0)
    assert sort_and_count([2, 1, 1]) == ([1, 1, 2], 2)


def test_reversed_list_has_n_choose_2_inversions():
    for n in (2, 5, 20):
        assert sort_and_count(list(range(n, 0, -1)))[1] == n * (n - 1) // 2


def test_inversions_agree_with_brute_force_on_many_random_lists():
    rng = random.Random(21)
    for trial in range(50):
        nums = [rng.randint(-5, 5) for _ in range(rng.randint(0, 30))]
        at = f"seed 21, trial {trial}: {nums}"
        merged, count = sort_and_count(nums)
        assert merged == sorted(nums), at
        assert count == brute_inversions(nums), at


def test_does_not_use_the_builtin_sort():
    import inspect

    import merge_sort as module

    source = inspect.getsource(module)
    assert "sorted(" not in source
    assert ".sort(" not in source


def test_large_list():
    rng = random.Random(3)
    nums = [rng.randint(0, 1000) for _ in range(20_000)]
    assert merge_sort(nums) == sorted(nums)
