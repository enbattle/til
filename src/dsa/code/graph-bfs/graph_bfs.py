from collections import deque

Graph = dict[int, list[int]]


def bfs_distances(graph: Graph, source: int) -> dict[int, int]:
    """Fewest edges from source to every vertex reachable from it."""
    dist = {source: 0}
    queue = deque([source])
    while queue:
        v = queue.popleft()
        for w in graph.get(v, []):
            if w not in dist:
                dist[w] = dist[v] + 1
                queue.append(w)
    return dist


def shortest_path(graph: Graph, source: int, target: int) -> list[int] | None:
    """A path with the fewest edges from source to target, or None."""
    parent: dict[int, int | None] = {source: None}
    queue = deque([source])
    while queue and target not in parent:
        v = queue.popleft()
        for w in graph.get(v, []):
            if w not in parent:
                parent[w] = v
                queue.append(w)
    if target not in parent:
        return None
    path: list[int] = []
    node: int | None = target
    while node is not None:
        path.append(node)
        node = parent[node]
    path.reverse()
    return path


def nearest_target(grid: list[str]) -> list[list[int | None]]:
    """Steps from each cell to its nearest 'T'; walls ('#') and cells that
    cannot reach a target get None. Moves are up, down, left and right."""
    rows = len(grid)
    cols = len(grid[0]) if rows else 0
    dist: list[list[int | None]] = [[None] * cols for _ in range(rows)]
    queue: deque[tuple[int, int, int]] = deque()
    for r in range(rows):
        for c in range(cols):
            if grid[r][c] == "T":
                dist[r][c] = 0
                queue.append((r, c, 0))
    while queue:
        r, c, d = queue.popleft()
        for nr, nc in ((r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1)):
            if 0 <= nr < rows and 0 <= nc < cols:
                if grid[nr][nc] != "#" and dist[nr][nc] is None:
                    dist[nr][nc] = d + 1
                    queue.append((nr, nc, d + 1))
    return dist
