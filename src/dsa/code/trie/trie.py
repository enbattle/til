class TrieNode:
    __slots__ = ("children", "is_word")

    def __init__(self) -> None:
        self.children: dict[str, TrieNode] = {}
        self.is_word = False


class Trie:
    """A set of strings stored as a tree with one character per edge."""

    def __init__(self) -> None:
        self._root = TrieNode()
        self._size = 0

    def __len__(self) -> int:
        return self._size

    def insert(self, word: str) -> bool:
        node = self._root
        for ch in word:
            child = node.children.get(ch)
            if child is None:
                child = node.children[ch] = TrieNode()
            node = child
        if node.is_word:
            return False
        node.is_word = True
        self._size += 1
        return True

    def _find(self, prefix: str) -> TrieNode | None:
        node = self._root
        for ch in prefix:
            child = node.children.get(ch)
            if child is None:
                return None
            node = child
        return node

    def __contains__(self, word: str) -> bool:
        node = self._find(word)
        return node is not None and node.is_word

    def starts_with(self, prefix: str) -> bool:
        node = self._find(prefix)
        return node is not None and (node.is_word or bool(node.children))

    def words_with_prefix(self, prefix: str) -> list[str]:
        """Every stored word that starts with prefix, in code point order."""
        start = self._find(prefix)
        if start is None:
            return []
        found: list[str] = []
        stack = [(start, prefix)]
        while stack:
            node, word = stack.pop()
            if node.is_word:
                found.append(word)
            for ch, child in sorted(node.children.items(), reverse=True):
                stack.append((child, word + ch))
        return found

    def delete(self, word: str) -> bool:
        path: list[tuple[TrieNode, str]] = []
        node = self._root
        for ch in word:
            child = node.children.get(ch)
            if child is None:
                return False
            path.append((node, ch))
            node = child
        if not node.is_word:
            return False
        node.is_word = False
        self._size -= 1
        while path and not node.is_word and not node.children:
            parent, ch = path.pop()
            del parent.children[ch]
            node = parent
        return True
