"""Tests for the two-pointers entry's Python code.

API: ``pair_with_sum(nums, target)`` returns indices ``(i, j)``, ``i < j``, of
two values in sorted ``nums`` that add up to ``target``, or None;
``has_cycle(head)`` says whether a ``ListNode`` chain loops back on itself.
"""

import random
from itertools import combinations

from two_pointers import ListNode, has_cycle, pair_with_sum


def chain(values, loop_to=None):
    """A list of nodes holding values; the last links to nodes[loop_to]."""
    nodes = [ListNode(v) for v in values]
    for a, b in zip(nodes, nodes[1:]):
        a.next = b
    if loop_to is not None:
        nodes[-1].next = nodes[loop_to]
    return nodes


class CountingList(list):
    """A list that counts reads by index."""

    def __init__(self, items):
        super().__init__(items)
        self.reads = 0

    def __getitem__(self, index):
        self.reads += 1
        return super().__getitem__(index)


class CountingNode(ListNode):
    """A node that counts how often its next link is followed."""

    follows = 0

    def __getattribute__(self, name):
        if name == "next":
            CountingNode.follows += 1
        return super().__getattribute__(name)


class SameValueNode(ListNode):
    """Nodes that compare equal by value, so == would confuse distinct nodes."""

    def __eq__(self, other):
        return isinstance(other, ListNode) and self.val == other.val

    __hash__ = None  # type: ignore[assignment]


def has_pair(nums, target):
    return any(a + b == target for a, b in combinations(nums, 2))


def test_running_example():
    nums = [1, 3, 4, 6, 8, 11]
    assert pair_with_sum(nums, 10) == (2, 3)
    assert pair_with_sum(nums, 12) == (0, 5)
    assert pair_with_sum(nums, 100) is None


def test_empty_and_single_element_have_no_pair():
    assert pair_with_sum([], 0) is None
    assert pair_with_sum([3], 6) is None
    assert pair_with_sum([3], 3) is None


def test_two_elements():
    assert pair_with_sum([1, 2], 3) == (0, 1)
    assert pair_with_sum([1, 2], 4) is None


def test_duplicates_pair_two_different_positions():
    assert pair_with_sum([2, 2], 4) == (0, 1)
    assert pair_with_sum([1, 2, 2, 5], 4) == (1, 2)
    assert pair_with_sum([2, 3], 4) is None


def test_negative_numbers_and_zero():
    assert pair_with_sum([-5, -2, 0, 3, 7], 5) == (1, 4)
    assert pair_with_sum([-3, 0, 3], 0) == (0, 2)


def test_pair_with_sum_matches_brute_force():
    seed = 11
    rng = random.Random(seed)
    for trial in range(50):
        nums = sorted(rng.randint(-8, 8) for _ in range(rng.randint(0, 9)))
        target = rng.randint(-12, 12)
        got = pair_with_sum(nums, target)
        where = f"seed {seed}, trial {trial}: {nums} target {target} -> {got}"
        if has_pair(nums, target):
            assert got is not None, where
            i, j = got
            assert 0 <= i < j < len(nums), where
            assert nums[i] + nums[j] == target, where
        else:
            assert got is None, where


def test_pair_with_sum_reads_each_pointer_move_once():
    # A target no pair reaches moves left up every pass: n - 1 passes, two
    # reads each. Trying every pair would read about n * n times.
    nums = CountingList(range(1000))
    assert pair_with_sum(nums, 10**6) is None
    assert nums.reads == 2 * 999, f"reads={nums.reads}"


def test_pair_with_sum_discards_one_element_per_pass_from_either_end():
    nums = CountingList(range(1000))
    assert pair_with_sum(nums, -1) is None
    assert nums.reads == 2 * 999, f"reads={nums.reads}"


def test_has_cycle_small_cases():
    assert not has_cycle(None)
    assert not has_cycle(chain([1])[0])
    assert has_cycle(chain([1], loop_to=0)[0])
    assert not has_cycle(chain([1, 2])[0])
    assert has_cycle(chain([1, 2], loop_to=0)[0])
    assert has_cycle(chain([1, 2], loop_to=1)[0])


def test_has_cycle_running_example():
    # Seven nodes, the last linking back to node 2: a tail of 2, a cycle of 5.
    assert has_cycle(chain(range(7), loop_to=2)[0])
    assert not has_cycle(chain(range(7))[0])


def test_has_cycle_odd_and_even_lengths_without_a_cycle():
    for n in range(1, 12):
        assert not has_cycle(chain(range(n))[0]), n


def test_has_cycle_whole_list_is_the_cycle():
    for n in range(1, 12):
        assert has_cycle(chain(range(n), loop_to=0)[0]), n


def test_has_cycle_compares_nodes_not_values():
    big = int("1000")
    same = [SameValueNode(big) for _ in range(5)]
    for a, b in zip(same, same[1:]):
        a.next = b
    assert not has_cycle(same[0])
    same[-1].next = same[1]
    assert has_cycle(same[0])


def test_has_cycle_matches_walking_with_a_visited_set():
    seed = 12
    rng = random.Random(seed)
    for trial in range(50):
        n = rng.randint(1, 14)
        loop_to = rng.choice([None, *range(n)])
        head = chain([rng.randint(0, 2) for _ in range(n)], loop_to)[0]
        got = has_cycle(head)
        assert got == (loop_to is not None), f"seed {seed}, trial {trial}: {n} {loop_to}"


def test_has_cycle_needs_no_hashing_and_stays_linear():
    # A visited-set version hashes every node; this one never should.
    class Unhashable(ListNode):
        __hash__ = None  # type: ignore[assignment]

    nodes = [Unhashable(i) for i in range(50)]
    for a, b in zip(nodes, nodes[1:]):
        a.next = b
    nodes[-1].next = nodes[10]
    assert has_cycle(nodes[0])
    nodes[-1].next = None
    assert not has_cycle(nodes[0])

    # A tail of 1 and a cycle of n - 1: slow and fast meet on step n - 1, and
    # each step follows at least 3 links (fast.next twice over, slow.next).
    # A one-pass visited set follows at most 2 per node, 2n + 2 in all.
    n = 1000
    nodes = [CountingNode(i) for i in range(n)]
    for a, b in zip(nodes, nodes[1:]):
        a.next = b
    nodes[-1].next = nodes[1]
    CountingNode.follows = 0
    assert has_cycle(nodes[0])
    follows = CountingNode.follows
    assert 3 * (n - 1) <= follows <= 6 * n, f"follows={follows}"
