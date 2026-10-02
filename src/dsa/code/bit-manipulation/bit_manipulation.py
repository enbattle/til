from functools import reduce
from operator import xor


def count_set_bits(n: int) -> int:
    """Number of 1 bits in the binary form of n, for n >= 0."""
    if n < 0:
        raise ValueError("count_set_bits needs a non-negative integer")
    count = 0
    while n:
        n &= n - 1
        count += 1
    return count


def is_power_of_two(n: int) -> bool:
    """True when n is 1, 2, 4, 8, ...; zero and negatives are not."""
    return n > 0 and n & (n - 1) == 0


def single_number(nums: list[int]) -> int:
    """The value that appears once when every other value appears exactly twice."""
    if not nums:
        raise ValueError("single_number needs at least one number")
    return reduce(xor, nums, 0)


def subsets(items: list[int]) -> list[list[int]]:
    """All 2**len(items) subsets; mask m picks items[i] where bit i of m is 1."""
    n = len(items)
    return [[items[i] for i in range(n) if mask >> i & 1] for mask in range(1 << n)]
