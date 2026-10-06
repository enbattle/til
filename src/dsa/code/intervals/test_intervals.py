import random

from intervals import insert_interval, max_overlap, merge_intervals

MEETINGS = [(8, 10), (1, 3), (2, 6), (15, 18), (6, 7)]


class Counted(int):
    """An int that counts every comparison made on it, whichever operator."""

    reads = 0
    __hash__ = int.__hash__

    def __lt__(self, other):
        Counted.reads += 1
        return int(self) < int(other)

    def __le__(self, other):
        Counted.reads += 1
        return int(self) <= int(other)

    def __gt__(self, other):
        Counted.reads += 1
        return int(self) > int(other)

    def __ge__(self, other):
        Counted.reads += 1
        return int(self) >= int(other)

    def __eq__(self, other):
        Counted.reads += 1
        return int(self) == int(other)

    def __ne__(self, other):
        Counted.reads += 1
        return int(self) != int(other)


def counted(intervals):
    Counted.reads = 0
    return [(Counted(s), Counted(e)) for s, e in intervals]


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


def random_intervals(rng, size):
    intervals = []
    for _ in range(rng.randint(0, size)):
        start = rng.randint(-6, 12)
        intervals.append((start, start + rng.randint(0, 6)))
    return intervals


def test_merge_empty_and_single():
    assert merge_intervals([]) == []
    assert merge_intervals([(4, 4)]) == [(4, 4)]


def test_merge_worked_example():
    assert merge_intervals(MEETINGS) == [(1, 7), (8, 10), (15, 18)]


def test_merge_touching_share_a_point_and_adjacent_integers_do_not():
    assert merge_intervals([(1, 3), (3, 5)]) == [(1, 5)]
    assert merge_intervals([(1, 3), (4, 5)]) == [(1, 3), (4, 5)]


def test_merge_nested_and_duplicates():
    assert merge_intervals([(1, 10), (2, 3), (4, 5)]) == [(1, 10)]
    assert merge_intervals([(2, 3), (2, 3)]) == [(2, 3)]
    assert merge_intervals([(1, 4), (1, 2)]) == [(1, 4)]


def test_merge_chain_of_overlaps_and_unsorted_input():
    assert merge_intervals([(7, 9), (1, 4), (3, 5), (5, 8)]) == [(1, 9)]


def test_merge_negative_and_large_values():
    assert merge_intervals([(-5, -2), (-3, 0), (2, 3)]) == [(-5, 0), (2, 3)]
    big = int("1000")  # built at runtime, so it is not a cached small int
    assert merge_intervals([(big, big + 5), (big + 5, big + 9)]) == [(big, big + 9)]
    assert max_overlap([(big, big + 5), (big + 5, big + 9)]) == 2


def test_merge_does_not_change_the_input():
    given = [(5, 6), (1, 5)]
    merge_intervals(given)
    assert given == [(5, 6), (1, 5)]


def test_overlap_empty_and_single():
    assert max_overlap([]) == 0
    assert max_overlap([(3, 3)]) == 1


def test_overlap_worked_example():
    assert max_overlap(MEETINGS) == 2


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


def test_insert_empty_and_ends_of_the_list():
    assert insert_interval([], (2, 3)) == [(2, 3)]
    assert insert_interval([(5, 6)], (1, 2)) == [(1, 2), (5, 6)]
    assert insert_interval([(1, 2)], (5, 6)) == [(1, 2), (5, 6)]


def test_insert_fuses_what_it_touches():
    merged = [(1, 7), (8, 10), (15, 18)]
    assert insert_interval(merged, (7, 9)) == [(1, 10), (15, 18)]
    assert insert_interval(merged, (11, 14)) == [(1, 7), (8, 10), (11, 14), (15, 18)]
    assert insert_interval(merged, (0, 20)) == [(0, 20)]
    assert insert_interval(merged, (2, 3)) == merged
    assert insert_interval(merged, (10, 15)) == [(1, 7), (8, 18)]


def test_insert_does_not_change_the_input():
    merged = [(1, 2), (4, 5)]
    insert_interval(merged, (2, 4))
    assert merged == [(1, 2), (4, 5)]


def test_merge_sorts_instead_of_comparing_every_pair():
    rng = random.Random(3)
    n = 1000
    given = counted([(s, s + rng.randint(0, 5)) for s in rng.sample(range(10**4), n)])
    merge_intervals(given)
    # Measured: 18.6 n comparisons (a sort, plus the == tuples make on ties),
    # bound 30 n. A sort needs at least n - 1; comparing every group or pair
    # takes about n * n / 2, which is 500 n.
    assert n - 1 <= Counted.reads <= 30 * n, "seed 3"


def test_overlap_sorts_and_sweeps_instead_of_checking_every_pair():
    rng = random.Random(4)
    n = 1000
    given = counted([(s, s + rng.randint(0, 2000)) for s in rng.sample(range(10**4), n)])
    max_overlap(given)
    # Measured: 19.2 n (two sorts plus one sweep), bound 30 n. A rescan per start
    # adds about n * n / 2 on top, and counting s <= x <= e does too.
    assert 2 * (n - 1) <= Counted.reads <= 30 * n, "seed 4"


def test_agrees_with_brute_force():
    rng = random.Random(0)
    for trial in range(50):
        intervals = random_intervals(rng, 8)
        at = f"seed 0, trial {trial}: {intervals}"
        assert merge_intervals(intervals) == brute_merge(intervals), at
        assert max_overlap(intervals) == brute_max_overlap(intervals), at


def test_insert_agrees_with_merging_everything():
    rng = random.Random(1)
    for trial in range(50):
        merged = merge_intervals(random_intervals(rng, 6))
        start = rng.randint(-8, 14)
        new = (start, start + rng.randint(0, 6))
        at = f"seed 1, trial {trial}: {merged} + {new}"
        assert insert_interval(merged, new) == brute_merge(merged + [new]), at
