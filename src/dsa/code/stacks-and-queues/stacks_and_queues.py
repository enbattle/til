from typing import Any, Generic, TypeVar

T = TypeVar("T")


class Deque(Generic[T]):
    """Push at the back, pop at either end, in a ring that doubles when full."""

    def __init__(self, capacity: int = 4) -> None:
        # At least 1: doubling zero slots would never make room.
        self._slots: list[Any] = [None] * max(capacity, 1)
        self._head = 0  # the slot holding the front item
        self._size = 0

    def __len__(self) -> int:
        return self._size

    def _slot(self, offset: int) -> int:
        # % sends a position past the last slot back around to slot 0.
        return (self._head + offset) % len(self._slots)

    def append(self, item: T) -> None:
        if self._size == len(self._slots):
            self._grow()  # full: the slot after the back is the front's
        self._slots[self._slot(self._size)] = item
        self._size += 1

    def peekleft(self) -> T:
        # Check the size, not the slot: None could be a stored item.
        if self._size == 0:
            raise IndexError("empty deque")
        return self._slots[self._head]

    def peek(self) -> T:
        if self._size == 0:
            raise IndexError("empty deque")
        return self._slots[self._slot(self._size - 1)]

    def popleft(self) -> T:
        item = self.peekleft()
        self._slots[self._head] = None  # don't keep a removed item alive
        self._head = self._slot(1)
        self._size -= 1
        return item

    def pop(self) -> T:
        item = self.peek()
        self._slots[self._slot(self._size - 1)] = None
        self._size -= 1
        return item

    def _grow(self) -> None:
        # Unroll the ring so the front lands in slot 0 of the bigger array.
        old = self._slots
        self._slots = old[self._head :] + old[: self._head] + [None] * len(old)
        self._head = 0


PAIRS = {")": "(", "]": "[", "}": "{"}


def is_balanced(text: str) -> bool:
    """True if every bracket is closed by its partner, innermost first."""
    stack: list[str] = []  # a plain list: append and pop work at the end
    for ch in text:
        if ch in PAIRS.values():
            stack.append(ch)
        elif ch in PAIRS:
            # Test emptiness first: a closer with nothing open is a mismatch.
            if not stack or stack.pop() != PAIRS[ch]:
                return False
    return not stack  # an opener still on the stack was never closed


def window_max(nums: list[int], k: int) -> list[int]:
    """The maximum of every run of k consecutive items, in O(n)."""
    if k < 1:
        raise ValueError("k must be at least 1")
    window: Deque[int] = Deque()  # indices; their values fall front to back
    out: list[int] = []
    for i, x in enumerate(nums):
        # An earlier item no bigger than x leaves the window before x does,
        # so it can never be the maximum again.
        while len(window) and nums[window.peek()] <= x:
            window.pop()
        window.append(i)
        # Indices, not values: this is how we know the front has expired.
        if window.peekleft() <= i - k:
            window.popleft()
        if i >= k - 1:
            out.append(nums[window.peekleft()])
    return out
