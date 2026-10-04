"""Tests for the bucket-and-counting-sort entry's Python code, against sorted()."""

import random

import pytest

from bucket_counting_sort import bucket_sort, counting_sort, insertion_sort, radix_sort


def test_counting_sort_empty_and_single():
    assert counting_sort([], 0, 5) == []
    assert counting_sort([3], 0, 5) == [3]


def test_counting_sort_all_equal():
    assert counting_sort([4, 4, 4, 4], 0, 9) == [4, 4, 4, 4]


def test_counting_sort_known_example():
    assert counting_sort([4, 1, 3, 4, 3], 0, 5) == [1, 3, 3, 4, 4]


def test_counting_sort_negatives_and_range_ends():
    assert counting_sort([0, -3, 2, -3, 2, -1], -3, 2) == [-3, -3, -1, 0, 2, 2]
    assert counting_sort([5, 5, 2, 2, 5], 2, 5) == [2, 2, 5, 5, 5]


def test_counting_sort_single_value_range():
    assert counting_sort([7, 7], 7, 7) == [7, 7]


def test_counting_sort_rejects_bad_input():
    with pytest.raises(ValueError):
        counting_sort([1, 6], 0, 5)
    with pytest.raises(ValueError):
        counting_sort([1, -1], 0, 5)
    with pytest.raises(ValueError):
        counting_sort([], 3, 2)


def test_counting_sort_does_not_change_its_input():
    items = [3, 1, 2]
    counting_sort(items, 0, 3)
    assert items == [3, 1, 2]


def test_counting_sort_is_stable_on_records():
    records = [("b", 2), ("a", 1), ("c", 2), ("d", 1), ("e", 0), ("f", 2)]
    result = counting_sort(records, 0, 2, key=lambda r: r[1])
    assert result == [("e", 0), ("a", 1), ("d", 1), ("b", 2), ("c", 2), ("f", 2)]


def test_counting_sort_stable_on_many_random_records():
    rng = random.Random(3)
    for trial in range(50):
        records = [(i, rng.randint(-4, 4)) for i in range(rng.randint(0, 25))]
        # sorted() is stable, so it is the reference for the order of equal keys.
        expected = sorted(records, key=lambda r: r[1])
        assert counting_sort(records, -4, 4, key=lambda r: r[1]) == expected, (
            f"seed 3, trial {trial}: {records}"
        )


def test_counting_sort_matches_sorted_on_random_ints():
    rng = random.Random(1)
    for trial in range(50):
        nums = [rng.randint(-10, 10) for _ in range(rng.randint(0, 40))]
        assert counting_sort(nums, -10, 10) == sorted(nums), f"seed 1, trial {trial}: {nums}"


def test_radix_sort_basics():
    assert radix_sort([]) == []
    assert radix_sort([5]) == [5]
    assert radix_sort([0, 0]) == [0, 0]
    nums = [170, 45, 75, 90, 802, 24, 2, 66]
    assert radix_sort(nums) == [2, 24, 45, 66, 75, 90, 170, 802]
    assert radix_sort([7, 7, 7]) == [7, 7, 7]


def test_radix_sort_other_bases():
    nums = [255, 0, 16, 17, 4096, 1]
    assert radix_sort(nums, base=2) == sorted(nums)
    assert radix_sort(nums, base=16) == sorted(nums)
    assert radix_sort(nums, base=1000) == sorted(nums)


def test_radix_sort_rejects_bad_input():
    with pytest.raises(ValueError):
        radix_sort([3, -1])
    with pytest.raises(ValueError):
        radix_sort([3, 1], base=1)


def test_radix_sort_matches_sorted_on_random_ints():
    rng = random.Random(2)
    for trial in range(50):
        nums = [rng.randint(0, 10**rng.randint(0, 9)) for _ in range(rng.randint(0, 40))]
        assert radix_sort(nums) == sorted(nums), f"seed 2, trial {trial}: {nums}"


def test_insertion_sort_empty_and_single():
    empty = []
    insertion_sort(empty)
    assert empty == []
    single = [0.5]
    insertion_sort(single)
    assert single == [0.5]


def test_insertion_sort_in_place():
    rng = random.Random(4)
    for trial in range(50):
        items = [rng.random() for _ in range(rng.randint(0, 20))]
        where = f"seed 4, trial {trial}: {items}"
        expected = sorted(items)
        insertion_sort(items)
        assert items == expected, where


def test_bucket_sort_basics():
    assert bucket_sort([]) == []
    assert bucket_sort([0.5]) == [0.5]
    assert bucket_sort([0.3, 0.3, 0.3]) == [0.3, 0.3, 0.3]
    values = [0.78, 0.17, 0.39, 0.26, 0.72, 0.94, 0.21, 0.12, 0.23, 0.68]
    assert bucket_sort(values) == sorted(values)
    assert bucket_sort(values)[:3] == [0.12, 0.17, 0.21]
    assert bucket_sort(values)[-3:] == [0.72, 0.78, 0.94]


def test_bucket_sort_range_ends():
    assert bucket_sort([0.0, 0.999999, 0.0]) == [0.0, 0.0, 0.999999]
    just_below_one = 1 - 2**-53
    result = bucket_sort([just_below_one, 0.0, just_below_one])
    assert result == [0.0, just_below_one, just_below_one]


def test_bucket_sort_skewed_input_lands_in_one_bucket():
    values = [0.9 + i / 1000 for i in range(50)]
    rng = random.Random(5)
    rng.shuffle(values)
    assert bucket_sort(values) == sorted(values)


def test_bucket_sort_rejects_bad_input():
    for bad in (1.0, -0.1, float("nan")):
        with pytest.raises(ValueError):
            bucket_sort([0.5, bad])


def test_bucket_sort_matches_sorted_on_random_floats():
    rng = random.Random(6)
    for trial in range(50):
        values = [rng.random() for _ in range(rng.randint(0, 60))]
        assert bucket_sort(values) == sorted(values), f"seed 6, trial {trial}: {values}"
