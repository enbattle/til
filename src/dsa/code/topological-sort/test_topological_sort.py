import random
from itertools import permutations

from topological_sort import (
    all_vertices,
    course_order,
    topological_sort,
    topological_sort_dfs,
)

BOTH = [topological_sort, topological_sort_dfs]


def vertex_set(graph):
    return set(graph) | {t for targets in graph.values() for t in targets}


def is_valid(graph, order):
    """Every vertex exactly once, and every edge goes from earlier to later."""
    if sorted(order) != sorted(vertex_set(graph)):
        return False
    position = {vertex: i for i, vertex in enumerate(order)}
    return all(position[u] < position[v] for u, targets in graph.items() for v in targets)


def some_order_exists(graph):
    return any(is_valid(graph, p) for p in permutations(sorted(vertex_set(graph))))


def random_graph(rng, acyclic):
    n = rng.randint(0, 6)
    ranks = list(range(n))
    rng.shuffle(ranks)
    graph = {}
    for u in range(n):
        if rng.random() < 0.15:
            continue  # not a key: it can only appear as a target, or not at all
        graph[u] = [
            v
            for v in range(n)
            if rng.random() < 0.3 and (ranks[u] < ranks[v] if acyclic else True)
        ]
    return graph


def test_empty_graph():
    for sort in BOTH:
        assert sort({}) == []


def test_single_vertex_and_isolated_vertices():
    for sort in BOTH:
        assert sort({7: []}) == [7]
    # Reversing the finishing order also reverses the order of separate starts.
    assert topological_sort({3: [], 1: [], 2: []}) == [3, 1, 2]
    assert topological_sort_dfs({3: [], 1: [], 2: []}) == [2, 1, 3]


def test_self_loop_is_a_cycle():
    for sort in BOTH:
        assert sort({1: [1]}) is None
        assert sort({0: [], 1: [1]}) is None


def test_two_cycle_and_cycle_behind_a_valid_start():
    for sort in BOTH:
        assert sort({1: [2], 2: [1]}) is None
        assert sort({0: [1], 1: [2], 2: [3], 3: [1]}) is None


def test_vertex_that_appears_only_as_a_target():
    for sort in BOTH:
        order = sort({1: [2]})
        assert order == [1, 2]
    assert all_vertices({1: [2, 3], 4: [3, 5]}) == [1, 4, 2, 3, 5]
    assert topological_sort({2: [9]}) == [2, 9]


def test_the_diamond_is_not_a_cycle():
    graph = {0: [1, 2], 1: [3], 2: [3], 3: []}
    for sort in BOTH:
        assert is_valid(graph, sort(graph))


def test_duplicate_edges_are_harmless():
    graph = {0: [1, 1], 1: [2]}
    for sort in BOTH:
        assert sort(graph) == [0, 1, 2]


def test_tie_rules_make_the_output_exact():
    graph = {0: [2, 1], 1: [3], 2: [3], 3: []}
    assert topological_sort(graph) == [0, 2, 1, 3]
    assert topological_sort_dfs(graph) == [0, 1, 2, 3]
    # Two valid orders for the same graph, so the tie rule is what picks one.
    assert is_valid(graph, [0, 2, 1, 3]) and is_valid(graph, [0, 1, 2, 3])


def test_many_orders_are_valid():
    graph = {0: [], 1: [], 2: []}
    assert all(is_valid(graph, list(p)) for p in permutations([0, 1, 2]))


def test_long_chain_does_not_hit_the_recursion_limit():
    n = 50_000
    graph = {i: [i + 1] for i in range(n)}
    expected = list(range(n + 1))
    assert topological_sort(graph) == expected
    assert topological_sort_dfs(graph) == expected


def test_agree_with_brute_force_on_random_graphs():
    rng = random.Random(2024)
    seen_cycle = seen_order = False
    for i in range(600):
        graph = random_graph(rng, acyclic=i % 2 == 0)
        exists = some_order_exists(graph)
        for sort in BOTH:
            order = sort(graph)
            if exists:
                assert order is not None and is_valid(graph, order), (graph, order)
            else:
                assert order is None, (graph, order)
        seen_order |= exists
        seen_cycle |= not exists
    assert seen_order and seen_cycle


def test_acyclic_random_graphs_always_sort():
    rng = random.Random(7)
    for _ in range(300):
        graph = random_graph(rng, acyclic=True)
        for sort in BOTH:
            order = sort(graph)
            assert order is not None and is_valid(graph, order)


def test_course_order():
    assert course_order(0, []) == []
    assert course_order(3, []) == [0, 1, 2]
    assert course_order(2, [(1, 0)]) == [0, 1]
    assert course_order(2, [(1, 0), (0, 1)]) is None
    assert course_order(1, [(0, 0)]) is None
    order = course_order(4, [(1, 0), (2, 0), (3, 1), (3, 2)])
    assert order == [0, 1, 2, 3]


def test_course_order_random_pairs_are_valid_or_cyclic():
    rng = random.Random(99)
    for _ in range(300):
        n = rng.randint(0, 6)
        pairs = [
            (rng.randrange(n), rng.randrange(n))
            for _ in range(rng.randint(0, 8) if n else 0)
        ]
        graph = {c: [] for c in range(n)}
        for course, prerequisite in pairs:
            graph[prerequisite].append(course)
        order = course_order(n, pairs)
        if some_order_exists(graph):
            assert order is not None and is_valid(graph, order)
        else:
            assert order is None
