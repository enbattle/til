# region dynamic-array
class DynamicArray:
    """A growable array on fixed-size storage that doubles when it fills."""

    def __init__(self) -> None:
        self.data: list[str] = [""]
        self.count = 0

    def size(self) -> int:
        return self.count

    def capacity(self) -> int:
        return len(self.data)

    def get(self, i: int) -> str:
        # Check against the size, not the capacity: spare slots aren't items.
        if i < 0 or i >= self.count:
            raise IndexError(i)
        return self.data[i]
# endregion

    # region insert
    def insert(self, i: int, item: str) -> None:
        # i == size is allowed: that is an append.
        if i < 0 or i > self.count:
            raise IndexError(i)
        if self.count == len(self.data):
            # Double rather than add a fixed number of slots: a fixed step
            # copies everything every few appends, so n appends cost O(n^2).
            bigger = [""] * (2 * len(self.data))
            for j in range(self.count):
                bigger[j] = self.data[j]
            self.data = bigger
        # Shift from the right end: from the left, each item would overwrite
        # its neighbor before that neighbor had moved.
        for j in range(self.count, i, -1):
            self.data[j] = self.data[j - 1]
        self.data[i] = item
        self.count += 1

    def append(self, item: str) -> None:
        self.insert(self.count, item)
    # endregion


# region string-builder
class StringBuilder:
    """Collects pieces and joins them once, in time linear in the total."""

    def __init__(self) -> None:
        self.parts: list[str] = []

    def append(self, piece: str) -> None:
        # Storing the piece copies no text; += on a string would copy it all.
        self.parts.append(piece)

    def build(self) -> str:
        text = "".join(self.parts)
        # Keep the result as one piece, so a second build won't join it all again.
        self.parts = [text]
        return text
# endregion


# region reverse-string
def reverse_string(s: str) -> str:
    # A string can't be edited, so swap inside a list and join once at the end.
    chars = list(s)
    left = 0
    right = len(chars) - 1
    while left < right:
        chars[left], chars[right] = chars[right], chars[left]
        left += 1
        right -= 1
    return "".join(chars)
# endregion
