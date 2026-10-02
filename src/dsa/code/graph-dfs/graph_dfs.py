def count_components(graph: dict[int, list[int]]) -> int:
    """Connected components of an undirected graph given as vertex -> neighbours.

    Every vertex, including isolated ones, must be a key of `graph`.
    """
    seen: set[int] = set()
    count = 0
    for start in graph:
        if start in seen:
            continue
        count += 1
        seen.add(start)
        stack = [start]
        while stack:
            vertex = stack.pop()
            for neighbour in graph[vertex]:
                if neighbour not in seen:
                    seen.add(neighbour)
                    stack.append(neighbour)
    return count


def count_islands(grid: list[list[int]]) -> int:
    """Groups of 1-cells (land) joined up, down, left or right, in a 0/1 grid."""
    rows = len(grid)
    cols = len(grid[0]) if grid else 0
    seen: set[tuple[int, int]] = set()
    count = 0
    for row in range(rows):
        for col in range(cols):
            if grid[row][col] != 1 or (row, col) in seen:
                continue
            count += 1
            seen.add((row, col))
            stack = [(row, col)]
            while stack:
                r, c = stack.pop()
                for nr, nc in ((r - 1, c), (r + 1, c), (r, c - 1), (r, c + 1)):
                    inside = 0 <= nr < rows and 0 <= nc < cols
                    if inside and grid[nr][nc] == 1 and (nr, nc) not in seen:
                        seen.add((nr, nc))
                        stack.append((nr, nc))
    return count


UNVISITED, ON_PATH, FINISHED = 0, 1, 2


def has_cycle(graph: dict[int, list[int]]) -> bool:
    """Whether a directed graph (vertex -> out-neighbours) contains a cycle."""
    state = {vertex: UNVISITED for vertex in graph}
    for start in graph:
        if state[start] != UNVISITED:
            continue
        state[start] = ON_PATH
        stack = [(start, iter(graph[start]))]
        while stack:
            vertex, neighbours = stack[-1]
            for neighbour in neighbours:
                if state[neighbour] == ON_PATH:
                    return True
                if state[neighbour] == UNVISITED:
                    state[neighbour] = ON_PATH
                    stack.append((neighbour, iter(graph[neighbour])))
                    break
            else:
                state[vertex] = FINISHED
                stack.pop()
    return False
