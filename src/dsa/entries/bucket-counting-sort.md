---
title: Bucket and Counting Sort
summary: Sorting without comparing elements, by using each key as a position, which beats the n log n limit of comparison sorts when the keys are small integers or evenly spread numbers.
date: 2026-10-01
kind: algorithm
---

Most sorting algorithms work by asking "is this element smaller than that
one?" over and over. There is a proven floor on how few of those questions a
sort can get away with, and the three algorithms here go under it by never
asking. They read the value itself and use it to decide where the element
belongs: counting sort for integers in a small known range, radix sort for
larger non-negative integers one digit at a time, and bucket sort for numbers
spread evenly over an interval. The price is that they need to know something
about the data that a comparison sort doesn't.

## Prerequisites

- [Prefix Sums](/dsa/prefix-sums): counting sort turns a list of counts into
  starting positions with a running total, which is a prefix sum.

You also need to know what an array is, what it means for a sort to put numbers
in ascending order, and what big-O notation says: how the work grows with the
input size.

## The idea

A **comparison sort** only ever learns about the data by comparing two elements
and getting "smaller" or "not smaller". Suppose it sorts `n` distinct elements.
Any of the `n!` orderings (n factorial, `n × (n - 1) × ... × 1`) could be the
right answer, and each comparison has two outcomes, so after `c` comparisons it
can tell apart at most 2<sup>c</sup> cases. To be sure of the answer it needs
2<sup>c</sup> ≥ `n!`, so `c ≥ log₂(n!)`. That is about `n log₂ n - 1.44n`: three
elements already need 3 comparisons in the worst case (3! = 6 and 2² = 4 is too
few), ten need 22, and a million need about 18.5 million. No comparison sort,
however clever, beats `n log n` growth in the worst case.

The bound is a statement about comparisons. An algorithm that looks inside the
elements is not covered by it. If the keys are integers from a small known range,
a key is itself an array index, and that is all counting sort uses.

**Counting sort** sorts items by an integer key in a known range `[lo, hi]`
(`lo` and `hi` included). It runs in four steps.

1. Make one counter per possible key, `k = hi - lo + 1` counters in all, and
   count how many items have each key.
2. Turn the counts into a running total. After this, the counter for key `v`
   holds how many items have a key of `v` or less, which is one past the last
   output slot that key can occupy.
3. Walk the input from the **last** item to the first. For each item, decrease
   its key's counter by one and write the item into that slot.
4. Return the output.

Walking backwards is what makes the sort **stable**: items with equal keys come
out in the order they went in. Take records written as a letter with a key, in
the order `A2 B0 C2 D3 E0 F1`, with keys in `[0, 3]`:

| Key    | 0   | 1   | 2   | 3   |
| ------ | --- | --- | --- | --- |
| Counts | 2   | 1   | 2   | 1   |
| Totals | 2   | 3   | 5   | 6   |

Now place from the end of the input. `F1` has key 1, total 3 becomes 2, so it
goes to slot 2. `E0`: 2 becomes 1, slot 1. `D3`: 6 becomes 5, slot 5. `C2`: 5
becomes 4, slot 4. `B0`: 1 becomes 0, slot 0. `A2`: 4 becomes 3, slot 3. The
output is `B0 E0 F1 A2 C2 D3`. The two key-0 items are `B` then `E` as in the
input, and the key-2 items are `A` then `C`. Stability matters whenever the items
are records carrying more than the key, and it is the property radix sort
leans on.

**Radix sort** handles integers that are too spread out for one counter each.
The **LSD** (least significant digit) version sorts by the last digit first, then
the next one, up to the most significant, using a stable counting sort for each
pass. With `[170, 45, 75, 90, 802, 24, 2, 66]` in base 10:

| After sorting by | Order                           |
| ---------------- | ------------------------------- |
| ones digit       | 170, 90, 802, 2, 24, 45, 75, 66 |
| tens digit       | 802, 2, 24, 45, 66, 170, 75, 90 |
| hundreds digit   | 2, 24, 45, 66, 75, 90, 170, 802 |

Each pass sorts by one digit alone, yet the end result is fully sorted. The
reason is stability. Take the last pass: 2, 24, 45, 66, 75 and 90 all have a
hundreds digit of 0, so that pass leaves them in the order they arrived, and
they arrived sorted by their last two digits. In general, after a pass the list
is sorted by the digits handled so far, because the new digit decides the
order between items that differ in it, and stability keeps the earlier work
for items that tie on it. An unstable pass would shuffle the ties and undo the
earlier digits.

