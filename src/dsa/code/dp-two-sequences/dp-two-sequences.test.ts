import { describe, expect, it } from 'vitest';
import {
  editDistance,
  editDistanceRolling,
  lcs,
  lcsLength,
  lcsTable,
} from './dp-two-sequences';

/** A small seeded generator (mulberry32), so every run sees the same strings. */
function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomString(rng: () => number, alphabet: string, maxLen: number): string {
  const length = Math.floor(rng() * (maxLen + 1));
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[Math.floor(rng() * alphabet.length)];
  return out;
}

function randomPairs(seed: number, count: number, alphabet: string, maxLen: number) {
  const rng = makeRng(seed);
  const pairs: [string, string][] = [];
  for (let i = 0; i < count; i++) {
    pairs.push([
      randomString(rng, alphabet, maxLen),
      randomString(rng, alphabet, maxLen),
    ]);
  }
  return pairs;
}

function allSubsequences(s: string): Set<string> {
  const chars = Array.from(s);
  const found = new Set<string>();
  for (let mask = 0; mask < 1 << chars.length; mask++) {
    let sub = '';
    for (let i = 0; i < chars.length; i++) if (mask & (1 << i)) sub += chars[i];
    found.add(sub);
  }
  return found;
}

function bruteLcsLength(a: string, b: string): number {
  const inB = allSubsequences(b);
  let best = 0;
  for (const sub of allSubsequences(a)) {
    if (inB.has(sub)) best = Math.max(best, Array.from(sub).length);
  }
  return best;
}

function bruteEditDistance(a: string[], b: string[]): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const ra = a.slice(0, -1);
  const rb = b.slice(0, -1);
  if (a[a.length - 1] === b[b.length - 1]) return bruteEditDistance(ra, rb);
  return (
    1 +
    Math.min(
      bruteEditDistance(ra, b),
      bruteEditDistance(a, rb),
      bruteEditDistance(ra, rb),
    )
  );
}

function isSubsequence(small: string, big: string): boolean {
  const s = Array.from(small);
  let k = 0;
  for (const c of Array.from(big)) if (k < s.length && c === s[k]) k++;
  return k === s.length;
}

describe('lcs (TypeScript)', () => {
  it('solves known examples', () => {
    expect(lcsLength('ABCBDAB', 'BDCABA')).toBe(4);
    expect(lcsLength('abcde', 'ace')).toBe(3);
    expect(lcs('abcde', 'ace')).toBe('ace');
  });

  it('builds a table with an empty-prefix row and column', () => {
    const table = lcsTable('abc', 'de');
    expect(table).toHaveLength(4);
    expect(table.every((row) => row.length === 3)).toBe(true);
    expect(table[0]).toEqual([0, 0, 0]);
    expect(table.every((row) => row[0] === 0)).toBe(true);
  });

  it('handles empty strings', () => {
    expect(lcsLength('', '')).toBe(0);
    expect(lcsLength('abc', '')).toBe(0);
    expect(lcsLength('', 'abc')).toBe(0);
    expect(lcs('', 'abc')).toBe('');
    expect(lcs('abc', '')).toBe('');
  });

  it('handles identical strings and strings with nothing in common', () => {
    expect(lcsLength('banana', 'banana')).toBe(6);
    expect(lcs('banana', 'banana')).toBe('banana');
    expect(lcsLength('abc', 'xyz')).toBe(0);
    expect(lcs('abc', 'xyz')).toBe('');
  });

  it('handles single characters, containment and repeats', () => {
    expect(lcs('a', 'a')).toBe('a');
    expect(lcs('a', 'b')).toBe('');
    expect(lcs('ace', 'abcde')).toBe('ace');
    expect(lcs('abcde', 'bd')).toBe('bd');
    expect(lcs('aaaa', 'aa')).toBe('aa');
  });

  it('matches brute force on seeded random strings', () => {
    for (const [trial, [a, b]] of randomPairs(0, 50, 'abc', 8).entries()) {
      const where = `seed 0, trial ${trial}: ${a} | ${b}`;
      const expected = bruteLcsLength(a, b);
      expect(lcsLength(a, b), where).toBe(expected);
      const result = lcs(a, b);
      expect(result.length, where).toBe(expected);
      expect(isSubsequence(result, a) && isSubsequence(result, b), where).toBe(true);
    }
  });

  it('compares code points, so an emoji is one character', () => {
    expect(lcs('a😀b', '😀')).toBe('😀');
    expect(lcsLength('😀😀', '😀')).toBe(1);
  });
});

