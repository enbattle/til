import { describe, expect, it } from 'vitest';
import {
  editDistance,
  knapsack01,
  minCoins,
  minPathSum,
} from './dynamic-programming-shapes';

// The dynamic-programming-shapes entry's TypeScript code. API: `minPathSum(grid)`
// is the cheapest right/down path total, 0 for an empty grid; `knapsack01(weights,
// values, capacity)` is the best value using each item at most once;
// `minCoins(coins, amount)` is the fewest coins with reuse, or -1;
// `editDistance(a, b)` is the insert/delete/replace distance.

/** A small seeded generator (mulberry32), so a failing case can be replayed. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function between(random: () => number, lo: number, hi: number): number {
  return lo + Math.floor(random() * (hi - lo + 1));
}

const EXAMPLE_GRID = [
  [1, 3, 1],
  [1, 5, 1],
  [4, 2, 1],
];

/** Counts every element read and throws past a limit, so brute force fails
 * instead of running forever. Only index reads and iteration are counted. */
class Budget {
  reads = 0;
  constructor(readonly limit: number) {}
  tick(): void {
    this.reads++;
    if (this.reads > this.limit) throw new Error(`more than ${this.limit} reads`);
  }
}

function counting<T>(items: T[], budget: Budget): T[] {
  return new Proxy(items, {
    get(target, key, receiver) {
      if (typeof key === 'string' && /^\d+$/.test(key)) budget.tick();
      return Reflect.get(target, key, receiver);
    },
  });
}

describe('minPathSum', () => {
  const bruteSum = (grid: number[][]): number => {
    const rows = grid.length;
    const cols = grid[0].length;
    const go = (r: number, c: number): number => {
      if (r === rows - 1 && c === cols - 1) return grid[r][c];
      const next = [];
      if (r + 1 < rows) next.push(go(r + 1, c));
      if (c + 1 < cols) next.push(go(r, c + 1));
      return grid[r][c] + Math.min(...next);
    };
    return go(0, 0);
  };

  it('handles the known cases and the edges', () => {
    expect(minPathSum(EXAMPLE_GRID)).toBe(7);
    expect(minPathSum([])).toBe(0);
    expect(minPathSum([[]])).toBe(0);
    expect(minPathSum([[5]])).toBe(5);
    expect(minPathSum([[1, 2, 3]])).toBe(6);
    expect(minPathSum([[1], [2], [3]])).toBe(6);
    expect(
      minPathSum([
        [0, 0],
        [0, 0],
      ]),
    ).toBe(0);
    expect(
      minPathSum([
        [7, 7],
        [7, 7],
      ]),
    ).toBe(21);
  });

  it('handles values built at runtime', () => {
    const big = Number('1000');
    const grid = [
      [big, big, 1],
      [1, big, 1],
      [big, 1, 1],
    ];
    expect(minPathSum(grid)).toBe(2 * big + 3);
  });

  it('matches brute force on seeded random grids', () => {
    const seed = 21;
    const random = rng(seed);
    for (let trial = 0; trial < 50; trial++) {
      const rows = between(random, 1, 5);
      const cols = between(random, 1, 5);
      const grid = Array.from({ length: rows }, () =>
        Array.from({ length: cols }, () => between(random, 0, 9)),
      );
      expect(
        minPathSum(grid),
        `seed ${seed}, trial ${trial}: ${JSON.stringify(grid)}`,
      ).toBe(bruteSum(grid));
    }
  });

  it('does work that grows with the cells, not the paths', () => {
    // The budget is 3 reads per cell. Any table, rolled row or memoized
    // recursion fits; brute force re-reads cells along every path (over
    // 700,000 paths here), so it runs into the budget and throws.
    const size = 12;
    const budget = new Budget(3 * size * size);
    const grid = Array.from({ length: size }, () =>
      counting(new Array(size).fill(1), budget),
    );
    expect(minPathSum(grid)).toBe(2 * size - 1);
  });

  it('does not change the grid', () => {
    const grid = EXAMPLE_GRID.map((row) => [...row]);
    minPathSum(grid);
    expect(grid).toEqual(EXAMPLE_GRID);
  });
});

