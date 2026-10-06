from collections.abc import Sequence
from math import inf


def min_path_sum(grid: list[list[int]]) -> int:
    """Smallest total of a right/down path from the top-left to the bottom-right."""
    if not grid or not grid[0]:
        return 0
    # One row is enough: a cell reads only the one above it and the one to
    # its left. row[0] = 0 and inf elsewhere let the first row and column
    # fall out of the same formula, with no special cases for the edges.
    row: list[float] = [0] + [inf] * (len(grid[0]) - 1)
    for r in range(len(grid)):
        for c in range(len(grid[0])):
            # Before row[c] is overwritten it still holds the cell above;
            # row[c - 1] has just been overwritten, so it is the cell to the left.
            best = row[c] if c == 0 else min(row[c], row[c - 1])
            row[c] = grid[r][c] + best
    return int(row[-1])


def knapsack_01(weights: list[int], values: list[int], capacity: int) -> int:
    """Best total value of items, each used at most once, weighing <= capacity."""
    best = [0] * (capacity + 1)
    for weight, value in zip(weights, values):
        # Downward: best[c - weight] must still be the row from before this
        # item. Upward would find it already updated and use the item twice.
        for c in range(capacity, weight - 1, -1):
            best[c] = max(best[c], best[c - weight] + value)
    return best[capacity]


def min_coins(coins: list[int], amount: int) -> int:
    """Fewest coins, each usable any number of times, that sum to amount; -1 if none."""
    # amount + 1 is above every real answer (at most amount coins), and adding
    # 1 to it keeps it above, so "impossible" never looks like a real count.
    unreachable = amount + 1
    fewest = [0] + [unreachable] * amount
    for coin in coins:
        # Upward, the opposite of knapsack_01: fewest[a - coin] may already
        # include this coin, which is exactly what lets a coin repeat.
        for a in range(coin, amount + 1):
            fewest[a] = min(fewest[a], fewest[a - coin] + 1)
    return fewest[amount] if fewest[amount] < unreachable else -1


def edit_distance(a: Sequence[str], b: Sequence[str]) -> int:
    """Fewest single-character inserts, deletes and replaces that turn a into b."""
    # table[i][j] is the distance between a[:i] and b[:j]. The first row and
    # column are the base cases: turning "" into j characters takes j inserts.
    table = [[i] + [0] * len(b) for i in range(len(a) + 1)]
    table[0] = list(range(len(b) + 1))
    for i in range(1, len(a) + 1):
        for j in range(1, len(b) + 1):
            if a[i - 1] == b[j - 1]:
                # Matching characters cost nothing; taking the diagonal is
                # never worse than any insert or delete here.
                table[i][j] = table[i - 1][j - 1]
            else:
                table[i][j] = 1 + min(
                    table[i - 1][j],  # delete a[i - 1]
                    table[i][j - 1],  # insert b[j - 1]
                    table[i - 1][j - 1],  # replace a[i - 1] with b[j - 1]
                )
    return table[-1][-1]
