---
title: Array and Dynamic Array
summary: A row of equal-sized slots that reaches any index in one step, and the doubling trick that lets it grow while appends stay cheap on average.
date: 2026-10-01
kind: data-structure
---

An array is the simplest way to store a sequence: put the items next to each
other in memory and find any of them by its position. Python's `list`,
JavaScript's `Array` and Java's `ArrayList` are all built on it, and most other
structures in this tab are built on top of one of those. This entry starts with
the fixed-size array the hardware gives you, then builds the dynamic array
that languages hand you instead, and shows why its occasional slow append
doesn't make appending slow.

## Prerequisites

None. You need to know what a variable and a loop are, and that a computer's
memory is a long row of numbered bytes, where each number is called an
**address**.

## What it is

A **fixed-size array** is a block of memory split into equal-sized slots, one
after another. Its **capacity**, the number of slots, is chosen when it's
created and never changes. Because every slot is the same size, the address of
slot `i` is plain arithmetic: `start + i × slot_size`. With an array that
starts at address 1000 and holds 8-byte numbers, slot 3 is at
1000 + 3 × 8 = 1024. The computer jumps there directly; it doesn't walk past
slots 0, 1 and 2. That's why reading or writing `a[i]` takes the same time
for any `i`, which is called **random access**.

Slots are numbered from 0, so an array of length n has indexes 0 to n − 1.
Python lists hold items of any size because each slot stores a fixed-size
reference (an address) to an object that lives elsewhere, not the object
itself. JavaScript's typed arrays are real fixed-size arrays: an `Int32Array`
created with a length of 10 keeps 10 slots of 4 bytes each.

The trouble with a fixed size is that you rarely know it in advance. A
**dynamic array** fixes that. It keeps a fixed-size array for storage, called
the **backing array**, plus a count of how many slots are in use, its
**length**. The slots past the length are spare. Appending writes into the
next spare slot. When there are none left, it allocates a new backing array
twice as large, copies every item across, and drops the old one; that is a
**resize**. Removing items can shrink it the same way.

Here are five appends to a dynamic array that starts with capacity 1. An
underscore is a spare slot:

```text
append a   [a]                 length 1, capacity 1, copied 0
append b   [a b]               full: grow to 2, copy 1 item, then write b
append c   [a b c _]           full: grow to 4, copy 2 items, then write c
append d   [a b c d]           a spare slot, no copying
append e   [a b c d e _ _ _]   full: grow to 8, copy 4 items, then write e
```

Five appends cost 5 writes plus 1 + 2 + 4 = 7 copies.

Inserting into the middle is different. To put `x` at index 1 of
`[a b c d e]`, every item from index 1 onward moves one slot right to open a
gap, then `x` goes in: `[a x b c d e]`. Removing from index 1 moves them back
left to close the gap. Either way, the cost grows with how many items sit
after the index.

## Operations and costs

The costs use big-O notation, with n the length: O(1) means the work doesn't
grow with n, and O(n) means it grows in proportion to n. **Amortized** means
averaged over a long run of operations, where an occasional expensive one is
paid for by the many cheap ones around it.

| Operation                     | Average        | Worst case |
| ----------------------------- | -------------- | ---------- |
| `a[i]`, `a[i] = v` (get, set) | O(1)           | O(1)       |
| `append(v)` / `push(v)`       | O(1) amortized | O(n)       |
| `pop()` from the end          | O(1) amortized | O(n)       |
| `insert(i, v)`                | O(n)           | O(n)       |
| `pop(i)` / `removeAt(i)`      | O(n)           | O(n)       |
| Find a value (no index given) | O(n)           | O(n)       |
| Space                         | O(n)           | O(n)       |

Get and set are one address calculation. Insert and remove at index i shift
the n − i items after it, so they're cheap near the end and cost a full O(n)
at the front. Finding a value, rather than an index, means checking items one
by one unless the array is sorted.

