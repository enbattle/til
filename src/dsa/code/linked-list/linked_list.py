from collections.abc import Iterable, Iterator
from typing import Generic, TypeVar

T = TypeVar("T")


class Node(Generic[T]):
    """One link: a value and a reference to the next node, or None at the end."""

    __slots__ = ("value", "next")

    def __init__(self, value: T) -> None:
        self.value = value
        self.next: Node[T] | None = None


class LinkedList(Generic[T]):
    """A singly linked list that keeps pointers to its first and last nodes."""

    def __init__(self, values: Iterable[T] = ()) -> None:
        self._head: Node[T] | None = None
        self._tail: Node[T] | None = None
        self._size = 0
        for value in values:
            self.push_back(value)

    def __len__(self) -> int:
        return self._size

    def __iter__(self) -> Iterator[T]:
        node = self._head
        while node is not None:
            yield node.value
            node = node.next

    def push_front(self, value: T) -> None:
        node = Node(value)
        node.next = self._head
        self._head = node
        if self._tail is None:
            self._tail = node
        self._size += 1

    def push_back(self, value: T) -> None:
        node = Node(value)
        if self._tail is None:
            self._head = node
        else:
            self._tail.next = node
        self._tail = node
        self._size += 1

    def pop_front(self) -> T:
        if self._head is None:
            raise IndexError("pop from empty linked list")
        node = self._head
        self._head = node.next
        if self._head is None:
            self._tail = None
        self._size -= 1
        return node.value

    def find(self, value: T) -> Node[T] | None:
        node = self._head
        while node is not None and node.value != value:
            node = node.next
        return node

    def __contains__(self, value: object) -> bool:
        return any(v == value for v in self)

    def remove(self, value: T) -> bool:
        prev: Node[T] | None = None
        node = self._head
        while node is not None and node.value != value:
            prev, node = node, node.next
        if node is None:
            return False
        if prev is None:
            self._head = node.next
        else:
            prev.next = node.next
        if node is self._tail:
            self._tail = prev
        self._size -= 1
        return True

    def reverse(self) -> None:
        prev: Node[T] | None = None
        node = self._head
        self._tail = node
        while node is not None:
            following = node.next
            node.next = prev
            prev = node
            node = following
        self._head = prev
