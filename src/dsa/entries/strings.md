---
title: String
summary: A string is an immutable array of characters, so building one piece by piece means collecting the pieces and joining once, and a "character" is a code point in Python but a UTF-16 code unit in JavaScript.
date: 2026-10-01
kind: data-structure
---

Text in a program is a string: a name, a line of a file, a whole web page.
Most interview problems that look like puzzles about words (is this a
palindrome, are these two words anagrams, what's the longest run without a
repeated letter) are array problems underneath, with two twists that catch
people out. Strings can't be changed in place, which makes the obvious way to
build one slow, and the "characters" you index aren't always the characters a
person sees. This entry covers both and builds a few small tools that get them
right in Python and TypeScript.

## Prerequisites

- [Array and Dynamic Array](/dsa/dynamic-array): a string is stored like an array, so
  reading `s[i]` costs O(1), and the string builder below leans on a dynamic
  array's O(1) amortized append.

## What it is

A **string** is a sequence of characters stored one after another, like an
array. Reading the character at index `i` is a jump to a known offset, so it
takes the same time at any `i`, and the length is stored alongside the
characters, so asking for it doesn't count them.

Strings in Python and JavaScript are **immutable**: once made, a string never
changes. Assigning `s[0] = "J"` doesn't work: Python raises a `TypeError`, and
JavaScript silently ignores it (or throws a `TypeError` in strict mode). Every operation
that seems to change a string, such as `upper()`, `replace()` or `+`, returns a
new one and leaves the old one as it was. That is what lets a string be a
dictionary key and be shared freely between parts of a program: nobody holding
a reference can see it change under them.

The cost shows up when you build a string a piece at a time:

```python
s = ""
for word in words:
    s += word
```

By the language's rules each `s += word` makes a new string and copies both
halves into it. Building `"xxxx"` one `"x"` at a time copies 1, then 2, then 3,
then 4 characters: 10 in all. For n pieces it's 1 + 2 + ... + n = n(n + 1) / 2
copies, which is O(n²) (big-O counts how the work grows with n, ignoring
constant factors). For 10,000 one-character pieces that's 50,005,000 character
copies to produce a 10,000-character string.

Real engines sometimes dodge this. CPython grows the string in place when
nothing else refers to it, and V8, the engine in Chrome and Node, records
`a + b` as a pair of pointers to the two halves and copies later. Neither is
promised: Python's style guide, PEP 8, says not to rely on CPython's trick,
Pythons that don't count references (PyPy, for one) don't have it, and a
second reference to the string is enough to turn it off. Timed in CPython
3.14 with a `t = s` line added inside the loop, doubling the number of appends from 20,000 to 40,000 to 80,000 roughly
quadrupled the time each step, the signature of O(n²). The portable fix is to
put the pieces in a list (an array in JavaScript) and join them once at the
end. Appending to a list doesn't copy the text, and `"".join(parts)` works out
the total length, allocates once and copies each character once: O(n).

### What a character is

Computers store numbers, so text needs a table from characters to numbers.
**Unicode** is that table: it gives every character a number called its
**code point**, written U+ followed by hex digits. `A` is U+0041, `é` is
U+00E9, and the emoji 😀 is U+1F600. Code points go up to U+10FFFF, too many to
fit in 16 bits.

An **encoding** decides how code points become bytes or fixed-size units in
memory, and here the two languages differ:

- **Python** strings are sequences of code points. `len("😀")` is 1 and
  `s[i]` is always one whole code point. CPython stores each string with 1, 2
  or 4 bytes per character, picked by the largest code point in that string,
  so every character is the same width and indexing stays O(1). One emoji in a
  string makes every character in it take 4 bytes.
- **JavaScript** strings are sequences of 16-bit **UTF-16 code units**. A code
  point up to U+FFFF is one unit. One above it, which includes most emoji, is
  split into two units called a **surrogate pair**. So `"😀".length` is 2, and
  `"😀"[0]` is `"\ud83d"`, half a character that means nothing on its own.

```text
             h      😀
Python   s:  [h]    [😀]              len(s) == 2
JS       s:  [h]    [\ud83d][\ude00]  s.length === 3
```

JavaScript can still walk a string by code point: `for (const c of s)`,
`[...s]` and `Array.from(s)` all step over surrogate pairs as one item. What
it can't do is jump to the k-th code point in O(1), because the units before
it may be one or two per code point.

Even a code point isn't always what a reader calls a character. `é` can be
written as one code point (U+00E9) or as `e` followed by a combining accent
(U+0301), and the US flag 🇺🇸 is two code points, the regional indicators for
U and S. A unit a reader sees as one character is a **grapheme**. Neither
language indexes by grapheme. JavaScript has `Intl.Segmenter` to split a
string into them; Python's standard library has nothing for it up to at least
3.14, so code that needs graphemes uses a third-party package such as `regex`,
whose `\X` pattern matches one.

