def next_greater(nums: list[int]) -> list[int]:
    """For each i, the index of the first value to its right that is larger, or -1."""
    answer = [-1] * len(nums)
    stack: list[int] = []  # indices of values still waiting for a larger one
    for i, value in enumerate(nums):
        while stack and nums[stack[-1]] < value:
            answer[stack.pop()] = i
        stack.append(i)
    return answer


def days_until_warmer(temps: list[int]) -> list[int]:
    """For each day, how many days until a strictly warmer one; 0 if never."""
    later = next_greater(temps)
    return [0 if j == -1 else j - i for i, j in enumerate(later)]
