"""Tests for greedy.py, checked against exhaustive oracles on seeded random input."""

import random
import sys
from functools import cache
from itertools import combinations

from greedy import can_reach_end, greedy_coin_count, select_intervals


def overlap(a, b):
    """Half-open intervals share a point exactly when each starts before the other ends."""
    return a[0] < b[1] and b[0] < a[1]


def is_valid(chosen):
    return all(not overlap(a, b) for a, b in combinations(chosen, 2))


def brute_force_best(intervals):
    """The size of the largest non-overlapping subset, trying every subset."""
    best = 0
    for mask in range(1 << len(intervals)):
        subset = [iv for i, iv in enumerate(intervals) if mask >> i & 1]
        if len(subset) > best and is_valid(subset):
            best = len(subset)
    return best


def pick_by(intervals, key):
    """Greedy with a different sort order, to show those orders are wrong."""
    chosen = []
    for iv in sorted(intervals, key=key):
        if all(not overlap(iv, other) for other in chosen):
            chosen.append(iv)
    return chosen


def random_intervals(rng, max_count=8, span=12):
    out = []
    for _ in range(rng.randint(0, max_count)):
        start = rng.randint(0, span)
        out.append((start, start + rng.randint(1, 5)))
    return out


# interval scheduling


def test_empty_input():
    assert select_intervals([]) == []


def test_one_interval():
    assert select_intervals([(2, 5)]) == [(2, 5)]


def test_touching_endpoints_are_compatible():
    assert select_intervals([(1, 3), (3, 5)]) == [(1, 3), (3, 5)]


def test_overlapping_pair_keeps_one():
    assert len(select_intervals([(1, 4), (3, 6)])) == 1


def test_identical_intervals_keep_one():
    assert select_intervals([(1, 3), (1, 3), (1, 3)]) == [(1, 3)]


def test_ties_on_end_still_give_the_best_count():
    chosen = select_intervals([(0, 4), (2, 4), (3, 4), (4, 6)])
    assert len(chosen) == 2
    assert is_valid(chosen)


def test_does_not_change_the_input():
    given = [(5, 6), (1, 2), (3, 4)]
    select_intervals(given)
    assert given == [(5, 6), (1, 2), (3, 4)]


def test_result_is_in_time_order_and_a_subset():
    given = [(5, 8), (1, 3), (2, 6), (3, 5), (8, 9)]
    chosen = select_intervals(given)
    assert chosen == sorted(chosen)
    assert all(iv in given for iv in chosen)


def test_sorting_by_start_loses_on_a_long_early_interval():
    given = [(0, 10), (1, 2), (3, 4), (5, 6)]
    assert len(pick_by(given, key=lambda iv: iv[0])) == 1
    assert len(select_intervals(given)) == 3


def test_sorting_by_length_loses_on_a_short_middle_interval():
    given = [(0, 5), (4, 7), (6, 11)]
    assert len(pick_by(given, key=lambda iv: iv[1] - iv[0])) == 1
    assert len(select_intervals(given)) == 2


def test_agrees_with_brute_force():
    rng = random.Random(11)
    for trial in range(50):
        given = random_intervals(rng)
        at = f"seed 11, trial {trial}: {given}"
        chosen = select_intervals(given)
        assert is_valid(chosen), at
        assert len(chosen) == brute_force_best(given), at


def test_the_other_sort_orders_do_lose_somewhere():
    rng = random.Random(5)
    cases = [random_intervals(rng) for _ in range(50)]
    assert any(
        len(pick_by(c, key=lambda iv: iv[0])) < brute_force_best(c) for c in cases
    ), "seed 5: sort by start never lost in 50 trials"
    # Sorting by length loses too rarely for 50 random trials to show it; the
    # fixed case in test_sorting_by_length_loses_on_a_short_middle_interval does.


# jump game


def reachable_by_search(jumps):
    """Breadth-first search over indices, trying every jump length."""
    if not jumps:
        return False
    seen = {0}
    queue = [0]
    for i in queue:
        for nxt in range(i + 1, min(i + jumps[i], len(jumps) - 1) + 1):
            if nxt not in seen:
                seen.add(nxt)
                queue.append(nxt)
    return len(jumps) - 1 in seen


def test_jump_empty_input():
    assert can_reach_end([]) is False


def test_jump_one_element_is_already_there():
    assert can_reach_end([0]) is True


def test_jump_classic_cases():
    assert can_reach_end([2, 3, 1, 1, 4]) is True
    assert can_reach_end([3, 2, 1, 0, 4]) is False