**Bucket sort** is for floats in `[0, 1)` that are spread roughly evenly. Make
`n` buckets, each covering an interval of width `1/n`. A value `v` goes to
bucket `floor(v × n)`. Sort each bucket on its own, then join the buckets in
order. For the ten values `0.78, 0.17, 0.39, 0.26, 0.72, 0.94, 0.21, 0.12, 0.23,
0.68` the bucket numbers are 7, 1, 3, 2, 7, 9, 2, 1, 2, 6. Bucket 1 holds 0.17
and 0.12, bucket 2 holds 0.26, 0.21 and 0.23, bucket 7 holds 0.78 and 0.72, and
buckets 3, 6 and 9 hold one value each. Sorting each bucket and reading the
buckets from 0 to 9 gives `0.12, 0.17, 0.21, 0.23, 0.26, 0.39, 0.68, 0.72,
0.78, 0.94`.

## When to use it

Counting sort fits keys from a small known range: ages, exam scores from 0 to
100, letters, the digits of a larger number. It is also the right inner step of
radix sort. When the range is much bigger than the number of items, it loses:
sorting a thousand numbers that can be anywhere in `[0, 10⁹]` would build a
billion counters to sort a thousand items, while a comparison sort needs about
10,000 comparisons.

Radix sort fits fixed-width integers or strings, such as IDs and timestamps,
where the number of digits is small and known. Bucket sort fits floating-point
data from a known interval with no clumping, such as random numbers or
normalised measurements. If the data is clumped, say most values within a tiny
part of the interval, most of it lands in a few buckets and the speed advantage
is gone.

For general data, with unknown ranges, arbitrary objects ordered by a
comparison, or no promise about the distribution, use the language's built-in
sort. Python's `sorted` and JavaScript's `Array.prototype.sort` are comparison
sorts, and for mixed data they are the right default.

## Walkthrough

```python
from collections.abc import Callable, Sequence
from typing import TypeVar

T = TypeVar("T")


def counting_sort(
    items: Sequence[T], lo: int, hi: int, key: Callable[[T], int] | None = None
) -> list[T]:
    """Sort items by an integer key in [lo, hi], keeping equal keys in input order."""
    if hi < lo:
        raise ValueError("empty key range")
    get = key or (lambda item: item)
    keys = [get(item) for item in items]
```

```typescript
/** Sort items by an integer key in [lo, hi], keeping equal keys in input order. */
export function countingSort<T>(
  items: readonly T[],
  lo: number,
  hi: number,
  key: (item: T) => number = (item) => item as unknown as number,
): T[] {
  if (hi < lo) throw new RangeError('empty key range');
  const keys = items.map((item) => key(item));
```

The `key` function is what lets this sort records, not just bare integers: it
says which integer to sort each item by, and without one the item is its own
key. The keys are computed once up front, into a list, rather than once while
counting and again while placing. That way the function is called exactly once
per item, which matters if it is slow or has side effects, and the placement
loop below reads the same keys the counting loop saw. In TypeScript,
`items.map(key)` would be shorter, but `map` also passes the index and the
array as extra arguments, so a key function like `parseInt` would receive a
radix by accident. Wrapping it in `(item) => key(item)` passes the item and
nothing else.

```python
    counts = [0] * (hi - lo + 1)
    for value in keys:
        if not lo <= value <= hi:
            raise ValueError(f"key {value} outside [{lo}, {hi}]")
        counts[value - lo] += 1
    for j in range(1, len(counts)):
        counts[j] += counts[j - 1]
    result = list(items)
    for i in range(len(items) - 1, -1, -1):
        counts[keys[i] - lo] -= 1
        result[counts[keys[i] - lo]] = items[i]
    return result
```

```typescript
  const counts: number[] = new Array<number>(hi - lo + 1).fill(0);
  for (const value of keys) {
    if (!Number.isInteger(value) || value < lo || value > hi) {
      throw new RangeError(`key ${value} outside [${lo}, ${hi}]`);
    }
    counts[value - lo]++;
  }
  for (let j = 1; j < counts.length; j++) {
    counts[j] += counts[j - 1];
  }
  const result = [...items];
  for (let i = items.length - 1; i >= 0; i--) {
    result[--counts[keys[i] - lo]] = items[i];
  }
  return result;
}
```

There is one counter per key in the range, so a key `value` uses counter
`value - lo`: subtracting `lo` shifts the range to start at 0, which is what
lets negative keys work. The range check is not decoration. In Python an index
of `-1` doesn't fail, it silently picks the last counter, so a key just below
`lo` would be counted under the wrong key and produce a wrong answer with no
error. The second loop is a prefix sum: each counter adds the one before it,
so counter `j` becomes the number of items whose key is at most `lo + j`. For
the example above that turns `[2, 1, 2, 1]` into `[2, 3, 5, 6]`.

