# region trie-node
class TrieNode:
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
            child = node.children.get(ch)
            if child is None:
                child = TrieNode()
                node.children[ch] = child
            node = child
        # The node may exist already as a step toward a longer word.
        node.is_word = True
# endregion

    # region find
    def _find(self, prefix: str) -> TrieNode | None:
        node = self._root
        for ch in prefix:
            child = node.children.get(ch)
            if child is None:
                return None
            node = child
        return node

    def contains(self, word: str) -> bool:
        node = self._find(word)
        if node is None:
            return False
        # Reaching the node isn't enough: "app" is a step toward "apple".
        return node.is_word

    def starts_with(self, prefix: str) -> bool:
        node = self._find(prefix)
        if node is None:
            return False
        # An unmarked node with no children is only the root of an empty
        # trie, which has no word to start with "".
        return node.is_word or len(node.children) > 0
    # endregion

    # region words-with-prefix
    def words_with_prefix(self, prefix: str) -> list[str]:
        """Every stored word that starts with prefix, in no fixed order."""
        start = self._find(prefix)
        if start is None:
            return []
        found: list[str] = []
        # A stack, not recursion: one frame per character would overflow
        # on a very long word.
        stack = [(start, prefix)]
        while len(stack) > 0:
            node, word = stack.pop()
            if node.is_word:
                found.append(word)
            for ch, child in node.children.items():
                stack.append((child, word + ch))
        return found
    # endregion

    # region delete
    def delete(self, word: str) -> bool:
        # Each pair is a node and the character we left it by.
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
        # Stop at a marked node: deleting "apple" must keep "app".
        while len(path) > 0 and not node.is_word and len(node.children) == 0:
            parent, ch = path.pop()
            del parent.children[ch]
            node = parent
        return True
    # endregion
