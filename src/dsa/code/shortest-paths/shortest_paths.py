import heapq
import math

Graph = list[list[tuple[int, int]]]  # graph[u] holds a (v, weight) pair per edge


def dijkstra(graph: Graph, source: int) -> list[float]:
    """Cheapest cost from source to every vertex, inf if unreachable.
    Weights must not be negative."""
    dist = [math.inf] * len(graph)
    dist[source] = 0
    heap = [(0, source)]
    while heap:
        d, u = heapq.heappop(heap)
        # A heap can't lower an entry in place, so an improved vertex is pushed
        # again and its older, higher entry is skipped when it surfaces.
        if d > dist[u]:
            continue
        for v, w in graph[u]:
            # Strict: with <=, a zero-weight cycle would push forever.
            if d + w < dist[v]:
                dist[v] = d + w
                heapq.heappush(heap, (d + w, v))
    return dist


def bellman_ford(graph: Graph, source: int) -> list[float] | None:
    """Cheapest cost from source to every vertex, inf if unreachable, or None
    if a negative cycle is reachable from source. Weights may be negative."""
    n = len(graph)
    dist = [math.inf] * n
    dist[source] = 0
    # Round k fixes every cheapest route of k edges, and a route has at most
    # n - 1 edges, so a change in round n can only come from a negative cycle.
    for _ in range(n):
        changed = False
        for u in range(n):
            for v, w in graph[u]:
                # inf + w is inf, so a vertex not reached yet relaxes nothing.
                if dist[u] + w < dist[v]:
                    dist[v] = dist[u] + w
                    changed = True
        # A round with no change leaves the next one unchanged too.
        if not changed:
            return dist
    return None
