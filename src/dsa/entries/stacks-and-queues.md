---
title: Stacks and Queues
summary: Two ways to hand items back, newest first (a stack) or oldest first (a queue), each in constant time by touching only the ends of an array.
date: 2026-10-05
kind: data-structure
template: 2
---

A stack gives back the newest item first, like a pile of plates. A queue gives back the oldest first, like a line at a counter. You'll build both on arrays, use a stack to check brackets, and use a queue that also pops from the back (a **deque**, pronounced "deck") to find the maximum of every window in a list.

## Prerequisites

- [Arrays and strings](/dsa/arrays-and-strings): both structures sit on an array that doubles when it fills, and the costs below lean on why that is cheap on average.
- [Linked list](/dsa/linked-list): the pointer-based alternative this entry rules out for a queue.

## What it is

A **stack** is last in, first out (LIFO): `push` adds on top, `pop` removes the top, `peek` reads it. The call stack that tracks which function called which is one, which is why a JavaScript or Java stack trace lists calls newest first. Make the end of an array the top and a push or pop never moves another item.

A **queue** is first in, first out (FIFO): `enqueue` adds at the back, `dequeue` removes at the front. The obvious array version, `items.pop(0)` in Python or `shift()` in JavaScript, fails quietly: the array keeps its items packed from index 0, so removing the front shifts every other item left, which is O(n) per dequeue. A linked list fixes that but allocates a node per item and scatters them across memory. A **ring buffer** (circular buffer) fixes it inside the array: leave the items where they are, remember which slot holds the front (the **head**), and let positions wrap around the end. With `capacity` slots, the item `offset` places behind the front is in slot `(head + offset) % capacity`.

Here is a ring of 4 slots (`_` is empty), which is the example the code below runs:

```text
append 1, 2, 3     [1, 2, 3, _]   head 0, size 3
popleft twice      [_, _, 3, _]   head 2, size 1   (returned 1, then 2)
append 4           [_, _, 3, 4]   slot (2 + 1) % 4 = 3
append 5           [5, _, 3, 4]   slot (2 + 2) % 4 = 0, wrapped
append 6           [5, 6, 3, 4]   slot (2 + 3) % 4 = 1, now full
append 7           grow, then     [3, 4, 5, 6, 7, _, _, _]   head 0, size 5
```

Why not just move a head index forward and never wrap? Because the slots behind it are never reused, so memory tracks everything ever enqueued instead of what's waiting. The rule: use the end of an array for newest-first, and a ring for oldest-first.

## When to use it

- Something opened must be matched with the most recent thing still open: brackets, tags, nested calls, an undo history. That is a stack.
- A recursion might go too deep, or you must undo your last move: an explicit stack replaces the call stack, as in [depth-first search](/dsa/depth-first-search).
- Work must happen in arrival order, or level by level: a queue, as in [breadth-first search](/dsa/breadth-first-search).
- Items expire at one end while new ones arrive at the other, and you need a running best (a maximum, a minimum): a deque, often with a [sliding window](/dsa/sliding-window).
- "Next greater element" or "nearest smaller": a stack that keeps its contents ordered, covered in [monotonic stack](/dsa/monotonic-stack).

## Operations and costs

With n items, O(1) means the work doesn't grow with n. **Amortized** means averaged over a long run, where a rare expensive operation is paid for by many cheap ones.

| Operation                                    | Average        | Worst case |
| -------------------------------------------- | -------------- | ---------- |
| Stack `push` (array append)                  | O(1) amortized | O(n)       |
| Stack `pop`, `peek`                          | O(1)           | O(1)       |
| Ring `append` (enqueue at the back)          | O(1) amortized | O(n)       |
| Ring `popleft`, `pop`, `peek`, `peekleft`    | O(1)           | O(1)       |
| `list.pop(0)` or `shift` (the obvious queue) | O(n)           | O(n)       |
| Space                                        | O(n)           | O(n)       |

The O(n) case is an append that finds every slot full and copies all n items into a doubled array. After that grow the next one is n appends away, and the copies total less than 2n over n appends, so each append averages under two extra moves. Pops copy nothing; they move the head or the count. This ring never shrinks, so its space follows the most items it ever held, not how many it holds now.

## Implementation

