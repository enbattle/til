def build_prefix(nums: list[int]) -> list[int]:
    """prefix[i] is the sum of nums[:i], so prefix[0] == 0 and len == len(nums) + 1."""
    prefix = [0]
    for value in nums:
        prefix.append(prefix[-1] + value)
    return prefix


def range_sum(prefix: list[int], left: int, right: int) -> int:
    """Sum of nums[left..right], both ends included, from prefix = build_prefix(nums)."""
    if not 0 <= left <= right < len(prefix) - 1:
        raise IndexError("need 0 <= left <= right < len(nums)")
    return prefix[right + 1] - prefix[left]


def count_subarrays_with_sum(nums: list[int], k: int) -> int:
    """How many non-empty contiguous subarrays of nums add up to exactly k."""
    seen = {0: 1}
    total = 0
    count = 0
    for value in nums:
        total += value
        count += seen.get(total - k, 0)
        seen[total] = seen.get(total, 0) + 1
    return count
