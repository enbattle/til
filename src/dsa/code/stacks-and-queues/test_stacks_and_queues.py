"""Tests for stacks_and_queues.

API: ``Deque(capacity=4)`` with ``append``, ``pop``,
``popleft``, ``peek``, ``peekleft`` (the last four raise IndexError when
empty), and ``len()``; ``is_balanced(text)``; and
``window_max(nums, k)``.
"""

import collections
import random

import pytest

from stacks_and_queues import Deque, is_balanced, window_max

def drain(d: Deque) -> list:
    out = []
    while len(d):
        out.append(d.popleft())
    return out

def test_empty_deque_raises_on_every_read():
    d = Deque()
    for method in (d.pop, d.popleft, d.peek, d.peekleft):
        with pytest.raises(IndexError):
            method()

def test_one_item_is_both_ends_and_can_be_none():
    d = Deque()
    d.append(None)
    assert len(d) == 1
    assert d.peek() is None and d.peekleft() is None
    assert d.popleft() is None
    assert len(d) == 0
    with pytest.raises(IndexError):
        d.pop()

def test_fifo_and_lifo_from_the_ends():
    d = Deque()
    for i in range(3):
        d.append(i)
    assert [d.peekleft(), d.peek()] == [0, 2]
    assert d.pop() == 2
    assert drain(d) == [0, 1]

def test_wraps_around_without_growing():
    d = Deque(4)
    for i in range(4):
        d.append(i)
    d.popleft()
    d.popleft()
    d.append(4)
    d.append(5)  # lands in slot 0, behind the front
    assert len(d._slots) == 4
    assert drain(d) == [2, 3, 4, 5]

def test_capacity_floor_is_one():
    d = Deque(0)
    d.append("a")
    d.append("b")
    assert drain(d) == ["a", "b"]

def test_growing_a_wrapped_ring_keeps_the_order():
    d = Deque(4)
    for i in range(4):
        d.append(i)
    d.popleft()
    d.append(4)  # the ring is full and wrapped
    d.append(5)  # forces a grow from the wrapped state
    assert len(d._slots) == 8
    assert drain(d) == [1, 2, 3, 4, 5]

def test_mechanism_a_steady_queue_reuses_its_slots():
    # A deque that never wrapped would have to grow; this one reuses 4 slots.
    d = Deque(4)
    slots = d._slots
    d.append(0)
    for i in range(1, 1000):
        d.append(i)
        assert d.popleft() == i - 1
    assert len(d._slots) == 4
    assert d._slots is slots  # popleft moved the head; nothing was reallocated

def test_mechanism_capacity_doubles_and_stays_proportional():
    d = Deque(1)
    sizes = {len(d._slots)}
    for i in range(1000):
        d.append(i)
        assert len(d._slots) < 2 * len(d) + 1
        sizes.add(len(d._slots))
    assert sizes == {1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024}

def test_popped_slots_do_not_keep_items_alive():
    d = Deque(4)
    d.append(object())
    d.append(object())
    d.popleft()
    d.pop()
    assert all(slot is None for slot in d._slots)

def test_matches_collections_deque_on_random_operations():
    for seed in range(50):
        rng = random.Random(seed)
        mine, real = Deque(2), collections.deque()
        for step in range(200):
            op = rng.choice(["a", "a", "p", "pl"])
            where = f"seed={seed} step={step} op={op}"
            if op == "a":
                mine.append(step)
                real.append(step)
            elif real:
                assert (mine.pop() if op == "p" else mine.popleft()) == (
                    real.pop() if op == "p" else real.popleft()
                ), where
            assert len(mine) == len(real), where
            if real:
                assert (mine.peekleft(), mine.peek()) == (real[0], real[-1]), where

@pytest.mark.parametrize(
    "text",
    ["", "()", "([]{})", "a(b)c", "{[()()]}"],
)
def test_balanced(text):
    assert is_balanced(text)

@pytest.mark.parametrize("text", ["(", ")", "(]", "([)]", "(()", "())", "}{"])
def test_not_balanced(text):
    assert not is_balanced(text)

def test_balanced_matches_repeated_pair_removal():
    def by_removal(text: str) -> bool:
        while True:
            shorter = text.replace("()", "").replace("[]", "").replace("{}", "")
            if shorter == text:
                return text == ""
            text = shorter

    rng = random.Random(7)
    for trial in range(50):
        text = "".join(rng.choice("()[]{}") for _ in range(rng.randint(0, 10)))
        assert is_balanced(text) == by_removal(text), f"seed=7 trial={trial} {text!r}"

def test_window_max_on_the_entry_example():
    assert window_max([1, 3, -1, -3, 5, 3, 6, 7], 3) == [3, 3, 5, 5, 6, 7]

def test_window_max_edges():
    assert window_max([], 3) == []
    assert window_max([5], 1) == [5]
    assert window_max([1, 2], 3) == []
    assert window_max([4, 4, 4, 4], 2) == [4, 4, 4]
    assert window_max([1, 2, 3, 4], 4) == [4]
    assert window_max([3, 2, 1], 1) == [3, 2, 1]
    with pytest.raises(ValueError):
        window_max([1], 0)

def test_window_max_matches_brute_force():
    rng = random.Random(11)
    for trial in range(50):
        nums = [rng.randint(-5, 5) for _ in range(rng.randint(0, 15))]
        k = rng.randint(1, 6)
        want = [max(nums[i : i + k]) for i in range(len(nums) - k + 1)]
        assert window_max(nums, k) == want, f"seed=11 trial={trial} {nums} k={k}"

def test_mechanism_window_max_touches_each_item_a_constant_number_of_times():
    class Counting(Deque):
        ops = 0
        appends = 0

        def append(self, item):
            Counting.ops += 1
            Counting.appends += 1
            super().append(item)

        def pop(self):
            Counting.ops += 1
            return super().pop()

        def popleft(self):
            Counting.ops += 1
            return super().popleft()

    import stacks_and_queues

    original = stacks_and_queues.Deque
    stacks_and_queues.Deque = Counting
    try:
        n = 2000
        window_max(list(range(n, 0, -1)), 500)  # descending: nothing pops
        window_max(list(range(n)), 500)  # ascending: every item pops the last
    finally:
        stacks_and_queues.Deque = original
    # Each item is appended once and leaves at most once: under 3 ops each.
    assert Counting.ops < 2 * 3 * n
    # And every index really goes through the deque: a brute-force max over
    # slices would make no appends at all.
    assert Counting.appends == 2 * n

def test_mechanism_popleft_writes_one_slot():
    # A front pop that shifted items would rewrite every slot; a ring writes one.
    d = Deque(1024)
    for i in range(1000):
        d.append(i)
    before = list(d._slots)
    d.popleft()
    assert sum(a is not b for a, b in zip(before, d._slots)) == 1
