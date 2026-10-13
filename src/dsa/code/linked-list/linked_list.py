# region list-node
class Node:
    """One link: a value and the next node, or None at the end."""

    def __init__(self, value: int) -> None:
        self.value = value
        self.next: Node | None = None

class LinkedList:
    """A singly linked list that keeps pointers to both ends."""

    def __init__(self) -> None:
        self.head: Node | None = None
        self.tail: Node | None = None
# endregion

    # region to-list
    def to_list(self) -> list[int]:
        values = []
        node = self.head
        while node is not None:
            values.append(node.value)
            node = node.next
        return values
    # endregion

    # region push-front
    def push_front(self, value: int) -> None:
        node = Node(value)
        # Aim the new node at the old head before moving head. The other order
        # makes it point at itself and drops the rest of the list.
        node.next = self.head
        self.head = node
        if self.tail is None:
            self.tail = node

    def push_back(self, value: int) -> None:
        node = Node(value)
        if self.tail is None:
            self.head = node
        else:
            # Through the tail; walking from head to find it would cost O(n).
            self.tail.next = node
        self.tail = node
    # endregion

    # region pop-front
    def pop_front(self) -> int:
        node = self.head
        if node is None:
            raise IndexError("pop from empty linked list")
        self.head = node.next
        if self.head is None:
            # Left alone, tail keeps the popped node and the next push_back
            # links after it, so head never gets set.
            self.tail = None
        return node.value
    # endregion

    # region remove
    def remove(self, value: int) -> bool:
        # A node can't say who points at it, so carry that node along.
        prev = None
        node = self.head
        while node is not None and node.value != value:
            prev = node
            node = node.next
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
    # endregion

    # region reverse
    def reverse(self) -> None:
        prev = None
        node = self.head
        # The old head ends up last, and nothing will point at it afterward.
        self.tail = node
        while node is not None:
            # Saved first: the next line overwrites the only way forward.
            following = node.next
            node.next = prev
            prev = node
            node = following
        self.head = prev
    # endregion
