"""Tests for the trie entry's Python code.

API: ``Trie()`` with ``insert(word)``, ``word in trie``, ``starts_with(prefix)``,
``words_with_prefix(prefix)`` (every stored word, in no fixed order) and
``delete(word)`` (True when the word was stored).
"""

import random

from trie import Trie, TrieNode

WORDS = ["app", "apple", "apt", "bat"]


def build(words):
    trie = Trie()
    for word in words:
        trie.insert(word)
    return trie


def count_nodes(trie):
    """Nodes below the root."""
    total, stack = 0, [trie._root]
    while stack:
        node = stack.pop()
        total += len(node.children)
        stack.extend(node.children.values())
    return total


def prefixes(words):
    return {w[:i] for w in words for i in range(1, len(w) + 1)}


class CountingDict(dict):
    """A children map that counts lookups with get."""

    gets = 0

    def get(self, key, default=None):
        CountingDict.gets += 1
        return super().get(key, default)


def instrument(trie):
    stack = [trie._root]
    while stack:
        node = stack.pop()
        node.children = CountingDict(node.children)
        stack.extend(node.children.values())


def random_words(rng):
    return [
        "".join(rng.choice("abc") for _ in range(rng.randint(0, 5)))
        for _ in range(rng.randint(0, 12))
    ]


def test_empty_trie():
    trie = Trie()
    assert "" not in trie
    assert "a" not in trie
    assert not trie.starts_with("")
    assert not trie.starts_with("a")
    assert trie.words_with_prefix("") == []
    assert not trie.delete("a")


def test_single_word():
    trie = build(["a"])
    assert "a" in trie
    assert "b" not in trie
    assert trie.starts_with("")
    assert trie.words_with_prefix("a") == ["a"]


def test_the_running_example():
    trie = build(WORDS)
    assert all(word in trie for word in WORDS)
    assert "ap" not in trie
    assert "appl" not in trie
    assert "apples" not in trie
    assert trie.starts_with("ap")
    assert trie.starts_with("apple")
    assert not trie.starts_with("apples")
    assert not trie.starts_with("c")
    assert sorted(trie.words_with_prefix("ap")) == ["app", "apple", "apt"]
    assert sorted(trie.words_with_prefix("")) == sorted(WORDS)
    assert trie.words_with_prefix("appl") == ["apple"]
    assert trie.words_with_prefix("x") == []


def test_a_word_that_is_only_a_prefix_is_not_stored():
    trie = build(["apple"])
    assert "app" not in trie
    assert trie.starts_with("app")


def test_inserting_a_prefix_after_the_longer_word_adds_no_nodes():
    trie = build(["apple"])
    before = count_nodes(trie)
    trie.insert("app")
    assert count_nodes(trie) == before
    assert "app" in trie


def test_duplicate_insert_changes_nothing():
    trie = build(WORDS)
    trie.insert("".join(["ap", "ple"]))
    assert count_nodes(trie) == 9
    assert sorted(trie.words_with_prefix("")) == sorted(WORDS)


def test_the_empty_string_as_a_word():
    trie = build([""])
    assert "" in trie
    assert trie.words_with_prefix("") == [""]
    assert trie.delete("")
    assert "" not in trie


def test_non_ascii_words_step_by_code_point():
    trie = build(["hé", "\U0001f600x", "\U0001f600y"])
    assert "hé" in trie
    assert trie.starts_with("\U0001f600")
    assert sorted(trie.words_with_prefix("\U0001f600")) == [
        "\U0001f600x",
        "\U0001f600y",
    ]
    assert len(trie._root.children) == 2


def test_a_very_long_word_does_not_overflow_the_stack():
    word = "a" * 5000
    trie = build([word])
    assert word in trie
    assert trie.words_with_prefix("") == [word]
    assert trie.delete(word)
    assert count_nodes(trie) == 0


def test_delete_the_longer_word_keeps_the_shorter_one():
    trie = build(WORDS)
    assert trie.delete("apple")
    assert "apple" not in trie
    assert "app" in trie
    assert not trie.starts_with("appl")
    assert count_nodes(trie) == 7


def test_delete_the_shorter_word_keeps_the_longer_one():
    trie = build(WORDS)
    assert trie.delete("app")
    assert "app" not in trie
    assert "apple" in trie
    assert count_nodes(trie) == 9


def test_delete_a_word_that_is_not_stored():
    trie = build(WORDS)
    assert not trie.delete("ap")
    assert not trie.delete("apples")
    assert not trie.delete("zzz")
    assert count_nodes(trie) == 9
    assert sorted(trie.words_with_prefix("")) == sorted(WORDS)


def test_delete_everything_leaves_only_the_root():
    trie = build(WORDS)
    for word in WORDS:
        assert trie.delete(word)
    assert count_nodes(trie) == 0
    assert not trie.starts_with("")
    assert not trie.delete("app")


def test_shared_prefixes_share_nodes():
    # 14 characters in four words, but "apple" reuses "app" and "apt" reuses
    # "ap", so only 9 nodes exist. One chain per word would make 14.
    trie = build(WORDS)
    assert count_nodes(trie) == 9
    assert count_nodes(trie) == len(prefixes(WORDS))
    assert isinstance(trie._root, TrieNode)
    assert set(trie._root.children) == {"a", "b"}


def test_a_lookup_takes_one_step_per_character_whatever_the_size():
    rng = random.Random(7)
    big = {"".join(rng.choice("abcdefgh") for _ in range(8)) for _ in range(500)}
    for words in (["apple"], sorted(big) + ["apple"]):
        trie = build(words)
        instrument(trie)
        CountingDict.gets = 0
        assert "apple" in trie
        assert CountingDict.gets == 5, f"{len(words)} words"
        CountingDict.gets = 0
        assert trie.starts_with("app")
        assert CountingDict.gets == 3, f"{len(words)} words"


def test_matches_a_set_on_random_words():
    for seed in range(50):
        rng = random.Random(seed)
        words = random_words(rng)
        trie = build(words)
        stored = set(words)
        assert count_nodes(trie) == len(prefixes(words)), f"seed {seed}"
        for probe in prefixes(words) | {"", "abcab", "ccccc"}:
            assert (probe in trie) == (probe in stored), f"seed {seed} {probe!r}"
            want = sorted(w for w in stored if w.startswith(probe))
            assert sorted(trie.words_with_prefix(probe)) == want, (
                f"seed {seed} prefix {probe!r}"
            )
            assert trie.starts_with(probe) == bool(want), f"seed {seed} {probe!r}"


def test_random_deletes_match_a_set_and_prune():
    for seed in range(50):
        rng = random.Random(seed)
        words = random_words(rng)
        trie = build(words)
        stored = set(words)
        for step in range(12):
            word = rng.choice(words + ["abc", "cab"]) if words else "abc"
            assert trie.delete(word) == (word in stored), f"seed {seed} step {step}"
            stored.discard(word)
            assert word not in trie, f"seed {seed} step {step}"
            assert count_nodes(trie) == len(prefixes(stored)), (
                f"seed {seed} step {step}"
            )
        assert sorted(trie.words_with_prefix("")) == sorted(stored), f"seed {seed}"
