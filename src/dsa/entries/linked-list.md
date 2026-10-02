---
title: Linked List
summary: A chain of nodes where each one points to the next, so adding or removing at the front costs O(1) but reaching the i-th value means walking the chain from the start.
date: 2026-10-01
kind: data-structure
---

A linked list stores a sequence the way a scavenger hunt stores its route:
each clue tells you where the next one is, and the only way to reach the fifth
clue is to follow the first four. Almost every linked-list operation comes down
to changing a few references in the right order, and getting that order wrong
loses data without any error, which is why the problems are an interview
staple. This entry builds a singly
linked list with a pointer to each end, then shows why one operation it can't
do cheaply, removing the last value, is the reason doubly linked lists exist.

## Prerequisites

- [Array and Dynamic Array](/dsa/dynamic-array), for the contrast: an array keeps its
  values side by side in one block of memory, which is what a linked list gives
  up, and most of this entry's costs are explained against it.

You also need to know that a variable can hold a **reference** to an object
(Python and JavaScript variables holding objects always do), so two variables
can point at the same object and changing it through one is visible through
the other.

## What it is

An array finds `items[i]` by arithmetic: every slot is the same size and the
slots sit next to each other, so slot `i` is at a computable address. The price
is that the slots must stay next to each other. Putting a value at the front
means shifting every other value one slot to the right, which costs O(n) for n
values.

A linked list drops the "next to each other" rule. Each value lives in its own
small object called a **node**, and each node holds two things: the value and
a reference to the next node, called its **next pointer**. The last node's next
pointer is `None` (`null` in TypeScript), which marks the end. The list object
itself keeps a reference to the first node, the **head**. This version also
keeps a reference to the last node, the **tail**, and a count of the nodes.

Here is the list built by pushing 1, 2 and 3 onto the back:

```text
head                     tail
 |                        |
 v                        v
[1 | •]--->[2 | •]--->[3 | None]
```

The nodes can sit anywhere in memory; only the arrows hold them in order. That
is what makes the front cheap: to put 0 at the front you make a new node whose
next pointer is the current head, then move `head` to it. Nothing else moves.
It is also what makes indexing slow: there is no arithmetic that finds node 2,
so you start at the head and follow two arrows.

The word **singly** means each node points only forward. That is why removing
the last value is slow here, even with a tail pointer. Taking 3 off the end
means node 2 must become the new tail with its next pointer set to `None`, and
nothing points from 3 back to 2. The only way to find node 2 is to walk from
the head until you reach the node whose next is the tail: n - 1 steps for n
nodes, so O(n).

A **doubly linked list** gives every node a second reference, `prev`, to the
node before it. Then `tail.prev` is node 2 straight away and removing the last
value is O(1). The same back pointer means a node you already hold can be
removed in O(1) too, since its neighbors are one step away in each direction.
The cost is one more reference per node and twice as many pointers to keep
correct on every insert and removal. Java's `LinkedList` is doubly linked, and
CPython's `collections.deque` is a doubly linked list of blocks that each hold
64 values, which is why it can append and pop at both ends in O(1).

## Operations and costs

O(1) means the work doesn't grow with n, the number of values; O(n) means it
grows in proportion to n.

| Operation                         | Average | Worst case |
| --------------------------------- | ------- | ---------- |
| `push_front(value)`               | O(1)    | O(1)       |
| `push_back(value)` (tail pointer) | O(1)    | O(1)       |
| `pop_front()`                     | O(1)    | O(1)       |
| Pop the back (singly linked)      | O(n)    | O(n)       |
| `find(value)`, `value in list`    | O(n)    | O(n)       |
| `remove(value)`                   | O(n)    | O(n)       |
| `reverse()`                       | O(n)    | O(n)       |
| Read the i-th value               | O(n)    | O(n)       |
| `len(list)`                       | O(1)    | O(1)       |
| Space                             | O(n)    | O(n)       |

