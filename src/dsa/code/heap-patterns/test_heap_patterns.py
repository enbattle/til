"""Tests for the heap-patterns entry's Python code.

API: ``top_k_largest(items, k)`` (largest first), ``merge_sorted(lists)`` and
``running_medians(stream)`` (the median after each value, as floats).
"""

import heapq
import random
import statistics

import pytest

from heap_patterns import merge_sorted, running_medians, top_k_largest


class Counted:
    """A number that counts every comparison made between two of its kind."""

    comparisons = 0

    def __init__(self, value):
        self.value = value

    def _count(self, other):
        Counted.comparisons += 1
        return other.value

    def __lt__(self, other):
        return self.value < self._count(other)

    def __le__(self, other):
        return self.value <= self._count(other)

    def __gt__(self, other):
        return self.value > self._count(other)

    def __ge__(self, other):
        return self.value >= self._count(other)

    def __eq__(self, other):
        return self.value == self._count(other)

    __hash__ = None


@pytest.fixture
def heap_calls(monkeypatch):
    """Record every heapq call and the largest heap any of them left behind."""
    log = {"calls": 0, "largest": 0}
    for name in ("heappush", "heappop", "heapreplace", "heapify"):
        real = getattr(heapq, name)

        def spy(heap, *args, _real=real):
            result = _real(heap, *args)
            log["calls"] += 1
            log["largest"] = max(log["largest"], len(heap))
            return result

        monkeypatch.setattr(heapq, name, spy)
    return log


# ---- top-k -----------------------------------------------------------------


def test_top_k_running_example():
    assert top_k_largest([4, 1, 7, 3, 8, 5], 3) == [8, 7, 5]


def test_top_k_edges():
    assert top_k_largest([], 3) == []
    assert top_k_largest([5], 1) == [5]
    assert top_k_largest([5, 6], 5) == [6, 5]  # fewer items than k
    assert top_k_largest([5, 6], 0) == []
    assert top_k_largest([5, 6], -1) == []
    assert top_k_largest(iter([2, 9, 4]), 2) == [9, 4]  # a stream, not a list


def test_top_k_duplicates_and_large_ints():
    big = [int("1000") for _ in range(3)]
    assert top_k_largest([*big, 7, 7, int("1000")], 3) == [1000, 1000, 1000]
    assert top_k_largest([3, 3, 3, 1], 2) == [3, 3]


def test_top_k_matches_sorted_on_random_input():
    seed = 11
    rng = random.Random(seed)
    for trial in range(50):
        nums = [rng.randint(-20, 20) for _ in range(rng.randint(0, 30))]
        k = rng.randint(0, 35)
        want = sorted(nums, reverse=True)[:k]
        assert top_k_largest(nums, k) == want, f"seed={seed} trial={trial} {nums} {k}"


def test_top_k_keeps_a_heap_of_at_most_k(heap_calls):
    # Sorting everything makes no heap call; keeping every item grows past k.
    nums = list(range(200, 0, -1)) + list(range(1, 201))
    assert top_k_largest(nums, 5) == [200, 200, 199, 199, 198]
    assert 0 < heap_calls["calls"] < len(nums)
    assert heap_calls["largest"] == 5


def test_top_k_does_one_comparison_per_item_not_a_sort():
    # On shuffled input nearly every item loses to the root in one comparison,
    # so the total is near n (2,090 here); sorting everything costs about
    # n log2 n (~19,000). The heap-size test above rules out other structures.
    rng = random.Random(5)
    nums = list(range(2000))
    rng.shuffle(nums)
    Counted.comparisons = 0
    top_k_largest([Counted(x) for x in nums], 5)
    assert Counted.comparisons < 3 * len(nums), Counted.comparisons


# ---- k-way merge -------------------------------------------------------------


def test_merge_running_example():
    assert merge_sorted([[1, 4, 7], [3, 8], [5]]) == [1, 3, 4, 5, 7, 8]


