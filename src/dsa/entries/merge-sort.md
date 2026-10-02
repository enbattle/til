---
title: Merge Sort
summary: Sorting by splitting a list in half, sorting each half, and merging the two sorted halves, which takes O(n log n) time, keeps equal items in their original order, and can count out-of-order pairs for free along the way.
date: 2026-10-01
kind: algorithm
---

Merge sort sorts a list by cutting it in half, sorting each half the same way,
and then merging the two sorted halves into one sorted list. The sorting
happens entirely in the merge: combining two lists that are already in order is
easy, and a list of one element is already in order, so splitting until nothing
is left but single elements and merging back up sorts everything. Two things
make it worth knowing beyond "it's fast": it is **stable** (items that compare
equal keep their original order), and the merge step can count how far a list is
from sorted at no extra cost.

## Prerequisites

- [Two pointers](/dsa/two-pointers): the merge step walks two sorted lists with
  one index each, always advancing the one whose current item should come out
  next. That is the two-pointer pattern in its two-arrays shape. Its own
  prerequisite, Hash Map, explains the big-O notation (O(n)) used below; O(log n) is explained in the Complexity section here.

You also need to know what recursion is: a function that calls itself on a
smaller piece of its input, with a base case where it stops.

## The idea

Take `[5, 2, 4, 6, 1, 3]`. Split it into `[5, 2, 4]` and `[6, 1, 3]`, split those
again, and keep going until every piece has one element. Then merge back up:
`[5, 2, 4]` splits as `[5]` and `[2, 4]` (the middle is rounded down), `[2]`
and `[4]` become `[2, 4]`, that merges with `[5]` into `[2, 4, 5]`, the other
half becomes `[1, 3, 6]` the same way, and the final merge produces
`[1, 2, 3, 4, 5, 6]`.

**Merging** two sorted lists needs one index per list, each pointing at the
smallest item not yet used from that list. Compare the two items they point at,
copy the smaller to the output, and move that index forward. When one list runs
out, the rest of the other goes to the end as is. Merging `[2, 4]` with `[1, 3, 5]`:

| `i` | `j` | `left[i]` | `right[j]` | Taken     | Output so far     |
| --- | --- | --------- | ---------- | --------- | ----------------- |
| 0   | 0   | 2         | 1          | 1 (right) | `[1]`             |
| 0   | 1   | 2         | 3          | 2 (left)  | `[1, 2]`          |
| 1   | 1   | 4         | 3          | 3 (right) | `[1, 2, 3]`       |
| 1   | 2   | 4         | 5          | 4 (left)  | `[1, 2, 3, 4]`    |
| 2   | 2   | (none)    | 5          | 5 (rest)  | `[1, 2, 3, 4, 5]` |

**Stability** comes down to one choice in that table: what to do on a tie. If
the left item and the right item are equal, take the left one. Everything in the
left half came before everything in the right half in the original list, so
taking left on ties keeps equal items in their original order. Stability
matters when the items are records sorted by one field. Sort people by age,
and a stable sort leaves people of the same age in whatever order they were in
before, say alphabetical from an earlier sort. An unstable sort may shuffle
them.

**Counting inversions** uses the same merge. An **inversion** is a pair of
positions `i < j` where `a[i] > a[j]`: two items in the wrong order relative to
each other. A sorted list has none; a list in reverse order has the most,
n(n - 1) / 2 for n items. In the table above, step 1 takes `1` from the right
while `2` and `4` are still waiting in the left list. Both are larger than `1`
and both come before it in the original order, so that is two inversions at
once: `(2, 1)` and `(4, 1)`. Step 3 takes `3` from the right with `4` still
waiting, which is one more: `(4, 3)`. The total for `[2, 4, 1, 3, 5]` is 3.
Whenever the merge takes from the right, every item still waiting in the left
list forms an inversion with it, so add the number of items left there: `len(left) - i`.
Every inversion is counted exactly once, at the merge where its two items first
end up in the same list, one from each half. Inversions inside a half are counted
by the recursive calls.

## When to use it

Use it when you need a stable sort you can reason about, when the data is too
big to fit in memory (merging works by reading two sorted streams front to back,
so sorted chunks can be written to disk and merged later), when the data is a
linked list (merging needs no random access), or when the problem asks about
pairs that are out of order. Counting inversions measures how unsorted a
list is, and it is the core of problems like "count the pairs where the earlier
item is more than twice the later one".

In everyday code you call the built-in sort. Python's `sorted` and `list.sort`
use Timsort, a hybrid of merge sort and insertion sort that finds runs of
already-sorted items, extends short runs with insertion sort and merges the
runs. V8, the engine behind Chrome and Node.js, also uses Timsort for
`Array.prototype.sort` since V8 7.0 (2018), before which its sort was an
unstable quicksort; JavaScript's specification has required a stable sort
since ES2019. Both are stable, which is why you can sort by a secondary key
first and a primary key second. Merging sorted pieces is also the idea behind
[k-way merge](/dsa/k-way-merge), which merges many sorted lists with a heap.

