import math

Edge = tuple[int, int, float]


def bellman_ford(n: int, edges: list[Edge], source: int) -> list[float] | None:
    """Shortest distances from source over directed (u, v, weight) edges.

    Vertices are 0 to n - 1. Unreachable vertices get math.inf. Returns None
    if a negative cycle is reachable from source, since distances are then
    undefined.
    """
    if not 0 <= source < n:
        raise ValueError("source must be a vertex from 0 to n - 1")
    dist = [math.inf] * n
    dist[source] = 0
    for _ in range(n - 1):
        changed = False
        for u, v, w in edges:
            if dist[u] + w < dist[v]:
                dist[v] = dist[u] + w
                changed = True
        if not changed:
            return dist
    for u, v, w in edges:
        if dist[u] + w < dist[v]:
            return None
    return dist
