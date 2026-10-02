"""The stack entry's Python code.

API: ``Stack()`` with ``push``, ``pop`` and ``peek`` (both raise ``IndexError``
on an empty stack), ``len()`` and ``is_empty``; ``is_balanced(text)``.
"""

import random

import pytest

from stack import Stack, is_balanced


def test_starts_empty():
    s = Stack()
    assert len(s) == 0
    assert s.is_empty() is True


def test_pop_on_empty_raises():
    with pytest.raises(IndexError, match="empty stack"):
        Stack().pop()


def test_peek_on_empty_raises():
    with pytest.raises(IndexError, match="empty stack"):
        Stack().peek()


def test_one_element():
    s = Stack()
    s.push(42)
    assert len(s) == 1
    assert s.is_empty() is False
    assert s.peek() == 42
    assert len(s) == 1
    assert s.pop() == 42
    assert s.is_empty() is True
    with pytest.raises(IndexError):
        s.pop()


def test_last_in_first_out():
    s = Stack()
    for x in [1, 2, 3]:
        s.push(x)
    assert [s.pop(), s.pop(), s.pop()] == [3, 2, 1]


def test_stores_falsy_and_none_values():
    s = Stack()
    s.push(None)
    s.push(0)
    assert s.peek() == 0
    assert s.pop() == 0
    assert s.is_empty() is False
    assert s.pop() is None
    assert s.is_empty() is True


def test_usable_again_after_emptying():
    s = Stack()
    s.push("a")
    s.pop()
    s.push("b")
    assert s.peek() == "b"
    assert len(s) == 1


@pytest.mark.parametrize("seed", range(200))
def test_matches_a_list_on_random_operations(seed):
    rng = random.Random(seed)
    s: Stack[int] = Stack()
    model: list[int] = []
    for _ in range(rng.randrange(1, 60)):
        op = rng.choice(["push", "push", "pop", "peek"])
        if op == "push":
            x = rng.randrange(-5, 6)
            s.push(x)
            model.append(x)
        elif op == "pop":
            if model:
                assert s.pop() == model.pop()
            else:
                with pytest.raises(IndexError):
                    s.pop()
        elif model:
            assert s.peek() == model[-1]
        else:
            with pytest.raises(IndexError):
                s.peek()
        assert len(s) == len(model)
        assert s.is_empty() == (not model)


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("", True),
        ("()", True),
        ("([]{})", True),
        ("{[()()]}", True),
        ("(", False),
        ("((()", False),
        (")", False),
        ("())", False),
        ("([)]", False),
        ("(]", False),
        ("}{", False),
        ("a(b[c]d)e", True),
        ("f(x) = [1, 2]", True),
        ("no brackets at all", True),
        ("x)", False),
        ("<>", True),
    ],
)
def test_is_balanced_cases(text, expected):
    assert is_balanced(text) is expected


def balanced_by_erasing(text: str) -> bool:
    """Brute force: keep deleting adjacent matched pairs until none are left."""
    s = "".join(ch for ch in text if ch in "()[]{}")
    while True:
        shorter = s.replace("()", "").replace("[]", "").replace("{}", "")
        if shorter == s:
            return s == ""
        s = shorter


def test_is_balanced_matches_brute_force_on_random_strings():
    rng = random.Random(3)
    for _ in range(3000):
        text = "".join(rng.choice("()[]{}x") for _ in range(rng.randrange(0, 11)))
        assert is_balanced(text) == balanced_by_erasing(text), text
