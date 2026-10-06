---
title: Arrays and Strings
summary: Items in one block of memory, reachable by position in one step, where growing is cheap on average and a string is the same block that can never be edited.
date: 2026-10-05
kind: data-structure
template: 2
---

An array stores items side by side in memory, and a string is an array of characters that can't be changed once made. Python's `list`, JavaScript's `Array` and Java's `ArrayList` are all dynamic arrays, and most structures in this tab sit on top of one. You'll build one that grows, then learn why a string needs different handling.

## Prerequisites

None. You need to know what a variable and a loop are, and that memory is a long row of numbered bytes, each number called an **address**.

## What it is

A fixed-size **array** is a block of memory cut into equal slots. Slot `i` sits at `start + i × slot_size`, so with 8-byte slots starting at address 1000, slot 3 is at 1000 + 3 × 8 = 1024. The computer jumps straight there without walking past slots 0, 1 and 2. That's **random access**: reading or writing `a[i]` costs the same for every `i`.

The catch is that the size is fixed when you ask for the block. A **dynamic array** hides that. It keeps a fixed-size **backing array** plus a **length**, the number of slots in use; the rest are spare. Appending writes into the next spare slot. When none is left, it allocates a backing array twice as big, copies every item over and drops the old one.

Append `a` to `e` to an empty one that starts with room for 1, and the resizes fall at `b`, `c` and `e`:

```text
append a   [a]                 nothing to copy
append b   [a b]               full: double to 2, copy 1, then write b
append c   [a b c _]           full: double to 4, copy 2, then write c
append d   [a b c d]           spare slot, no copy
append e   [a b c d e _ _ _]   full: double to 8, copy 4, then write e
```

Five appends cost 5 writes and 1 + 2 + 4 = 7 copies. Inserting `x` at index 1 of that array is different: `b`, `c`, `d` and `e` each move one slot right to open a gap, giving `[a x b c d e]`.

Why double? Why not add 10 slots each time? Because copying everything every 10 appends makes the copies pile up: 1,000 appends copy about 50,000 items, where doubling copies 1 + 2 + 4 + … + 512 = 1,023. The rule: grow by a factor, never by a fixed amount.

### Strings

A **string** is an array of characters with one restriction: Python and JavaScript make it **immutable**. Every operation that looks like an edit (`upper()`, `replace()`, `+`) returns a new string. That's why strings work as dictionary keys, and it's also why this is slow:

```python
s = ""
for word in words:
    s += word
```

Each `+=` copies everything so far into a new string. Ten thousand one-character pieces cost 1 + 2 + … + 10,000 = 50,005,000 copies. Some engines optimize this, but neither language promises it, so don't count on it. Collect the pieces in a list and join once; the join measures the total, allocates once and copies each character once.

The second string trap is what an index points at. **Unicode** gives every character a number, its **code point** (😀 is U+1F600), and an **encoding** turns those into units in memory. Python strings are sequences of code points. JavaScript strings are sequences of 16-bit units, so a code point above U+FFFF, which includes most emoji, takes two units called a **surrogate pair**. For `"ab😀"`:

```text
Python       [a] [b] [😀]               len(s) == 3
JavaScript   [a] [b] [\ud83d] [\ude00]  s.length === 4
```

`s[3]` in JavaScript is half an emoji, which means nothing alone. Even a code point isn't always what a reader sees as a character: `é` can be `e` plus a combining accent, two code points.

## When to use it

- The input is a list, a sequence or a string, and the work is reading or writing by position: "the i-th item", "swap two", "scan left to right".
- You add at the end and read anywhere. That's a dynamic array's best case.
- You insert or delete near the front or middle often. The cost grows with the number of items after the index, which is the cue to reach for another structure.
- The problem is about words or characters (palindromes, anagrams, a longest run without a repeat). It's an array problem once you remember the string can't be edited.
- You build a long string in a loop, or the input includes emoji or accents.

## Operations and costs

n is the length. **Amortized** means averaged over a long run of operations, where an occasional expensive one is paid for by the cheap ones around it.

| Operation                       | Average          | Worst case       |
| ------------------------------- | ---------------- | ---------------- |
| `a[i]`, length                  | O(1)             | O(1)             |
| `append`                        | O(1) amortized   | O(n)             |
| `insert(i, x)` or remove at `i` | O(n)             | O(n)             |
| Remove from the end             | O(1)             | O(1)             |
| Find a value                    | O(n)             | O(n)             |
| `a + b` on strings              | O(len a + len b) | O(len a + len b) |
| `StringBuilder.append`          | O(1) amortized   | O(k), k pieces   |
| `StringBuilder.build`           | O(n)             | O(n)             |
| Space                           | O(n)             | O(n)             |

Insertion shifts the n − i items after index `i`, so the end is cheap and the front is O(n).

An append's worst case is a resize that copies all n items. Doubling is what keeps the average small: after a resize to capacity 2c, the next one waits for c more appends. The copies for n appends are 1 + 2 + 4 + … up to a power of two below n, which sums to less than 2n. With the n writes, the total stays under 3n, a constant amount per append. Growing by 1.5 or 1.125 instead (as Java and CPython do) trades more frequent copies for less spare memory.

## Implementation

The array's storage is a list that the code never resizes in place: it only ever replaces it with a bigger one, as a fixed block of memory would be.

