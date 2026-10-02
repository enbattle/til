/** For each i, the index of the first value to its right that is larger, or -1. */
export function nextGreater(nums: number[]): number[] {
  const answer: number[] = new Array(nums.length).fill(-1);
  const stack: number[] = []; // indices of values still waiting for a larger one
  for (let i = 0; i < nums.length; i++) {
    while (stack.length > 0 && nums[stack[stack.length - 1]] < nums[i]) {
      answer[stack.pop()!] = i;
    }
    stack.push(i);
  }
  return answer;
}

/** For each day, how many days until a strictly warmer one; 0 if never. */
export function daysUntilWarmer(temps: number[]): number[] {
  return nextGreater(temps).map((j, i) => (j === -1 ? 0 : j - i));
}
