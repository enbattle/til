"""Tests for the linked-list entry's Python code.

API: ``LinkedList()`` with ``head`` and ``tail`` (nodes or None), ``push_front``,
``push_back``, ``pop_front`` (raises IndexError when empty), ``remove`` (the
first occurrence; returns whether it was there), ``reverse`` (in place) and
iteration over the values from head to tail.
"""

import random

import pytest

from linked_list import LinkedList

def build(values):
    lst = LinkedList()
    for value in values:
        lst.push_back(value)
    return lst

def nodes(lst):
    out = []
    node = lst.head
    while node is not None:
        out.append(node)
        node = node.next
    return out

def assert_consistent(lst, model, message=""):
    assert list(lst) == model, message
    chain = nodes(lst)
    if model:
        assert lst.tail is chain[-1], message
        assert lst.tail.next is None, message
    else:
        assert lst.head is None and lst.tail is None, message

def test_empty_list():
    lst = LinkedList()
    assert list(lst) == []
    assert lst.head is None and lst.tail is None
    with pytest.raises(IndexError):
        lst.pop_front()
    assert lst.remove(1) is False
    lst.reverse()
    assert_consistent(lst, [])

def test_one_node_is_both_ends():
    for make in (lambda x: x.push_back(5), lambda x: x.push_front(5)):
        lst = LinkedList()
        make(lst)
        assert lst.head is lst.tail
        assert_consistent(lst, [5])

def test_push_front_and_back_order():
    lst = build([1, 2, 3])
    lst.push_front(0)
    lst.push_back(4)
    assert_consistent(lst, [0, 1, 2, 3, 4])

def test_pop_front_to_empty_then_push_back():
    lst = build([1, 2])
    assert lst.pop_front() == 1
    assert lst.pop_front() == 2
    assert_consistent(lst, [])
    lst.push_back(9)
    assert_consistent(lst, [9])

def test_remove_head_middle_tail_only_and_missing():
    lst = build([1, 2, 3])
    assert lst.remove(3) is True
    lst.push_back(4)
    assert_consistent(lst, [1, 2, 4])
    assert lst.remove(1) is True
    assert_consistent(lst, [2, 4])
    assert lst.remove(7) is False
    assert lst.remove(2) is True
    assert lst.remove(4) is True
    assert_consistent(lst, [])
    lst.push_front(8)
    assert_consistent(lst, [8])

def test_remove_takes_only_the_first_duplicate():
    lst = build([2, 1, 2, 2])
    assert lst.remove(2) is True
    assert_consistent(lst, [1, 2, 2])

def test_reverse_cases():
    for values in ([], [1], [1, 2], [1, 2, 3, 4]):
        lst = build(values)
        lst.reverse()
        assert_consistent(lst, values[::-1], str(values))
    lst = build([0, 1, 2])
    lst.reverse()
    lst.push_back(99)
    assert_consistent(lst, [2, 1, 0, 99])

def test_push_back_uses_the_tail_not_a_walk():
    # Cut the chain after the head without touching the tail. A push_back that
    # walked from head would attach to the head; the tail pointer attaches
    # after the old last node.
    lst = build([1, 2, 3])
    lst.head.next = None
    lst.push_back(4)
    assert lst.head.next is None
    assert lst.tail.value == 4

def test_reverse_flips_arrows_without_copying_nodes():
    lst = build(range(6))
    before = nodes(lst)
    lst.reverse()
    assert [id(n) for n in nodes(lst)] == [id(n) for n in reversed(before)]

def test_remove_compares_values_not_identity():
    # 1000 is outside CPython's small-int cache, so int("1000") is a distinct
    # object with an equal value: `is not` in remove would miss it.
    lst = build([1000, 2000])
    assert lst.remove(int("1000")) is True
    assert list(lst) == [2000]

def test_random_operations_match_a_python_list():
    seed = 11
    rng = random.Random(seed)
    for trial in range(50):
        lst = LinkedList()
        model: list[int] = []
        for step in range(30):
            op = rng.choice(["front", "back", "pop", "remove", "reverse"])
            value = rng.randint(0, 5)
            if op == "front":
                lst.push_front(value)
                model.insert(0, value)
            elif op == "back":
                lst.push_back(value)
                model.append(value)
            elif op == "pop" and model:
                msg = f"seed={seed} trial={trial} step={step}"
                assert lst.pop_front() == model.pop(0), msg
            elif op == "remove":
                had = value in model
                msg = f"seed={seed} trial={trial} step={step}"
                assert lst.remove(value) is had, msg
                if had:
                    model.remove(value)
            elif op == "reverse":
                lst.reverse()
                model.reverse()
            assert_consistent(lst, model, f"seed={seed} trial={trial} step={step}")
