"""The queue entry's Python code.

API: ``Deque(capacity=8)`` with ``append``, ``appendleft``, ``pop``,
``popleft``, ``peek``, ``peekleft`` (each of the last four raises IndexError
when empty), ``len()``, iteration front to back and a ``capacity`` property;
and ``recent_counts(times, window)``.
"""

import collections
import gc
import random
import weakref

import pytest

from queue_and_deque import Deque, recent_counts


def test_starts_empty_with_the_given_capacity():
    d = Deque(4)
    assert len(d) == 0
    assert d.capacity == 4
    assert list(d) == []


def test_defaults_to_a_positive_capacity():
    assert Deque().capacity > 0


@pytest.mark.parametrize("capacity", [0, -1])
def test_rejects_a_capacity_below_one(capacity):
    with pytest.raises(ValueError):
        Deque(capacity)


@pytest.mark.parametrize("method", ["pop", "popleft", "peek", "peekleft"])
def test_empty_deque_raises_index_error(method):
    d = Deque()
    with pytest.raises(IndexError):
        getattr(d, method)()


@pytest.mark.parametrize("method", ["pop", "popleft", "peek", "peekleft"])
def test_raises_again_after_being_drained(method):
    d = Deque(2)
    d.append(1)
    d.appendleft(0)
    d.pop()
    d.popleft()
    assert len(d) == 0
    with pytest.raises(IndexError):
        getattr(d, method)()


def test_one_element_is_both_ends():
    d = Deque()
    d.append("x")
    assert d.peek() == "x"
    assert d.peekleft() == "x"
    assert d.popleft() == "x"
    assert len(d) == 0
    d.appendleft("y")
    assert d.peek() == "y"
    assert d.pop() == "y"
    assert len(d) == 0


def test_fifo_from_opposite_ends():
    d = Deque()
    for i in range(5):
        d.append(i)
    assert [d.popleft() for _ in range(5)] == [0, 1, 2, 3, 4]


def test_lifo_from_the_same_end():
    d = Deque()
    for i in range(5):
        d.append(i)
    assert [d.pop() for _ in range(5)] == [4, 3, 2, 1, 0]
    for i in range(5):
        d.appendleft(i)
    assert [d.popleft() for _ in range(5)] == [4, 3, 2, 1, 0]


def test_peek_does_not_remove():
    d = Deque()
    d.append(1)
    d.append(2)
    assert d.peekleft() == 1
    assert d.peek() == 2
    assert len(d) == 2
    assert list(d) == [1, 2]


def test_stores_none_and_falsy_values():
    d = Deque()
    d.append(None)
    d.append(0)
    d.appendleft("")
    assert len(d) == 3
    assert list(d) == ["", None, 0]
    assert d.pop() == 0
    assert d.pop() is None
    assert d.pop() == ""


def test_wraps_around_at_the_back_without_growing():
    d = Deque(4)
    for i in range(4):
        d.append(i)
    assert d.popleft() == 0
    assert d.popleft() == 1
    d.append(4)  # slot 0
    d.append(5)  # slot 1
    assert d.capacity == 4
    assert list(d) == [2, 3, 4, 5]
    assert d.peek() == 5
    assert d.peekleft() == 2
    assert d.pop() == 5
    assert d.pop() == 4
    assert d.pop() == 3


def test_wraps_around_at_the_front_without_growing():
    d = Deque(4)
    d.appendleft(1)  # slot 3
    d.appendleft(0)  # slot 2
    d.append(2)  # slot 0
    assert d.capacity == 4
    assert list(d) == [0, 1, 2]
    assert d.peekleft() == 0
    assert d.popleft() == 0
    assert d.popleft() == 1
    assert d.popleft() == 2


def test_the_entrys_worked_example():
    d = Deque(4)
    for i in (1, 2, 3):
        d.append(i)
    assert d.popleft() == 1
    assert d.popleft() == 2
    d.append(4)
    d.append(5)
    d.appendleft(0)
    assert d.capacity == 4
    assert list(d) == [0, 3, 4, 5]
    d.append(6)
    assert d.capacity == 8
    assert list(d) == [0, 3, 4, 5, 6]


def test_grows_while_wrapped_at_the_back():
    d = Deque(4)
    for i in range(4):
        d.append(i)
    d.popleft()
    d.popleft()
    d.append(4)
    d.append(5)  # full, and the items wrap past the end
    d.append(6)
    assert d.capacity == 8
    assert list(d) == [2, 3, 4, 5, 6]
    assert [d.popleft() for _ in range(5)] == [2, 3, 4, 5, 6]


def test_grows_while_wrapped_from_a_push_at_the_front():
    d = Deque(4)
    d.append(2)
    d.append(3)
    d.appendleft(1)
    d.appendleft(0)  # full, head at slot 2
    d.appendleft(-1)
    assert d.capacity == 8
    assert list(d) == [-1, 0, 1, 2, 3]
    assert [d.pop() for _ in range(5)] == [3, 2, 1, 0, -1]


def test_growth_keeps_every_item_in_order():
    d = Deque(1)
    for i in range(100):
        if i % 2:
            d.append(i)
        else:
            d.appendleft(i)
    assert len(d) == 100
    assert d.capacity == 128
    expected = list(range(98, -1, -2)) + list(range(1, 100, 2))
    assert list(d) == expected


def test_popped_items_are_released():
    class Item:
        pass

    d = Deque()
    for pop in ("pop", "popleft"):
        item = Item()
        ref = weakref.ref(item)
        d.append(item)
        del item
        getattr(d, pop)()
        gc.collect()
        assert ref() is None


def test_matches_collections_deque_on_random_operations():
    for seed in range(50):
        rng = random.Random(seed)
        d = Deque(rng.randint(1, 4))
        ref = collections.deque()
        for step in range(300):
            at = f"seed {seed}, step {step}"
            op = rng.choice(["append", "appendleft", "pop", "popleft", "peek", "peekleft"])
            if op in ("append", "appendleft"):
                getattr(d, op)(step)
                getattr(ref, op)(step)
            elif not ref:
                with pytest.raises(IndexError):
                    getattr(d, op)()
            elif op == "peek":
                assert d.peek() == ref[-1], at
            elif op == "peekleft":
                assert d.peekleft() == ref[0], at
            else:
                assert getattr(d, op)() == getattr(ref, op)(), at
            assert len(d) == len(ref), at
            assert d.capacity >= len(d), at
        assert list(d) == list(ref), f"seed {seed}"


def test_recent_counts_worked_example():
    assert recent_counts([1, 100, 3001, 3002], 3000) == [1, 2, 3, 3]


def test_recent_counts_edge_cases():
    assert recent_counts([], 10) == []
    assert recent_counts([5], 10) == [1]
    assert recent_counts([5, 5, 5], 0) == [1, 2, 3]
    assert recent_counts([0, 10, 11], 10) == [1, 2, 2]


def test_recent_counts_matches_brute_force():
    for seed in range(50):
        rng = random.Random(seed)
        times = sorted(rng.randint(0, 200) for _ in range(rng.randint(0, 60)))
        window = rng.randint(0, 50)
        expected = [
            sum(1 for s in times[: i + 1] if s >= t - window) for i, t in enumerate(times)
        ]
        assert recent_counts(times, window) == expected, f"seed {seed}: {(times, window)}"
