---
title: 'Dynamic Programming: Intervals'
summary: Solving a problem by answering it for every contiguous range i..j of the input, shortest ranges first, so that longest palindromic subsequence and the cheapest order to multiply a chain of matrices become a filled-in triangle of table cells.
date: 2026-10-01
kind: pattern
---

Interval dynamic programming (DP) is the version of DP where a subproblem is a
contiguous range of the input, written `i..j`: the characters from position `i`
to position `j` of a string, or the matrices from the `i`th to the `j`th of a
chain. The answer for a long range is built from answers for shorter ranges
inside it, and the written-down results form a two-dimensional table indexed by
`i` and `j`. Two problems show the pattern: the longest palindromic
subsequence of a string, and the cheapest order in which to multiply a chain of
matrices. A note on the name: this is not the [Intervals](/dsa/intervals) entry,
which is about sorting `[start, end]` pairs and merging the overlapping ones;
nothing here is a start/end pair, and the "interval" is a range of positions in
the input.

## Prerequisites

- [Dynamic Programming: One Dimension](/dsa/dp-one-dimensional): the vocabulary
  used throughout (subproblem, recurrence, base case, table) and the idea that
  a bottom-up table has to be filled in an order where every entry's inputs are
  already written. Here the table has two indices instead of one, and getting
  that order right is the main new difficulty. That entry also explains the
  big-O notation (O(n), O(n²)) used here.

## The idea

A string of `n` characters has n(n + 1) / 2 ranges `i..j` with `i <= j`: 15
for a five-character string. Interval DP keeps one table cell per range. The
cell `table[i][j]` answers the question for exactly the characters (or
matrices) from `i` to `j`, both included, and the final answer is the cell for
the whole input, `table[0][n - 1]`. Every recurrence below reads cells for
strictly shorter ranges, so the table can be filled from short ranges to long
ones.

### Longest palindromic subsequence

A **palindrome** reads the same forwards and backwards (`racecar`). A
**subsequence** keeps some of the characters of a string in their original
order, not necessarily next to each other, so `bbbb` is a subsequence of
`bbbab` and `abcba` is one of `agbcba`. (A **substring** must be contiguous;
the longest palindromic substring of `bbbab` is `bbb`, length 3, shorter than
the subsequence.) The question is how long the longest palindromic subsequence
of a string is.

Let `table[i][j]` be that length for the characters `s[i..j]`. Look at the two
ends, `s[i]` and `s[j]`:

- If they are equal, they can be the outermost pair of the palindrome:
  `table[i][j] = table[i + 1][j - 1] + 2`, two for the matching pair plus the
  best palindrome strictly inside. This is safe because some longest
  palindrome can always be arranged to use both ends: if it uses neither,
  wrapping it in the two equal characters makes a longer one, and if it uses
  only one end, its other outermost character equals that end's character and
  can be moved to the other end.
- If they differ, they cannot both be the outer pair, so at least one is not in
  the answer, and `table[i][j] = max(table[i + 1][j], table[i][j - 1])`: drop
  the left end or drop the right end, and keep whichever leaves the better
  palindrome.

The base cases are the ranges of length 1, a single character, which is a
palindrome of length 1. The range `i + 1..i`, which reads backwards, has no
characters, and its answer is 0.

For `s = bbbab` the filled table is below, with rows `i` and columns `j`.
Cells with `j < i` are not ranges and stay 0.

| `i` \ `j` | 0 (b) | 1 (b) | 2 (b) | 3 (a) | 4 (b) |
| --------- | ----- | ----- | ----- | ----- | ----- |
| 0 (b)     | 1     | 2     | 3     | 3     | 4     |
| 1 (b)     | 0     | 1     | 2     | 2     | 3     |
| 2 (b)     | 0     | 0     | 1     | 1     | 3     |
| 3 (a)     | 0     | 0     | 0     | 1     | 1     |
| 4 (b)     | 0     | 0     | 0     | 0     | 1     |

Recomputing a few cells: `table[0][1]` is `bb`, equal ends, so 0 + 2 = 2.
`table[1][3]` is `bba`: `b` and `a` differ, so the better of `table[2][3]`
(`ba`, 1) and `table[1][2]` (`bb`, 2), which is 2. `table[0][4]` is the whole
string: both ends are `b`, so `table[1][3] + 2 = 4`, the length of `bbbb`.

