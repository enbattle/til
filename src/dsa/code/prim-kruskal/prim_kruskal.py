import heapq
from collections.abc import Iterable

Edge = tuple[int, int, int]  # (u, v, weight); undirected, vertices are 0..n-1


def kruskal(n: int, edges: Iterable[Edge]) -> list[Edge] | None:
    """A minimum spanning tree as a list of edges, or None if disconnected."""
    parent = list(range(n))
    size = [1] * n

    def find(x: int) -> int:
        while parent[x] != x:
            parent[x] = parent[parent[x]]  # path halving
            x = parent[x]
        return x

    chosen: list[Edge] = []
    for u, v, w in sorted(edges, key=lambda e: e[2]):
        root_u, root_v = find(u), find(v)
        if root_u == root_v:
            continue
        if size[root_u] < size[root_v]:
            root_u, root_v = root_v, root_u
        parent[root_v] = root_u
        size[root_u] += size[root_v]
        chosen.append((u, v, w))
        if len(chosen) == n - 1:
            break
    return chosen if len(chosen) == max(n - 1, 0) else None


def prim(n: int, edges: Iterable[Edge], start: int = 0) -> list[Edge] | None:
    """A minimum spanning tree grown from `start`, or None if disconnected."""
    if n == 0:
        return []
    adjacent: list[list[tuple[int, int, int]]] = [[] for _ in range(n)]
    for u, v, w in edges:
        adjacent[u].append((w, u, v))
        adjacent[v].append((w, v, u))

    in_tree = [False] * n
    in_tree[start] = True
    heap = list(adjacent[start])
    heapq.heapify(heap)
    chosen: list[Edge] = []
    while heap and len(chosen) < n - 1:
        w, u, v = heapq.heappop(heap)
        if in_tree[v]:
            continue  # a cheaper edge already brought v in
        in_tree[v] = True
        chosen.append((u, v, w))
        for entry in adjacent[v]:
            if not in_tree[entry[2]]:
                heapq.heappush(heap, entry)
    return chosen if len(chosen) == n - 1 else None


def total_weight(tree: Iterable[Edge]) -> int:
    return sum(w for _, _, w in tree)
