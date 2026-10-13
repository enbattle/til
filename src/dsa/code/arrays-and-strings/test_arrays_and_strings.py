"""Tests for the arrays-and-strings entry's Python code.

API: ``DynamicArray()`` with ``size()``, ``capacity()``, ``get(i)`` (IndexError
outside 0..size-1), ``append(item)`` and ``insert(i, item)`` (IndexError outside
0..size); ``StringBuilder()`` with ``append(piece)`` and ``build()``;
``reverse_string(s)``.
"""

import random

import pytest

from arrays_and_strings import DynamicArray, StringBuilder, reverse_string


def contents(a):
    items = []
    for i in range(a.size()):
        items.append(a.get(i))
    return items


def filled(items):
    a = DynamicArray()
    for item in items:
        a.append(item)
    return a


def test_starts_empty():
    a = DynamicArray()
    assert a.size() == 0
    assert contents(a) == []
    with pytest.raises(IndexError):
        a.get(0)


def test_one_item():
    a = filled(["a"])
    assert a.size() == 1 and a.get(0) == "a"
    with pytest.raises(IndexError):
        a.get(1)


def test_the_running_example():
    a = filled("abcde")
    assert contents(a) == list("abcde")
    assert a.capacity() == 8
    a.insert(1, "x")
    assert contents(a) == list("axbcde")
    a.insert(6, "z")
    assert contents(a) == list("axbcdez")


def test_insert_at_the_front_and_into_a_full_array():
    a = filled([1, 2, 3, 4])
    assert a.capacity() == 4
    a.insert(0, 0)
    assert contents(a) == [0, 1, 2, 3, 4]
    assert a.capacity() == 8


def test_duplicates_and_none_are_ordinary_items():
    a = filled([None, None, 7, 7])
    assert contents(a) == [None, None, 7, 7]
    assert a.size() == 4


def test_index_checks_use_the_size_not_the_capacity():
    a = filled([1, 2, 3])
    assert a.capacity() == 4
    for bad in (-1, 3, 4, 100):
        with pytest.raises(IndexError):
            a.get(bad)
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
            assert a.size() == len(want), where
            assert contents(a) == want, where


def test_capacity_doubles_so_resizes_are_rare():
    a = DynamicArray()
    sizes = {a.capacity()}
    for n in range(1, 1001):
        a.append(n)
        sizes.add(a.capacity())
        assert a.size() <= a.capacity() < 2 * a.size() + 1, n
    # 1, 2, 4, ..., 1024: eleven sizes. Growing by a fixed step would pass
    # through hundreds.
    assert sorted(sizes) == [2**k for k in range(11)]


def test_builder_empty_and_single_piece():
    assert StringBuilder().build() == ""
    b = StringBuilder()
    b.append("")
    assert b.build() == ""
    b = StringBuilder()
    b.append("abc")
    assert b.build() == "abc"


def test_builder_can_build_again_after_more_appends():
    b = StringBuilder()
    b.append("a")
    b.append("b")
    assert b.build() == "ab"
    b.append("c")
    assert b.build() == "abc"
    assert b.build() == "abc"


def test_builder_joins_once_and_keeps_one_piece_after():
    b = StringBuilder()
    for n in range(100):
        b.append("x")
    assert len(b.parts) == 100
    assert b.build() == "x" * 100
    assert len(b.parts) == 1


def test_builder_matches_concatenation():
    seed = 12
    rng = random.Random(seed)
    alphabet = ["", "a", "bc", "d"]
    for trial in range(50):
        pieces = [rng.choice(alphabet) for _ in range(rng.randint(0, 30))]
        b = StringBuilder()
        for piece in pieces:
            b.append(piece)
        assert b.build() == "".join(pieces), f"seed {seed}, trial {trial}: {pieces}"


def test_reverse_small_strings():
    assert reverse_string("") == ""
    assert reverse_string("a") == "a"
    assert reverse_string("aa") == "aa"
    assert reverse_string("ab") == "ba"
    assert reverse_string("abc") == "cba"
    assert reverse_string("abcd") == "dcba"
    assert reverse_string("ab😀") == "😀ba"


def test_reverse_twice_is_the_original():
    seed = 13
    rng = random.Random(seed)
    for trial in range(50):
        s = "".join(rng.choice("abc ") for _ in range(rng.randint(0, 20)))
        where = f"seed {seed}, trial {trial}: {s!r}"
        assert reverse_string(reverse_string(s)) == s, where
        assert reverse_string(s) == s[::-1], where
