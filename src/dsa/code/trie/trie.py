class TrieNode:
    __slots__ = ("children", "is_word")

    def __init__(self) -> None:
        self.children: dict[str, TrieNode] = {}
        self.is_word = False


class Trie:
    """A set of strings stored as a tree with one character per edge."""

    def __init__(self) -> None:
        self._root = TrieNode()

    def insert(self, word: str) -> None:
        node = self._root
        for ch in word:
            # Not setdefault(ch, TrieNode()): that builds a node on every
            # step, even when the child already exists.
            if ch not in node.children:
                node.children[ch] = TrieNode()
            node = node.children[ch]
        # The node may exist already as a step toward a longer word.
        node.is_word = True

    def _find(self, prefix: str) -> TrieNode | None:
        node: TrieNode | None = self._root
        for ch in prefix:
            node = node.children.get(ch)
            if node is None:
                return None
        return node

    def __contains__(self, word: str) -> bool:
        node = self._find(word)
        # Reaching the node isn't enough: "app" is a step toward "apple".
        return node is not None and node.is_word

    def starts_with(self, prefix: str) -> bool:
        node = self._find(prefix)
        # An unmarked node with no children is only the root of an empty
        # trie, which has no word to start with "".
        return node is not None and (node.is_word or bool(node.children))

    def words_with_prefix(self, prefix: str) -> list[str]:
        """Every stored word that starts with prefix, in no fixed order."""
        start = self._find(prefix)
        if start is None:
            return []
        found: list[str] = []
        # A stack, not recursion: one frame per character would overflow
        # on a very long word.
        stack = [(start, prefix)]
        while stack:
            node, word = stack.pop()
            if node.is_word:
                found.append(word)
            stack.extend((c, word + ch) for ch, c in node.children.items())
        return found

    def delete(self, word: str) -> bool:
        path: list[tuple[TrieNode, str]] = []
        node = self._root
        for ch in word:
            if ch not in node.children:
                return False
            path.append((node, ch))
            node = node.children[ch]
        if not node.is_word:
            return False
        node.is_word = False
        # Stop at a marked node: deleting "apple" must keep "app".
        while path and not node.is_word and not node.children:
            parent, ch = path.pop()
            del parent.children[ch]
            node = parent
        return True
