---
title: Fast and Slow Pointers
summary: Two pointers that walk a linked list at different speeds, which finds the middle in one pass and detects, then locates, a cycle in O(n) time with no extra memory.
date: 2026-10-01
kind: pattern
---

Fast and slow pointers is a way of scanning a linked list with two references
at once, one that advances a single node per step (the **slow** pointer, also
called the tortoise) and one that advances two (the **fast** pointer, the hare).
Because the speeds differ, the gap between them changes by a fixed amount every
step, and that is enough to answer questions about the list's shape (where the
middle is, whether it loops back on itself, where the loop begins) without
counting its length first or remembering the nodes already seen.

## Prerequisites

- [Linked List](/dsa/linked-list): following `next` references from node to
  node, and the idea of a list that ends in `None` (`null` in TypeScript). The
  code here defines its own minimal node and doesn't import that entry's.
- [Two Pointers](/dsa/two-pointers): two indexes moving through one sequence,
  where each comparison decides which one moves. Here the "indexes" are node
  references and the two move at different speeds instead of toward each other.

## The idea

A singly linked list is a chain of nodes where each node holds a value and a
reference to the next node. Normally the last node's `next` is empty, so a walk
from the head reaches the end. A **cycle** exists when some node's `next`
points back at an earlier node, so a walk never ends. Three questions come up.

**The middle.** Run both pointers from the head, slow one node per step and
fast two. When fast runs off the end, slow has covered half the distance, so it
is at the middle. With 5 nodes (index 0 to 4) fast stops after 2 steps and slow
is on node 2. With 4 nodes, slow is on node 2 as well, the second of the two
middle nodes.

**Is there a cycle?** Run the same two pointers. If the list ends, fast reaches
the end and the answer is no. If there is a cycle, neither pointer ever reaches
the end, and the question becomes whether they must meet. They must. Once slow
has entered the cycle, fast is somewhere on it too. Look at the number of steps
fast would need to travel forward to land on slow's node. Each iteration fast
moves two nodes and slow moves one, so that number shrinks by exactly one. A
count that falls by one per step passes through every value on the way down,
so it reaches 0, and 0 means the pointers are on the same node. Fast can't hop
over slow: that would need the count to go from 1 straight to -1, and it only
ever changes by one.

**Where does the cycle start?** Take a list of 7 nodes numbered 0 to 6, where
node 6's `next` points back to node 2. Two nodes (0 and 1) lie before the
cycle, so call that tail length 2. The cycle is nodes 2, 3, 4, 5, 6, so its
length is 5. Here is the walk from the head:

| Step | slow | fast | Steps fast needs to land on slow |
| ---- | ---- | ---- | -------------------------------- |
| 1    | 1    | 2    | (slow is still in the tail)      |
| 2    | 2    | 4    | 3                                |
| 3    | 3    | 6    | 2                                |
| 4    | 4    | 3    | 1                                |
| 5    | 5    | 5    | 0: they meet at node 5           |

Slow entered the cycle at step 2, and the count then fell 3, 2, 1, 0. Now
restart one pointer at the head and move both pointers **one node per step**
from here on, the new one from node 0 and the old slow one from node 5:

| Step | from head | from meeting node |
| ---- | --------- | ----------------- |
| 1    | 1         | 6                 |
| 2    | 2         | 2                 |

They meet at node 2, which is the cycle's start. Why does that work in
general? Call the tail length `t` and the cycle length `c`, and say the first
meeting happens after `k` steps of slow. Slow has gone `k` nodes and fast `2k`,
so fast has gone `k` nodes further than slow and landed on the same node,
which means those extra `k` nodes were a whole number of laps around the
cycle: `k` is a multiple of `c`. (In the example `k = 5 = 1 × 5`.) Slow is in
the cycle at that point, and it got there after `t` steps, so it is `k - t`
nodes past the start. Since `k` is a multiple of `c`, going `k - t` past the
start is the same as going `t` short of it: the start is exactly `t` nodes
ahead of the meeting node (5 to 6 to 2, two steps in the example). And the
start is exactly `t` nodes ahead of the head, by definition. Two pointers that
each need `t` steps to reach the start arrive together, and not earlier,
because until step `t` the one from the head is still in the tail and can't be
standing on a cycle node.

## When to use it

The signal is a linked list where you can't index into the middle and don't
want to count the length first, or a question about whether a walk of
"follow the next thing" ever ends. The middle is the first step of merge sort
on a linked list (split in half, sort each half, merge), and of checking
whether a list reads the same forwards and backwards (find the middle, reverse
the second half, compare). Cycle detection also applies beyond linked lists to
any sequence generated by repeatedly applying a function to its own output,
such as a number sequence where each term is computed from the previous one:
treat "the term after this one" as the `next` link and ask whether the
sequence repeats. If memory isn't a concern, a set of nodes already visited
answers the cycle question just as well and is simpler to trust, at the cost
of space proportional to the list.

## Walkthrough

```python
class ListNode:
    """One node of a singly linked list: a value and a link to the next node."""

    def __init__(self, val: int, next: "ListNode | None" = None) -> None:
        self.val = val
        self.next = next


def middle_node(head: ListNode | None) -> ListNode | None:
    """The middle node; the second of the two middles when the length is even."""
    slow = fast = head
    while fast is not None and fast.next is not None:
        slow = slow.next
        fast = fast.next.next
    return slow
```

```typescript
export class ListNode {
  val: number;
  next: ListNode | null;

  constructor(val: number, next: ListNode | null = null) {
    this.val = val;
    this.next = next;
  }
}

/** The middle node; the second of the two middles when the length is even. */
export function middleNode(head: ListNode | null): ListNode | null {
  let slow = head;
  let fast = head;
  while (fast !== null && fast.next !== null) {
    slow = slow!.next;
    fast = fast.next.next;
  }
  return slow;
}
```

