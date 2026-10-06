from collections.abc import Iterator
from typing import Generic, TypeVar

T = TypeVar("T")


class Node(Generic[T]):
    """One link: a value and the next node, or None at the end."""

    # No per-node __dict__: a million nodes would each pay for one.
    __slots__ = ("value", "next")

    def __init__(self, value: T) -> None:
        self.value = value
        self.next: Node[T] | None = None


class LinkedList(Generic[T]):
    """A singly linked list that keeps pointers to both ends."""

    def __init__(self) -> None:
        self.head: Node[T] | None = None
        self.tail: Node[T] | None = None

    def __iter__(self) -> Iterator[T]:
        node = self.head
        while node is not None:
            yield node.value
            node = node.next

    def push_front(self, value: T) -> None:
        node = Node(value)
        # Aim the new node at the old head before moving head. The other order
        # makes it point at itself and drops the rest of the list.
        node.next = self.head
        self.head = node
        if self.tail is None:
            self.tail = node

    def push_back(self, value: T) -> None:
        node = Node(value)
        if self.tail is None:
            self.head = node
        else:
            # Through the tail; walking from head to find it would cost O(n).
            self.tail.next = node
        self.tail = node

    def pop_front(self) -> T:
        node = self.head
        if node is None:
            raise IndexError("pop from empty linked list")
        self.head = node.next
        if self.head is None:
            # Left alone, tail keeps the popped node and the next push_back
            # links after it, so head never gets set.
            self.tail = None
        return node.value

    def remove(self, value: T) -> bool:
        # A node can't say who points at it, so carry that node along.
        prev: Node[T] | None = None
        node = self.head
        while node is not None and node.value != value:
            prev, node = node, node.next
        if node is None:
            return False
        if prev is None:
            self.head = node.next
        else:
            prev.next = node.next
        if node is self.tail:
            # Left alone, push_back would link after a node that's gone.
            self.tail = prev
        return True

    def reverse(self) -> None:
        prev: Node[T] | None = None
        node = self.head
        # The old head ends up last, and nothing will point at it afterward.
        self.tail = node
        while node is not None:
            # Saved first: the next line overwrites the only way forward.
            following = node.next
            node.next = prev
            prev, node = node, following
        self.head = prev
