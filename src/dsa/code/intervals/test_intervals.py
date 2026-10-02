import random

import pytest

from intervals import max_overlap, merge_intervals


def brute_max_overlap(intervals):
    """Count the intervals covering every integer point; take the largest count."""
    if not intervals:
        return 0
    low = min(start for start, _ in intervals)
    high = max(end for _, end in intervals)
    return max(
        sum(1 for start, end in intervals if start <= x <= end)
        for x in range(low, high + 1)
    )


def brute_merge(intervals):
    """Keep fusing any two intervals that share a point until none do."""
    pending = [list(pair) for pair in intervals]
    changed = True
    while changed:
        changed = False
        for i in range(len(pending)):
            for j in range(i + 1, len(pending)):
                a, b = pending[i], pending[j]
                if a[0] <= b[1] and b[0] <= a[1]:
                    pending[i] = [min(a[0], b[0]), max(a[1], b[1])]
                    del pending[j]
                    changed = True
                    break
            if changed:
                break
    return sorted(tuple(pair) for pair in pending)


def test_merge_empty_and_single():
    assert merge_intervals([]) == []
    assert merge_intervals([(4, 4)]) == [(4, 4)]


def test_merge_worked_example():
    given = [(8, 10), (1, 3), (2, 6), (15, 18), (6, 7)]
    assert merge_intervals(given) == [(1, 7), (8, 10), (15, 18)]


def test_merge_touching_share_a_point_and_adjacent_integers_do_not():
    assert merge_intervals([(1, 3), (3, 5)]) == [(1, 5)]
    assert merge_intervals([(1, 3), (4, 5)]) == [(1, 3), (4, 5)]


def test_merge_nested_and_duplicates():
    assert merge_intervals([(1, 10), (2, 3), (4, 5)]) == [(1, 10)]
    assert merge_intervals([(2, 3), (2, 3)]) == [(2, 3)]
    assert merge_intervals([(1, 4), (1, 2)]) == [(1, 4)]


def test_merge_chain_of_overlaps_and_unsorted_input():
    assert merge_intervals([(7, 9), (1, 4), (3, 5), (5, 8)]) == [(1, 9)]


def test_merge_negative_values():
    assert merge_intervals([(-5, -2), (-3, 0), (2, 3)]) == [(-5, 0), (2, 3)]


def test_merge_does_not_change_the_input():
    given = [(5, 6), (1, 5)]
    merge_intervals(given)
    assert given == [(5, 6), (1, 5)]


def test_overlap_empty_and_single():
    assert max_overlap([]) == 0
    assert max_overlap([(3, 3)]) == 1


def test_overlap_worked_example():
    assert max_overlap([(8, 10), (1, 3), (2, 6), (15, 18), (6, 7)]) == 2


def test_overlap_touching_ends_count_as_overlapping():
    assert max_overlap([(1, 3), (3, 5)]) == 2
    assert max_overlap([(1, 3), (4, 5)]) == 1


def test_overlap_nested_and_identical():
    assert max_overlap([(1, 10), (2, 9), (3, 8), (4, 7)]) == 4
    assert max_overlap([(2, 5)] * 3) == 3


def test_overlap_disjoint_is_one():
    assert max_overlap([(1, 1), (2, 2), (3, 3)]) == 1


def test_overlap_end_before_a_later_start_is_not_counted():
    assert max_overlap([(1, 2), (1, 2), (5, 6)]) == 2


@pytest.mark.parametrize("seed", range(5))
def test_agrees_with_brute_force(seed):
    rng = random.Random(seed)
    for _ in range(200):
        intervals = []
        for _ in range(rng.randint(0, 8)):
            start = rng.randint(-6, 12)
            intervals.append((start, start + rng.randint(0, 6)))
        assert merge_intervals(intervals) == brute_merge(intervals)
        assert max_overlap(intervals) == brute_max_overlap(intervals)
