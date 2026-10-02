from collections.abc import Hashable
from typing import Generic, TypeVar

V = TypeVar("V", bound=Hashable)


class Graph(Generic[V]):
    """A graph stored as adjacency lists: each vertex maps to a list of neighbours."""

    def __init__(self, directed: bool = False):
        self.directed = directed
        self._adj: dict[V, list[V]] = {}
        self._edge_count = 0

    def add_vertex(self, v: V) -> None:
        self._adj.setdefault(v, [])

    def vertices(self) -> list[V]:
        return list(self._adj)

    @property
    def edge_count(self) -> int:
        return self._edge_count

    def neighbours(self, v: V) -> list[V]:
        return list(self._adj[v])

    def degree(self, v: V) -> int:
        return len(self._adj[v])

    def has_edge(self, u: V, v: V) -> bool:
        return v in self._adj.get(u, ())

    def add_edge(self, u: V, v: V) -> bool:
        self.add_vertex(u)
        self.add_vertex(v)
        if v in self._adj[u]:
            return False
        self._adj[u].append(v)
        if not self.directed and u != v:
            self._adj[v].append(u)
        self._edge_count += 1
        return True

    def remove_edge(self, u: V, v: V) -> bool:
        if not self.has_edge(u, v):
            return False
        self._adj[u].remove(v)
        if not self.directed and u != v:
            self._adj[v].remove(u)
        self._edge_count -= 1
        return True


class AdjacencyMatrix:
    """A graph on vertices 0 to n - 1 stored as an n-by-n grid of 0s and 1s."""

    def __init__(self, n: int, directed: bool = False):
        if n < 0:
            raise ValueError("n must be at least 0")
        self.directed = directed
        self._rows = [bytearray(n) for _ in range(n)]
        self._edge_count = 0

    def _check(self, v: int) -> None:
        if not 0 <= v < len(self._rows):
            raise IndexError(f"vertex {v} is out of range")

    def vertices(self) -> list[int]:
        return list(range(len(self._rows)))

    @property
    def edge_count(self) -> int:
        return self._edge_count

    def has_edge(self, u: int, v: int) -> bool:
        self._check(u)
        self._check(v)
        return self._rows[u][v] == 1

    def add_edge(self, u: int, v: int) -> bool:
        if self.has_edge(u, v):
            return False
        self._rows[u][v] = 1
        if not self.directed:
            self._rows[v][u] = 1
        self._edge_count += 1
        return True

    def remove_edge(self, u: int, v: int) -> bool:
        if not self.has_edge(u, v):
            return False
        self._rows[u][v] = 0
        if not self.directed:
            self._rows[v][u] = 0
        self._edge_count -= 1
        return True

    def neighbours(self, v: int) -> list[int]:
        self._check(v)
        return [w for w, cell in enumerate(self._rows[v]) if cell]

    def degree(self, v: int) -> int:
        self._check(v)
        return sum(self._rows[v])
