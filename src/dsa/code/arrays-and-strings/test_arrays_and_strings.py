"""Tests for the arrays-and-strings entry's Python code.

API: ``DynamicArray()`` with ``len(a)``, ``a.capacity``, ``a[i]`` (IndexError
outside 0..len-1), ``append(item)`` and ``insert(i, item)`` (IndexError outside
0..len); ``StringBuilder().append(piece)`` (chainable) and ``build()``;
``reverse_code_points(s)``.
"""

import random

import pytest

from arrays_and_strings import DynamicArray, StringBuilder, reverse_code_points


def contents(a):
    return [a[i] for i in range(len(a))]


def filled(items):
    a = DynamicArray()
    for item in items:
        a.append(item)
    return a


def test_starts_empty():
    a = DynamicArray()
    assert len(a) == 0
    assert contents(a) == []
    with pytest.raises(IndexError):
        a[0]


def test_one_item():
    a = filled(["a"])
    assert len(a) == 1 and a[0] == "a"
    with pytest.raises(IndexError):
        a[1]


def test_the_running_example():
    a = filled("abcde")
    assert contents(a) == list("abcde")
    assert a.capacity == 8
    a.insert(1, "x")
    assert contents(a) == list("axbcde")
    a.insert(6, "z")
    assert contents(a) == list("axbcdez")


def test_insert_at_the_front_and_into_a_full_array():
    a = filled([1, 2, 3, 4])
    assert a.capacity == 4
    a.insert(0, 0)
    assert contents(a) == [0, 1, 2, 3, 4]
    assert a.capacity == 8


def test_duplicates_and_none_are_ordinary_items():
    a = filled([None, None, 7, 7])
    assert contents(a) == [None, None, 7, 7]
    assert len(a) == 4


def test_index_checks_use_the_length_not_the_capacity():
    a = filled([1, 2, 3])
    assert a.capacity == 4
    for bad in (-1, 3, 4, 100):
        with pytest.raises(IndexError):
            a[bad]
    for bad in (-1, 4, 5):
        with pytest.raises(IndexError):
            a.insert(bad, 0)
    assert contents(a) == [1, 2, 3]


def test_inserts_match_a_python_list():
    seed = 11
    rng = random.Random(seed)
    for trial in range(50):
        a, want = DynamicArray(), []
        for step in range(rng.randint(0, 40)):
            i = rng.randint(0, len(want))
            a.insert(i, step)
            want.insert(i, step)
            where = f"seed {seed}, trial {trial}, step {step}"
            assert len(a) == len(want), where
            assert contents(a) == want, where


def test_capacity_doubles_so_resizes_are_rare():
    a = DynamicArray()
    sizes = {a.capacity}
    for n in range(1, 1001):
        a.append(n)
        sizes.add(a.capacity)
        assert len(a) <= a.capacity < 2 * len(a) + 1, n
    # 1, 2, 4, ..., 1024: eleven sizes. Growing by a fixed step would pass
    # through hundreds.
    assert sorted(sizes) == [2**k for k in range(11)]


def test_builder_empty_and_single_piece():
    assert StringBuilder().build() == ""
    assert StringBuilder().append("").build() == ""
    assert StringBuilder().append("abc").build() == "abc"


def test_builder_chains_and_rebuilds():
    b = StringBuilder()
    assert b.append("a").append("b") is b
    assert b.build() == "ab"
    assert b.append("c").build() == "abc"
    assert b.build() == "abc"


def test_builder_joins_once_and_keeps_one_piece_after():
    b = StringBuilder()
    for n in range(100):
        b.append("x")
    assert len(b._parts) == 100
    assert b.build() == "x" * 100
    assert len(b._parts) == 1


def test_builder_matches_concatenation():
    seed = 12
    rng = random.Random(seed)
    alphabet = ["", "a", "bc", "é", "😀", "é"]
    for trial in range(50):
        pieces = [rng.choice(alphabet) for _ in range(rng.randint(0, 30))]
        b = StringBuilder()
        for piece in pieces:
            b.append(piece)
        assert b.build() == "".join(pieces), f"seed {seed}, trial {trial}: {pieces}"


def test_reverse_keeps_emoji_whole():
    assert reverse_code_points("") == ""
    assert reverse_code_points("a") == "a"
    assert reverse_code_points("aa") == "aa"
    assert reverse_code_points("ab😀") == "😀ba"
    assert reverse_code_points("😀") == "😀"
    assert len("ab😀") == 3


def test_reverse_still_splits_a_combining_accent():
    assert reverse_code_points("éa") == "áe"


def test_reverse_twice_is_the_original():
    seed = 13
    rng = random.Random(seed)
    alphabet = "ab é😀́"
    for trial in range(50):
        s = "".join(rng.choice(alphabet) for _ in range(rng.randint(0, 20)))
        where = f"seed {seed}, trial {trial}: {s!r}"
        assert reverse_code_points(reverse_code_points(s)) == s, where
        assert len(reverse_code_points(s)) == len(s), where
