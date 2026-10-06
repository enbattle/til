---
title: 'Dynamic Programming: Two Sequences'
summary: Comparing two strings by filling a table with one row per prefix of the first and one column per prefix of the second, to find their longest common subsequence or the fewest edits that turn one into the other.
date: 2026-10-01
kind: pattern
---

Some questions are about how two sequences relate to each other. How much do two
versions of a file have in common? How many keystrokes does it take to fix a
typo into the word you meant? Both can be answered by comparing prefixes: the
first few characters of one string against the first few characters of the
other. The number of ways to line two strings up is enormous, but there are
only (length of `a` + 1) × (length of `b` + 1) pairs of prefixes, and each pair
is answered from three neighbouring pairs. This entry covers two classic
problems, the longest common subsequence and the edit distance, and then
shrinks the second one's table to a single row.

## Prerequisites

- [Dynamic Programming: Memoization and Tabulation](/dsa/dynamic-programming): the
  vocabulary is reused without re-teaching it. A **subproblem** is a smaller
  version of the question, a **recurrence** is the rule that builds a
  subproblem's answer from smaller ones, and **tabulation** fills a table of
  answers from the smallest subproblem up.
- [Dynamic Programming: Grids](/dsa/dp-grids): the table here is a grid filled
  row by row, left to right, so that each cell's neighbours are done before it
  is. That entry also shows why a table can shrink to one row, and why the
  fill direction then matters; the last walkthrough step relies on both.

## The idea

A **subsequence** of a string is what you get by deleting any number of its
characters (possibly none) without reordering the rest. `"ace"` is a
subsequence of `"abcde"`; `"aec"` is not, because it reverses `c` and `e`. It
differs from a **substring**, which must be a contiguous run of characters. The
**longest common subsequence** (LCS) of two strings is the longest string that
is a subsequence of both.

Write `a[:i]` for the first `i` characters of `a`, so `a[:0]` is the empty
string. The subproblem for the pair `(i, j)` is the question about `a[:i]` and
`b[:j]`, and its answer lives in `table[i][j]`. The table has `len(a) + 1` rows
and `len(b) + 1` columns: row 0 and column 0 are the **empty-prefix** row and
column, for the case where one side has no characters yet. Their answers are
known without looking at any other cell, and they let every other cell treat
"one step back" as a valid index.

**Longest common subsequence.** Look at the last characters of the two
prefixes, `a[i - 1]` and `b[j - 1]` (the character at position `i` counting from
1 is at index `i - 1`). There are two cases.

If they are equal, some longest common subsequence of the two prefixes ends with
that character, so the answer is one more than the answer for both prefixes
without it: `table[i][j] = table[i - 1][j - 1] + 1`.

If they differ, the two characters can't both be the last character of a common
subsequence, so at least one of them is unused. Drop `a[i - 1]` and look at
`table[i - 1][j]`, or drop `b[j - 1]` and look at `table[i][j - 1]`, and keep the
larger: `table[i][j] = max(table[i - 1][j], table[i][j - 1])`. The row and column
for the empty prefix are all 0, because nothing is common with an empty string.

Here is the table for `a = "ABCBD"` (rows) and `b = "BDCB"` (columns). The first
row and first column are the empty prefixes:

```text
        ""  B  D  C  B
    ""   0  0  0  0  0
    A    0  0  0  0  0
    B    0  1  1  1  1
    C    0  1  1  2  2
    B    0  1  1  2  3
    D    0  1  2  2  3
```

The bottom-right cell is the answer for the whole strings: 3. Take the `C` row
and the last column (`B`), where the entry is 2. `C` and `B` differ, so it is
the larger of the cell above (the first `B` row, same column: 1) and the cell
to the left (the `C` row, column `C`: 2), which is 2. In the second `B` row and
the last column the characters match, so the entry is the diagonal cell (the
`C` row, column `C`: 2) plus 1, which is 3.

The table only holds lengths. To recover an actual subsequence, start at the
bottom-right corner and walk back, asking at each cell how it was filled. If
the two characters match, that character is part of the answer: record it and
step diagonally up and left. Otherwise step to whichever neighbour, above or to
the left, holds the larger value, since that is the one the cell copied. Stop on
reaching an empty prefix. The characters come out last to first, so reverse
them. On the table above the walk visits these cells:

| Cell `(i, j)` | Characters | Step                                     |
| ------------- | ---------- | ---------------------------------------- |
| `(5, 4)`      | `D` vs `B` | differ; above is 3, left is 2: go up     |
| `(4, 4)`      | `B` vs `B` | match: take `B`, go diagonal             |
| `(3, 3)`      | `C` vs `C` | match: take `C`, go diagonal             |
| `(2, 2)`      | `B` vs `D` | differ; above is 0, left is 1: go left   |
| `(2, 1)`      | `B` vs `B` | match: take `B`, go diagonal to `(1, 0)` |

