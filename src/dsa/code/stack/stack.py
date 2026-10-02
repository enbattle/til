from typing import Generic, TypeVar

T = TypeVar("T")


class Stack(Generic[T]):
    """A last-in, first-out stack on a dynamic array (a Python list)."""

    def __init__(self) -> None:
        self._items: list[T] = []

    def push(self, item: T) -> None:
        self._items.append(item)

    def pop(self) -> T:
        if not self._items:
            raise IndexError("pop from an empty stack")
        return self._items.pop()

    def peek(self) -> T:
        if not self._items:
            raise IndexError("peek at an empty stack")
        return self._items[-1]

    def __len__(self) -> int:
        return len(self._items)

    def is_empty(self) -> bool:
        return not self._items


CLOSER_TO_OPENER = {")": "(", "]": "[", "}": "{"}
OPENERS = set(CLOSER_TO_OPENER.values())


def is_balanced(text: str) -> bool:
    """True if every bracket in text is closed by its partner, in the right order."""
    stack: Stack[str] = Stack()
    for ch in text:
        if ch in OPENERS:
            stack.push(ch)
        elif ch in CLOSER_TO_OPENER:
            if stack.is_empty() or stack.pop() != CLOSER_TO_OPENER[ch]:
                return False
    return stack.is_empty()
