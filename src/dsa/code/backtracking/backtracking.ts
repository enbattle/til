/** Every subset of distinct values, each in input order, in depth-first order. */
export function subsets(values: readonly number[]): number[][] {
  const result: number[][] = [];
  const chosen: number[] = [];

  const visit = (start: number): void => {
    result.push([...chosen]);
    for (let i = start; i < values.length; i++) {
      chosen.push(values[i]);
      visit(i + 1);
      chosen.pop();
    }
  };

  visit(0);
  return result;
}

/** Every ordering of distinct values, in lexicographic order of input positions. */
export function permutations(values: readonly number[]): number[][] {
  const result: number[][] = [];
  const chosen: number[] = [];
  const used: boolean[] = values.map(() => false);

  const visit = (): void => {
    if (chosen.length === values.length) {
      result.push([...chosen]);
      return;
    }
    for (let i = 0; i < values.length; i++) {
      if (used[i]) continue;
      used[i] = true;
      chosen.push(values[i]);
      visit();
      chosen.pop();
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
  const options = [...new Set(candidates)].sort((a, b) => a - b);
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
      if (options[i] > remaining) break;
      chosen.push(options[i]);
      visit(i, remaining - options[i]);
      chosen.pop();
    }
  };

  visit(0, target);
  return result;
}
