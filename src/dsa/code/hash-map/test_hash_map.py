"""Tests for the hash-map entry's Python code.

API: ``HashMap(capacity=8)`` with ``put(key, value)``, ``get(key, default)``,
``contains(key)``, ``delete(key)`` (returns whether the key was there),
``size()`` and ``capacity()`` (the number of buckets). Keys are strings and
values are ints. ``hash_code(key)`` is the hash function.
"""

import random

from hash_map import HashMap, hash_code


def colliding_keys():
    """Eight different keys with the same hash: "Aa" and "BB" hash alike."""
    keys = [""]
    for _ in range(3):
        keys = [k + block for k in keys for block in ("Aa", "BB")]
    return keys


def test_colliding_keys_really_collide():
    keys = colliding_keys()
    assert len(set(keys)) == 8
    assert len({hash_code(k) for k in keys}) == 1


def test_hash_code_is_small_stable_and_order_sensitive():
    assert hash_code("") == 0
    assert hash_code("ab") == 97 * 31 + 98
    assert hash_code("ab") != hash_code("ba")
    assert hash_code("z" * 500) >= 0


def test_starts_empty_with_the_given_capacity():
    m = HashMap(4)
    assert m.size() == 0
    assert m.capacity() == 4
    assert m.get("a", -1) == -1
    assert m.contains("a") is False
    assert m.delete("a") is False


def test_one_entry():
    m = HashMap()
    m.put("only", 1)
    assert (m.size(), m.get("only", -1), m.contains("only")) == (1, 1, True)
    assert m.delete("only") is True
    assert (m.size(), m.get("only", -1), m.contains("only")) == (0, -1, False)


def test_missing_key_returns_the_default():
    m = HashMap()
    m.put("present", 1)
    assert m.get("absent", -1) == -1
    assert m.get("absent", 99) == 99
    assert m.contains("absent") is False


def test_overwrite_keeps_the_size():
    m = HashMap()
    m.put("k", 1)
    m.put("k", 2)
    assert m.get("k", -1) == 2
    assert m.size() == 1


def test_stores_zero_and_the_empty_key():
    m = HashMap()
    m.put("", 0)
    m.put("zero", 0)
    assert m.get("", -1) == 0
    assert m.contains("zero") is True
    assert m.size() == 2


def test_contains_sees_a_value_equal_to_the_default():
    m = HashMap()
    m.put("k", -1)
    assert m.get("k", -1) == m.get("missing", -1)
    assert m.contains("k") is True
    assert m.contains("missing") is False


def test_colliding_keys_stay_apart_and_delete_keeps_the_rest():
    keys = colliding_keys()
    m = HashMap(16)
    for i in range(len(keys)):
        m.put(keys[i], i)
    m.put(keys[2], 20)
    assert m.get(keys[2], -1) == 20
    assert m.get("Aa" + "x", -1) == -1
    # First, last (swaps with itself) and middle of the chain.
    for victim in (0, 7, 2):
        assert m.delete(keys[victim]) is True
    assert m.size() == 5
    for i in (1, 3, 4, 5, 6):
        assert m.get(keys[i], -1) == i
    for i in (0, 2, 7):
        assert m.contains(keys[i]) is False


def test_put_again_after_delete():
    m = HashMap()
    m.put("a", 1)
    m.delete("a")
    m.put("a", 2)
    assert m.get("a", -1) == 2
    assert m.size() == 1


def test_resize_keeps_load_factor_and_every_key():
    m = HashMap(4)
    for i in range(200):
        m.put("k" + str(i), i)
        assert m.size() / m.capacity() <= 0.75
    assert m.size() == 200
    for i in range(200):
        assert m.get("k" + str(i), -1) == i


def test_overwrites_alone_do_not_grow():
    m = HashMap(4)
    for i in range(50):
        m.put("a", i)
    assert (m.capacity(), m.size()) == (4, 1)


def test_growth_doubles_the_capacity():
    # Growing by a constant instead of doubling makes the total resize work
    # quadratic; doubling from 8 reaches exactly 2048 for 1000 entries.
    m = HashMap(8)
    for i in range(1000):
        m.put("k" + str(i), i)
    assert m.capacity() == 2048


def test_matches_a_dict_on_random_operations():
    for seed in range(50):
        rng = random.Random(seed)
        m = HashMap(2)
        ref = {}
        for step in range(120):
            key = "key" + str(rng.randint(0, 15))
            op = rng.choice("pgd")
            where = "seed=" + str(seed) + " step=" + str(step) + " op=" + op + " " + key
            if op == "p":
                m.put(key, step)
                ref[key] = step
            elif op == "g":
                assert m.get(key, -1) == ref.get(key, -1), where
            else:
                assert m.delete(key) == (key in ref), where
                ref.pop(key, None)
            assert m.size() == len(ref), where
            assert m.contains(key) == (key in ref), where
