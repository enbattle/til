"""Tests for fast_slow_pointers: middle node, cycle detection, cycle start.

Lists are built by ``build(n, cycle_to)``: n nodes with values 0..n-1, whose last
node links back to node ``cycle_to`` (or ends the list when it is None).
"""

import random

from fast_slow_pointers import ListNode, cycle_start, has_cycle, middle_node


def build(n: int, cycle_to: int | None = None) -> list[ListNode]:
    nodes = [ListNode(i) for i in range(n)]
    for a, b in zip(nodes, nodes[1:]):
        a.next = b
    if nodes and cycle_to is not None:
        nodes[-1].next = nodes[cycle_to]
    return nodes


def head_of(nodes: list[ListNode]) -> ListNode | None:
    return nodes[0] if nodes else None


def reference_cycle_start(head: ListNode | None) -> ListNode | None:
    seen: set[int] = set()
    node = head
    while node is not None:
        if id(node) in seen:
            return node
        seen.add(id(node))
        node = node.next
    return None


def test_middle_of_odd_and_even_lists():
    assert middle_node(head_of(build(5))).val == 2
    assert middle_node(head_of(build(4))).val == 2
    assert middle_node(head_of(build(2))).val == 1


def test_middle_of_empty_and_single():
    assert middle_node(None) is None
    nodes = build(1)
    assert middle_node(nodes[0]) is nodes[0]


def test_no_cycle():
    assert not has_cycle(None)
    assert cycle_start(None) is None
    for n in range(1, 8):
        head = head_of(build(n))
        assert not has_cycle(head)
        assert cycle_start(head) is None


def test_self_loop_on_a_single_node():
    nodes = build(1, 0)
    assert has_cycle(nodes[0])
    assert cycle_start(nodes[0]) is nodes[0]


def test_cycle_through_the_whole_list():
    nodes = build(5, 0)
    assert has_cycle(nodes[0])
    assert cycle_start(nodes[0]) is nodes[0]


def test_cycle_only_at_the_last_node():
    nodes = build(6, 5)
    assert cycle_start(nodes[0]) is nodes[5]


def test_worked_example_from_the_entry():
    nodes = build(7, 2)
    assert has_cycle(nodes[0])
    assert cycle_start(nodes[0]) is nodes[2]


def test_two_node_cycle_after_a_tail():
    nodes = build(4, 2)
    assert cycle_start(nodes[0]) is nodes[2]


def test_every_cycle_position_in_every_length():
    for n in range(1, 12):
        for k in range(n):
            nodes = build(n, k)
            assert has_cycle(nodes[0])
            assert cycle_start(nodes[0]) is nodes[k]


def test_agrees_with_a_visited_set_on_random_lists():
    rng = random.Random(11)
    for _ in range(500):
        n = rng.randint(0, 15)
        cycle_to = rng.randrange(n) if n and rng.random() < 0.6 else None
        nodes = build(n, cycle_to)
        head = head_of(nodes)
        expected = reference_cycle_start(head)
        assert cycle_start(head) is expected
        assert has_cycle(head) == (expected is not None)
        if cycle_to is None:
            assert middle_node(head) is (nodes[n // 2] if n else None)
