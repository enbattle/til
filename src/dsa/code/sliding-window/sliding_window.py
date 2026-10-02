def max_window_sum(nums: list[int], k: int) -> int | None:
    """Largest sum of k consecutive values in nums, or None if nums has fewer than k."""
    if k < 1:
        raise ValueError("k must be at least 1")
    if k > len(nums):
        return None
    window = sum(nums[:k])
    best = window
    for right in range(k, len(nums)):
        window += nums[right] - nums[right - k]
        best = max(best, window)
    return best


def longest_unique_substring(text: str) -> int:
    """Length, in code points, of the longest run of text with no repeated character."""
    counts: dict[str, int] = {}
    left = 0
    best = 0
    for right, char in enumerate(text):
        counts[char] = counts.get(char, 0) + 1
        while counts[char] > 1:
            counts[text[left]] -= 1
            left += 1
        best = max(best, right - left + 1)
    return best
