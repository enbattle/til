import heapq

Entry = tuple[int, int, int]  # (value, index of its list, position in that list)


def start_heap(lists: list[list[int]]) -> list[Entry]:
    """A heap holding the first value of every non-empty list."""
    heap = [(lst[0], i, 0) for i, lst in enumerate(lists) if lst]
    heapq.heapify(heap)
    return heap


def advance(heap: list[Entry], lists: list[list[int]]) -> None:
    """Replace the smallest entry with the next value of its list, if it has one."""
    _, i, pos = heap[0]
    if pos + 1 < len(lists[i]):
        heapq.heapreplace(heap, (lists[i][pos + 1], i, pos + 1))
    else:
        heapq.heappop(heap)


def merge_sorted(lists: list[list[int]]) -> list[int]:
    """One sorted list holding every value of the sorted input lists."""
    heap = start_heap(lists)
    merged: list[int] = []
    while heap:
        merged.append(heap[0][0])
        advance(heap, lists)
    return merged


def kth_smallest(lists: list[list[int]], rank: int) -> int | None:
    """The value at `rank` (1 is the smallest) in the merged order, or None."""
    if rank < 1:
        return None
    heap = start_heap(lists)
    for _ in range(rank - 1):
        if not heap:
            return None
        advance(heap, lists)
    return heap[0][0] if heap else None
