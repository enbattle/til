# region split
import random
from collections.abc import Callable


def merge_sort(items: list[int], key: Callable[[int], int] = lambda x: x) -> list[int]:
    """A new list in ascending key order; equal keys keep their input order."""
    if len(items) <= 1:
        return items[:]
    mid = len(items) // 2
    left = merge_sort(items[:mid], key)
    right = merge_sort(items[mid:], key)
    merged: list[int] = []
    i = 0
    j = 0
# endregion
    # region merge
    while i < len(left) and j < len(right):
        # <=, not <: on a tie the left item came first in the input, so it
        # goes first. With < the sort still sorts, but stability is gone.
        if key(left[i]) <= key(right[j]):
            merged.append(left[i])
            i += 1
        else:
            merged.append(right[j])
            j += 1
    # At most one of these loops runs. Its items are already in order and no
    # smaller than anything taken. Skip them and the tail vanishes.
    while i < len(left):
        merged.append(left[i])
        i += 1
    while j < len(right):
        merged.append(right[j])
        j += 1
    return merged
    # endregion


# region partition
def partition(nums: list[int], lo: int, hi: int, pivot: int) -> tuple[int, int]:
    """Rearrange nums[lo:hi] so nums[lo:lt] < pivot, nums[lt:gt] == pivot and
    nums[gt:hi] > pivot, and return (lt, gt)."""
    lt = lo
    i = lo
    gt = hi
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
# endregion


# region quickselect
def quickselect(nums: list[int], k: int) -> int:
    """The k-th smallest of nums, counting from 0. Reorders nums in place."""
    if k < 0 or k >= len(nums):
        raise IndexError(f"k={k} out of range for {len(nums)} elements")
    lo = 0
    hi = len(nums)
    while True:
        # A random pivot means no input is reliably bad. A first-element pivot
        # is the maximum every round on reversed input, so the range shrinks
        # by one a round; sorted input is milder, about n^1.5.
        pivot = nums[random.randrange(lo, hi)]
        lt, gt = partition(nums, lo, hi, pivot)
        if k < lt:
            hi = lt
        elif k >= gt:
            lo = gt
        else:
            return nums[k]
# endregion
