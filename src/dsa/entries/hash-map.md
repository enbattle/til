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

| Operation                   | Average        | Worst case |
| --------------------------- | -------------- | ---------- |
| `get(key)`, `contains(key)` | O(1)           | O(n)       |
| `put(key, value)`           | O(1) amortized | O(n)       |
| `delete(key)`               | O(1)           | O(n)       |
| Space                       | O(n)           | O(n)       |

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

Both versions share one small hash function so they behave the same way. Real
code would use the built-in one (Python's `hash`, or just a `dict`), which is
tuned and, for Python strings, salted on each run; a plain one makes the idea
visible. The map stores string keys and int values, and `get` takes the value
to return on a miss.

```python region=hash-function

```

```typescript region=hash-function

```

The hash walks the characters, multiplying the running total by 31 before adding
each character's code, so "ab" and "ba" differ. The `%` at each step keeps the
number small: a JavaScript number past `2 ** 53` loses its low digits, and long keys
would land in the same few buckets.

```python region=buckets

```

```typescript region=buckets

```

`_bucket` is the whole idea in one line: hash, remainder, index. The count lives
in its own field so `size()` doesn't walk every bucket.

```python region=find

```

```typescript region=find

```

Lookup compares keys with `==` because two different keys can share a bucket.
Next, the insert that decides when to grow.

```python region=put

```

```typescript region=put

```

On the running example, a fourth key (`"di"`, hash 2) would make the load
factor 4 / 4 = 1, over 0.75, so the map doubles to 8 buckets first. Deletion
comes before the resize itself.

```python region=delete

```

```typescript region=delete

```

Returning whether the key was there saves callers a separate `contains` check. The
last method is the resize.

```python region=resize

```

```typescript region=resize

```

After the resize `"ada"` (17) stays in bucket 17 % 8 = 1, but `"cy"` (13) moves
from bucket 1 to 13 % 8 = 5, `"bob"` (6) moves from 2 to 6, and `"di"` (2) lands in
bucket 2. Four pairs, four different buckets, so every chain has length one.

## Pitfalls

- **Building buckets with `[[]] * capacity`.** It repeats one list, so every
  key shares a single bucket. Answers stay right at first, only slow, until a
  resize files each pair once per reference and `delete` removes just one
  copy. The same trap is `new Array(n).fill([])` in TypeScript, which is why
  the constructor pushes a fresh array per bucket.
- **Reusing the bucket after `_resize`.** A `bucket` found at the top of
  `put` would belong to the list the resize just discarded. Appending to it
  loses the new key silently, which is why `put` looks the bucket up after the
  resize.
- **A hash that ignores order.** Adding up the character codes gives "ab" and
  "ba" the same hash, so anagrams pile into one bucket. The `* 31` in
  `hash_code` makes position matter.
- **Using `get` to test membership.** A stored value equal to the default is
  indistinguishable from a miss, so `contains` looks for the key itself.
