"""The linked-list entry's Python code.

API: ``LinkedList(values=())`` with ``push_front``, ``push_back``,
``pop_front`` (IndexError when empty), ``find`` (the first node holding the
value, or None), ``remove`` (the first occurrence; returns whether it was
there), ``reverse`` (in place), ``len()``, ``in`` and iteration.
"""

import random

import pytest

from linked_list import LinkedList


def test_starts_empty():
    lst = LinkedList()
    assert len(lst) == 0
    assert list(lst) == []
    assert lst.find(1) is None
    assert 1 not in lst


def test_builds_from_an_iterable_in_order():
    lst = LinkedList([1, 2, 3])
    assert list(lst) == [1, 2, 3]
    assert len(lst) == 3


def test_push_front_and_push_back():
    lst = LinkedList()
    lst.push_back(2)
    lst.push_front(1)
    lst.push_back(3)
    lst.push_front(0)
    assert list(lst) == [0, 1, 2, 3]
    assert len(lst) == 4


def test_push_front_on_empty_sets_the_tail():
    lst = LinkedList()
    lst.push_front(1)
    lst.push_back(2)
    assert list(lst) == [1, 2]


def test_pop_front_returns_values_in_order():
    lst = LinkedList([1, 2, 3])
    assert lst.pop_front() == 1
    assert lst.pop_front() == 2
    assert list(lst) == [3]
    assert len(lst) == 1


def test_pop_front_on_empty_raises():
    with pytest.raises(IndexError):
        LinkedList().pop_front()


def test_popping_the_last_node_clears_the_tail():
    lst = LinkedList([1])
    assert lst.pop_front() == 1
    assert len(lst) == 0
    lst.push_back(2)
    lst.push_back(3)
    assert list(lst) == [2, 3]


def test_pop_front_after_emptying_raises():
    lst = LinkedList([4])
    lst.pop_front()
    with pytest.raises(IndexError):
        lst.pop_front()


def test_find_returns_the_first_matching_node():
    lst = LinkedList([5, 7, 5])
    node = lst.find(5)
    assert node is not None
    assert node.value == 5
    assert node.next is not None and node.next.value == 7
    assert lst.find(9) is None
    assert 7 in lst
    assert 9 not in lst


def test_stores_falsy_values_and_none():
    lst = LinkedList([0, None, ""])
    assert len(lst) == 3
    assert None in lst
    found = lst.find(None)
    assert found is not None and found.value is None
    assert lst.remove(None) is True
    assert list(lst) == [0, ""]


def test_remove_the_head():
    lst = LinkedList([1, 2, 3])
    assert lst.remove(1) is True
    assert list(lst) == [2, 3]
    assert len(lst) == 2


def test_remove_a_middle_value():
    lst = LinkedList([1, 2, 3])
    assert lst.remove(2) is True
    assert list(lst) == [1, 3]


def test_remove_the_tail_moves_the_tail_back():
    lst = LinkedList([1, 2, 3])
    assert lst.remove(3) is True
    lst.push_back(4)
    assert list(lst) == [1, 2, 4]
    assert len(lst) == 3


def test_remove_the_only_node_empties_the_list():
    lst = LinkedList([1])
    assert lst.remove(1) is True
    assert list(lst) == []
    assert len(lst) == 0
    lst.push_back(2)
    lst.push_front(1)
    assert list(lst) == [1, 2]


def test_remove_only_the_first_duplicate():
    lst = LinkedList([4, 1, 4, 4])
    assert lst.remove(4) is True
    assert list(lst) == [1, 4, 4]


def test_remove_an_absent_value_changes_nothing():
    lst = LinkedList([1, 2, 3])
    assert lst.remove(9) is False
    assert list(lst) == [1, 2, 3]
    assert len(lst) == 3
    assert LinkedList().remove(1) is False
    lst.push_back(4)
    assert list(lst) == [1, 2, 3, 4]


@pytest.mark.parametrize("n", [0, 1, 2, 3, 5])
def test_reverse_small_lists(n):
    lst = LinkedList(range(n))
    lst.reverse()
    assert list(lst) == list(range(n))[::-1]
    assert len(lst) == n
    lst.push_back(99)
    lst.push_front(-1)
    assert list(lst) == [-1, *reversed(range(n)), 99]


def test_reverse_twice_restores_the_order():
    lst = LinkedList([1, 2, 3, 4])
    lst.reverse()
    lst.reverse()
    assert list(lst) == [1, 2, 3, 4]
    assert lst.pop_front() == 1
    lst.push_back(5)
    assert list(lst) == [2, 3, 4, 5]


OPERATIONS = ["push_front", "push_back", "pop_front", "remove", "find", "reverse"]


@pytest.mark.parametrize("seed", range(200))
def test_matches_a_python_list_on_random_operations(seed):
    rng = random.Random(seed)
    lst: LinkedList[int] = LinkedList()
    model: list[int] = []
    for _ in range(60):
        op = rng.choice(OPERATIONS)
        value = rng.randrange(6)
        if op == "push_front":
            lst.push_front(value)
            model.insert(0, value)
        elif op == "push_back":
            lst.push_back(value)
            model.append(value)
        elif op == "pop_front":
            if model:
                assert lst.pop_front() == model.pop(0)
            else:
                with pytest.raises(IndexError):
                    lst.pop_front()
        elif op == "remove":
            expected = value in model
            if expected:
                model.remove(value)
            assert lst.remove(value) is expected
        elif op == "find":
            node = lst.find(value)
            assert (node is not None) == (value in model)
            assert (value in lst) == (value in model)
        else:
            lst.reverse()
            model.reverse()
        assert list(lst) == model
        assert len(lst) == len(model)
