from functools import cache


def rob_memo(nums: list[int]) -> int:
    """Most money from houses with no two neighbors robbed, top-down."""

    # Defined inside so the cache belongs to this street and starts empty
    # on every call; a module-level cache keyed by i would mix streets up.
    @cache
    def best_from(i: int) -> int:
        # >=, not ==: robbing the last house jumps to len(nums) + 1.
        if i >= len(nums):
            return 0
        return max(best_from(i + 1), nums[i] + best_from(i + 2))

    # One stack frame per house: Python's default limit of 1,000 frames
    # raises RecursionError before 1,000 houses (sooner on 3.11).
    return best_from(0)


def rob_table(nums: list[int]) -> list[int]:
    """The whole table, bottom-up: best[i] is the most from houses i onward."""
    n = len(nums)
    # Two extra slots so best[i + 2] exists for the last house; both are
    # the empty street, worth 0, which makes them the base cases.
    best = [0] * (n + 2)
    # Right to left: best[i] reads best[i + 1] and best[i + 2], which must
    # already be final. Left to right would read zeros not yet filled in.
    for i in reversed(range(n)):
        best[i] = max(best[i + 1], nums[i] + best[i + 2])
    return best


def houses_to_rob(nums: list[int]) -> list[int]:
    """Indices of one best set of houses, read back out of the table."""
    best = rob_table(nums)
    chosen: list[int] = []
    i = 0
    while i < len(nums):
        # Rob house i exactly when that option is what produced best[i].
        if nums[i] + best[i + 2] >= best[i + 1]:
            chosen.append(i)
            i += 2
        else:
            i += 1
    return chosen


def rob(nums: list[int]) -> int:
    """The same answer as rob_table(nums)[0], keeping only two entries."""
    next1, next2 = 0, 0
    for amount in reversed(nums):
        # One assignment: both right-hand sides use the old next1. Two
        # statements would overwrite next1 before next2 copies it.
        next1, next2 = max(next1, amount + next2), next1
    return next1