The loop condition checks two things because `fast.next.next` has two links to
follow: `fast` itself must exist, and so must `fast.next`, otherwise the second
hop would read the `next` of nothing and crash. Checking `fast` alone isn't
enough for a list with an odd number of nodes, where fast lands exactly on the
last node and its `next` is empty. The two checks also handle the small cases:
an empty list returns `None` straight away (slow is the head, which is
`None`), and a single node returns itself. In TypeScript, `slow!` tells the compiler slow
isn't `null`; it can't be, because slow trails fast and fast was non-null a
moment ago.

```python
def meeting_node(head: ListNode | None) -> ListNode | None:
    """A node inside the cycle where slow and fast meet, or None without a cycle."""
    slow = fast = head
    while fast is not None and fast.next is not None:
        slow = slow.next
        fast = fast.next.next
        if slow is fast:
            return slow
    return None
```

```typescript
/** A node inside the cycle where slow and fast meet, or null without a cycle. */
export function meetingNode(head: ListNode | null): ListNode | null {
  let slow = head;
  let fast = head;
  while (fast !== null && fast.next !== null) {
    slow = slow!.next;
    fast = fast.next.next;
    if (slow === fast) return slow;
  }
  return null;
}
```

The same loop runs, with a comparison after the move. The pointers are
compared with `is` (`===`), which asks whether they are the same node, not
whether their values are equal. A list `[5, 5, 5]` with no cycle has equal
values everywhere, and comparing `.val` would report a cycle that isn't there.
The check comes after moving, not before: both start at the head, so checking
first would always say they've met. Falling out of the loop means fast hit the
end, and a list that ends has no cycle.

```python
def has_cycle(head: ListNode | None) -> bool:
    return meeting_node(head) is not None


def cycle_start(head: ListNode | None) -> ListNode | None:
    """The first node of the cycle, or None when the list ends."""
    meet = meeting_node(head)
    if meet is None:
        return None
```

```typescript
export function hasCycle(head: ListNode | null): boolean {
  return meetingNode(head) !== null;
}

/** The first node of the cycle, or null when the list ends. */
export function cycleStart(head: ListNode | null): ListNode | null {
  let meet = meetingNode(head);
  if (meet === null) return null;
```

Detection is the meeting-node search read as a yes or no. Finding the start
reuses it, and the early return matters: the restart step below walks `next`
links until two pointers coincide, and on a list that ends nothing ever
coincides, so without the guard the walk would run off the end and crash.

```python
    walker = head
    while walker is not meet:
        walker = walker.next
        meet = meet.next
    return walker
```

```typescript
  let walker = head;
  while (walker !== meet) {
    walker = walker!.next;
    meet = meet!.next;
  }
  return walker;
}
```

This is the restart from "The idea". Both pointers move one node at a time;
if the one from the meeting node moved two, the distance argument would no
longer hold and the pointers would meet somewhere else, or never. The walk
stops the moment they are the same node, and that node is the cycle's start.
When the whole list is one big cycle (the head is the start), `t` is 0, so the
meeting node is the head itself, the two pointers coincide at once and the loop
body never runs. The `walker!` and `meet!` in TypeScript are there for the same
reason as `slow!` earlier: both pointers move around the cycle, so neither
reaches `null`, but TypeScript can't prove that for a variable reassigned in a
loop.

## Complexity

`middle_node` runs in O(n) time for n nodes: fast makes one hop of two nodes
per iteration, so the loop runs about n / 2 times, and slow stops at the node
at index n / 2 rounded down. Everything here uses O(1) extra space, two
references and nothing that grows with the list.

For the cycle search, slow makes at most `t + c - 1` steps before the meeting
when there is a tail. Slow enters the cycle after `t` steps, when fast is
already on it, and then the count of steps fast needs to land on slow, at most
`c - 1`, falls by one per step. With no tail (`t` = 0) both start together on
the cycle, nothing is compared before the first move, and they meet back at the
head after exactly `c` steps. Since the list has `t + c` nodes, that is at most
n steps either way. The
restart walk takes `t` more. In the 7-node example that is 5 steps to meet
and 2 more to find the start, 7 steps in all for a list of 7 nodes. Total time
is O(n), and space is O(1).

The alternative is a visited set: walk the list, store every node, and the
first node seen twice is the cycle start. It is O(n) time as well, and it is
simpler, but it holds up to n nodes in memory. The tests compare the two on
500 seeded random lists, some with cycles and some without, and check that
both name the same start node.

## Pitfalls

- **Checking only `fast` in the loop condition.** On an odd-length list fast
  lands on the last node, whose `next` is empty, and the next hop reads the
  `next` of nothing, a crash in both languages.
- **Comparing values instead of nodes.** Two different nodes can hold the same
  value, so `slow.val == fast.val` reports cycles that don't exist. Compare
  the nodes themselves.
- **Comparing before the first move.** Both pointers start at the head, so a
  check before moving always succeeds and every list looks cyclic.
- **Moving the restarted pointer at the wrong speed.** In the second phase
  both pointers move one step per iteration. Moving either two steps breaks
  the distance argument, and the pointers generally no longer meet at the
  start.
- **Skipping the no-cycle guard before the second phase.** The restart walk
  needs a meeting node to walk toward; with a list that ends there isn't one.
- **Expecting the first middle for an even length.** This version returns the
  second of the two middle nodes. If the caller needs the first (to cut a list
  in two halves of equal length, say), the loop condition has to change, and
  the tests need to say which one is expected.