def test_jump_stuck_at_the_start():
    assert can_reach_end([0, 5]) is False


def test_jump_exactly_enough_and_one_short():
    assert can_reach_end([1, 1, 1, 1]) is True
    assert can_reach_end([1, 1, 0, 1]) is False


def test_jump_zero_at_the_end_is_fine():
    assert can_reach_end([4, 0, 0, 0, 0]) is True


def test_jump_agrees_with_search():
    rng = random.Random(23)
    for trial in range(50):
        jumps = [rng.randint(0, 3) for _ in range(rng.randint(0, 10))]
        assert can_reach_end(jumps) == reachable_by_search(jumps), (
            f"seed 23, trial {trial}: {jumps}"
        )


# making change


@cache
def exhaustive_fewest(coins, amount):
    """The true minimum by trying every coin at every step (coins is a tuple)."""
    if amount == 0:
        return 0
    rests = [exhaustive_fewest(coins, amount - c) for c in coins if c <= amount]
    return min((r + 1 for r in rests if r is not None), default=None)


def test_coins_zero_amount_needs_no_coins():
    assert greedy_coin_count([1, 3, 4], 0) == 0
    assert greedy_coin_count([], 0) == 0


def test_coins_greedy_is_wrong_for_one_three_four():
    assert greedy_coin_count([1, 3, 4], 6) == 3  # 4 + 1 + 1
    assert exhaustive_fewest((1, 3, 4), 6) == 2  # 3 + 3


def test_coins_greedy_can_get_stuck():
    assert greedy_coin_count([5, 3], 9) is None  # 5, then 3, then 1 left: nothing fits
    assert exhaustive_fewest((5, 3), 9) == 3  # 3 + 3 + 3


def test_coins_exact_single_coin_and_unordered_input():
    assert greedy_coin_count([7], 21) == 3
    assert greedy_coin_count([1, 25, 5, 10], 41) == 4  # 25 + 10 + 5 + 1


def test_coins_greedy_is_optimal_for_us_coins():
    for amount in range(200):
        assert greedy_coin_count([1, 5, 10, 25], amount) == exhaustive_fewest(
            (1, 5, 10, 25), amount
        )


def test_coins_greedy_never_beats_the_best_and_sometimes_loses():
    rng = random.Random(3)
    worse = 0
    for trial in range(50):
        coins = tuple({1, *(rng.randint(2, 9) for _ in range(rng.randint(1, 3)))})
        amount = rng.randint(0, 30)
        at = f"seed 3, trial {trial}: coins {coins}, amount {amount}"
        greedy = greedy_coin_count(list(coins), amount)
        best = exhaustive_fewest(coins, amount)
        assert greedy is not None, at  # a 1-coin is always there
        assert greedy >= best, at
        worse += greedy > best
    assert worse > 0, "seed 3: greedy never lost in 50 trials"


# the walk reads each index once


class Counting(list):
    """A list that counts the items an iteration actually hands out."""

    reads = 0

    def __iter__(self):
        for item in super().__iter__():
            Counting.reads += 1
            yield item


def test_jump_reads_each_index_once_and_stops_at_a_gap():
    Counting.reads = 0
    assert can_reach_end(Counting([2] * 50)) is True
    assert Counting.reads == 50
    Counting.reads = 0
    assert can_reach_end(Counting([1, 0, 9, 9, 9, 9])) is False
    assert Counting.reads == 3  # reads index 2, sees the gap, stops


def lines_run_by(fn, *args, budget):
    """Run fn, counting executed lines in greedy.py; raise past the budget."""
    count = 0

    def tracer(frame, event, arg):
        nonlocal count
        if frame.f_code.co_name != "can_reach_end":
            return None
        if event == "line":
            count += 1
            if count > budget:
                raise AssertionError(f"more than {budget} lines run")
        return tracer

    sys.settrace(tracer)
    try:
        fn(*args)
    finally:
        sys.settrace(None)
    return count


def test_jump_work_does_not_grow_with_the_size_of_the_jumps():
    # Marking every index each position reaches runs n * n lines here.
    n = 300
    assert lines_run_by(can_reach_end, [n] * n, budget=10 * n) <= 10 * n


def test_jump_with_a_big_int_and_long_inputs():
    assert can_reach_end([int("1000"), 0, 0]) is True
    assert can_reach_end([1] * 1_000_000) is True
    assert can_reach_end([1] * 999_999 + [0, 0]) is False


def test_select_intervals_on_a_long_input():
    given = [(i, i + 2) for i in range(200_000)]
    assert len(select_intervals(given)) == 100_000
