/** Java's `String.hashCode`: h = 31 * h + code per UTF-16 unit, kept to 32 bits. */
function stringHash(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    // | 0 wraps h to 32 bits each step; without it h passes 2^53
    // and the double loses its low digits.
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