describe('knapsack01', () => {
  const bruteKnapsack = (
    weights: number[],
    values: number[],
    capacity: number,
  ): number => {
    let best = 0;
    for (let mask = 0; mask < 1 << weights.length; mask++) {
      let weight = 0;
      let value = 0;
      for (let i = 0; i < weights.length; i++) {
        if (mask & (1 << i)) {
          weight += weights[i];
          value += values[i];
        }
      }
      if (weight <= capacity) best = Math.max(best, value);
    }
    return best;
  };

  it('handles the known cases and the edges', () => {
    expect(knapsack01([1, 3, 4], [2, 4, 5], 4)).toBe(6);
    expect(knapsack01([], [], 10)).toBe(0);
    expect(knapsack01([2], [9], 0)).toBe(0);
    expect(knapsack01([5], [9], 4)).toBe(0);
    expect(knapsack01([5], [9], 5)).toBe(9);
    expect(knapsack01([2, 2, 2], [3, 3, 3], 4)).toBe(6);
    expect(knapsack01([1, 1], [0, 0], 5)).toBe(0);
  });

  it('uses each item once', () => {
    // Sweeping the row upward would pick the lone item three times and say 9.
    expect(knapsack01([2], [3], 6)).toBe(3);
    expect(knapsack01([1, 3, 4], [2, 4, 5], 4)).not.toBe(8);
  });

  it('beats taking the most valuable item first', () => {
    expect(knapsack01([1, 3, 4], [2, 4, 5], 4)).toBeGreaterThan(5);
  });

  it('matches brute force on seeded random items', () => {
    const seed = 22;
    const random = rng(seed);
    for (let trial = 0; trial < 50; trial++) {
      const n = between(random, 0, 7);
      const weights = Array.from({ length: n }, () => between(random, 1, 6));
      const values = Array.from({ length: n }, () => between(random, 0, 9));
      const capacity = between(random, 0, 15);
      expect(
        knapsack01(weights, values, capacity),
        `seed ${seed}, trial ${trial}: ${weights} ${values} ${capacity}`,
      ).toBe(bruteKnapsack(weights, values, capacity));
    }
  });

  it('does work that grows with the states, not the subsets', () => {
    // The states are items x capacities (275); the budget is 6 reads per
    // state, shared by both lists. A 2-D table or a memoized recursion fits.
    // Brute force, even stopping once the bag is full, makes over 300,000 calls.
    const n = 25;
    const budget = new Budget(6 * n * 11);
    const weights = counting(new Array(n).fill(2), budget);
    const values = counting(new Array(n).fill(3), budget);
    expect(knapsack01(weights, values, 10)).toBe(15);
  });
});

