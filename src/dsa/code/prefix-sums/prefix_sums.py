def build_prefix(nums: list[int]) -> list[int]:
    """prefix[i] is the sum of nums[:i], so prefix[0] == 0 and len == n + 1."""
    # Start at 0, not empty: prefix[left] must exist when left is 0, and
    # without it a range from 0 needs prefix[-1], which reads the last total.
    prefix = [0]
    for value in nums:
        prefix.append(prefix[-1] + value)
    return prefix


def range_sum(prefix: list[int], left: int, right: int) -> int:
    """Sum of nums[left..right], both ends included."""
    # Check first: a bad index would return a wrong number, not fail
    # (Python reads a negative index from the end).
    if not 0 <= left <= right < len(prefix) - 1:
        raise IndexError("need 0 <= left <= right < len(nums)")
    # right + 1: prefix[right] stops one element short of nums[right].
    return prefix[right + 1] - prefix[left]


def count_subarrays_with_sum(nums: list[int], k: int) -> int:
    """How many non-empty contiguous subarrays of nums add up to exactly k."""
    # Seed with the empty start: without {0: 1}, a subarray that begins at
    # index 0 has no earlier total to pair with and is never counted.
    seen = {0: 1}
    total = 0
    count = 0
    for value in nums:
        total += value
        # Look up before inserting: with k == 0 the lookup would find the
        # current total itself and count an empty subarray.
        count += seen.get(total - k, 0)
        # A count, not a set: each earlier start with this total is its
        # own subarray.
        seen[total] = seen.get(total, 0) + 1
    return count
