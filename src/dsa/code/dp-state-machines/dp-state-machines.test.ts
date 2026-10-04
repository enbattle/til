import { describe, expect, it } from 'vitest';
import {
  maxProfitKTransactions,
  maxProfitWithCooldown,
  maxProfitWithFee,
} from './dp-state-machines';

// API (one action per day, one share held at a time):
// - maxProfitWithFee(prices, fee): unlimited trades, `fee` paid on each sale.
// - maxProfitWithCooldown(prices): unlimited trades, no buying the day after
//   a sale.
// - maxProfitKTransactions(prices, k): at most `k` trades.

/** A small seeded generator (mulberry32), so failures reproduce. */
function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rng: () => number, low: number, high: number): number {
  return low + Math.floor(rng() * (high - low + 1));
}

function randomPrices(rng: () => number, maxLen = 8, high = 12): number[] {
  const n = randInt(rng, 0, maxLen);
  return Array.from({ length: n }, () => randInt(rng, 0, high));
}

interface Rules {
  fee?: number;
  cooldown?: boolean;
  maxTrades?: number;
}

/** Tries every nothing/buy/sell sequence; keeps the best legal one. */
function bruteForce(prices: number[], rules: Rules = {}): number {
  const { fee = 0, cooldown = false, maxTrades = Infinity } = rules;
  const n = prices.length;
  let best = 0;
  const total = 3 ** n;
  for (let code = 0; code < total; code++) {
    let rest = code;
    let holding = false;
    let lastSale = -10;
    let trades = 0;
    let cash = 0;
    let legal = true;
    for (let day = 0; day < n && legal; day++) {
      const action = rest % 3; // 0 nothing, 1 buy, 2 sell
      rest = Math.floor(rest / 3);
      if (action === 1) {
        if (holding || (cooldown && day === lastSale + 1)) legal = false;
        holding = true;
        trades++;
        cash -= prices[day];
      } else if (action === 2) {
        if (!holding) legal = false;
        holding = false;
        lastSale = day;
        cash += prices[day] - fee;
      }
    }
    if (legal && !holding && trades <= maxTrades) best = Math.max(best, cash);
  }
  return best;
}

describe('maxProfitWithFee (TypeScript)', () => {
  it('solves the worked example', () => {
    expect(maxProfitWithFee([1, 3, 2, 8, 4, 9], 2)).toBe(8);
  });

  it('returns 0 for empty and one-day input', () => {
    expect(maxProfitWithFee([], 2)).toBe(0);
    expect(maxProfitWithFee([5], 2)).toBe(0);
  });

  it('never trades on falling prices', () => {
    expect(maxProfitWithFee([9, 7, 5, 3], 0)).toBe(0);
  });

  it('skips a rise that does not cover the fee', () => {
    expect(maxProfitWithFee([1, 4], 3)).toBe(0);
    expect(maxProfitWithFee([1, 5], 3)).toBe(1);
  });

  it('does not sell a share it never bought', () => {
    expect(maxProfitWithFee([5, 4], 1)).toBe(0);
  });

  it('collects every rise when the fee is zero', () => {
    expect(maxProfitWithFee([1, 3, 2, 5], 0)).toBe(5);
  });

  it('matches brute force on random inputs', () => {
    const rng = seeded(1);
    for (let trial = 0; trial < 50; trial++) {
      const prices = randomPrices(rng);
      const fee = randInt(rng, 0, 4);
      expect(
        maxProfitWithFee(prices, fee),
        `seed 1, trial ${trial}: [${prices}] fee ${fee}`,
      ).toBe(bruteForce(prices, { fee }));
    }
  });
});

describe('maxProfitWithCooldown (TypeScript)', () => {
  it('solves the worked example', () => {
    expect(maxProfitWithCooldown([1, 2, 3, 0, 2])).toBe(3);
  });

  it('returns 0 for empty and one-day input', () => {
    expect(maxProfitWithCooldown([])).toBe(0);
    expect(maxProfitWithCooldown([5])).toBe(0);
  });

  it('never trades on falling prices', () => {
    expect(maxProfitWithCooldown([9, 7, 5, 3])).toBe(0);
  });

  it('blocks a buy on the day after a sale', () => {
    expect(maxProfitWithFee([1, 5, 1, 5], 0)).toBe(8);
    expect(maxProfitWithCooldown([1, 5, 1, 5])).toBe(4);
    expect(maxProfitWithCooldown([1, 5, 2, 6])).toBe(5);
  });

  it('handles two days', () => {
    expect(maxProfitWithCooldown([1, 2])).toBe(1);
    expect(maxProfitWithCooldown([2, 1])).toBe(0);
  });

  it('matches brute force on random inputs', () => {
    const rng = seeded(2);
    for (let trial = 0; trial < 50; trial++) {
      const prices = randomPrices(rng);
      expect(maxProfitWithCooldown(prices), `seed 2, trial ${trial}: [${prices}]`).toBe(
        bruteForce(prices, { cooldown: true }),
      );
    }
  });
});

describe('maxProfitKTransactions (TypeScript)', () => {
  it('solves the worked example', () => {
    expect(maxProfitKTransactions([3, 2, 6, 5, 0, 3], 2)).toBe(7);
  });

  it('returns 0 for empty and one-day input', () => {
    expect(maxProfitKTransactions([], 2)).toBe(0);
    expect(maxProfitKTransactions([5], 2)).toBe(0);
  });

  it('never trades when k is 0 or negative', () => {
    expect(maxProfitKTransactions([1, 9, 1, 9], 0)).toBe(0);
    expect(maxProfitKTransactions([1, 9], -3)).toBe(0);
  });

  it('never trades on falling prices', () => {
    expect(maxProfitKTransactions([9, 7, 5, 3], 3)).toBe(0);
  });

  it('may use fewer trades than allowed', () => {
    expect(maxProfitKTransactions([1, 5], 2)).toBe(4);
  });

  it('is limited by k', () => {
    const prices = [1, 5, 1, 5, 1, 5];
    expect(maxProfitKTransactions(prices, 1)).toBe(4);
    expect(maxProfitKTransactions(prices, 2)).toBe(8);
    expect(maxProfitKTransactions(prices, 3)).toBe(12);
  });

  it('treats a huge k as unlimited', () => {
    expect(maxProfitKTransactions([1, 5, 1, 5, 1, 5], 1e9)).toBe(12);
  });

  it('matches brute force on random inputs', () => {
    const rng = seeded(3);
    for (let trial = 0; trial < 50; trial++) {
      const prices = randomPrices(rng);
      const k = randInt(rng, 0, 4);
      expect(
        maxProfitKTransactions(prices, k),
        `seed 3, trial ${trial}: [${prices}] k ${k}`,
      ).toBe(bruteForce(prices, { maxTrades: k }));
    }
  });

  it('with a large k matches the zero-fee version', () => {
    const rng = seeded(4);
    for (let trial = 0; trial < 50; trial++) {
      const prices = Array.from({ length: randInt(rng, 0, 30) }, () =>
        randInt(rng, 0, 50),
      );
      expect(
        maxProfitKTransactions(prices, 100),
        `seed 4, trial ${trial}: [${prices}]`,
      ).toBe(maxProfitWithFee(prices, 0));
    }
  });
});
