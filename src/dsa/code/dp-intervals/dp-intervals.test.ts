import { describe, expect, it } from 'vitest';
import {
  longestPalindromicSubsequence,
  lpsLength,
  lpsTable,
  matrixChainCost,
  matrixChainOrder,
} from './dp-intervals';

// Brute force for both problems: every subsequence of a short string, and every
// way of bracketing a short chain of matrices.

function makeRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

function bruteLpsLength(s: string): number {
  let best = 0;
  for (let mask = 0; mask < 1 << s.length; mask++) {
    const kept = [...s].filter((_, i) => (mask >> i) & 1);
    if (kept.join('') === [...kept].reverse().join(''))
      best = Math.max(best, kept.length);
  }
  return best;
}

function isSubsequence(small: string, big: string): boolean {
  let at = 0;
  for (const ch of big) if (at < small.length && ch === small[at]) at++;
  return at === small.length;
}

/** Every [bracketing, cost] for matrices i..j; matrix k is dims[k] x dims[k + 1]. */
function allOrders(dims: number[], i: number, j: number): [string, number][] {
  if (i === j) return [[`A${i + 1}`, 0]];
  const found: [string, number][] = [];
  for (let k = i; k < j; k++) {
    for (const [left, leftCost] of allOrders(dims, i, k)) {
      for (const [right, rightCost] of allOrders(dims, k + 1, j)) {
        const joined = dims[i] * dims[k + 1] * dims[j + 1];
        found.push([`(${left} ${right})`, leftCost + rightCost + joined]);
      }
    }
  }
  return found;
}

function randomString(random: () => number, alphabet: string, maxLength: number): string {
  const length = Math.floor(random() * (maxLength + 1));
  let s = '';
  for (let n = 0; n < length; n++) s += alphabet[Math.floor(random() * alphabet.length)];
  return s;
}

describe('longest palindromic subsequence (TypeScript)', () => {
  it('finds known answers', () => {
    expect(lpsLength('bbbab')).toBe(4);
    expect(lpsLength('agbcba')).toBe(5);
    expect(longestPalindromicSubsequence('agbcba')).toBe('abcba');
    expect(lpsLength('abcd')).toBe(1);
  });

  it('handles empty and single-character strings', () => {
    expect(lpsLength('')).toBe(0);
    expect(longestPalindromicSubsequence('')).toBe('');
    expect(lpsLength('x')).toBe(1);
    expect(longestPalindromicSubsequence('x')).toBe('x');
  });

  it('handles all equal characters', () => {
    expect(lpsLength('aaaaaa')).toBe(6);
    expect(longestPalindromicSubsequence('aaaaa')).toBe('aaaaa');
  });

  it('handles a string that is already a palindrome', () => {
    expect(lpsLength('racecar')).toBe(7);
    expect(longestPalindromicSubsequence('abba')).toBe('abba');
  });

  it('handles two characters', () => {
    expect(lpsLength('aa')).toBe(2);
    expect(lpsLength('ab')).toBe(1);
  });

  it('fills the table cells it should', () => {
    const table = lpsTable('bbbab');
    expect(table[0][4]).toBe(4);
    expect(table[1][3]).toBe(2);
    expect(table[3][4]).toBe(1);
    expect([0, 1, 2, 3, 4].map((i) => table[i][i])).toEqual([1, 1, 1, 1, 1]);
  });

  it('agrees with brute force on many seeded random strings', () => {
    const random = makeRandom(11);
    for (let trial = 0; trial < 50; trial++) {
      const s = randomString(random, 'abc', 11);
      const where = `seed 11, trial ${trial}: '${s}'`;
      const expected = bruteLpsLength(s);
      expect(lpsLength(s), where).toBe(expected);
      const text = longestPalindromicSubsequence(s);
      expect(text, where).toBe([...text].reverse().join(''));
      expect(isSubsequence(text, s), where).toBe(true);
      expect(text.length, where).toBe(expected);
    }
  });

  it('agrees with brute force over a wider alphabet', () => {
    const random = makeRandom(12);
    for (let trial = 0; trial < 50; trial++) {
      const s = randomString(random, 'abcdefg', 10);
      expect(lpsLength(s), `seed 12, trial ${trial}: '${s}'`).toBe(bruteLpsLength(s));
    }
  });
});

describe('matrix chain order (TypeScript)', () => {
  it('finds known answers', () => {
    expect(matrixChainOrder([10, 30, 5, 60])).toEqual([4500, '((A1 A2) A3)']);
    expect(matrixChainCost([40, 20, 30, 10, 30])).toBe(26000);
    expect(matrixChainCost([10, 20, 30])).toBe(6000);
  });

  it('handles a single matrix and no matrices', () => {
    expect(matrixChainCost([5, 7])).toBe(0);
    expect(matrixChainOrder([5, 7])).toEqual([0, 'A1']);
    expect(matrixChainOrder([])).toEqual([0, '']);
    expect(matrixChainOrder([4])).toEqual([0, '']);
  });

  it('has one order for two matrices', () => {
    expect(matrixChainOrder([2, 3, 4])).toEqual([24, '(A1 A2)']);
  });

  it('costs every bracketing the same when all matrices are the same size', () => {
    expect(matrixChainCost([4, 4, 4, 4, 4])).toBe(3 * 4 ** 3);
  });

  it('returns a valid, cheapest order on many seeded random chains', () => {
    const random = makeRandom(5);
    for (let trial = 0; trial < 50; trial++) {
      const count = 2 + Math.floor(random() * 7);
      const dims = Array.from({ length: count }, () => 1 + Math.floor(random() * 9));
      const where = `seed 5, trial ${trial}: ${JSON.stringify(dims)}`;
      const every = allOrders(dims, 0, dims.length - 2);
      const best = Math.min(...every.map(([, cost]) => cost));
      const [cost, order] = matrixChainOrder(dims);
      expect(cost, where).toBe(best);
      expect(matrixChainCost(dims), where).toBe(best);
      expect(every, where).toContainEqual([order, best]);
    }
  });

  it('does not change the input', () => {
    const dims = [10, 30, 5, 60];
    matrixChainOrder(dims);
    expect(dims).toEqual([10, 30, 5, 60]);
  });
});
