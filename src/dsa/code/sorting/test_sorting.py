"""Tests for the sorting entry's Python code.

API: ``merge_sort(items, key=identity)`` returns a new stable-sorted list;
``partition(nums, lo, hi, pivot)`` returns ``(lt, gt)``; ``quickselect(nums, k,
rng=None)`` returns the k-th smallest, counting from 0.
"""

import math
import random

import pytest

from sorting import merge_sort, partition, quickselect


class Counted:
    """A number that counts every comparison made between two of its kind."""

    comparisons = 0

    def __init__(self, value):
        self.value = value

    def _cmp(self, other, op):
        Counted.comparisons += 1
        return op(self.value, other.value)

    def __lt__(self, other):
        return self._cmp(other, lambda a, b: a < b)

    def __le__(self, other):
        return self._cmp(other, lambda a, b: a <= b)

    def __gt__(self, other):
        return self._cmp(other, lambda a, b: a > b)

    def __ge__(self, other):
        return self._cmp(other, lambda a, b: a >= b)

    def __eq__(self, other):
        return self._cmp(other, lambda a, b: a == b)


def count_comparisons(fn, values):
    Counted.comparisons = 0
    result = fn([Counted(v) for v in values])
    return result, Counted.comparisons


# --- merge_sort ---------------------------------------------------------


def test_merge_sort_empty_and_single():
    assert merge_sort([]) == []
    assert merge_sort([7]) == [7]


def test_merge_sort_worked_example():
    assert merge_sort([5, 2, 4, 6, 1, 3]) == [1, 2, 3, 4, 5, 6]


def test_merge_sort_duplicates_and_extremes():
    assert merge_sort([2, 2, 1, 1, 2]) == [1, 1, 2, 2, 2]
    assert merge_sort([1, 2, 3]) == [1, 2, 3]
    assert merge_sort([3, 2, 1]) == [1, 2, 3]
    assert merge_sort([-1, -5, 0]) == [-5, -1, 0]


def test_merge_sort_returns_a_copy_and_leaves_input_alone():
    items = [3, 1, 2]
    out = merge_sort(items)
    assert items == [3, 1, 2] and out is not items
    one = [4]
    assert merge_sort(one) is not one


def test_merge_sort_is_stable():
    records = [("a", 2), ("b", 1), ("c", 2), ("d", 1), ("e", 2)]
    assert merge_sort(records, key=lambda r: r[1]) == [
        ("b", 1),
        ("d", 1),
        ("a", 2),
        ("c", 2),
        ("e", 2),
    ]


def test_merge_sort_stable_against_builtin_on_random_records():
    seed = 11
    rng = random.Random(seed)
    for trial in range(50):
        records = [(i, rng.randrange(4)) for i in range(rng.randrange(0, 30))]
        got = merge_sort(records, key=lambda r: r[1])
        want = sorted(records, key=lambda r: r[1])
        assert got == want, f"seed={seed} trial={trial} {records}"


def test_merge_sort_matches_sorted_on_random_ints():
    seed = 12
    rng = random.Random(seed)
    for trial in range(50):
        items = [rng.randrange(-20, 20) for _ in range(rng.randrange(0, 40))]
        assert merge_sort(items) == sorted(items), f"seed={seed} trial={trial} {items}"


def test_merge_sort_keeps_big_ints_by_value():
    # Equal values built at runtime are different objects; == must be used.
    items = [int("1000"), 5, int("1000"), 1]
    assert merge_sort(items) == [1, 5, 1000, 1000]


@pytest.mark.parametrize("shape", ["random", "reversed", "sorted"])
def test_merge_sort_comparisons_stay_n_log_n(shape):
    # Mechanism: halving. Insertion or selection sort makes ~n^2 / 2 (500,000
    # here) on reversed or random input. The floor is the (n / 2) * log2 n
    # that top-down merging needs even on sorted input (5,120 here); a
    # built-in sort makes only n - 1 comparisons on presorted input.
    n = 1024
    values = list(range(n))
    if shape == "random":
        random.Random(13).shuffle(values)
    elif shape == "reversed":
        values.reverse()
    out, used = count_comparisons(merge_sort, values)
    assert [c.value for c in out] == sorted(values)
    floor = n // 2 * int(math.log2(n))
    assert floor <= used <= n * math.ceil(math.log2(n)), f"{shape}: {used}"


