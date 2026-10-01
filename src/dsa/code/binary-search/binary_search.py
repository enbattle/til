def lower_bound(nums: list[int], target: int) -> int:
    """The first index i with nums[i] >= target in sorted nums, or len(nums) if none."""
    lo, hi = 0, len(nums)
    while lo < hi:
        mid = (lo + hi) // 2
        if nums[mid] < target:
            lo = mid + 1
        else:
            hi = mid
    return lo
