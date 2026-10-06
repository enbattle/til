from collections.abc import Callable


def first_true(lo: int, hi: int, ok: Callable[[int], bool]) -> int:
    """Smallest x in [lo, hi) with ok(x) true, or hi if none; ok goes False then True."""
    while lo < hi:
        # Not (lo + hi) // 2: in a fixed-width language that sum can overflow.
        mid = lo + (hi - lo) // 2
        if ok(mid):
            hi = mid  # mid may be the answer, so it has to stay in range
        else:
            lo = mid + 1  # mid just failed; lo = mid never shrinks a range of one
    return lo


def lower_bound(nums: list[int], target: int) -> int:
    """First index i with nums[i] >= target in sorted nums, or len(nums) if none."""
    # >=, not >: with > this returns the index after the last copy of target.
    return first_true(0, len(nums), lambda i: nums[i] >= target)


def min_capacity(weights: list[int], days: int) -> int:
    """Least truck capacity that ships the packages, in order, within `days`."""

    def enough(cap: int) -> bool:
        used, load = 1, 0
        for w in weights:
            if load + w > cap:
                used, load = used + 1, 0
            load += w
        return used <= days

    # Below max(weights) the heaviest package fits on no day, yet enough() can
    # still say yes, so the search must not start lower. sum(weights) always works.
    return first_true(max(weights, default=0), sum(weights), enough)