The worst case of an append is a resize, which copies all n items. Doubling is
what keeps the average down: after a resize to capacity 2c, the next one
doesn't come until c more appends have arrived. Count the copies for n appends
starting from capacity 1. Resizes copy 1, 2, 4, 8 and so on items, each a
power of two smaller than n, and a sum of powers of two 1 + 2 + … + 2^k is
2^(k+1) − 1, under 2n. Nine appends copy 1 + 2 + 4 + 8 = 15 items, under
2 × 9 = 18. Add the n writes and the total stays under 3n: a constant amount
of work per append, on average. Any growth factor above 1 gives the same
result with a different constant. CPython's list grows by about an eighth
plus a few slots, and Java's `ArrayList` by half, trading more frequent
copies for less spare memory.

Growing by a fixed number of slots instead, say 10 at a time, breaks this.
Then a resize comes every 10 appends and copies everything, so n appends copy
about 10 + 20 + … + n, roughly n² / 20 items: O(n) per append.

Shrinking follows the same logic. The code below halves the capacity when the
length drops to a quarter of it. A resize leaves the array about half full:
with capacity c, it holds about c/2 items. The next resize needs either about
c/2 more appends (then it copies c items) or about c/4 more pops (then it
copies c/4), so each copy is paid for by at least a quarter as many cheap
operations. Space is O(n) plus the starting capacity, since pops shrink the
backing array before it gets much more than four times the length.

## Implementation

Both versions keep the backing array in a language list that they never grow
or shrink in place: it is created at a fixed size and only ever replaced by a
new one, which is what a fixed-size array allows. The Python class follows
`list` (`a[i]`, `append`, `insert`, `pop(i)`, negative indexes counting from
the end). The TypeScript class follows `Array` (`push`, `pop` returning
`undefined` when empty) with explicit `get`, `set` and `removeAt`, since
TypeScript can't overload `a[i]` for a class.

```python
from collections.abc import Iterator
from typing import Any, Generic, TypeVar

T = TypeVar("T")


class DynamicArray(Generic[T]):
    """A growable array on fixed-size storage that doubles when it fills up."""

    def __init__(self, capacity: int = 4):
        if capacity < 1:
            raise ValueError("capacity must be at least 1")
        self._data: list[Any] = [None] * capacity
        self._size = 0

    def __len__(self) -> int:
        return self._size

    @property
    def capacity(self) -> int:
        return len(self._data)
```

```typescript
/** A growable array on fixed-size storage that doubles when it fills up. */
export class DynamicArray<T> {
  private data: (T | undefined)[];
  private count = 0;

  constructor(capacity = 4) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new RangeError('capacity must be a positive integer');
    }
    this.data = new Array<T | undefined>(capacity).fill(undefined);
  }

  get length(): number {
    return this.count;
  }

  get capacity(): number {
    return this.data.length;
  }
```

The backing array is `capacity` empty slots, and the length is a separate
counter. The two numbers are different things: `capacity` is how many slots
exist and the length is how many hold items. A capacity of 0 is refused
because doubling 0 gives 0, so the first append would find no room even after
"growing". In TypeScript, `new Array(n)` alone makes n holes, slots that don't
exist at all (`0 in arr` is `false`); `fill(undefined)` creates each slot, the
way a block of memory has every slot from the start.

```python
    def _index(self, index: int) -> int:
        if index < 0:
            index += self._size
        if not 0 <= index < self._size:
            raise IndexError("index out of range")
        return index

    def __getitem__(self, index: int) -> T:
        return self._data[self._index(index)]

    def __setitem__(self, index: int, value: T) -> None:
        self._data[self._index(index)] = value

    def __iter__(self) -> Iterator[T]:
        for i in range(self._size):
            yield self._data[i]
```

