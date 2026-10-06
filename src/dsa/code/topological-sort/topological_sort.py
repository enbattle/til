from collections import deque

# adj[u] lists the vertices u points at, the directed form of the graph entry's list.
Graph = list[list[int]]


def topological_sort(adj: Graph) -> list[int] | None:
    """Kahn's algorithm: an order with every edge going forward, or None on a cycle."""
    in_degree = [0] * len(adj)
    for targets in adj:
        for v in targets:
            in_degree[v] += 1
    # A deque, since list.pop(0) shifts every item and would make this O(V^2).
    queue = deque(u for u in range(len(adj)) if in_degree[u] == 0)
    order: list[int] = []
    while queue:
        u = queue.popleft()
        order.append(u)
        for v in adj[u]:
            in_degree[v] -= 1
            # At 0, not 1: v is ready only when its last prerequisite is placed.
            if in_degree[v] == 0:
                queue.append(v)
    # Vertices on a cycle wait on each other and never come out; a short order is
    # not an answer.
    return order if len(order) == len(adj) else None


UNVISITED, ON_PATH, FINISHED = 0, 1, 2


def topological_sort_dfs(adj: Graph) -> list[int] | None:
    """Reverse finishing order of a depth-first search, or None on a cycle."""
    state = [UNVISITED] * len(adj)
    finished: list[int] = []

    def visit(u: int) -> bool:
        state[u] = ON_PATH
        for v in adj[u]:
            # An edge into a finished vertex is fine; only the current path is a loop.
            if state[v] == ON_PATH or (state[v] == UNVISITED and not visit(v)):
                return False
        state[u] = FINISHED
        # Appended on exit, when everything u points at is already in the list.
        finished.append(u)
        return True

    for u in range(len(adj)):
        # Every vertex is a start, since one start rarely reaches the whole graph.
        if state[u] == UNVISITED and not visit(u):
            return None
    # Finishing puts each vertex after what it points at; reverse to put it before.
    return finished[::-1]


def course_order(n: int, prerequisites: list[tuple[int, int]]) -> list[int] | None:
    """An order to take courses 0..n-1; each pair is (course, prerequisite)."""
    adj: Graph = [[] for _ in range(n)]
    for course, prerequisite in prerequisites:
        # The arrow runs from what comes first to what depends on it.
        adj[prerequisite].append(course)
    return topological_sort(adj)
