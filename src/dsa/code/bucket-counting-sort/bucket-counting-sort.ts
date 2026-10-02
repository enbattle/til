/** Sort items by an integer key in [lo, hi], keeping equal keys in input order. */
export function countingSort<T>(
  items: readonly T[],
  lo: number,
  hi: number,
  key: (item: T) => number = (item) => item as unknown as number,
): T[] {
  if (hi < lo) throw new RangeError('empty key range');
  const keys = items.map((item) => key(item));
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
