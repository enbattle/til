# region first-true-setup
from collections.abc import Callable


def first_true(lo: int, hi: int, ok: Callable[[int], bool]) -> int:
    """Smallest x in [lo, hi) with ok(x) true, or hi if none; ok goes False then True."""
    while lo < hi:
        # Not (lo + hi) // 2: in Java or C++ that sum can overflow a 32-bit int.
        mid = lo + (hi - lo) // 2
# endregion
        # region first-true-narrow
        if ok(mid):
            hi = mid  # mid may be the answer, so it has to stay in range
        else:
            lo = mid + 1  # mid just failed; lo = mid never shrinks a range of one
    return lo
        # endregion


# region lower-bound
def lower_bound(nums: list[int], target: int) -> int:
    """First index i with nums[i] >= target in sorted nums, or len(nums) if none."""
    # >=, not >: with > this returns the index after the last copy of target.
    return first_true(0, len(nums), lambda i: nums[i] >= target)
# endregion


# region min-capacity
def min_capacity(weights: list[int], days: int) -> int:
    """Least truck capacity that ships the packages, in order, within `days`."""

    def enough(cap: int) -> bool:
        used = 1
        load = 0
        for w in weights:
            if load + w > cap:
                used += 1
                load = 0
            load += w
        return used <= days

    heaviest = 0
    total = 0
    for w in weights:
        if w > heaviest:
            heaviest = w
        total += w

    # Below the heaviest package, enough() can still say yes (that package just
    # gets its own day), so the search must not start lower. The total always works.
    return first_true(heaviest, total, enough)
# endregion