**Why the fill order matters.** Cell `(i, j)` reads `(i + 1, j - 1)`,
`(i + 1, j)` and `(i, j - 1)`: the row below, and the cell to the left. If you
fill row by row from the top, as you would for a grid, row 0 is computed while
row 1 is still all zeros, and every answer comes out too small. Two orders are
correct. One is by increasing length: all ranges of length 2, then 3, and so
on, since every cell it reads has a smaller length. The other is `i` from the
last row up to row 0, with `j` left to right in each row, so the row below is
complete before it is read. The code below uses lengths, because that order is
the one that carries over to the second problem.

**Recovering the palindrome.** The table holds lengths, not the choices made.
To get a palindrome back, start at the whole range `(0, n - 1)` and replay the
decisions, recomputing each one from the table. Equal ends: record the
character and move both inward. Different ends: move toward the side whose
cell is larger. When `i` and `j` meet on one character, that is the middle.
For `bbbab`: ends `b`, `b` match (record `b`, now range 1..3); `b` and `a`
differ and `table[2][3] = 1 < table[1][2] = 2`, so drop the right end (range
1..2); `b`, `b` match (record `b`) and the pointers cross. The recorded half
is `bb`, and mirrored it gives `bbbb`.

### Matrix-chain multiplication order

Multiplying a matrix of size `p x q` (p rows, q columns) by one of size `q x r`
takes p * q * r scalar multiplications and gives a `p x r` matrix. The
inner sizes must match. Matrix multiplication is associative, so a chain
`A1 A2 A3` can be bracketed as `((A1 A2) A3)` or `(A1 (A2 A3))` and the product
is the same, but the cost may differ a great deal. The problem is to find the
bracketing with the fewest scalar multiplications. The input is a list `dims`
of `n + 1` numbers for `n` matrices, where matrix `k` (counting from 0) is
`dims[k] x dims[k + 1]`, so neighbours match by construction.

With `dims = [10, 30, 5, 60]`: `A1` is 10 x 30, `A2` is 30 x 5, `A3` is 5 x 60.

- `((A1 A2) A3)`: `A1 A2` costs 10 * 30 * 5 = 1,500 and is 10 x 5; times `A3`
  costs 10 * 5 * 60 = 3,000. Total 4,500.
- `(A1 (A2 A3))`: `A2 A3` costs 30 * 5 * 60 = 9,000 and is 30 x 60; `A1`
  times that costs 10 * 30 * 60 = 18,000. Total 27,000.

Same product, six times the work. For a long chain the number of bracketings
grows very fast, so trying them all is out; DP works because the last
multiplication splits the chain in one place.

Let `cost[i][j]` be the fewest multiplications for matrices `i..j` (0-based,
both included). A single matrix costs nothing, `cost[i][i] = 0`. For a longer
range, try every **split point** `k` with `i <= k < j`: multiply `i..k` into one
matrix, multiply `k + 1..j` into another, then multiply those two. The left
product is `dims[i] x dims[k + 1]`, the right is `dims[k + 1] x dims[j + 1]`, so
joining them costs `dims[i] * dims[k + 1] * dims[j + 1]`:

```text
cost[i][j] = min over k in i..j-1 of
             cost[i][k] + cost[k + 1][j] + dims[i] * dims[k + 1] * dims[j + 1]
```

The two ranges `i..k` and `k + 1..j` are both shorter than `i..j`, so, as
before, filling by increasing length works. For `[10, 30, 5, 60]`:

- Length 1: `cost[0][0] = cost[1][1] = cost[2][2] = 0`.
- Range `0..1`, one split: k = 0 gives 0 + 0 + 10 * 30 * 5 = 1,500.
- Range `1..2`, one split: k = 1 gives 0 + 0 + 30 * 5 * 60 = 9,000.
- Range `0..2`, two splits. k = 0 gives `cost[0][0] + cost[1][2]` plus
  10 * 30 * 60, which is 0 + 9,000 + 18,000 = 27,000. k = 1 gives
  `cost[0][1] + cost[2][2]` plus 10 * 5 * 60, which is 1,500 + 0 + 3,000 =
  4,500. The smaller is k = 1, so `cost[0][2] = 4,500` and `split[0][2] = 1`.

The answer is `cost[0][2] = 4,500`, matching the hand count.

**Recovering the order.** Alongside each `cost[i][j]`, store the `k` that won,
`split[i][j]`. To print the bracketing for `i..j`, split at `split[i][j]` and
bracket the left part `i..k` and the right part `k + 1..j` the same way,
stopping at a single matrix. Here `split[0][2] = 1`, so the top-level
split is `(A1 A2) | A3`, giving `((A1 A2) A3)`. A four-matrix chain,
`dims = [40, 20, 30, 10, 30]`, comes out at 26,000 multiplications with the
order `((A1 (A2 A3)) A4)`.

