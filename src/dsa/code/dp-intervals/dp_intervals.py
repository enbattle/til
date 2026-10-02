def lps_table(s: str) -> list[list[int]]:
    """table[i][j]: length of the longest palindromic subsequence of s[i..j]."""
    n = len(s)
    table = [[0] * n for _ in range(n)]
    for i in range(n):
        table[i][i] = 1
    for length in range(2, n + 1):
        for i in range(n - length + 1):
            j = i + length - 1
            if s[i] == s[j]:
                table[i][j] = table[i + 1][j - 1] + 2
            else:
                table[i][j] = max(table[i + 1][j], table[i][j - 1])
    return table


def lps_length(s: str) -> int:
    """Length of the longest palindromic subsequence of s (0 for an empty s)."""
    if not s:
        return 0
    return lps_table(s)[0][len(s) - 1]


def longest_palindromic_subsequence(s: str) -> str:
    """One longest palindromic subsequence of s, read back out of the table."""
    if not s:
        return ""
    table = lps_table(s)
    i, j = 0, len(s) - 1
    outer: list[str] = []
    middle = ""
    while i <= j:
        if i == j:
            middle = s[i]
            break
        if s[i] == s[j]:
            outer.append(s[i])
            i += 1
            j -= 1
        elif table[i + 1][j] >= table[i][j - 1]:
            i += 1
        else:
            j -= 1
    half = "".join(outer)
    return half + middle + half[::-1]


def matrix_chain_tables(dims: list[int]) -> tuple[list[list[int]], list[list[int]]]:
    """Matrix k is dims[k] x dims[k + 1]. Returns (cost, split) for every range."""
    n = len(dims) - 1
    cost = [[0] * n for _ in range(n)]
    split = [[0] * n for _ in range(n)]
    for length in range(2, n + 1):
        for i in range(n - length + 1):
            j = i + length - 1
            cost[i][j], split[i][j] = min(
                (cost[i][k] + cost[k + 1][j] + dims[i] * dims[k + 1] * dims[j + 1], k)
                for k in range(i, j)
            )
    return cost, split


def matrix_chain_cost(dims: list[int]) -> int:
    """Fewest scalar multiplications to multiply the whole chain (0 if no pair)."""
    n = len(dims) - 1
    if n < 1:
        return 0
    return matrix_chain_tables(dims)[0][0][n - 1]


def parenthesize(split: list[list[int]], i: int, j: int) -> str:
    """Bracketed multiplication order for matrices i..j, e.g. '((A1 A2) A3)'."""
    if i == j:
        return f"A{i + 1}"
    k = split[i][j]
    return f"({parenthesize(split, i, k)} {parenthesize(split, k + 1, j)})"


def matrix_chain_order(dims: list[int]) -> tuple[int, str]:
    """The fewest multiplications and one order that achieves it."""
    n = len(dims) - 1
    if n < 1:
        return 0, ""
    cost, split = matrix_chain_tables(dims)
    return cost[0][n - 1], parenthesize(split, 0, n - 1)
