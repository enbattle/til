from collections.abc import Iterable, Iterator
from typing import Any, Generic, TypeVar

T = TypeVar("T")


class Deque(Generic[T]):
    """A double-ended queue stored in a circular buffer that doubles when full."""

    def __init__(self, capacity: int = 8) -> None:
        if capacity < 1:
            raise ValueError("capacity must be at least 1")
        self._slots: list[Any] = [None] * capacity
        self._head = 0  # the slot holding the front item
        self._size = 0

    def __len__(self) -> int:
        return self._size

    @property
    def capacity(self) -> int:
        return len(self._slots)

    def _index(self, offset: int) -> int:
        """The slot holding the item `offset` places behind the front."""
        return (self._head + offset) % len(self._slots)

    def append(self, item: T) -> None:
        if self._size == len(self._slots):
            self._grow()
        self._slots[self._index(self._size)] = item
        self._size += 1

    def appendleft(self, item: T) -> None:
        if self._size == len(self._slots):
            self._grow()
        self._head = (self._head - 1) % len(self._slots)
        self._slots[self._head] = item
        self._size += 1

    def pop(self) -> T:
        if self._size == 0:
            raise IndexError("pop from an empty deque")
        i = self._index(self._size - 1)
        item = self._slots[i]
        self._slots[i] = None
        self._size -= 1
        return item

    def popleft(self) -> T:
        if self._size == 0:
            raise IndexError("pop from an empty deque")
        item = self._slots[self._head]
        self._slots[self._head] = None
        self._head = (self._head + 1) % len(self._slots)
        self._size -= 1
        return item

    def peek(self) -> T:
        if self._size == 0:
            raise IndexError("peek at an empty deque")
        return self._slots[self._index(self._size - 1)]

    def peekleft(self) -> T:
        if self._size == 0:
            raise IndexError("peek at an empty deque")
        return self._slots[self._head]

    def _grow(self) -> None:
        old = self._slots
        self._slots = old[self._head :] + old[: self._head] + [None] * len(old)
        self._head = 0

    def __iter__(self) -> Iterator[T]:
        for offset in range(self._size):
            yield self._slots[self._index(offset)]


def recent_counts(times: Iterable[int], window: int) -> list[int]:
    """For each time t (in non-decreasing order), count the times in [t - window, t]."""
    queue: Deque[int] = Deque()
    counts = []
    for t in times:
        queue.append(t)
        while queue.peekleft() < t - window:
            queue.popleft()
        counts.append(len(queue))
    return counts
