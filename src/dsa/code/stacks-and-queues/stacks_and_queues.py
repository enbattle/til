# region deque-state
class Deque:
    """Add at the back, remove from either end, in a ring that doubles when full."""

    def __init__(self, capacity: int = 4) -> None:
        # At least 1: doubling zero slots would never make room.
        if capacity < 1:
            capacity = 1
        self._slots: list[int] = [0] * capacity
        self._head = 0  # the slot holding the front item
        self._count = 0

    def size(self) -> int:
        return self._count

    def _slot(self, offset: int) -> int:
        # % sends a position past the last slot back around to slot 0.
        return (self._head + offset) % len(self._slots)
# endregion

    # region add-at-back
    def append(self, item: int) -> None:
        if self._count == len(self._slots):
            self._grow()  # full: the slot after the back is the front's
        self._slots[self._slot(self._count)] = item
        self._count += 1
    # endregion

    # region read-and-remove
    def peekleft(self) -> int:
        # Check the count, not the slot: any value, even 0, could be an item.
        if self._count == 0:
            raise IndexError("empty deque")
        return self._slots[self._head]

    def peek(self) -> int:
        if self._count == 0:
            raise IndexError("empty deque")
        return self._slots[self._slot(self._count - 1)]

    def popleft(self) -> int:
        item = self.peekleft()
        self._head = self._slot(1)
        self._count -= 1
        return item

    def pop(self) -> int:
        item = self.peek()
        self._count -= 1
        return item
    # endregion

    # region grow
    def _grow(self) -> None:
        # Unroll the ring so the front lands in slot 0 of the bigger array.
        old = self._slots
        self._slots = [0] * (len(old) * 2)
        for i in range(self._count):
            self._slots[i] = old[(self._head + i) % len(old)]
        self._head = 0
    # endregion


# region is-balanced
OPENERS = "([{"
PARTNER = {")": "(", "]": "[", "}": "{"}  # each closer maps to its opener


def is_balanced(text: str) -> bool:
    """True if every bracket is closed by its partner, innermost first."""
    stack: list[str] = []  # a plain list: append and pop work at the end
    for ch in text:
        if ch in OPENERS:
            stack.append(ch)
        elif ch in PARTNER:
            # A closer with nothing open is a mismatch; check before popping.
            if len(stack) == 0:
                return False
            top = stack.pop()
            if top != PARTNER[ch]:
                return False
    return len(stack) == 0  # an opener still on the stack was never closed
# endregion


# region window-max
def window_max(nums: list[int], k: int) -> list[int]:
    """The maximum of every run of k consecutive items, in O(n)."""
    if k < 1:
        raise ValueError("k must be at least 1")
    window = Deque()  # indices; their values fall front to back
    out: list[int] = []
    for i in range(len(nums)):
        # An earlier item no bigger than nums[i] leaves the window before it
        # does, so it can never be the maximum again.
        while window.size() > 0 and nums[window.peek()] <= nums[i]:
            window.pop()
        window.append(i)
        # Indices, not values: this is how we know the front has expired.
        if window.peekleft() <= i - k:
            window.popleft()
        if i >= k - 1:
            out.append(nums[window.peekleft()])
    return out
# endregion
