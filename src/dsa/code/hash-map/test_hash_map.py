"""docs/specs/dsa-tab.md, criterion 12: the hash-map entry's Python code.

API: ``HashMap(capacity=8, hash_fn=hash)`` with ``put``, ``get(key,
default=None)``, ``delete`` (returns whether the key was there), ``len()``,
``in`` and a ``capacity`` property (the number of buckets).
"""

import pytest

from hash_map import HashMap


def collide(_key):
    """A hash that sends every key to the same bucket."""
    return 0


def test_starts_empty_with_the_given_capacity():
    m = HashMap(4)
    assert len(m) == 0
    assert m.capacity == 4
    assert m.get("a") is None
    assert "a" not in m


def test_defaults_to_a_positive_capacity():
    assert HashMap().capacity > 0


def test_put_and_get():
    m = HashMap()
    m.put("one", 1)
    m.put("two", 2)
    assert m.get("one") == 1
    assert m.get("two") == 2
    assert "one" in m
    assert len(m) == 2


def test_missing_key_returns_none_or_the_default():
    m = HashMap()
    m.put("present", 1)
    assert m.get("absent") is None
    assert m.get("absent", "fallback") == "fallback"
    assert "absent" not in m


def test_overwrite_keeps_the_size():
    m = HashMap()
    m.put("k", "old")
    m.put("k", "new")
    assert m.get("k") == "new"
    assert len(m) == 1


def test_stores_falsy_values_and_keys():
    m = HashMap()
    m.put("", 0)
    m.put(0, None)
    m.put(None, "none-key")
    assert m.get("") == 0
    assert "" in m
    assert 0 in m
    assert m.get(0, "missing") is None
    assert m.get(None) == "none-key"
    assert len(m) == 3


def test_any_hashable_key():
    m = HashMap()
    m.put((1, 2), "tuple")
    m.put(3, "int")
    assert m.get((1, 2)) == "tuple"
    assert m.get(3) == "int"


def test_colliding_keys_stay_apart():
    m = HashMap(8, collide)
    for i in range(5):
        m.put(f"key{i}", i)
    for i in range(5):
        assert m.get(f"key{i}") == i
    assert m.get("key9") is None
    m.put("key2", 20)
    assert m.get("key2") == 20
    assert len(m) == 5


def test_delete_reports_whether_the_key_was_there():
    m = HashMap()
    m.put("a", 1)
    m.put("b", 2)
    assert m.delete("a") is True
    assert m.get("a") is None
    assert "a" not in m
    assert m.get("b") == 2
    assert len(m) == 1
    assert m.delete("a") is False
    assert m.delete("never") is False
    assert len(m) == 1


@pytest.mark.parametrize("victim", [0, 2, 4])
def test_delete_from_a_collision_chain_keeps_the_rest(victim):
    m = HashMap(16, collide)
    for i in range(5):
        m.put(f"key{i}", i)
    assert m.delete(f"key{victim}") is True
    assert len(m) == 4
    for i in range(5):
        assert m.get(f"key{i}") == (None if i == victim else i)


def test_put_again_after_delete():
    m = HashMap()
    m.put("a", 1)
    m.delete("a")
    m.put("a", 2)
    assert m.get("a") == 2
    assert len(m) == 1


def test_resize_keeps_load_factor_and_every_key():
    m = HashMap(4)
    for i in range(200):
        m.put(f"k{i}", i)
        assert len(m) / m.capacity <= 0.75
    assert m.capacity > 4
    assert len(m) == 200
    for i in range(200):
        assert m.get(f"k{i}") == i


def test_resize_rehashes_with_a_custom_hash():
    m = HashMap(2, lambda key: len(key) * 7919)
    keys = ["a", "bb", "ccc", "dddd", "eeeee", "ffffff", "ggggggg", "hh"]
    for i, k in enumerate(keys):
        m.put(k, i)
    assert m.capacity > 2
    for i, k in enumerate(keys):
        assert m.get(k) == i


def test_negative_hashes():
    m = HashMap(8, lambda key: -1 - len(key))
    for i in range(20):
        m.put("x" * i, i)
    for i in range(20):
        assert m.get("x" * i) == i
    assert m.delete("xxx") is True
    assert m.get("xxx") is None


def test_overwrites_alone_do_not_grow():
    m = HashMap(4)
    m.put("a", 1)
    for i in range(50):
        m.put("a", i)
    assert m.capacity == 4
    assert len(m) == 1
