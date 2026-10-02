from collections.abc import Iterable
from itertools import count
from typing import Any, Generic, Protocol, TypeVar


class SupportsLessThan(Protocol):
    def __lt__(self, other: Any, /) -> bool: ...


T = TypeVar("T", bound=SupportsLessThan)
V = TypeVar("V")


def parent(i: int) -> int:
    return (i - 1) // 2


def left(i: int) -> int:
    return 2 * i + 1


def right(i: int) -> int:
    return 2 * i + 2


class MinHeap(Generic[T]):
    """A binary min-heap stored in a list: the smallest item is always at index 0."""

    def __init__(self, items: Iterable[T] = ()) -> None:
        self._items: list[T] = list(items)
        for i in reversed(range(len(self._items) // 2)):
            self._sift_down(i)

    def __len__(self) -> int:
        return len(self._items)

    def peek(self) -> T:
        if not self._items:
            raise IndexError("peek at an empty heap")
        return self._items[0]

    def push(self, item: T) -> None:
        self._items.append(item)
        self._sift_up(len(self._items) - 1)

    def pop(self) -> T:
        if not self._items:
            raise IndexError("pop from an empty heap")
        last = self._items.pop()
        if not self._items:
            return last
        top = self._items[0]
        self._items[0] = last
        self._sift_down(0)
        return top

    def _sift_up(self, i: int) -> None:
        items = self._items
        while i > 0 and items[i] < items[parent(i)]:
            items[i], items[parent(i)] = items[parent(i)], items[i]
            i = parent(i)

    def _sift_down(self, i: int) -> None:
        items = self._items
        n = len(items)
        while True:
            smallest = i
            if left(i) < n and items[left(i)] < items[smallest]:
                smallest = left(i)
            if right(i) < n and items[right(i)] < items[smallest]:
                smallest = right(i)
            if smallest == i:
                return
            items[i], items[smallest] = items[smallest], items[i]
            i = smallest


class PriorityQueue(Generic[V]):
    """Items come out lowest priority first; equal priorities in insertion order."""

    def __init__(self) -> None:
        self._heap: MinHeap[tuple[float, int, V]] = MinHeap()
        self._order = count()

    def __len__(self) -> int:
        return len(self._heap)

    def push(self, item: V, priority: float) -> None:
        self._heap.push((priority, next(self._order), item))

    def peek(self) -> V:
        return self._heap.peek()[2]

    def pop(self) -> V:
        return self._heap.pop()[2]
