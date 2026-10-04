import { describe, expect, it } from 'vitest';
import { StringBuilder, isPalindrome, reverseCodePoints } from './strings';

// The string entry's TypeScript code.
// API: `new StringBuilder()` with `append(piece)` (returns the builder), `length`
// (UTF-16 code units so far) and `build()`; `reverseCodePoints(s)`;
// `isPalindrome(s)` (letters and digits only, case ignored).

// 𐐀 and 𐐨 are one Deseret letter in upper and lower case, each two code units.
const ALPHABET = Array.from('abAB1 ,!éÉ😀🇺ß𐐀𐐨');

function makeRandom(seed: number): () => number {
  return () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
}

function randomString(random: () => number, maxLength: number): string[] {
  const length = Math.floor(random() * maxLength);
  return Array.from({ length }, () => ALPHABET[Math.floor(random() * ALPHABET.length)]);
}

function referencePalindrome(s: string): boolean {
  const kept = Array.from(s)
    .filter((c) => /[\p{L}\p{N}]/u.test(c))
    .map((c) => c.toLowerCase());
  return kept.join('\u0000') === [...kept].reverse().join('\u0000');
}

describe('StringBuilder (TypeScript)', () => {
  it('starts empty', () => {
    const b = new StringBuilder();
    expect(b.length).toBe(0);
    expect(b.build()).toBe('');
  });

  it('joins pieces in order', () => {
    const b = new StringBuilder();
    b.append('ab').append('').append('c');
    expect(b.build()).toBe('abc');
    expect(b.length).toBe(3);
  });

  it('counts UTF-16 code units, so an emoji counts as two', () => {
    const b = new StringBuilder();
    b.append('h').append('é').append('😀');
    expect(b.length).toBe(4);
    expect(b.build()).toBe('hé😀');
  });

  it('can build again and keep appending', () => {
    const b = new StringBuilder();
    b.append('x');
    expect(b.build()).toBe('x');
    expect(b.build()).toBe('x');
    b.append('y');
    expect(b.build()).toBe('xy');
    expect(b.length).toBe(2);
  });

  it('matches += on many seeded random pieces', () => {
    const random = makeRandom(3);
    for (let round = 0; round < 50; round++) {
      const at = `seed 3, trial ${round}`;
      const pieceCount = Math.floor(random() * 8);
      const b = new StringBuilder();
      let expected = '';
      for (let p = 0; p < pieceCount; p++) {
        const piece = randomString(random, 4).join('');
        b.append(piece);
        expected += piece;
        if (random() < 0.3) expect(b.build(), at).toBe(expected);
      }
      expect(b.build(), at).toBe(expected);
      expect(b.length, at).toBe(expected.length);
    }
  });
});

describe('reverseCodePoints (TypeScript)', () => {
  it.each([
    ['', ''],
    ['a', 'a'],
    ['ab', 'ba'],
    ['héllo', 'olléh'],
    ['a😀b', 'b😀a'],
    ['😀🎉', '🎉😀'],
  ])('reverses %j to %j', (s, expected) => {
    expect(reverseCodePoints(s)).toBe(expected);
  });

  it('never splits a surrogate pair', () => {
    const reversed = reverseCodePoints('x😀');
    expect(reversed).toBe('😀x');
    // \p{Cs} with the u flag matches a lone surrogate, half of a split pair.
    expect(/\p{Cs}/u.test(reversed)).toBe(false);
  });

  it('matches a reversed list of code points on many seeded random strings', () => {
    const random = makeRandom(5);
    for (let round = 0; round < 50; round++) {
      const chars = randomString(random, 10);
      const s = chars.join('');
      const at = `seed 5, trial ${round}: ${JSON.stringify(s)}`;
      expect(reverseCodePoints(s), at).toBe([...chars].reverse().join(''));
      expect(reverseCodePoints(reverseCodePoints(s)), at).toBe(s);
    }
  });
});

describe('isPalindrome (TypeScript)', () => {
  it.each([
    '',
    'a',
    '!',
    ',,,',
    'aa',
    'Race car!',
    'A man, a plan, a canal: Panama',
    "No 'x' in Nixon",
    'été',
    'Été',
    '😀a😀',
    'a😀b😀a',
    '1a2 2A1',
    '𐐀b𐐨',
  ])('accepts %j', (s) => {
    expect(isPalindrome(s)).toBe(true);
  });

  it.each(['ab', 'abca', 'race a car', '0P', 'éa', '𐐀b', 'a,b', '!ab!'])(
    'rejects %j',
    (s) => {
      expect(isPalindrome(s)).toBe(false);
    },
  );

  it('gives the same answer when called repeatedly', () => {
    for (let k = 0; k < 4; k++) expect(isPalindrome('abba')).toBe(true);
  });

  it('matches the filter-and-reverse answer on many seeded random strings', () => {
    const random = makeRandom(9);
    let found = 0;
    for (let round = 0; round < 50; round++) {
      const half = randomString(random, 9);
      const chars = random() < 0.5 ? [...half, ...[...half].reverse()] : half;
      const s = chars.join('');
      const expected = referencePalindrome(s);
      if (expected) found++;
      expect(isPalindrome(s), `seed 9, trial ${round}: ${JSON.stringify(s)}`).toBe(
        expected,
      );
    }
    expect(found).toBeGreaterThan(5);
    expect(found).toBeLessThan(45);
  });
});
