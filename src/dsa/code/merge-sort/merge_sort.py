from collections.abc import Callable
from typing import Any, TypeVar

T = TypeVar("T")


def _identity(item: Any) -> Any:
    return item


def merge(left: list[T], right: list[T], key: Callable[[T], Any] = _identity) -> list[T]:
    """Merge two lists, each already sorted by key, into one sorted list."""
    merged: list[T] = []
    i = j = 0
    while i < len(left) and j < len(right):
        if key(left[i]) <= key(right[j]):
            merged.append(left[i])
            i += 1
        else:
            merged.append(right[j])
            j += 1
    merged.extend(left[i:])
    merged.extend(right[j:])
    return merged


def merge_sort(items: list[T], key: Callable[[T], Any] = _identity) -> list[T]:
    """A new list with the items in ascending key order; ties keep their order."""
    if len(items) <= 1:
        return list(items)
    mid = len(items) // 2
    return merge(merge_sort(items[:mid], key), merge_sort(items[mid:], key), key)


def sort_and_count(nums: list[int]) -> tuple[list[int], int]:
    """The sorted list and the number of pairs i < j with nums[i] > nums[j]."""
    if len(nums) <= 1:
        return list(nums), 0
    mid = len(nums) // 2
    left, left_count = sort_and_count(nums[:mid])
    right, right_count = sort_and_count(nums[mid:])
    merged: list[int] = []
    crossing = 0
    i = j = 0
    while i < len(left) and j < len(right):
        if left[i] <= right[j]:
            merged.append(left[i])
            i += 1
        else:
            merged.append(right[j])
            j += 1
            crossing += len(left) - i
    merged.extend(left[i:])
    merged.extend(right[j:])
    return merged, left_count + right_count + crossing
