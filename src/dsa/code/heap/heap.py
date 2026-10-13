# region less-than
from typing import Any


def less_than(a: Any, b: Any) -> bool:
    # Works for numbers and for tuples, which compare their first elements and
    # look at the next ones only on a tie.
    return a < b
# endregion


# region min-heap
class MinHeap:
    """A binary min-heap in a list: the node at i has children 2i+1 and 2i+2."""

    def __init__(self, items: list | None = None) -> None:
        self._items = []
        if items is not None:
            # Copy, so the caller's list isn't rearranged behind their back.
            self._items = list(items)
        # Indexes n // 2 and up are leaves, already one-node heaps. Going backward
        # means both subtrees of a node are heaps by the time it sifts down.
        for i in range(len(self._items) // 2 - 1, -1, -1):
            self._sift_down(i)

    def size(self) -> int:
        return len(self._items)

    def peek(self) -> Any:
        # Raise rather than return None, which a caller may have pushed.
        if len(self._items) == 0:
            raise IndexError("peek at an empty heap")
        return self._items[0]
# endregion

    # region push-and-pop
    def push(self, item: Any) -> None:
        self._items.append(item)
        self._sift_up(len(self._items) - 1)

    def pop(self) -> Any:
        if len(self._items) == 0:
            raise IndexError("pop from an empty heap")
        # Take the last item, not index 0: deleting the front shifts every item.
        last = self._items.pop()
        # With one item, the list is empty now and there is no root to refill.
        if len(self._items) == 0:
            return last
        top = self._items[0]
        self._items[0] = last
        self._sift_down(0)
        return top
    # endregion

    # region sift-up
    def _sift_up(self, i: int) -> None:
        items = self._items
        while i > 0:
            parent = (i - 1) // 2  # // rounds down; / would give a float index
            # An equal parent stays. Stopping is safe, since the parent was
            # already no larger than everything above it.
            if not less_than(items[i], items[parent]):
                return
            items[i], items[parent] = items[parent], items[i]
            i = parent
    # endregion

    # region sift-down
    def _sift_down(self, i: int) -> None:
        items = self._items
        n = len(items)
        while 2 * i + 1 < n:
            child = 2 * i + 1
            # The smaller child, not the first one that beats the item: it moves
            # up and becomes the other child's parent.
            if child + 1 < n and less_than(items[child + 1], items[child]):
                child = child + 1
            if not less_than(items[child], items[i]):
                return
            items[i], items[child] = items[child], items[i]
            i = child
    # endregion