# --- partition ----------------------------------------------------------


def test_partition_three_zones_on_the_worked_example():
    nums = [4, 7, 2, 4, 9, 1, 4]
    lt, gt = partition(nums, 0, len(nums), 4)
    assert (lt, gt) == (2, 5)
    assert sorted(nums[:lt]) == [1, 2]
    assert nums[lt:gt] == [4, 4, 4]
    assert sorted(nums[gt:]) == [7, 9]


def test_partition_edges_and_subrange():
    assert partition([], 0, 0, 1) == (0, 0)
    assert partition([5], 0, 1, 5) == (0, 1)
    assert partition([5], 0, 1, 9) == (1, 1)
    assert partition([5], 0, 1, 1) == (0, 0)
    nums = [9, 3, 1, 2, 9]
    assert partition(nums, 1, 4, 2) == (2, 3)
    assert nums[0] == 9 and nums[4] == 9, "outside the range must not move"
    nums = [6, 6, 6]
    assert partition(nums, 0, 3, 6) == (0, 3)


def test_partition_random_zones():
    seed = 14
    rng = random.Random(seed)
    for trial in range(50):
        nums = [rng.randrange(6) for _ in range(rng.randrange(0, 20))]
        before = sorted(nums)
        pivot = rng.randrange(6)
        lt, gt = partition(nums, 0, len(nums), pivot)
        ctx = f"seed={seed} trial={trial} pivot={pivot} {nums}"
        assert all(x < pivot for x in nums[:lt]), ctx
        assert all(x == pivot for x in nums[lt:gt]), ctx
        assert all(x > pivot for x in nums[gt:]), ctx
        assert sorted(nums) == before, ctx


# --- quickselect --------------------------------------------------------


def test_quickselect_worked_example():
    nums = [4, 7, 2, 4, 9, 1, 4]
    assert [quickselect(list(nums), k, random.Random(1)) for k in range(7)] == [
        1,
        2,
        4,
        4,
        4,
        7,
        9,
    ]


def test_quickselect_single_and_all_equal():
    assert quickselect([5], 0) == 5
    assert quickselect([3, 3, 3, 3], 2) == 3


def test_quickselect_rejects_k_out_of_range():
    for k in (-1, 0, 3):
        with pytest.raises(IndexError):
            quickselect([] if k == 0 else [1, 2, 3], k)


def test_quickselect_matches_sorted_on_random_inputs():
    seed = 15
    rng = random.Random(seed)
    for trial in range(50):
        nums = [rng.randrange(-8, 8) for _ in range(rng.randrange(1, 30))]
        k = rng.randrange(len(nums))
        got = quickselect(list(nums), k, random.Random(trial))
        assert got == sorted(nums)[k], f"seed={seed} trial={trial} k={k} {nums}"


def test_quickselect_keeps_the_same_elements():
    nums = [5, 1, 4, 1, 9, 2]
    quickselect(nums, 3, random.Random(2))
    assert sorted(nums) == [1, 1, 2, 4, 5, 9]


@pytest.mark.parametrize("shape", ["random", "sorted", "reversed", "equal"])
def test_quickselect_work_stays_linear(shape):
    # Mechanism: partition, then follow one side. Sorting to pick the k-th
    # costs about 10n comparisons on random input and only n - 1 on sorted
    # input, so the 2n floor (measured: 2n on all-equal, over 4n otherwise)
    # rules out a sort there. A first-element pivot costs ~n^2 on reversed
    # input (3.4M comparisons at n = 3000) and ~n^1.5 on sorted (270k); both
    # clear the ceiling. The 9n ceiling holds for these seeds (6.5n measured);
    # it is not a guarantee for every seed, since expected cost is a few n.
    n = 3000
    values = list(range(n))
    if shape == "random":
        random.Random(16).shuffle(values)
    elif shape == "reversed":
        values.reverse()
    elif shape == "equal":
        values = [7] * n
    k = n // 2
    Counted.comparisons = 0
    got = quickselect([Counted(v) for v in values], k, random.Random(17))
    used = Counted.comparisons
    assert got.value == sorted(values)[k]
    assert 2 * n <= used <= 9 * n, f"{shape}: {used}"