The stack is a plain list in Python and array in JavaScript, with nothing to wrap, so the code starts with the queue. Python names it `Deque` and uses the method names of `collections.deque` (`append`, `popleft`). TypeScript has no deque, so it spells the ends out (`pushBack`, `popFront`). Pushing at the front is the mirror of `popleft`, moving the head one slot back, and the code leaves it out.

```python
from typing import Any, Generic, TypeVar

T = TypeVar("T")

class Deque(Generic[T]):
    """Push at the back, pop at either end, in a ring that doubles when full."""

    def __init__(self, capacity: int = 4) -> None:
        # At least 1: doubling zero slots would never make room.
        self._slots: list[Any] = [None] * max(capacity, 1)
        self._head = 0  # the slot holding the front item
        self._size = 0

    def __len__(self) -> int:
        return self._size

    def _slot(self, offset: int) -> int:
        # % sends a position past the last slot back around to slot 0.
        return (self._head + offset) % len(self._slots)
```

```typescript
/** Push at the back, pop at either end, in a ring that doubles when full. */
export class Deque<T> {
  private slots: (T | undefined)[];
  private head = 0; // the slot holding the front item
  private count = 0;

  constructor(capacity = 4) {
    // At least 1: doubling zero slots would never make room.
    this.slots = new Array<T | undefined>(Math.max(capacity, 1)).fill(undefined);
  }

  get size(): number {
    return this.count;
  }

  private slot(offset: number): number {
    // % sends a position past the last slot back around to slot 0.
    return (this.head + offset) % this.slots.length;
  }
```

The state is three things: the slots, the head and the size. The back isn't stored. It's `size - 1` places behind the front, which avoids a second index that has to agree with the first and can't tell a full ring from an empty one.

```python
    def append(self, item: T) -> None:
        if self._size == len(self._slots):
            self._grow()  # full: the slot after the back is the front's
        self._slots[self._slot(self._size)] = item
        self._size += 1
```

```typescript
  pushBack(item: T): void {
    // Full: the slot after the back is the front's, so grow before writing.
    if (this.count === this.slots.length) this.grow();
    this.slots[this.slot(this.count)] = item;
    this.count++;
  }
```

Growing happens before the write, so the new item always lands in a free slot. Reading the ends comes next.

```python
    def peekleft(self) -> T:
        # Check the size, not the slot: None could be a stored item.
        if self._size == 0:
            raise IndexError("empty deque")
        return self._slots[self._head]

    def peek(self) -> T:
        if self._size == 0:
            raise IndexError("empty deque")
        return self._slots[self._slot(self._size - 1)]

    def popleft(self) -> T:
        item = self.peekleft()
        self._slots[self._head] = None  # don't keep a removed item alive
        self._head = self._slot(1)
        self._size -= 1
        return item

    def pop(self) -> T:
        item = self.peek()
        self._slots[self._slot(self._size - 1)] = None
        self._size -= 1
        return item
```

```typescript
  peekFront(): T {
    // Check the size, not the slot: undefined could be a stored item.
    if (this.count === 0) throw new RangeError('empty deque');
    return this.slots[this.head] as T;
  }

  peekBack(): T {
    if (this.count === 0) throw new RangeError('empty deque');
    return this.slots[this.slot(this.count - 1)] as T;
  }

  popFront(): T {
    const item = this.peekFront();
    this.slots[this.head] = undefined; // don't keep a removed item alive
    this.head = this.slot(1);
    this.count--;
    return item;
  }

  popBack(): T {
    const item = this.peekBack();
    this.slots[this.slot(this.count - 1)] = undefined;
    this.count--;
    return item;
  }
```

Each pop clears its slot and moves the head or the size, so nothing shifts. An empty deque raises rather than returning `None` or `undefined`, because those could be stored items. All that's left is the grow.

```python
    def _grow(self) -> None:
        # Unroll the ring so the front lands in slot 0 of the bigger array.
        old = self._slots
        self._slots = old[self._head :] + old[: self._head] + [None] * len(old)
        self._head = 0
```

```typescript
  private grow(): void {
    // Unroll the ring so the front lands in slot 0 of the bigger array.
    const old = this.slots;
    this.slots = new Array<T | undefined>(old.length * 2).fill(undefined);
    for (let i = 0; i < this.count; i++) {
      this.slots[i] = old[(this.head + i) % old.length];
    }
    this.head = 0;
  }
}
```

