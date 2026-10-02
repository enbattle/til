"""Tests for the dp-intervals entry: palindromic subsequences and matrix chains.

Both are checked against brute force: every subsequence of a short string, and
every way of bracketing a short chain of matrices.
"""

import random

import pytest

from dp_intervals import (
    longest_palindromic_subsequence,
    lps_length,
    lps_table,
    matrix_chain_cost,
    matrix_chain_order,
)


def brute_lps_length(s):
    best = 0
    for mask in range(1 << len(s)):
        kept = [s[i] for i in range(len(s)) if mask >> i & 1]
        if kept == kept[::-1]:
            best = max(best, len(kept))
    return best


def is_subsequence(small, big):
    it = iter(big)
    return all(ch in it for ch in small)


def all_orders(dims, i, j):
    """Every (bracketing, cost) for matrices i..j; matrix k is dims[k] x dims[k+1]."""
    if i == j:
        return [(f"A{i + 1}", 0)]
    found = []
    for k in range(i, j):
        for left, left_cost in all_orders(dims, i, k):
            for right, right_cost in all_orders(dims, k + 1, j):
                joined = dims[i] * dims[k + 1] * dims[j + 1]
                found.append((f"({left} {right})", left_cost + right_cost + joined))
    return found


def test_known_palindromic_subsequences():
    assert lps_length("bbbab") == 4
    assert lps_length("agbcba") == 5
    assert longest_palindromic_subsequence("agbcba") == "abcba"
    assert lps_length("abcd") == 1


def test_lps_empty_and_single():
    assert lps_length("") == 0
    assert longest_palindromic_subsequence("") == ""
    assert lps_length("x") == 1
    assert longest_palindromic_subsequence("x") == "x"


def test_lps_all_equal_characters():
    assert lps_length("aaaaaa") == 6
    assert longest_palindromic_subsequence("aaaaa") == "aaaaa"


def test_lps_whole_string_is_a_palindrome():
    assert lps_length("racecar") == 7
    assert longest_palindromic_subsequence("abba") == "abba"


def test_lps_two_characters():
    assert lps_length("aa") == 2
    assert lps_length("ab") == 1


def test_lps_table_cells():
    table = lps_table("bbbab")
    assert table[0][4] == 4
    assert table[1][3] == 2
    assert table[3][4] == 1
    assert [table[i][i] for i in range(5)] == [1] * 5


def test_lps_agrees_with_brute_force():
    rng = random.Random(11)
    for _ in range(300):
        s = "".join(rng.choice("abc") for _ in range(rng.randint(0, 11)))
        expected = brute_lps_length(s)
        assert lps_length(s) == expected
        text = longest_palindromic_subsequence(s)
        assert text == text[::-1]
        assert is_subsequence(text, s)
        assert len(text) == expected


def test_lps_wider_alphabet_agrees_with_brute_force():
    rng = random.Random(12)
    for _ in range(100):
        s = "".join(rng.choice("abcdefg") for _ in range(rng.randint(0, 10)))
        assert lps_length(s) == brute_lps_length(s)


def test_matrix_chain_known_values():
    assert matrix_chain_order([10, 30, 5, 60]) == (4500, "((A1 A2) A3)")
    assert matrix_chain_cost([40, 20, 30, 10, 30]) == 26000
    assert matrix_chain_cost([10, 20, 30]) == 6000


def test_matrix_chain_single_matrix_and_empty():
    assert matrix_chain_cost([5, 7]) == 0
    assert matrix_chain_order([5, 7]) == (0, "A1")
    assert matrix_chain_order([]) == (0, "")
    assert matrix_chain_order([4]) == (0, "")


def test_matrix_chain_two_matrices_have_one_order():
    assert matrix_chain_order([2, 3, 4]) == (24, "(A1 A2)")


def test_matrix_chain_all_same_size():
    # Every bracketing costs the same, 3 * 4^3 for four 4 x 4 matrices.
    assert matrix_chain_cost([4, 4, 4, 4, 4]) == 3 * 4**3


def test_matrix_chain_order_is_valid_and_best():
    rng = random.Random(5)
    for _ in range(300):
        dims = [rng.randint(1, 9) for _ in range(rng.randint(2, 8))]
        every = all_orders(dims, 0, len(dims) - 2)
        best = min(cost for _, cost in every)
        cost, order = matrix_chain_order(dims)
        assert cost == best == matrix_chain_cost(dims)
        assert (order, best) in every


def test_matrix_chain_does_not_change_the_input():
    dims = [10, 30, 5, 60]
    matrix_chain_order(dims)
    assert dims == [10, 30, 5, 60]


@pytest.mark.parametrize("s", ["ab", "abc", "aab", "baab"])
def test_lps_recovered_text_for_small_cases(s):
    text = longest_palindromic_subsequence(s)
    assert len(text) == brute_lps_length(s)
