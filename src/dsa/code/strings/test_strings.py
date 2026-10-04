"""The strings entry's Python code.

API: ``StringBuilder()`` with ``append(piece)`` (returns the builder), ``len()``
(code points appended so far) and ``build()``; ``reverse_code_points(s)``;
``is_palindrome(s)`` (letters and digits only, case ignored).
"""

import random

import pytest

from strings import StringBuilder, is_palindrome, reverse_code_points

# 𐐀 and 𐐨 are one Deseret letter in upper and lower case, outside the BMP.
ALPHABET = "abAB1 ,!éÉ😀🇺ß𐐀𐐨"


def reference_palindrome(s: str) -> bool:
    kept = [c.lower() for c in s if c.isalnum()]
    return kept == kept[::-1]


# StringBuilder


def test_builder_starts_empty():
    b = StringBuilder()
    assert len(b) == 0
    assert b.build() == ""


def test_builder_joins_pieces_in_order():
    b = StringBuilder()
    b.append("ab").append("").append("c")
    assert b.build() == "abc"
    assert len(b) == 3


def test_builder_counts_code_points():
    b = StringBuilder()
    b.append("h").append("é").append("😀")
    assert len(b) == 3
    assert b.build() == "hé😀"


def test_builder_can_build_again_and_keep_appending():
    b = StringBuilder()
    b.append("x")
    assert b.build() == "x"
    assert b.build() == "x"
    b.append("y")
    assert b.build() == "xy"
    assert len(b) == 2


def test_builder_matches_concatenation_on_random_pieces():
    rng = random.Random(3)
    for trial in range(50):
        at = f"seed 3, trial {trial}"
        pieces = [
            "".join(rng.choice(ALPHABET) for _ in range(rng.randrange(4)))
            for _ in range(rng.randrange(8))
        ]
        b = StringBuilder()
        expected = ""
        for piece in pieces:
            b.append(piece)
            expected += piece
            if rng.random() < 0.3:
                assert b.build() == expected, at
        assert b.build() == expected, at
        assert len(b) == len(expected), at


# reverse_code_points


@pytest.mark.parametrize(
    ("s", "expected"),
    [
        ("", ""),
        ("a", "a"),
        ("ab", "ba"),
        ("héllo", "olléh"),
        ("a😀b", "b😀a"),
        ("😀🎉", "🎉😀"),
    ],
)
def test_reverse(s, expected):
    assert reverse_code_points(s) == expected


def test_reverse_twice_is_the_original():
    rng = random.Random(5)
    for trial in range(50):
        s = "".join(rng.choice(ALPHABET) for _ in range(rng.randrange(10)))
        at = f"seed 5, trial {trial}: {s!r}"
        assert reverse_code_points(reverse_code_points(s)) == s, at
        assert list(reverse_code_points(s)) == list(reversed(s)), at


# is_palindrome


@pytest.mark.parametrize(
    "s",
    [
        "",
        "a",
        "!",
        ",,,",
        "aa",
        "Race car!",
        "A man, a plan, a canal: Panama",
        "No 'x' in Nixon",
        "été",
        "Été",
        "😀a😀",
        "a😀b😀a",
        "1a2 2A1",
        "𐐀b𐐨",
    ],
)
def test_palindromes(s):
    assert is_palindrome(s) is True


@pytest.mark.parametrize(
    "s", ["ab", "abca", "race a car", "0P", "éa", "𐐀b", "a,b", "!ab!"]
)
def test_not_palindromes(s):
    assert is_palindrome(s) is False


def test_palindrome_matches_reference_on_random_strings():
    rng = random.Random(9)
    found = 0
    for trial in range(50):
        n = rng.randrange(9)
        half = [rng.choice(ALPHABET) for _ in range(n)]
        if rng.random() < 0.5:
            s = "".join(half + half[::-1])
        else:
            s = "".join(half)
        expected = reference_palindrome(s)
        found += expected
        assert is_palindrome(s) is expected, f"seed 9, trial {trial}: {s!r}"
    assert 5 < found < 45
