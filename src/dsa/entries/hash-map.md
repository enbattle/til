---
title: Hash Map
summary: Finding a value by its key in constant time on average, by hashing the key straight to one bucket and growing the table before the buckets get crowded.
date: 2026-09-30
kind: data-structure
---

A hash map stores values under keys, the way a contacts list stores phone
numbers under names: you hand it a key and it hands back the value filed under
that key. Python's `dict` and Java's `HashMap` are hash maps, and the major
JavaScript engines implement `Map` with one. The reason to know how they work
is their speed: finding a key takes about the same time whether the map holds ten entries or
ten million. This entry builds one from scratch, so that claim stops being
magic and you can say when it fails.

## Prerequisites

None. You need to know what an array is (a Python list) and that reading
`items[i]` takes the same time for any index `i`, however long the array is.

## What it is

Start with the problem a hash map solves. Suppose you keep a million
`(username, score)` pairs in an array. To find one user's score you check the
pairs one at a time, and on average you look at half a million of them before
you find the right one. An array is only fast when you already know the index.

A hash map turns the key into an index. A **hash function** takes a key and
returns an integer, called the key's **hash**. It is deterministic (the same
key always gives the same hash) and it spreads different keys over a wide
range of integers. The map keeps an array of **buckets** and files each key in
the bucket at index `hash(key) % capacity`, where the **capacity** is the
number of buckets and `%` gives the remainder after division. To look a key
up, the map hashes it again, goes straight to that one bucket and searches only
there.

Two different keys can land in the same bucket. That is a **collision**, and
no hash function avoids them: there are far more possible keys than buckets.
The version below handles collisions with **separate chaining**: each bucket
is a short list of `[key, value]` pairs, and a lookup walks that list comparing
keys. The other common approach, **open addressing**, stores every entry in the
bucket array itself and, on a collision, tries other slots in a fixed order;
CPython's `dict` works that way.

Here is a map with 4 buckets and three keys, using made-up hashes: `"ada"`
hashes to 17, `"bob"` to 6 and `"cy"` to 13. Since 17 % 4 = 1, 6 % 4 = 2 and
13 % 4 = 1, `"ada"` and `"cy"` share bucket 1:

```text
bucket 0: []
bucket 1: [["ada", 3], ["cy", 9]]
bucket 2: [["bob", 5]]
bucket 3: []
```

Looking up `"cy"` computes 13 % 4 = 1, then scans bucket 1: `"ada"` isn't it,
`"cy"` is, so the answer is 9. Buckets 0, 2 and 3 are never touched.

How fast that scan is depends on how long the lists get. The **load factor**
is the number of entries divided by the number of buckets, n / capacity, which
is the average list length. If the hash function spreads keys evenly, a lookup
scans about that many pairs, so a map that keeps its load factor under a fixed
bound keeps its lookups constant-time no matter how many entries it holds. It
does that by **resizing**: when adding an entry would push the load factor
past 0.75, it doubles the number of buckets and moves every entry to the bucket
it belongs in under the new capacity. Java's `HashMap` uses 0.75 as its default
too. A lower bound wastes more empty buckets; a higher one makes the lists
longer.

## Operations and costs

The costs use big-O notation, with n the number of entries: O(1) means the work
doesn't grow with n, and O(n) means it grows in proportion to n. **Amortized**
means averaged over a long run of operations, where an occasional expensive one
is paid for by the many cheap ones around it.

| Operation                | Average        | Worst case |
| ------------------------ | -------------- | ---------- |
| `get(key)`, `key in map` | O(1)           | O(n)       |
| `put(key, value)`        | O(1) amortized | O(n)       |
| `delete(key)`            | O(1)           | O(n)       |
| Resize (inside `put`)    | O(n), rarely   | O(n)       |
| Space                    | O(n)           | O(n)       |

The worst case is every key landing in the same bucket. The map is then one
long list, and every operation scans all n entries. A decent hash function
makes that very unlikely for ordinary keys, but someone who controls the keys,
say the field names in a request to a web server, can choose keys that collide
on purpose and slow the server to a crawl. That is why Python, by default, salts
the hashes of strings with a random value each time the interpreter starts: which strings
collide changes from run to run, so it can't be planned in advance.

A resize copies every entry, which looks like it should ruin the O(1) average
for `put`. It doesn't, because doubling the capacity means the next resize
waits until the map has doubled too. Starting from 8 buckets, the resizes
happen as the 7th, 13th, 25th and 49th entries arrive, and they move 6, 12, 24
and 48 entries. Each resize moves 6 more entries than all the earlier ones put
together, so by the time the map holds n entries it has made fewer than 2n
moves in total: under two moves per insertion, on average.

## Implementation

Both versions take the hash function as an optional constructor argument,
which the tests use to force collisions. The Python map accepts any hashable
key and defaults to the built-in `hash`. The TypeScript map stores string keys
and brings its own hash function, since JavaScript doesn't expose the one its
engine uses.

