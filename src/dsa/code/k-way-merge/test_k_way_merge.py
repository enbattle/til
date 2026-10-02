"""The k-way-merge entry's Python code.

API:
- ``merge_sorted(lists) -> list[int]``: the sorted merge of sorted lists.
- ``kth_smallest(lists, k) -> int | None``: the k-th smallest value (1-based)
  across sorted lists, or ``None`` if k is below 1 or above the total count.
"""

import heapq
import random

from k_way_merge import kth_smallest, merge_sorted


def random_lists(rng):
    return [
        sorted(rng.randint(-8, 8) for _ in range(rng.randint(0, 6)))
        for _ in range(rng.randint(0, 6))
    ]


def test_merges_three_lists():
    lists = [[1, 4, 7], [2, 5, 8], [3, 6, 9]]
    assert merge_sorted(lists) == [1, 2, 3, 4, 5, 6, 7, 8, 9]


def test_merges_lists_of_different_lengths():
    assert merge_sorted([[1, 10, 20, 30], [5], [2, 3]]) == [1, 2, 3, 5, 10, 20, 30]


def test_no_lists_at_all():
    assert merge_sorted([]) == []


def test_all_lists_empty():
    assert merge_sorted([[], [], []]) == []


def test_some_lists_empty():
    assert merge_sorted([[], [2, 4], [], [1, 3]]) == [1, 2, 3, 4]


def test_single_list_comes_back_equal_but_not_the_same_object():
    lists = [[1, 2, 2, 5]]
    result = merge_sorted(lists)
    assert result == [1, 2, 2, 5]
    assert result is not lists[0]


def test_duplicates_across_lists_are_all_kept():
    assert merge_sorted([[1, 1, 3], [1, 3, 3], [3]]) == [1, 1, 1, 3, 3, 3, 3]


def test_negative_values():
    assert merge_sorted([[-5, -1], [-3, 0, 2]]) == [-5, -3, -1, 0, 2]


def test_does_not_change_the_input():
    lists = [[1, 3], [2]]
    merge_sorted(lists)
    assert lists == [[1, 3], [2]]


def test_merge_agrees_with_sorted_concatenation():
    rng = random.Random(11)
    for _ in range(500):
        lists = random_lists(rng)
        expected = sorted(value for lst in lists for value in lst)
        assert merge_sorted(lists) == expected


def test_merge_agrees_with_heapq_merge():
    rng = random.Random(12)
    for _ in range(200):
        lists = random_lists(rng)
        assert merge_sorted(lists) == list(heapq.merge(*lists))


def test_kth_smallest_basic():
    lists = [[1, 4, 7], [2, 5, 8], [3, 6, 9]]
    assert kth_smallest(lists, 1) == 1
    assert kth_smallest(lists, 5) == 5
    assert kth_smallest(lists, 9) == 9


def test_kth_smallest_with_duplicates_counts_each_copy():
    lists = [[1, 1], [1, 2]]
    assert [kth_smallest(lists, k) for k in range(1, 5)] == [1, 1, 1, 2]


def test_kth_smallest_out_of_range_is_none():
    lists = [[1, 2], [3]]
    assert kth_smallest(lists, 0) is None
    assert kth_smallest(lists, -2) is None
    assert kth_smallest(lists, 4) is None
    assert kth_smallest([], 1) is None
    assert kth_smallest([[], []], 1) is None


def test_kth_smallest_single_list():
    assert kth_smallest([[4, 8, 15]], 2) == 8


def test_kth_smallest_agrees_with_sorted_concatenation():
    rng = random.Random(13)
    for _ in range(500):
        lists = random_lists(rng)
        everything = sorted(value for lst in lists for value in lst)
        for k in range(-1, len(everything) + 3):
            expected = everything[k - 1] if 1 <= k <= len(everything) else None
            assert kth_smallest(lists, k) == expected
