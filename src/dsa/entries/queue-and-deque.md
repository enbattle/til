---
title: Queue and Deque
summary: Adding at one end and removing from the other in constant time, by storing items in an array whose ends wrap around instead of shifting everything forward.
date: 2026-10-01
kind: data-structure
---

A queue hands items back in the order they arrived, like a line at a ticket
counter: the first one in is the first one out. A deque (pronounced "deck",
short for double-ended queue) lets you add and remove at both ends, so it can
act as a queue or as a stack. Breadth-first search, task schedulers and
sliding-window problems all run on one. The obvious way to build a queue on a
Python list or a JavaScript array is slow in a way that stays hidden until the
queue gets long, and this entry builds the version that isn't: a circular
buffer.

## Prerequisites

- [Array and Dynamic Array](/dsa/dynamic-array): the buffer is a fixed-size array that
  doubles when it fills, and the entry relies on why doubling makes appends
  O(1) amortized.
- [Linked List](/dsa/linked-list): the other way to build a queue, and part of
  how Python's own `collections.deque` is built.

## What it is

A **queue** supports two main operations: **enqueue** adds an item at the
back, and **dequeue** removes the item at the front. That order is called
**FIFO**, first in, first out. A **deque** has four: push and pop at the back,
push and pop at the front. Use only one end and it behaves like a stack (last
in, first out); push at the back and pop at the front and it's a queue. Both
usually offer a **peek** that reads an end without removing it.

The tempting implementation is a list where the front is index 0: enqueue
with `items.append(x)` and dequeue with `items.pop(0)`. The append is cheap.
The `pop(0)` is not, because a list keeps its items packed from index 0, so
removing the first one means moving every other item one slot to the left.
With a million items queued, each dequeue moves 999,999 of them. Python's own
tutorial warns against using a list this way, and timing it bears that out: on
the machine this entry was written on, `pop(0)` on a 1,000,000-item list took
about eight times as long as on a 100,000-item one. JavaScript's
`Array.prototype.shift` has the same problem. The language specification
describes it as moving every later element down one index. V8, the engine in
Chrome and Node, can sometimes skip that copy on small arrays by moving where
the array's storage starts, but nothing guarantees it, and in the same test a
`shift` on 1,000,000 items took about nine times as long as on 100,000.

The fix is to stop insisting that the front lives at index 0. A **circular
buffer** (also called a ring buffer) keeps a fixed-size array of **slots** and
remembers which slot holds the front item, called the **head**, and how many
items there are. Dequeue reads the head's slot and moves the head one slot
right; nothing else moves. Enqueue writes into the first free slot after the
last item. An end that moves right past the last slot continues at slot 0,
and one that moves left past slot 0 continues at the last slot, so the array
is treated as a ring. With `capacity` slots, the item
`offset` places behind the front lives in slot `(head + offset) % capacity`,
where `%` is the remainder after division, which is what makes an index past
the end come back around to the start.

Here is a buffer with 4 slots. `_` is an empty slot, and `head` is the front
item's slot:

```text
append 1, 2, 3       [1, 2, 3, _]   head 0, size 3
popleft, popleft     [_, _, 3, _]   head 2, size 1   (returned 1, then 2)
append 4             [_, _, 3, 4]   4 goes in slot (2 + 1) % 4 = 3
append 5             [5, _, 3, 4]   5 goes in slot (2 + 2) % 4 = 0
appendleft 0         [5, 0, 3, 4]   head moves to (2 - 1) % 4 = 1, size 4
```

The `append 5` line is the wrap-around: slot 4 doesn't exist, so the back
continues at slot 0. Reading from the head, the deque is now 0, 3, 4, 5, even
though slot 0 holds the last item. Every slot is in use, so the next push has
nowhere to go. The buffer then **grows**: it allocates an array twice the size
and copies the items into it in front-to-back order, starting at slot 0.
Appending 6 gives

```text
append 6             [0, 3, 4, 5, 6, _, _, _]   head 0, size 5
```

## Operations and costs

The costs use big-O notation, with n the number of items: O(1) means the work
doesn't grow with n, and O(n) means it grows in proportion to n. **Amortized**
means averaged over a long run of operations, where an occasional expensive
one is paid for by the many cheap ones around it.

| Operation                                   | Average        | Worst case |
| ------------------------------------------- | -------------- | ---------- |
| `append`, `appendleft` (push at either end) | O(1) amortized | O(n)       |
| `pop`, `popleft` (pop at either end)        | O(1)           | O(1)       |
| `peek`, `peekleft`, `len`                   | O(1)           | O(1)       |
| Grow (inside a push)                        | O(n), rarely   | O(n)       |
| `list.pop(0)` or `shift`, for comparison    | O(n)           | O(n)       |
| Space                                       | O(n)           | O(n)       |

