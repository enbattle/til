import random
from collections.abc import Callable
from typing import Any, TypeVar

T = TypeVar("T")


def merge_sort(items: list[T], key: Callable[[T], Any] = lambda x: x) -> list[T]:
    """A new list in ascending key order; equal keys keep their input order."""
    if len(items) <= 1:
        return list(items)
    mid = len(items) // 2
    left = merge_sort(items[:mid], key)
    right = merge_sort(items[mid:], key)
    merged: list[T] = []
    i = j = 0
    while i < len(left) and j < len(right):
        # <=, not <: on a tie the left item came first in the input, so it
        # goes first. With < the sort still sorts, but stability is gone.
        if key(left[i]) <= key(right[j]):
            merged.append(left[i])
            i += 1
        else:
            merged.append(right[j])
            j += 1
    # At most one of these is non-empty, and its items are already in order
    # and no smaller than anything taken. Skip them and the tail vanishes.
    merged.extend(left[i:])
    merged.extend(right[j:])
    return merged


def partition(nums: list[int], lo: int, hi: int, pivot: int) -> tuple[int, int]:
    """Rearrange nums[lo:hi] so nums[lo:lt] < pivot, nums[lt:gt] == pivot and
    nums[gt:hi] > pivot, and return (lt, gt)."""
    lt, i, gt = lo, lo, hi
    while i < gt:
        if nums[i] < pivot:
            # What swaps in from lt is equal to the pivot, so i can move on.
            nums[lt], nums[i] = nums[i], nums[lt]
            lt += 1
            i += 1
        elif nums[i] > pivot:
            # What swaps in from the end is unexamined, so i must stay put.
            gt -= 1
            nums[i], nums[gt] = nums[gt], nums[i]
        else:
            i += 1
    return lt, gt


def quickselect(nums: list[int], k: int, rng: random.Random | None = None) -> int:
    """The k-th smallest of nums, counting from 0. Reorders nums in place."""
    if not 0 <= k < len(nums):
        raise IndexError(f"k={k} out of range for {len(nums)} elements")
    rng = rng or random.Random()
    lo, hi = 0, len(nums)
    while True:
        # A random pivot means no input is reliably bad. A first-element pivot
        # is the maximum every round on reversed input, so the range shrinks
        # by one a round; sorted input is milder, about n^1.5.
        lt, gt = partition(nums, lo, hi, nums[rng.randrange(lo, hi)])
        if k < lt:
            hi = lt
        elif k >= gt:
            lo = gt
        else:
            return nums[k]
