from collections import deque

UNVISITED, ON_PATH, FINISHED = 0, 1, 2


def all_vertices(graph: dict[int, list[int]]) -> list[int]:
    """Every vertex: the keys in order, then targets that are not keys, as met."""
    vertices = dict.fromkeys(graph)
    for targets in graph.values():
        for target in targets:
            vertices.setdefault(target)
    return list(vertices)


def topological_sort(graph: dict[int, list[int]]) -> list[int] | None:
    """Kahn's algorithm: an order with every edge going forward, or None on a cycle.

    Ties go to the vertex that became ready first; the starting ones are taken
    in `all_vertices` order.
    """
    vertices = all_vertices(graph)
    in_degree = dict.fromkeys(vertices, 0)
    for targets in graph.values():
        for target in targets:
            in_degree[target] += 1
    queue = deque(vertex for vertex in vertices if in_degree[vertex] == 0)
    order: list[int] = []
    while queue:
        vertex = queue.popleft()
        order.append(vertex)
        for target in graph.get(vertex, []):
            in_degree[target] -= 1
            if in_degree[target] == 0:
                queue.append(target)
    return order if len(order) == len(vertices) else None


def topological_sort_dfs(graph: dict[int, list[int]]) -> list[int] | None:
    """The DFS method: reverse the finishing order, or None on a cycle.

    Starts are tried in `all_vertices` order and neighbours in list order.
    """
    vertices = all_vertices(graph)
    state = dict.fromkeys(vertices, UNVISITED)
    finished: list[int] = []
    for start in vertices:
        if state[start] != UNVISITED:
            continue
        state[start] = ON_PATH
        stack = [(start, iter(graph.get(start, [])))]
        while stack:
            vertex, neighbours = stack[-1]
            for neighbour in neighbours:
                if state[neighbour] == ON_PATH:
                    return None
                if state[neighbour] == UNVISITED:
                    state[neighbour] = ON_PATH
                    stack.append((neighbour, iter(graph.get(neighbour, []))))
                    break
            else:
                state[vertex] = FINISHED
                finished.append(vertex)
                stack.pop()
    finished.reverse()
    return finished


def course_order(
    num_courses: int, prerequisites: list[tuple[int, int]]
) -> list[int] | None:
    """An order to take courses 0..num_courses-1, or None if prerequisites loop.

    Each pair is (course, prerequisite): the prerequisite comes first.
    """
    graph: dict[int, list[int]] = {course: [] for course in range(num_courses)}
    for course, prerequisite in prerequisites:
        graph[prerequisite].append(course)
    return topological_sort(graph)
