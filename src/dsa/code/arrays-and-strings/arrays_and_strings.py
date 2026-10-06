from typing import Any, Generic, Self, TypeVar

T = TypeVar("T")


class DynamicArray(Generic[T]):
    """A growable array on fixed-size storage that doubles when it fills."""

    def __init__(self) -> None:
        self._data: list[Any] = [None]
        self._size = 0

    def __len__(self) -> int:
        return self._size

    @property
    def capacity(self) -> int:
        return len(self._data)

    def __getitem__(self, i: int) -> T:
        # Check against the length, not the capacity: the spare slots past it
        # would hand back None as if it were an item.
        if not 0 <= i < self._size:
            raise IndexError(i)
        return self._data[i]

    def insert(self, i: int, item: T) -> None:
        # i == length is allowed: that is an append.
        if not 0 <= i <= self._size:
            raise IndexError(i)
        if self._size == len(self._data):
            # Double rather than add a fixed number of slots: a fixed step
            # copies everything every few appends, so n appends cost O(n^2).
            bigger: list[Any] = [None] * (2 * len(self._data))
            bigger[: self._size] = self._data
            self._data = bigger
        # Shift from the right end: from the left, each item would overwrite
        # its neighbor before that neighbor had moved.
        for j in range(self._size, i, -1):
            self._data[j] = self._data[j - 1]
        self._data[i] = item
        self._size += 1

    def append(self, item: T) -> None:
        self.insert(self._size, item)


class StringBuilder:
    """Collects pieces and joins them once, in time linear in the total."""

    def __init__(self) -> None:
        self._parts: list[str] = []

    def append(self, piece: str) -> Self:
        # Storing the piece copies no text; += on a string would copy it all.
        self._parts.append(piece)
        return self

    def build(self) -> str:
        text = "".join(self._parts)
        # Keep the result as one piece, so a second build won't join it all again.
        self._parts = [text]
        return text


def reverse_code_points(s: str) -> str:
    # Python indexes code points, so a slice keeps an emoji whole. It still
    # splits an "e" from the combining accent written after it.
    return s[::-1]
