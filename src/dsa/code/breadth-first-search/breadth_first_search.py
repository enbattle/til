from collections import deque


def shortest_path(adj: list[list[int]], source: int, target: int) -> list[int] | None:
    """A path from source to target with the fewest edges, or None."""
    # parent doubles as the visited set, and a vertex goes in when it is
    # queued, not when it is popped: marked later, a vertex that two queued
    # neighbors both reach is queued twice and its neighbors scanned twice.
    parent: dict[int, int | None] = {source: None}
    queue = deque([source])
    # Stop once target is found: its parent is already a shortest route,
    # and waiting to pop it would scan every vertex queued ahead of it.
    while queue and target not in parent:
        v = queue.popleft()  # a list's pop(0) shifts every item, O(n) a pop
        for w in adj[v]:
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
    # Parents point back toward the source, so the walk comes out reversed.
    return path[::-1]



def minutes_to_rot(grid: list[list[int]]) -> int:
    """Minutes until every fresh cell (1) rots, or -1 if one never does.

    Cells are 0 empty, 1 fresh, 2 rotten; rot spreads up, down, left, right.
    """
    rows, cols = len(grid), len(grid[0]) if grid else 0
    seen: set[tuple[int, int]] = set()
    fresh = 0
    for r in range(rows):
        for c in range(cols):
            cell = grid[r][c]
            if cell == 2:
                seen.add((r, c))
            elif cell == 1:
                fresh += 1
    # Every rotten cell starts in the queue, so one search spreads from all of
    # them at once; a search per source repeats work and needs a merge of answers.
    queue = deque(seen)
    minutes = 0
    while queue and fresh:
        # Fix the count now: cells rotted this minute join the queue, so
        # asking len(queue) again would run them in the same minute.
        for _ in range(len(queue)):
            r, c = queue.popleft()
            for nr, nc in ((r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1)):
                # Bounds before indexing: grid[-1] is the last row in Python,
                # not off the edge. Marked when queued, as in shortest_path.
                if 0 <= nr < rows and 0 <= nc < cols and (nr, nc) not in seen:
                    if grid[nr][nc] == 1:
                        seen.add((nr, nc))
                        fresh -= 1
                        queue.append((nr, nc))
        minutes += 1
    return -1 if fresh else minutes
