"""Tests for the heap entry's Python code.

API: ``MinHeap(items=())`` with ``push``, ``pop`` and ``peek`` (both raise
IndexError when empty) and ``len()``. It orders items with ``<`` alone.
"""

import heapq
import random
from itertools import count

import pytest

from heap import MinHeap


def assert_heap(h, context=""):
    """Every item is no smaller than its parent."""
    items = h._items
    for i in range(1, len(items)):
        assert not items[i] < items[(i - 1) // 2], f"{context}index {i} of {items}"


def drain(h):
    return [h.pop() for _ in range(len(h))]


class Counted:
    """A number that counts how often any two of its kind are compared."""

    comparisons = 0

    def __init__(self, value):
        self.value = value

    def __lt__(self, other):
        Counted.comparisons += 1
        return self.value < other.value


def test_starts_empty():
    h = MinHeap()
    assert len(h) == 0
    assert drain(h) == []


@pytest.mark.parametrize("method", ["pop", "peek"])
def test_empty_heap_raises_index_error(method):
    with pytest.raises(IndexError):
        getattr(MinHeap(), method)()
    h = MinHeap([2, 1])
    drain(h)
    with pytest.raises(IndexError):
        getattr(h, method)()


def test_one_item():
    h = MinHeap()
    h.push(7)
    assert (len(h), h.peek(), h.pop(), len(h)) == (1, 7, 7, 0)
    h = MinHeap([7])
    assert (h.pop(), len(h)) == (7, 0)


def test_peek_does_not_remove():
    h = MinHeap([5, 3, 8])
    assert (h.peek(), h.peek(), len(h)) == (3, 3, 3)


def test_the_smallest_stays_on_top_as_items_are_pushed():
    h = MinHeap()
    for x, smallest in [(5, 5), (8, 5), (3, 3), (4, 3), (1, 1), (9, 1)]:
        h.push(x)
        assert h.peek() == smallest
        assert_heap(h)


def test_duplicates_and_large_ints():
    big = [int("1000") for _ in range(3)]
    h = MinHeap([*big, 2, 2, 1, *big, 1])
    assert_heap(h)
    h.push(int("1000"))
    h.push(2)
    assert drain(h) == [1, 1, 2, 2, 2, 1000, 1000, 1000, 1000, 1000, 1000, 1000]
    assert drain(MinHeap([4] * 10)) == [4] * 10


def test_sorted_and_reverse_sorted_input():
    assert MinHeap(range(20))._items == list(range(20))
    h = MinHeap(range(19, -1, -1))
    assert_heap(h)
    assert drain(h) == list(range(20))


def test_does_not_change_the_input():
    data = [3, 1, 2]
    MinHeap(data).pop()
    assert data == [3, 1, 2]


def test_works_with_tuples():
    h = MinHeap([(2, "b"), (1, "z"), (2, "a")])
    assert drain(h) == [(1, "z"), (2, "a"), (2, "b")]


def test_the_entrys_running_example():
    h = MinHeap([7, 6, 5, 4, 3, 2, 1])
    assert h._items == [1, 3, 2, 4, 6, 7, 5]
    assert h.pop() == 1
    assert h._items == [2, 3, 5, 4, 6, 7]
    h.push(1)
    assert h._items == [1, 3, 2, 4, 6, 7, 5]


def test_pop_from_a_pair_and_a_triple():
    assert MinHeap([2, 1])._items == [1, 2]
    h = MinHeap([1, 2, 3])
    assert (h.pop(), h._items) == (1, [2, 3])


@pytest.mark.parametrize("n", [7, 1000, 4097])
def test_heapify_takes_under_two_comparisons_per_item(n):
    # Reverse-sorted input is the worst case. Pushing it one item at a time
    # takes about n log2(n) comparisons, and sorting it first leaves a
    # different layout, so neither passes both checks here.
    Counted.comparisons = 0
    h = MinHeap(Counted(v) for v in range(n, 0, -1))
    assert Counted.comparisons < 2 * n
    assert_heap(h)
    assert [h.pop().value for _ in range(n)] == list(range(1, n + 1))


def test_pushing_one_at_a_time_takes_more():
    Counted.comparisons = 0
    h = MinHeap()
    for v in range(1000, 0, -1):
        h.push(Counted(v))
    assert Counted.comparisons > 2 * 1000


def test_each_push_and_pop_touches_one_path():
    # 1,023 items are 10 levels deep. A push compares once per level it climbs
    # (10 at most), a pop twice per level it falls. A scan would take about 1,000.
    h = MinHeap(Counted(v) for v in range(1, 1024))
    Counted.comparisons = 0
    h.push(Counted(0))
    assert Counted.comparisons <= 10
    assert len(h._items) == 1024
    Counted.comparisons = 0
    assert h.pop().value == 0
    assert Counted.comparisons <= 20
    assert len(h._items) == 1023


def test_equal_priorities_tie_break_with_a_counter():
    class Task:
        pass  # no __lt__: comparing two Tasks would raise TypeError

    order = count()
    tasks = [Task() for _ in range(6)]
    h = MinHeap((0, next(order), t) for t in tasks)
    h.push((0, next(order), extra := Task()))
    assert [item for _, _, item in drain(h)] == [*tasks, extra]


def test_matches_heapq_on_random_operations():
    seed = 1
    rng = random.Random(seed)
    for trial in range(50):
        start = [rng.randint(0, 20) for _ in range(rng.randint(0, 30))]
        h = MinHeap(start)
        ref = list(start)
        heapq.heapify(ref)
        for step in range(100):
            at = f"seed {seed}, trial {trial}, step {step}: "
            op = rng.choice(["push", "push", "pop", "peek"])
            if op == "push":
                x = rng.randint(0, 20)
                h.push(x)
                heapq.heappush(ref, x)
            elif not ref:
                with pytest.raises(IndexError):
                    getattr(h, op)()
            elif op == "pop":
                assert h.pop() == heapq.heappop(ref), at
            else:
                assert h.peek() == ref[0], at
            assert len(h) == len(ref), at
            assert_heap(h, at)
        assert drain(h) == sorted(ref), f"seed {seed}, trial {trial}"


def test_heapify_then_drain_sorts():
    seed = 2
    rng = random.Random(seed)
    for trial in range(50):
        data = [rng.randint(-50, 50) for _ in range(rng.randint(0, 200))]
        h = MinHeap(data)
        assert_heap(h, f"seed {seed}, trial {trial}: ")
        assert drain(h) == sorted(data), f"seed {seed}, trial {trial}: {data}"
