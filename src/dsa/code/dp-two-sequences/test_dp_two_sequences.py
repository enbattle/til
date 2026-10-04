import random
from itertools import combinations

from dp_two_sequences import (
    edit_distance,
    edit_distance_rolling,
    lcs,
    lcs_length,
    lcs_table,
)


def all_subsequences(s: str) -> set[str]:
    found = {""}
    for size in range(1, len(s) + 1):
        for picks in combinations(range(len(s)), size):
            found.add("".join(s[i] for i in picks))
    return found


def brute_lcs_length(a: str, b: str) -> int:
    return max(len(s) for s in all_subsequences(a) & all_subsequences(b))


def brute_edit_distance(a: str, b: str) -> int:
    """Plain recursion on the last characters, no table."""
    if not a:
        return len(b)
    if not b:
        return len(a)
    if a[-1] == b[-1]:
        return brute_edit_distance(a[:-1], b[:-1])
    return 1 + min(
        brute_edit_distance(a[:-1], b),
        brute_edit_distance(a, b[:-1]),
        brute_edit_distance(a[:-1], b[:-1]),
    )


def is_subsequence(small: str, big: str) -> bool:
    chars = iter(big)
    return all(c in chars for c in small)


def random_pairs(seed: int, count: int, alphabet: str, max_len: int):
    rng = random.Random(seed)
    for _ in range(count):
        a = "".join(rng.choice(alphabet) for _ in range(rng.randint(0, max_len)))
        b = "".join(rng.choice(alphabet) for _ in range(rng.randint(0, max_len)))
        yield a, b


def test_lcs_known_example() -> None:
    assert lcs_length("ABCBDAB", "BDCABA") == 4
    assert lcs_length("abcde", "ace") == 3
    assert lcs("abcde", "ace") == "ace"


def test_lcs_table_shape_and_borders() -> None:
    table = lcs_table("abc", "de")
    assert len(table) == 4 and all(len(row) == 3 for row in table)
    assert table[0] == [0, 0, 0]
    assert all(row[0] == 0 for row in table)


def test_lcs_empty_strings() -> None:
    assert lcs_length("", "") == 0
    assert lcs_length("abc", "") == 0
    assert lcs_length("", "abc") == 0
    assert lcs("", "abc") == ""
    assert lcs("abc", "") == ""


def test_lcs_identical_strings() -> None:
    assert lcs_length("banana", "banana") == 6
    assert lcs("banana", "banana") == "banana"


def test_lcs_no_common_character() -> None:
    assert lcs_length("abc", "xyz") == 0
    assert lcs("abc", "xyz") == ""


def test_lcs_single_characters() -> None:
    assert lcs("a", "a") == "a"
    assert lcs("a", "b") == ""


def test_lcs_one_inside_the_other() -> None:
    assert lcs("ace", "abcde") == "ace"
    assert lcs("abcde", "bd") == "bd"


def test_lcs_repeated_characters() -> None:
    assert lcs_length("aaaa", "aa") == 2
    assert lcs("aaaa", "aa") == "aa"


def test_lcs_matches_brute_force_on_random_strings() -> None:
    for trial, (a, b) in enumerate(random_pairs(0, 50, "abc", 8)):
        where = f"seed 0, trial {trial}: {a!r}, {b!r}"
        expected = brute_lcs_length(a, b)
        assert lcs_length(a, b) == expected, where
        result = lcs(a, b)
        assert len(result) == expected, where
        assert is_subsequence(result, a) and is_subsequence(result, b), where


def test_lcs_is_symmetric_in_length() -> None:
    for trial, (a, b) in enumerate(random_pairs(11, 50, "abcd", 9)):
        assert lcs_length(a, b) == lcs_length(b, a), f"seed 11, trial {trial}: {a!r}, {b!r}"


def test_edit_distance_known_examples() -> None:
    assert edit_distance("kitten", "sitting") == 3
    assert edit_distance("horse", "ros") == 3
    assert edit_distance("intention", "execution") == 5


def test_edit_distance_empty_strings() -> None:
    assert edit_distance("", "") == 0
    assert edit_distance("abc", "") == 3
    assert edit_distance("", "abcd") == 4


def test_edit_distance_identical_strings() -> None:
    assert edit_distance("banana", "banana") == 0


def test_edit_distance_no_common_character() -> None:
    assert edit_distance("abc", "xyz") == 3
    assert edit_distance("abc", "xy") == 3
    assert edit_distance("a", "xyz") == 3


def test_edit_distance_single_operations() -> None:
    assert edit_distance("cat", "cut") == 1
    assert edit_distance("cat", "cart") == 1
    assert edit_distance("cart", "cat") == 1


def test_edit_distance_matches_brute_force_on_random_strings() -> None:
    for trial, (a, b) in enumerate(random_pairs(100, 50, "abc", 6)):
        assert edit_distance(a, b) == brute_edit_distance(a, b), (
            f"seed 100, trial {trial}: {a!r}, {b!r}"
        )


def test_edit_distance_is_symmetric_and_bounded() -> None:
    for trial, (a, b) in enumerate(random_pairs(7, 50, "ab", 8)):
        where = f"seed 7, trial {trial}: {a!r}, {b!r}"
        d = edit_distance(a, b)
        assert d == edit_distance(b, a), where
        assert abs(len(a) - len(b)) <= d <= max(len(a), len(b)), where


def test_rolling_matches_table_on_random_strings() -> None:
    for trial, (a, b) in enumerate(random_pairs(200, 50, "abc", 9)):
        assert edit_distance_rolling(a, b) == edit_distance(a, b), (
            f"seed 200, trial {trial}: {a!r}, {b!r}"
        )


def test_rolling_matches_brute_force_on_random_strings() -> None:
    for trial, (a, b) in enumerate(random_pairs(300, 50, "ab", 6)):
        assert edit_distance_rolling(a, b) == brute_edit_distance(a, b), (
            f"seed 300, trial {trial}: {a!r}, {b!r}"
        )


def test_rolling_edge_cases() -> None:
    assert edit_distance_rolling("", "") == 0
    assert edit_distance_rolling("abc", "") == 3
    assert edit_distance_rolling("", "abc") == 3
    assert edit_distance_rolling("same", "same") == 0
    assert edit_distance_rolling("abc", "xyz") == 3


def test_code_points_count_as_one_character() -> None:
    assert edit_distance("a😀", "a") == 1
    assert lcs("a😀b", "😀") == "😀"
