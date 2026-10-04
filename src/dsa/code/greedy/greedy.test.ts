import { describe, expect, it } from 'vitest';
import { canReachEnd, greedyCoinCount, selectIntervals, type Interval } from './greedy';

function makeRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

const randInt = (random: () => number, low: number, high: number) =>
  low + Math.floor(random() * (high - low + 1));

/** Half-open intervals share a point exactly when each starts before the other ends. */
const overlap = (a: Interval, b: Interval) => a[0] < b[1] && b[0] < a[1];

function isValid(chosen: Interval[]): boolean {
  for (let i = 0; i < chosen.length; i++) {
    for (let j = i + 1; j < chosen.length; j++) {
      if (overlap(chosen[i], chosen[j])) return false;
    }
  }
  return true;
}

/** The size of the largest non-overlapping subset, trying every subset. */
function bruteForceBest(intervals: Interval[]): number {
  let best = 0;
  for (let mask = 0; mask < 1 << intervals.length; mask++) {
    const subset = intervals.filter((_, i) => (mask >> i) & 1);
    if (subset.length > best && isValid(subset)) best = subset.length;
  }
  return best;
}

/** Greedy with a different sort order, to show those orders are wrong. */
function pickBy(intervals: Interval[], key: (iv: Interval) => number): Interval[] {
  const chosen: Interval[] = [];
  for (const iv of [...intervals].sort((a, b) => key(a) - key(b))) {
    if (chosen.every((other) => !overlap(iv, other))) chosen.push(iv);
  }
  return chosen;
}

function randomIntervals(random: () => number): Interval[] {
  const out: Interval[] = [];
  const count = randInt(random, 0, 8);
  for (let i = 0; i < count; i++) {
    const start = randInt(random, 0, 12);
    out.push([start, start + randInt(random, 1, 5)]);
  }
  return out;
}

describe('selectIntervals (TypeScript)', () => {
  it('handles empty input and one interval', () => {
    expect(selectIntervals([])).toEqual([]);
    expect(selectIntervals([[2, 5]])).toEqual([[2, 5]]);
  });

  it('treats touching endpoints as compatible', () => {
    expect(
      selectIntervals([
        [1, 3],
        [3, 5],
      ]),
    ).toEqual([
      [1, 3],
      [3, 5],
    ]);
  });

  it('keeps one of an overlapping pair, and one of identical intervals', () => {
    expect(
      selectIntervals([
        [1, 4],
        [3, 6],
      ]),
    ).toHaveLength(1);
    expect(
      selectIntervals([
        [1, 3],
        [1, 3],
        [1, 3],
      ]),
    ).toEqual([[1, 3]]);
  });

  it('gives the best count when several intervals tie on end', () => {
    const chosen = selectIntervals([
      [0, 4],
      [2, 4],
      [3, 4],
      [4, 6],
    ]);
    expect(chosen).toHaveLength(2);
    expect(isValid(chosen)).toBe(true);
  });

  it('does not change the input, and returns time order', () => {
    const given: Interval[] = [
      [5, 8],
      [1, 3],
      [2, 6],
      [3, 5],
      [8, 9],
    ];
    const copy = given.map((iv) => [...iv]);
    const chosen = selectIntervals(given);
    expect(given).toEqual(copy);
    expect(chosen).toEqual([
      [1, 3],
      [3, 5],
      [5, 8],
      [8, 9],
    ]);
  });

  it('sorting by start loses on a long early interval', () => {
    const given: Interval[] = [
      [0, 10],
      [1, 2],
      [3, 4],
      [5, 6],
    ];
    expect(pickBy(given, (iv) => iv[0])).toHaveLength(1);
    expect(selectIntervals(given)).toHaveLength(3);
  });

  it('sorting by length loses on a short middle interval', () => {
    const given: Interval[] = [
      [0, 5],
      [4, 7],
      [6, 11],
    ];
    expect(pickBy(given, (iv) => iv[1] - iv[0])).toHaveLength(1);
    expect(selectIntervals(given)).toHaveLength(2);
  });

  it('agrees with a brute-force search on many random inputs', () => {
    const random = makeRandom(11);
    for (let n = 0; n < 50; n++) {
      const given = randomIntervals(random);
      const at = `seed 11, trial ${n}: ${JSON.stringify(given)}`;
      const chosen = selectIntervals(given);
      expect(isValid(chosen), at).toBe(true);
      expect(chosen.length, at).toBe(bruteForceBest(given));
    }
  });

  it('shows the other sort orders lose on some random input', () => {
    const random = makeRandom(5);
    const cases = Array.from({ length: 50 }, () => randomIntervals(random));
    expect(
      cases.some((c) => pickBy(c, (iv) => iv[0]).length < bruteForceBest(c)),
      'seed 5: sort by start never lost in 50 trials',
    ).toBe(true);
    // Sorting by length loses too rarely for 50 random trials to show it; the
    // fixed case in 'sorting by length loses on a short middle interval' does.
  });
});

