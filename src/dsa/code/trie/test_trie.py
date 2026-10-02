"""The trie entry's Python code, compared against a plain set of words.

API: ``Trie()`` with ``insert`` and ``delete`` (each returns whether the set
changed), ``in`` for exact words, ``starts_with``, ``words_with_prefix``
(sorted by code point) and ``len()``.
"""

import random

import pytest

from trie import Trie, TrieNode


def count_nodes(trie: Trie) -> int:
    total = 0
    stack: list[TrieNode] = [trie._root]
    while stack:
        node = stack.pop()
        total += 1
        stack.extend(node.children.values())
    return total


def prefixes_of(words: set[str]) -> set[str]:
    """Every prefix of every word, plus "" for the root that always exists."""
    return {w[:i] for w in words for i in range(len(w) + 1)} | {""}


def make(*words: str) -> Trie:
    trie = Trie()
    for w in words:
        trie.insert(w)
    return trie


def test_empty_trie():
    trie = Trie()
    assert len(trie) == 0
    assert "" not in trie
    assert "a" not in trie
    assert not trie.starts_with("")
    assert not trie.starts_with("a")
    assert trie.words_with_prefix("") == []
    assert trie.delete("a") is False
    assert trie.delete("") is False


def test_insert_and_find():
    trie = make("app", "apple", "apt", "bat")
    assert len(trie) == 4
    for w in ["app", "apple", "apt", "bat"]:
        assert w in trie
    for w in ["a", "ap", "appl", "ba", "apples", "b", "cat"]:
        assert w not in trie
    assert count_nodes(trie) == 10


def test_insert_reports_whether_the_word_was_new():
    trie = Trie()
    assert trie.insert("app") is True
    assert trie.insert("app") is False
    assert len(trie) == 1


def test_prefix_of_a_word_is_not_a_word_until_inserted():
    trie = make("apple")
    assert "app" not in trie
    assert trie.starts_with("app")
    nodes = count_nodes(trie)
    assert trie.insert("app") is True
    assert "app" in trie
    assert count_nodes(trie) == nodes


def test_starts_with():
    trie = make("app", "apple", "bat")
    for p in ["", "a", "ap", "app", "appl", "apple", "b", "bat"]:
        assert trie.starts_with(p)
    for p in ["apples", "c", "bb", "bat "]:
        assert not trie.starts_with(p)


def test_words_with_prefix_in_sorted_order():
    trie = make("bat", "apt", "apple", "app", "b")
    assert trie.words_with_prefix("ap") == ["app", "apple", "apt"]
    assert trie.words_with_prefix("") == ["app", "apple", "apt", "b", "bat"]
    assert trie.words_with_prefix("apple") == ["apple"]
    assert trie.words_with_prefix("appl") == ["apple"]
    assert trie.words_with_prefix("c") == []
    assert trie.words_with_prefix("apples") == []


def test_empty_string_is_a_word():
    trie = Trie()
    assert trie.insert("") is True
    assert "" in trie
    assert len(trie) == 1
    assert trie.starts_with("")
    assert not trie.starts_with("a")
    trie.insert("a")
    assert trie.words_with_prefix("") == ["", "a"]
    assert trie.delete("") is True
    assert "" not in trie
    assert "a" in trie
    assert trie.delete("") is False
    assert trie.words_with_prefix("") == ["a"]


def test_delete_a_word_that_is_a_prefix_of_another():
    trie = make("app", "apple")
    nodes = count_nodes(trie)
    assert trie.delete("app") is True
    assert "app" not in trie
    assert "apple" in trie
    assert trie.starts_with("app")
    assert count_nodes(trie) == nodes
    assert len(trie) == 1


def test_delete_a_word_that_has_another_as_a_prefix():
    trie = make("app", "apple")
    assert trie.delete("apple") is True
    assert "apple" not in trie
    assert "app" in trie
    assert not trie.starts_with("appl")
    assert count_nodes(trie) == 4
    assert trie.words_with_prefix("") == ["app"]


def test_delete_prunes_only_the_unshared_branch():
    trie = make("apple", "apt")
    assert trie.delete("apple") is True
    assert count_nodes(trie) == 4
    assert trie.words_with_prefix("a") == ["apt"]
    assert trie.delete("apt") is True
    assert count_nodes(trie) == 1
    assert len(trie) == 0
    assert not trie.starts_with("")


@pytest.mark.parametrize("absent", ["ap", "apples", "b", "", "app"])
def test_delete_an_absent_word_changes_nothing(absent):
    trie = make("apple")
    if absent == "app":
        trie.insert("app")
        trie.delete("app")
    nodes = count_nodes(trie)
    assert trie.delete(absent) is False
    assert len(trie) == 1
    assert "apple" in trie
    assert count_nodes(trie) == nodes


def test_reinsert_after_delete():
    trie = make("apple")
    trie.delete("apple")
    assert trie.insert("apple") is True
    assert "apple" in trie
    assert count_nodes(trie) == 6


def test_non_ascii_and_astral_characters_are_one_step_each():
    trie = make("café", "caf", "😀", "😀b", "a😀")
    assert count_nodes(trie) == 1 + 4 + 2 + 2
    assert "café" in trie
    assert "cafe" not in trie
    assert trie.starts_with("😀")
    assert trie.words_with_prefix("😀") == ["😀", "😀b"]
    assert trie.delete("😀b") is True
    assert trie.words_with_prefix("😀") == ["😀"]
    assert count_nodes(trie) == 1 + 4 + 1 + 2


def test_sorts_by_code_point_across_the_bmp_boundary():
    # U+FF5E sorts before U+1F600 by code point, after it by UTF-16 unit.
    trie = make("\U0001f600", "～", "z")
    assert trie.words_with_prefix("") == ["z", "～", "\U0001f600"]


def test_long_word_does_not_hit_the_recursion_limit():
    word = "ab" * 3000
    trie = make(word, word[:4000])
    assert word in trie
    assert trie.words_with_prefix(word[:5000]) == [word]
    assert trie.words_with_prefix("ab") == [word[:4000], word]
    assert trie.delete(word) is True
    assert count_nodes(trie) == 4001


ALPHABET = ["a", "b", "é", "～", "\U0001f600"]


def random_word(rng: random.Random) -> str:
    return "".join(rng.choice(ALPHABET) for _ in range(rng.randint(0, 4)))


@pytest.mark.parametrize("seed", range(200))
def test_matches_a_set_on_random_operations(seed):
    rng = random.Random(seed)
    trie = Trie()
    words: set[str] = set()
    for _ in range(60):
        w = random_word(rng)
        op = rng.random()
        if op < 0.45:
            assert trie.insert(w) is (w not in words)
            words.add(w)
        elif op < 0.75:
            assert trie.delete(w) is (w in words)
            words.discard(w)
        else:
            assert (w in trie) is (w in words)
            assert trie.starts_with(w) is any(x.startswith(w) for x in words)
            expected = sorted(x for x in words if x.startswith(w))
            assert trie.words_with_prefix(w) == expected
        assert len(trie) == len(words)
        assert count_nodes(trie) == len(prefixes_of(words))
    assert trie.words_with_prefix("") == sorted(words)
