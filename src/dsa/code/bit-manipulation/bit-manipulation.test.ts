import { describe, expect, it, vi } from 'vitest';
import { countSetBits, isPowerOfTwo, singleNumber, subsets } from './bit-manipulation';

// The entry's TypeScript code. API:
// - `countSetBits(n)`: number of 1 bits, for an integer 0 <= n <= 2**32 - 1;
//   throws RangeError otherwise.
// - `isPowerOfTwo(n)`: true for 1, 2, 4, ...; false for 0 and negatives;
//   throws RangeError for non-integers and for n > 2**32 - 1.
// - `singleNumber(nums)`: the value that appears once when the others appear
//   twice; 32-bit signed integers only, non-empty.
// - `subsets(items)`: all 2**n subsets in bitmask order.

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

/** Counts set bits without bit operators, as a reference. */
function popcount(n: number): number {
  let count = 0;
  for (let rest = n; rest > 0; rest = Math.floor(rest / 2)) count += rest % 2;
  return count;
}

/** An array that throws when read past its length, so a bad loop fails fast. */
function guarded<T>(items: T[]): T[] {
  return new Proxy(items, {
    get(target, prop, receiver) {
      if (
        typeof prop === 'string' &&
        /^\d+$/.test(prop) &&
        Number(prop) >= target.length
      ) {
        throw new Error(`read index ${prop} past length ${target.length}`);
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

describe('countSetBits', () => {
  it('counts known values', () => {
    const cases: [number, number][] = [
      [0, 0],
      [1, 1],
      [2, 1],
      [3, 2],
      [44, 3],
      [255, 8],
      [2 ** 31 - 1, 31],
    ];
    for (const [n, expected] of cases) expect(countSetBits(n)).toBe(expected);
  });

  it('handles the 32-bit boundary, where the sign bit gets involved', () => {
    expect(countSetBits(2 ** 31)).toBe(1);
    expect(countSetBits(2 ** 31 + 1)).toBe(2);
    expect(countSetBits(0xffffffff)).toBe(32);
  });

  it('rejects what the 32-bit operators would truncate', () => {
    for (const bad of [-1, 1.5, 2 ** 32, 2 ** 32 + 1, NaN, Infinity]) {
      expect(() => countSetBits(bad), String(bad)).toThrow(RangeError);
    }
  });

  it('agrees with a division-based count on random inputs', () => {
    const next = rng(21);
    for (let trial = 0; trial < 50; trial++) {
      const n = Math.floor(next() * 2 ** 32);
      expect(countSetBits(n), `seed 21, trial ${trial}: ${n}`).toBe(popcount(n));
    }
  });
});

describe('technique', () => {
  // These rule out the usual library shortcuts (a toString(2) count, a Map or
  // Set counter, a sort), not a hand-written % 2 loop; the Python tests check
  // the exact operation counts.
  it('countSetBits never builds a binary string', () => {
    const spy = vi.spyOn(Number.prototype, 'toString');
    let calls = -1;
    let result = -1;
    try {
      result = countSetBits(44);
      calls = spy.mock.calls.length;
    } finally {
      spy.mockRestore();
    }
    expect(result).toBe(3);
    expect(calls).toBe(0);
  });

  it('singleNumber neither counts in a Map or Set nor sorts', () => {
    // Set last: vitest's own spy registry uses Set.prototype.add.
    const mapSet = vi.spyOn(Map.prototype, 'set');
    const sort = vi.spyOn(Array.prototype, 'sort');
    const setAdd = vi.spyOn(Set.prototype, 'add');
    let calls = [-1, -1, -1];
    let result = -1;
    try {
      result = singleNumber([4, 1, 2, 1, 2]);
      calls = [
        mapSet.mock.calls.length,
        sort.mock.calls.length,
        setAdd.mock.calls.length,
      ];
    } finally {
      setAdd.mockRestore();
      sort.mockRestore();
      mapSet.mockRestore();
    }
    expect(result).toBe(4);
    expect(calls).toEqual([0, 0, 0]);
  });
});

describe('isPowerOfTwo', () => {
  it('is true exactly for 1, 2, 4, 8, ...', () => {
    const found: number[] = [];
    for (let n = -3; n < 40; n++) if (isPowerOfTwo(n)) found.push(n);
    expect(found).toEqual([1, 2, 4, 8, 16, 32]);
    expect(isPowerOfTwo(0)).toBe(false);
    expect(isPowerOfTwo(-8)).toBe(false);
  });

  it('handles the top of the 32-bit range', () => {
    expect(isPowerOfTwo(2 ** 30)).toBe(true);
    expect(isPowerOfTwo(2 ** 31)).toBe(true);
    expect(isPowerOfTwo(2 ** 31 + 1)).toBe(false);
    expect(isPowerOfTwo(0xffffffff)).toBe(false);
  });

  it('rejects what the 32-bit operators would truncate', () => {
    // 2**32 + 1 would become 1 and be reported as a power of two.
    for (const bad of [1.5, 2 ** 32, 2 ** 32 + 1, NaN, Infinity]) {
      expect(() => isPowerOfTwo(bad), String(bad)).toThrow(RangeError);
    }
  });

  it('agrees with a division-based count on random inputs', () => {
    const next = rng(22);
    for (let trial = 0; trial < 50; trial++) {
      const n = Math.floor(next() * 2 ** (1 + Math.floor(next() * 32)));
      expect(isPowerOfTwo(n), `seed 22, trial ${trial}: ${n}`).toBe(
        n > 0 && popcount(n) === 1,
      );
    }
  });
});

describe('singleNumber', () => {
  it('finds the lone value', () => {
    expect(singleNumber([7])).toBe(7);
    expect(singleNumber([4, 1, 2, 1, 2])).toBe(4);
    expect(singleNumber([2, 2, 1])).toBe(1);
    expect(singleNumber([0, 5, 5])).toBe(0);
    expect(singleNumber([-3, 5, -3])).toBe(5);
    expect(singleNumber([-4, -4, -9])).toBe(-9);
  });

  it('works at the ends of the int32 range', () => {
    expect(singleNumber([2 ** 31 - 1, 3, 2 ** 31 - 1])).toBe(3);
    expect(singleNumber([-(2 ** 31), 3, -(2 ** 31)])).toBe(3);
    expect(singleNumber([-(2 ** 31)])).toBe(-(2 ** 31));
  });

  it('throws on an empty list and on values the operator would change', () => {
    expect(() => singleNumber([])).toThrow(RangeError);
    // 2**31 would wrap to -2**31 and the pair would not cancel to 0.
    expect(() => singleNumber([2 ** 31, 1, 2 ** 31])).toThrow(RangeError);
    expect(() => singleNumber([1.5, 1.5, 2])).toThrow(RangeError);
    expect(() => singleNumber([NaN])).toThrow(RangeError);
  });

  it('agrees with a count-based answer on random inputs', () => {
    const next = rng(23);
    for (let trial = 0; trial < 50; trial++) {
      const pairs = Array.from({ length: Math.floor(next() * 12) }, () =>
        Math.floor(next() * 101 - 50),
      );
      let lone = Math.floor(next() * 121 - 60);
      while (pairs.includes(lone)) lone++;
      const nums = [...pairs, ...pairs, lone];
      for (let i = nums.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [nums[i], nums[j]] = [nums[j], nums[i]];
      }
      const counts = new Map<number, number>();
      for (const v of nums) counts.set(v, (counts.get(v) ?? 0) + 1);
      const expected = [...counts].find(([, c]) => c === 1)![0];
      expect(singleNumber(guarded(nums)), `seed 23, trial ${trial}: ${nums}`).toBe(
        expected,
      );
    }
  });
});

describe('subsets', () => {
  it('handles empty and single-item input', () => {
    expect(subsets([])).toEqual([[]]);
    expect(subsets(['x'])).toEqual([[], ['x']]);
  });

  it('lists subsets in mask order', () => {
    expect(subsets(['a', 'b', 'c'])).toEqual([
      [],
      ['a'],
      ['b'],
      ['a', 'b'],
      ['c'],
      ['a', 'c'],
      ['b', 'c'],
      ['a', 'b', 'c'],
    ]);
    // Duplicated items are separate positions, so duplicates show up.
    expect(subsets([1, 1])).toEqual([[], [1], [1], [1, 1]]);
  });

  it('matches the mask definition on random inputs', () => {
    const next = rng(24);
    for (let trial = 0; trial < 50; trial++) {
      const items = Array.from({ length: Math.floor(next() * 9) }, () =>
        Math.floor(next() * 10),
      );
      const n = items.length;
      const expected: number[][] = [];
      for (let mask = 0; mask < 2 ** n; mask++) {
        expected.push(items.filter((_, i) => Math.floor(mask / 2 ** i) % 2 === 1));
      }
      expect(subsets(guarded(items)), `seed 24, trial ${trial}: ${items}`).toEqual(
        expected,
      );
    }
  });

  it('visits one set bit per item that is in, not every position', () => {
    // Each of the 5 items is in half of the 32 subsets: 5 * 16 = 80 set
    // bits, so 80 lowest-bit lookups. Testing all 5 positions of all 32
    // masks would make 160, and a recursive builder would make none.
    const spy = vi.spyOn(Math, 'clz32');
    try {
      expect(subsets([5, 6, 7, 8, 9])).toHaveLength(32);
      expect(spy).toHaveBeenCalledTimes(80);
    } finally {
      spy.mockRestore();
    }
  });
});
