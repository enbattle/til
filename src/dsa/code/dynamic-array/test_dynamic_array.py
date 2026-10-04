"""The array entry's Python code: a DynamicArray compared against Python's list.

API: ``DynamicArray(capacity=4)`` with ``len()``, a ``capacity`` property,
``a[i]`` and ``a[i] = v`` (negative indexes count from the end), iteration,
``append``, ``insert(i, v)`` (0 <= i <= len), and ``pop(i=-1)``.
"""

import random

import pytest

from dynamic_array import DynamicArray


def unused_slots(a):
    return a._data[len(a) :]


def test_starts_empty_with_the_given_capacity():
    a = DynamicArray(4)
    assert len(a) == 0
    assert a.capacity == 4
    assert list(a) == []


def test_defaults_to_a_positive_capacity():
    assert DynamicArray().capacity > 0


@pytest.mark.parametrize("capacity", [0, -1])
def test_rejects_a_capacity_below_one(capacity):
    with pytest.raises(ValueError):
        DynamicArray(capacity)


def test_empty_array_has_no_valid_index():
    a = DynamicArray()
    for i in [0, -1, 1]:
        with pytest.raises(IndexError):
            a[i]
        with pytest.raises(IndexError):
            a[i] = "x"
    with pytest.raises(IndexError):
        a.pop()
    with pytest.raises(IndexError):
        a.pop(0)


def test_single_element():
    a = DynamicArray(1)
    a.append("only")
    assert len(a) == 1
    assert a[0] == "only"
    assert a[-1] == "only"
    with pytest.raises(IndexError):
        a[1]
    with pytest.raises(IndexError):
        a[-2]
    assert a.pop() == "only"
    assert len(a) == 0
    assert a.capacity == 1


def test_get_and_set_with_positive_and_negative_indexes():
    a = DynamicArray()
    for x in [10, 20, 30]:
        a.append(x)
    assert [a[0], a[1], a[2]] == [10, 20, 30]
    assert [a[-1], a[-2], a[-3]] == [30, 20, 10]
    a[1] = 25
    a[-1] = 35
    assert list(a) == [10, 25, 35]
    for i in [3, -4]:
        with pytest.raises(IndexError):
            a[i]


def test_stores_none_and_duplicates():
    a = DynamicArray(2)
    for x in [None, 7, 7, None, 7]:
        a.append(x)
    assert len(a) == 5
    assert list(a) == [None, 7, 7, None, 7]
    assert a.pop(0) is None
    assert list(a) == [7, 7, None, 7]


def test_appends_double_the_capacity_only_when_full():
    a = DynamicArray(1)
    capacities = []
    for i in range(17):
        a.append(i)
        capacities.append(a.capacity)
    assert capacities == [1, 2, 4, 4, 8, 8, 8, 8] + [16] * 8 + [32]
    assert list(a) == list(range(17))


def test_insert_at_the_front_the_middle_and_the_end():
    a = DynamicArray(1)
    a.insert(0, "b")
    a.insert(0, "a")
    a.insert(2, "d")
    a.insert(2, "c")
    assert list(a) == ["a", "b", "c", "d"]
    assert a.capacity == 4
    a.insert(4, "e")
    assert list(a) == ["a", "b", "c", "d", "e"]
    assert a.capacity == 8


@pytest.mark.parametrize("index", [-1, 4, 100])
def test_insert_rejects_an_index_outside_zero_to_len(index):
    a = DynamicArray()
    for x in "abc":
        a.append(x)
    with pytest.raises(IndexError):
        a.insert(index, "z")
    assert list(a) == ["a", "b", "c"]


def test_pop_from_the_front_the_middle_and_the_end():
    a = DynamicArray()
    for x in "abcde":
        a.append(x)
    assert a.pop() == "e"
    assert a.pop(0) == "a"
    assert a.pop(1) == "c"
    assert a.pop(-1) == "d"
    assert list(a) == ["b"]
    with pytest.raises(IndexError):
        a.pop(1)


def test_shrinks_to_half_at_a_quarter_full():
    a = DynamicArray(1)
    for i in range(16):
        a.append(i)
    assert a.capacity == 16
    sizes_and_capacities = []
    while len(a):
        a.pop()
        sizes_and_capacities.append((len(a), a.capacity))
    assert sizes_and_capacities[:12] == [(n, 16) for n in range(15, 4, -1)] + [(4, 8)]
    assert sizes_and_capacities[12:] == [(3, 8), (2, 4), (1, 2), (0, 1)]


def test_push_pop_at_the_boundary_does_not_resize_every_time():
    a = DynamicArray(4)
    for i in range(5):
        a.append(i)
    assert a.capacity == 8
    for _ in range(50):
        a.pop()
        assert a.capacity == 8
        a.append("x")
        assert a.capacity == 8


def test_removed_slots_are_cleared():
    a = DynamicArray(8)
    for i in range(6):
        a.append(object())
    a.pop()
    a.pop(0)
    a.pop(2)
    assert unused_slots(a) == [None] * (a.capacity - len(a))


def test_matches_list_on_random_operations():
    for seed in range(50):
        rng = random.Random(seed)
        a = DynamicArray(rng.randint(1, 4))
        ref = []
        for step in range(300):
            at = f"seed {seed}, step {step}"
            op = rng.random()
            if op < 0.35:
                x = rng.randint(0, 9)
                a.append(x)
                ref.append(x)
            elif op < 0.5:
                i = rng.randint(0, len(ref))
                x = rng.randint(0, 9)
                a.insert(i, x)
                ref.insert(i, x)
            elif op < 0.65:
                if ref:
                    assert a.pop() == ref.pop(), at
                else:
                    with pytest.raises(IndexError):
                        a.pop()
            elif op < 0.8 and ref:
                i = rng.randint(-len(ref), len(ref) - 1)
                assert a.pop(i) == ref.pop(i), at
            elif ref:
                i = rng.randint(-len(ref), len(ref) - 1)
                assert a[i] == ref[i], at
                a[i] = ref[i] = rng.randint(0, 9)
            assert len(a) == len(ref), at
            assert list(a) == ref, at
            assert len(a) <= a.capacity, at
            assert unused_slots(a) == [None] * (a.capacity - len(a)), at
