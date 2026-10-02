/** Largest sum of `k` consecutive values in `nums`, or null if `nums` is shorter. */
export function maxWindowSum(nums: number[], k: number): number | null {
  if (!Number.isInteger(k) || k < 1) throw new RangeError('k must be at least 1');
  if (k > nums.length) return null;
  let window = 0;
  for (let i = 0; i < k; i++) window += nums[i];
  let best = window;
  for (let right = k; right < nums.length; right++) {
    window += nums[right] - nums[right - k];
    best = Math.max(best, window);
  }
  return best;
}

/** Length, in code points, of the longest run of `text` with no repeated character. */
export function longestUniqueSubstring(text: string): number {
  const chars = Array.from(text);
  const counts = new Map<string, number>();
  let left = 0;
  let best = 0;
  for (let right = 0; right < chars.length; right++) {
    const char = chars[right];
    counts.set(char, (counts.get(char) ?? 0) + 1);
    while (counts.get(char)! > 1) {
      counts.set(chars[left], counts.get(chars[left])! - 1);
      left++;
    }
    best = Math.max(best, right - left + 1);
  }
  return best;
}