```typescript
  private checkIndex(index: number, last = this.count - 1): void {
    if (!Number.isInteger(index) || index < 0 || index > last) {
      throw new RangeError(`index ${index} is out of range`);
    }
  }

  get(index: number): T {
    this.checkIndex(index);
    return this.data[index] as T;
  }

  set(index: number, value: T): void {
    this.checkIndex(index);
    this.data[index] = value;
  }

  *[Symbol.iterator](): IterableIterator<T> {
    for (let i = 0; i < this.count; i++) yield this.data[i] as T;
  }
```

The index check compares against the length, not the capacity. Slot 5 of
`[a b c d e _ _ _]` exists in memory, but it holds no item, and reading it
would hand back a leftover `None` as if it were data. Python's `__getitem__`
and `__setitem__` are what `a[i]` and `a[i] = v` call, and `__iter__` makes
`for x in a` and `list(a)` work; it stops at the length for the same reason.
The TypeScript iterator does the same for `for...of` and `[...a]`.

```python
    def _resize(self, new_capacity: int) -> None:
        new_data: list[Any] = [None] * new_capacity
        new_data[: self._size] = self._data[: self._size]
        self._data = new_data

    def append(self, value: T) -> None:
        if self._size == len(self._data):
            self._resize(2 * len(self._data))
        self._data[self._size] = value
        self._size += 1
```

```typescript
  private resize(capacity: number): void {
    const next = new Array<T | undefined>(capacity).fill(undefined);
    for (let i = 0; i < this.count; i++) next[i] = this.data[i];
    this.data = next;
  }

  push(value: T): void {
    if (this.count === this.data.length) this.resize(this.data.length * 2);
    this.data[this.count] = value;
    this.count++;
  }
```

`append` resizes only when every slot is in use, then writes to slot `length`,
the first spare one. The resize copies only the first `length` slots; the
spare ones are empty, so copying them would be wasted work. The Python
`new_data[: self._size] = ...` replaces that many slots with the same number
of items, so the new list keeps its full capacity.

```python
    def insert(self, index: int, value: T) -> None:
        if not 0 <= index <= self._size:
            raise IndexError("insert index out of range")
        if self._size == len(self._data):
            self._resize(2 * len(self._data))
        self._data[index + 1 : self._size + 1] = self._data[index : self._size]
        self._data[index] = value
        self._size += 1
```

```typescript
  insert(index: number, value: T): void {
    this.checkIndex(index, this.count);
    if (this.count === this.data.length) this.resize(this.data.length * 2);
    this.data.copyWithin(index + 1, index, this.count);
    this.data[index] = value;
    this.count++;
  }
```

`insert` accepts any index from 0 to the length inclusive, because inserting
at the length means "after the last item" and is just an append. It makes
room first, since the shift needs one spare slot to move into, then shifts
slots `index` to `length − 1` one place right and writes the value into the
gap. Python's own `list.insert` never raises: it treats an index past either
end as that end. This version raises instead, so a wrong index shows up as an
error rather than an item in an unexpected place.

```python
    def pop(self, index: int = -1) -> T:
        index = self._index(index)
        value = self._data[index]
        self._data[index : self._size - 1] = self._data[index + 1 : self._size]
        self._size -= 1
        self._data[self._size] = None
        if self._size <= len(self._data) // 4 and len(self._data) > 1:
            self._resize(len(self._data) // 2)
        return value
```

```typescript
  removeAt(index: number): T {
    this.checkIndex(index);
    const value = this.data[index] as T;
    this.data.copyWithin(index, index + 1, this.count);
    this.count--;
    this.data[this.count] = undefined;
    if (this.count <= this.data.length / 4 && this.data.length > 1) {
      this.resize(Math.floor(this.data.length / 2));
    }
    return value;
  }

  pop(): T | undefined {
    return this.count === 0 ? undefined : this.removeAt(this.count - 1);
  }
}
```