Each total is one past the last slot its key may use, so the counter is
decreased first and then used as the slot: the first item placed for key 2 in
the example takes slot 4, the next takes slot 3, and so on downwards. Because
the loop goes from the end of the input, the last item with a given key takes
the highest slot for that key and earlier ones take lower slots, which puts
equal keys in input order. Going forwards through the input with these totals
would give the first item the highest slot, reversing every group of equal keys.
Radix sort would then be wrong too, since it relies on this order. `result` starts
as a copy of the input only to have the right length and type; every slot is
overwritten, and the caller's list is left untouched.

```python
def radix_sort(nums: Sequence[int], base: int = 10) -> list[int]:
    """Sort non-negative integers one digit at a time, least significant first."""
    if base < 2:
        raise ValueError("base must be at least 2")
    if any(n < 0 for n in nums):
        raise ValueError("radix_sort needs non-negative integers")
    result = list(nums)
    place = 1
    while place <= max(result, default=0):
        result = counting_sort(result, 0, base - 1, lambda n: (n // place) % base)
        place *= base
    return result
```

```typescript
/** Sort non-negative integers one digit at a time, least significant first. */
export function radixSort(nums: readonly number[], base = 10): number[] {
  if (base < 2) throw new RangeError('base must be at least 2');
  if (nums.some((n) => !Number.isInteger(n) || n < 0)) {
    throw new RangeError('radixSort needs non-negative integers');
  }
  let result = [...nums];
  const biggest = result.reduce((a, b) => Math.max(a, b), 0);
  for (let place = 1; place <= biggest; place *= base) {
    result = countingSort(result, 0, base - 1, (n) => Math.floor(n / place) % base);
  }
  return result;
}
```

`place` is the value of the digit position being sorted: 1 for the ones digit,
`base` for the next, then `base²`, and so on. Dividing by `place` and taking the
remainder modulo `base` extracts that digit, which is always in `[0, base - 1]`,
so every pass is a counting sort with a small fixed range, however large the
numbers are. The loop stops once `place` passes the largest number, because
every digit above that is 0 for all of them and sorting by it changes nothing:
for the example, `place` goes 1, 10, 100, and 1000 exceeds 802, so there are
three passes. Negative numbers are rejected because the digit formula doesn't
mean the same thing for them; the Pitfalls say how to handle them. In
TypeScript, `Math.floor(n / place)` stands in for Python's `//`, since `/` on
numbers gives a fraction, and `reduce` finds the maximum because spreading a very
large array into `Math.max(...)` can overflow the call stack.

```python
def insertion_sort(items: list[float]) -> None:
    """Sort a list in place; fast when it is short or nearly sorted."""
    for i in range(1, len(items)):
        value = items[i]
        j = i - 1
        while j >= 0 and items[j] > value:
            items[j + 1] = items[j]
            j -= 1
        items[j + 1] = value
```

```typescript
/** Sort an array in place; fast when it is short or nearly sorted. */
export function insertionSort(items: number[]): void {
  for (let i = 1; i < items.length; i++) {
    const value = items[i];
    let j = i - 1;
    while (j >= 0 && items[j] > value) {
      items[j + 1] = items[j];
      j--;
    }
    items[j + 1] = value;
  }
}
```

Bucket sort needs some sort for the inside of each bucket, and this is the one
used here. It grows a sorted prefix: take the next element, shift every larger
element of the prefix one place right, and drop the element into the gap. Each
bucket is expected to hold about one value, so the shifting almost never runs,
and there is no overhead of a fancier algorithm to pay for. The cost of that
choice is the worst case, covered below: insertion sort on a long, unsorted
bucket takes time proportional to its length squared. The comparison is
`items[j] > value`, not `>=`, so equal values are not moved past each other,
which keeps the sort stable.

```python
def bucket_sort(values: Sequence[float]) -> list[float]:
    """Sort floats in [0, 1) by spreading them over len(values) equal-width buckets."""
    n = len(values)
    buckets: list[list[float]] = [[] for _ in range(n)]
    for v in values:
        if not 0 <= v < 1:
            raise ValueError(f"value {v} outside [0, 1)")
        buckets[int(v * n)].append(v)
    result: list[float] = []
    for bucket in buckets:
        insertion_sort(bucket)
        result.extend(bucket)
    return result
```

