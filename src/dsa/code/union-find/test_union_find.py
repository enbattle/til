"""The union-find entry's Python code.

API: ``UnionFind(n)`` over the elements 0..n-1, with ``find`` (the set's root),
``union`` (returns whether two separate sets were joined), ``connected``,
``size_of`` and a ``count`` attribute (the number of sets); plus
``has_cycle(n, edges)``.
"""

import math
import random

import pytest

from union_find import UnionFind, has_cycle


def depth(sets, x):
    """Steps from x up to its root, read without compressing anything."""
    steps = 0
    while sets._parent[x] != x:
        x = sets._parent[x]
        steps += 1
    return steps


def binomial(n):
    """n a power of two: unions that build the deepest tree union by size allows."""
    sets = UnionFind(n)
    step = 1
    while step < n:
        for i in range(0, n, 2 * step):
            sets.union(i, i + step)
        step *= 2
    return sets


def brute_labels(n, pairs):
    """The slow answer: every element carries a label, a union relabels a set."""
    label = list(range(n))
    for a, b in pairs:
        old, new = label[b], label[a]
        label = [new if x == old else x for x in label]
    return label


def test_empty():
    sets = UnionFind(0)
    assert sets.count == 0
    with pytest.raises(IndexError):
        sets.find(0)
    assert not has_cycle(0, [])


def test_one_element():
    sets = UnionFind(1)
    assert (sets.count, sets.find(0), sets.size_of(0)) == (1, 0, 1)
    assert sets.connected(0, 0)
    assert sets.union(0, 0) is False
    assert (sets.count, sets.size_of(0)) == (1, 1)


@pytest.mark.parametrize("x", [-1, 4, 100])
def test_out_of_range_raises(x):
    sets = UnionFind(4)
    with pytest.raises(IndexError):
        sets.find(x)
    with pytest.raises(IndexError):
        sets.connected(0, x)
    with pytest.raises(IndexError):
        sets.union(x, 0)


def test_entry_running_example():
    sets = UnionFind(6)
    for a, b in [(0, 1), (2, 3), (4, 5), (2, 4)]:
        assert sets.union(a, b) is True
    assert sets._parent == [0, 0, 2, 2, 2, 4]
    assert sets.count == 2
    assert sets.union(1, 5) is True
    assert sets._parent == [2, 0, 2, 2, 2, 2]
    assert sets.find(1) == 2
    assert sets._parent == [2, 2, 2, 2, 2, 2]
    assert (sets.count, sets.size_of(0)) == (1, 6)


def test_repeated_union_changes_nothing():
    sets = UnionFind(4)
    assert sets.union(0, 1) is True
    assert sets.union(1, 0) is False
    assert sets.union(0, 1) is False
    assert (sets.count, sets.size_of(0), sets.size_of(2)) == (3, 2, 1)


def test_union_joins_the_whole_set_not_one_element():
    sets = UnionFind(6)
    sets.union(0, 1)
    sets.union(1, 2)
    sets.union(3, 4)
    sets.union(2, 4)  # joined through members, neither of them a root
    assert all(sets.connected(0, x) for x in range(5))
    assert not sets.connected(0, 5)
    assert sets.size_of(3) == 5


def test_large_ints_compare_by_value():
    n = 2000
    sets = UnionFind(n)
    assert sets.union(int("1000"), int("1999")) is True
    assert sets.union(1999, 1000) is False
    assert sets.connected(int("1000"), 1999)
    assert sets.find(int("1999")) == sets.find(1000)
    assert sets.union(int("1500"), 1000) is True
    assert sets.size_of(int("1999")) == 3
    assert sets.count == n - 2


def test_union_by_size_keeps_depth_logarithmic():
    # Naive linking (first root under second) makes this a chain n - 1 deep.
    n = 1024
    sets = UnionFind(n)
    reverse = UnionFind(n)  # the same chain with the big side second
    for i in range(n - 1):
        sets.union(i, i + 1)
        reverse.union(i + 1, i)
    for chain in (sets, reverse):
        assert max(depth(chain, x) for x in range(n)) <= math.log2(n)
    tree = binomial(n)
    assert max(depth(tree, x) for x in range(n)) == 10


def test_union_rewrites_one_pointer_not_a_whole_set():
    # Two stars of 100: relabeling one of them would change 100 entries.
    sets = UnionFind(200)
    for i in range(1, 100):
        sets.union(0, i)
        sets.union(100, 100 + i)
    before = list(sets._parent)
    sets.union(37, 163)
    changed = [i for i in range(200) if sets._parent[i] != before[i]]
    assert changed in ([0], [100]), f"changed {len(changed)} entries"
    assert max(depth(sets, x) for x in range(200)) <= 2


def test_find_compresses_the_whole_path():
    sets = binomial(16)
    path = [15, 14, 12, 8]
    assert depth(sets, 15) == 4
    assert sets.find(15) == 0
    assert [sets._parent[x] for x in path] == [0, 0, 0, 0]
    assert depth(sets, 15) == 1


def test_find_changes_no_answer():
    sets = binomial(64)
    roots = [sets.find(x) for x in range(64)]
    assert roots == [0] * 64
    assert sets.count == 1 and sets.size_of(33) == 64


def test_has_cycle_cases():
    assert has_cycle(4, [(0, 1), (1, 2), (2, 0)])
    assert not has_cycle(4, [(0, 1), (1, 2), (2, 3)])
    assert has_cycle(2, [(0, 1), (1, 0)])  # the same edge twice
    assert has_cycle(1, [(0, 0)])  # a self-loop
    assert not has_cycle(5, [])


def test_matches_relabeling_brute_force():
    rng = random.Random(2024)
    for trial in range(50):
        n = rng.randint(1, 30)
        count = rng.randint(0, 40)
        pairs = [(rng.randrange(n), rng.randrange(n)) for _ in range(count)]
        sets = UnionFind(n)
        for step, (a, b) in enumerate(pairs):
            label = brute_labels(n, pairs[:step])
            msg = f"seed 2024, trial {trial}, step {step}, union({a}, {b})"
            assert sets.union(a, b) == (label[a] != label[b]), msg
        label = brute_labels(n, pairs)
        msg = f"seed 2024, trial {trial}, n={n}, pairs={pairs}"
        assert sets.count == len(set(label)), msg
        for x in range(n):
            assert sets.size_of(x) == label.count(label[x]), msg
            for y in range(n):
                assert sets.connected(x, y) == (label[x] == label[y]), msg


def test_has_cycle_matches_edge_count_rule():
    # A graph is a forest exactly when edges == n - components.
    rng = random.Random(7)
    for trial in range(50):
        n = rng.randint(1, 12)
        edges = [(rng.randrange(n), rng.randrange(n)) for _ in range(rng.randint(0, 14))]
        components = len(set(brute_labels(n, edges)))
        expected = len(edges) > n - components
        msg = f"seed 7, trial {trial}, n={n}, edges={edges}"
        assert has_cycle(n, edges) == expected, msg
