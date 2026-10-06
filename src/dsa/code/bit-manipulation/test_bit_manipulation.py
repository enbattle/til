"""Tests for the bit-manipulation entry's Python code."""

import random
from collections import Counter

import pytest

from bit_manipulation import count_set_bits, is_power_of_two, single_number, subsets


class Traced(int):
    """An int that counts the operators the code uses on it.

    Arithmetic returns Traced, so the count survives `n &= n - 1`.
    """

    ands = 0
    xors = 0
    shifts = 0

    def __new__(cls, value: int) -> "Traced":
        return super().__new__(cls, value)

    def __and__(self, other: int) -> "Traced":
        Traced.ands += 1
        return Traced(int(self) & int(other))

    def __rxor__(self, other: int) -> "Traced":
        Traced.xors += 1
        return Traced(int(self) ^ int(other))

    def __xor__(self, other: int) -> "Traced":
        Traced.xors += 1
        return Traced(int(self) ^ int(other))

    def __sub__(self, other: int) -> "Traced":
        return Traced(int(self) - int(other))

    def __rshift__(self, other: int) -> "Traced":
        Traced.shifts += 1
        return Traced(int(self) >> int(other))



class Opaque(Traced):
    """A Traced value that can't be hashed or ordered, so a Counter, a set
    or a sort over these values fails."""

    def __hash__(self) -> int:
        raise AssertionError("hashed")

    def __lt__(self, other: object) -> bool:
        raise AssertionError("compared with <")

    __le__ = __gt__ = __ge__ = __lt__


def reset() -> None:
    Traced.ands = Traced.xors = Traced.shifts = 0


@pytest.mark.parametrize(
    ("n", "expected"),
    [(0, 0), (1, 1), (2, 1), (3, 2), (44, 3), (255, 8), (2**31 - 1, 31)],
)
def test_count_set_bits_known_values(n, expected):
    assert count_set_bits(n) == expected


def test_count_set_bits_boundaries_and_big_ints():
    assert count_set_bits(2**31) == 1
    assert count_set_bits(2**32 - 1) == 32
    assert count_set_bits(2**32) == 1
    assert count_set_bits(2**100 - 1) == 100
    assert count_set_bits(int("1000")) == 6


def test_count_set_bits_rejects_negative():
    with pytest.raises(ValueError):
        count_set_bits(-1)


def test_count_set_bits_agrees_with_bit_count():
    rng = random.Random(11)
    for trial in range(50):
        n = rng.getrandbits(rng.randint(1, 80))
        assert count_set_bits(n) == n.bit_count(), f"seed 11, trial {trial}: {n}"


def test_count_set_bits_clears_one_bit_per_pass():
    # 2**40 + 1 has 2 set bits in 41 positions. One AND per set bit means
    # 2 here: a loop over positions (n & 1, n >>= 1) would make 41, and
    # bin(n).count("1") or n.bit_count() would make 0.
    reset()
    assert count_set_bits(Traced(2**40 + 1)) == 2
    assert Traced.ands == 2
    assert Traced.shifts == 0


def test_is_power_of_two_known_values():
    assert [n for n in range(-3, 40) if is_power_of_two(n)] == [1, 2, 4, 8, 16, 32]
    assert not is_power_of_two(0)
    assert not is_power_of_two(-8)
    assert is_power_of_two(2**31)
    assert is_power_of_two(2**100)
    assert is_power_of_two(int("1024"))
    assert not is_power_of_two(2**100 + 1)
    assert not is_power_of_two(2**32 - 1)


def test_is_power_of_two_agrees_with_bit_count():
    rng = random.Random(12)
    for trial in range(50):
        n = rng.getrandbits(rng.randint(1, 70))
        assert is_power_of_two(n) == (n > 0 and n.bit_count() == 1), (
            f"seed 12, trial {trial}: {n}"
        )


def test_is_power_of_two_is_one_and():
    # A loop that halves n (or counts bits) makes no AND call.
    reset()
    assert is_power_of_two(Traced(1024))
    assert Traced.ands == 1
    reset()
    assert not is_power_of_two(Traced(0))
    assert Traced.ands == 0  # n > 0 fails first


def test_single_number_small_cases():
    assert single_number([7]) == 7
    assert single_number([4, 1, 2, 1, 2]) == 4
    assert single_number([2, 2, 1]) == 1
    assert single_number([0, 5, 5]) == 0
    assert single_number([-3, 5, -3]) == 5
    assert single_number([-4, -4, -9]) == -9
    assert single_number([int("1000"), 5, int("1000")]) == 5
    assert single_number([2**40, 3, 2**40]) == 3


def test_single_number_empty_raises():
    with pytest.raises(ValueError):
        single_number([])


def test_single_number_agrees_with_counter():
    rng = random.Random(13)
    for trial in range(50):
        pairs = [rng.randint(-50, 50) for _ in range(rng.randint(0, 12))]
        lone = rng.choice([v for v in range(-60, 61) if v not in pairs])
        nums = pairs * 2 + [lone]
        rng.shuffle(nums)
        counts = Counter(nums)
        expected = next(v for v, c in counts.items() if c == 1)
        assert single_number(nums) == expected, f"seed 13, trial {trial}: {nums}"


def test_single_number_is_one_xor_per_value():
    # Values that can't be hashed or ordered rule out a Counter or a sort.
    # Exactly one XOR each rules out anything but a running fold.
    nums = [Opaque(v) for v in [4, 1, 2, 1, 2]]
    reset()
    assert single_number(nums) == 4
    assert Traced.xors == len(nums)


def test_subsets_small_cases():
    assert subsets([]) == [[]]
    assert subsets([7]) == [[], [7]]
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
    # Duplicated items are separate positions, so duplicates show up.
    assert subsets([1, 1]) == [[], [1], [1], [1, 1]]


def test_subsets_match_the_mask_definition():
    rng = random.Random(14)
    for trial in range(50):
        items = [rng.randint(0, 9) for _ in range(rng.randint(0, 8))]
        n = len(items)
        expected = [
            [items[i] for i in range(n) if mask >> i & 1] for mask in range(1 << n)
        ]
        assert subsets(items) == expected, f"seed 14, trial {trial}: {items}"


def test_subsets_read_only_the_items_that_are_in():
    class Reads(list):
        count = 0

        def __getitem__(self, index):
            Reads.count += 1
            return super().__getitem__(index)

    # Each of the 5 items is in half of the 32 subsets: 5 * 16 = 80 reads,
    # one per set bit. Testing all 5 positions of every mask and indexing
    # only the set ones reads the same, so the mask-order test above pins
    # the walk; this pins that every read is a set bit (no slicing, no copy).
    items = Reads([5, 6, 7, 8, 9])
    result = subsets(items)
    assert len(result) == 2**5
    assert Reads.count == 5 * 2**4
