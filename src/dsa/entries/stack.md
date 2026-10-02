---
title: Stack
summary: A pile you can only touch at the top, where the last item pushed is the first one popped, built on a dynamic array so both operations are O(1) amortized.
date: 2026-10-01
kind: data-structure
---

A stack is a list you can only touch at one end. Every program you have run
used one: the language keeps track of which function called which in a stack,
and that is why an error message lists the calls that led to it. In interviews
a stack is the answer whenever something opened has to be matched with the most
recent thing still open: brackets in an expression, tags in a page, folders on
a path. This entry builds one on a dynamic array and uses it to check whether
the brackets in a string are balanced.

## Prerequisites

- [Array and Dynamic Array](/dsa/dynamic-array), for how an array grows when it runs
  out of room, which is where the stack's O(1) amortized push comes from.

## What it is

Think of a pile of plates. You put a clean plate on top, and when you need one
you take it off the top. The plate at the bottom has been there longest and is
the last to leave. That rule is **LIFO**, last in, first out, and a stack is
any structure that enforces it. It has three operations:

- **push** puts an item on top.
- **pop** removes the top item and returns it.
- **peek** returns the top item without removing it.

Popping or peeking at an empty stack has no sensible answer, so it's an error.
Here is a stack after pushing 1, 2 and 3, then after one pop:

```text
push 1, 2, 3       pop() returns 3

  | 3 |  <- top
  | 2 |              | 2 |  <- top
  | 1 |              | 1 |
  +---+              +---+
```

A dynamic array fits this exactly when the top of the stack is the _end_ of the
array. Appending to the end and removing from the end never move any other
element, so neither depends on how many items the stack holds. Putting the top
at the front instead would make every push and pop shift all the other
elements over by one.

The everyday instance is the **call stack**. When a function is called, the
language pushes a **frame** holding that call's local variables and the place
to return to. When the function returns, its frame is popped and execution
continues in the frame now on top, which is the caller. A function that calls
itself too many times without returning keeps pushing frames until the runtime
refuses: Python raises `RecursionError` once the depth passes its limit (1000
by default, from `sys.getrecursionlimit()`), and V8, the JavaScript engine in
Chrome and Node.js, throws `RangeError: Maximum call stack size exceeded`. A
Python traceback says "most recent call last" because it prints the stack from
the bottom frame up to the top one, where the error happened.

## Operations and costs

The costs use big-O notation, with n the number of items: O(1) means the work
doesn't grow with n, and O(n) means it grows in proportion to n. **Amortized**
means averaged over a long run of operations, where an occasional expensive one
is paid for by the many cheap ones around it.

| Operation          | Average        | Worst case |
| ------------------ | -------------- | ---------- |
| `push(item)`       | O(1) amortized | O(n)       |
| `pop()`            | O(1) amortized | O(n)       |
| `peek()`           | O(1)           | O(1)       |
| `size`, empty test | O(1)           | O(1)       |
| Space              | O(n)           | O(n)       |

A push is usually one write into a spare slot at the end of the array. The
worst case is a push that finds the array full: the array allocates a bigger
block and copies every item into it, which is O(n). Growing by a constant
factor keeps that rare. If the capacity doubles and starts at 1, sixteen
pushes trigger copies at the 2nd, 3rd, 5th and 9th push, moving 1, 2, 4 and 8
items: 15 copies on top of the 16 writes. Each copy moves one more item than
all the earlier copies combined, and the last one moves fewer than n items, so
the copies add up to less than 2n for any n. With the n writes, that is under
three units of work per push on average, however many items there are.
CPython's `list` grows by about an eighth rather than doubling, which wastes less memory and costs more copies, but any
factor above 1 keeps the average O(1). Pop is O(1) for the same reason: it
removes the last item without moving the rest, and a runtime that shrinks a
list's storage after many pops (CPython does once the list falls under half its
allocation) does so rarely enough to average out the same way.

Space is O(n): one slot per item, plus the array's spare capacity, which is at
most a constant multiple of n.

## Implementation

Both versions wrap the language's own dynamic array, a Python `list` or a
JavaScript array, and expose only the stack operations. The wrapper is thin on
purpose: what it adds is the LIFO discipline (no reading or inserting in the
middle) and a clear error on an empty stack.