```python
from collections.abc import Callable, Hashable
from typing import Any


class HashMap:
    """A hash map with separate chaining: each bucket is a list of [key, value]."""

    MAX_LOAD_FACTOR = 0.75

    def __init__(self, capacity: int = 8, hash_fn: Callable[[Hashable], int] = hash):
        if capacity < 1:
            raise ValueError("capacity must be at least 1")
        self._buckets: list[list[list[Any]]] = [[] for _ in range(capacity)]
        self._size = 0
        self._hash = hash_fn

    def __len__(self) -> int:
        return self._size

    @property
    def capacity(self) -> int:
        return len(self._buckets)
```

```typescript
/** Java's `String.hashCode`: h = 31 * h + code per UTF-16 unit, kept to 32 bits. */
function stringHash(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (Math.imul(31, h) + key.charCodeAt(i)) | 0;
  }
  return h;
}

interface Entry<V> {
  key: string;
  value: V;
}

/** A hash map with separate chaining: each bucket is an array of entries. */
export class HashMap<V> {
  static readonly MAX_LOAD_FACTOR = 0.75;
  private buckets: Entry<V>[][];
  private count = 0;
  private readonly hash: (key: string) => number;

  constructor(capacity = 8, hash: (key: string) => number = stringHash) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new RangeError('capacity must be a positive integer');
    }
    this.buckets = Array.from({ length: capacity }, () => []);
    this.hash = hash;
  }

  get size(): number {
    return this.count;
  }

  get capacity(): number {
    return this.buckets.length;
  }
```

The map starts as `capacity` empty buckets and a count of zero. Keeping the
count in its own field means `len(m)` (or `m.size`) is O(1) instead of a walk
over every bucket. `stringHash` is the formula Java uses for its strings: for
each character it multiplies the running total by 31 and adds the character's
code. `Math.imul` multiplies as 32-bit integers and `| 0` cuts the sum back to
32 bits, so the hash stays an exact integer instead of growing into a
floating-point number that has lost its low digits.

```python
    def _bucket(self, key: Hashable) -> list[list[Any]]:
        return self._buckets[self._hash(key) % len(self._buckets)]

    def get(self, key: Hashable, default: Any = None) -> Any:
        for k, v in self._bucket(key):
            if k == key:
                return v
        return default

    def __contains__(self, key: Hashable) -> bool:
        return any(k == key for k, _ in self._bucket(key))
```

```typescript
  private bucketFor(key: string): Entry<V>[] {
    const n = this.buckets.length;
    return this.buckets[((this.hash(key) % n) + n) % n];
  }

  get(key: string): V | undefined {
    return this.bucketFor(key).find((entry) => entry.key === key)?.value;
  }

  has(key: string): boolean {
    return this.bucketFor(key).some((entry) => entry.key === key);
  }
```

The bucket lookup is the whole idea in one line: hash the key, take the
remainder, index the array. `get` then scans only that bucket, comparing keys
with `==` because two different keys can share a bucket (and even a hash).
`__contains__` is what Python's `in` calls. It looks for the key itself rather
than checking whether `get` returned `None`, because `None` is a perfectly good
value to store. The TypeScript `get` returns `undefined` for a missing key, and
`has` answers the same question for a map that stores `undefined`.

```python
    def put(self, key: Hashable, value: Any) -> None:
        bucket = self._bucket(key)
        for pair in bucket:
            if pair[0] == key:
                pair[1] = value
                return
        if (self._size + 1) / len(self._buckets) > self.MAX_LOAD_FACTOR:
            self._resize(2 * len(self._buckets))
            bucket = self._bucket(key)
        bucket.append([key, value])
        self._size += 1
```

```typescript
  put(key: string, value: V): void {
    const existing = this.bucketFor(key).find((entry) => entry.key === key);
    if (existing) {
      existing.value = value;
      return;
    }
    if ((this.count + 1) / this.buckets.length > HashMap.MAX_LOAD_FACTOR) {
      this.resize(this.buckets.length * 2);
    }
    this.bucketFor(key).push({ key, value });
    this.count++;
  }
```

`put` first looks for the key. If it's already there, the value is replaced in
place and nothing else changes: an overwrite adds no entry, so it can never
trigger a resize. Only a new key reaches the load-factor check, which uses
`size + 1`, the load factor the map would have after this insertion. Checking
before inserting is what keeps the load factor at or under 0.75 after every
`put`, not just most of them.

```python
    def delete(self, key: Hashable) -> bool:
        bucket = self._bucket(key)
        for i, (k, _) in enumerate(bucket):
            if k == key:
                bucket[i] = bucket[-1]
                bucket.pop()
                self._size -= 1
                return True
        return False
```

```typescript
  delete(key: string): boolean {
    const bucket = this.bucketFor(key);
    const i = bucket.findIndex((entry) => entry.key === key);
    if (i === -1) return false;
    bucket[i] = bucket[bucket.length - 1];
    bucket.pop();
    this.count--;
    return true;
  }
```

