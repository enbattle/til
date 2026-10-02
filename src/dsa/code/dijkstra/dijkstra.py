import heapq

Graph = dict[int, list[tuple[int, int]]]


def dijkstra(graph: Graph, source: int) -> tuple[dict[int, int], dict[int, int | None]]:
    """Cheapest cost from source to every vertex reachable from it, and each
    vertex's parent on a cheapest route. Edge weights must not be negative."""
    dist: dict[int, int] = {source: 0}
    parent: dict[int, int | None] = {source: None}
    heap = [(0, source)]
    while heap:
        d, v = heapq.heappop(heap)
        if d > dist[v]:
            continue
        for w, weight in graph.get(v, []):
            nd = d + weight
            if w not in dist or nd < dist[w]:
                dist[w] = nd
                parent[w] = v
                heapq.heappush(heap, (nd, w))
    return dist, parent


def shortest_path(graph: Graph, source: int, target: int) -> list[int] | None:
    """A cheapest route from source to target as a list of vertices, or None."""
    _, parent = dijkstra(graph, source)
    if target not in parent:
        return None
    path: list[int] = []
    node: int | None = target
    while node is not None:
        path.append(node)
        node = parent[node]
    path.reverse()
    return path
