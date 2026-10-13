import { describe, expect, it } from 'vitest';
import { DynamicArray, StringBuilder, reverseString } from './arrays-and-strings';

// The arrays-and-strings entry's TypeScript code. API: `new DynamicArray()`
// with `size()`, `capacity()`, `get(i)` (RangeError outside 0..size-1),
// `append(item)` and `insert(i, item)` (RangeError outside 0..size);
// `new StringBuilder()` with `append(piece)` and `build()`;
// `reverseString(s)`. Items are strings.

/** A small seeded generator (a linear congruential one), so a failing case can be replayed. */
function makeRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function randInt(next: () => number, lo: number, hi: number): number {
  return lo + Math.floor(next() * (hi - lo + 1));
}

function contents(a: DynamicArray): string[] {
  const items: string[] = [];
  for (let i = 0; i < a.size(); i++) {
    items.push(a.get(i));
  }
  return items;
}

function filled(items: string[]): DynamicArray {
  const a = new DynamicArray();
  for (const item of items) {
    a.append(item);
  }
  return a;
}

describe('DynamicArray (TypeScript)', () => {
  it('starts empty', () => {
    const a = new DynamicArray();
    expect(a.size()).toBe(0);
    expect(contents(a)).toEqual([]);
    expect(() => a.get(0)).toThrow(RangeError);
  });

  it('holds one item', () => {
    const a = filled(['a']);
    expect(a.size()).toBe(1);
    expect(a.get(0)).toBe('a');
    expect(() => a.get(1)).toThrow(RangeError);
  });

  it('handles the running example', () => {
    const a = filled('abcde'.split(''));
    expect(contents(a)).toEqual('abcde'.split(''));
    expect(a.capacity()).toBe(8);
    a.insert(1, 'x');
    expect(contents(a)).toEqual('axbcde'.split(''));
    a.insert(6, 'z');
    expect(contents(a)).toEqual('axbcdez'.split(''));
  });

  it('inserts at the front of a full array', () => {
    const a = filled(['1', '2', '3', '4']);
    expect(a.capacity()).toBe(4);
    a.insert(0, '0');
    expect(contents(a)).toEqual(['0', '1', '2', '3', '4']);
    expect(a.capacity()).toBe(8);
  });

  it('treats duplicates as ordinary items', () => {
    const a = filled(['', '', '7', '7']);
    expect(contents(a)).toEqual(['', '', '7', '7']);
    expect(a.size()).toBe(4);
  });

  it('checks indexes against the size, not the capacity', () => {
    const a = filled(['1', '2', '3']);
    expect(a.capacity()).toBe(4);
    for (const bad of [-1, 3, 4, 100]) {
      expect(() => a.get(bad), `get(${bad})`).toThrow(RangeError);
    }
    for (const bad of [-1, 4, 5]) {
      expect(() => a.insert(bad, '0'), `insert(${bad})`).toThrow(RangeError);
    }
    expect(contents(a)).toEqual(['1', '2', '3']);
  });

  it('matches Array.prototype.splice on seeded random inserts', () => {
    const seed = 11;
    const next = makeRandom(seed);
    for (let trial = 0; trial < 50; trial++) {
      const a = new DynamicArray();
      const want: string[] = [];
      const steps = randInt(next, 0, 40);
      for (let step = 0; step < steps; step++) {
        const i = randInt(next, 0, want.length);
        a.insert(i, String(step));
        want.splice(i, 0, String(step));
        const where = `seed ${seed}, trial ${trial}, step ${step}`;
        expect(a.size(), where).toBe(want.length);
        expect(contents(a), where).toEqual(want);
      }
    }
  });

  it('doubles its capacity, so resizes are rare', () => {
    const a = new DynamicArray();
    const sizes = new Set([a.capacity()]);
    for (let n = 1; n <= 1000; n++) {
      a.append(String(n));
      sizes.add(a.capacity());
      expect(a.size() <= a.capacity() && a.capacity() < 2 * a.size() + 1, `n=${n}`).toBe(
        true,
      );
    }
    // 1, 2, 4, ..., 1024: eleven sizes. A fixed step would pass through hundreds.
    const expected: number[] = [];
    for (let k = 0; k < 11; k++) {
      expected.push(2 ** k);
    }
    expect([...sizes].sort((x, y) => x - y)).toEqual(expected);
  });
});

describe('StringBuilder (TypeScript)', () => {
  it('builds empty and single-piece strings', () => {
    expect(new StringBuilder().build()).toBe('');
    const empty = new StringBuilder();
    empty.append('');
    expect(empty.build()).toBe('');
    const one = new StringBuilder();
    one.append('abc');
    expect(one.build()).toBe('abc');
  });

  it('can build again after more appends', () => {
    const b = new StringBuilder();
    b.append('a');
    b.append('b');
    expect(b.build()).toBe('ab');
    b.append('c');
    expect(b.build()).toBe('abc');
    expect(b.build()).toBe('abc');
  });

  it('keeps one piece after building, having held one per append before', () => {
    const b = new StringBuilder();
    for (let n = 0; n < 100; n++) {
      b.append('x');
    }
    expect(b.parts.length).toBe(100);
    expect(b.build()).toBe('x'.repeat(100));
    expect(b.parts.length).toBe(1);
  });

  it('matches plain concatenation on seeded random pieces', () => {
    const seed = 12;
    const next = makeRandom(seed);
    const alphabet = ['', 'a', 'bc', 'd'];
    for (let trial = 0; trial < 50; trial++) {
      const pieces: string[] = [];
      const count = randInt(next, 0, 30);
      for (let k = 0; k < count; k++) {
        pieces.push(alphabet[randInt(next, 0, alphabet.length - 1)]);
      }
      const b = new StringBuilder();
      for (const piece of pieces) {
        b.append(piece);
      }
      expect(b.build(), `seed ${seed}, trial ${trial}: ${pieces}`).toBe(pieces.join(''));
    }
  });
});

describe('reverseString', () => {
  it('reverses small strings', () => {
    expect(reverseString('')).toBe('');
    expect(reverseString('a')).toBe('a');
    expect(reverseString('aa')).toBe('aa');
    expect(reverseString('ab')).toBe('ba');
    expect(reverseString('abc')).toBe('cba');
    expect(reverseString('abcd')).toBe('dcba');
    expect(reverseString('ab😀')).toBe('😀ba');
  });

  it('is its own inverse on seeded random text', () => {
    const seed = 13;
    const next = makeRandom(seed);
    const alphabet = 'abc ';
    for (let trial = 0; trial < 50; trial++) {
      let s = '';
      const length = randInt(next, 0, 20);
      for (let k = 0; k < length; k++) {
        s += alphabet[randInt(next, 0, alphabet.length - 1)];
      }
      const where = `seed ${seed}, trial ${trial}: ${JSON.stringify(s)}`;
      expect(reverseString(reverseString(s)), where).toBe(s);
      expect(reverseString(s), where).toBe(Array.from(s).reverse().join(''));
    }
  });
});
