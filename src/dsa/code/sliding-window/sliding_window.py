def max_window_sum(nums: list[int], k: int) -> int | None:
    """Largest sum of k consecutive values, or None if nums has fewer than k."""
    if k < 1:
        raise ValueError("k must be at least 1")
    if k > len(nums):
        return None
    window = sum(nums[:k])
    # Start from the first window, not 0: all-negative input has a negative best.
    best = window
    for right in range(k, len(nums)):
        # The value leaving is k behind right; right - k + 1 is still inside.
        window += nums[right] - nums[right - k]
        best = max(best, window)
    return best


def shortest_run_at_least(nums: list[int], target: int) -> int:
    """Length of the shortest run summing to >= target, or 0 if none.

    Needs non-negative values, so growing a run never lowers its sum.
    """
    if target < 1:
        raise ValueError("target must be at least 1")
    shortest = len(nums) + 1  # longer than any run; 0 here would win every min
    total = left = 0
    for right in range(len(nums)):
        total += nums[right]
        # while, not if: after one drop the run may still reach the target,
        # and a shorter run would be missed.
        while total >= target:
            shortest = min(shortest, right - left + 1)
            total -= nums[left]
            left += 1
    return shortest if shortest <= len(nums) else 0


def longest_with_k_distinct(nums: list[int], k: int) -> int:
    """Length of the longest run holding at most k different values."""
    if k < 1:
        raise ValueError("k must be at least 1")
    counts: dict[int, int] = {}
    left = best = 0
    for right in range(len(nums)):
        value = nums[right]
        counts[value] = counts.get(value, 0) + 1
        while len(counts) > k:
            gone = nums[left]
            counts[gone] -= 1
            if counts[gone] == 0:
                del counts[gone]  # a key left at 0 still counts as distinct
            left += 1
        best = max(best, right - left + 1)
    return best
