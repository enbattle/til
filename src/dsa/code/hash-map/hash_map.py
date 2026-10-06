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

    def get(self, key: Hashable, default: Any = None) -> Any:
        for k, v in self._bucket(key):
            if k == key:
                return v
        return default

    def __contains__(self, key: Hashable) -> bool:
        # Look for the key itself: get() can't tell a stored None from a miss.
        return any(k == key for k, _ in self._bucket(key))

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

    def _resize(self, new_capacity: int) -> None:
        old_buckets = self._buckets
        self._buckets = [[] for _ in range(new_capacity)]
        # Rehash every pair: hash % capacity changed, so its old bucket is
        # wrong. Append directly; put() would recount and could resize again.
        for bucket in old_buckets:
            for pair in bucket:
                self._bucket(pair[0]).append(pair)
