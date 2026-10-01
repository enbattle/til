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

    def _bucket(self, key: Hashable) -> list[list[Any]]:
        return self._buckets[self._hash(key) % len(self._buckets)]

    def get(self, key: Hashable, default: Any = None) -> Any:
        for k, v in self._bucket(key):
            if k == key:
                return v
        return default

    def __contains__(self, key: Hashable) -> bool:
        return any(k == key for k, _ in self._bucket(key))

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

    def delete(self, key: Hashable) -> bool:
        bucket = self._bucket(key)
        for i, (k, _) in enumerate(bucket):
            if k == key:
                bucket[i] = bucket[-1]
                bucket.pop()
                self._size -= 1
                return True
        return False

    def _resize(self, new_capacity: int) -> None:
        old_buckets = self._buckets
        self._buckets = [[] for _ in range(new_capacity)]
        for bucket in old_buckets:
            for pair in bucket:
                self._bucket(pair[0]).append(pair)
