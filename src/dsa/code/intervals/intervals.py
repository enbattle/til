Interval = tuple[int, int]  # (start, end), both ends included


def merge_intervals(intervals: list[Interval]) -> list[Interval]:
    """Merge intervals that share at least one point; result sorted, disjoint."""
    merged: list[Interval] = []
    for start, end in sorted(intervals):
        if merged and start <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], end))
        else:
            merged.append((start, end))
    return merged


def max_overlap(intervals: list[Interval]) -> int:
    """The most intervals that contain one common point (0 for no intervals)."""
    starts = sorted(start for start, _ in intervals)
    ends = sorted(end for _, end in intervals)
    best = 0
    finished = 0  # how many intervals ended before the current start
    for i, start in enumerate(starts):
        while ends[finished] < start:
            finished += 1
        best = max(best, i + 1 - finished)
    return best
