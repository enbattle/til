"""The heap entry's Python code.

API: ``parent``, ``left`` and ``right`` (index arithmetic); ``MinHeap(items=())``
with ``push``, ``pop`` and ``peek`` (both raise IndexError when empty) and
``len()``; ``PriorityQueue()`` with ``push(item, priority)``, ``pop``, ``peek``
and ``len()``, equal priorities coming out in insertion order.
"""

import heapq
import random

import pytest

from heap import MinHeap, PriorityQueue, left, parent, right


def assert_heap(h, context=""):
    """Every item is no smaller than its parent."""
    items = h._items
    for i in range(1, len(items)):
        assert not items[i] < items[parent(i)], f"{context}index {i} of {items}"


def drain(h):
    return [h.pop() for _ in range(len(h))]


def test_index_arithmetic():
    assert [left(0), right(0)] == [1, 2]
    assert [left(1), right(1)] == [3, 4]
    assert [left(2), right(2)] == [5, 6]
    for i in range(1, 100):
        assert i in (left(parent(i)), right(parent(i)))
        assert parent(left(i)) == i == parent(right(i))


def test_starts_empty():
    h = MinHeap()
    assert len(h) == 0
    assert drain(h) == []


@pytest.mark.parametrize("method", ["pop", "peek"])
def test_empty_heap_raises_index_error(method):
    with pytest.raises(IndexError):
        getattr(MinHeap(), method)()


@pytest.mark.parametrize("method", ["pop", "peek"])
def test_raises_again_after_being_drained(method):
    h = MinHeap([2, 1])
    h.pop()
    h.pop()
    with pytest.raises(IndexError):
        getattr(h, method)()


def test_one_element():
    h = MinHeap()
    h.push(7)
    assert len(h) == 1
    assert h.peek() == 7
    assert h.pop() == 7
    assert len(h) == 0
    h = MinHeap([7])
    assert h.pop() == 7
    assert len(h) == 0


def test_peek_does_not_remove():
    h = MinHeap([5, 3, 8])
    assert h.peek() == 3
    assert h.peek() == 3
    assert len(h) == 3


def test_push_keeps_the_smallest_on_top():
    h = MinHeap()
    for x, smallest in [(5, 5), (8, 5), (3, 3), (4, 3), (1, 1), (9, 1)]:
        h.push(x)
        assert h.peek() == smallest
        assert_heap(h)


def test_duplicates():
    h = MinHeap([2, 2, 1, 2, 1, 1])
    assert_heap(h)
    h.push(1)
    h.push(2)
    assert drain(h) == [1, 1, 1, 1, 2, 2, 2, 2]


def test_all_equal():
    h = MinHeap([4] * 10)
    assert drain(h) == [4] * 10


def test_already_sorted_input():
    h = MinHeap(range(20))
    assert h._items == list(range(20))
    assert drain(h) == list(range(20))


def test_reverse_sorted_input():
    h = MinHeap(range(19, -1, -1))
    assert_heap(h)
    assert drain(h) == list(range(20))


def test_does_not_change_the_input():
    data = [3, 1, 2]
    h = MinHeap(data)
    h.pop()
    assert data == [3, 1, 2]


def test_the_entrys_sift_down_example():
    h = MinHeap([1, 3, 2, 7, 4, 5, 8])
    assert h._items == [1, 3, 2, 7, 4, 5, 8]
    assert h.pop() == 1
    assert h._items == [2, 3, 5, 7, 4, 8]


def test_the_entrys_heapify_example():
    h = MinHeap([5, 4, 3, 2, 1])
    assert h._items == [1, 2, 3, 5, 4]


class Counted:
    """A number that counts how often any two of its kind are compared."""

    comparisons = 0

    def __init__(self, value):
        self.value = value

    def __lt__(self, other):
        Counted.comparisons += 1
        return self.value < other.value


@pytest.mark.parametrize("n", [15, 1000, 4097])
def test_heapify_is_linear(n):
    # Two comparisons per level, at most n levels in total, plus one stopping
    # level per sift-down: under 3n. Pushing reverse-sorted items one at a time
    # takes about n * log2(n) comparisons instead, and fails this bound.
    Counted.comparisons = 0
    h = MinHeap(Counted(v) for v in range(n, 0, -1))
    assert Counted.comparisons <= 3 * n
    assert [h.pop().value for _ in range(n)] == list(range(1, n + 1))


def test_pushing_one_at_a_time_is_not_linear():
    Counted.comparisons = 0
    h = MinHeap()
    for v in range(1000, 0, -1):
        h.push(Counted(v))
    assert Counted.comparisons > 3 * 1000


def test_works_with_tuples():
    h = MinHeap([(2, "b"), (1, "z"), (2, "a")])
    assert drain(h) == [(1, "z"), (2, "a"), (2, "b")]


def test_matches_heapq_on_random_operations():
    for seed in range(50):
        rng = random.Random(seed)
        start = [rng.randint(0, 20) for _ in range(rng.randint(0, 30))]
        h = MinHeap(start)
        ref = list(start)
        heapq.heapify(ref)
        for step in range(300):
            at = f"seed {seed}, step {step}: "
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
        assert drain(h) == sorted(ref), f"seed {seed}"


def test_heapify_then_drain_sorts():
    for seed in range(50):
        rng = random.Random(seed + 1000)
        data = [rng.randint(-50, 50) for _ in range(rng.randint(0, 200))]
        h = MinHeap(data)
        assert_heap(h, f"seed {seed}: ")
        assert drain(h) == sorted(data), f"seed {seed}, input {data}"


def test_priority_queue_lowest_priority_first():
    pq = PriorityQueue()
    pq.push("write", 3)
    pq.push("fix", 1)
    pq.push("test", 2)
    assert len(pq) == 3
    assert pq.peek() == "fix"
    assert [pq.pop() for _ in range(3)] == ["fix", "test", "write"]
    assert len(pq) == 0


def test_priority_queue_ties_come_out_in_insertion_order():
    pq = PriorityQueue()
    for name in "abcdefgh":
        pq.push(name, 5)
    pq.push("first", 1)
    assert [pq.pop() for _ in range(9)] == ["first", *"abcdefgh"]


def test_priority_queue_never_compares_items():
    class Task:
        pass  # no __lt__: comparing two Tasks raises TypeError

    pq = PriorityQueue()
    tasks = [Task() for _ in range(6)]
    for t in tasks:
        pq.push(t, 0)
    assert [pq.pop() for _ in range(6)] == tasks


@pytest.mark.parametrize("method", ["pop", "peek"])
def test_priority_queue_empty_raises(method):
    with pytest.raises(IndexError):
        getattr(PriorityQueue(), method)()


def test_priority_queue_stores_none():
    pq = PriorityQueue()
    pq.push(None, 1)
    assert pq.peek() is None
    assert pq.pop() is None


def test_priority_queue_matches_a_stable_sort():
    for seed in range(50):
        rng = random.Random(seed + 2000)
        pq = PriorityQueue()
        ref = []  # (priority, order) pairs still waiting
        for step in range(200):
            at = f"seed {seed}, step {step}"
            if rng.random() < 0.6 or not ref:
                p = rng.randint(0, 5)
                pq.push(step, p)
                ref.append((p, step))
            else:
                ref.sort(key=lambda e: e[0])  # stable: equal priorities keep their order
                assert pq.pop() == ref.pop(0)[1], at
            assert len(pq) == len(ref), at