describe('editDistance (TypeScript)', () => {
  it('solves known examples', () => {
    expect(editDistance('kitten', 'sitting')).toBe(3);
    expect(editDistance('horse', 'ros')).toBe(3);
    expect(editDistance('intention', 'execution')).toBe(5);
  });

  it('handles empty and identical strings', () => {
    expect(editDistance('', '')).toBe(0);
    expect(editDistance('abc', '')).toBe(3);
    expect(editDistance('', 'abcd')).toBe(4);
    expect(editDistance('banana', 'banana')).toBe(0);
  });

  it('handles strings with nothing in common and single operations', () => {
    expect(editDistance('abc', 'xyz')).toBe(3);
    expect(editDistance('abc', 'xy')).toBe(3);
    expect(editDistance('a', 'xyz')).toBe(3);
    expect(editDistance('cat', 'cut')).toBe(1);
    expect(editDistance('cat', 'cart')).toBe(1);
    expect(editDistance('cart', 'cat')).toBe(1);
  });

  it('matches a plain recursive version on seeded random strings', () => {
    for (const [trial, [a, b]] of randomPairs(100, 50, 'abc', 6).entries()) {
      expect(editDistance(a, b), `seed 100, trial ${trial}: ${a} | ${b}`).toBe(
        bruteEditDistance(Array.from(a), Array.from(b)),
      );
    }
  });

  it('is symmetric and bounded by the lengths', () => {
    for (const [trial, [a, b]] of randomPairs(7, 50, 'ab', 8).entries()) {
      const where = `seed 7, trial ${trial}: ${a} | ${b}`;
      const d = editDistance(a, b);
      expect(d, where).toBe(editDistance(b, a));
      expect(d, where).toBeGreaterThanOrEqual(Math.abs(a.length - b.length));
      expect(d, where).toBeLessThanOrEqual(Math.max(a.length, b.length));
    }
  });

  it('counts an emoji as one character', () => {
    expect(editDistance('a😀', 'a')).toBe(1);
    expect(editDistance('😀', '😁')).toBe(1);
  });
});

describe('editDistanceRolling (TypeScript)', () => {
  it('matches the table version on seeded random strings', () => {
    for (const [trial, [a, b]] of randomPairs(200, 50, 'abc', 9).entries()) {
      expect(editDistanceRolling(a, b), `seed 200, trial ${trial}: ${a} | ${b}`).toBe(
        editDistance(a, b),
      );
    }
  });

  it('matches the plain recursive version', () => {
    for (const [trial, [a, b]] of randomPairs(300, 50, 'ab', 6).entries()) {
      expect(editDistanceRolling(a, b), `seed 300, trial ${trial}: ${a} | ${b}`).toBe(
        bruteEditDistance(Array.from(a), Array.from(b)),
      );
    }
  });

  it('handles edge cases', () => {
    expect(editDistanceRolling('', '')).toBe(0);
    expect(editDistanceRolling('abc', '')).toBe(3);
    expect(editDistanceRolling('', 'abc')).toBe(3);
    expect(editDistanceRolling('same', 'same')).toBe(0);
    expect(editDistanceRolling('abc', 'xyz')).toBe(3);
    expect(editDistanceRolling('a😀', 'a')).toBe(1);
  });
});