## Operations and costs

n is the length of the string (or of the final string, for building), k the
length of a piece.

| Operation                       | Average                        | Worst case       |
| ------------------------------- | ------------------------------ | ---------------- |
| Read `s[i]`, length             | O(1)                           | O(1)             |
| `a + b`                         | O(len a + len b)               | O(len a + len b) |
| `s += piece`, n times in a loop | O(n) or O(n²), engine-specific | O(n²)            |
| Builder `append(piece)`         | O(1) amortized                 | O(pieces so far) |
| Builder `build()`               | O(n)                           | O(n)             |
| Compare `a == b`                | up to the first difference     | O(n)             |
| Python slice `s[i:i + k]`       | O(k)                           | O(k)             |
| `reverse_code_points`           | O(n)                           | O(n)             |
| `is_palindrome`                 | O(n)                           | O(n)             |
| Space                           | O(n)                           | O(n)             |

Reading `s[i]` is O(1) because every unit has the same width: in Python every
code point in a given string takes the same number of bytes, and in
JavaScript `s[i]` reads code unit `i`. Comparing two strings checks them
character by character until one differs, so equal strings cost the full
length and strings that differ early are cheap. A Python slice copies the k characters it selects into a new string.

The builder's `append` adds a reference to the piece to a dynamic array, which
is O(1) amortized: once in a while the array grows and copies its references,
which is the worst case in the table. The text itself is copied only once, in
`build`. `is_palindrome` looks at each character at most once from either end,
so it is O(n). The Python version needs O(1) extra space; the TypeScript one
builds an array of the code points first, which is O(n).

## Implementation

The builder keeps the pieces in a list and the running length beside it. Both
languages return the builder from `append`, so calls can be chained.

```python
from typing import Self


class StringBuilder:
    """Collects pieces in a list and joins them once, in time linear in the total."""

    def __init__(self) -> None:
        self._parts: list[str] = []
        self._length = 0

    def append(self, piece: str) -> Self:
        self._parts.append(piece)
        self._length += len(piece)
        return self

    def __len__(self) -> int:
        return self._length

    def build(self) -> str:
        text = "".join(self._parts)
        self._parts = [text]
        return text
```

```typescript
/** Collects pieces in an array and joins them once, in time linear in the total. */
export class StringBuilder {
  private parts: string[] = [];
  private units = 0;

  append(piece: string): this {
    this.parts.push(piece);
    this.units += piece.length;
    return this;
  }

  /** UTF-16 code units appended so far, the same count as `build().length`. */
  get length(): number {
    return this.units;
  }

  build(): string {
    const text = this.parts.join('');
    this.parts = [text];
    return text;
  }
}
```

`append` stores the piece and nothing else, so it never copies text. The length
is kept as a running total because summing the pieces' lengths on every call
would make `len(b)` O(number of pieces). The two lengths count different
things, matching each language: Python's `len` counts code points, so after
appending `"h"`, `"é"` and `"😀"` it is 3, while the TypeScript `length` counts
UTF-16 units and gives 4, the same as `build().length` would. `build` joins
once and then replaces the list with the single joined string, so a second
`build` with nothing new appended joins one piece instead of all of them again.

```python
def reverse_code_points(s: str) -> str:
    return s[::-1]
```

```typescript
export function reverseCodePoints(s: string): string {
  return Array.from(s).reverse().join('');
}
```

Reversing shows the encoding difference in one line each. Python's `s[::-1]`
is a slice that steps backwards, and since a Python string is a sequence of
code points, it reverses code points: `"a😀b"` becomes `"b😀a"`. A JavaScript
string has no `reverse`, so the code turns it into an array, reverses that and
joins it. `Array.from(s)` iterates the string, and iteration goes by code
point, so the emoji's two units travel together. Both versions reverse code
points, not graphemes: `"ét"` (é written with a combining accent, then
t) comes back as `"t́e"` with the accent on the t, and 🇺🇸 comes back as
🇸🇺.

```python
def is_palindrome(s: str) -> bool:
    """Whether s reads the same both ways, counting only letters and digits
    and ignoring case."""
    i, j = 0, len(s) - 1
    while i < j:
        if not s[i].isalnum():
            i += 1
        elif not s[j].isalnum():
            j -= 1
        elif s[i].lower() != s[j].lower():
            return False
        else:
            i += 1
            j -= 1
    return True
```

```typescript
const LETTER_OR_DIGIT = /^[\p{L}\p{N}]$/u;

/** Whether s reads the same both ways, counting only letters and digits
 * and ignoring case. */
export function isPalindrome(s: string): boolean {
  const chars = Array.from(s);
  let i = 0;
  let j = chars.length - 1;
  while (i < j) {
    if (!LETTER_OR_DIGIT.test(chars[i])) {
      i++;
    } else if (!LETTER_OR_DIGIT.test(chars[j])) {
      j--;
    } else if (chars[i].toLowerCase() !== chars[j].toLowerCase()) {
      return false;
    } else {
      i++;
      j--;
    }
  }
  return true;
}
```

