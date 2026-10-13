# region edge-type
import heapq

Edge = tuple[int, int, int]  # (u, v, weight); undirected, vertices are 0..n-1
# endregion


# region find
def find(parent: list[int], x: int) -> int:
    while parent[x] != x:
        parent[x] = parent[parent[x]]  # halving: point at the grandparent
        x = parent[x]
    return x
# endregion


# region kruskal
def kruskal(n: int, edges: list[Edge]) -> list[Edge] | None:
    """A minimum spanning tree as a list of edges, or None if disconnected."""
    parent = list(range(n))
    size = [1] * n
    chosen: list[Edge] = []
    for u, v, w in sorted(edges, key=lambda e: e[2]):
        root_u = find(parent, u)
        root_v = find(parent, v)
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
    if len(chosen) < n - 1:
        return None
    return chosen
# endregion


# region adjacency-list
def prim(n: int, edges: list[Edge]) -> list[Edge] | None:
    """A minimum spanning tree grown from vertex 0, or None if disconnected."""
    if n == 0:  # adjacent[0] below would not exist
        return []
    adjacent: list[list[tuple[int, int, int]]] = []
    for _ in range(n):
        adjacent.append([])
    for u, v, w in edges:
        # Weight first, so the heap orders by it. Both ends: an edge stored
        # once is a one-way street, and Prim would miss vertices behind it.
        adjacent[u].append((w, u, v))
        adjacent[v].append((w, v, u))
# endregion

    # region prim-loop
    in_tree = [False] * n
    in_tree[0] = True
    heap: list[tuple[int, int, int]] = []
    for edge in adjacent[0]:
        heapq.heappush(heap, edge)
    chosen: list[Edge] = []
    while heap and len(chosen) < n - 1:
        w, u, v = heapq.heappop(heap)
        # Stale: a cheaper edge already brought v in, and this one would
        # close a cycle. Edges are never removed from the heap, only skipped.
        if in_tree[v]:
            continue
        in_tree[v] = True
        chosen.append((u, v, w))
        for edge in adjacent[v]:
            next_to = edge[2]
            if not in_tree[next_to]:  # an edge back into the tree is never used
                heapq.heappush(heap, edge)
    if len(chosen) < n - 1:
        return None
    return chosen
    # endregion
