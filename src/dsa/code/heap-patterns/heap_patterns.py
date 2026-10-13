# region imports
import heapq
# endregion


# region top-k-largest
def top_k_largest(items: list[int], k: int) -> list[int]:
    """The k largest items, largest first; all of them if there are fewer."""
    if k <= 0:  # heap[0] below would raise on an empty heap
        return []
    heap: list[int] = []
    for x in items:
        if len(heap) < k:
            heapq.heappush(heap, x)
        # Strict: an equal item can't improve the k, and a swap costs a sift.
        elif heap[0] < x:
            heapq.heappop(heap)
            heapq.heappush(heap, x)
    return sorted(heap, reverse=True)  # a heap is only partly ordered
# endregion


# region merge-sorted
def merge_sorted(lists: list[list[int]]) -> list[int]:
    """One sorted list holding every item of the sorted input lists."""
    # Each entry is (value, which list, position). The list index breaks ties on
    # value, so equal values come out in list order (a stable merge).
    heap: list[tuple[int, int, int]] = []
    for i in range(len(lists)):
        if len(lists[i]) > 0:
            heapq.heappush(heap, (lists[i][0], i, 0))
    merged: list[int] = []
    while len(heap) > 0:
        value, i, pos = heapq.heappop(heap)
        merged.append(value)
        # A drained list just isn't pushed back; reading past its end would fail.
        if pos + 1 < len(lists[i]):
            heapq.heappush(heap, (lists[i][pos + 1], i, pos + 1))
    return merged
# endregion


# region running-medians
def running_medians(stream: list[int]) -> list[float]:
    """The median after each value: the mean of the middle two when even."""
    # heapq is a min-heap, so low stores negated values: its smallest entry is
    # the largest of the smaller half.
    low: list[int] = []  # the smaller half
    high: list[int] = []  # the larger half
    medians: list[float] = []
    for x in stream:
        # Through low, then its largest moves to high: wherever x belongs, every
        # item in low stays <= every item in high.
        heapq.heappush(low, -x)
        largest_small = -heapq.heappop(low)
        heapq.heappush(high, largest_small)
        # Low keeps the extra item, so its root is the median of an odd count.
        if len(high) > len(low):
            smallest_large = heapq.heappop(high)
            heapq.heappush(low, -smallest_large)
        if len(low) > len(high):
            medians.append(float(-low[0]))
        else:
            medians.append((-low[0] + high[0]) / 2)
    return medians
# endregion