A push that finds the buffer full copies all n items, which is the O(n) worst
case. It is rare for the same reason as in a dynamic array: the capacity
doubles, so after a grow to 2n slots the next one waits for n more pushes, and
the copying averages out to under two moves per push. Pops never copy
anything: they change the head or the count and clear one slot.

The space figure has a catch. This buffer never shrinks, so after a burst of
a million items followed by a million pops it still holds a million empty
slots. Its space is proportional to the most items it has ever held at once,
up to twice that after the last grow. Shrinking by half when the buffer drops
to a quarter full would fix it, at the cost of more code.

## Implementation

The Python class uses the method names of `collections.deque` (`append`,
`appendleft`, `pop`, `popleft`) so the tests can check it against the real
thing, and adds `peek` and `peekleft`. The TypeScript class names both ends
explicitly (`pushBack`, `popFront` and so on), since JavaScript has no deque to
copy and `pop`/`shift` already mean something on arrays. Both take a starting
capacity, which the tests set small to force wrap-around.

```python
from collections.abc import Iterable, Iterator
from typing import Any, Generic, TypeVar

T = TypeVar("T")


class Deque(Generic[T]):
    """A double-ended queue stored in a circular buffer that doubles when full."""

    def __init__(self, capacity: int = 8) -> None:
        if capacity < 1:
            raise ValueError("capacity must be at least 1")
        self._slots: list[Any] = [None] * capacity
        self._head = 0  # the slot holding the front item
        self._size = 0

    def __len__(self) -> int:
        return self._size

    @property
    def capacity(self) -> int:
        return len(self._slots)

    def _index(self, offset: int) -> int:
        """The slot holding the item `offset` places behind the front."""
        return (self._head + offset) % len(self._slots)
```

```typescript
/** A double-ended queue stored in a circular buffer that doubles when full. */
export class Deque<T> {
  private slots: (T | undefined)[];
  private head = 0; // the slot holding the front item
  private count = 0;

  constructor(capacity = 8) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new RangeError('capacity must be a positive integer');
    }
    this.slots = new Array<T | undefined>(capacity).fill(undefined);
  }

  get size(): number {
    return this.count;
  }

  get capacity(): number {
    return this.slots.length;
  }

  /** The slot holding the item `offset` places behind the front. */
  private index(offset: number): number {
    return (this.head + offset) % this.slots.length;
  }
```

The state is three things: the slots, the head and the count. The back isn't
stored, because it can be worked out: the last item is `size - 1` places
behind the front, and the first free slot is `size` places behind it. Storing
a separate tail index as well would give two fields that have to agree, and a
full buffer and an empty one would both have `head == tail`, so the code would
need a second rule to tell them apart. `_index` is the wrap-around formula from above, in one
place, so no method does its own arithmetic on positions behind the front.
`[None] * capacity` is safe here, unlike a list of lists, because every slot
starts as the same immutable `None` and is replaced, never changed in place.

```python
    def append(self, item: T) -> None:
        if self._size == len(self._slots):
            self._grow()
        self._slots[self._index(self._size)] = item
        self._size += 1

    def appendleft(self, item: T) -> None:
        if self._size == len(self._slots):
            self._grow()
        self._head = (self._head - 1) % len(self._slots)
        self._slots[self._head] = item
        self._size += 1
```

```typescript
  pushBack(item: T): void {
    if (this.count === this.slots.length) this.grow();
    this.slots[this.index(this.count)] = item;
    this.count++;
  }

  pushFront(item: T): void {
    if (this.count === this.slots.length) this.grow();
    const n = this.slots.length;
    this.head = (this.head - 1 + n) % n;
    this.slots[this.head] = item;
    this.count++;
  }
```

Both pushes check for a full buffer first and grow before writing, because a
full ring has no free slot: the slot after the last item is the head, and
writing there would overwrite the front item. A push at the back writes into
slot `_index(size)` and leaves the head alone. A push at the front moves the
head one slot left and writes there, so from the head's point of view the new
item is now first and everything else is one place further back, without any
item moving.

```python
    def pop(self) -> T:
        if self._size == 0:
            raise IndexError("pop from an empty deque")
        i = self._index(self._size - 1)
        item = self._slots[i]
        self._slots[i] = None
        self._size -= 1
        return item

    def popleft(self) -> T:
        if self._size == 0:
            raise IndexError("pop from an empty deque")
        item = self._slots[self._head]
        self._slots[self._head] = None
        self._head = (self._head + 1) % len(self._slots)
        self._size -= 1
        return item
```

