from collections.abc import Iterator

Edge = tuple[int, int]


def check(n: int, edges: list[Edge]) -> None:
    # Python reads adj[-1] as the last vertex, so a bad id would not fail.
    for u, v in edges:
        if not (0 <= u < n and 0 <= v < n):
            raise ValueError(f"edge ({u}, {v}) names a vertex outside 0..{n - 1}")


def build_list(n: int, edges: list[Edge], directed: bool = False) -> list[list[int]]:
    """Adjacency list: adj[u] holds the neighbors of u."""
    check(n, edges)
    # A comprehension makes n separate lists; [[]] * n would share one.
    adj: list[list[int]] = [[] for _ in range(n)]
    for u, v in edges:
        adj[u].append(v)
        # An undirected edge is stored from both ends, or only one end sees it.
        # A self-loop (u == v) is one entry, the same as one matrix cell.
        if not directed and u != v:
            adj[v].append(u)
    return adj


def build_matrix(n: int, edges: list[Edge], directed: bool = False) -> list[list[int]]:
    """Adjacency matrix: m[u][v] is 1 when there is an edge from u to v."""
    check(n, edges)
    # Every cell exists up front, which is the V * V space cost.
    m = [[0] * n for _ in range(n)]
    for u, v in edges:
        m[u][v] = 1
        if not directed:
            m[v][u] = 1
    return m


def has_edge_list(adj: list[list[int]], u: int, v: int) -> bool:
    return v in adj[u]  # a scan of u's list, so O(deg(u))


def has_edge_matrix(m: list[list[int]], u: int, v: int) -> bool:
    return m[u][v] == 1  # one cell read, however many edges there are


def neighbors_matrix(m: list[list[int]], u: int) -> list[int]:
    # No list to return: the whole row must be read to find the 1s.
    return [v for v, cell in enumerate(m[u]) if cell]


def edges_of_list(adj: list[list[int]]) -> Iterator[Edge]:
    for u, row in enumerate(adj):
        for v in row:
            yield u, v


def edges_of_matrix(m: list[list[int]]) -> Iterator[Edge]:
    for u, row in enumerate(m):
        for v, cell in enumerate(row):
            if cell:  # every cell is read, including the zeros
                yield u, v
