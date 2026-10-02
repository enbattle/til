from math import inf


def max_profit_with_fee(prices: list[int], fee: int) -> int:
    """Most profit from any number of buy/sell trades, paying fee on each sale."""
    holding, free = -inf, 0
    for price in prices:
        holding, free = max(holding, free - price), max(free, holding + price - fee)
    return free


def max_profit_with_cooldown(prices: list[int]) -> int:
    """Most profit from any number of trades, no buying the day after a sale."""
    holding, sold, resting = -inf, -inf, 0
    for price in prices:
        holding, sold, resting = (
            max(holding, resting - price),
            holding + price,
            max(resting, sold),
        )
    return max(sold, resting)


def max_profit_k_transactions(prices: list[int], k: int) -> int:
    """Most profit from at most k buy/sell trades, holding one share at a time."""
    k = max(0, min(k, len(prices) // 2))
    holding = [-inf] * k
    done = [0] * (k + 1)
    for price in prices:
        old_holding, old_done = holding[:], done[:]
        for j in range(k):
            holding[j] = max(old_holding[j], old_done[j] - price)
            done[j + 1] = max(old_done[j + 1], old_holding[j] + price)
    return done[k]