The three O(1) rows only touch the head or the tail and change a fixed number
of references. `find` and `remove` may have to check every node, since
nothing about a node's position tells you what value it holds; a value that is
present is found after about n/2 steps on average, which is still O(n), and an
absent one costs all n. `reverse` visits each node once and uses O(1) extra
memory, three local variables, however long the list is.

Big-O hides a cost that matters in practice. An array's values sit in one
block, so reading them in order uses the processor's cache well, while a
linked list's nodes are separate objects scattered around memory. Each node
also carries overhead: on 64-bit CPython a node object here is 48 bytes before
counting its value, where a Python list spends 8 bytes per value on its
reference. So a linked list beats an array only when the work really is at the
front, or at a node you are already holding, and not because "insert is O(1)"
in general.

## Implementation

The Python list raises `IndexError` when popping an empty list, as a built-in
`list` does. The TypeScript one returns `undefined`, as `Array.prototype.shift`
does. Both iterate with a generator, so a `for` loop, `list(...)` or `[...list]`
works on them.

```python
from collections.abc import Iterable, Iterator
from typing import Generic, TypeVar

T = TypeVar("T")


class Node(Generic[T]):
    """One link: a value and a reference to the next node, or None at the end."""

    __slots__ = ("value", "next")

    def __init__(self, value: T) -> None:
        self.value = value
        self.next: Node[T] | None = None


class LinkedList(Generic[T]):
    """A singly linked list that keeps pointers to its first and last nodes."""

    def __init__(self, values: Iterable[T] = ()) -> None:
        self._head: Node[T] | None = None
        self._tail: Node[T] | None = None
        self._size = 0
        for value in values:
            self.push_back(value)

    def __len__(self) -> int:
        return self._size

    def __iter__(self) -> Iterator[T]:
        node = self._head
        while node is not None:
            yield node.value
            node = node.next
```

```typescript
/** One link: a value and the next node, or null at the end of the list. */
export class ListNode<T> {
  value: T;
  next: ListNode<T> | null = null;

  constructor(value: T) {
    this.value = value;
  }
}

/** A singly linked list that keeps pointers to its first and last nodes. */
export class LinkedList<T> implements Iterable<T> {
  private head: ListNode<T> | null = null;
  private tail: ListNode<T> | null = null;
  private count = 0;

  constructor(values: Iterable<T> = []) {
    for (const value of values) this.pushBack(value);
  }

  get size(): number {
    return this.count;
  }

  *[Symbol.iterator](): Iterator<T> {
    for (let node = this.head; node !== null; node = node.next) {
      yield node.value;
    }
  }
```

An empty list is `head` and `tail` both `None` with a count of zero. The count
is kept in a field because the list has no other cheap way to know its length:
counting would mean walking every node. `__slots__` tells Python that a node
only ever has `value` and `next`, so it skips giving each node its own
attribute dictionary, which matters when there are millions of nodes. The
iterator follows next pointers until it falls off the end. Because it is a
generator, it hands back one value at a time instead of building a whole copy
of the list first.

```python
    def push_front(self, value: T) -> None:
        node = Node(value)
        node.next = self._head
        self._head = node
        if self._tail is None:
            self._tail = node
        self._size += 1

    def push_back(self, value: T) -> None:
        node = Node(value)
        if self._tail is None:
            self._head = node
        else:
            self._tail.next = node
        self._tail = node
        self._size += 1
```

```typescript
  pushFront(value: T): void {
    const node = new ListNode(value);
    node.next = this.head;
    this.head = node;
    this.tail ??= node;
    this.count++;
  }

  pushBack(value: T): void {
    const node = new ListNode(value);
    if (this.tail === null) {
      this.head = node;
    } else {
      this.tail.next = node;
    }
    this.tail = node;
    this.count++;
  }
```

`push_front` points the new node at the old head before moving `head`. In the
other order, `head` would already be the new node and the new node would point
at itself, losing the rest of the list. On an empty list the new node is also
the last node, so the tail is set too; `??=` in TypeScript assigns only when
`tail` is `null`. `push_back` is where the tail pointer pays off: without it,
adding at the end would mean walking to the last node first, O(n). The empty
case is the one place `push_back` touches `head`, because the first node is
both ends at once.

