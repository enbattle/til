/** Merge two arrays, each already sorted by key, into one sorted array. */
export function merge<T>(
  left: readonly T[],
  right: readonly T[],
  key: (item: T) => number,
): T[] {
  const merged: T[] = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    if (key(left[i]) <= key(right[j])) {
      merged.push(left[i]);
      i++;
    } else {
      merged.push(right[j]);
      j++;
    }
  }
  while (i < left.length) merged.push(left[i++]);
  while (j < right.length) merged.push(right[j++]);
  return merged;
}

/** A new array with the items in ascending key order; ties keep their order. */
export function mergeSort(items: readonly number[]): number[];
export function mergeSort<T>(items: readonly T[], key: (item: T) => number): T[];
export function mergeSort<T>(items: readonly T[], key?: (item: T) => number): T[] {
  const keyOf = key ?? ((item: T) => item as unknown as number);
  if (items.length <= 1) return [...items];
  const mid = Math.floor(items.length / 2);
  return merge(
    mergeSort(items.slice(0, mid), keyOf),
    mergeSort(items.slice(mid), keyOf),
    keyOf,
  );
}

/** The sorted array and the number of pairs i < j with nums[i] > nums[j]. */
export function sortAndCount(nums: readonly number[]): [number[], number] {
  if (nums.length <= 1) return [[...nums], 0];
  const mid = Math.floor(nums.length / 2);
  const [left, leftCount] = sortAndCount(nums.slice(0, mid));
  const [right, rightCount] = sortAndCount(nums.slice(mid));
  const merged: number[] = [];
  let crossing = 0;
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    if (left[i] <= right[j]) {
      merged.push(left[i]);
      i++;
    } else {
      merged.push(right[j]);
      j++;
      crossing += left.length - i;
    }
  }
  while (i < left.length) merged.push(left[i++]);
  while (j < right.length) merged.push(right[j++]);
  return [merged, leftCount + rightCount + crossing];
}