Column 0 is the empty prefix, so the walk stops. The characters were taken in
the order `B`, `C`, `B`, which reversed is `BCB` (a palindrome, so it looks the same), a
subsequence of both strings: in `ABCBD` it sits at positions 2, 3 and 4, in
`BDCB` at positions 1, 3 and 4. When the two neighbours are equal there are
several longest
common subsequences and the walk picks one of them; the code below prefers
going up.

**Edit distance.** The **edit distance** between two strings is the fewest
single-character edits that turn one into the other, where an edit is an
insert, a delete or a replace, each costing 1. (It is also called the
Levenshtein distance.) Now `table[i][j]` is the fewest edits that turn `a[:i]`
into `b[:j]`. The empty-prefix row and column are not zeros here: turning the
empty string into `b[:j]` takes `j` inserts, and turning `a[:i]` into the empty
string takes `i` deletes, so `table[0][j] = j` and `table[i][0] = i`.

For any other cell, think about the last character of `a[:i]`. If it equals
`b[j - 1]`, nothing needs to happen to it, and the cost is the diagonal:
`table[i][j] = table[i - 1][j - 1]`. If it differs, there are three ways out,
and each of the three neighbouring cells is exactly one of them plus 1 edit:

- **Above**, `table[i - 1][j]`: delete `a[i - 1]`. The remaining `a[:i - 1]`
  still has to become all of `b[:j]`.
- **Left**, `table[i][j - 1]`: insert `b[j - 1]` at the end. `a[:i]` already
  has to become only `b[:j - 1]`, and the inserted character covers the last
  one.
- **Diagonal**, `table[i - 1][j - 1]`: replace `a[i - 1]` with `b[j - 1]`. Both
  last characters are used up, and the prefixes before them still have to
  match.

So `table[i][j] = 1 + min(above, left, diagonal)`. Taking the diagonal for free
when the characters match is safe because neighbouring cells in the table never
differ by more than 1, so the above or left cell plus the edit it costs is never
better than the diagonal. Here is the table for `a = "flaw"` and
`b = "lawn"`:

```text
        ""  l  a  w  n
    ""   0  1  2  3  4
    f    1  1  2  3  4
    l    2  1  2  3  4
    a    3  2  1  2  3
    w    4  3  2  1  2
```

The answer is 2. Walking back from the corner shows the edits: in the `w` row,
`w` and `n` differ and the cell to the left (1) is the smallest neighbour, so the
last step was inserting `n`. Then `w` matches `w` (diagonal), `a` matches `a`,
`l` matches `l`, and the final step is at `(1, 0)`, the cost of deleting `f`.
Delete `f`, insert `n`: `flaw` becomes `law` becomes `lawn`.

**One row is enough.** A cell reads three cells: above, left and diagonal, all in
the current and previous rows. So two rows are enough, and so is one row,
as in [Dynamic Programming: Grids](/dsa/dp-grids). The twist is that a grid
path sum reads only above and left, while here the diagonal is also needed. In
a single array `row`, going left to right, `row[j]` holds the cell above until
it is overwritten and `row[j - 1]` already holds the cell to the left. The
diagonal, `table[i - 1][j - 1]`, was in `row[j - 1]` one step ago, but that slot
has just been overwritten with this row's value. So the old value has to be
saved in a variable before it is lost, and carried one column to the right.

## When to use it

The signal is two sequences (strings, arrays, lists of tokens) and a question
about aligning them: what they share, how far apart they are, or the best way to
match them up. The same table with a different recurrence covers a family of
problems. The longest common substring uses the match rule but resets to 0 on a
mismatch and takes the maximum anywhere in the table. Checking whether one
string is a subsequence of another needs no table at all, just a
[two pointers](/dsa/two-pointers) scan. Whether a string matches a pattern with
wildcards, and the number of ways one string appears as a subsequence of
another, are filled the same way. Many tools that compare two versions of a
file build on the LCS of their lines, and spelling suggestions often rank
candidates by edit distance.

If you only need to know whether two strings are within a small distance `k`,
a table that stays within `k` of the diagonal does less work. And a table over
two sequences gets expensive for very long inputs, as the Complexity section
shows, so diffing huge files uses cleverer algorithms.

## Walkthrough

Both languages compare strings by **code point**, a single Unicode character
such as `a` or `😀`. Python strings are sequences of code points already. A
JavaScript string is a sequence of 16-bit units (see
[Arrays and strings](/dsa/arrays-and-strings)), where `😀` counts as 2, so the TypeScript code turns
each string into an array with `Array.from`, which splits by code point. A
character made of several code points, such as an emoji with a skin tone, is
still several characters here.

