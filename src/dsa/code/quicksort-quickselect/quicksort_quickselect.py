import random


def partition(nums: list[int], lo: int, hi: int, pivot: int) -> tuple[int, int]:
    """Rearrange nums[lo:hi] into three zones around the value pivot.

    Returns (lt, gt): nums[lo:lt] < pivot, nums[lt:gt] == pivot, nums[gt:hi] > pivot.
    """
    lt, i, gt = lo, lo, hi
    while i < gt:
        if nums[i] < pivot:
            nums[lt], nums[i] = nums[i], nums[lt]
            lt += 1
            i += 1
        elif nums[i] > pivot:
            gt -= 1
            nums[i], nums[gt] = nums[gt], nums[i]
        else:
            i += 1
    return lt, gt


def quicksort(nums: list[int], rng: random.Random | None = None) -> None:
    """Sort nums in place, ascending. Not stable. A seeded Random repeats a run."""
    sort_range(nums, 0, len(nums), rng or random.Random())


def sort_range(nums: list[int], lo: int, hi: int, rng: random.Random) -> None:
    """Sort nums[lo:hi] in place."""
    while hi - lo > 1:
        lt, gt = partition(nums, lo, hi, nums[rng.randrange(lo, hi)])
        if lt - lo < hi - gt:
            sort_range(nums, lo, lt, rng)
            lo = gt
        else:
            sort_range(nums, gt, hi, rng)
            hi = lt


def quickselect(nums: list[int], k: int, rng: random.Random | None = None) -> int:
    """The k-th smallest of nums, counting k from 0 (k = 0 is the minimum).

    Reorders nums in place. Raises IndexError unless 0 <= k < len(nums).
    """
    if not 0 <= k < len(nums):
        raise IndexError(f"k={k} out of range for {len(nums)} elements")
    rng = rng or random.Random()
    lo, hi = 0, len(nums)
    while True:
        lt, gt = partition(nums, lo, hi, nums[rng.randrange(lo, hi)])
        if k < lt:
            hi = lt
        elif k >= gt:
            lo = gt
        else:
            return nums[k]