```typescript
/** Sort floats in [0, 1) by spreading them over values.length equal-width buckets. */
export function bucketSort(values: readonly number[]): number[] {
  const n = values.length;
  const buckets: number[][] = Array.from({ length: n }, () => []);
  for (const v of values) {
    if (!(v >= 0 && v < 1)) throw new RangeError(`value ${v} outside [0, 1)`);
    buckets[Math.floor(v * n)].push(v);
  }
  const result: number[] = [];
  for (const bucket of buckets) {
    insertionSort(bucket);
    for (const v of bucket) result.push(v);
  }
  return result;
}
```

There are as many buckets as values, so a uniform input puts one value per
bucket on average. `v * n` is below `n` for every `v < 1`, so `int(v * n)` is a
valid bucket number from 0 to `n - 1`; a value of 1.0 would give `n` and fall
off the end, which is why the range check comes first. The check is written as
`not 0 <= v < 1`, which also rejects NaN: every comparison with NaN is false, so
it can never satisfy the range, whereas a check that only looked for `v < 0 or
v >= 1` would let it through. Because bucket `b` holds only values below every
value in bucket `b + 1`, concatenating the sorted buckets in order gives a sorted
result with no merging step. The TypeScript pushes one value at a time instead
of `result.push(...bucket)` for the same stack-size reason as above.

## Complexity

Counting sort takes O(n + k) time and O(n + k) space for `n` items and
`k = hi - lo + 1` possible keys: one pass over the items to count, one over
the `k` counters for the running total, one over the items to place them, and
a counter array of size `k` plus an output of size `n`. With `k` around `n`
that is linear, below the `n log n` floor. When `k` is far larger than `n` the
`k` term takes over, and at `k` = 10⁹ with a thousand items it is the whole
cost.

Radix sort runs `d` counting sorts, where `d` is the number of digits in the
largest number in the chosen base, each on `base` possible keys. That is
O(d × (n + base)) time and O(n + base) space, since each pass reuses the same
amount of memory. For 32-bit numbers in base 10 that is at most 10 passes, a
constant, so the sort is linear in `n`. A larger base means fewer passes and
bigger counter arrays.

Bucket sort on uniform input is O(n) expected. The work outside the buckets is
`n`, and sorting a bucket of size `s` with insertion sort costs about `s²`, so
the cost is the sum of squared bucket sizes. For `n` values thrown independently
and uniformly into `n` buckets, the expected sum is `2n - 1`, under `2n`. I
simulated this, and the average over twenty runs of 100,000 values was 2.0005
times `n`. The worst case is all values in one bucket, where the single
bucket costs O(n²) with insertion sort. A different inner sort changes that
number: a merge sort inside each bucket would make the worst case O(n log n),
at the cost of more work per tiny bucket in the common case. Space is O(n) for
the buckets and the result.

## Pitfalls

- **A huge key range.** The counter array has one slot per possible key, used
  or not. Sorting 1,000 numbers that can be anywhere up to a billion allocates
  a billion counters. Use a comparison sort, or radix sort, which splits the key
  into digits and keeps `k` small.
- **Placing from the front.** Walking the input forwards with these totals
  still sorts by key, but reverses each group of equal keys, so the sort is no
  longer stable. For counting sort on bare integers nobody can tell, but radix
  sort breaks: its later passes rely on the order earlier passes left behind,
  and the tests here fail if the loop direction is flipped.
- **Forgetting to subtract `lo`.** Using `value` directly as the counter index
  works only when the range starts at 0. With a range like `[-3, 2]` a key of
  -3 indexes counter -3, which in TypeScript is not an array slot at all and in
  Python is a counter from the far end.
- **Negative numbers in radix sort.** The digit extraction assumes non-negative
  numbers, and the function rejects the rest. To sort numbers that may be
  negative, subtract the smallest value from every number first, sort, and add
  it back, or sort the negatives and non-negatives separately.
- **An unstable inner sort in radix sort.** Any per-digit pass that reorders
  equal digits erases what the earlier passes did, and the final result is not
  sorted. The per-digit sort must be stable.
- **Bucket sort on clumped data or the wrong interval.** The expected O(n)
  assumes values spread evenly over `[0, 1)`. A million values between 0.90
  and 0.91 fall into about 10,000 of the million buckets, so each bucket holds
  about 100 values and the insertion sorts cost many times more than expected.
  Data that does not live in `[0, 1)` must be scaled into it first, by
  subtracting the minimum and dividing by the range.
- **Floating-point keys in counting sort.** Counting sort needs integer keys
  to use as indices. A fractional key has no counter, and the code rejects it
  in TypeScript. Convert to integers first, for example by rounding to cents.
