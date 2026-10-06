from collections.abc import Iterable
from typing import Any, Generic, Protocol, TypeVar


class SupportsLessThan(Protocol):
    def __lt__(self, other: Any, /) -> bool: ...


T = TypeVar("T", bound=SupportsLessThan)


class MinHeap(Generic[T]):
    """A binary min-heap in a list: the node at i has children 2i+1 and 2i+2."""

    def __init__(self, items: Iterable[T] = ()) -> None:
        # list() copies, so the caller's list isn't rearranged behind their back.
        self._items: list[T] = list(items)
        # Indexes n // 2 and up are leaves, already one-node heaps. Going backward
        # means both subtrees of a node are heaps by the time it sifts down.
        for i in reversed(range(len(self._items) // 2)):
            self._sift_down(i)

    def __len__(self) -> int:
        return len(self._items)

    def peek(self) -> T:
        # Raise rather than return None, which a caller may have pushed.
        if not self._items:
            raise IndexError("peek at an empty heap")
        return self._items[0]

    def push(self, item: T) -> None:
        self._items.append(item)
        self._sift_up(len(self._items) - 1)

    def pop(self) -> T:
        if not self._items:
            raise IndexError("pop from an empty heap")
        # Take the last item, not index 0: deleting the front shifts every item.
        last = self._items.pop()
        # With one item, items[0] = items.pop() would fail: the list is empty.
        if not self._items:
            return last
        top = self._items[0]
        self._items[0] = last
        self._sift_down(0)
        return top

    def _sift_up(self, i: int) -> None:
        items = self._items
        while i > 0:
            parent = (i - 1) // 2  # // rounds down; / would give a float index
            # Strict <: an equal parent stays. Stopping is safe, since the
            # parent was already no larger than everything above it.
            if not items[i] < items[parent]:
                return
            items[i], items[parent] = items[parent], items[i]
            i = parent

    def _sift_down(self, i: int) -> None:
        items = self._items
        n = len(items)
        while (child := 2 * i + 1) < n:
            # The smaller child, not the first one that beats the item: it moves
            # up and becomes the other child's parent.
            if child + 1 < n and items[child + 1] < items[child]:
                child += 1
            if not items[child] < items[i]:
                return
            items[i], items[child] = items[child], items[i]
            i = child
