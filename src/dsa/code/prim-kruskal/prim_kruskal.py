import heapq
from collections.abc import Iterable

Edge = tuple[int, int, int]  # (u, v, weight); undirected, vertices are 0..n-1


def kruskal(n: int, edges: Iterable[Edge]) -> list[Edge] | None:
    """A minimum spanning tree as a list of edges, or None if disconnected."""
    parent = list(range(n))
    size = [1] * n

    def find(x: int) -> int:
        while parent[x] != x:
            parent[x] = parent[parent[x]]  # halving: point at the grandparent
            x = parent[x]
        return x

    chosen: list[Edge] = []
    for u, v, w in sorted(edges, key=lambda e: e[2]):
        root_u, root_v = find(u), find(v)
        # Roots, not u and v: 0 and 1 can already be linked through 2.
        if root_u == root_v:
            continue
        if size[root_u] < size[root_v]:
            root_u, root_v = root_v, root_u  # smaller under larger: shallow trees
        parent[root_v] = root_u
        size[root_u] += size[root_v]
        chosen.append((u, v, w))
        # A tree has no room for more, and every edge left would close a cycle.
        if len(chosen) == n - 1:
            break
    return chosen if len(chosen) == max(n - 1, 0) else None


def prim(n: int, edges: Iterable[Edge]) -> list[Edge] | None:
    """A minimum spanning tree grown from vertex 0, or None if disconnected."""
    if n == 0:  # adjacent[0] below would not exist
        return []
    adjacent: list[list[tuple[int, int, int]]] = [[] for _ in range(n)]
    for u, v, w in edges:
        # Weight first, so the heap orders by it. Both ends: an edge stored
        # once is a one-way street, and Prim would miss vertices behind it.
        adjacent[u].append((w, u, v))
        adjacent[v].append((w, v, u))

    in_tree = [False] * n
    in_tree[0] = True
    heap = list(adjacent[0])
    heapq.heapify(heap)
    chosen: list[Edge] = []
    while heap and len(chosen) < n - 1:
        w, u, v = heapq.heappop(heap)
        # Stale: a cheaper edge already brought v in, and this one would
        # close a cycle. Edges are never removed from the heap, only skipped.
        if in_tree[v]:
            continue
        in_tree[v] = True
        chosen.append((u, v, w))
        for entry in adjacent[v]:
            if not in_tree[entry[2]]:  # an edge back into the tree is never used
                heapq.heappush(heap, entry)
    return chosen if len(chosen) == n - 1 else None
