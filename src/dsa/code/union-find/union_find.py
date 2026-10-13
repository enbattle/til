# region setup
class UnionFind:
    """Disjoint sets over the elements 0..n-1: union by size, path compression."""

    def __init__(self, n: int) -> None:
        self.parent: list[int] = []
        self.sizes: list[int] = []
        for i in range(n):
            self.parent.append(i)  # a root is its own parent
            self.sizes.append(1)  # read only at roots; other entries go stale
        # Kept up to date, so asking never means calling find on every element.
        self.count = n
    # endregion

    # region find
    def find(self, x: int) -> int:
        root = x
        while self.parent[root] != root:
            root = self.parent[root]
        # A second walk, because the root isn't known until the first ends.
        while x != root:
            next_x = self.parent[x]  # saved first: after the write, x's old
            self.parent[x] = root  # parent is gone and the walk would stop
            x = next_x
        return root
    # endregion

    # region union
    def union(self, a: int, b: int) -> bool:
        root_a = self.find(a)
        root_b = self.find(b)
        if root_a == root_b:
            return False  # merging a set with itself would double its size
        if self.sizes[root_a] < self.sizes[root_b]:
            root_a, root_b = root_b, root_a  # smaller under larger: depth <= log2 n
        self.parent[root_b] = root_a  # the root, not b: only a root speaks for its set
        self.sizes[root_a] += self.sizes[root_b]
        self.count -= 1
        return True
    # endregion

    # region connected
    def connected(self, a: int, b: int) -> bool:
        return self.find(a) == self.find(b)

    def size_of(self, x: int) -> int:
        return self.sizes[self.find(x)]
# endregion


# region has-cycle
def has_cycle(n: int, edges: list[tuple[int, int]]) -> bool:
    sets = UnionFind(n)
    for a, b in edges:
        # An edge whose ends are already connected is a second way across.
        if not sets.union(a, b):
            return True
    return False
# endregion
