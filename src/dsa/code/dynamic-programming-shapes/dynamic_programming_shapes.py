# region min-path-sum
from math import inf


def min_path_sum(grid: list[list[int]]) -> int:
    """Smallest total of a right/down path from the top-left to the bottom-right."""
    if len(grid) == 0 or len(grid[0]) == 0:
        return 0
    rows = len(grid)
    cols = len(grid[0])
    # One row is enough: a cell reads only the one above it and the one to
    # its left. row[0] = 0 and inf elsewhere let the first row and column
    # fall out of the same formula, with no special cases for the edges.
    row = [inf] * cols
    row[0] = 0
    for r in range(rows):
        for c in range(cols):
            # Before row[c] is overwritten it still holds the cell above;
            # row[c - 1] has just been overwritten, so it is the cell to the left.
            if c == 0:
                best = row[c]
            else:
                best = min(row[c], row[c - 1])
            row[c] = grid[r][c] + best
    return int(row[cols - 1])
# endregion


# region knapsack-01
def knapsack_01(weights: list[int], values: list[int], capacity: int) -> int:
    """Best total value of items, each used at most once, weighing <= capacity."""
    best = [0] * (capacity + 1)
    for i in range(len(weights)):
        weight = weights[i]
        value = values[i]
        # Downward: best[c - weight] must still be the row from before this
        # item. Upward would find it already updated and use the item twice.
        for c in range(capacity, weight - 1, -1):
            best[c] = max(best[c], best[c - weight] + value)
    return best[capacity]
# endregion


# region min-coins
def min_coins(coins: list[int], amount: int) -> int:
    """Fewest coins, each usable any number of times, that sum to amount; -1 if none."""
    # amount + 1 is above every real answer (at most amount coins), and adding
    # 1 to it keeps it above, so "impossible" never looks like a real count.
    unreachable = amount + 1
    fewest = [unreachable] * (amount + 1)
    fewest[0] = 0
    for coin in coins:
        # Upward, the opposite of knapsack_01: fewest[a - coin] may already
        # include this coin, which is exactly what lets a coin repeat.
        for a in range(coin, amount + 1):
            fewest[a] = min(fewest[a], fewest[a - coin] + 1)
    if fewest[amount] == unreachable:
        return -1
    return fewest[amount]
# endregion


# region edit-distance
def edit_distance(a: str, b: str) -> int:
    """Fewest single-character inserts, deletes and replaces that turn a into b."""
    # table[i][j] is the distance between a[:i] and b[:j]. The first row and
    # column are the base cases: turning "" into j characters takes j inserts.
    table = [[0] * (len(b) + 1) for _ in range(len(a) + 1)]
    for i in range(len(a) + 1):
        table[i][0] = i
    for j in range(len(b) + 1):
        table[0][j] = j
    for i in range(1, len(a) + 1):
        for j in range(1, len(b) + 1):
            if a[i - 1] == b[j - 1]:
                # Matching characters cost nothing; taking the diagonal is
                # never worse than any insert or delete here.
                table[i][j] = table[i - 1][j - 1]
            else:
                remove = table[i - 1][j]  # delete a[i - 1]
                insert = table[i][j - 1]  # insert b[j - 1]
                replace = table[i - 1][j - 1]  # replace a[i - 1] with b[j - 1]
                table[i][j] = 1 + min(remove, insert, replace)
    return table[len(a)][len(b)]
# endregion
