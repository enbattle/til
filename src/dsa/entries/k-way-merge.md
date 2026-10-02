---
title: K-way Merge
summary: Merging k sorted lists into one by keeping each list's current front value in a min-heap, so every output value costs O(log k) instead of a rescan of all k lists or a re-sort of everything.
date: 2026-10-01
kind: pattern
---

Suppose you have several lists, each already in ascending order, and you want
one ascending list holding everything: the sorted pieces of a file that was too
big to sort at once, or the result pages of k separate servers. Each list is
sorted, so the smallest value overall must be the first value of one of them.
You never need to look deeper than the front of each list. K-way merge keeps
those k front values in a heap, takes the smallest, and replaces it with the
next value from the list it came from.

## Prerequisites

- [Heap and Priority Queue](/dsa/heap): the whole pattern is a min-heap of at
  most k entries, using its push, pop and replace-the-root operations, and its
  O(log n) cost per operation.

## The idea

The simplest merge of two sorted lists uses one position in each list and
repeatedly takes the smaller front value. With k lists you could do the same
with k positions, scanning all k front values for the smallest each time. That
costs k comparisons per output value, so O(N × k) for N values in total. The
heap improves the scan: it keeps the k front values arranged so that the
smallest is always at the root, and putting a new front value in costs O(log k)
instead of O(k).

Each heap entry is a triple, `(value, list index, position)`. The value is what
the heap orders by. The list index and position say where the value came from,
so that when it is taken out, the next value of the same list, at `position +
1`, can take its place. The heap never holds more than one entry per list, so
it never holds more than k entries.

Here are three lists, with a 4 in two of them:

```text
A = [1, 4, 7]    B = [2, 4, 9]    C = [3, 5]
```

| Step | Heap before (value from list) | Output so far       | Then                      |
| ---- | ----------------------------- | ------------------- | ------------------------- |
| 1    | 1 from A, 2 from B, 3 from C  |                     | take 1, A's next is 4     |
| 2    | 2 from B, 3 from C, 4 from A  | 1                   | take 2, B's next is 4     |
| 3    | 3 from C, 4 from A, 4 from B  | 1, 2                | take 3, C's next is 5     |
| 4    | 4 from A, 4 from B, 5 from C  | 1, 2, 3             | take A's 4, A's next is 7 |
| 5    | 4 from B, 5 from C, 7 from A  | 1, 2, 3, 4          | take B's 4, B's next is 9 |
| 6    | 5 from C, 7 from A, 9 from B  | 1, 2, 3, 4, 4       | take 5, C has no more     |
| 7    | 7 from A, 9 from B            | 1, 2, 3, 4, 4, 5    | take 7, A has no more     |
| 8    | 9 from B                      | 1, 2, 3, 4, 4, 5, 7 | take 9, B has no more     |

The output is `[1, 2, 3, 4, 4, 5, 7, 9]`: eight values from three lists of
three, three and two. Steps 4 and 5 show a tie. Two entries hold the value 4,
and the heap has to pick one. It picks A's, because the list index is the
second item of the entry and A is list 0, so equal values come out in list
order.

