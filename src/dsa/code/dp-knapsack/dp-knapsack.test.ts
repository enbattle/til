import { describe, expect, it } from 'vitest';
import {
  countCombinations,
  countOrderings,
  knapsack01,
  knapsackTable,
  minCoins,
  unboundedKnapsack,
} from './dp-knapsack';

// Each function is checked against a brute force (all subsets, or a bounded
// enumeration of how many times each item or coin is used) on seeded random
// small inputs, plus capacity 0, no items, amount 0 and an impossible amount.

/** A small deterministic generator (mulberry32) so failures are reproducible. */
function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rng: () => number, lo: number, hi: number): number {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

function bruteZeroOne(weights: number[], values: number[], capacity: number): number {
  let best = 0;
  for (let mask = 0; mask < 1 << weights.length; mask++) {
    let weight = 0;
    let value = 0;
    weights.forEach((w, i) => {
      if (mask & (1 << i)) {
        weight += w;
        value += values[i];
      }
    });
    if (weight <= capacity) best = Math.max(best, value);
  }
  return best;
}

/** Calls `visit` with every list of use-counts whose total weight fits. */
function forEachMultiplicity(
  weights: number[],
  capacity: number,
  visit: (counts: number[], weight: number) => void,
): void {
  const counts: number[] = [];
  const go = (i: number, weight: number) => {
    if (i === weights.length) {
      visit(counts, weight);
      return;
    }
    for (let k = 0; weight + k * weights[i] <= capacity; k++) {
      counts[i] = k;
      go(i + 1, weight + k * weights[i]);
    }
  };
  go(0, 0);
}

function bruteUnbounded(weights: number[], values: number[], capacity: number): number {
  let best = 0;
  forEachMultiplicity(weights, capacity, (counts) => {
    best = Math.max(
      best,
      counts.reduce((s, k, i) => s + k * values[i], 0),
    );
  });
  return best;
}

function bruteMinCoins(coins: number[], amount: number): number {
  let best = -1;
  forEachMultiplicity(coins, amount, (counts, weight) => {
    const used = counts.reduce((s, k) => s + k, 0);
    if (weight === amount && (best === -1 || used < best)) best = used;
  });
  return best;
}

function bruteCombinations(coins: number[], amount: number): number {
  let total = 0;
  forEachMultiplicity(coins, amount, (_counts, weight) => {
    if (weight === amount) total++;
  });
  return total;
}

function bruteOrderings(coins: number[], amount: number): number {
  if (amount === 0) return 1;
  let total = 0;
  for (const c of coins) if (c <= amount) total += bruteOrderings(coins, amount - c);
  return total;
}

function randomItems(rng: () => number) {
  const n = randInt(rng, 0, 7);
  const weights = Array.from({ length: n }, () => randInt(rng, 1, 9));
  const values = Array.from({ length: n }, () => randInt(rng, 0, 20));
  return { weights, values, capacity: randInt(rng, 0, 20) };
}

function randomCoins(rng: () => number) {
  const pool = [1, 2, 3, 4, 5, 6, 7, 8];
  const coins: number[] = [];
  for (let k = randInt(rng, 0, 4); k > 0; k--) {
    coins.push(pool.splice(randInt(rng, 0, pool.length - 1), 1)[0]);
  }
  return { coins, amount: randInt(rng, 0, 14) };
}

describe('0/1 knapsack (TypeScript)', () => {
  it('solves the worked example', () => {
    const weights = [1, 3, 4, 5];
    const values = [1, 4, 5, 7];
    expect(knapsackTable(weights, values, 7)).toBe(9);
    expect(knapsack01(weights, values, 7)).toBe(9);
  });

  it('handles capacity 0, no items, too-heavy and everything-fits cases', () => {
    expect(knapsack01([2, 3], [5, 6], 0)).toBe(0);
    expect(knapsackTable([2, 3], [5, 6], 0)).toBe(0);
    expect(knapsack01([], [], 10)).toBe(0);
    expect(knapsackTable([], [], 10)).toBe(0);
    expect(knapsack01([4], [9], 3)).toBe(0);
    expect(knapsack01([4], [9], 4)).toBe(9);
    expect(knapsack01([1, 2, 3], [1, 2, 3], 100)).toBe(6);
  });

  it('uses each item at most once, unlike the unbounded version', () => {
    expect(knapsack01([2], [3], 4)).toBe(3);
    expect(knapsackTable([2], [3], 4)).toBe(3);
    expect(unboundedKnapsack([2], [3], 4)).toBe(6);
  });

  it('matches brute force on seeded random inputs', () => {
    const rng = seeded(2024);
    for (let trial = 0; trial < 400; trial++) {
      const { weights, values, capacity } = randomItems(rng);
      const expected = bruteZeroOne(weights, values, capacity);
      expect(knapsackTable(weights, values, capacity)).toBe(expected);
      expect(knapsack01(weights, values, capacity)).toBe(expected);
    }
  });
});

describe('unboundedKnapsack (TypeScript)', () => {
  it('handles basic edge cases', () => {
    expect(unboundedKnapsack([], [], 5)).toBe(0);
    expect(unboundedKnapsack([3], [4], 2)).toBe(0);
    expect(unboundedKnapsack([2, 3], [3, 5], 0)).toBe(0);
  });

  it('matches brute force on seeded random inputs', () => {
    const rng = seeded(7);
    for (let trial = 0; trial < 300; trial++) {
      const { weights, values, capacity } = randomItems(rng);
      if (weights.length === 0) continue;
      expect(unboundedKnapsack(weights, values, capacity)).toBe(
        bruteUnbounded(weights, values, capacity),
      );
    }
  });
});

describe('minCoins (TypeScript)', () => {
  it('beats greedy on coins 1, 3, 4 and amount 6', () => {
    expect(minCoins([1, 3, 4], 6)).toBe(2);
  });

  it('handles amount 0, no coins, impossible amounts and exact fits', () => {
    expect(minCoins([1, 3, 4], 0)).toBe(0);
    expect(minCoins([], 0)).toBe(0);
    expect(minCoins([], 5)).toBe(-1);
    expect(minCoins([2], 3)).toBe(-1);
    expect(minCoins([5, 10], 3)).toBe(-1);
    expect(minCoins([7], 7)).toBe(1);
    expect(minCoins([1], 9)).toBe(9);
  });

  it('matches brute force on seeded random inputs', () => {
    const rng = seeded(11);
    for (let trial = 0; trial < 400; trial++) {
      const { coins, amount } = randomCoins(rng);
      expect(minCoins(coins, amount)).toBe(bruteMinCoins(coins, amount));
    }
  });
});

describe('countCombinations and countOrderings (TypeScript)', () => {
  it('solves the worked examples', () => {
    expect(countCombinations([1, 2], 3)).toBe(2);
    expect(countOrderings([1, 2], 3)).toBe(3);
    expect(countCombinations([1, 2, 3], 4)).toBe(4);
    expect(countOrderings([1, 2, 3], 4)).toBe(7);
  });

  it('handles amount 0, no coins and unreachable amounts', () => {
    expect(countCombinations([2], 3)).toBe(0);
    expect(countOrderings([2], 3)).toBe(0);
    expect(countCombinations([], 0)).toBe(1);
    expect(countOrderings([], 0)).toBe(1);
    expect(countCombinations([], 4)).toBe(0);
    expect(countOrderings([], 4)).toBe(0);
    expect(countCombinations([1, 2, 5], 0)).toBe(1);
    expect(countOrderings([1, 2, 5], 0)).toBe(1);
    expect(countCombinations([3], 9)).toBe(1);
    expect(countOrderings([3], 9)).toBe(1);
  });

  it('match brute force on seeded random inputs', () => {
    const rng = seeded(99);
    for (let trial = 0; trial < 300; trial++) {
      const { coins, amount } = randomCoins(rng);
      expect(countCombinations(coins, amount)).toBe(bruteCombinations(coins, amount));
      expect(countOrderings(coins, amount)).toBe(bruteOrderings(coins, amount));
    }
  });
});
