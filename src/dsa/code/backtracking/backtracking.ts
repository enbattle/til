/** Every subset of distinct values, each in input order, depth first. */
export function subsets(values: readonly number[]): number[][] {
  const result: number[][] = [];
  const chosen: number[] = [];

  const visit = (start: number): void => {
    // A copy: the pops below empty chosen before the function returns.
    result.push([...chosen]);
    for (let i = start; i < values.length; i++) {
      chosen.push(values[i]);
      // i + 1, not start + 1: only values after this one may follow,
      // or repeats like [3, 3] and reversals like [5, 3] appear.
      visit(i + 1);
      // Undo, or the next sibling starts from this branch's choice.
      chosen.pop();
    }
  };

  visit(0);
  return result;
}

/** Every ordering of distinct values, in lexicographic order of positions. */
export function permutations(values: readonly number[]): number[][] {
  const result: number[][] = [];
  const chosen: number[] = [];
  // One flag per position: `chosen.includes(values[i])` rescans the list on
  // every check and mistakes equal values at different positions for each other.
  const used: boolean[] = values.map(() => false);

  const visit = (): void => {
    if (chosen.length === values.length) {
      result.push([...chosen]);
      return; // Without it, a full path would still loop over the flags.
    }
    for (let i = 0; i < values.length; i++) {
      if (used[i]) continue;
      used[i] = true;
      chosen.push(values[i]);
      visit();
      chosen.pop();
      // Undo the flag too, or the first full path leaves every one set.
      used[i] = false;
    }
  };

  visit();
  return result;
}

/** Every combination of positive candidates, each reusable, adding to `target`. */
export function combinationSum(
  candidates: readonly number[],
  target: number,
): number[][] {
  // A set: a repeated candidate would be two choices and double the answers.
  const options = [...new Set(candidates)].sort((a, b) => a - b);
  // Zero never shrinks remaining and a negative grows it: no end to the walk.
  if (options.length > 0 && options[0] <= 0) {
    throw new RangeError('candidates must be positive');
  }
  const result: number[][] = [];
  const chosen: number[] = [];

  const visit = (start: number, remaining: number): void => {
    if (remaining === 0) {
      result.push([...chosen]);
      return;
    }
    for (let i = start; i < options.length; i++) {
      // break, not continue: sorted, so every later candidate is at least as
      // big and no subtree under any of them can fit.
      if (options[i] > remaining) break;
      chosen.push(options[i]);
      // i, not i + 1: the same candidate stays available for reuse.
      visit(i, remaining - options[i]);
      chosen.pop();
    }
  };

  visit(0, target);
  return result;
}
