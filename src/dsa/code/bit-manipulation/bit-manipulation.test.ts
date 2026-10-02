import { describe, expect, it } from 'vitest';
import { countSetBits, isPowerOfTwo, singleNumber, subsets } from './bit-manipulation';

// The entry's TypeScript code. API:
// - `countSetBits(n)`: number of 1 bits, for an integer 0 <= n <= 2**32 - 1;
//   throws RangeError otherwise.
// - `isPowerOfTwo(n)`: true for 1, 2, 4, ...; false for 0 and negatives;
//   throws RangeError for non-integers and for n > 2**32 - 1.
// - `singleNumber(nums)`: the value that appears once when the others appear
//   twice; 32-bit signed integers only, non-empty.
// - `subsets(items)`: all 2**n subsets in bitmask order, at most 30 items.

function makeRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

function popcountByString(n: number): number {
  return n.toString(2).split('1').length - 1;
}

describe('countSetBits (TypeScript)', () => {
  it.each([
    [0, 0],
    [1, 1],
    [2, 1],
    [3, 2],
    [7, 3],
    [8, 1],
    [255, 8],
  ])('counts the bits of %i as %i', (n, expected) => {
    expect(countSetBits(n)).toBe(expected);
  });

  it('handles the 31-bit and 32-bit boundaries', () => {
    expect(countSetBits(2 ** 30)).toBe(1);
    expect(countSetBits(2 ** 31 - 1)).toBe(31);
    expect(countSetBits(2 ** 31)).toBe(1);
    expect(countSetBits(2 ** 31 + 1)).toBe(2);
    expect(countSetBits(2 ** 32 - 1)).toBe(32);
  });

  it('rejects values outside 0 to 2**32 - 1 and non-integers', () => {
    expect(() => countSetBits(-1)).toThrow(RangeError);
    expect(() => countSetBits(2 ** 32)).toThrow(RangeError);
    expect(() => countSetBits(2 ** 32 + 1)).toThrow(RangeError);
    expect(() => countSetBits(1.5)).toThrow(RangeError);
    expect(() => countSetBits(NaN)).toThrow(RangeError);
  });

  it('agrees with toString(2) on many seeded random inputs', () => {
    const random = makeRandom(11);
    for (let i = 0; i < 2000; i++) {
      const bits = 1 + Math.floor(random() * 32);
      const n = Math.floor(random() * 2 ** bits);
      expect(countSetBits(n)).toBe(popcountByString(n));
    }
  });
});

describe('isPowerOfTwo (TypeScript)', () => {
  it('is true exactly for the powers of two up to 2**31', () => {
    const found: number[] = [];
    for (let n = -3; n < 40; n++) if (isPowerOfTwo(n)) found.push(n);
    expect(found).toEqual([1, 2, 4, 8, 16, 32]);
    expect(isPowerOfTwo(0)).toBe(false);
    expect(isPowerOfTwo(-8)).toBe(false);
  });

  it('handles the 31-bit and 32-bit boundaries', () => {
    expect(isPowerOfTwo(2 ** 30)).toBe(true);
    expect(isPowerOfTwo(2 ** 31 - 1)).toBe(false);
    expect(isPowerOfTwo(2 ** 31)).toBe(true);
    expect(isPowerOfTwo(2 ** 31 + 1)).toBe(false);
    expect(isPowerOfTwo(2 ** 32 - 1)).toBe(false);
  });

  it('rejects values it would silently get wrong', () => {
    expect(() => isPowerOfTwo(2 ** 32)).toThrow(RangeError);
    expect(() => isPowerOfTwo(2 ** 32 + 1)).toThrow(RangeError);
    expect(() => isPowerOfTwo(0.5)).toThrow(RangeError);
  });

  it('agrees with a set-bit count on many seeded random inputs', () => {
    const random = makeRandom(12);
    for (let i = 0; i < 2000; i++) {
      const bits = 1 + Math.floor(random() * 32);
      const n = Math.floor(random() * 2 ** bits);
      expect(isPowerOfTwo(n)).toBe(n > 0 && popcountByString(n) === 1);
    }
  });
});