The palindrome check walks one index in from each end. Each pass of the loop
does exactly one thing: skip a character on the left that isn't a letter or
digit, skip one on the right, give up on a mismatch, or step both inward after
a match. Doing one thing per pass is what keeps the skipping safe: `i` and `j`
are compared again before any character is read, so a string of nothing but
punctuation never runs an index off the end. The loop stops when the indexes
meet or cross; a middle character left on its own matches itself.

"Letter or digit" means the same in both: Python's `isalnum()` is true exactly
for the Unicode categories L (letters) and N (numbers), which is what
`[\p{L}\p{N}]` matches. The TypeScript version first spreads the string into
an array of code points so that `i` and `j` step over a whole emoji or an
astral letter at a time, as Python's indexes already do.

Here is `"Race car!"`, nine characters with indexes 0 to 8:

| i   | j   | `s[i]` | `s[j]` | Step                    |
| --- | --- | ------ | ------ | ----------------------- |
| 0   | 8   | `R`    | `!`    | `!` isn't alnum: j to 7 |
| 0   | 7   | `R`    | `r`    | match ignoring case     |
| 1   | 6   | `a`    | `a`    | match                   |
| 2   | 5   | `c`    | `c`    | match                   |
| 3   | 4   | `e`    | space  | space isn't: j to 3     |
| 3   | 3   |        |        | i < j fails: `True`     |

## Invariants

- **The builder's text is every piece appended, in order.** `append` adds to
  the end of the list and `build` replaces the list with its own join, which
  is the same text.
- **The stored length equals the length of that text**, counted the
  language's way (code points in Python, UTF-16 units in TypeScript). `append`
  adds each piece's length and `build` doesn't change the text.
- **In `is_palindrome`, everything outside `i..j` has been checked.** The
  letters and digits left of `i` match, in reverse order, the ones right of
  `j`, ignoring case. When `i` and `j` meet, nothing is left to check, so the
  answer is `True`.

## Tricky lines

- `self._parts = [text]` in `build`, rather than leaving the list alone or
  emptying it. Leaving it alone is still correct but makes every `build` join
  all the pieces again. Emptying it (`[]`) loses everything: a `build`, an
  `append("y")` and another `build` would return `"y"` instead of `"xy"`.
- `Array.from(s)` in `reverseCodePoints`, not `s.split('')`. `split('')` cuts
  the string into UTF-16 units, so the two halves of a surrogate pair are
  reversed separately: `"a😀"` comes back as `"\ude00\ud83da"`, three units
  that are a broken character followed by `a`. The same mistake in
  `isPalindrome` would also break letters outside U+FFFF. The Deseret capital
  `𐐀` and its lowercase `𐐨` are two units each, and after `split('')` neither
  half is a letter, so `"𐐀b"` would be skipped down to `"b"` and called a
  palindrome.
- `/^[\p{L}\p{N}]$/u` with the `u` flag and without `g`. Without `u`, `\p` is
  not a Unicode property escape at all: `/[\p{L}]/` matches the letter `p`
  and the characters `{`, `L` and `}`, and doesn't match `é`. With `g`, a
  regex remembers where its last match ended in `lastIndex` and starts the
  next `test` there, so the same pattern tested on `"a"` three times returns
  `true`, `false`, `true`, and the palindrome check would skip letters at
  random.
- `s[i].lower() != s[j].lower()` in Python, comparing one character at a
  time instead of lowering the whole string first. Lowercasing a whole string
  follows rules that look at a letter's neighbours: Greek capital sigma `Σ`
  becomes `ς` at the end of a word and `σ` elsewhere, so `"ΣAΣ".lower()` is
  `"σaς"`, which reads differently backwards, while lowering each character
  alone gives `σ`, `a`, `σ`. The letter-by-letter check treats both ends the
  same way.

## When to use it

Every program uses strings; the decisions are about building and indexing
them. Build text from many pieces with a list and `join` (or the builder
above), not with `+=` in a loop, whatever language you're in. In JavaScript,
remember that `length`, `s[i]` and `slice` count UTF-16 units: use
`Array.from(s)` or `for...of` when the text can hold emoji or other characters
above U+FFFF, and `Intl.Segmenter` when what matters is what the reader sees.

In interviews, a string problem is usually an array problem in disguise. The
palindrome check above is the [two pointers](/dsa/two-pointers) pattern.
Counting characters, as in "are these two words anagrams?", is a
[hash map](/dsa/hash-map) from character to count. Many interview problems say
the input is lowercase ASCII letters; that lets you use a 26-slot array
instead of a map, and it's worth asking whether the input can hold anything
else before you rely on it.