## When to use it

Look for a problem about a contiguous range of the input where the best answer
for the range comes from deciding something at its ends or at one place inside
it, and the pieces left over are again ranges of the same input. Two
shapes cover most cases. "Peel an end" problems look at `s[i]` and `s[j]` and
shrink to `i + 1..j`, `i..j - 1` or `i + 1..j - 1`, like palindromic
subsequences, and like the game where two players take coins from either end of
a row. "Try every split" problems choose a `k` and combine `i..k` with
`k + 1..j`, like matrix-chain order, and like finding the cheapest way to
bracket an expression or to merge a row of piles one pair at a time.

The signal is that the subproblem is a pair of positions, not one, and that
the pieces are contiguous. If the subproblem is "the first `i` items", that is
[one-dimensional DP](/dsa/dp-one-dimensional). If the input has no useful
contiguous structure, or the answer can be built by one greedy pass, interval
DP is more machinery than the problem needs. The cost is also a signal: a
table over all ranges is n² cells, and trying every split makes it n³, so this
is for inputs of hundreds, not millions.

## Walkthrough

```python
def lps_table(s: str) -> list[list[int]]:
    """table[i][j]: length of the longest palindromic subsequence of s[i..j]."""
    n = len(s)
    table = [[0] * n for _ in range(n)]
    for i in range(n):
        table[i][i] = 1
```

```typescript
/** table[i][j]: length of the longest palindromic subsequence of s[i..j]. */
export function lpsTable(s: string): number[][] {
  const n = s.length;
  const table = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) table[i][i] = 1;
```

The table is built with a comprehension so each row is its own list. Writing
`[[0] * n] * n` makes n references to one row, and setting one cell changes the
same column in every row (running it with n = 2 and setting `g[0][0]` leaves
`[[1, 0], [1, 0]]`). Everything starts at 0, and that matters beyond tidiness:
the cells below the diagonal stand for the empty range, and the recurrence
reads them. When two equal characters sit side by side, the range inside them is
`i + 1..i`, so `table[i + 1][i]` must be 0 for the answer to come out as 0 + 2.
The diagonal is the base case, one character, length 1.

```python
    for length in range(2, n + 1):
        for i in range(n - length + 1):
            j = i + length - 1
            if s[i] == s[j]:
                table[i][j] = table[i + 1][j - 1] + 2
            else:
                table[i][j] = max(table[i + 1][j], table[i][j - 1])
    return table
```

```typescript
  for (let length = 2; length <= n; length++) {
    for (let i = 0; i + length <= n; i++) {
      const j = i + length - 1;
      if (s[i] === s[j]) {
        table[i][j] = table[i + 1][j - 1] + 2;
      } else {
        table[i][j] = Math.max(table[i + 1][j], table[i][j - 1]);
      }
    }
  }
  return table;
}
```

The outer loop is the length, starting at 2 because length 1 is already
filled. The invariant is that when a length is being processed, every range of
a smaller length is complete, and each cell reads only smaller ranges. The
inner loop's bound is `n - length + 1` start positions: the last window starts
at `n - length` and ends at `n - 1`. A bound of `n - length` would leave the
last window of each length unfilled, including, at the final length, the whole
string. The end is derived as `j = i + length - 1`, not looped over, so
`i..j` always has exactly `length` characters. The `+ 2` in the equal-ends
branch is the matching pair; leaving it as `+ 1` makes every answer too small,
and the brute-force tests fail on that edit.

```python
def lps_length(s: str) -> int:
    """Length of the longest palindromic subsequence of s (0 for an empty s)."""
    if not s:
        return 0
    return lps_table(s)[0][len(s) - 1]
```

```typescript
/** Length of the longest palindromic subsequence of `s` (0 for an empty `s`). */
export function lpsLength(s: string): number {
  if (s.length === 0) return 0;
  return lpsTable(s)[0][s.length - 1];
}
```

The answer is the cell for the whole string: row 0, last column, the top-right
corner of the table. The empty-string guard is needed because the table has no
rows: `[0][-1]` raises `IndexError` in Python and a `TypeError` in TypeScript,
and the right answer for no characters
is 0.

```python
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
```