def test_merge_edges():
    assert merge_sorted([]) == []
    assert merge_sorted([[]]) == []
    assert merge_sorted([[], [], []]) == []
    assert merge_sorted([[2, 4]]) == [2, 4]
    assert merge_sorted([[], [1], []]) == [1]
    assert merge_sorted([[5], [1, 2, 3, 4]]) == [1, 2, 3, 4, 5]  # lists differ in size


def test_merge_duplicates_and_large_ints():
    big = int("1000")
    assert merge_sorted([[big, big], [1, big], [big]]) == [1, big, big, big, big]
    assert merge_sorted([[2, 2], [2], [2, 2]]) == [2] * 5


def test_merge_matches_sorted_on_random_lists():
    seed = 23
    rng = random.Random(seed)
    for trial in range(50):
        lists = [
            sorted(rng.randint(-9, 9) for _ in range(rng.randint(0, 6)))
            for _ in range(rng.randint(0, 6))
        ]
        want = sorted(x for lst in lists for x in lst)
        assert merge_sorted(lists) == want, f"seed={seed} trial={trial} {lists}"


def test_merge_does_not_change_its_input():
    lists = [[1, 4], [2]]
    merge_sorted(lists)
    assert lists == [[1, 4], [2]]


def test_merge_heap_holds_one_head_per_list(heap_calls):
    # Concatenate-and-sort makes no heap call; loading everything grows the heap
    # past the list count.
    lists = [list(range(i, 1000, 50)) for i in range(50)]
    assert merge_sorted(lists) == sorted(x for lst in lists for x in lst)
    assert heap_calls["calls"] > 0
    assert heap_calls["largest"] == 50


def test_merge_compares_log_k_per_item_not_every_head():
    # Scanning all 50 heads for each item costs 49 comparisons per item
    # (49,000 here). A heap measures about 11.5 per item, since each tuple
    # comparison counts an == and a <. A ceiling of 20 per item separates them.
    lists = [[Counted(x) for x in range(i, 1000, 50)] for i in range(50)]
    Counted.comparisons = 0
    merge_sorted(lists)
    assert Counted.comparisons < 20 * 1000, Counted.comparisons


# ---- running median ------------------------------------------------------------


def test_median_running_example():
    assert running_medians([4, 1, 7, 3, 8, 5]) == [4, 2.5, 4, 3.5, 4, 4.5]


def test_median_edges():
    assert running_medians([]) == []
    assert running_medians([7]) == [7.0]
    assert running_medians([2, 2, 2, 2]) == [2, 2, 2, 2]
    assert running_medians([1.5, 2.5]) == [1.5, 2.0]
    assert running_medians(iter([3, 1])) == [3, 2]  # a stream, not a list
    assert running_medians([-5, -1]) == [-5, -3]


def test_median_ascending_and_descending_input():
    assert running_medians([1, 2, 3, 4, 5]) == [1, 1.5, 2, 2.5, 3]
    assert running_medians([5, 4, 3, 2, 1]) == [5, 4.5, 4, 3.5, 3]


def test_median_matches_statistics_on_random_streams():
    seed = 31
    rng = random.Random(seed)
    for trial in range(50):
        stream = [rng.randint(-15, 15) for _ in range(rng.randint(0, 25))]
        want = [statistics.median(stream[: i + 1]) for i in range(len(stream))]
        got = running_medians(stream)
        assert got == want, f"seed={seed} trial={trial} {stream}"


def test_median_uses_two_balanced_heaps(heap_calls):
    # Sorting each prefix makes no heap call. Two heaps hold the stream between
    # them, so neither passes half of it, and each value costs 3 or 5 calls.
    n = 101
    rng = random.Random(3)
    stream = [rng.randint(0, 999) for _ in range(n)]
    running_medians(stream)
    assert 3 * n <= heap_calls["calls"] <= 5 * n
    assert heap_calls["largest"] == (n + 1) // 2
