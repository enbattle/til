def lcs_table(a: str, b: str) -> list[list[int]]:
    """table[i][j] is the length of the longest common subsequence of a[:i], b[:j]."""
    table = [[0] * (len(b) + 1) for _ in range(len(a) + 1)]
    for i in range(1, len(a) + 1):
        for j in range(1, len(b) + 1):
            if a[i - 1] == b[j - 1]:
                table[i][j] = table[i - 1][j - 1] + 1
            else:
                table[i][j] = max(table[i - 1][j], table[i][j - 1])
    return table


def lcs_length(a: str, b: str) -> int:
    """Length of the longest subsequence that a and b have in common."""
    return lcs_table(a, b)[len(a)][len(b)]


def lcs(a: str, b: str) -> str:
    """One longest common subsequence of a and b, found by walking the table back."""
    table = lcs_table(a, b)
    i, j = len(a), len(b)
    picked: list[str] = []
    while i > 0 and j > 0:
        if a[i - 1] == b[j - 1]:
            picked.append(a[i - 1])
            i -= 1
            j -= 1
        elif table[i - 1][j] >= table[i][j - 1]:
            i -= 1
        else:
            j -= 1
    return "".join(reversed(picked))


def edit_distance(a: str, b: str) -> int:
    """Fewest single-character inserts, deletes and replaces that turn a into b."""
    table = [[0] * (len(b) + 1) for _ in range(len(a) + 1)]
    for i in range(len(a) + 1):
        table[i][0] = i
    for j in range(len(b) + 1):
        table[0][j] = j
    for i in range(1, len(a) + 1):
        for j in range(1, len(b) + 1):
            if a[i - 1] == b[j - 1]:
                table[i][j] = table[i - 1][j - 1]
            else:
                table[i][j] = 1 + min(
                    table[i - 1][j],  # delete a[i - 1]
                    table[i][j - 1],  # insert b[j - 1]
                    table[i - 1][j - 1],  # replace a[i - 1] with b[j - 1]
                )
    return table[len(a)][len(b)]


def edit_distance_rolling(a: str, b: str) -> int:
    """Same answer as edit_distance, keeping one row and one saved diagonal."""
    row = list(range(len(b) + 1))
    for i in range(1, len(a) + 1):
        diagonal = row[0]
        row[0] = i
        for j in range(1, len(b) + 1):
            above = row[j]
            if a[i - 1] == b[j - 1]:
                row[j] = diagonal
            else:
                row[j] = 1 + min(above, row[j - 1], diagonal)
            diagonal = above
    return row[len(b)]
