// #region hash-function
const HASH_MODULUS = 1_000_003;

export function hashCode(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    // Multiply by 31 so the order of the letters matters ("ab" != "ba").
    // The % keeps h small. Without it h grows with every character; a
    // JavaScript number past 2**53 loses its low digits, so long keys
    // would crowd into the same few buckets.
    h = (h * 31 + key.charCodeAt(i)) % HASH_MODULUS;
  }
  return h;
}
// #endregion

// #region buckets
const MAX_LOAD_FACTOR = 0.75;

type Pair = [string, number];

/** A hash map with separate chaining: each bucket is an array of [key, value]. */
export class HashMap {
  private buckets: Pair[][];
  private count = 0;

  constructor(capacity = 8) {
    // A loop, not new Array(n).fill([]): that repeats one array, so every
    // key would share a single bucket.
    this.buckets = [];
    for (let i = 0; i < capacity; i++) {
      this.buckets.push([]);
    }
  }

  size(): number {
    return this.count;
  }

  capacity(): number {
    return this.buckets.length;
  }

  private bucketFor(key: string): Pair[] {
    return this.buckets[hashCode(key) % this.buckets.length];
  }
  // #endregion

  // #region find
  private find(key: string): Pair | null {
    for (const pair of this.bucketFor(key)) {
      if (pair[0] === key) {
        return pair;
      }
    }
    return null;
  }

  get(key: string, defaultValue: number): number {
    const pair = this.find(key);
    if (pair === null) {
      return defaultValue;
    }
    return pair[1];
  }

  contains(key: string): boolean {
    // Look for the key itself: get() can't tell a stored value that equals
    // the default from a miss.
    return this.find(key) !== null;
  }
  // #endregion

  // #region put
  put(key: string, value: number): void {
    const pair = this.find(key);
    if (pair !== null) {
      pair[1] = value; // an overwrite adds no entry, so no resize
      return;
    }
    // Check with count + 1 so the load factor never exceeds the bound.
    if ((this.count + 1) / this.buckets.length > MAX_LOAD_FACTOR) {
      this.resize(2 * this.buckets.length);
    }
    // Find the bucket after any resize: the old bucket array was discarded.
    this.bucketFor(key).push([key, value]);
    this.count += 1;
  }
  // #endregion

  // #region delete
  delete(key: string): boolean {
    const bucket = this.bucketFor(key);
    for (let i = 0; i < bucket.length; i++) {
      if (bucket[i][0] === key) {
        // Order inside a bucket means nothing: move the last pair into
        // the gap rather than shifting every later one down.
        bucket[i] = bucket[bucket.length - 1];
        bucket.pop();
        this.count -= 1;
        return true;
      }
    }
    return false;
  }
  // #endregion

  // #region resize
  private resize(newCapacity: number): void {
    const oldBuckets = this.buckets;
    this.buckets = [];
    for (let i = 0; i < newCapacity; i++) {
      this.buckets.push([]);
    }
    // Rehash every pair: hash % capacity changed, so its old bucket is
    // wrong. Push directly; put() would recount and could resize again.
    for (const bucket of oldBuckets) {
      for (const pair of bucket) {
        this.bucketFor(pair[0]).push(pair);
      }
    }
  }
}
// #endregion
