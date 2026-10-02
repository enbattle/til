from collections.abc import Iterable


class UnionFind:
    """Disjoint sets over the elements 0..n-1: union by size, path compression."""

    def __init__(self, n: int):
        if n < 0:
            raise ValueError("n must not be negative")
        self._parent = list(range(n))
        self._size = [1] * n
        self._count = n

    @property
    def count(self) -> int:
        """The number of separate sets."""
        return self._count

    def find(self, x: int) -> int:
        if not 0 <= x < len(self._parent):
            raise IndexError(f"element {x} is out of range")
        root = x
        while self._parent[root] != root:
            root = self._parent[root]
        while x != root:
            next_x = self._parent[x]
            self._parent[x] = root
            x = next_x
        return root

    def union(self, a: int, b: int) -> bool:
        root_a, root_b = self.find(a), self.find(b)
        if root_a == root_b:
            return False
        if self._size[root_a] < self._size[root_b]:
            root_a, root_b = root_b, root_a
        self._parent[root_b] = root_a
        self._size[root_a] += self._size[root_b]
        self._count -= 1
        return True

    def connected(self, a: int, b: int) -> bool:
        return self.find(a) == self.find(b)

    def size_of(self, x: int) -> int:
        return self._size[self.find(x)]


def count_components(n: int, edges: Iterable[tuple[int, int]]) -> int:
    sets = UnionFind(n)
    for a, b in edges:
        sets.union(a, b)
    return sets.count


def has_cycle(n: int, edges: Iterable[tuple[int, int]]) -> bool:
    sets = UnionFind(n)
    for a, b in edges:
        if not sets.union(a, b):
            return True
    return False