Another approach, quicksort, is usually faster in practice on arrays held in
memory and uses less extra space, but it is not stable and its worst case is
O(n²); merge sort has no bad inputs.

## Walkthrough

```python
from collections.abc import Callable
from typing import Any, TypeVar

T = TypeVar("T")


def _identity(item: Any) -> Any:
    return item


def merge(left: list[T], right: list[T], key: Callable[[T], Any] = _identity) -> list[T]:
    """Merge two lists, each already sorted by key, into one sorted list."""
    merged: list[T] = []
    i = j = 0
```

```typescript
/** Merge two arrays, each already sorted by key, into one sorted array. */
export function merge<T>(
  left: readonly T[],
  right: readonly T[],
  key: (item: T) => number,
): T[] {
  const merged: T[] = [];
  let i = 0;
  let j = 0;
```

`merge` takes a `key` function that says what to compare, so the same code
sorts numbers (compare the number itself, the default `_identity`), or records
by one field (`key=lambda r: r[1]`). The caller promises both lists are already
sorted by that key; merge does not check. `merged` is a new list, so the inputs
are not modified, and `i` and `j` are the two indices, both starting at the
front of their list. The TypeScript key returns a number to keep the types
simple; sorting strings would need a comparison function instead.

```python
    while i < len(left) and j < len(right):
        if key(left[i]) <= key(right[j]):
            merged.append(left[i])
            i += 1
        else:
            merged.append(right[j])
            j += 1
    merged.extend(left[i:])
    merged.extend(right[j:])
    return merged
```

```typescript
  while (i < left.length && j < right.length) {
    if (key(left[i]) <= key(right[j])) {
      merged.push(left[i]);
      i++;
    } else {
      merged.push(right[j]);
      j++;
    }
  }
  while (i < left.length) merged.push(left[i++]);
  while (j < right.length) merged.push(right[j++]);
  return merged;
}
```

The loop runs only while both lists still have an item, since otherwise there is
nothing to compare. The comparison is `<=`, so on a tie the left item goes
first, which is what keeps the sort stable. With `<` the tie would send the
right item out first, and the sort would still sort, which is why this bug
survives casual testing. Take `left = [("A", 2), ("B", 5)]` and
`right = [("C", 2), ("D", 3)]`, compared on the number. `<=` gives A, C, D, B:
A stays ahead of C, as it was in the original list. `<` gives C, A, D, B, and
the two records with key 2 have swapped. Each pass moves exactly one index
forward, so the loop runs at most `len(left) + len(right)` times.

When the loop ends, at least one list is used up, and the leftovers of the
other are already sorted and are all at least as large as everything taken so
far, so they go on the end unchanged. Appending both leftovers is safe without
checking which list ran out: the exhausted list's slice `left[i:]` is empty.
Skipping this step is a classic bug that drops the tail of the input; `[1, 2]` merged with `[3, 4]` would
output only `[1, 2]`, since the right list is never touched.

```python
def merge_sort(items: list[T], key: Callable[[T], Any] = _identity) -> list[T]:
    """A new list with the items in ascending key order; ties keep their order."""
    if len(items) <= 1:
        return list(items)
    mid = len(items) // 2
    return merge(merge_sort(items[:mid], key), merge_sort(items[mid:], key), key)
```

```typescript
/** A new array with the items in ascending key order; ties keep their order. */
export function mergeSort(items: readonly number[]): number[];
export function mergeSort<T>(items: readonly T[], key: (item: T) => number): T[];
export function mergeSort<T>(items: readonly T[], key?: (item: T) => number): T[] {
  const keyOf = key ?? ((item: T) => item as unknown as number);
  if (items.length <= 1) return [...items];
  const mid = Math.floor(items.length / 2);
  return merge(
    mergeSort(items.slice(0, mid), keyOf),
    mergeSort(items.slice(mid), keyOf),
    keyOf,
  );
}
```

A list of zero or one items is already sorted, and that base case is what stops
the recursion. It returns a copy, not the input itself, so the function always
gives back a new list and the caller can modify the result without touching the
original. Without the base case, a one-item list would be split into an empty
list and itself forever. For a list of two or more items, `mid` rounded down is at
least 1 and less than the length, so both halves are non-empty and strictly
shorter than the original. That guarantees the recursion ends.

In TypeScript the two overload lines say that a plain number array needs no key, while any other array needs one; the third signature is the shared
implementation.

```python
def sort_and_count(nums: list[int]) -> tuple[list[int], int]:
    """The sorted list and the number of pairs i < j with nums[i] > nums[j]."""
    if len(nums) <= 1:
        return list(nums), 0
    mid = len(nums) // 2
    left, left_count = sort_and_count(nums[:mid])
    right, right_count = sort_and_count(nums[mid:])
    merged: list[int] = []
    crossing = 0
    i = j = 0
```

