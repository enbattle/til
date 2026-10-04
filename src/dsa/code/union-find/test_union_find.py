"""The union-find entry's Python code.

API: ``UnionFind(n)`` over the elements 0..n-1, with ``find`` (the set's root),
``union`` (returns whether two separate sets were joined), ``connected``,
``size_of`` and a ``count`` property (the number of sets); plus
``count_components(n, edges)`` and ``has_cycle(n, edges)``.
"""

import math
import random

import pytest

from union_find import UnionFind, count_components, has_cycle


def depth(sets, x):
    """Steps from x up to its root, read without compressing anything."""
    steps = 0
    while sets._parent[x] != x:
        x = sets._parent[x]
        steps += 1
    return steps


def test_empty():
    sets = UnionFind(0)
    assert sets.count == 0
    with pytest.raises(IndexError):
        sets.find(0)


def test_negative_n_is_rejected():
    with pytest.raises(ValueError):
        UnionFind(-1)


def test_one_element():
    sets = UnionFind(1)
    assert sets.count == 1
    assert sets.find(0) == 0
    assert sets.size_of(0) == 1
    assert sets.connected(0, 0)


def test_every_element_starts_alone():
    sets = UnionFind(5)
    assert sets.count == 5
    for x in range(5):
        assert sets.find(x) == x
        assert sets.size_of(x) == 1
    assert not sets.connected(0, 1)


def test_union_with_itself_changes_nothing():
    sets = UnionFind(3)
    assert sets.union(1, 1) is False
    assert sets.count == 3
    assert sets.size_of(1) == 1


def test_union_joins_two_sets_once():
    sets = UnionFind(4)
    assert sets.union(0, 1) is True
    assert sets.connected(0, 1)
    assert sets.count == 3
    assert sets.size_of(0) == 2
    assert sets.size_of(1) == 2
    assert sets.union(1, 0) is False
    assert sets.union(0, 1) is False
    assert sets.count == 3
    assert sets.size_of(0) == 2


def test_union_is_transitive():
    sets = UnionFind(6)
    sets.union(0, 1)
    sets.union(2, 3)
    assert not sets.connected(1, 2)
    sets.union(1, 3)
    assert sets.connected(0, 2)
    assert sets.size_of(3) == 4
    assert sets.union(0, 2) is False
    assert sets.count == 3


@pytest.mark.parametrize("bad", [-1, 4, 100])
def test_out_of_range_elements_raise(bad):
    sets = UnionFind(4)
    with pytest.raises(IndexError):
        sets.find(bad)
    with pytest.raises(IndexError):
        sets.union(0, bad)
    with pytest.raises(IndexError):
        sets.connected(bad, 0)
    with pytest.raises(IndexError):
        sets.size_of(bad)
    assert sets.count == 4


def test_the_entrys_worked_example():
    sets = UnionFind(6)
    sets.union(0, 1)
    sets.union(2, 3)
    sets.union(4, 5)
    sets.union(2, 4)
    assert sets._parent == [0, 0, 2, 2, 2, 4]
    sets.union(1, 5)
    assert sets._parent == [2, 0, 2, 2, 2, 2]
    assert sets.count == 1
    assert sets.find(1) == 2
    assert sets._parent == [2, 2, 2, 2, 2, 2]


def test_smaller_tree_goes_under_the_larger():
    sets = UnionFind(4)
    sets.union(1, 2)
    sets.union(1, 3)
    sets.union(0, 1)
    assert sets.find(0) == sets.find(1) == 1
    assert sets.size_of(0) == 4


def test_find_compresses_the_whole_path():
    sets = UnionFind(8)
    for x in range(1, 8):
        sets._parent[x] = x - 1
    assert sets.find(7) == 0
    assert sets._parent == [0] * 8


def test_union_by_size_keeps_trees_shallow():
    n = 1024
    sets = UnionFind(n)
    width = 1
    while width < n:
        for start in range(0, n, 2 * width):
            sets.union(start + width, start)
        width *= 2
    assert sets.count == 1
    assert max(depth(sets, x) for x in range(n)) <= math.log2(n)


def test_matches_a_relabelled_label_array():
    for seed in range(50):
        rng = random.Random(seed)
        n = rng.randrange(0, 25)
        sets = UnionFind(n)
        label = list(range(n))
        for step in range(rng.randrange(1, 60)):
            if n == 0:
                assert sets.count == 0, f"seed {seed}"
                break
            a, b = rng.randrange(n), rng.randrange(n)
            at = f"seed {seed}, step {step} (n {n}, a {a}, b {b})"
            op = rng.choice(["union", "connected", "find", "size"])
            if op == "union":
                joined = label[a] != label[b]
                assert sets.union(a, b) is joined, at
                old = label[b]
                label = [label[a] if lab == old else lab for lab in label]
            elif op == "connected":
                assert sets.connected(a, b) == (label[a] == label[b]), at
            elif op == "find":
                root = sets.find(a)
                assert label[root] == label[a], at
                assert sets.find(root) == root, at
            else:
                assert sets.size_of(a) == label.count(label[a]), at
            assert sets.count == len(set(label)), at
            assert all(depth(sets, x) <= math.log2(n) for x in range(n)), at


def components_by_search(n, edges):
    neighbours = [[] for _ in range(n)]
    for a, b in edges:
        neighbours[a].append(b)
        neighbours[b].append(a)
    seen = [False] * n
    found = 0
    for start in range(n):
        if seen[start]:
            continue
        found += 1
        seen[start] = True
        stack = [start]
        while stack:
            for nxt in neighbours[stack.pop()]:
                if not seen[nxt]:
                    seen[nxt] = True
                    stack.append(nxt)
    return found


def test_count_components_examples():
    assert count_components(0, []) == 0
    assert count_components(1, []) == 1
    assert count_components(5, []) == 5
    assert count_components(5, [(0, 1), (1, 2), (3, 4)]) == 2
    assert count_components(4, [(0, 1), (1, 0), (2, 2)]) == 3


def test_has_cycle_examples():
    assert has_cycle(0, []) is False
    assert has_cycle(4, [(0, 1), (1, 2), (2, 3)]) is False
    assert has_cycle(4, [(0, 1), (1, 2), (2, 0)]) is True
    assert has_cycle(3, [(1, 1)]) is True
    assert has_cycle(2, [(0, 1), (1, 0)]) is True


def test_graph_helpers_match_a_search():
    for seed in range(1000, 1050):
        rng = random.Random(seed)
        n = rng.randrange(1, 15)
        edges = [(rng.randrange(n), rng.randrange(n)) for _ in range(rng.randrange(0, 20))]
        components = components_by_search(n, edges)
        at = f"seed {seed}: {(n, edges)}"
        assert count_components(n, edges) == components, at
        # A forest with n nodes and c trees has exactly n - c edges; any more is a cycle.
        assert has_cycle(n, edges) == (len(edges) > n - components), at
