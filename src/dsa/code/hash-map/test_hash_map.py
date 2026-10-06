"""Tests for the hash-map entry's Python code.

API: ``HashMap(capacity=8, hash_fn=hash)`` with ``put``, ``get(key,
default=None)``, ``delete`` (returns whether the key was there), ``len()``,
``in`` and a ``capacity`` property (the number of buckets).
"""

import random

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
    assert m.delete("a") is False


def test_one_entry():
    m = HashMap()
    m.put("only", 1)
    assert (len(m), m.get("only"), "only" in m) == (1, 1, True)
    assert m.delete("only") is True
    assert (len(m), m.get("only"), "only" in m) == (0, None, False)


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
    assert 0 in m
    assert m.get(0, "missing") is None
    assert m.get(None) == "none-key"
    assert len(m) == 3


def test_colliding_keys_stay_apart_and_delete_keeps_the_rest():
    m = HashMap(16, collide)
    for i in range(5):
        m.put(f"key{i}", i)
    m.put("key2", 20)
    assert m.get("key2") == 20 and m.get("key9") is None
    for victim in (0, 4, 2):  # first, last (self-swap), middle
        assert m.delete(f"key{victim}") is True
    assert len(m) == 2
    assert (m.get("key1"), m.get("key3")) == (1, 3)
    assert all(f"key{i}" not in m for i in (0, 2, 4))


def test_put_again_after_delete():
    m = HashMap()
    m.put("a", 1)
    m.delete("a")
    m.put("a", 2)
    assert m.get("a") == 2
    assert len(m) == 1


def test_negative_hashes():
    m = HashMap(8, lambda key: -1 - len(key))
    for i in range(20):
        m.put("x" * i, i)
    assert all(m.get("x" * i) == i for i in range(20))
    assert m.delete("xxx") is True
    assert m.get("xxx") is None


def test_resize_keeps_load_factor_and_every_key():
    m = HashMap(4)
    for i in range(200):
        m.put(f"k{i}", i)
        assert len(m) / m.capacity <= 0.75
    assert len(m) == 200
    assert all(m.get(f"k{i}") == i for i in range(200))


def test_overwrites_alone_do_not_grow():
    m = HashMap(4)
    for i in range(50):
        m.put("a", i)
    assert (m.capacity, len(m)) == (4, 1)


def test_resize_moves_a_key_to_its_new_bucket():
    # The entry's example: hashes 17, 6, 13 in 4 buckets; the 4th key resizes.
    hashes = {"ada": 17, "bob": 6, "cy": 13, "di": 2}
    m = HashMap(4, hashes.__getitem__)
    for key in hashes:
        m.put(key, 0)
    assert m.capacity == 8
    assert all(key in m for key in hashes)


def test_doubling_keeps_total_hash_calls_linear():
    # Mechanism: growing by a constant instead of doubling rehashes
    # everything every few puts, which is quadratic in hash calls.
    calls = 0

    def counting(key):
        nonlocal calls
        calls += 1
        return key

    n = 1000
    m = HashMap(8, counting)
    for i in range(n):
        m.put(i, i)
    assert calls <= 4 * n, calls


def test_matches_a_dict_on_random_operations():
    for seed in range(50):
        rng = random.Random(seed)
        m, ref = HashMap(2, lambda key: key * 7 - 50), {}
        for step in range(120):
            key, op = rng.randint(0, 15), rng.choice("pgd")
            where = f"seed={seed} step={step} op={op} key={key}"
            if op == "p":
                m.put(key, step)
                ref[key] = step
            elif op == "g":
                assert m.get(key, "miss") == ref.get(key, "miss"), where
            else:
                assert m.delete(key) == (ref.pop(key, None) is not None), where
            assert len(m) == len(ref), where
            assert (key in m) == (key in ref), where