```python
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
```

```typescript
// Strings are compared by code point (Array.from), not by UTF-16 code unit, so an
// emoji counts as one character, as it does in Python.

/** table[i][j] is the length of the longest common subsequence of a[:i], b[:j]. */
export function lcsTable(a: string, b: string): number[][] {
  const x = Array.from(a);
  const y = Array.from(b);
  const table = Array.from({ length: x.length + 1 }, () =>
    new Array<number>(y.length + 1).fill(0),
  );
  for (let i = 1; i <= x.length; i++) {
    for (let j = 1; j <= y.length; j++) {
      if (x[i - 1] === y[j - 1]) {
        table[i][j] = table[i - 1][j - 1] + 1;
      } else {
        table[i][j] = Math.max(table[i - 1][j], table[i][j - 1]);
      }
    }
  }
  return table;
}
```

The table is one row and one column bigger than the strings, and it starts all
zeros, which is already the right answer for the empty-prefix row and column, so
the loops start at 1 and never write them. That extra row and column is the
reason the code can read `table[i - 1][j - 1]` for `i = 1` without a special
case. Without it, the first character of either string would need its own
branch, and a negative index in Python wraps around to the other end of the list
and silently reads a wrong cell. Because the table is indexed by prefix length,
the characters themselves are at `a[i - 1]` and `b[j - 1]`: writing `a[i]`
instead compares the wrong pair and runs off the end of the string at the last
row. The rows are built with a comprehension (`Array.from` in TypeScript) so
each is a separate list; `[[0] * n] * m` would make every row the same list.

```python
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
```

```typescript
/** Length of the longest subsequence that a and b have in common. */
export function lcsLength(a: string, b: string): number {
  const table = lcsTable(a, b);
  return table[table.length - 1][table[0].length - 1];
}

/** One longest common subsequence of a and b, found by walking the table back. */
export function lcs(a: string, b: string): string {
  const x = Array.from(a);
  const y = Array.from(b);
  const table = lcsTable(a, b);
  let i = x.length;
  let j = y.length;
  const picked: string[] = [];
  while (i > 0 && j > 0) {
    if (x[i - 1] === y[j - 1]) {
      picked.push(x[i - 1]);
      i--;
      j--;
    } else if (table[i - 1][j] >= table[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  return picked.reverse().join('');
}
```

The answer for the whole strings is the corner cell. `lcs` reruns the walk the
table was filled by, in reverse, and every step relies on the table's values
rather than recomputing anything. The loop stops when either index reaches 0,
because an empty prefix has no characters left to collect. On a match the step
is diagonal and the character is kept; the tempting alternative of keeping the
character and stepping only up (or only left) would leave the other string's
character available to match again, so one character could be used twice and
the result would not be a subsequence of both. On a mismatch the walk follows
the larger neighbour, since the cell's value was copied from it: following the
smaller one would give up length that the table says is available. The
`>=` only decides which of two equally good paths to take. Characters are
collected from the end of the strings towards the start, so the list is
reversed before joining.

```python
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
```

```typescript
/** Fewest single-character inserts, deletes and replaces that turn a into b. */
export function editDistance(a: string, b: string): number {
  const x = Array.from(a);
  const y = Array.from(b);
  const table = Array.from({ length: x.length + 1 }, () =>
    new Array<number>(y.length + 1).fill(0),
  );
  for (let i = 0; i <= x.length; i++) table[i][0] = i;
  for (let j = 0; j <= y.length; j++) table[0][j] = j;
  for (let i = 1; i <= x.length; i++) {
    for (let j = 1; j <= y.length; j++) {
      if (x[i - 1] === y[j - 1]) {
        table[i][j] = table[i - 1][j - 1];
      } else {
        table[i][j] =
          1 +
          Math.min(
            table[i - 1][j], // delete x[i - 1]
            table[i][j - 1], // insert y[j - 1]
            table[i - 1][j - 1], // replace x[i - 1] with y[j - 1]
          );
      }
    }
  }
  return table[x.length][y.length];
}
```

The first two loops fill the empty-prefix row and column with their counting
values instead of leaving zeros, which is the one place this differs from the
LCS table: leaving them at 0 would claim that `"abc"` turns into the empty
string for free. Each comment says which operation a neighbour stands for, and
the direction is easy to get backwards: the cell above has used up one more
character of `a` than this cell has, so
reaching this cell from it means `a[i - 1]` was deleted; the cell to the left
has used one fewer character of `b`, so the step adds `b[j - 1]`, an insert; and
the diagonal consumes one character of each, which is a replace. A character
that is already equal takes the diagonal at no cost, with no `1 +`. Adding 1
there would count a replace of a character by itself, and `edit_distance("a",
"a")` would come out as 1.

