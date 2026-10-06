Interval = tuple[int, int]  # half-open: (1, 4) and (4, 6) don't overlap


def select_intervals(intervals: list[Interval]) -> list[Interval]:
    """A largest set of pairwise non-overlapping intervals (start < end each)."""
    chosen: list[Interval] = []
    # By end, not start or length: the interval that ends first leaves the
    # most room, and the other two orders can pick one that blocks several.
    for start, end in sorted(intervals, key=lambda interval: interval[1]):
        # Sorted by end, chosen[-1] ends last of everything taken, so one
        # comparison covers them all. >=, not >: touching intervals both fit.
        if not chosen or start >= chosen[-1][1]:
            chosen.append((start, end))
    return chosen


def can_reach_end(jumps: list[int]) -> bool:
    """Can you get from index 0 to the last index? jumps[i] is the longest
    jump from i; shorter ones are allowed. An empty list has no last index."""
    if not jumps:
        return False
    farthest = 0
    for i, length in enumerate(jumps):
        # Check before updating, so a gap stops the walk. > and not >=:
        # index farthest itself is reachable (>= rejects index 0).
        if i > farthest:
            return False
        # max, not assignment: a later index can reach less far than an earlier.
        farthest = max(farthest, i + length)
    return True


def greedy_coin_count(coins: list[int], amount: int) -> int | None:
    """Coins used by always taking the largest that fits, or None if stuck.
    NOT always the fewest coins. Coins are positive, amount is not negative."""
    count = 0
    # Largest first is the rule itself; the caller's order isn't trusted.
    for coin in sorted(coins, reverse=True):
        # A coin can repeat, and one bigger than amount adds 0: no guard needed.
        count += amount // coin
        amount %= coin
    # A leftover means nothing fit it; returning count would pay too little.
    return count if amount == 0 else None