`delete` finds the pair, copies the bucket's last pair over it and removes the
last slot. The order of pairs inside a bucket means nothing, so this is
allowed, and it avoids shifting every later pair down by one the way
`bucket.pop(i)` or `splice(i, 1)` would. It returns whether the key was there,
which callers often need and would otherwise have to ask for separately.

```python
    def _resize(self, new_capacity: int) -> None:
        old_buckets = self._buckets
        self._buckets = [[] for _ in range(new_capacity)]
        for bucket in old_buckets:
            for pair in bucket:
                self._bucket(pair[0]).append(pair)
```

```typescript
  private resize(capacity: number): void {
    const oldBuckets = this.buckets;
    this.buckets = Array.from({ length: capacity }, () => []);
    for (const bucket of oldBuckets) {
      for (const entry of bucket) {
        this.bucketFor(entry.key).push(entry);
      }
    }
  }
}
```

A resize swaps in a new, empty bucket array twice the size, then files every
existing pair again, working out each bucket from the new capacity. A pair
can't keep its old bucket number. In the 4-bucket example above, `"cy"`
(hash 13) sat in bucket 1; with 8 buckets it belongs in bucket 13 % 8 = 5, while
`"ada"` (hash 17) stays in bucket 17 % 8 = 1. Left in bucket 1, `"cy"` would
still be stored, but every lookup would search bucket 5 and never find it.

## Invariants

These hold after every call returns, and each method relies on them:

- **The load factor is at most 0.75.** `put` checks it before adding a key,
  and nothing else adds entries. This is what keeps each bucket short.
- **Every pair is in the bucket its key hashes to** under the current
  capacity: `hash(key) % capacity`. `get`, `in` and `delete` look only there,
  so a pair anywhere else is lost even though it's still in memory. `_resize`
  restores this for every pair when the capacity changes.
- **Each key appears at most once.** `put` overwrites an existing key instead
  of appending a second pair, and `delete` removes the only one.
- **The count equals the number of pairs** across all buckets: it goes up only
  when `put` appends and down only when `delete` removes.

## Tricky lines

- `[[] for _ in range(capacity)]` in `__init__` and `_resize`, not
  `[[]] * capacity`. The shorter form builds a list that holds the same empty
  list `capacity` times, so all the buckets are one shared list and every key
  ends up in it. Until the first resize the answers are still right, just
  O(n) per operation. The resize then goes wrong: `_resize` walks the old
  array, meets that one shared list `capacity` times, and files every pair
  once per visit. With the bug in `__init__`, ten `put` calls leave 52
  references to pairs where there should be 10, and `delete("k3")` returns
  `True` while `"k3" in m` stays `True` and `get("k3")` still returns 3, because
  it removed only one of the copies. With the bug only in `_resize`, the same
  happens one resize later. In TypeScript, `Array.from({ length: capacity }, () => [])`
  calls the function once per bucket, where `new Array(capacity).fill([])`
  would fall into the same trap.
- `bucket = self._bucket(key)` right after `self._resize(...)` in `put`. The
  `bucket` found at the top of `put` belongs to the old bucket array, which the
  resize just replaced. Appending to it would put the pair somewhere the map
  never looks again, so the new key would silently vanish. The TypeScript
  `put` avoids the stale reference by calling `this.bucketFor(key)` again at
  the `push`.
- `self._bucket(pair[0]).append(pair)` in `_resize`, rather than
  `self.put(pair[0], pair[1])`. Calling `put` would count each entry a second
  time, and a `put` inside a resize could decide to resize again.
- `bucket[i] = bucket[-1]` followed by `bucket.pop()` in `delete`. When the pair
  being deleted is already the last one, the first line copies it onto itself
  and the second removes it, so no special case is needed. Changing the list
  in the middle of the `for` loop is safe only because the method returns
  straight after.
- `((this.hash(key) % n) + n) % n` in the TypeScript `bucketFor`. JavaScript's
  `%` keeps the sign of the number being divided, so `-3 % 8` is `-3`, which is
  not an array index; adding `n` and taking the remainder again gives 5.
  Python's `%` already returns a result with the sign of the divisor
  (`-3 % 8 == 5`), and its built-in `hash` can be negative, so the Python line
  needs no fix.

## When to use it

Reach for a hash map when the question is "have I seen this before?" or "what
goes with this key?": counting how often each word appears, grouping records
by a field, or remembering answers you've already computed. In interviews it
is the usual way to trade memory for time. A nested loop that searches the
rest of an array for a partner, O(n²), often becomes a single O(n) pass that
checks a map of what it has already seen.

It is the wrong tool when order matters. A hash map scatters keys on purpose,
so it can't give you the smallest key, the next key after this one, or every
key between two values without looking at all of them. For those, keep the
data sorted and use [binary search](/dsa/binary-search). When the input is
already sorted and memory is tight, [two pointers](/dsa/two-pointers) solves
pair problems with no extra memory at all.

The same `hash % capacity` idea spreads data across servers, and it brings the
resize problem with it: going from 10 servers to 11 changes `hash % servers`
for most keys, so most of the data has to move.
[Consistent hashing](/systems-and-infrastructure/consistent-hashing) is the
scheme that avoids that.
