# region rob-memo
def rob_memo(nums: list[int]) -> int:
    """Most money from houses with no two neighbors robbed, top-down."""

    # Created inside so the memo belongs to this street and starts empty on
    # every call; a module-level memo keyed by i would mix streets up.
    memo: dict[int, int] = {}

    def best_from(i: int) -> int:
        # >=, not ==: robbing the last house jumps to len(nums) + 1.
        if i >= len(nums):
            return 0
        if i in memo:
            return memo[i]
        best = max(best_from(i + 1), nums[i] + best_from(i + 2))
        memo[i] = best
        return best

    # One stack frame per house: Python's default limit of 1,000 frames
    # raises RecursionError before 1,000 houses.
    return best_from(0)
# endregion


# region rob-table
def rob_table(nums: list[int]) -> list[int]:
    """The whole table, bottom-up: best[i] is the most from houses i onward."""
    n = len(nums)
    # Two extra slots so best[i + 2] exists for the last house; both are
    # the empty street, worth 0, which makes them the base cases.
    best = [0] * (n + 2)
    # Right to left: best[i] reads best[i + 1] and best[i + 2], which must
    # already be final. Left to right would read zeros not yet filled in.
    for i in range(n - 1, -1, -1):
        best[i] = max(best[i + 1], nums[i] + best[i + 2])
    return best
# endregion


# region houses-to-rob
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
# endregion


# region rob
def rob(nums: list[int]) -> int:
    """The same answer as rob_table(nums)[0], keeping only two entries."""
    next1 = 0
    next2 = 0
    for i in range(len(nums) - 1, -1, -1):
        current = max(next1, nums[i] + next2)
        # Slide left: next2 must take the old next1 before next1 changes.
        next2 = next1
        next1 = current
    return next1
# endregion
