import heapq
from collections import Counter


def top_k_largest(nums: list[int], k: int) -> list[int]:
    """The k largest values of nums, largest first; all of nums if k >= len(nums)."""
    if k <= 0:
        return []
    heap: list[int] = []
    for value in nums:
        if len(heap) < k:
            heapq.heappush(heap, value)
        elif value > heap[0]:
            heapq.heapreplace(heap, value)
    return sorted(heap, reverse=True)


def top_k_frequent(nums: list[int], k: int) -> list[int]:
    """The k most frequent values, most frequent first; equal counts, smaller first."""
    if k <= 0:
        return []
    heap: list[tuple[int, int]] = []
    for value, count in Counter(nums).items():
        entry = (count, -value)
        if len(heap) < k:
            heapq.heappush(heap, entry)
        elif entry > heap[0]:
            heapq.heapreplace(heap, entry)
    heap.sort(reverse=True)
    return [-negated for _, negated in heap]
