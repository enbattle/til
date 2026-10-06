/** For each i, the index of the first larger value to its right, or -1. */
export function nextGreater(nums: number[]): number[] {
  const answer: number[] = new Array(nums.length).fill(-1);
  // Indices, not values: the answer is a position, and equal values repeat.
  const stack: number[] = [];
  for (let i = 0; i < nums.length; i++) {
    // while, not if: one new value can answer several waiting positions.
    // <, not <=: an equal value isn't larger, so it keeps waiting.
    while (stack.length > 0 && nums[stack[stack.length - 1]] < nums[i]) {
      answer[stack.pop()!] = i;
    }
    stack.push(i);
  }
  return answer;
}

/** For each day, how many days until a strictly warmer one; 0 if never. */
export function daysUntilWarmer(temps: number[]): number[] {
  // The -1 check matters: without it a day with no answer gets -1 - i.
  return nextGreater(temps).map((j, i) => (j === -1 ? 0 : j - i));
}

/** Area of the biggest rectangle that fits under the bars of a histogram. */
export function largestRectangle(heights: number[]): number {
  let best = 0;
  const stack: number[] = []; // indices of bars, heights never decreasing
  // One extra step with height 0 pops every bar still waiting; without it
  // the bars left on the stack at the end are never measured.
  for (let i = 0; i <= heights.length; i++) {
    const h = i < heights.length ? heights[i] : 0;
    while (stack.length > 0 && heights[stack[stack.length - 1]] >= h) {
      const height = heights[stack.pop()!];
      // The new top is the nearest shorter bar on the left, not the
      // popped index: bars between them were popped earlier, as taller.
      const left = stack.length > 0 ? stack[stack.length - 1] : -1;
      best = Math.max(best, height * (i - left - 1));
    }
    stack.push(i);
  }
  return best;
}