```typescript
/** The sorted array and the number of pairs i < j with nums[i] > nums[j]. */
export function sortAndCount(nums: readonly number[]): [number[], number] {
  if (nums.length <= 1) return [[...nums], 0];
  const mid = Math.floor(nums.length / 2);
  const [left, leftCount] = sortAndCount(nums.slice(0, mid));
  const [right, rightCount] = sortAndCount(nums.slice(mid));
  const merged: number[] = [];
  let crossing = 0;
  let i = 0;
  let j = 0;
```

This is the same recursion, except each call now returns two things: the sorted
half and the number of inversions inside it. A list of at most one item has none.
The counts from the two halves cover pairs where both items sit in the same half;
`crossing` will count the pairs with one item in each half. The merge is written
out again here rather than reusing `merge` because the counting happens inside
its loop.

```python
    while i < len(left) and j < len(right):
        if left[i] <= right[j]:
            merged.append(left[i])
            i += 1
        else:
            merged.append(right[j])
            j += 1
            crossing += len(left) - i
    merged.extend(left[i:])
    merged.extend(right[j:])
    return merged, left_count + right_count + crossing
```

```typescript
  while (i < left.length && j < right.length) {
    if (left[i] <= right[j]) {
      merged.push(left[i]);
      i++;
    } else {
      merged.push(right[j]);
      j++;
      crossing += left.length - i;
    }
  }
  while (i < left.length) merged.push(left[i++]);
  while (j < right.length) merged.push(right[j++]);
  return [merged, leftCount + rightCount + crossing];
}
```

The only new line is `crossing += len(left) - i`, in the branch that takes from
the right. The left list is sorted, so the `len(left) - i` items from index `i`
onward are all at least `left[i]`, and `left[i]` is already greater than the
right item being taken. That makes each of them a larger item that comes before it
in the original list: an inversion with it. Adding that count in one step is
what keeps the whole thing O(n log n), since a list can hold about n² / 2 inversions and
counting them one at a time would take that long. The comparison stays `<=`
because equal items are not inversions: `a[i] > a[j]` is strict, so on a tie the
left item must go first and add nothing. Using `<` here would count every tied
pair as an inversion, and `[2, 2, 2]` would report 3 instead of 0.

## Complexity

Merging lists of total length m takes O(m) time: each pass of the loop moves one
index forward, so there are at most m passes, plus the copying of leftovers.
Picture the recursion as a tree. The top call handles all n items; the level
below has two calls of n / 2 items; the next has four of n / 4; and so on, until
the pieces have one item. Every level's merges together touch all n items once,
so each level costs O(n). The number of levels is how many times n can be halved
before reaching 1, which is log₂ n rounded up: 20 for a million items, 3 for
eight. Total time is O(n) per level times O(log n) levels, O(n log n): about 20
million item moves to sort a million items, where a method that compares every
pair needs around half a trillion. This holds for every input, sorted,
reversed or random.

Extra space is O(n). The merge needs a separate output list as long as its
inputs, and the slices copy the halves, so at any moment the live copies add up
to a small multiple of n (the halves along the current call path total less than
2n, and the one merge in progress adds up to n). The recursion adds only O(log n)
stack depth. This implementation allocates new lists at every level, which
costs more time in practice than the O(n log n) bound suggests; production versions
sort in place within one reusable buffer of n items.

**Bottom-up merge sort** drops the recursion: treat each item as a sorted run of
length 1, merge neighbouring pairs into runs of 2, then pairs of those into runs
of 4, and so on until one run covers the list. It does the same merges in the
same total, so the time is the same, and it needs no call stack. Timsort starts
from the same idea but, instead of runs of length 1, begins with the runs that
already exist in the data; that is why it sorts an already-sorted list in O(n).

## Pitfalls

- **`<` instead of `<=` in the merge.** The list still comes out sorted, but
  equal items from the right half jump ahead of equal items from the left, so
  the sort is no longer stable. Tests on plain numbers can't see it, since equal
  numbers are interchangeable; only records with a tied key show it.
- **Forgetting the leftovers.** After the loop, one list usually still has
  items. Dropping them silently loses data.
- **Counting inversions with `<` as the tie rule, or counting `1` instead of
  `len(left) - i`.** The first reports ties as inversions; the second reports
  too few, since each right item is out of order with every remaining left item,
  not just one.
- **Modifying the input.** This version returns a new list. Slicing in Python
  and `slice` in TypeScript copy, so the input is left alone, but writing an
  in-place variant that merges into the same array without a buffer overwrites
  items before they are read.
- **Sorting numbers as strings in JavaScript.** `[10, 9, 100, 1].sort()` with no
  comparison function compares the items as strings and gives `[1, 10, 100, 9]`.
  Pass `(a, b) => a - b`; the `mergeSort` here compares the key numerically.
- **Assuming it is the fastest choice.** On arrays in memory, a good quicksort
  or the language's built-in sort beats a hand-written merge sort that
  allocates at every level; write it by hand to learn it or to count
  inversions, not to replace the built-in.
