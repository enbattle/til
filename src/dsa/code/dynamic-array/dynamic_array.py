from collections.abc import Iterator
from typing import Any, Generic, TypeVar

T = TypeVar("T")


class DynamicArray(Generic[T]):
    """A growable array on fixed-size storage that doubles when it fills up."""

    def __init__(self, capacity: int = 4):
        if capacity < 1:
            raise ValueError("capacity must be at least 1")
        self._data: list[Any] = [None] * capacity
        self._size = 0

    def __len__(self) -> int:
        return self._size

    @property
    def capacity(self) -> int:
        return len(self._data)

    def _index(self, index: int) -> int:
        if index < 0:
            index += self._size
        if not 0 <= index < self._size:
            raise IndexError("index out of range")
        return index

    def __getitem__(self, index: int) -> T:
        return self._data[self._index(index)]

    def __setitem__(self, index: int, value: T) -> None:
        self._data[self._index(index)] = value

    def __iter__(self) -> Iterator[T]:
        for i in range(self._size):
            yield self._data[i]

    def _resize(self, new_capacity: int) -> None:
        new_data: list[Any] = [None] * new_capacity
        new_data[: self._size] = self._data[: self._size]
        self._data = new_data

    def append(self, value: T) -> None:
        if self._size == len(self._data):
            self._resize(2 * len(self._data))
        self._data[self._size] = value
        self._size += 1

    def insert(self, index: int, value: T) -> None:
        if not 0 <= index <= self._size:
            raise IndexError("insert index out of range")
        if self._size == len(self._data):
            self._resize(2 * len(self._data))
        self._data[index + 1 : self._size + 1] = self._data[index : self._size]
        self._data[index] = value
        self._size += 1

    def pop(self, index: int = -1) -> T:
        index = self._index(index)
        value = self._data[index]
        self._data[index : self._size - 1] = self._data[index + 1 : self._size]
        self._size -= 1
        self._data[self._size] = None
        if self._size <= len(self._data) // 4 and len(self._data) > 1:
            self._resize(len(self._data) // 2)
        return value