```typescript
/** One longest palindromic subsequence of `s`, read back out of the table. */
export function longestPalindromicSubsequence(s: string): string {
  if (s.length === 0) return '';
  const table = lpsTable(s);
  let i = 0;
  let j = s.length - 1;
  const outer: string[] = [];
  let middle = '';
  while (i <= j) {
    if (i === j) {
      middle = s[i];
      break;
    }
    if (s[i] === s[j]) {
      outer.push(s[i]);
      i++;
      j--;
    } else if (table[i + 1][j] >= table[i][j - 1]) {
      i++;
    } else {
      j--;
    }
  }
  const half = outer.join('');
  return half + middle + [...half].reverse().join('');
}
```

This walks from the outside in and only ever collects the left half of the
palindrome, because the right half is the same characters reversed. The
`i == j` check comes before comparing `s[i]` with `s[j]`, since a single
character would otherwise match itself and be added to the half twice. The loop
condition is `<=` so that case is reached; `<` would never place a middle
character, so odd-length palindromes like `abcba` would come out one character
short. After two equal ends are taken, `i` can pass `j` (the string `aa`): then
the loop ends with an empty middle, which is right for an even length. The
`elif` reads two cells, each of which is the answer for one end dropped, and
moves toward the larger. When they tie, either move is correct; `>=` picks the
left one, which is why `ab` gives `b` and `ba` gives `a`. Only the table is
read, so this costs O(n) on top of building it.

```python
def matrix_chain_tables(dims: list[int]) -> tuple[list[list[int]], list[list[int]]]:
    """Matrix k is dims[k] x dims[k + 1]. Returns (cost, split) for every range."""
    n = len(dims) - 1
    cost = [[0] * n for _ in range(n)]
    split = [[0] * n for _ in range(n)]
```

```typescript
/** Matrix k is dims[k] x dims[k + 1]. Returns [cost, split] for every range. */
export function matrixChainTables(dims: number[]): [number[][], number[][]] {
  const n = dims.length - 1;
  const cost = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  const split = Array.from({ length: n }, () => new Array<number>(n).fill(0));
```

`dims` has one more entry than there are matrices, so `n = len(dims) - 1`;
treating `len(dims)` as the matrix count is an off-by-one that makes the last
index `dims[j + 1]` run off the end of the list. The `cost` table is
initialised to 0 because the diagonal, a single matrix, costs nothing and needs
no further code. `split` is a second table of the same shape that will hold the
winning `k` for each range, so the order can be recovered later. Its diagonal is
never read.

```python
    for length in range(2, n + 1):
        for i in range(n - length + 1):
            j = i + length - 1
            cost[i][j], split[i][j] = min(
                (cost[i][k] + cost[k + 1][j] + dims[i] * dims[k + 1] * dims[j + 1], k)
                for k in range(i, j)
            )
    return cost, split
```

```typescript
  for (let length = 2; length <= n; length++) {
    for (let i = 0; i + length <= n; i++) {
      const j = i + length - 1;
      let best = Infinity;
      for (let k = i; k < j; k++) {
        const total = cost[i][k] + cost[k + 1][j] + dims[i] * dims[k + 1] * dims[j + 1];
        if (total < best) {
          best = total;
          split[i][j] = k;
        }
      }
      cost[i][j] = best;
    }
  }
  return [cost, split];
}
```

The loop structure is the same as before, by increasing length, and for the
same reason: both `cost[i][k]` and `cost[k + 1][j]` are shorter ranges, so they
are final when read. The inner loop is over split points `k` from `i` up to
`j - 1`. It stops before `j` because `k = j` would leave `k + 1..j` empty, so
there would be nothing to multiply the left product by. Python takes the
`min` of `(total, k)` pairs, which compares totals first and carries `k` along,
so one expression yields the best cost and where it was; on a tie the smaller
`k` wins. TypeScript keeps a running best and updates `split` only on a strict
`<`, which also keeps the smaller `k` on a tie, so the two languages return the
same order. The last index in the product is `dims[j + 1]`, not `dims[j]`:
matrix `j` is `dims[j] x dims[j + 1]`, and the right-hand product ends in its
column count. Writing `dims[j]` there gives wrong costs that look plausible.

```python
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
```

```typescript
/** Fewest scalar multiplications to multiply the whole chain (0 if no pair). */
export function matrixChainCost(dims: number[]): number {
  const n = dims.length - 1;
  if (n < 1) return 0;
  return matrixChainTables(dims)[0][0][n - 1];
}

/** Bracketed multiplication order for matrices i..j, e.g. '((A1 A2) A3)'. */
export function parenthesize(split: number[][], i: number, j: number): string {
  if (i === j) return `A${i + 1}`;
  const k = split[i][j];
  return `(${parenthesize(split, i, k)} ${parenthesize(split, k + 1, j)})`;
}
```