```python
from typing import Any, Generic, Self, TypeVar

T = TypeVar("T")

class DynamicArray(Generic[T]):
    """A growable array on fixed-size storage that doubles when it fills."""

    def __init__(self) -> None:
        self._data: list[Any] = [None]
        self._size = 0

    def __len__(self) -> int:
        return self._size

    @property
    def capacity(self) -> int:
        return len(self._data)

    def __getitem__(self, i: int) -> T:
        # Check against the length, not the capacity: the spare slots past it
        # would hand back None as if it were an item.
        if not 0 <= i < self._size:
            raise IndexError(i)
        return self._data[i]
```

```typescript
/** A growable array on fixed-size storage that doubles when it fills. */
export class DynamicArray<T> {
  private data: (T | undefined)[] = [undefined];
  private count = 0;

  get length(): number {
    return this.count;
  }

  get capacity(): number {
    return this.data.length;
  }

  get(i: number): T {
    // Check against the length, not the capacity: the spare slots past it
    // would hand back undefined as if it were an item.
    if (!Number.isInteger(i) || i < 0 || i >= this.count) {
      throw new RangeError(`index ${i} out of range`);
    }
    return this.data[i] as T;
  }
```

Capacity and length are separate numbers: capacity is how many slots exist, length how many hold items. Starting at capacity 1 matches the table above. TypeScript can't overload `a[i]` on a class, so it uses `get`.

```python
    def insert(self, i: int, item: T) -> None:
        # i == length is allowed: that is an append.
        if not 0 <= i <= self._size:
            raise IndexError(i)
        if self._size == len(self._data):
            # Double rather than add a fixed number of slots: a fixed step
            # copies everything every few appends, so n appends cost O(n^2).
            bigger: list[Any] = [None] * (2 * len(self._data))
            bigger[: self._size] = self._data
            self._data = bigger
        # Shift from the right end: from the left, each item would overwrite
        # its neighbor before that neighbor had moved.
        for j in range(self._size, i, -1):
            self._data[j] = self._data[j - 1]
        self._data[i] = item
        self._size += 1

    def append(self, item: T) -> None:
        self.insert(self._size, item)
```

```typescript
  insert(i: number, item: T): void {
    // i === length is allowed: that is an append.
    if (!Number.isInteger(i) || i < 0 || i > this.count) {
      throw new RangeError(`index ${i} out of range`);
    }
    if (this.count === this.data.length) {
      // Double rather than add a fixed number of slots: a fixed step
      // copies everything every few appends, so n appends cost O(n^2).
      const spare = new Array<T | undefined>(this.data.length).fill(undefined);
      this.data = this.data.concat(spare);
    }
    // Shift from the right end: from the left, each item would overwrite
    // its neighbor before that neighbor had moved.
    for (let j = this.count; j > i; j--) {
      this.data[j] = this.data[j - 1];
    }
    this.data[i] = item;
    this.count += 1;
  }

  append(item: T): void {
    this.insert(this.count, item);
  }
}
```

Appending is an insert whose shifting loop runs zero times, so one method covers both costs: O(1) at the end, O(n) at the front. The string fix is the same idea at a smaller scale: store the pieces, and do the expensive copy once.

```python
class StringBuilder:
    """Collects pieces and joins them once, in time linear in the total."""

    def __init__(self) -> None:
        self._parts: list[str] = []

    def append(self, piece: str) -> Self:
        # Storing the piece copies no text; += on a string would copy it all.
        self._parts.append(piece)
        return self

    def build(self) -> str:
        text = "".join(self._parts)
        # Keep the result as one piece, so a second build won't join it all again.
        self._parts = [text]
        return text
```

```typescript
/** Collects pieces and joins them once, in time linear in the total. */
export class StringBuilder {
  private parts: string[] = [];

  append(piece: string): this {
    // Storing the piece copies no text; += on a string would copy it all.
    this.parts.push(piece);
    return this;
  }

  build(): string {
    const text = this.parts.join('');
    // Keep the result as one piece, so a second build won't join it all again.
    this.parts = [text];
    return text;
  }
}
```

`new StringBuilder().append("ab").append("😀").build()` gives `"ab😀"` and copies each character once. Last, the code-point trap, using the running example:

```python
def reverse_code_points(s: str) -> str:
    # Python indexes code points, so a slice keeps an emoji whole. It still
    # splits an "e" from the combining accent written after it.
    return s[::-1]
```

```typescript
export function reverseCodePoints(s: string): string {
  // split('') cuts an emoji's surrogate pair in two; spread walks code points.
  // It still splits an "e" from the combining accent written after it.
  return [...s].reverse().join('');
}
```

Both return `"😀ba"`. `s.split('').reverse().join('')` in JavaScript would put the low half of the pair first and produce an invalid string.

## Pitfalls

- **Checking an index against the capacity.** In `__getitem__`, `0 <= i < len(self._data)` accepts slots past the length, so `a[3]` on `[a b c]` returns `None` instead of raising. Compare with `self._size`.
- **Shifting left to right.** Running `insert`'s loop as `for j in range(i + 1, self._size + 1)` copies `data[i]` into `data[i + 1]`, then that copy into `data[i + 2]`, so every item after `i` becomes a copy of the same one. Keep the loop `range(self._size, i, -1)`, from the right end.
- **Building a string with `+=`.** `self._parts.append(piece)` is the fix. In a loop, `s += piece` can be quadratic, and it is on any engine that doesn't hide the copying.
- **Treating a length as a count of characters.** `"ab😀"` is 3 in Python and 4 in JavaScript. Loops that stop at `s.length` or split on `''` cut emoji in half; spread the string, as `reverseCodePoints` does.
