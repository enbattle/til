---
title: Stacks and Queues
summary: Two ways to hand items back, newest first (a stack) or oldest first (a queue), each in constant time by touching only the ends of an array.
date: 2026-10-05
kind: data-structure
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
- Items expire at one end while new ones arrive at the other, and you need a running best (a maximum, a minimum): a deque, as in the window maximum below.
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

```python region=part-1

```

```typescript region=deque

```

The state is three things: the slots, the head and the size. The back isn't stored. It's `size - 1` places behind the front, which avoids a second index that has to agree with the first and can't tell a full ring from an empty one.

```python region=append

```

```typescript region=push-back

```

Growing happens before the write, so the new item always lands in a free slot. Reading the ends comes next.

```python region=peekleft

```

```typescript region=peek-front

```

Each pop clears its slot and moves the head or the size, so nothing shifts. An empty deque raises rather than returning `None` or `undefined`, because those could be stored items. All that's left is the grow.

```python region=grow

```

```typescript region=grow

```

Only a full ring grows, and then the items are the slots from the head to the end followed by slots 0 up to the head. In the example, `[5, 6, 3, 4]` with head 2 becomes `[3, 4]` plus `[5, 6]` plus four empty slots. Now the stack: brackets are the textbook use, since each closer must match the most recent opener still open.

```python region=part-5

```

```typescript region=part-5

```

On `([)]`, the stack holds `(`, then `[`, and the `)` pops `[`, which isn't its partner, so it returns false at the third character. Now the deque. For `[1, 3, -1, -3, 5, 3, 6, 7]` with `k = 3`, the answer should be `[3, 3, 5, 5, 6, 7]`.

```python region=window-max

```

```typescript region=window-max

```

The deque holds indices whose values fall from front to back, so the front is always the window's maximum. At `5` (index 4) it pops indices 3, 2 and 1, since their values `-3`, `-1` and `3` can never beat a later, bigger `5`, and the front becomes index 4. Each index is appended once and popped at most once, so the whole run is O(n), where rescanning each window costs O(n·k).

## Pitfalls

- **Writing before growing.** In `append`, the check comes first because a full ring's next free slot is the head's slot. Writing there overwrites the front item, and the size passes the capacity.
- **Copying the slots in storage order when you grow.** `old[self._head :] + old[: self._head]` puts the front at slot 0. Copy the slots as they are and the example becomes `[5, 6, 3, 4, ...]` with head 0, so the deque now starts with 5.
- **Forgetting the final emptiness check.** `return not stack` is what rejects `"(("`: every closer matched, but an opener was never closed. Likewise `not stack or` has to come before `stack.pop()`, since `[].pop()` raises in Python and returns `undefined` in JavaScript, which only the TypeScript line relies on.
- **Storing values instead of indices in the window.** The line `window.peekleft() <= i - k` needs positions to know when the front left the window. A value alone can't say, and duplicates make it ambiguous.
