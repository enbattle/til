---
title: Hash Map
summary: A map that finds a value by its key in constant time on average, by hashing the key to one bucket and doubling the table before the buckets get crowded.
date: 2026-10-05
kind: data-structure
---

A hash map stores values under keys, the way a contacts list stores numbers
under names. Python's `dict` and JavaScript's `Map` are hash maps. Building
one from scratch makes "constant time" stop being magic, and shows exactly
when it fails.

## Prerequisites

- [Arrays and strings](/dsa/arrays-and-strings): a hash map is an array of
  buckets, and it only works because reading `items[i]` costs the same for any
  `i`.

## What it is

Suppose you keep a million `(username, score)` pairs in an array. Finding one
user means checking pairs one at a time, about half a million on average. An
array is fast only when you already know the index.

So turn the key into an index. A **hash function** takes a key and returns an
integer, its **hash**: the same key always gives the same hash, and different
keys spread over a wide range. The map keeps an array of **buckets** and files
each key in bucket `hash(key) % capacity`, where the **capacity** is the number
of buckets. Lookup hashes the key again, jumps to that one bucket and searches
only there.

Two keys can land in the same bucket, a **collision**, and no hash function
prevents them, since there are far more possible keys than buckets. This map
uses **separate chaining**: each bucket is a short list of `[key, value]`
pairs. The alternative, **open addressing**, stores every pair in the bucket
array itself and probes other slots on a collision; CPython's `dict` does this.
Chaining is easier to get right in an interview, and deletion is trivial.

Here is the running example: 4 buckets and three keys with made-up hashes,
`"ada"` 17, `"bob"` 6 and `"cy"` 13. Since 17 % 4 = 1, 6 % 4 = 2 and
13 % 4 = 1, `"ada"` and `"cy"` share bucket 1:

```text
bucket 0: []
bucket 1: [["ada", 3], ["cy", 9]]
bucket 2: [["bob", 5]]
bucket 3: []
```

Looking up `"cy"` computes 13 % 4 = 1, skips `"ada"` and finds it: 9. The
other buckets are never touched.

How long the scan takes depends on the list lengths. The **load factor**,
entries divided by buckets, is the average length. Keep it bounded and every
lookup stays constant-time on average however many entries you add. The map does that by
**resizing**: when an insert would push the load factor past 0.75, it doubles
the buckets and refiles every pair. Why not wait until chains are long? Because
by then every operation is already slow, and a resize that keeps pace with
growth costs almost nothing, as you'll see below.

## When to use it

- The question is "have I seen this before?" or "what goes with this key?":
  counting words, grouping records by a field, caching answers.
- A nested loop searches the rest of the array for a partner (two sum): store
  what you've seen, and the O(n²) scan becomes one O(n) pass.
- You need to deduplicate, or check membership many times.
- The wrong signal: you need the smallest key, the next key after this one, or
  all keys in a range. A hash map scatters keys on purpose and can't answer
  those without visiting everything; keep sorted data and use
  [binary search](/dsa/binary-search), or a
  [binary search tree](/dsa/binary-search-tree) if it keeps changing.

## Operations and costs

With n entries and a decent hash function:

| Operation                | Average        | Worst case |
| ------------------------ | -------------- | ---------- |
| `get(key)`, `key in map` | O(1)           | O(n)       |
| `put(key, value)`        | O(1) amortized | O(n)       |
| `delete(key)`            | O(1)           | O(n)       |
| Space                    | O(n)           | O(n)       |

The worst case is every key in one bucket: the map is a single list and each
operation scans all n pairs. Someone who controls the keys, such as the field
names in a web request, can choose ones that collide on purpose. Python
counters this by salting string hashes with a random value each time the
interpreter starts, so which strings collide can't be planned.

**Amortized** means averaged over a long run, where cheap operations pay for an
occasional expensive one. Starting from 8 buckets, resizes happen as the 7th,
13th, 25th and 49th entries arrive and move 6, 12, 24 and 48 pairs. Each moves
6 more pairs than all earlier resizes together, so after n entries the total is
under 2n moves: fewer than two extra moves per insert. Growing by a fixed
amount instead would resize every few inserts and make the total quadratic.

## Implementation

Both versions take the hash function as a constructor argument, which the tests
use to force collisions. Python hashes any hashable key with the built-in
`hash`. The TypeScript map takes string keys and brings Java's string hash,
`h = 31 * h + code` per character kept to 32 bits, since JavaScript doesn't
expose the one its engine uses.

```python
from collections.abc import Callable, Hashable
from typing import Any

class HashMap:
    """A hash map with separate chaining: each bucket is a list of [key, value]."""

    MAX_LOAD_FACTOR = 0.75

    def __init__(self, capacity: int = 8, hash_fn: Callable[[Hashable], int] = hash):
        # A comprehension, not [[]] * capacity: that repeats one list, so
        # every key would share a single bucket.
        self._buckets: list[list[list[Any]]] = [[] for _ in range(capacity)]
        self._size = 0
        self._hash = hash_fn

    def __len__(self) -> int:
        return self._size

    @property
    def capacity(self) -> int:
        return len(self._buckets)

    def _bucket(self, key: Hashable) -> list[list[Any]]:
        # Python's % is never negative for a positive divisor, so a negative
        # hash still gives a valid index (JavaScript's would not).
        return self._buckets[self._hash(key) % len(self._buckets)]
```

