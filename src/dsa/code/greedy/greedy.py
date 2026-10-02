Interval = tuple[int, int]  # (start, end), half-open: includes start, not end


def select_intervals(intervals: list[Interval]) -> list[Interval]:
    """A largest set of pairwise non-overlapping intervals (start < end each)."""
    chosen: list[Interval] = []
    for start, end in sorted(intervals, key=lambda interval: interval[1]):
        if not chosen or start >= chosen[-1][1]:
            chosen.append((start, end))
    return chosen


def can_reach_end(jumps: list[int]) -> bool:
    """Can you get from index 0 to the last index? jumps[i] >= 0 is the longest
    jump from i; any shorter jump is allowed too. An empty list has no last index."""
    if not jumps:
        return False
    farthest = 0
    for i, length in enumerate(jumps):
        if i > farthest:
            return False
        farthest = max(farthest, i + length)
    return True


def greedy_coin_count(coins: list[int], amount: int) -> int | None:
    """Coins used by always taking the largest coin that fits, or None if stuck.

    This is NOT always the fewest coins; see the entry. Coins are positive,
    amount is not negative.
    """
    remaining = amount
    count = 0
    for coin in sorted(coins, reverse=True):
        count += remaining // coin
        remaining %= coin
    return count if remaining == 0 else None
