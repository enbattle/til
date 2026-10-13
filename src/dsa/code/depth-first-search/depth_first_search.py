# region components
# adj[u] lists the neighbors of u, the shape the graph entry's build_list returns.
Graph = list[list[int]]


def explore(adj: Graph, start: int, seen: set[int]) -> None:
    """Mark every vertex reachable from start, with a stack that lives on the heap."""
    stack = [start]
    while len(stack) > 0:
        u = stack.pop()
        # Marked on pop, so the order is truly depth-first. A vertex can be
        # pushed by several neighbors first; skip repeats or it is scanned twice.
        if u in seen:
            continue
        seen.add(u)
        # Reversed, so the first neighbor is popped first, as in recursion.
        for v in reversed(adj[u]):
            if v not in seen:
                stack.append(v)


def count_components(adj: Graph) -> int:
    """Groups of vertices that can reach each other, in an undirected graph."""
    seen: set[int] = set()
    count = 0
    # Every vertex is tried as a start, or an isolated one would never be counted.
    for u in range(len(adj)):
        if u not in seen:
            explore(adj, u, seen)
            count += 1
    return count
# endregion


# region has-cycle
UNVISITED = 0
ON_PATH = 1
FINISHED = 2


def visit(adj: Graph, state: list[int], u: int) -> bool:
    """Walk on from u; True if an edge leads back into the current path."""
    state[u] = ON_PATH
    for v in adj[u]:
        # Only an edge back into the current path closes a loop. In the
        # diamond 0>1, 0>2, 1>3, 2>3, reaching 3 twice is not a cycle.
        if state[v] == ON_PATH:
            return True
        if state[v] == UNVISITED:
            if visit(adj, state, v):
                return True
    # Stays FINISHED, never reset: resetting re-walks shared subgraphs,
    # which takes exponential time on a chain of diamonds.
    state[u] = FINISHED
    return False


def has_cycle(adj: Graph) -> bool:
    """Whether a directed graph has a cycle; adj[u] lists u's out-neighbors."""
    state = [UNVISITED] * len(adj)
    for u in range(len(adj)):
        if state[u] == UNVISITED:
            if visit(adj, state, u):
                return True
    return False
# endregion


# region path-sum
class TreeNode:
    """One node: a value and a left and a right child, or None."""

    def __init__(
        self,
        value: int,
        left: "TreeNode | None" = None,
        right: "TreeNode | None" = None,
    ):
        self.value = value
        self.left = left
        self.right = right


def has_path_sum(node: TreeNode | None, remaining: int) -> bool:
    """Whether some root-to-leaf path has values adding up to remaining."""
    if node is None:
        return False
    # An argument, so each call has its own copy and nothing needs undoing.
    remaining = remaining - node.value
    # Test at a leaf, not at None: a node with one child would otherwise
    # count its empty side as a second place for a path to end.
    if node.left is None and node.right is None:
        return remaining == 0
    return has_path_sum(node.left, remaining) or has_path_sum(node.right, remaining)
# endregion


# region diameter
def height_and_best(node: TreeNode | None) -> tuple[int, int]:
    """The node's height and the longest path (in edges) anywhere below it."""
    # -1 for the empty tree, as in the binary-tree entry, so a leaf is 0.
    if node is None:
        return -1, 0
    left_height, left_best = height_and_best(node.left)
    right_height, right_best = height_and_best(node.right)
    # The longest path turning at this node goes down both sides. Computed
    # here, from heights already returned; calling a height function afresh
    # at every node re-walks each subtree, O(n^2) on a chain.
    through_here = left_height + right_height + 2
    best = max(left_best, right_best, through_here)
    # A parent can extend only one side, so only the taller one goes up.
    return 1 + max(left_height, right_height), best


def diameter(root: TreeNode | None) -> int:
    """Edges on the longest path between any two nodes."""
    return height_and_best(root)[1]
# endregion
