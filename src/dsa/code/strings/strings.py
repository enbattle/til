from typing import Self


class StringBuilder:
    """Collects pieces in a list and joins them once, in time linear in the total."""

    def __init__(self) -> None:
        self._parts: list[str] = []
        self._length = 0

    def append(self, piece: str) -> Self:
        self._parts.append(piece)
        self._length += len(piece)
        return self

    def __len__(self) -> int:
        return self._length

    def build(self) -> str:
        text = "".join(self._parts)
        self._parts = [text]
        return text


def reverse_code_points(s: str) -> str:
    return s[::-1]


def is_palindrome(s: str) -> bool:
    """Whether s reads the same both ways, counting only letters and digits
    and ignoring case."""
    i, j = 0, len(s) - 1
    while i < j:
        if not s[i].isalnum():
            i += 1
        elif not s[j].isalnum():
            j -= 1
        elif s[i].lower() != s[j].lower():
            return False
        else:
            i += 1
            j -= 1
    return True
