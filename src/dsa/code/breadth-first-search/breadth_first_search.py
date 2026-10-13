# region shortest-path
from collections import deque


def shortest_path(adj: list[list[int]], source: int, target: int) -> list[int] | None:
    """A path from source to target with the fewest edges, or None."""
    n = len(adj)
    # Check first: parent[-1] would quietly read the last vertex's slot.
    if not (0 <= source < n and 0 <= target < n):
        raise ValueError("source and target must be vertices 0 to n - 1")
    # parent[v] is the vertex v was first reached from, or -1 if not reached
    # yet, so it doubles as the visited list. The source is its own parent:
    # that marks it as reached, so it is never queued again, and
    # parent[target] == -1 is false when source == target.
    # A vertex is marked when it is queued, not when it is popped: marked
    # later, a vertex that two queued neighbors both reach is queued twice
    # and its neighbors scanned twice.
    parent = [-1] * n
    parent[source] = source
    queue = deque([source])
    # Stop once target is found: its parent is already a shortest route,
    # and waiting to pop it would scan every vertex queued ahead of it.
    while queue and parent[target] == -1:
        v = queue.popleft()  # a list's pop(0) shifts every item, O(n) a pop
        for w in adj[v]:
            if parent[w] == -1:
                parent[w] = v
                queue.append(w)
# endregion


    # region path-from-parents
    if parent[target] == -1:
        return None
    path = [target]
    node = target
    while node != source:
        node = parent[node]
        path.append(node)
    # Parents point back toward the source, so the walk comes out reversed.
    path.reverse()
    return path
    # endregion


# region minutes-to-rot
def minutes_to_rot(grid: list[list[int]]) -> int:
    """Minutes until every fresh cell (1) rots, or -1 if one never does.

    Cells are 0 empty, 1 fresh, 2 rotten; rot spreads up, down, left, right.
    """
    rows = len(grid)
    cols = 0
    if rows > 0:
        cols = len(grid[0])
    rotted = []
    for r in range(rows):
        rotted.append([False] * cols)
    # Every rotten cell starts in the queue, so one search spreads from all of
    # them at once; a search per source repeats work and needs a merge of answers.
    queue = deque()
    fresh = 0
    for r in range(rows):
        for c in range(cols):
            if grid[r][c] == 2:
                queue.append((r, c))
            elif grid[r][c] == 1:
                fresh += 1
    directions = [(1, 0), (-1, 0), (0, 1), (0, -1)]
    minutes = 0
    while queue and fresh > 0:
        # Fix the count now: cells rotted this minute join the queue, so
        # asking len(queue) again would run them in the same minute.
        count = len(queue)
        for _ in range(count):
            r, c = queue.popleft()
            for dr, dc in directions:
                nr = r + dr
                nc = c + dc
                # Bounds before indexing: grid[-1] is the last row in Python,
                # not off the edge. Marked when queued, as in shortest_path.
                if nr < 0 or nr >= rows or nc < 0 or nc >= cols:
                    continue
                if grid[nr][nc] == 1 and not rotted[nr][nc]:
                    rotted[nr][nc] = True
                    fresh -= 1
                    queue.append((nr, nc))
        minutes += 1
    if fresh > 0:
        return -1
    return minutes
# endregion
