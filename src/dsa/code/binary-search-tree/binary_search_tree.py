from collections.abc import Iterable, Iterator


class Node:
    """One tree node: a key and links to the left and right subtrees."""

    __slots__ = ("key", "left", "right")

    def __init__(self, key: int) -> None:
        self.key = key
        self.left: Node | None = None
        self.right: Node | None = None


class BinarySearchTree:
    """An unbalanced binary search tree of distinct integer keys."""

    def __init__(self, keys: Iterable[int] = ()) -> None:
        self._root: Node | None = None
        self._size = 0
        for key in keys:
            self.insert(key)

    def __len__(self) -> int:
        return self._size

    def __contains__(self, key: int) -> bool:
        node = self._root
        while node is not None and node.key != key:
            node = node.left if key < node.key else node.right
        return node is not None

    def insert(self, key: int) -> bool:
        parent: Node | None = None
        node = self._root
        while node is not None:
            if key == node.key:
                return False
            parent = node
            node = node.left if key < node.key else node.right
        new = Node(key)
        if parent is None:
            self._root = new
        elif key < parent.key:
            parent.left = new
        else:
            parent.right = new
        self._size += 1
        return True

    def delete(self, key: int) -> bool:
        parent: Node | None = None
        node = self._root
        while node is not None and node.key != key:
            parent = node
            node = node.left if key < node.key else node.right
        if node is None:
            return False
        if node.left is not None and node.right is not None:
            successor_parent, successor = node, node.right
            while successor.left is not None:
                successor_parent, successor = successor, successor.left
            node.key = successor.key
            parent, node = successor_parent, successor
        child = node.left if node.left is not None else node.right
        if parent is None:
            self._root = child
        elif parent.left is node:
            parent.left = child
        else:
            parent.right = child
        self._size -= 1
        return True

    def min(self) -> int:
        if self._root is None:
            raise ValueError("min of an empty tree")
        node = self._root
        while node.left is not None:
            node = node.left
        return node.key

    def max(self) -> int:
        if self._root is None:
            raise ValueError("max of an empty tree")
        node = self._root
        while node.right is not None:
            node = node.right
        return node.key

    def __iter__(self) -> Iterator[int]:
        stack: list[Node] = []
        node = self._root
        while stack or node is not None:
            while node is not None:
                stack.append(node)
                node = node.left
            node = stack.pop()
            yield node.key
            node = node.right

    def keys_between(self, lo: int, hi: int) -> list[int]:
        """Every key k with lo <= k <= hi, in ascending order."""
        result: list[int] = []
        stack: list[Node] = []
        node = self._root
        while stack or node is not None:
            while node is not None:
                if node.key < lo:
                    node = node.right
                else:
                    stack.append(node)
                    node = node.left
            if not stack:
                break
            node = stack.pop()
            if node.key > hi:
                break
            result.append(node.key)
            node = node.right
        return result

    def height(self) -> int:
        """Edges on the longest path down from the root; -1 for an empty tree."""
        level = [] if self._root is None else [self._root]
        height = -1
        while level:
            height += 1
            level = [c for n in level for c in (n.left, n.right) if c is not None]
        return height