The cost of the whole chain is the top-right cell, `cost[0][n - 1]`. When
`dims` has fewer than two numbers there are no matrices, so `n < 1` returns 0
before indexing an empty table; a single matrix (`dims` of length 2) has `n = 1`
and reads its diagonal cell, 0. `parenthesize` rebuilds the order by recursion
that mirrors the recurrence: a range of one matrix is its name, and any longer
range is split at the stored `k` into two ranges that are bracketed the same
way. The base case `i == j` is what stops it. It is correct to stop there
because `split` has no meaningful entry on the diagonal, and nothing is read
from it. Names are 1-based (`A1`) to match how chains are usually written.

```python
def matrix_chain_order(dims: list[int]) -> tuple[int, str]:
    """The fewest multiplications and one order that achieves it."""
    n = len(dims) - 1
    if n < 1:
        return 0, ""
    cost, split = matrix_chain_tables(dims)
    return cost[0][n - 1], parenthesize(split, 0, n - 1)
```

```typescript
/** The fewest multiplications and one order that achieves it. */
export function matrixChainOrder(dims: number[]): [number, string] {
  const n = dims.length - 1;
  if (n < 1) return [0, ''];
  const [cost, split] = matrixChainTables(dims);
  return [cost[0][n - 1], parenthesize(split, 0, n - 1)];
}
```

This ties the two together: build both tables once, read the cost from the
corner and the bracketing from the split table. It builds the tables itself
instead of calling `matrix_chain_cost` and then `parenthesize`, which would
fill them twice. The tests check the result against every bracketing of
randomly generated chains of up to seven matrices: the cost must equal the
cheapest, and the returned order must be one of the bracketings with that cost.

## Complexity

The palindrome table has one cell per range, and each cell is filled in O(1):
a comparison and at most two lookups. So `lps_table` is O(n²) time and O(n²)
space. For 1,000 characters, that is 500,500 ranges, and the table allocates
1,000,000 cells because the code stores the full square. Recovering the
palindrome adds O(n) time, since every step moves `i` up or `j` down.

Matrix-chain order has the same n² ranges, but each range tries up to
`length - 1` split points. Adding that up, the number of (range, split) pairs
is (n³ - n) / 6, which is 166,650 for n = 100 and about 166 million for
n = 1,000, so time is O(n³). Space is O(n²) for the two tables. Rebuilding the
bracketing visits each matrix once, O(n) time, with recursion up to n deep.

Compare the alternatives. A brute force over subsequences looks at 2ⁿ of them:
over a million for a 20-character string. The number of ways to bracket a chain
of n matrices grows roughly four-fold per extra matrix, which is why the table
is needed. For matrix-chain order, faster algorithms than O(n³) exist, but the
cubic table is the standard answer and needs no extra ideas.

## Pitfalls

- **Filling the table row by row from the top.** Cell `(i, j)` reads the row
  below it, which is still zeros, so every answer is too small. Fill by
  increasing length, or fill rows from the bottom up.
- **A range that is off by one at the end.** `range(n - length + 1)` start
  positions, not `n - length`; the short version silently skips the last window
  of every length.
- **Mixing up subsequence and substring.** The recurrence above is for
  subsequences. `bbbab` has a longest palindromic subsequence of 4 but a longest
  palindromic substring of 3; a substring problem needs the table to answer "is
  `s[i..j]` itself a palindrome" instead.
- **Starting the table non-zero.** The cells under the diagonal are read for
  adjacent equal characters and must be 0. Filling the whole table with 1, to
  save the diagonal loop, gives 1 + 2 = 3 for `aa`.
- **The wrong dimension index.** `n` matrices need `n + 1` dimensions, and the
  join cost ends in `dims[j + 1]`. Using `len(dims)` as the count or `dims[j]`
  for the last factor gives wrong, plausible-looking numbers.
- **Treating the recovered answer as the only answer.** Several palindromes or
  bracketings can tie. `ab` has two longest palindromic subsequences, `a` and
  `b`, and the code returns `b`; four equal 4 x 4 matrices cost the same in
  every bracketing, and the code returns one of them. Tests should check
  validity and optimal value, not one exact string.
- **Forgetting the empty and one-element inputs.** An empty string has no table
  to index, and a chain of fewer than two matrices has no multiplication to
  price; both need their guard.