```python
from typing import Generic, TypeVar

T = TypeVar("T")


class Stack(Generic[T]):
    """A last-in, first-out stack on a dynamic array (a Python list)."""

    def __init__(self) -> None:
        self._items: list[T] = []

    def push(self, item: T) -> None:
        self._items.append(item)

    def pop(self) -> T:
        if not self._items:
            raise IndexError("pop from an empty stack")
        return self._items.pop()
```

```typescript
/** A last-in, first-out stack on a dynamic array (a JavaScript array). */
export class Stack<T> {
  private items: T[] = [];

  push(item: T): void {
    this.items.push(item);
  }

  pop(): T {
    if (this.items.length === 0) {
      throw new RangeError('pop from an empty stack');
    }
    return this.items.pop() as T;
  }
```

`T` is a type parameter, so a `Stack[str]` (or `Stack<string>`) is checked to
hold only strings. Python 3.12 has a shorter `class Stack[T]` syntax; the
`Generic[T]` form also runs on 3.11. Push is `append` (or `push`), which adds at
the end, and pop is the list's own `pop()` with no index, which removes from
the end. Both languages' `pop()` takes from the end unless told otherwise. An
index of 0, `pop(0)` in Python, or `shift()` in JavaScript, takes from the front
and shifts every remaining item down, making each pop O(n).

The empty check comes before the pop in both languages, for different reasons.
In Python, `[].pop()` already raises `IndexError`, so the check only gives a
message that names the stack instead of the list inside it. In JavaScript,
`[].pop()` doesn't throw at all; it returns `undefined`, and a caller that
forgot to check would carry on with a value that was never pushed. The
TypeScript version throws a `RangeError`, the built-in error JavaScript uses
for a value outside the allowed range, as an array does for an invalid length.

```python
    def peek(self) -> T:
        if not self._items:
            raise IndexError("peek at an empty stack")
        return self._items[-1]

    def __len__(self) -> int:
        return len(self._items)

    def is_empty(self) -> bool:
        return not self._items
```

```typescript
  peek(): T {
    if (this.items.length === 0) {
      throw new RangeError('peek at an empty stack');
    }
    return this.items[this.items.length - 1];
  }

  get size(): number {
    return this.items.length;
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }
}
```

Peek reads the last slot. Python's index `-1` counts from the end; JavaScript
has no negative indexing with `[]` (`items[-1]` looks up a property named
`"-1"` and returns `undefined`), so it computes `length - 1`. Without the check,
peeking at an empty Python list would raise `IndexError: list index out of
range`, which points at the wrong thing. `__len__` is what Python's `len(s)`
calls, and an empty list is falsy, so `not self._items` is the idiomatic empty
test. TypeScript exposes `size` as a getter, read as `s.size` with no
parentheses, matching `Map` and `Set`.

```python
CLOSER_TO_OPENER = {")": "(", "]": "[", "}": "{"}
OPENERS = set(CLOSER_TO_OPENER.values())


def is_balanced(text: str) -> bool:
    """True if every bracket in text is closed by its partner, in the right order."""
    stack: Stack[str] = Stack()
    for ch in text:
        if ch in OPENERS:
            stack.push(ch)
        elif ch in CLOSER_TO_OPENER:
            if stack.is_empty() or stack.pop() != CLOSER_TO_OPENER[ch]:
                return False
    return stack.is_empty()
```

```typescript
const CLOSER_TO_OPENER: ReadonlyMap<string, string> = new Map([
  [')', '('],
  [']', '['],
  ['}', '{'],
]);
const OPENERS = new Set(CLOSER_TO_OPENER.values());

/** True if every bracket in text is closed by its partner, in the right order. */
export function isBalanced(text: string): boolean {
  const stack = new Stack<string>();
  for (const ch of text) {
    if (OPENERS.has(ch)) {
      stack.push(ch);
    } else if (CLOSER_TO_OPENER.has(ch)) {
      if (stack.isEmpty() || stack.pop() !== CLOSER_TO_OPENER.get(ch)) {
        return false;
      }
    }
  }
  return stack.isEmpty();
}
```

A string's brackets are **balanced** when every opener `(`, `[` or `{` is
closed by its own kind of closer, and a pair opened inside another pair closes
before the outer one does. A counter can't check that: `([)]` has one of each
bracket, yet `)` arrives while `[` is the most recent opener still open. The
most recent unclosed opener is exactly what a stack keeps on top. So each opener
is pushed, each closer pops and must match, and any other character is
skipped. The map goes from closer to opener because a closer is when the
question gets asked: "is the opener on top my partner?"

