/** prefix[i] is the sum of the first i elements; prefix[0] is 0, length is n + 1. */
export function buildPrefix(nums: number[]): number[] {
  const prefix = [0];
  for (const value of nums) {
    prefix.push(prefix[prefix.length - 1] + value);
  }
  return prefix;
}

/** Sum of nums[left..right], both ends included, from prefix = buildPrefix(nums). */
export function rangeSum(prefix: number[], left: number, right: number): number {
  if (!(left >= 0 && left <= right && right < prefix.length - 1)) {
    throw new RangeError('need 0 <= left <= right < nums.length');
  }
  return prefix[right + 1] - prefix[left];
}

/** How many non-empty contiguous subarrays of `nums` add up to exactly `k`. */
export function countSubarraysWithSum(nums: number[], k: number): number {
  const seen = new Map<number, number>([[0, 1]]);
  let total = 0;
  let count = 0;
  for (const value of nums) {
    total += value;
    count += seen.get(total - k) ?? 0;
    seen.set(total, (seen.get(total) ?? 0) + 1);
  }
  return count;
}
