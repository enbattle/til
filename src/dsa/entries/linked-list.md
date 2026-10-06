---
title: Linked List
summary: A chain of nodes that each point to the next, so changing the front costs O(1) but reaching the i-th value means walking from the start.
date: 2026-10-05
kind: data-structure
---

A linked list stores a sequence the way a scavenger hunt stores its route: each
clue tells you where the next one is, and to reach the fifth you follow the
first four. The build below is a singly linked list with pointers to both ends, and it
shows why nearly every operation is the same job: rewiring a few pointers in the
right order.

## Prerequisites

- [Arrays and strings](/dsa/arrays-and-strings): an array keeps its values side
  by side in one block of memory, which a linked list gives up, and every cost
  below is explained against that. You also need to know that a variable
  holding an object holds a reference to it, so two variables can point at the
  same object.

## What it is

An array finds `items[i]` by arithmetic, because the slots are the same size
and adjacent. The price is that they must stay adjacent: putting a value at the
front shifts every other value over, which costs O(n) for n values.

A linked list drops that rule. Each value lives in its own small object, a
**node**, holding the value and a **next pointer** to the node after it. The
last node's next pointer is `None` (`null` in TypeScript). The list object
keeps the **head**, the first node, and here also the **tail**, the last one.
You'll follow the list 1, 2, 3 all the way through:

```text
head                     tail
 |                        |
 v                        v
[1 | •]--->[2 | •]--->[3 | None]
```

The nodes can sit anywhere in memory, and only the arrows keep them in order.
That makes the front cheap: to put 0 first, make a node that points at the
current head, then move `head` to it. Nothing else moves. It also makes
indexing slow, since nothing computes where the third node is. You start at the head and follow two arrows.

**Singly** linked means each node points only forward, and that's why removing
the last value is slow even with a tail pointer. Taking 3 off the end means
node 2 becomes the tail, but nothing points from 3 back to 2, so you walk from the head to find it, visiting n - 1 nodes: O(n).

A **doubly linked** list adds a `prev` pointer to each node. Then `tail.prev`
is node 2 immediately, and any node you already hold can be unlinked in O(1)
because both neighbors are one step away. The cost is a second pointer per
node, and twice as many to keep correct. Java's `LinkedList` is doubly linked.

## When to use it

- The input is a list of nodes you're handed (reverse it, merge two, remove a
  node), so the work is rewiring pointers and checking the empty, one-node and
  head-or-tail cases.
- Values come and go at the ends and you never ask for the i-th one. A queue
  is the classic case: push at the back and pop at the front, both O(1), where
  `pop(0)` on a Python list shifts every remaining value, though a ring buffer
  in an array usually wins; see [stacks and queues](/dsa/stacks-and-queues).
- You hold a node and must unlink or move it without searching. A doubly
  linked list plus a [hash map](/dsa/hash-map) from key to node is the standard
  least-recently-used cache: the map finds the node, the back pointer unlinks
  it, and it moves to the front in O(1).
- The problem asks for the middle of a list or whether it loops, which is
  [fast and slow pointers](/dsa/two-pointers).

Otherwise prefer an array. For indexing, sorting, binary search or mostly
appending, it wins even where the big-O costs tie: its values share a block,
so the processor's cache serves them well, while nodes are scattered objects.

## Operations and costs

O(1) means the work doesn't grow with n, the number of values; O(n) means it
grows in proportion to n.

| Operation                         | Average | Worst case |
| --------------------------------- | ------- | ---------- |
| `push_front(value)`               | O(1)    | O(1)       |
| `push_back(value)` (tail pointer) | O(1)    | O(1)       |
| `pop_front()`                     | O(1)    | O(1)       |
| Pop the back (singly linked)      | O(n)    | O(n)       |
| Read the i-th value, or find one  | O(n)    | O(n)       |
| `remove(value)`                   | O(n)    | O(n)       |
| `reverse()`                       | O(n)    | O(n)       |
| Space                             | O(n)    | O(n)       |

The O(1) rows touch only `head` or `tail` and change a fixed number of
pointers. `reverse` visits each node once with three local variables, so its
extra space is O(1).

## Implementation

Python's `pop_front` raises `IndexError` on an empty list, as `list.pop` does;
TypeScript's returns `undefined`, as `Array.prototype.shift` does. Both lists
iterate from head to tail, so a `for` loop works on either.

```python
from collections.abc import Iterator
from typing import Generic, TypeVar

T = TypeVar("T")

class Node(Generic[T]):
    """One link: a value and the next node, or None at the end."""

    # No per-node __dict__: a million nodes would each pay for one.
    __slots__ = ("value", "next")

    def __init__(self, value: T) -> None:
        self.value = value
        self.next: Node[T] | None = None

class LinkedList(Generic[T]):
    """A singly linked list that keeps pointers to both ends."""

    def __init__(self) -> None:
        self.head: Node[T] | None = None
        self.tail: Node[T] | None = None

    def __iter__(self) -> Iterator[T]:
        node = self.head
        while node is not None:
            yield node.value
            node = node.next
```

```typescript
/** One link: a value and the next node, or null at the end. */
export class ListNode<T> {
  value: T;
  next: ListNode<T> | null = null;

  constructor(value: T) {
    this.value = value;
  }
}

/** A singly linked list that keeps pointers to both ends. */
export class LinkedList<T> implements Iterable<T> {
  head: ListNode<T> | null = null;
  tail: ListNode<T> | null = null;

  *[Symbol.iterator](): Iterator<T> {
    for (let node = this.head; node !== null; node = node.next) {
      yield node.value;
    }
  }
```