```python
    def pop_front(self) -> T:
        if self._head is None:
            raise IndexError("pop from empty linked list")
        node = self._head
        self._head = node.next
        if self._head is None:
            self._tail = None
        self._size -= 1
        return node.value
```

```typescript
  popFront(): T | undefined {
    const node = this.head;
    if (node === null) return undefined;
    this.head = node.next;
    if (this.head === null) this.tail = null;
    this.count--;
    return node.value;
  }
```

`pop_front` moves `head` one node along. The old first node is no longer
reachable from the list, so the garbage collector frees it. When that node was
the only one, `head` becomes `None` and the tail has to follow.

```python
    def find(self, value: T) -> Node[T] | None:
        node = self._head
        while node is not None and node.value != value:
            node = node.next
        return node

    def __contains__(self, value: object) -> bool:
        return any(v == value for v in self)
```

```typescript
  find(value: T): ListNode<T> | null {
    let node = this.head;
    while (node !== null && node.value !== value) node = node.next;
    return node;
  }
```

`find` returns the node rather than `True` or an index. An index is useless
in a linked list, since using it means walking from the head again, while the
node is the handle you would need to insert after it or read its neighbor. The
loop stops in one of two ways, at a match or past the end, and both leave
`node` holding the right answer. Python's `in` calls `__contains__`, which
reuses the iterator. The TypeScript `find` compares with `!==`, so objects
match only when they are the same object, not when they look alike.

```python
    def remove(self, value: T) -> bool:
        prev: Node[T] | None = None
        node = self._head
        while node is not None and node.value != value:
            prev, node = node, node.next
        if node is None:
            return False
        if prev is None:
            self._head = node.next
        else:
            prev.next = node.next
        if node is self._tail:
            self._tail = prev
        self._size -= 1
        return True
```

```typescript
  remove(value: T): boolean {
    let prev: ListNode<T> | null = null;
    let node = this.head;
    while (node !== null && node.value !== value) {
      prev = node;
      node = node.next;
    }
    if (node === null) return false;
    if (prev === null) {
      this.head = node.next;
    } else {
      prev.next = node.next;
    }
    if (node === this.tail) this.tail = prev;
    this.count--;
    return true;
  }
```

Removing a node means making the node before it skip over it, so `remove`
walks with two references, `prev` one step behind `node`. A singly linked
node can't tell you its predecessor, so this is the only way to have it when
the match is found. Removing the first node has no predecessor; that's the
`prev is None` case, and it moves `head` instead. Removing 3 from 1 → 2 → 3
walks like this:

| Step         | `prev` | `node` | `node.value != 3` |
| ------------ | ------ | ------ | ----------------- |
| start        | None   | 1      | true, move on     |
| after step 1 | 1      | 2      | true, move on     |
| after step 2 | 2      | 3      | false, stop       |

Then `prev.next = node.next` sets node 2's next to `None`, and since node 3
was the tail, the tail moves back to node 2. The list is 1 → 2 with a size of 2.
Only the first match is removed, as with Python's `list.remove`.

```python
    def reverse(self) -> None:
        prev: Node[T] | None = None
        node = self._head
        self._tail = node
        while node is not None:
            following = node.next
            node.next = prev
            prev = node
            node = following
        self._head = prev
```

```typescript
  reverse(): void {
    let prev: ListNode<T> | null = null;
    let node = this.head;
    this.tail = node;
    while (node !== null) {
      const following: ListNode<T> | null = node.next;
      node.next = prev;
      prev = node;
      node = following;
    }
    this.head = prev;
  }
}
```

Reversing in place flips every arrow instead of copying values. Each pass of
the loop takes one node, points it backward at `prev`, and steps forward. The
step forward needs the old next pointer, which the flip just overwrote, so it
is saved in `following` first. Tracing 1 → 2 → 3, with each row showing the
state after one pass:

