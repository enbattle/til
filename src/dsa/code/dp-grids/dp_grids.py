def unique_paths(grid: list[list[int]]) -> int:
    """Right/down paths from the top-left to the bottom-right avoiding 1-cells."""
    if not grid or not grid[0]:
        return 0
    rows, cols = len(grid), len(grid[0])
    paths = [[0] * cols for _ in range(rows)]
    for r in range(rows):
        for c in range(cols):
            if grid[r][c] == 1:
                continue
            if r == 0 and c == 0:
                paths[r][c] = 1
            else:
                from_above = paths[r - 1][c] if r > 0 else 0
                from_left = paths[r][c - 1] if c > 0 else 0
                paths[r][c] = from_above + from_left
    return paths[rows - 1][cols - 1]


def min_path_sum(grid: list[list[int]]) -> int:
    """Smallest total of the cells on a right/down path from corner to corner."""
    if not grid or not grid[0]:
        return 0
    rows, cols = len(grid), len(grid[0])
    cost = [[0] * cols for _ in range(rows)]
    for r in range(rows):
        for c in range(cols):
            if r == 0 and c == 0:
                best = 0
            elif r == 0:
                best = cost[r][c - 1]
            elif c == 0:
                best = cost[r - 1][c]
            else:
                best = min(cost[r - 1][c], cost[r][c - 1])
            cost[r][c] = grid[r][c] + best
    return cost[rows - 1][cols - 1]


def min_path_sum_rolling(grid: list[list[int]]) -> int:
    """Same answer as min_path_sum, keeping one row of length cols."""
    if not grid or not grid[0]:
        return 0
    rows, cols = len(grid), len(grid[0])
    row = [0] * cols
    for r in range(rows):
        for c in range(cols):
            if r == 0 and c == 0:
                best = 0
            elif r == 0:
                best = row[c - 1]
            elif c == 0:
                best = row[c]
            else:
                best = min(row[c], row[c - 1])
            row[c] = grid[r][c] + best
    return row[cols - 1]