```typescript
  popBack(): T {
    if (this.count === 0) throw new RangeError('pop from an empty deque');
    const i = this.index(this.count - 1);
    const item = this.slots[i] as T;
    this.slots[i] = undefined;
    this.count--;
    return item;
  }

  popFront(): T {
    if (this.count === 0) throw new RangeError('pop from an empty deque');
    const item = this.slots[this.head] as T;
    this.slots[this.head] = undefined;
    this.head = (this.head + 1) % this.slots.length;
    this.count--;
    return item;
  }
```

Popping from an empty deque raises, as `collections.deque` does, rather than
returning `None` or `undefined`. Those are values a caller might have stored,
so a sentinel return couldn't tell "the front item is `None`" from "there is
no front item". The emptiness check is on the count, not on what the slot
holds, for the same reason. `pop` only shrinks the count, since the head
doesn't change when the back loses an item; `popleft` moves the head one slot
right, wrapping from the last slot to slot 0.

```python
    def peek(self) -> T:
        if self._size == 0:
            raise IndexError("peek at an empty deque")
        return self._slots[self._index(self._size - 1)]

    def peekleft(self) -> T:
        if self._size == 0:
            raise IndexError("peek at an empty deque")
        return self._slots[self._head]
```

```typescript
  peekBack(): T {
    if (this.count === 0) throw new RangeError('peek at an empty deque');
    return this.slots[this.index(this.count - 1)] as T;
  }

  peekFront(): T {
    if (this.count === 0) throw new RangeError('peek at an empty deque');
    return this.slots[this.head] as T;
  }
```

The peeks find the same slots the pops do and leave everything as it was.
Without the emptiness check, a peek at an empty deque would return the `None`
or `undefined` sitting in an unused slot, which looks like a real answer.

```python
    def _grow(self) -> None:
        old = self._slots
        self._slots = old[self._head :] + old[: self._head] + [None] * len(old)
        self._head = 0
```

```typescript
  private grow(): void {
    const old = this.slots;
    this.slots = new Array<T | undefined>(old.length * 2).fill(undefined);
    for (let offset = 0; offset < this.count; offset++) {
      this.slots[offset] = old[(this.head + offset) % old.length];
    }
    this.head = 0;
  }
```

`_grow` runs only when every slot is full, so the items are exactly the old
array read from the head to the end and then from slot 0 up to the head. The
Python version builds that with two slices; the TypeScript version copies item
by item through the same wrap-around formula. Either way the items land in
slots 0 to n - 1 of the new array in front-to-back order, and the head resets
to 0. In the example above, `old[1:]` is `[0, 3, 4]` and `old[:1]` is `[5]`,
giving `[0, 3, 4, 5]` followed by four empty slots.

```python
    def __iter__(self) -> Iterator[T]:
        for offset in range(self._size):
            yield self._slots[self._index(offset)]
```

```typescript
  *[Symbol.iterator](): Iterator<T> {
    for (let offset = 0; offset < this.count; offset++) {
      yield this.slots[this.index(offset)] as T;
    }
  }
}
```

Iteration walks the items front to back by offset, not the slots by index.
`for item in d` or `[...d]` then gives the deque's order, `0, 3, 4, 5` in the
example, rather than the storage order `5, 0, 3, 4`, and never yields an empty
slot.

```python
def recent_counts(times: Iterable[int], window: int) -> list[int]:
    """For each time t (in non-decreasing order), count the times in [t - window, t]."""
    queue: Deque[int] = Deque()
    counts = []
    for t in times:
        queue.append(t)
        while queue.peekleft() < t - window:
            queue.popleft()
        counts.append(len(queue))
    return counts
```

```typescript
/** For each time t (in non-decreasing order), count the times in [t - window, t]. */
export function recentCounts(times: Iterable<number>, window: number): number[] {
  const queue = new Deque<number>();
  const counts: number[] = [];
  for (const t of times) {
    queue.pushBack(t);
    while (queue.peekFront() < t - window) queue.popFront();
    counts.push(queue.size);
  }
  return counts;
}
```

