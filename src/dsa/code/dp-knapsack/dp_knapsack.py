def knapsack_table(weights: list[int], values: list[int], capacity: int) -> int:
    """Best total value of items (each used at most once) weighing at most capacity.

    Weights are positive and capacity is at least 0.
    """
    n = len(weights)
    table = [[0] * (capacity + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        weight, value = weights[i - 1], values[i - 1]
        for c in range(capacity + 1):
            table[i][c] = table[i - 1][c]
            if weight <= c:
                table[i][c] = max(table[i][c], table[i - 1][c - weight] + value)
    return table[n][capacity]


def knapsack_01(weights: list[int], values: list[int], capacity: int) -> int:
    """The same answer as knapsack_table, keeping one row of capacities."""
    best = [0] * (capacity + 1)
    for weight, value in zip(weights, values):
        for c in range(capacity, weight - 1, -1):
            best[c] = max(best[c], best[c - weight] + value)
    return best[capacity]


def unbounded_knapsack(weights: list[int], values: list[int], capacity: int) -> int:
    """Best total value when every item may be used any number of times."""
    best = [0] * (capacity + 1)
    for weight, value in zip(weights, values):
        for c in range(weight, capacity + 1):
            best[c] = max(best[c], best[c - weight] + value)
    return best[capacity]


def min_coins(coins: list[int], amount: int) -> int:
    """Fewest coins (each reusable) that sum to amount, or -1 if impossible."""
    unreachable = amount + 1
    fewest = [0] + [unreachable] * amount
    for a in range(1, amount + 1):
        for coin in coins:
            if coin <= a:
                fewest[a] = min(fewest[a], fewest[a - coin] + 1)
    return fewest[amount] if fewest[amount] < unreachable else -1


def count_combinations(coins: list[int], amount: int) -> int:
    """Ways to make amount where the order of the coins does not matter."""
    ways = [1] + [0] * amount
    for coin in coins:
        for a in range(coin, amount + 1):
            ways[a] += ways[a - coin]
    return ways[amount]


def count_orderings(coins: list[int], amount: int) -> int:
    """Ways to make amount where 1 + 2 and 2 + 1 count as different."""
    ways = [1] + [0] * amount
    for a in range(1, amount + 1):
        for coin in coins:
            if coin <= a:
                ways[a] += ways[a - coin]
    return ways[amount]
