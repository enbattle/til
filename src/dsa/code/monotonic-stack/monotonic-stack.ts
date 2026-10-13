// #region next-greater
/** For each i, the index of the first larger value to its right, or -1. */
export function nextGreater(nums: number[]): number[] {
  const answer: number[] = new Array(nums.length).fill(-1);
  // Indices, not values: the answer is a position, and equal values repeat.
  const stack: number[] = [];
  for (let i = 0; i < nums.length; i++) {
    // while, not if: one new value can answer several waiting positions.
    // <, not <=: an equal value isn't larger, so it keeps waiting.
    while (stack.length > 0 && nums[stack[stack.length - 1]] < nums[i]) {
      const waiting = stack[stack.length - 1];
      stack.pop();
      answer[waiting] = i;
    }
    stack.push(i);
  }
  return answer;
}
// #endregion

// #region days-until-warmer
/** For each day, how many days until a strictly warmer one; 0 if never. */
export function daysUntilWarmer(temps: number[]): number[] {
  const warmerDay = nextGreater(temps);
  const days: number[] = new Array(temps.length).fill(0);
  for (let i = 0; i < temps.length; i++) {
    // The -1 check matters: without it a day with no answer gets -1 - i.
    if (warmerDay[i] !== -1) {
      days[i] = warmerDay[i] - i;
    }
  }
  return days;
}
// #endregion

// #region largest-rectangle
/** Area of the biggest rectangle that fits under the bars of a histogram. */
export function largestRectangle(heights: number[]): number {
  let best = 0;
  const stack: number[] = []; // indices of bars, heights strictly increasing
  // One extra step with height 0 pops every bar still waiting; without it
  // the bars left on the stack at the end are never measured.
  for (let i = 0; i <= heights.length; i++) {
    let current = 0;
    if (i < heights.length) {
      current = heights[i];
    }
    // #endregion
    // #region measure-popped-bars
    while (stack.length > 0 && heights[stack[stack.length - 1]] >= current) {
      const popped = stack[stack.length - 1];
      stack.pop();
      const height = heights[popped];
      // The new top is the nearest shorter bar on the left, not the
      // popped index: bars between them were popped earlier, as taller.
      let left = -1;
      if (stack.length > 0) {
        left = stack[stack.length - 1];
      }
      const width = i - left - 1;
      best = Math.max(best, height * width);
    }
    stack.push(i);
  }
  return best;
}
// #endregion