/** Breadth-first search over indices, trying every jump length. */
function reachableBySearch(jumps: number[]): boolean {
  if (jumps.length === 0) return false;
  const seen = new Set([0]);
  const queue = [0];
  for (const i of queue) {
    const stop = Math.min(i + jumps[i], jumps.length - 1);
    for (let next = i + 1; next <= stop; next++) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen.has(jumps.length - 1);
}

describe('canReachEnd (TypeScript)', () => {
  it('handles empty input and one element', () => {
    expect(canReachEnd([])).toBe(false);
    expect(canReachEnd([0])).toBe(true);
  });

  it('handles the classic cases', () => {
    expect(canReachEnd([2, 3, 1, 1, 4])).toBe(true);
    expect(canReachEnd([3, 2, 1, 0, 4])).toBe(false);
  });

  it('is stuck when the first jump is 0 and there is more to reach', () => {
    expect(canReachEnd([0, 5])).toBe(false);
  });

  it('separates exactly enough from one short, and allows a 0 at the end', () => {
    expect(canReachEnd([1, 1, 1, 1])).toBe(true);
    expect(canReachEnd([1, 1, 0, 1])).toBe(false);
    expect(canReachEnd([4, 0, 0, 0, 0])).toBe(true);
  });

  it('agrees with a search on many random inputs', () => {
    const random = makeRandom(23);
    for (let n = 0; n < 50; n++) {
      const jumps = Array.from({ length: randInt(random, 0, 10) }, () =>
        randInt(random, 0, 3),
      );
      expect(canReachEnd(jumps), `seed 23, trial ${n}: [${jumps}]`).toBe(
        reachableBySearch(jumps),
      );
    }
  });
});

/** The true minimum, trying every coin at every step. */
function fewestCoins(coins: number[], amount: number): number | null {
  const memo = new Map<number, number | null>();
  const go = (left: number): number | null => {
    if (left === 0) return 0;
    if (memo.has(left)) return memo.get(left)!;
    let best: number | null = null;
    for (const coin of coins) {
      if (coin > left) continue;
      const rest = go(left - coin);
      if (rest !== null && (best === null || rest + 1 < best)) best = rest + 1;
    }
    memo.set(left, best);
    return best;
  };
  return go(amount);
}

describe('greedyCoinCount (TypeScript)', () => {
  it('needs no coins for amount 0', () => {
    expect(greedyCoinCount([1, 3, 4], 0)).toBe(0);
    expect(greedyCoinCount([], 0)).toBe(0);
  });

  it('is wrong for coins 1, 3, 4 and amount 6', () => {
    expect(greedyCoinCount([1, 3, 4], 6)).toBe(3); // 4 + 1 + 1
    expect(fewestCoins([1, 3, 4], 6)).toBe(2); // 3 + 3
  });

  it('can get stuck', () => {
    expect(greedyCoinCount([5, 3], 9)).toBeNull();
    expect(fewestCoins([5, 3], 9)).toBe(3);
  });

  it('handles a single coin and unordered input', () => {
    expect(greedyCoinCount([7], 21)).toBe(3);
    expect(greedyCoinCount([1, 25, 5, 10], 41)).toBe(4);
  });

  it('is optimal for US coins', () => {
    for (let amount = 0; amount < 200; amount++) {
      expect(greedyCoinCount([1, 5, 10, 25], amount)).toBe(
        fewestCoins([1, 5, 10, 25], amount),
      );
    }
  });

  it('never beats the best and sometimes loses, on random coin sets', () => {
    const random = makeRandom(3);
    let worse = 0;
    for (let n = 0; n < 50; n++) {
      const coins = [
        ...new Set([
          1,
          ...Array.from({ length: randInt(random, 1, 3) }, () => randInt(random, 2, 9)),
        ]),
      ];
      const amount = randInt(random, 0, 30);
      const at = `seed 3, trial ${n}: coins [${coins}], amount ${amount}`;
      const greedy = greedyCoinCount(coins, amount);
      const best = fewestCoins(coins, amount)!;
      expect(greedy, at).not.toBeNull();
      expect(greedy!, at).toBeGreaterThanOrEqual(best);
      if (greedy! > best) worse++;
    }
    expect(worse, 'seed 3: greedy never lost in 50 trials').toBeGreaterThan(0);
  });
});
