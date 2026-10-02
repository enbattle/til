"""Tests for the dp-state-machines entry's Python code.

API:
- ``max_profit_with_fee(prices, fee) -> int``: unlimited trades, ``fee`` paid on
  each sale.
- ``max_profit_with_cooldown(prices) -> int``: unlimited trades, no buying the
  day after a sale.
- ``max_profit_k_transactions(prices, k) -> int``: at most ``k`` trades.

One action per day (buy, sell or nothing), one share held at a time.
"""

import random
from itertools import product

from dp_state_machines import (
    max_profit_k_transactions,
    max_profit_with_cooldown,
    max_profit_with_fee,
)

NOTHING, BUY, SELL = 0, 1, 2


def brute_force(prices, fee=0, cooldown=False, max_trades=None):
    """Try every buy/sell/nothing sequence; keep the best legal one."""
    best = 0
    for actions in product((NOTHING, BUY, SELL), repeat=len(prices)):
        holding = False
        last_sale = -10
        trades = 0
        cash = 0
        legal = True
        for day, action in enumerate(actions):
            if action == BUY:
                if holding or (cooldown and day == last_sale + 1):
                    legal = False
                    break
                holding = True
                trades += 1
                cash -= prices[day]
            elif action == SELL:
                if not holding:
                    legal = False
                    break
                holding = False
                last_sale = day
                cash += prices[day] - fee
        if max_trades is not None and trades > max_trades:
            legal = False
        if legal and not holding:
            best = max(best, cash)
    return best


def random_prices(rng, max_len=8, high=12):
    return [rng.randint(0, high) for _ in range(rng.randint(0, max_len))]


# Fee version


def test_fee_worked_example():
    assert max_profit_with_fee([1, 3, 2, 8, 4, 9], 2) == 8


def test_fee_empty_and_one_day():
    assert max_profit_with_fee([], 2) == 0
    assert max_profit_with_fee([5], 2) == 0


def test_fee_falling_prices_never_trade():
    assert max_profit_with_fee([9, 7, 5, 3], 0) == 0


def test_fee_too_big_to_trade():
    assert max_profit_with_fee([1, 4], 3) == 0
    assert max_profit_with_fee([1, 5], 3) == 1


def test_fee_zero_collects_every_rise():
    assert max_profit_with_fee([1, 3, 2, 5], 0) == 5


def test_fee_does_not_sell_a_share_never_bought():
    assert max_profit_with_fee([5, 4], 1) == 0


def test_fee_equal_prices():
    assert max_profit_with_fee([4, 4, 4], 0) == 0


def test_fee_matches_brute_force_on_random_inputs():
    rng = random.Random(1)
    for _ in range(300):
        prices = random_prices(rng)
        fee = rng.randint(0, 4)
        assert max_profit_with_fee(prices, fee) == brute_force(prices, fee=fee), (
            prices,
            fee,
        )


# Cooldown version


def test_cooldown_worked_example():
    assert max_profit_with_cooldown([1, 2, 3, 0, 2]) == 3


def test_cooldown_empty_and_one_day():
    assert max_profit_with_cooldown([]) == 0
    assert max_profit_with_cooldown([5]) == 0


def test_cooldown_falling_prices():
    assert max_profit_with_cooldown([9, 7, 5, 3]) == 0


def test_cooldown_blocks_the_next_day_buy():
    # Without a cooldown: 1 -> 5, then 1 -> 5 again is 8. With it, the second
    # buy can't be the day right after the first sale.
    assert max_profit_with_fee([1, 5, 1, 5], 0) == 8
    assert max_profit_with_cooldown([1, 5, 1, 5]) == 4
    assert max_profit_with_cooldown([1, 5, 2, 6]) == 5


def test_cooldown_two_days():
    assert max_profit_with_cooldown([1, 2]) == 1
    assert max_profit_with_cooldown([2, 1]) == 0


def test_cooldown_matches_brute_force_on_random_inputs():
    rng = random.Random(2)
    for _ in range(300):
        prices = random_prices(rng)
        assert max_profit_with_cooldown(prices) == brute_force(
            prices, cooldown=True
        ), prices


# At most k transactions


def test_k_worked_example():
    assert max_profit_k_transactions([3, 2, 6, 5, 0, 3], 2) == 7


def test_k_empty_and_one_day():
    assert max_profit_k_transactions([], 2) == 0
    assert max_profit_k_transactions([5], 2) == 0


def test_k_zero_never_trades():
    assert max_profit_k_transactions([1, 9, 1, 9], 0) == 0


def test_k_negative_never_trades():
    assert max_profit_k_transactions([1, 9], -3) == 0


def test_k_falling_prices():
    assert max_profit_k_transactions([9, 7, 5, 3], 3) == 0


def test_k_fewer_trades_than_allowed():
    # One rise, but two trades allowed: the answer must not drop to 0.
    assert max_profit_k_transactions([1, 5], 2) == 4


def test_k_limit_binds():
    prices = [1, 5, 1, 5, 1, 5]
    assert max_profit_k_transactions(prices, 1) == 4
    assert max_profit_k_transactions(prices, 2) == 8
    assert max_profit_k_transactions(prices, 3) == 12


def test_k_huge_equals_unlimited():
    prices = [1, 5, 1, 5, 1, 5]
    assert max_profit_k_transactions(prices, 10**9) == 12


def test_k_matches_brute_force_on_random_inputs():
    rng = random.Random(3)
    for _ in range(300):
        prices = random_prices(rng)
        k = rng.randint(0, 4)
        assert max_profit_k_transactions(prices, k) == brute_force(
            prices, max_trades=k
        ), (prices, k)


def test_k_large_k_matches_fee_zero():
    rng = random.Random(4)
    for _ in range(100):
        prices = [rng.randint(0, 50) for _ in range(rng.randint(0, 30))]
        assert max_profit_k_transactions(prices, 100) == max_profit_with_fee(prices, 0)
