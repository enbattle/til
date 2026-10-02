from collections.abc import Callable, Sequence
from typing import TypeVar

T = TypeVar("T")


def counting_sort(
    items: Sequence[T], lo: int, hi: int, key: Callable[[T], int] | None = None
) -> list[T]:
    """Sort items by an integer key in [lo, hi], keeping equal keys in input order."""
    if hi < lo:
        raise ValueError("empty key range")
    get = key or (lambda item: item)
    keys = [get(item) for item in items]
    counts = [0] * (hi - lo + 1)
    for value in keys:
        if not lo <= value <= hi:
            raise ValueError(f"key {value} outside [{lo}, {hi}]")
        counts[value - lo] += 1
    for j in range(1, len(counts)):
        counts[j] += counts[j - 1]
    result = list(items)
    for i in range(len(items) - 1, -1, -1):
        counts[keys[i] - lo] -= 1
        result[counts[keys[i] - lo]] = items[i]
    return result


def radix_sort(nums: Sequence[int], base: int = 10) -> list[int]:
    """Sort non-negative integers one digit at a time, least significant first."""
    if base < 2:
        raise ValueError("base must be at least 2")
    if any(n < 0 for n in nums):
        raise ValueError("radix_sort needs non-negative integers")
    result = list(nums)
    place = 1
    while place <= max(result, default=0):
        result = counting_sort(result, 0, base - 1, lambda n: (n // place) % base)
        place *= base
    return result


def insertion_sort(items: list[float]) -> None:
    """Sort a list in place; fast when it is short or nearly sorted."""
    for i in range(1, len(items)):
        value = items[i]
        j = i - 1
        while j >= 0 and items[j] > value:
            items[j + 1] = items[j]
            j -= 1
        items[j + 1] = value


def bucket_sort(values: Sequence[float]) -> list[float]:
    """Sort floats in [0, 1) by spreading them over len(values) equal-width buckets."""
    n = len(values)
    buckets: list[list[float]] = [[] for _ in range(n)]
    for v in values:
        if not 0 <= v < 1:
            raise ValueError(f"value {v} outside [0, 1)")
        buckets[int(v * n)].append(v)
    result: list[float] = []
    for bucket in buckets:
        insertion_sort(bucket)
        result.extend(bucket)
    return result