An empty list is `head` and `tail` both `None`. Those two pointers are the
whole structure, and every method below has to leave them agreeing: `head` is
`None` exactly when `tail` is, and `tail` is the last node reachable from
`head`. Next come the two pushes.

```python
    def push_front(self, value: T) -> None:
        node = Node(value)
        # Aim the new node at the old head before moving head. The other order
        # makes it point at itself and drops the rest of the list.
        node.next = self.head
        self.head = node
        if self.tail is None:
            self.tail = node

    def push_back(self, value: T) -> None:
        node = Node(value)
        if self.tail is None:
            self.head = node
        else:
            # Through the tail; walking from head to find it would cost O(n).
            self.tail.next = node
        self.tail = node
```

```typescript
  pushFront(value: T): void {
    const node = new ListNode(value);
    // Aim the new node at the old head before moving head. The other order
    // makes it point at itself and drops the rest of the list.
    node.next = this.head;
    this.head = node;
    this.tail ??= node;
  }

  pushBack(value: T): void {
    const node = new ListNode(value);
    if (this.tail === null) {
      this.head = node;
    } else {
      // Through the tail; walking from head to find it would cost O(n).
      this.tail.next = node;
    }
    this.tail = node;
  }
```

On an empty list the first node is both ends at once, so each push sets the
pointer the other one skips. Pushing 1, 2, 3 onto the back builds the diagram
above in three O(1) steps. Taking from the front is the mirror image.

```python
    def pop_front(self) -> T:
        node = self.head
        if node is None:
            raise IndexError("pop from empty linked list")
        self.head = node.next
        if self.head is None:
            # Left alone, tail keeps the popped node and the next push_back
            # links after it, so head never gets set.
            self.tail = None
        return node.value
```

```typescript
  popFront(): T | undefined {
    const node = this.head;
    if (node === null) return undefined;
    this.head = node.next;
    // Left alone, tail keeps the popped node and the next pushBack links
    // after it, so head never gets set.
    if (this.head === null) this.tail = null;
    return node.value;
  }
```

Removing from the middle is harder, because the node before it has
to skip over it.

```python
    def remove(self, value: T) -> bool:
        # A node can't say who points at it, so carry that node along.
        prev: Node[T] | None = None
        node = self.head
        while node is not None and node.value != value:
            prev, node = node, node.next
        if node is None:
            return False
        if prev is None:
            self.head = node.next
        else:
            prev.next = node.next
        if node is self.tail:
            # Left alone, push_back would link after a node that's gone.
            self.tail = prev
        return True
```

```typescript
  remove(value: T): boolean {
    // A node can't say who points at it, so carry that node along.
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
    // Left alone, pushBack would link after a node that's gone.
    if (node === this.tail) this.tail = prev;
    return true;
  }
```

Removing 3 from 1, 2, 3 walks `prev` and `node` along until `node` is 3, with
`prev` on 2. Then `prev.next = node.next` sets node 2's pointer to `None`, and
since 3 was the tail, the tail steps back to 2. The list is 1, 2. Removing the
head has no `prev`, which is the `prev is None` branch, and only the first
match goes. The last method flips every arrow in place.

```python
    def reverse(self) -> None:
        prev: Node[T] | None = None
        node = self.head
        # The old head ends up last, and nothing will point at it afterward.
        self.tail = node
        while node is not None:
            # Saved first: the next line overwrites the only way forward.
            following = node.next
            node.next = prev
            prev, node = node, following
        self.head = prev
```

```typescript
  reverse(): void {
    let prev: ListNode<T> | null = null;
    let node = this.head;
    // The old head ends up last, and nothing will point at it afterward.
    this.tail = node;
    while (node !== null) {
      // Saved first: the next line overwrites the only way forward.
      const following: ListNode<T> | null = node.next;
      node.next = prev;
      prev = node;
      node = following;
    }
    this.head = prev;
  }
}
```

Each pass points one node backward and steps forward. On 1, 2, 3, the state
after each pass:

| After pass | Arrow just flipped | `prev` | `node` |
| ---------- | ------------------ | ------ | ------ |
| (start)    | none               | None   | 1      |
| 1          | 1 to None          | 1      | 2      |
| 2          | 2 to 1             | 2      | 3      |
| 3          | 3 to 2             | 3      | None   |

When `node` runs off the end, `prev` is the old last node, which is the new
head: 3, 2, 1. An empty list skips the loop, and a single node's arrow stays `None`.

## Pitfalls

- **Moving `head` before aiming the new node.** In `push_front`, writing
  `self.head = node` first makes `node.next = self.head` point the node at
  itself, so iterating 1, 2, 3 after `push_front(0)` never ends and the old
  list is unreachable. Set `node.next` first.
- **Forgetting the tail in `pop_front`.** Popping the only node without
  `self.tail = None` leaves `tail` on the popped node. The next `push_back`
  links after it and never sets `head`, so the list iterates as empty.
- **Leaving the tail behind in `remove`.** Without `if node is self.tail`,
  `remove(3)` on 1, 2, 3 leaves `tail` on node 3, now outside the list.
  `push_back(4)` links after it, and the list iterates as `[1, 2]`.
- **Overwriting `next` before saving it in `reverse`.** Without
  `following = node.next`, the line `node.next = prev` destroys the only way
  forward, and the loop can't continue past node 1. The tail line matters too:
  skip `self.tail = node` and `push_back(99)` after reversing writes into node
  3, now the head, and cuts off 2 and 1.
