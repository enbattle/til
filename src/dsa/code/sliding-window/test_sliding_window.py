"""Tests for the sliding-window entry's Python code.

API: ``max_window_sum(nums, k)`` is the largest sum of ``k`` consecutive
values (None if ``nums`` is shorter, ValueError if ``k < 1``);
``shortest_run_at_least(nums, target)`` is the length of the shortest run of
non-negative values summing to at least ``target`` (0 if none, ValueError if
``target < 1``); ``longest_with_k_distinct(nums, k)`` is the length of the
longest run with at most ``k`` different values (ValueError if ``k < 1``).
"""

import random

import pytest

from sliding_window import (
    longest_with_k_distinct,
    max_window_sum,
    shortest_run_at_least,
)

RUNNING = [2, 1, 5, 1, 3, 2]


def brute_max_sum(nums, k):
    return max(sum(nums[i : i + k]) for i in range(len(nums) - k + 1))


def brute_shortest(nums, target):
    lengths = [
        j - i
        for i in range(len(nums))
        for j in range(i + 1, len(nums) + 1)
        if sum(nums[i:j]) >= target
    ]
    return min(lengths, default=0)


def brute_distinct(nums, k):
    return max(
        (
            j - i
            for i in range(len(nums))
            for j in range(i + 1, len(nums) + 1)
            if len(set(nums[i:j])) <= k
        ),
        default=0,
    )


class CountingList(list):
    """A list that counts element reads, by index or through a slice."""

    def __init__(self, items):
        super().__init__(items)
        self.reads = 0

    def __getitem__(self, index):
        if isinstance(index, slice):
            self.reads += len(range(*index.indices(len(self))))
        else:
            self.reads += 1
        return super().__getitem__(index)


def test_max_window_sum_running_example():
    assert max_window_sum(RUNNING, 3) == 9
    assert max_window_sum(RUNNING, 1) == 5
    assert max_window_sum(RUNNING, 6) == 14


def test_max_window_sum_edges():
    assert max_window_sum([], 1) is None
    assert max_window_sum([4], 1) == 4
    assert max_window_sum([4], 2) is None
    assert max_window_sum([-3, -1, -2], 2) == -3
    assert max_window_sum([-5], 1) == -5
    assert max_window_sum([2, 2, 2, 2], 2) == 4
    assert max_window_sum([int("1000"), 1, int("1000")], 2) == 1001
    with pytest.raises(ValueError):
        max_window_sum([1, 2], 0)
    with pytest.raises(ValueError):
        max_window_sum([], -1)


def test_shortest_run_running_example():
    assert shortest_run_at_least(RUNNING, 9) == 3
    assert shortest_run_at_least(RUNNING, 5) == 1
    assert shortest_run_at_least(RUNNING, 14) == 6
    assert shortest_run_at_least(RUNNING, 15) == 0


def test_shortest_run_edges():
    assert shortest_run_at_least([], 1) == 0
    assert shortest_run_at_least([7], 7) == 1
    assert shortest_run_at_least([6], 7) == 0
    assert shortest_run_at_least([0, 0, 0], 1) == 0
    assert shortest_run_at_least([1, 0, 0, 1], 2) == 4
    assert shortest_run_at_least([3, 3, 3], 3) == 1
    assert shortest_run_at_least([1, 1, 1, 1], 2) == 2
    assert shortest_run_at_least([int("1000"), 1], int("1000")) == 1
    with pytest.raises(ValueError):
        shortest_run_at_least([1], 0)


def test_longest_with_k_distinct_running_example():
    assert longest_with_k_distinct(RUNNING, 2) == 3
    assert longest_with_k_distinct(RUNNING, 1) == 1
    assert longest_with_k_distinct(RUNNING, 4) == 6


def test_longest_with_k_distinct_edges():
    assert longest_with_k_distinct([], 1) == 0
    assert longest_with_k_distinct([5], 1) == 1
    assert longest_with_k_distinct([5, 5, 5], 1) == 3
    assert longest_with_k_distinct([1, 2, 3], 5) == 3
    assert longest_with_k_distinct([1, 2, 1, 3, 3], 2) == 3
    big = int("1000")
    assert longest_with_k_distinct([big, 1000, big, 7], 1) == 3
    with pytest.raises(ValueError):
        longest_with_k_distinct([1], 0)


def test_max_window_sum_matches_brute_force():
    seed = 11
    rng = random.Random(seed)
    for trial in range(50):
        nums = [rng.randint(-5, 9) for _ in range(rng.randint(1, 12))]
        k = rng.randint(1, len(nums))
        where = f"seed {seed}, trial {trial}: {nums} k={k}"
        assert max_window_sum(nums, k) == brute_max_sum(nums, k), where


def test_shortest_run_matches_brute_force():
    seed = 12
    rng = random.Random(seed)
    for trial in range(50):
        nums = [rng.randint(0, 5) for _ in range(rng.randint(0, 12))]
        target = rng.randint(1, 15)
        where = f"seed {seed}, trial {trial}: {nums} target={target}"
        assert shortest_run_at_least(nums, target) == brute_shortest(nums, target), where


def test_longest_with_k_distinct_matches_brute_force():
    seed = 13
    rng = random.Random(seed)
    for trial in range(50):
        nums = [rng.randint(0, 4) for _ in range(rng.randint(0, 12))]
        k = rng.randint(1, 4)
        where = f"seed {seed}, trial {trial}: {nums} k={k}"
        assert longest_with_k_distinct(nums, k) == brute_distinct(nums, k), where


def test_fixed_window_reads_one_value_in_and_one_out_per_step():
    # k to fill the first window, then two reads a step. Re-summing every
    # window would read about n * k = 10,000 here.
    n, k = 200, 50
    nums = CountingList(range(n))
    assert max_window_sum(nums, k) == sum(range(n - k, n))
    assert nums.reads == k + 2 * (n - k)


def test_variable_windows_move_each_end_at_most_n_times():
    # n reads for the right end plus at most n for the left. Restarting the
    # sum from left on every step, or trying every run, reads far more.
    n = 200
    nums = CountingList([1] * n)
    assert shortest_run_at_least(nums, 3) == 3
    assert n <= nums.reads <= 2 * n, nums.reads
    # A long window: trying each start and extending it reads about n^2 / 4.
    nums = CountingList([1] * n)
    assert shortest_run_at_least(nums, n // 2) == n // 2
    assert nums.reads <= 2 * n, nums.reads
    nums = CountingList([i % 3 for i in range(n)])
    assert longest_with_k_distinct(nums, 2) == 2
    assert n <= nums.reads <= 2 * n, nums.reads


def test_distinct_count_drops_a_value_once_it_leaves():
    # With a stale zero count kept, len(counts) would never fall back to k.
    assert longest_with_k_distinct([1, 2, 3, 4, 5, 5, 5], 2) == 4
    assert longest_with_k_distinct([1, 2, 1, 2, 3, 3], 2) == 4


def test_inputs_are_not_changed():
    nums = list(RUNNING)
    max_window_sum(nums, 3)
    shortest_run_at_least(nums, 9)
    longest_with_k_distinct(nums, 2)
    assert nums == RUNNING