The **k-th smallest** value across all the lists needs the same loop, stopped
early. Since k already counts the lists, call the position wanted the
**rank**. Take out the smallest value rank - 1 times, without keeping the
outputs; the smallest value left in the heap is then the one at that rank. On
the lists
above, the 5th smallest is the 4 from B: after four removals (the 1, the 2, the
3 and A's 4) the heap's root is B's 4, and the sorted output confirms it is the
fifth value. That stops after rank - 1 steps even if the lists hold millions of
values.

## When to use it

Use it when several inputs are already sorted and you want them combined in
order: merging sorted log files from different machines, the merge step of an
external sort (sorting data too large for memory by sorting chunks, writing
them out and merging the chunks), combining the sorted result pages that k
shards return, or taking the first few entries of many sorted feeds.

It also fits "the k-th smallest across sorted rows", because the lists need not
be separate arrays: the rows of a matrix whose rows are sorted work as k lists.
Use the early-stopping loop when you want one value or a short prefix of the
merged order, not the whole thing.

If the lists are not sorted, the heap's argument fails, because the front of a
list is no longer its smallest value. Sort them first, or sort the
concatenation once. If there are only two lists, the single-heap machinery is
unnecessary and a two-position merge does it in O(N).

Python's standard library has this pattern ready-made as `heapq.merge`. It
takes the sorted inputs as separate arguments and returns a generator, so
values are produced on demand and nothing past the ones you consume is
computed:

```text
>>> merged = heapq.merge([1, 3], [], [2, 2])
>>> next(merged), list(merged)
(1, [2, 2, 3])
```

It accepts empty inputs and no inputs at all, and its `key` and `reverse`
arguments work as they do for `sorted`. Being lazy, it also stops early: taking
only the first rank values from it finds the rank-th smallest. This entry still
builds the merge by hand because the hand-built loop adapts to other problems
(carrying extra data per entry, merging by a different rule), and it is what a
TypeScript program has to write, since JavaScript has no heap in its standard
library.

## Walkthrough

```python
import heapq

Entry = tuple[int, int, int]  # (value, index of its list, position in that list)
```

```typescript
/** A binary min-heap on an array: `less(a, b)` says a belongs nearer the root. */
export class MinHeap<T> {
  private readonly items: T[] = [];
  private readonly less: (a: T, b: T) => boolean;

  constructor(less: (a: T, b: T) => boolean) {
    this.less = less;
  }

  get size(): number {
    return this.items.length;
  }

  peek(): T | undefined {
    return this.items[0];
  }

  push(item: T): void {
    this.items.push(item);
    this.siftUp(this.items.length - 1);
  }

  /** Removes the root: moves the last item up to it and sifts it down. */
  pop(): T | undefined {
    const top = this.items[0];
    const last = this.items.pop();
    if (this.items.length > 0 && last !== undefined) {
      this.items[0] = last;
      this.siftDown(0);
    }
    return top;
  }

  /** Overwrites the root with `item` and sifts it down. The heap must not be empty. */
  replaceTop(item: T): void {
    this.items[0] = item;
    this.siftDown(0);
  }

  private siftUp(start: number): void {
    let i = start;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.less(this.items[i], this.items[parent])) return;
      [this.items[i], this.items[parent]] = [this.items[parent], this.items[i]];
      i = parent;
    }
  }

  private siftDown(start: number): void {
    const items = this.items;
    let i = start;
    for (;;) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = left + 1;
      if (left < items.length && this.less(items[left], items[smallest])) {
        smallest = left;
      }
      if (right < items.length && this.less(items[right], items[smallest])) {
        smallest = right;
      }
      if (smallest === i) return;
      [items[i], items[smallest]] = [items[smallest], items[i]];
      i = smallest;
    }
  }
}
```

The two languages start differently. Python brings in `heapq`, its standard
heap functions, which work on an ordinary list, and names the entry shape:
a tuple of three integers. A tuple is compared item by item from the left, so
a heap of these tuples orders by value first, then by list index when values
are equal, and that is the tie rule from the table. TypeScript has no heap in
its standard library, so it carries one: a trimmed copy of the array-based
min-heap in the [Heap and Priority Queue](/dsa/heap) entry. It drops that
heap's build-from-a-list constructor, returns `undefined` from an empty heap
instead of throwing, and adds `replaceTop`, which overwrites the root and sifts
the new value down. Where Python gets its
ordering from tuple comparison, `MinHeap` takes a `less` function that says
which of two items belongs nearer the root, and that function is where the tie
rule will go.

```python


def start_heap(lists: list[list[int]]) -> list[Entry]:
    """A heap holding the first value of every non-empty list."""
    heap = [(lst[0], i, 0) for i, lst in enumerate(lists) if lst]
    heapq.heapify(heap)
    return heap
```

```typescript
/** [value, index of its list, position in that list] */
type Entry = [value: number, list: number, pos: number];

/** Smaller value first; equal values go to the lower list index. */
function before(a: Entry, b: Entry): boolean {
  return a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);
}

/** A heap holding the first value of every non-empty list. */
function startHeap(lists: number[][]): MinHeap<Entry> {
  const heap = new MinHeap<Entry>(before);
  lists.forEach((list, i) => {
    if (list.length > 0) heap.push([list[0], i, 0]);
  });
  return heap;
}
```

The heap starts with one entry per list, the entry for its first value, at
position 0. The `if lst` filter (`list.length > 0` in TypeScript) skips empty
lists, which have no first value: without it, `lst[0]` raises an `IndexError`
in Python, and in TypeScript puts `undefined` into the heap. Python's `heapify`
arranges the whole list into a heap in O(k), cheaper than k separate pushes,
which cost O(k log k); the TypeScript `startHeap` does make k pushes, which is
still no more than the merge's own O(N log k). The list index in the entry does two jobs. It is how the
loop finds the right list again, and it breaks ties. When two lists front the
same value, the tuples `(4, 0, 1)` and `(4, 1, 1)` first differ at the second
item, so that is where Python's comparison ends. Each list has at most one
entry in the heap, so no two entries ever share a list index, and Python never
has to compare the third item. That matters when the entries carry more than
numbers: a heap of `(value, item)` pairs breaks on equal values the moment it
has to compare two items that don't support `<`, as the Pitfalls section shows.
TypeScript's `before` writes the same rule out by hand.

```python


def advance(heap: list[Entry], lists: list[list[int]]) -> None:
    """Replace the smallest entry with the next value of its list, if it has one."""
    _, i, pos = heap[0]
    if pos + 1 < len(lists[i]):
        heapq.heapreplace(heap, (lists[i][pos + 1], i, pos + 1))
    else:
        heapq.heappop(heap)
```

```typescript
/** Replaces the smallest entry with the next value of its list, if it has one. */
function advance(heap: MinHeap<Entry>, lists: number[][]): void {
  const [, i, pos] = heap.peek()!;
  if (pos + 1 < lists[i].length) {
    heap.replaceTop([lists[i][pos + 1], i, pos + 1]);
  } else {
    heap.pop();
  }
}
```

This is the step that moves the merge forward, and it reads the root without
removing it: `heap[0]` is the smallest entry. If its list has another value,
`heapreplace` (`replaceTop` in TypeScript) overwrites the root with that value
and sifts it down, one O(log k) operation. Popping the root and then pushing the
new entry would be two operations, each sifting through the heap. Replacing is
only legal because the new entry comes from the very list the old one left, so
the heap keeps one entry per list. When the list has no more values, the entry
has to go, so the heap shrinks with `heappop`. The check is `pos + 1 <
len(lists[i])`, not `pos < len(lists[i])`: `pos` is the position of the value
just taken, which always exists, and the question is whether the position after
it does. With `<` on `pos` the check would always say yes, and the next line
would index past the end of the list.

```python


def merge_sorted(lists: list[list[int]]) -> list[int]:
    """One sorted list holding every value of the sorted input lists."""
    heap = start_heap(lists)
    merged: list[int] = []
    while heap:
        merged.append(heap[0][0])
        advance(heap, lists)
    return merged
```

```typescript
/** One sorted array holding every value of the sorted input arrays. */
export function mergeSorted(lists: number[][]): number[] {
  const heap = startHeap(lists);
  const merged: number[] = [];
  while (heap.size > 0) {
    merged.push(heap.peek()![0]);
    advance(heap, lists);
  }
  return merged;
}
```

The loop runs until the heap is empty, which happens exactly when every list
has been used up, so there is no separate count of values to track. Each pass
records the root's value before calling `advance`, because `advance` replaces
the root and the value would be gone. Input that is empty, or all empty lists,
gives an empty heap at the start and the loop never runs: the result is `[]`
with no special case. The values come out in ascending order because the root
is the smallest front value, every list's front is its smallest remaining
value, and so the root is the smallest value remaining anywhere.

```python


def kth_smallest(lists: list[list[int]], rank: int) -> int | None:
    """The value at `rank` (1 is the smallest) in the merged order, or None."""
    if rank < 1:
        return None
    heap = start_heap(lists)
    for _ in range(rank - 1):
        if not heap:
            return None
        advance(heap, lists)
    return heap[0][0] if heap else None
```

```typescript
/** The value at `rank` (1 is the smallest) in the merged order, or null. */
export function kthSmallest(lists: number[][], rank: number): number | null {
  if (rank < 1) return null;
  const heap = startHeap(lists);
  for (let step = 1; step < rank; step++) {
    if (heap.size === 0) return null;
    advance(heap, lists);
  }
  return heap.size > 0 ? heap.peek()![0] : null;
}
```

This is the same loop, run `rank - 1` times, with nothing collected. After
those steps the `rank - 1` smallest values are gone and the root is the next
one, the `rank`-th. For rank 1 the loop runs zero times and the answer is the
first root, which is why the count is `rank - 1` and not `rank`: with `rank`
removals the function would return the value one place too far, the 2 for rank
1 on the lists above. The guards return `None` for a rank that doesn't exist.
A rank below 1 means nothing. A rank above the total number of values runs the
heap dry, and there are two ways it shows. A rank more than one past the total
finds the heap empty at the top of a pass, which the check inside the loop
catches. A rank exactly one past the total makes the last removal empty the
heap and then ends the loop, so only the final `if heap` catches it.

## Complexity

Let N be the total number of values and k the number of lists. `merge_sorted`
runs the loop once per value, N times. Each pass does one replace or one pop on
a heap of at most k entries, O(log k), so the loop is O(N log k), and building
the starting heap adds O(k) in Python (`heapify`) and O(k log k) in TypeScript
(k pushes), neither more than the loop's O(N log k) when every list has a
value. The result list takes O(N) space, and the heap takes O(k) beyond that.

Compared with the alternatives: concatenating everything and sorting is
O(N log N) time, and ignores the fact that the input was already sorted. The
gap grows with N and shrinks with k. For k = 10 lists and N = 1,000,000 values,
log₂ 10 is about 3.3 and log₂ 1,000,000 is about 20. With k = 2, log k is 1,
and the two-position merge does the job in O(N) with no heap at all. Scanning
the k fronts each time is O(N × k), worse than the heap once k passes a handful.

`kth_smallest` does at most `rank - 1` replaces or pops, each O(log k), after
the setup: O(k + rank × log k) time in Python and O((k + rank) × log k) in
TypeScript, O(k) space in both, and it does not read
the values after the ones it passes. For a rank near N it costs about the same
as a full merge, and it keeps nothing but the heap.

## Pitfalls

- **Leaving the list index out of the entry.** With entries of `(value, item)`,
  Python falls through to comparing the items whenever two values are equal. In
  Python 3.14, `heapq.heapify([(1, a), (1, b)])`, with `a` and `b` two instances
  of a plain class, raises `TypeError: '<' not supported between instances of
'Item' and 'Item'`, and `heapq.heapify([(1, 0, a), (1, 1, b)])` does not. With
  integers only, the failure doesn't appear, which is how the mistake survives
  until the data changes.
- **Starting from an empty list.** `lst[0]` on `[]` is an `IndexError`.
  Filter the empty lists out when building the heap, as `start_heap` does.
- **Pushing every value, not one per list.** Loading all N values first makes
  the heap size N and the time O(N log N), the cost of sorting, with none of the
  benefit. The point of the pattern is a heap of size k.
- **Unsorted input.** The root is only the smallest value left if each list's
  front is its smallest. `merge_sorted([[3, 1], [2]])` returns `[2, 3, 1]`, and
  so does `heapq.merge([3, 1], [2])`: neither checks.
- **Off-by-one in the early stop.** The value at a given rank takes rank - 1
  removals and then reads the root. Removing rank times returns the value one
  place later.
- **Taking the value after replacing the root.** `advance` overwrites the
  entry it was reading from. Record the value first, as `merge_sorted` does.