`recent_counts` uses the deque as a plain queue, for a common interview
question: requests arrive at increasing times, and after each one, how many
arrived in the last `window` milliseconds? Each time joins at the back.
Because the times only increase, the oldest one is always at the front, so
times that have fallen out of the window are all at the front and come off
with `popleft`; whatever is left is the count. With a window of 3000 and times
1, 100, 3001 and 3002, the counts are 1, 2, 3 and 3: at 3002 the window starts
at 2, so time 1 has been dropped. Each time enters and leaves the queue once,
so the whole run is O(n). The loop never pops the queue empty, because the
time just added always satisfies `t >= t - window`.

## Invariants

These hold after every call returns, and each method relies on them:

- **`0 <= size <= capacity`.** The pushes grow before writing, so a push
  never writes into a full buffer.
- **The items are the `size` slots starting at the head,** read in order and
  wrapping from the last slot to slot 0: slot `(head + k) % capacity` holds the
  item k places behind the front.
- **Every other slot is empty** (`None` or `undefined`). The pops clear the
  slot they free, so the buffer never keeps a removed item alive.
- **`0 <= head < capacity`.** Every change to the head goes through `%`, and
  `_grow` resets it to 0.

## Tricky lines

- `(self._head - 1) % len(self._slots)` in `appendleft`, and its TypeScript
  twin `(this.head - 1 + n) % n`. When the head is at slot 0, `head - 1` is
  -1. Python's `%` returns a result with the sign of the divisor, so
  `-1 % 4 == 3` and the line is right as written. JavaScript's `%` keeps the
  sign of the number being divided, so `-1 % 4` is `-1`, and
  `this.slots[-1] = item` doesn't fail: it stores the item in a separate
  property named `"-1"`, outside the array's slots. Every later `%` stays
  negative too, so the code keeps working on these phantom slots for a while,
  which hides the bug. Then four `pushFront` calls on an empty 4-slot buffer
  take the head to -1, -2, -3 and finally `-4 % 4`, which is 0 (strictly `-0`),
  and reading the deque from slot 0 finds only the last item; the other three
  are stranded under the names `"-1"` to `"-3"`. Adding `n` first keeps the
  number non-negative.
- `self._slots[i] = None` in `pop` and `popleft`. Leaving the slot alone looks
  harmless, because the count says the slot is free and nothing reads it. But
  the array still points at the popped object, so Python's garbage collector
  can't free it until a later push overwrites that slot, which may be never.
  A queue that once held large objects would then keep them in memory after
  they're gone. The Python tests check this with a weak reference, and the
  TypeScript tests check that every slot is empty after a drain.
- `old[self._head :] + old[: self._head]` in `_grow`, not
  `old + [None] * len(old)`. Copying the old array as it sits keeps the storage
  order, which only made sense in the old size. In the example the new array
  would be `[5, 0, 3, 4, _, _, _, _]` with the head at 1, and the deque would
  read slots 1 to 4: 0, 3, 4 and an empty slot. The 5 is still at slot 0, but
  with 8 slots the wrap-around no longer reaches it. Reordering from the head
  puts the items in slots 0 to n - 1, which is also why `_grow` then sets the
  head to 0.
- `self._slots[self._index(self._size)] = item` in `append`, not
  `self._slots[self._size] = item`. The shorter line is right only while the
  head is at slot 0, so a test that only appends and pops at the back can't
  catch it. In the example, after the two `popleft` calls the head is 2 and
  the size 1, so it would write the 4 into slot 1, before the head, where the
  deque never looks; reading from the head would give 3 and then an empty
  slot.

## When to use it

Reach for a queue when items have to be handled in arrival order:
breadth-first search works through a graph level by level by queuing the
neighbors it finds, and a job runner takes work in the order it was submitted. Reach for a deque when you need both ends, as in the sliding-window
maximum problem, which keeps candidates in a deque and drops them from either
end as the window moves.

In Python, use `collections.deque` rather than writing your own. It has these
operations under the same names (it reads an end with `d[0]` and `d[-1]`
instead of peek methods), and its pushes and pops at either end are O(1). It
isn't a circular buffer: CPython stores it as a doubly linked list of blocks,
each holding 64 items, so growing adds a block instead of copying everything,
at the cost of O(n) indexing in the middle. Never use `list.pop(0)` as a
dequeue on a list that can get long. JavaScript has no deque in its standard
library, so a circular buffer like this one is what you write when `shift` on
a large array is too slow.

The same idea shows up outside one program, as a
[message queue](/systems-and-infrastructure/message-queues) between services:
producers enqueue at the back, consumers dequeue from the front, and when the
consumers fall behind, the queue grows until something applies
[backpressure](/systems-and-infrastructure/backpressure). The buffer here grows
without limit; a fixed-size ring that refuses or overwrites when full is the
in-memory version of that choice.