describe('singleNumber (TypeScript)', () => {
  it('finds the lone value in small cases', () => {
    expect(singleNumber([7])).toBe(7);
    expect(singleNumber([2, 2, 1])).toBe(1);
    expect(singleNumber([4, 1, 2, 1, 2])).toBe(4);
    expect(singleNumber([0, 5, 5])).toBe(0);
  });

  it('handles negatives and the 32-bit signed extremes', () => {
    expect(singleNumber([-1, 3, -1])).toBe(3);
    expect(singleNumber([5, -7, 5])).toBe(-7);
    expect(singleNumber([2 ** 31 - 1, 9, 2 ** 31 - 1])).toBe(9);
    expect(singleNumber([-(2 ** 31), 3, 3])).toBe(-(2 ** 31));
    expect(singleNumber([-(2 ** 31), 4, -(2 ** 31)])).toBe(4);
  });

  it('rejects empty input, non-integers and values outside 32-bit signed', () => {
    expect(() => singleNumber([])).toThrow(RangeError);
    expect(() => singleNumber([1.5])).toThrow(RangeError);
    expect(() => singleNumber([2 ** 31, 1, 2 ** 31])).toThrow(RangeError);
    expect(() => singleNumber([2 ** 32, 1, 2 ** 32])).toThrow(RangeError);
  });

  it('agrees with a Map-based count on many seeded random inputs', () => {
    const random = makeRandom(13);
    for (let i = 0; i < 500; i++) {
      const pairs = Array.from(
        { length: Math.floor(random() * 13) },
        () => Math.floor(random() * 101) - 50,
      );
      const lone = Math.floor(random() * 201) - 100;
      const nums = [...pairs, ...pairs, lone];
      for (let j = nums.length - 1; j > 0; j--) {
        const k = Math.floor(random() * (j + 1));
        [nums[j], nums[k]] = [nums[k], nums[j]];
      }
      const counts = new Map<number, number>();
      for (const v of nums) counts.set(v, (counts.get(v) ?? 0) + 1);
      const expected = [...counts].find(([, c]) => c % 2 === 1)![0];
      expect(singleNumber(nums)).toBe(expected);
    }
  });
});

describe('subsets (TypeScript)', () => {
  it('handles empty and single-item input', () => {
    expect(subsets([])).toEqual([[]]);
    expect(subsets([5])).toEqual([[], [5]]);
  });

  it('lists subsets in bitmask order', () => {
    expect(subsets([1, 2, 3])).toEqual([
      [],
      [1],
      [2],
      [1, 2],
      [3],
      [1, 3],
      [2, 3],
      [1, 2, 3],
    ]);
  });

  it('produces 2**n distinct subsets matching a combination count', () => {
    const random = makeRandom(14);
    for (let i = 0; i < 60; i++) {
      const n = Math.floor(random() * 9);
      const items = Array.from({ length: n }, (_, idx) => idx * 3 + 1);
      const got = subsets(items);
      expect(got.length).toBe(2 ** n);
      expect(new Set(got.map((s) => s.join(','))).size).toBe(2 ** n);
      // Number of subsets of each size is C(n, size).
      let choose = 1;
      for (let size = 0; size <= n; size++) {
        expect(got.filter((s) => s.length === size).length).toBe(choose);
        choose = (choose * (n - size)) / (size + 1);
      }
    }
  });

  it('rejects more than 30 items, where 1 << n stops being positive', () => {
    expect(() => subsets(new Array(31).fill(0))).toThrow(RangeError);
  });

  it('does not change the input', () => {
    const items = [3, 1, 2];
    subsets(items);
    expect(items).toEqual([3, 1, 2]);
  });
});

describe('JavaScript bitwise behaviour the entry describes', () => {
  it('converts operands to 32-bit signed integers', () => {
    expect(1 << 31).toBe(-2147483648);
    expect(1 << 32).toBe(1);
    expect((2 ** 32) | 0).toBe(0);
    expect((2 ** 32 + 1) | 0).toBe(1);
    expect((2 ** 31) | 0).toBe(-2147483648);
    expect(~5).toBe(-6);
  });

  it('>>> is the unsigned shift', () => {
    expect(-1 >>> 0).toBe(4294967295);
    expect(-1 >>> 31).toBe(1);
    expect(-8 >> 1).toBe(-4);
    expect(-8 >>> 1).toBe(2147483644);
  });
});
