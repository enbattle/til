def next_greater(nums: list[int]) -> list[int]:
    """For each i, the index of the first larger value to its right, or -1."""
    answer = [-1] * len(nums)
    # Indices, not values: the answer is a position, and equal values repeat.
    stack: list[int] = []
    for i, value in enumerate(nums):
        # while, not if: one new value can answer several waiting positions.
        # <, not <=: an equal value isn't larger, so it keeps waiting.
        while stack and nums[stack[-1]] < value:
            answer[stack.pop()] = i
        stack.append(i)
    return answer


def days_until_warmer(temps: list[int]) -> list[int]:
    """For each day, how many days until a strictly warmer one; 0 if never."""
    # The -1 check matters: without it a day with no answer gets -1 - i.
    return [0 if j == -1 else j - i for i, j in enumerate(next_greater(temps))]


def largest_rectangle(heights: list[int]) -> int:
    """Area of the biggest rectangle that fits under the bars of a histogram."""
    best = 0
    stack: list[int] = []  # indices of bars, heights never decreasing
    # One extra step with height 0 pops every bar still waiting; without it
    # the bars left on the stack at the end are never measured.
    for i in range(len(heights) + 1):
        h = heights[i] if i < len(heights) else 0
        while stack and heights[stack[-1]] >= h:
            height = heights[stack.pop()]
            # The new top is the nearest shorter bar on the left, not the
            # popped index: bars between them were popped earlier, as taller.
            left = stack[-1] if stack else -1
            best = max(best, height * (i - left - 1))
        stack.append(i)
    return best
