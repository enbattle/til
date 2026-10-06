from collections.abc import Iterable


class UnionFind:
    """Disjoint sets over the elements 0..n-1: union by size, path compression."""

    def __init__(self, n: int) -> None:
        self._parent = list(range(n))  # a root is its own parent
        self._size = [1] * n  # read only at roots; other entries go stale
        # Kept up to date, so asking never means calling find on every element.
        self.count = n

    def find(self, x: int) -> int:
        # Python reads index -1 as the last element, so without this check
        # find(-1) would quietly return the root of element n - 1.
        if not 0 <= x < len(self._parent):
            raise IndexError(f"element {x} is out of range")
        root = x
        while self._parent[root] != root:
            root = self._parent[root]
        # A second walk, because the root isn't known until the first ends.
        while x != root:
            next_x = self._parent[x]  # saved first: after the write, x's old
            self._parent[x] = root  # parent is gone and the walk would stop
            x = next_x
        return root

    def union(self, a: int, b: int) -> bool:
        root_a, root_b = self.find(a), self.find(b)
        if root_a == root_b:
            return False  # merging a set with itself would double its size
        if self._size[root_a] < self._size[root_b]:
            root_a, root_b = root_b, root_a  # smaller under larger: depth <= log2 n
        self._parent[root_b] = root_a  # the root, not b: only a root speaks for its set
        self._size[root_a] += self._size[root_b]
        self.count -= 1
        return True

    def connected(self, a: int, b: int) -> bool:
        return self.find(a) == self.find(b)

    def size_of(self, x: int) -> int:
        return self._size[self.find(x)]


def has_cycle(n: int, edges: Iterable[tuple[int, int]]) -> bool:
    sets = UnionFind(n)
    # An edge whose ends are already connected is a second way across.
    return any(not sets.union(a, b) for a, b in edges)