describe('minCoins', () => {
  /** Breadth-first search over amounts: the number of layers is the answer. */
  const bruteCoins = (coins: number[], amount: number): number => {
    const seen = new Set([0]);
    let layer = [0];
    let steps = 0;
    while (layer.length > 0) {
      if (seen.has(amount)) return steps;
      steps++;
      const next: number[] = [];
      for (const a of layer) {
        for (const c of coins) {
          if (a + c <= amount && !seen.has(a + c)) {
            seen.add(a + c);
            next.push(a + c);
          }
        }
      }
      layer = next;
    }
    return -1;
  };

  it('handles the known cases and the edges', () => {
    expect(minCoins([1, 3, 4], 6)).toBe(2);
    expect(minCoins([1, 3, 4], 0)).toBe(0);
    expect(minCoins([], 0)).toBe(0);
    expect(minCoins([], 5)).toBe(-1);
    expect(minCoins([2], 3)).toBe(-1);
    expect(minCoins([2], 4)).toBe(2);
    expect(minCoins([5], 5)).toBe(1);
    expect(minCoins([1, 2, 5], 11)).toBe(3);
    expect(minCoins([2, 2, 3], 6)).toBe(2);
  });

  it('reuses a coin', () => {
    // Sweeping the row downward would never let the 3 repeat and say -1.
    expect(minCoins([3], 6)).toBe(2);
    expect(minCoins([3], 9)).toBe(3);
  });

  it('beats taking the largest coin first', () => {
    // Greedy pays 4 + 1 + 1, three coins.
    expect(minCoins([1, 3, 4], 6)).toBeLessThan(3);
  });

  it('handles values built at runtime', () => {
    const big = Number('1000');
    expect(minCoins([big, Number('1')], 2 * big + 2)).toBe(4);
    expect(minCoins([big], big - 1)).toBe(-1);
  });

  it('matches brute force on seeded random coins', () => {
    const seed = 23;
    const random = rng(seed);
    for (let trial = 0; trial < 50; trial++) {
      const coins = Array.from({ length: between(random, 0, 4) }, () =>
        between(random, 1, 8),
      );
      const amount = between(random, 0, 25);
      expect(
        minCoins(coins, amount),
        `seed ${seed}, trial ${trial}: ${coins} ${amount}`,
      ).toBe(bruteCoins(coins, amount));
    }
  });

  it('does work that grows with the amount, not the combinations', () => {
    // The states are the amounts (61); the budget is 3 reads of the coin list
    // per coin per amount. Either loop order or a memoized recursion fits;
    // a recursion with no memo tries every sequence of coins and runs out.
    const budget = new Budget(3 * 61 * 3);
    expect(minCoins(counting([1, 5, 10], budget), 60)).toBe(6);
  });
});

describe('editDistance', () => {
  /** The plain recursion, with no table, so keep the strings short. */
  const bruteEdit = (a: string, b: string): number => {
    if (a === '') return b.length;
    if (b === '') return a.length;
    const ra = a.slice(0, -1);
    const rb = b.slice(0, -1);
    if (a.at(-1) === b.at(-1)) return bruteEdit(ra, rb);
    return 1 + Math.min(bruteEdit(ra, b), bruteEdit(a, rb), bruteEdit(ra, rb));
  };

  it('handles the known cases and the edges', () => {
    expect(editDistance('', '')).toBe(0);
    expect(editDistance('', 'abc')).toBe(3);
    expect(editDistance('abc', '')).toBe(3);
    expect(editDistance('a', 'a')).toBe(0);
    expect(editDistance('a', 'b')).toBe(1);
    expect(editDistance('abc', 'yabd')).toBe(2);
    expect(editDistance('kitten', 'sitting')).toBe(3);
    expect(editDistance('horse', 'ros')).toBe(3);
    expect(editDistance('aaa', 'aa')).toBe(1);
    expect(editDistance('abc', 'abc')).toBe(0);
  });

  it('is symmetric and works on arrays of tokens', () => {
    expect(editDistance('abc', 'yabd')).toBe(editDistance('yabd', 'abc'));
    expect(editDistance(['a', 'b'], ['a', 'c', 'b'])).toBe(1);
  });

  it('matches brute force on seeded random strings', () => {
    const seed = 24;
    const random = rng(seed);
    const word = () =>
      Array.from(
        { length: between(random, 0, 6) },
        () => 'abc'[between(random, 0, 2)],
      ).join('');
    for (let trial = 0; trial < 50; trial++) {
      const a = word();
      const b = word();
      expect(editDistance(a, b), `seed ${seed}, trial ${trial}: '${a}' '${b}'`).toBe(
        bruteEdit(a, b),
      );
    }
  });

  it('does work that grows with the pairs, not the alignments', () => {
    // The states are the prefix pairs (about 625); the budget is 4 reads per
    // state, twice what the table needs. A rolled row or a memoized recursion
    // fits; the plain recursion revisits pairs and runs into the budget.
    const n = 25;
    const budget = new Budget(4 * n * n);
    const a = counting(new Array<string>(n).fill('a'), budget);
    const b = counting(new Array<string>(n).fill('b'), budget);
    expect(editDistance(a, b)).toBe(n);
  });
});
