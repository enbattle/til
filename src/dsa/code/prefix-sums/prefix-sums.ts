/** prefix[i] is the sum of the first i elements; prefix[0] is 0, length n + 1. */
export function buildPrefix(nums: number[]): number[] {
  // Start at 0, not empty: prefix[left] must exist when left is 0, and
  // without it a range from 0 needs prefix[-1], which reads undefined.
  const prefix = [0];
  for (const value of nums) {
    prefix.push(prefix[prefix.length - 1] + value);
  }
  return prefix;
}

/** Sum of nums[left..right], both ends included. */
export function rangeSum(prefix: number[], left: number, right: number): number {
  // Check first: a bad index would return a wrong number, not fail
  // (JavaScript reads a missing entry as undefined, so the sum is NaN).
  if (!(left >= 0 && left <= right && right < prefix.length - 1)) {
    throw new RangeError('need 0 <= left <= right < nums.length');
  }
  // right + 1: prefix[right] stops one element short of nums[right].
  return prefix[right + 1] - prefix[left];
}

/** How many non-empty contiguous subarrays of `nums` add up to exactly `k`. */
export function countSubarraysWithSum(nums: number[], k: number): number {
  // Seed with the empty start: without [0, 1], a subarray that begins at
  // index 0 has no earlier total to pair with and is never counted.
  const seen = new Map<number, number>([[0, 1]]);
  let total = 0;
  let count = 0;
  for (const value of nums) {
    total += value;
    // Look up before inserting: with k === 0 the lookup would find the
    // current total itself and count an empty subarray.
    count += seen.get(total - k) ?? 0;
    // A count, not a set: each earlier start with this total is its
    // own subarray.
    seen.set(total, (seen.get(total) ?? 0) + 1);
  }
  return count;
}
