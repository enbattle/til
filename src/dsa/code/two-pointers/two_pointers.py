def pair_with_sum(nums: list[int], target: int) -> tuple[int, int] | None:
    """Indices (i, j), i < j, of two values in sorted nums that add up to target."""
    left, right = 0, len(nums) - 1
    while left < right:
        total = nums[left] + nums[right]
        if total == target:
            return left, right
        if total < target:
            left += 1
        else:
            right -= 1
    return None


def dedupe_sorted(nums: list[int]) -> int:
    """Dedupe sorted nums in place; return k, the count of unique values in nums[:k]."""
    if not nums:
        return 0
    write = 1
    for read in range(1, len(nums)):
        if nums[read] != nums[write - 1]:
            nums[write] = nums[read]
            write += 1
    return write
