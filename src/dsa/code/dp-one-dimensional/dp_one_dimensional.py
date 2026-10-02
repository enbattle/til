def climb_naive(n: int) -> int:
    """Ways to climb n stairs taking 1 or 2 steps at a time, by plain recursion."""
    if n <= 1:
        return 1
    return climb_naive(n - 1) + climb_naive(n - 2)


def climb_memo(n: int) -> int:
    """The same count, but each subproblem is solved once and remembered."""
    memo: dict[int, int] = {}

    def ways(k: int) -> int:
        if k <= 1:
            return 1
        if k not in memo:
            memo[k] = ways(k - 1) + ways(k - 2)
        return memo[k]

    return ways(n)


def climb_table(n: int) -> int:
    """The same count, filled in bottom-up from the smallest subproblem."""
    ways = [1] * (n + 1)
    for k in range(2, n + 1):
        ways[k] = ways[k - 1] + ways[k - 2]
    return ways[n]


def climb(n: int) -> int:
    """The same count, keeping only the last two table entries."""
    two_back, one_back = 1, 1
    for _ in range(2, n + 1):
        two_back, one_back = one_back, two_back + one_back
    return one_back


def rob(nums: list[int]) -> int:
    """Largest total from non-negative amounts, no two adjacent houses taken."""
    skipped, best = 0, 0
    for amount in nums:
        skipped, best = best, max(best, skipped + amount)
    return best


def lis_length(nums: list[int]) -> int:
    """Length of the longest strictly increasing subsequence of nums."""
    if not nums:
        return 0
    ending_at = [1] * len(nums)
    for i in range(1, len(nums)):
        for j in range(i):
            if nums[j] < nums[i]:
                ending_at[i] = max(ending_at[i], ending_at[j] + 1)
    return max(ending_at)
