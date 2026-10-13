# region merge-intervals
Interval = tuple[int, int]  # (start, end), both ends included


def merge_intervals(intervals: list[Interval]) -> list[Interval]:
    """Merge intervals that share at least one point; result sorted, disjoint."""
    merged: list[Interval] = []
    # Sorted by start (on a copy): that order is what lets the last merged one decide.
    for start, end in sorted(intervals):
        # <=, not <: with inclusive ends, [2, 6] and [6, 7] share the point 6.
        if merged and start <= merged[-1][1]:
            # max, not end: a nested [2, 3] inside [1, 10] must not shrink it.
            merged[-1] = (merged[-1][0], max(merged[-1][1], end))
        else:
            merged.append((start, end))
    return merged
# endregion


# region max-overlap
def max_overlap(intervals: list[Interval]) -> int:
    """The most intervals that contain one common point (0 for no intervals)."""
    # Sorted apart: which end belongs to which start never matters for counting.
    starts: list[int] = []
    ends: list[int] = []
    for start, end in intervals:
        starts.append(start)
        ends.append(end)
    starts.sort()
    ends.sort()
    best = 0
    finished = 0
    for i in range(len(starts)):
        start = starts[i]
        # <, not <=: an end equal to this start still contains the point.
        # finished never moves back, since later starts are no smaller.
        while ends[finished] < start:
            finished += 1
        best = max(best, i + 1 - finished)
    return best
# endregion


# region insert-interval
def insert_interval(merged: list[Interval], new: Interval) -> list[Interval]:
    """Add one interval to a sorted, disjoint list, fusing what it touches."""
    start, end = new
    out: list[Interval] = []
    i = 0
    # Strictly before: an interval ending at start still shares that point.
    while i < len(merged) and merged[i][1] < start:
        out.append(merged[i])
        i += 1
    while i < len(merged) and merged[i][0] <= end:
        # min and max both: new may sit inside or stretch past either side.
        start, end = min(start, merged[i][0]), max(end, merged[i][1])
        i += 1
    out.append((start, end))
    return out + merged[i:]
# endregion
