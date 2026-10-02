import heapq


class RunningMedian:
    """The median of the numbers added so far, in O(log n) per add and O(1) per read."""

    def __init__(self) -> None:
        self._lower: list[float] = []  # max-heap of the smaller half, values negated
        self._upper: list[float] = []  # min-heap of the larger half

    def __len__(self) -> int:
        return len(self._lower) + len(self._upper)

    def add(self, value: float) -> None:
        heapq.heappush(self._lower, -value)
        heapq.heappush(self._upper, -heapq.heappop(self._lower))
        if len(self._upper) > len(self._lower):
            heapq.heappush(self._lower, -heapq.heappop(self._upper))

    def median(self) -> float:
        """The middle value, or the mean of the two middle values. Raises if empty."""
        if not self._lower:
            raise ValueError("median of an empty stream")
        if len(self._lower) > len(self._upper):
            return float(-self._lower[0])
        return (-self._lower[0] + self._upper[0]) / 2
