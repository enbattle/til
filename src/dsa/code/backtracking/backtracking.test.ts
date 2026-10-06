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
    for (let trial = 0; trial < 50; trial++) {
      const values = distinctValues(random, randomInt(random, 0, 8));
      expect(
        subsets(values),
        `seed 11, trial ${trial}: ${JSON.stringify(values)}`,
      ).toEqual(expectedSubsets(values));
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
    for (let trial = 0; trial < 50; trial++) {
      const values = distinctValues(random, randomInt(random, 0, 6));
      expect(
        permutations(values),
        `seed 12, trial ${trial}: ${JSON.stringify(values)}`,
      ).toEqual(expectedPermutations(values));
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
    for (let trial = 0; trial < 50; trial++) {
      const candidates = Array.from({ length: randomInt(random, 0, 5) }, () =>
        randomInt(random, 1, 8),
      );
      const target = randomInt(random, 0, 14);
      expect(
        combinationSum(candidates, target),
        `seed 13, trial ${trial}: ${JSON.stringify(candidates)}, target ${target}`,
      ).toEqual(expectedCombinationSum(candidates, target));
    }
  });
});

describe('mechanism (TypeScript)', () => {
  /** Calls to Array.prototype.push while `run` executes. */
  function countPushes(run: () => void): number {
    const original = Array.prototype.push;
    let count = 0;
    Array.prototype.push = function (this: unknown[], ...items: unknown[]) {
      count += 1;
      return original.apply(this, items);
    };
    try {
      run();
    } finally {
      Array.prototype.push = original;
    }
    return count;
  }

  it('treats equal values at different positions as different choices', () => {
    expect(permutations([1, 1])).toEqual([
      [1, 1],
      [1, 1],
    ]);
    expect(subsets([1, 1])).toEqual([[], [1], [1, 1], [1]]);
  });

  it('walks only the pruned tree of combinationSum', () => {
    // [2, 3, 5] with 8 is the entry's 13-call table: 12 calls come from a
    // push onto chosen and 3 answers are pushed onto the result, 15 in all.
    // Brute force over combinations never pushes onto chosen (3 pushes), and
    // stopping only at remaining < 0 pushes more than 15.
    expect(countPushes(() => combinationSum([2, 3, 5], 8))).toBe(15);
    // No answer exists, and the search still makes 440 pushes to find that out.
    expect(countPushes(() => combinationSum([2, 4], 81))).toBe(440);
  });

  /** Reads of the candidates' values while combinationSum runs on them. */
  function countReads(candidates: number[], target: number): number {
    let reads = 0;
    const counted = candidates.map((value) => ({
      valueOf: () => {
        reads += 1;
        return value;
      },
    }));
    combinationSum(counted as unknown as number[], target);
    return reads;
  }

  it('stops each loop at the first candidate that is too big', () => {
    // Every <, >, - and <= on a candidate reads it, the sort included. With
    // `break` the entry makes 36 reads on [2, 3, 5] and 8; a `continue` in its
    // place makes the same 13 calls (same pushes) but 39 reads, because it
    // goes on testing candidates after the first one that is too big.
    expect(countReads([2, 3, 5], 8)).toBe(36);
  });

  it('walks one node per subset', () => {
    // 2^5 answers pushed onto the result, and 2^5 - 1 pushes onto chosen.
    expect(countPushes(() => subsets([1, 2, 3, 4, 5]))).toBe(32 + 31);
  });
});
