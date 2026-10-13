# region hash-function
HASH_MODULUS = 1_000_003


def hash_code(key: str) -> int:
    h = 0
    for ch in key:
        # Multiply by 31 so the order of the letters matters ("ab" != "ba").
        # The % keeps h small. Without it h grows with every character; a
        # JavaScript number past 2**53 loses its low digits, so long keys
        # would crowd into the same few buckets.
        h = (h * 31 + ord(ch)) % HASH_MODULUS
    return h
# endregion


# region buckets
MAX_LOAD_FACTOR = 0.75


class HashMap:
    """A hash map with separate chaining: each bucket is a list of [key, value]."""

    def __init__(self, capacity: int = 8):
        # A comprehension, not [[]] * capacity: that repeats one list, so
        # every key would share a single bucket.
        self._buckets: list[list[list]] = [[] for _ in range(capacity)]
        self._count = 0

    def size(self) -> int:
        return self._count

    def capacity(self) -> int:
        return len(self._buckets)

    def _bucket(self, key: str) -> list[list]:
        return self._buckets[hash_code(key) % len(self._buckets)]
# endregion

    # region find
    def _find(self, key: str) -> list | None:
        for pair in self._bucket(key):
            if pair[0] == key:
                return pair
        return None

    def get(self, key: str, default: int) -> int:
        pair = self._find(key)
        if pair is None:
            return default
        return pair[1]

    def contains(self, key: str) -> bool:
        # Look for the key itself: get() can't tell a stored value that equals
        # the default from a miss.
        return self._find(key) is not None
    # endregion

    # region put
    def put(self, key: str, value: int) -> None:
        pair = self._find(key)
        if pair is not None:
            pair[1] = value  # an overwrite adds no entry, so no resize
            return
        # Check with count + 1 so the load factor never exceeds the bound.
        if (self._count + 1) / len(self._buckets) > MAX_LOAD_FACTOR:
            self._resize(2 * len(self._buckets))
        # Find the bucket after any resize: the old bucket list was discarded.
        self._bucket(key).append([key, value])
        self._count += 1
    # endregion

    # region delete
    def delete(self, key: str) -> bool:
        bucket = self._bucket(key)
        for i in range(len(bucket)):
            if bucket[i][0] == key:
                # Order inside a bucket means nothing: move the last pair into
                # the gap rather than shifting every later one down.
                bucket[i] = bucket[len(bucket) - 1]
                bucket.pop()
                self._count -= 1
                return True
        return False
    # endregion

    # region resize
    def _resize(self, new_capacity: int) -> None:
        old_buckets = self._buckets
        self._buckets = [[] for _ in range(new_capacity)]
        # Rehash every pair: hash % capacity changed, so its old bucket is
        # wrong. Append directly; put() would recount and could resize again.
        for bucket in old_buckets:
            for pair in bucket:
                self._bucket(pair[0]).append(pair)
    # endregion
