"""Tests for the bit-manipulation entry's Python code."""

import random
from collections import Counter
from itertools import combinations

import pytest

from bit_manipulation import count_set_bits, is_power_of_two, single_number, subsets


@pytest.mark.parametrize(
    ("n", "expected"),
    [(0, 0), (1, 1), (2, 1), (3, 2), (7, 3), (8, 1), (255, 8), (2**31 - 1, 31)],
)
def test_count_set_bits_known_values(n, expected):
    assert count_set_bits(n) == expected


def test_count_set_bits_boundaries_and_big_ints():
    assert count_set_bits(2**31) == 1
    assert count_set_bits(2**32 - 1) == 32
    assert count_set_bits(2**32) == 1
    assert count_set_bits(2**100 - 1) == 100


def test_count_set_bits_agrees_with_bin_and_bit_count():
    rng = random.Random(11)
    for _ in range(2000):
        n = rng.getrandbits(rng.randint(1, 80))
        assert count_set_bits(n) == bin(n).count("1")
        assert count_set_bits(n) == n.bit_count()


def test_count_set_bits_rejects_negative():
    with pytest.raises(ValueError):
        count_set_bits(-1)


def test_is_power_of_two_known_values():
    assert [n for n in range(-3, 40) if is_power_of_two(n)] == [1, 2, 4, 8, 16, 32]
    assert not is_power_of_two(0)
    assert not is_power_of_two(-8)
    assert is_power_of_two(2**31)
    assert is_power_of_two(2**100)
    assert not is_power_of_two(2**100 + 1)
    assert not is_power_of_two(2**32 - 1)


def test_is_power_of_two_agrees_with_bit_count():
    rng = random.Random(12)
    for _ in range(2000):
        n = rng.getrandbits(rng.randint(1, 70))
        assert is_power_of_two(n) == (n > 0 and n.bit_count() == 1)


def test_single_number_small_cases():
    assert single_number([7]) == 7
    assert single_number([2, 2, 1]) == 1
    assert single_number([4, 1, 2, 1, 2]) == 4
    assert single_number([0, 5, 5]) == 0


def test_single_number_negative_and_large():
    assert single_number([-1, 3, -1]) == 3
    assert single_number([5, -7, 5]) == -7
    assert single_number([2**40, 9, 2**40]) == 9
    assert single_number([-(2**40), 3, 3]) == -(2**40)


def test_single_number_rejects_empty():
    with pytest.raises(ValueError):
        single_number([])


def test_single_number_agrees_with_counter():
    rng = random.Random(13)
    for _ in range(500):
        pairs = [rng.randint(-50, 50) for _ in range(rng.randint(0, 12))]
        lone = rng.randint(-100, 100)
        nums = pairs + pairs + [lone]
        rng.shuffle(nums)
        expected = next(v for v, c in Counter(nums).items() if c % 2 == 1)
        assert single_number(nums) == expected


def test_subsets_small_cases():
    assert subsets([]) == [[]]
    assert subsets([5]) == [[], [5]]
    assert subsets([1, 2, 3]) == [
        [],
        [1],
        [2],
        [1, 2],
        [3],
        [1, 3],
        [2, 3],
        [1, 2, 3],
    ]


def test_subsets_agrees_with_combinations():
    rng = random.Random(14)
    for _ in range(100):
        items = rng.sample(range(100), rng.randint(0, 8))
        expected = {
            frozenset(c) for size in range(len(items) + 1) for c in combinations(items, size)
        }
        got = subsets(items)
        assert len(got) == 2 ** len(items)
        assert {frozenset(s) for s in got} == expected
        assert len({frozenset(s) for s in got}) == len(got)


def test_subsets_does_not_change_input():
    items = [3, 1, 2]
    subsets(items)
    assert items == [3, 1, 2]


def test_python_ints_are_unbounded_and_negatives_are_infinite_twos_complement():
    assert ~5 == -6
    assert ~0 == -1
    assert -1 & 0xFF == 255
    assert -1 >> 100 == -1
    assert 1 << 100 == 2**100
