import { describe, expect, it } from 'vitest';
import { DynamicArray, StringBuilder, reverseCodePoints } from './arrays-and-strings';

// The arrays-and-strings entry's TypeScript code. API: `new DynamicArray<T>()`
// with `length`, `capacity`, `get(i)` (RangeError outside 0..length-1),
// `append(item)` and `insert(i, item)` (RangeError outside 0..length);
// `new StringBuilder()` with a chainable `append(piece)` and `build()`;
// `reverseCodePoints(s)`.

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

const randInt = (next: () => number, lo: number, hi: number) =>
  lo + Math.floor(next() * (hi - lo + 1));

function contents<T>(a: DynamicArray<T>): T[] {
  return Array.from({ length: a.length }, (_, i) => a.get(i));
}

function filled<T>(items: T[]): DynamicArray<T> {
  const a = new DynamicArray<T>();
  for (const item of items) a.append(item);
  return a;
}

describe('DynamicArray (TypeScript)', () => {
  it('starts empty', () => {
    const a = new DynamicArray<number>();
    expect(a.length).toBe(0);
    expect(contents(a)).toEqual([]);
    expect(() => a.get(0)).toThrow(RangeError);
  });

  it('holds one item', () => {
    const a = filled(['a']);
    expect(a.length).toBe(1);
    expect(a.get(0)).toBe('a');
    expect(() => a.get(1)).toThrow(RangeError);
  });

  it('handles the running example', () => {
    const a = filled([...'abcde']);
    expect(contents(a)).toEqual([...'abcde']);
    expect(a.capacity).toBe(8);
    a.insert(1, 'x');
    expect(contents(a)).toEqual([...'axbcde']);
    a.insert(6, 'z');
    expect(contents(a)).toEqual([...'axbcdez']);
  });

  it('inserts at the front of a full array', () => {
    const a = filled([1, 2, 3, 4]);
    expect(a.capacity).toBe(4);
    a.insert(0, 0);
    expect(contents(a)).toEqual([0, 1, 2, 3, 4]);
    expect(a.capacity).toBe(8);
  });

  it('treats undefined and duplicates as ordinary items', () => {
    const a = filled<number | undefined>([undefined, undefined, 7, 7]);
    expect(contents(a)).toEqual([undefined, undefined, 7, 7]);
    expect(a.length).toBe(4);
  });

  it('checks indexes against the length, not the capacity', () => {
    const a = filled([1, 2, 3]);
    expect(a.capacity).toBe(4);
    for (const bad of [-1, 3, 4, 100, 1.5, NaN]) {
      expect(() => a.get(bad), `get(${bad})`).toThrow(RangeError);
    }
    for (const bad of [-1, 4, 5, 0.5]) {
      expect(() => a.insert(bad, 0), `insert(${bad})`).toThrow(RangeError);
    }
    expect(contents(a)).toEqual([1, 2, 3]);
  });

  it('matches Array.prototype.splice on seeded random inserts', () => {
    const seed = 11;
    const next = rng(seed);
    for (let trial = 0; trial < 50; trial++) {
      const a = new DynamicArray<number>();
      const want: number[] = [];
      const steps = randInt(next, 0, 40);
      for (let step = 0; step < steps; step++) {
        const i = randInt(next, 0, want.length);
        a.insert(i, step);
        want.splice(i, 0, step);
        const where = `seed ${seed}, trial ${trial}, step ${step}`;
        expect(a.length, where).toBe(want.length);
        expect(contents(a), where).toEqual(want);
      }
    }
  });

  it('doubles its capacity, so resizes are rare', () => {
    const a = new DynamicArray<number>();
    const sizes = new Set([a.capacity]);
    for (let n = 1; n <= 1000; n++) {
      a.append(n);
      sizes.add(a.capacity);
      expect(a.length <= a.capacity && a.capacity < 2 * a.length + 1, `n=${n}`).toBe(
        true,
      );
    }
    // 1, 2, 4, ..., 1024: eleven sizes. A fixed step would pass through hundreds.
    expect([...sizes].sort((x, y) => x - y)).toEqual(
      Array.from({ length: 11 }, (_, k) => 2 ** k),
    );
  });
});

describe('StringBuilder (TypeScript)', () => {
  it('builds empty and single-piece strings', () => {
    expect(new StringBuilder().build()).toBe('');
    expect(new StringBuilder().append('').build()).toBe('');
    expect(new StringBuilder().append('abc').build()).toBe('abc');
  });

  it('chains and can build again after more appends', () => {
    const b = new StringBuilder();
    expect(b.append('a').append('b')).toBe(b);
    expect(b.build()).toBe('ab');
    expect(b.append('c').build()).toBe('abc');
    expect(b.build()).toBe('abc');
  });

  it('keeps one piece after building, having held one per append before', () => {
    const b = new StringBuilder();
    const parts = () => (b as unknown as { parts: string[] }).parts;
    for (let n = 0; n < 100; n++) b.append('x');
    expect(parts().length).toBe(100);
    expect(b.build()).toBe('x'.repeat(100));
    expect(parts().length).toBe(1);
  });

  it('matches plain concatenation on seeded random pieces', () => {
    const seed = 12;
    const next = rng(seed);
    const alphabet = ['', 'a', 'bc', 'é', '😀', 'é'];
    for (let trial = 0; trial < 50; trial++) {
      const pieces = Array.from(
        { length: randInt(next, 0, 30) },
        () => alphabet[randInt(next, 0, alphabet.length - 1)],
      );
      const b = new StringBuilder();
      for (const piece of pieces) b.append(piece);
      expect(b.build(), `seed ${seed}, trial ${trial}: ${pieces}`).toBe(pieces.join(''));
    }
  });
});

describe('reverseCodePoints', () => {
  it('handles empty, one-character and palindromic strings', () => {
    expect(reverseCodePoints('')).toBe('');
    expect(reverseCodePoints('a')).toBe('a');
    expect(reverseCodePoints('aa')).toBe('aa');
  });

  it('keeps an emoji whole, though its length counts two units', () => {
    expect(reverseCodePoints('ab😀')).toBe('😀ba');
    expect(reverseCodePoints('😀')).toBe('😀');
    expect('ab😀'.length).toBe(4);
  });

  it('still splits a combining accent from its letter', () => {
    expect(reverseCodePoints('éa')).toBe('áe');
  });

  it('is its own inverse on seeded random text', () => {
    const seed = 13;
    const next = rng(seed);
    const alphabet = [...'ab é😀́'];
    for (let trial = 0; trial < 50; trial++) {
      const s = Array.from(
        { length: randInt(next, 0, 20) },
        () => alphabet[randInt(next, 0, alphabet.length - 1)],
      ).join('');
      const where = `seed ${seed}, trial ${trial}: ${JSON.stringify(s)}`;
      expect(reverseCodePoints(reverseCodePoints(s)), where).toBe(s);
      expect(reverseCodePoints(s).length, where).toBe(s.length);
    }
  });
});
