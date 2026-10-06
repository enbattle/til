"""Tests for the binary-search entry's Python code.

API: ``first_true(lo, hi, ok)`` is the smallest x in [lo, hi) with ok(x), or hi;
``lower_bound(nums, target)`` is the first index with nums[i] >= target in sorted
nums, or len(nums); ``min_capacity(weights, days)`` is the least capacity that
ships positive weights, in order, within days.
"""

import random
from bisect import bisect_left

from binary_search import first_true, lower_bound, min_capacity


class CountingList(list):
    """A list that counts element reads."""

    reads = 0

    def __getitem__(self, i):
        self.reads += 1
        return super().__getitem__(i)


def days_needed(weights, cap):
    used, load = 1, 0
    for w in weights:
        if load + w > cap:
            used, load = used + 1, 0
        load += w
    return used


def brute_capacity(weights, days):
    cap = max(weights, default=0)
    while days_needed(weights, cap) > days:
        cap += 1
    return cap


def test_lower_bound_running_example():
    nums = [1, 3, 5, 5, 5, 8]
    assert [lower_bound(nums, t) for t in (5, 4, 9, 0)] == [2, 2, 6, 0]


def test_lower_bound_empty_and_single():
    assert lower_bound([], 5) == 0
    assert [lower_bound([5], t) for t in (4, 5, 6)] == [0, 0, 1]


def test_lower_bound_duplicates_and_boundaries():
    assert lower_bound([4, 4, 4, 4], 4) == 0
    assert lower_bound([4, 4, 4, 4], 5) == 4
    assert lower_bound([1, 2, 3], 10) == 3
    assert lower_bound([5, 6, 7], 1) == 0


def test_lower_bound_matches_bisect_left():
    rng = random.Random(7)
    for trial in range(50):
        nums = sorted(rng.randint(0, 12) for _ in range(rng.randint(0, 15)))
        target = rng.randint(-1, 13)
        want = bisect_left(nums, target)
        got = lower_bound(nums, target)
        assert got == want, (7, trial, nums, target)


def test_lower_bound_reads_logarithmically_many_elements():
    nums = CountingList(range(1000))
    for target in (-5, 0, 499, 500, 999, 5000):
        nums.reads = 0
        lower_bound(nums, target)
        # floor(log2(1000)) + 1 = 10: a scan would read hundreds.
        assert nums.reads <= 10, (target, nums.reads)


def test_first_true_range_and_none_case():
    assert first_true(3, 3, lambda x: True) == 3
    assert first_true(0, 10, lambda x: False) == 10
    assert first_true(0, 10, lambda x: True) == 0
    assert first_true(0, 10, lambda x: x * x >= 50) == 8


def test_first_true_asks_about_the_only_index_of_a_range_of_one():
    calls = []
    first_true(0, 1, lambda x: calls.append(x) or False)
    assert calls == [0]


def test_min_capacity_running_example():
    assert min_capacity([3, 2, 2, 4, 1, 4], 3) == 6
    assert days_needed([3, 2, 2, 4, 1, 4], 5) == 4


def test_min_capacity_edges():
    assert min_capacity([], 3) == 0
    assert min_capacity([5], 1) == 5
    assert min_capacity([1, 2, 3, 4, 5], 1) == 15
    assert min_capacity([1, 2, 3, 4, 5], 5) == 5
    assert min_capacity([9, 1, 1], 2) == 9
    assert min_capacity([4, 1], 3) == 4


def test_min_capacity_matches_brute_force():
    rng = random.Random(11)
    for trial in range(50):
        weights = [rng.randint(1, 9) for _ in range(rng.randint(1, 10))]
        days = rng.randint(1, len(weights))
        got = min_capacity(weights, days)
        assert got == brute_capacity(weights, days), (11, trial, weights, days)
