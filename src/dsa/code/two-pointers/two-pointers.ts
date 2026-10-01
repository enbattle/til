/** Indices [i, j], i < j, of two values in sorted `nums` that add up to `target`. */
export function pairWithSum(nums: number[], target: number): [number, number] | null {
  let left = 0;
  let right = nums.length - 1;
  while (left < right) {
    const total = nums[left] + nums[right];
    if (total === target) return [left, right];
    if (total < target) {
      left++;
    } else {
      right--;
    }
  }
  return null;
}

/** Dedupes sorted `nums` in place; returns k, the count of unique values now first. */
export function dedupeSorted(nums: number[]): number {
  if (nums.length === 0) return 0;
  let write = 1;
  for (let read = 1; read < nums.length; read++) {
    if (nums[read] !== nums[write - 1]) {
      nums[write] = nums[read];
      write++;
    }
  }
  return write;
}
