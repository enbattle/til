import heapq
from collections.abc import Iterable


def top_k_largest(items: Iterable[int], k: int) -> list[int]:
    """The k largest items, largest first; all of them if there are fewer."""
    if k <= 0:  # heap[0] below would raise on an empty heap
        return []
    heap: list[int] = []
    for x in items:
        if len(heap) < k:
            heapq.heappush(heap, x)
        # Strict: an equal item can't improve the k, and a swap costs a sift.
        elif heap[0] < x:
            heapq.heapreplace(heap, x)
    return sorted(heap, reverse=True)  # a heap is only partly ordered


def merge_sorted(lists: list[list[int]]) -> list[int]:
    """One sorted list holding every item of the sorted input lists."""
    # The list index breaks ties on value, so equal values come out in list
    # order (a stable merge) and a tuple never has to compare past it.
    heap = [(lst[0], i, 0) for i, lst in enumerate(lists) if lst]
    heapq.heapify(heap)
    merged: list[int] = []
    while heap:
        value, i, pos = heap[0]
        merged.append(value)
        if pos + 1 < len(lists[i]):
            heapq.heapreplace(heap, (lists[i][pos + 1], i, pos + 1))
        else:
            heapq.heappop(heap)  # a drained list must leave, or its head repeats
    return merged


def running_medians(stream: Iterable[float]) -> list[float]:
    """The median after each value: the mean of the middle two when even."""
    low: list[float] = []  # max-heap of the smaller half, stored negated
    high: list[float] = []  # min-heap of the larger half
    medians: list[float] = []
    for x in stream:
        # Through low, then its largest moves to high: wherever x belongs, every
        # item in low stays <= every item in high.
        heapq.heappush(low, -x)
        heapq.heappush(high, -heapq.heappop(low))
        # Low keeps the extra item, so its root is the median of an odd count.
        if len(high) > len(low):
            heapq.heappush(low, -heapq.heappop(high))
        if len(low) > len(high):
            medians.append(float(-low[0]))
        else:
            medians.append((-low[0] + high[0]) / 2)
    return medians
