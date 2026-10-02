import { describe, expect, it } from 'vitest';
import { combinationSum, permutations, subsets } from './backtracking';

// API (each result is an array of arrays, in the fixed order the entry documents):
// - `subsets(values)`: every subset of distinct values, each in input order,
//   depth first: the empty subset, then everything starting with the first value.
// - `permutations(values)`: every ordering of distinct values, in lexicographic
//   order of input positions (the order Python's itertools.permutations yields).
// - `combinationSum(candidates, target)`: every combination of positive candidates
//   (each reusable) adding to `target`, each ascending, in lexicographic order.

function makeRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

function randomInt(random: () => number, low: number, high: number): number {
  return low + Math.floor(random() * (high - low + 1));
}

/** Lexicographic order, a prefix before anything that extends it. */
function compareLex(a: number[], b: number[]): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return a.length - b.length;
}

/** Subsets through bitmasks: a different method from the recursion under test. */
function expectedSubsets(values: number[]): number[][] {
  const positions: number[][] = [];
  for (let mask = 0; mask < 1 << values.length; mask++) {
    positions.push(values.map((_, i) => i).filter((i) => (mask >> i) & 1));
  }
  return positions.sort(compareLex).map((chosen) => chosen.map((i) => values[i]));
}

/** Permutations like itertools.product: every position tuple, keep distinct ones. */
function expectedPermutations(values: number[]): number[][] {
  const n = values.length;
  const found: number[][] = [];
  const total = n ** n;
  for (let counter = 0; counter < total; counter++) {
    const positions: number[] = [];
    let rest = counter;
    for (let k = 0; k < n; k++) {
      positions.unshift(rest % n);
      rest = Math.floor(rest / n);
    }
    if (new Set(positions).size === n) found.push(positions.map((i) => values[i]));
  }
  return n === 0 ? [[]] : found;
}

/** Combination sum by counting copies of each candidate, then sorting. */
function expectedCombinationSum(candidates: number[], target: number): number[][] {
  const options = [...new Set(candidates)].sort((a, b) => a - b);
  const found: number[][] = [];
  const counts = options.map(() => 0);
  const step = (index: number, sum: number): void => {
    if (index === options.length) {
      if (sum === target) {
        found.push(options.flatMap((value, k) => Array<number>(counts[k]).fill(value)));
      }
      return;
    }
    for (let copies = 0; sum + copies * options[index] <= target; copies++) {
      counts[index] = copies;
      step(index + 1, sum + copies * options[index]);
    }
    counts[index] = 0;
  };
  step(0, 0);
  return found.sort(compareLex);
}

function distinctValues(random: () => number, size: number): number[] {
  const pool = Array.from({ length: 40 }, (_, i) => i - 20);
  const picked: number[] = [];
  for (let k = 0; k < size; k++) {
    picked.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  }
  return picked;
}

describe('subsets (TypeScript)', () => {
  it('lists the subsets of [1, 2, 3] in the documented order', () => {
    expect(subsets([1, 2, 3])).toEqual([
      [],
      [1],
      [1, 2],
      [1, 2, 3],
      [1, 3],
      [2],
      [2, 3],
      [3],
    ]);
  });

  it('handles empty and single-element input', () => {
    expect(subsets([])).toEqual([[]]);
    expect(subsets([7])).toEqual([[], [7]]);
  });

  it('agrees with a bitmask enumeration on many random inputs', () => {
    const random = makeRandom(11);
    for (let n = 0; n < 200; n++) {
      const values = distinctValues(random, randomInt(random, 0, 8));
      expect(subsets(values)).toEqual(expectedSubsets(values));
    }
  });

  it('produces 2^n subsets', () => {
    expect(subsets([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])).toHaveLength(1024);
  });
});

describe('permutations (TypeScript)', () => {
  it('lists the permutations of [1, 2, 3] in the documented order', () => {
    expect(permutations([1, 2, 3])).toEqual([
      [1, 2, 3],
      [1, 3, 2],
      [2, 1, 3],
      [2, 3, 1],
      [3, 1, 2],
      [3, 2, 1],
    ]);
  });

  it('handles empty and single-element input', () => {
    expect(permutations([])).toEqual([[]]);
    expect(permutations([7])).toEqual([[7]]);
  });

  it('follows input positions, not value order', () => {
    expect(permutations([3, 1])).toEqual([
      [3, 1],
      [1, 3],
    ]);
  });

  it('agrees with a position-tuple enumeration on many random inputs', () => {
    const random = makeRandom(12);
    for (let n = 0; n < 150; n++) {
      const values = distinctValues(random, randomInt(random, 0, 6));
      expect(permutations(values)).toEqual(expectedPermutations(values));
    }
  });

  it('produces n! permutations', () => {
    expect(permutations([0, 1, 2, 3, 4, 5, 6])).toHaveLength(5040);
  });
});

describe('shared behaviour (TypeScript)', () => {
  it('returns lists that do not share storage', () => {
    for (const result of [subsets([1, 2]), permutations([1, 2])]) {
      result[0].push(99);
      for (const other of result.slice(1)) expect(other).not.toContain(99);
    }
  });

  it('does not change its input', () => {
    const values = [3, 1, 2];
    subsets(values);
    permutations(values);
    const candidates = [3, 2];
    combinationSum(candidates, 7);
    expect(values).toEqual([3, 1, 2]);
    expect(candidates).toEqual([3, 2]);
  });
});

describe('combinationSum (TypeScript)', () => {
  it('solves the classic examples', () => {
    expect(combinationSum([2, 3, 6, 7], 7)).toEqual([[2, 2, 3], [7]]);
    expect(combinationSum([2, 3, 5], 8)).toEqual([
      [2, 2, 2, 2],
      [2, 3, 3],
      [3, 5],
    ]);
  });

  it('sorts and de-duplicates the candidates', () => {
    expect(combinationSum([3, 2, 3], 6)).toEqual([
      [2, 2, 2],
      [3, 3],
    ]);
  });

  it('returns the empty combination for target 0', () => {
    expect(combinationSum([2, 3], 0)).toEqual([[]]);
    expect(combinationSum([], 0)).toEqual([[]]);
  });

  it('returns nothing when there is no solution', () => {
    expect(combinationSum([], 5)).toEqual([]);
    expect(combinationSum([2, 4], 7)).toEqual([]);
    expect(combinationSum([5], 3)).toEqual([]);
    expect(combinationSum([2], -2)).toEqual([]);
  });

  it('handles a single candidate', () => {
    expect(combinationSum([1], 4)).toEqual([[1, 1, 1, 1]]);
  });

  it('rejects non-positive candidates', () => {
    expect(() => combinationSum([0, 2], 4)).toThrow(RangeError);
    expect(() => combinationSum([-1, 2], 4)).toThrow(RangeError);
  });

  it('agrees with a brute-force count on many random inputs', () => {
    const random = makeRandom(13);
    for (let n = 0; n < 300; n++) {
      const candidates = Array.from({ length: randomInt(random, 0, 5) }, () =>
        randomInt(random, 1, 8),
      );
      const target = randomInt(random, 0, 14);
      expect(combinationSum(candidates, target)).toEqual(
        expectedCombinationSum(candidates, target),
      );
    }
  });
});
