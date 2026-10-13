# region next-greater
def next_greater(nums: list[int]) -> list[int]:
    """For each i, the index of the first larger value to its right, or -1."""
    answer = [-1] * len(nums)
    # Indices, not values: the answer is a position, and equal values repeat.
    stack: list[int] = []
    for i in range(len(nums)):
        # while, not if: one new value can answer several waiting positions.
        # <, not <=: an equal value isn't larger, so it keeps waiting.
        while stack and nums[stack[-1]] < nums[i]:
            waiting = stack.pop()
            answer[waiting] = i
        stack.append(i)
    return answer
# endregion


# region days-until-warmer
def days_until_warmer(temps: list[int]) -> list[int]:
    """For each day, how many days until a strictly warmer one; 0 if never."""
    warmer_day = next_greater(temps)
    days = [0] * len(temps)
    for i in range(len(temps)):
        # The -1 check matters: without it a day with no answer gets -1 - i.
        if warmer_day[i] != -1:
            days[i] = warmer_day[i] - i
    return days
# endregion


# region largest-rectangle
def largest_rectangle(heights: list[int]) -> int:
    """Area of the biggest rectangle that fits under the bars of a histogram."""
    best = 0
    stack: list[int] = []  # indices of bars, heights strictly increasing
    # One extra step with height 0 pops every bar still waiting; without it
    # the bars left on the stack at the end are never measured.
    for i in range(len(heights) + 1):
        current = 0
        if i < len(heights):
            current = heights[i]
# endregion
        # region measure-popped-bars
        while stack and heights[stack[-1]] >= current:
            popped = stack.pop()
            height = heights[popped]
            # The new top is the nearest shorter bar on the left, not the
            # popped index: bars between them were popped earlier, as taller.
            left = -1
            if stack:
                left = stack[-1]
            width = i - left - 1
            best = max(best, height * width)
        stack.append(i)
    return best
        # endregion