```python
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
```

```typescript
/** Same answer as editDistance, keeping one row and one saved diagonal. */
export function editDistanceRolling(a: string, b: string): number {
  const x = Array.from(a);
  const y = Array.from(b);
  const row = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i++) {
    let diagonal = row[0];
    row[0] = i;
    for (let j = 1; j <= y.length; j++) {
      const above = row[j];
      if (x[i - 1] === y[j - 1]) {
        row[j] = diagonal;
      } else {
        row[j] = 1 + Math.min(above, row[j - 1], diagonal);
      }
      diagonal = above;
    }
  }
  return row[y.length];
}
```

The row starts as row 0 of the table, `0, 1, 2, ...`. At the top of each pass
over `i`, `row` still holds row `i - 1`, so `row[0]` is the diagonal for column
1, and it is saved in `diagonal` before `row[0]` is overwritten with `i`, the
new first-column value. Inside the inner loop, `row[j]` is about to be replaced,
so its old value, the cell above, is saved in `above` first. Then `row[j]` is
computed from `above`, `row[j - 1]` (the cell to the left, already updated) and
`diagonal`. The last line, `diagonal = above`, is what makes the next column
right: the cell above this one is the up-left neighbour of the next cell. The
tempting version is `diagonal = row[j]`, written after the update, which
saves the new value instead of the old one. Run on `flaw` and `lawn` it returns
4, not 2, with no error. Reading the cell above straight from `row[j]` is
fine, because it hasn't been overwritten yet, but the diagonal has no such
luck, which is why this is the one value that needs a variable. The two-row
version keeps a `previous` row and a `current` row and needs no saved variable,
at the cost of a second array.

## Complexity

With `n = len(a)` and `m = len(b)`, the table has (n + 1)(m + 1) cells and each
is filled with a constant amount of work, so both problems take O(n × m) time.
The table versions use O(n × m) space. `edit_distance_rolling` uses O(m), one
row, and the same trick works with the roles swapped, so the shorter string can
be the row. Recovering the actual `lcs` needs the full table to walk back
through it, so it keeps O(n × m) space; the walk itself takes at most n + m
steps, since every step decreases `i`, `j` or both.

For two strings of 1,000 characters each, the table has 1,001 × 1,001 =
1,002,001 cells, about a million. A million small additions and comparisons is
quick, but two files of 100,000 lines would need 10 billion cells, which is why
the space saving matters at that size and why diff tools do not use this table
directly. The alternative without a table is trying every subsequence of `a`
and checking each against `b`. A string of `n` characters has 2^n subsequences:
for n = 40 that is more than a trillion.

## Pitfalls

- **Forgetting the empty-prefix row and column** in the edit-distance table.
  Leaving them at 0 makes turning a nonempty string into the empty one free.
  The LCS table gets away with zeros there only because that is the right
  answer for it.
- **Adding 1 on a match.** In the edit-distance recurrence a matching character
  takes the diagonal cell unchanged. Charging for it counts a replace of a
  character by itself.
- **Mixing up which neighbour is which operation.** Above is a delete from
  `a`, left is an insert of a character of `b`, diagonal is a replace. Since
  every edit costs 1, mixing them up still gives the right distance, which
  hides the mistake until you try to recover the edit sequence, or give
  insertions and deletions different costs.
- **Indexing the strings with `i` and `j`.** The table is one longer than the
  strings, so the characters are `a[i - 1]` and `b[j - 1]`. Using `a[i]` pairs
  each cell with the wrong character, and on the last row it reads past the end:
  an `IndexError` in Python, but in TypeScript `undefined`, which compares as
  unequal to any character and so gives a wrong answer without an error.
- **Overwriting the diagonal in the one-row version.** Saving the new value
  instead of the old one, or reading `row[j - 1]` as the diagonal after it was
  updated, gives wrong distances without any crash.
- **Treating a transposition as one edit.** Swapping two neighbouring
  characters is two replaces here: `edit_distance("ab", "ba")` is 2. Some
  variants (Damerau-Levenshtein) add transposition as a fourth operation, with
  a fourth term in the `min`.
- **Confusing subsequence with substring.** The longest common subsequence of
  `"abcde"` and `"ace"` is `"ace"`, length 3, though the strings share no
  substring longer than 1.
- **Assuming a character is one code point.** In Python and in the TypeScript
  here, `é` written as `e` followed by a combining accent is two characters, so
  it is 2 edits away from the single-code-point `é`. Normalise the text first
  if that matters. Comparing raw UTF-16 units would also split emoji in half,
  and then two different emoji that share their first unit would partly
  match.