| After pass | Arrow just flipped | `prev` | `node` |
| ---------- | ------------------ | ------ | ------ |
| (start)    | none               | None   | 1      |
| 1          | 1 → None           | 1      | 2      |
| 2          | 2 → 1              | 2      | 3      |
| 3          | 3 → 2              | 3      | None   |

When `node` runs off the end, `prev` is the old last node, which becomes the
head: 3 → 2 → 1. The old head, saved as the tail before the loop, is the new
last node. An empty list skips the loop and leaves both pointers `None`; a
one-node list flips its single arrow to `None`, which it already was.

## Invariants

These hold whenever no method is running, and every method relies on them:

- **`head` is `None` exactly when `tail` is `None`**, which is exactly when the
  size is zero. `push_back` and `push_front` check one pointer and trust the
  other.
- **`tail` is the last node reachable from `head`**, and its next pointer is
  `None`. `push_back` attaches to `tail` without walking, so a tail pointing
  anywhere else would attach new nodes somewhere unreachable.
- **Following next pointers from `head` reaches `None` after exactly `size`
  nodes.** No cycle, no node counted twice.

## Tricky lines

- `if node is self._tail: self._tail = prev` in `remove`. Leave it out and
  removing the last node leaves `tail` pointing at a node that is no longer in
  the list. The next `push_back` links the new node after that orphan, so on
  1 → 2 → 3, `remove(3)` then `push_back(4)` gives a list that iterates as
  `[1, 2]` while its size says 3. Removing the only node hits the same line
  with `prev` as `None`, which empties the tail correctly.
- `if self._head is None: self._tail = None` in `pop_front`. Without it,
  popping the only node leaves `tail` on the popped node while `head` is
  `None`, breaking the first invariant. The next `push_back` sees a tail, links
  after it and never sets `head`, so the list reports a size of 1 and
  iterates as empty.
- `self._tail = node` before the loop in `reverse`. The old head is about to
  become the last node, and after the loop nothing points at it, so it has to
  be saved first. Forget it and `tail` still points at the old last node, which
  is now the head: reversing 0 → 1 → 2 and then calling `push_back(99)` sets
  node 2's next to 99 and cuts off 1 and 0.
- `following = node.next` before `node.next = prev`. Python's tuple assignment
  tempts a one-liner, but `prev, node, node.next = node, node.next, prev`
  assigns left to right: `node` has already moved on when `node.next` is
  written, so it rewires the wrong node, and once `node` reaches `None` it
  crashes with `AttributeError` (on 1 → 2 → 3, during the second pass). Putting
  `node.next` first in the targets happens to work; the four-line version
  doesn't depend on that order.
- The `prev is None` branch in `remove`. Removing the head is the one case
  with no node before it. A common trick avoids the branch with a **sentinel**:
  a dummy node that always sits before the head, so every real node has a
  predecessor. It costs one unused node and an extra `.next` in every method
  that reads the head.

## When to use it

In interviews, linked lists appear mostly as the input: reverse this list,
find its middle, detect a cycle, merge two sorted lists. The skills are the
ones above, keeping a `prev` reference, saving `next` before overwriting it,
and checking the empty, one-node and head-or-tail cases. A sentinel head
shortens most of those answers.

In real code, reach for a linked list when values come and go at the ends or
at nodes you already hold, and you never need the i-th value. A queue is the
classic case: push at the back, pop at the front, both O(1), where `pop(0)` on
a Python list is O(n) because it shifts every remaining value. A doubly linked
list paired with a [hash map](/dsa/hash-map) from key to node is the standard
least-recently-used cache: the map finds a key's node in O(1), and the back
pointers let that node be unlinked and moved to the front in O(1).

Prefer an array for almost everything else. If you need indexing, sorting or
binary search, or you mostly append and read in order, an array is faster in
practice and uses less memory, even where the big-O costs tie.