Three things can go wrong, and each has its own line. A closer that meets an
empty stack has nothing to close (`)`, or `())` at its third character). A
closer whose popped opener is the wrong kind is wrong nesting (`([)]`). And
openers left on the stack when the text runs out were never closed (`((()`),
which is why the function returns `stack.is_empty()` rather than `True`.

Here is `[(x)]{}` worked by hand, showing the stack after each character with
its top on the right:

| Char | Action                  | Stack after |
| ---- | ----------------------- | ----------- |
| `[`  | push                    | `[`         |
| `(`  | push                    | `[ (`       |
| `x`  | skip                    | `[ (`       |
| `)`  | pop `(`, partner of `)` | `[`         |
| `]`  | pop `[`, partner of `]` | empty       |
| `{`  | push                    | `{`         |
| `}`  | pop `{`, partner of `}` | empty       |

The text ends with an empty stack, so it's balanced. For `([)]`, the stack
holds `( [` when `)` arrives; the pop returns `[`, which isn't `)`'s partner,
so the answer is false at the third character without reading the fourth.
Each character is pushed or popped at most once, so the check is O(n) time for
a string of length n, and O(n) space in the worst case, a string of only
openers.

## Invariants

These hold after every call returns:

- **The top of the stack is the last element of the array.** Push appends
  there and pop removes from there, so no operation ever shifts the others.
- **The items below the top are in push order.** Nothing inserts or removes in
  the middle, so the item under the top is always the one pushed just before
  it that hasn't been popped yet. This is LIFO, and `is_balanced` depends on
  it: the top is always the most recent unclosed opener.
- **Pop and peek return only pushed values.** On an empty stack they raise
  instead of returning a placeholder, so a stored `None` or `undefined` is
  never confused with "nothing there".
- **In `is_balanced`, the stack holds only openers**, in the order they were
  opened, never a closer or another character.

## Tricky lines

- `return this.items.pop() as T;` in the TypeScript `pop`. The array's `pop()`
  is typed `T | undefined`, because it returns `undefined` on an empty array.
  The length check above has ruled that out, so the cast is safe. The tempting
  shortcut, calling `pop()` first and throwing if the result is `undefined`,
  breaks a `Stack<number | undefined>`: popping a stored `undefined` would
  throw "empty stack" while the stack still holds items. The tests push
  `undefined` and pop it back to catch this.
- `if stack.is_empty() or stack.pop() != CLOSER_TO_OPENER[ch]:` in
  `is_balanced`. The order of the two tests matters: `or` stops at the first
  true one, so `pop()` runs only on a stack that has something to pop. Written
  the other way round, a closer on an empty stack, the `)` at the end of
  `())`, would raise `IndexError` instead of returning false.
- `return stack.is_empty()` at the end of `is_balanced`, not `return True`.
  Reaching the end without a mismatch only proves that no closer was wrong.
  `((` has no closers at all, and `return True` would call it balanced.
- `if ch in OPENERS:` and `elif ch in CLOSER_TO_OPENER:` with no `else`. Any
  other character falls through and is skipped. An `else: return False` would
  reject `f(x) = [1, 2]`, which is balanced; treating every non-opener as a
  closer would pop the stack for each letter.
- `return self._items[-1]` in Python against `this.items[this.items.length - 1]`
  in TypeScript. Copying the Python form into TypeScript compiles and returns
  `undefined` every time, since `-1` is a property name there, not a position
  from the end. `this.items.at(-1)` would also work in modern JavaScript.

## When to use it

Reach for a stack when the next thing to handle is the most recent one still
open. Matching brackets, HTML tags or `begin`/`end` blocks is the classic case.
Undo works the same way: each edit is pushed, and undo pops the latest. A
browser's back button pops the page you came from. Depth-first search,
including any recursive function, is a stack too, either the call stack doing
it for you or an explicit one when the input is deep enough that recursion
would hit Python's 1000-frame limit. Evaluating an expression written in
postfix order (`3 4 + 2 *` for `(3 + 4) * 2`) pushes numbers and has each
operator pop two of them and push the result.

It's the wrong tool when you need the _oldest_ item first, such as serving
requests in the order they arrived. That is first in, first out, and a
[queue](/dsa/queue-and-deque) does it. Using a stack there serves the newest request
first and lets the oldest wait indefinitely. A stack also can't answer
questions about items below the top, such as "is this value anywhere in the
stack?", without popping its way down.