```typescript
/** Java's `String.hashCode`: h = 31 * h + code per UTF-16 unit, kept to 32 bits. */
function stringHash(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    // imul multiplies as 32-bit ints, as Java does; | 0 wraps the final
    // sum too, so the result is a signed 32-bit int like Java's.
    h = (Math.imul(31, h) + key.charCodeAt(i)) | 0;
  }
  return h;
}

type Entry<V> = { key: string; value: V };

/** A hash map with separate chaining: each bucket is an array of entries. */
export class HashMap<V> {
  static readonly MAX_LOAD_FACTOR = 0.75;
  private buckets: Entry<V>[][];
  private count = 0;

  constructor(
    capacity = 8,
    private readonly hash: (key: string) => number = stringHash,
  ) {
    // A factory per bucket: new Array(n).fill([]) would share one array.
    this.buckets = Array.from({ length: capacity }, () => []);
  }

  get size() {
    return this.count;
  }

  get capacity() {
    return this.buckets.length;
  }

  private bucketFor(key: string): Entry<V>[] {
    const n = this.buckets.length;
    // JavaScript's % keeps the dividend's sign (-3 % 8 is -3), which is not
    // an index; adding n and taking % again fixes it.
    return this.buckets[((this.hash(key) % n) + n) % n];
  }
```

`_bucket` is the whole idea in one line: hash, remainder, index. The count lives
in its own field so `len(m)` doesn't walk every bucket.

```python
    def get(self, key: Hashable, default: Any = None) -> Any:
        for k, v in self._bucket(key):
            if k == key:
                return v
        return default

    def __contains__(self, key: Hashable) -> bool:
        # Look for the key itself: get() can't tell a stored None from a miss.
        return any(k == key for k, _ in self._bucket(key))
```

```typescript
  private find(key: string): Entry<V> | undefined {
    return this.bucketFor(key).find((entry) => entry.key === key);
  }

  get(key: string): V | undefined {
    return this.find(key)?.value;
  }

  has(key: string): boolean {
    // Test the entry, not get(): get() can't tell a stored undefined from a miss.
    return this.find(key) !== undefined;
  }
```

Lookup compares keys with `==` because two different keys can share a bucket.
Next, the insert that decides when to grow.

```python
    def put(self, key: Hashable, value: Any) -> None:
        bucket = self._bucket(key)
        for pair in bucket:
            if pair[0] == key:
                pair[1] = value  # an overwrite adds no entry, so no resize
                return
        # Check with size + 1 so the load factor never exceeds the bound.
        if (self._size + 1) / len(self._buckets) > self.MAX_LOAD_FACTOR:
            self._resize(2 * len(self._buckets))
            bucket = self._bucket(key)  # the old bucket list was just discarded
        bucket.append([key, value])
        self._size += 1
```

```typescript
  put(key: string, value: V): void {
    const existing = this.find(key);
    if (existing) {
      existing.value = value; // an overwrite adds no entry, so no resize
      return;
    }
    // Check with count + 1 so the load factor never exceeds the bound.
    if ((this.count + 1) / this.buckets.length > HashMap.MAX_LOAD_FACTOR) {
      this.resize(this.buckets.length * 2);
    }
    // Look the bucket up after any resize: the old array was just discarded.
    this.bucketFor(key).push({ key, value });
    this.count++;
  }
```

On the running example, a fourth key (`"di"`, hash 2) would make the load
factor 4 / 4 = 1, over 0.75, so the map doubles to 8 buckets first. Deletion
comes before the resize itself.

```python
    def delete(self, key: Hashable) -> bool:
        bucket = self._bucket(key)
        for i, (k, _) in enumerate(bucket):
            if k == key:
                # Order inside a bucket means nothing: swap in the last pair
                # rather than shifting every later one down.
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
    // Order inside a bucket means nothing: swap in the last entry rather
    // than shifting every later one down.
    bucket[i] = bucket[bucket.length - 1];
    bucket.pop();
    this.count--;
    return true;
  }
```

Returning whether the key was there saves callers a separate `in` check. The
last method is the resize.

```python
    def _resize(self, new_capacity: int) -> None:
        old_buckets = self._buckets
        self._buckets = [[] for _ in range(new_capacity)]
        # Rehash every pair: hash % capacity changed, so its old bucket is
        # wrong. Append directly; put() would recount and could resize again.
        for bucket in old_buckets:
            for pair in bucket:
                self._bucket(pair[0]).append(pair)
```

```typescript
  private resize(capacity: number): void {
    const oldBuckets = this.buckets;
    this.buckets = Array.from({ length: capacity }, () => []);
    // Rehash every entry: hash % capacity changed, so its old bucket is
    // wrong. Push directly; put() would recount and could resize again.
    for (const bucket of oldBuckets) {
      for (const entry of bucket) {
        this.bucketFor(entry.key).push(entry);
      }
    }
  }
}
```

After the resize `"ada"` (17) stays in bucket 17 % 8 = 1, but `"cy"` (13) moves
from bucket 1 to 13 % 8 = 5, `"bob"` (6) moves from 2 to 6, and `"di"` (2) lands in
bucket 2. Four pairs, four different buckets, so every chain has length one.

## Pitfalls

- **Building buckets with `[[]] * capacity`.** It repeats one list, so every
  key shares a single bucket. Answers stay right at first, only slow, until a
  resize files each pair once per reference and `delete` removes just one
  copy. The same trap is `new Array(n).fill([])` in TypeScript.
- **Reusing the bucket after `_resize`.** The `bucket` found at the top of
  `put` belongs to the array the resize just discarded. Appending to it
  loses the new key silently, which is why `put` looks it up again.
- **Trusting `%` in JavaScript.** `-3 % 8` is `-3`, not an index, and a hash
  can be negative. The `+ n` and second `%` in `bucketFor` fix it; Python's `%`
  needs no fix.
- **Using `get` to test membership.** A stored `None` or `undefined` is
  indistinguishable from a miss, so `in` and `has` look for the key itself.
