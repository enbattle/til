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

  delete(key: string): boolean {
    const bucket = this.bucketFor(key);
    const i = bucket.findIndex((entry) => entry.key === key);
    if (i === -1) return false;
    bucket[i] = bucket[bucket.length - 1];
    bucket.pop();
    this.count--;
    return true;
  }

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