Only a full ring grows, and then the items are the slots from the head to the end followed by slots 0 up to the head. In the example, `[5, 6, 3, 4]` with head 2 becomes `[3, 4]` plus `[5, 6]` plus four empty slots. Now the stack: brackets are the textbook use, since each closer must match the most recent opener still open.

```python
PAIRS = {")": "(", "]": "[", "}": "{"}

def is_balanced(text: str) -> bool:
    """True if every bracket is closed by its partner, innermost first."""
    stack: list[str] = []  # a plain list: append and pop work at the end
    for ch in text:
        if ch in PAIRS.values():
            stack.append(ch)
        elif ch in PAIRS:
            # Test emptiness first: a closer with nothing open is a mismatch.
            if not stack or stack.pop() != PAIRS[ch]:
                return False
    return not stack  # an opener still on the stack was never closed
```

```typescript
const PAIRS: Record<string, string> = { ')': '(', ']': '[', '}': '{' };

/** True if every bracket is closed by its partner, innermost first. */
export function isBalanced(text: string): boolean {
  const stack: string[] = []; // a plain array: push and pop work at the end
  for (const ch of text) {
    if (Object.values(PAIRS).includes(ch)) {
      stack.push(ch);
    } else if (ch in PAIRS) {
      // pop() on an empty array returns undefined, which never equals a
      // bracket, so a closer with nothing open is a mismatch.
      if (stack.pop() !== PAIRS[ch]) return false;
    }
  }
  return stack.length === 0; // an opener still on the stack was never closed
}
```

On `([)]`, the stack holds `(`, then `[`, and the `)` pops `[`, which isn't its partner, so it returns false at the third character. Now the deque. For `[1, 3, -1, -3, 5, 3, 6, 7]` with `k = 3`, the answer should be `[3, 3, 5, 5, 6, 7]`.

```python
def window_max(nums: list[int], k: int) -> list[int]:
    """The maximum of every run of k consecutive items, in O(n)."""
    if k < 1:
        raise ValueError("k must be at least 1")
    window: Deque[int] = Deque()  # indices; their values fall front to back
    out: list[int] = []
    for i, x in enumerate(nums):
        # An earlier item no bigger than x leaves the window before x does,
        # so it can never be the maximum again.
        while len(window) and nums[window.peek()] <= x:
            window.pop()
        window.append(i)
        # Indices, not values: this is how we know the front has expired.
        if window.peekleft() <= i - k:
            window.popleft()
        if i >= k - 1:
            out.append(nums[window.peekleft()])
    return out
```

```typescript
/** The maximum of every run of k consecutive items, in O(n). */
export function windowMax(nums: number[], k: number): number[] {
  if (k < 1) throw new RangeError('k must be at least 1');
  const window = new Deque<number>(); // indices; their values fall front to back
  const out: number[] = [];
  for (let i = 0; i < nums.length; i++) {
    // An earlier item no bigger than nums[i] leaves the window before it
    // does, so it can never be the maximum again.
    while (window.size > 0 && nums[window.peekBack()] <= nums[i]) {
      window.popBack();
    }
    window.pushBack(i);
    // Indices, not values: this is how we know the front has expired.
    if (window.peekFront() <= i - k) window.popFront();
    if (i >= k - 1) out.push(nums[window.peekFront()]);
  }
  return out;
}
```

The deque holds indices whose values fall from front to back, so the front is always the window's maximum. At `5` (index 4) it pops indices 3, 2 and 1, since their values `-3`, `-1` and `3` can never beat a later, bigger `5`, and the front becomes index 4. Each index is appended once and popped at most once, so the whole run is O(n), where rescanning each window costs O(n·k).

## Pitfalls

- **Writing before growing.** In `append`, the check comes first because a full ring's next free slot is the head's slot. Writing there overwrites the front item, and the size passes the capacity.
- **Copying the slots in storage order when you grow.** `old[self._head :] + old[: self._head]` puts the front at slot 0. Copy the slots as they are and the example becomes `[5, 6, 3, 4, ...]` with head 0, so the deque now starts with 5.
- **Forgetting the final emptiness check.** `return not stack` is what rejects `"(("`: every closer matched, but an opener was never closed. Likewise `not stack or` has to come before `stack.pop()`, since `[].pop()` raises in Python and returns `undefined` in JavaScript, which only the TypeScript line relies on.
- **Storing values instead of indices in the window.** The line `window.peekleft() <= i - k` needs positions to know when the front left the window. A value alone can't say, and duplicates make it ambiguous.