Removing saves the value, shifts the later items one slot left over it, and
shrinks the length. Popping the last item shifts nothing, which is why
`pop()` is cheap and `pop(0)` isn't. The `len(self._data) > 1` condition
stops the halving at capacity 1, so the capacity never reaches 0. Python's
`pop` raises `IndexError` on an empty array, as `list.pop` does; the
TypeScript `pop` returns `undefined`, as `Array.prototype.pop` does.

## Invariants

These hold after every call returns:

- **0 ≤ length ≤ capacity, and capacity ≥ 1.** The items are in slots 0 to
  length − 1, in order, with no gaps. Every index check and every shift relies
  on this.
- **Every slot from length to capacity − 1 is empty** (`None` or
  `undefined`). Nothing reads those slots, but a leftover reference there
  would keep an object alive in memory.
- **The backing array changes size only by being replaced.** It's created at
  a fixed size, and after the constructor makes the first one, `_resize` is
  the only place a new one is made.

## Tricky lines

- `self._data[index + 1 : self._size + 1] = self._data[index : self._size]` in
  `insert`, and `copyWithin(index + 1, index, this.count)` in TypeScript. The
  source and destination overlap, so the order of copying matters. The obvious
  hand-written loop, `for j in range(index, size): data[j + 1] = data[j]`, goes
  left to right and overwrites each item before moving it: inserting `x` at
  index 1 of `[a b c d e]` gives `[a x b b b b]`. A loop has to run from the
  right end down. Python evaluates the right-hand slice into a new list before
  assigning it, and `copyWithin` is specified to copy correctly when the
  source and target overlap, so neither can make that mistake.
- `self._data[self._size] = None` in `pop` (`this.data[this.count] = undefined`
  in `removeAt`). Leaving it out doesn't change any answer, since the slot is
  past the length and is never read. But the old reference stays in the backing
  array, so the garbage collector, which frees objects nothing refers to any
  more, can't free that object. An array that once held a thousand large
  objects and was then emptied would keep them all alive.
- `self._size <= len(self._data) // 4` in `pop`, where `// 2` looks more
  natural. With halving at half full, an array at capacity 4 holding 4 items
  thrashes: an append grows it to 8 (copying 4), a pop leaves 4 items in 8
  slots and shrinks it back to 4 (copying 4), the next append grows it again,
  and every operation costs O(n). Waiting until a quarter full leaves room on
  both sides of each resize.
- `if not 0 <= index <= self._size` in `insert`, `<=` where `_index` uses `<`.
  An item can go in at the length (after the last item) but can't be read
  from there. Using `_index` for `insert` would reject inserting into an empty
  array at all.
- `index += self._size` in `_index`. It adds the length once, so −1 means the
  last item and −length the first; −length − 1 becomes −1 and is still
  rejected by the range check that follows, the same as `list` does.

## When to use it

An array is the default sequence. Use one when you append at the end, read by
position, or walk the items in order, which covers most lists in most
programs. Walking in order is faster than the O(n) suggests next to other
structures, because the processor loads memory in small blocks (typically 64
bytes) and the next item is usually in the block it just loaded; reading from
memory the processor hasn't loaded yet costs about a hundred times more than
reading from its fastest cache (see
[Numbers every engineer should know](/engineering-practices/numbers-every-engineer-should-know)).
A sorted array also supports [binary search](/dsa/binary-search), and
[two pointers](/dsa/two-pointers) works on one with no extra memory.

Pushing and popping at the end is exactly a [stack](/dsa/stack), and a Python
list or JavaScript array is the usual way to write one. Removing from the
front is the operation an array is bad at: `list.pop(0)` shifts every
remaining item, so a loop that empties a list from the front is O(n²) overall.
For a queue, use Python's `collections.deque`, whose `popleft` is O(1), or the
circular buffer in [Queue and Deque](/dsa/queue-and-deque). A
[linked list](/dsa/linked-list) inserts and removes at a known node in O(1)
but loses random access, so finding position i means walking i nodes.
