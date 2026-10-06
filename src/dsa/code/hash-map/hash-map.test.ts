import { describe, expect, it } from 'vitest';
import { HashMap } from './hash-map';

// API: `new HashMap<V>(capacity = 8, hash = <default string hash>)` with
// string keys; `put`, `get`, `has`, `delete`, `size`, `capacity`.

/** A hash that sends every key to the same bucket. */
const collide = () => 0;

/** A small seeded generator, so a failing trial can be replayed. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('HashMap (TypeScript)', () => {
  it('starts empty with the capacity it was given', () => {
    const map = new HashMap<number>(4);
    expect(map.size).toBe(0);
    expect(map.capacity).toBe(4);
    expect(map.get('a')).toBeUndefined();
    expect(map.has('a')).toBe(false);
    expect(map.delete('a')).toBe(false);
  });

  it('holds one entry', () => {
    const map = new HashMap<number>();
    map.put('only', 1);
    expect([map.size, map.get('only'), map.has('only')]).toEqual([1, 1, true]);
    expect(map.delete('only')).toBe(true);
    expect([map.size, map.get('only'), map.has('only')]).toEqual([0, undefined, false]);
  });

  it('returns undefined for a missing key', () => {
    const map = new HashMap<number>();
    map.put('present', 1);
    expect(map.get('absent')).toBeUndefined();
    expect(map.has('absent')).toBe(false);
  });

  it('overwrites an existing key without growing', () => {
    const map = new HashMap<string>();
    map.put('k', 'old');
    map.put('k', 'new');
    expect(map.get('k')).toBe('new');
    expect(map.size).toBe(1);
  });

  it('stores falsy values, undefined values and the empty-string key', () => {
    const map = new HashMap<number | null | undefined>();
    map.put('', 0);
    map.put('null', null);
    map.put('undef', undefined);
    expect(map.get('')).toBe(0);
    expect(map.get('null')).toBeNull();
    expect(map.has('undef')).toBe(true);
    expect(map.size).toBe(3);
  });

  it('keeps colliding keys apart and deletes from the chain cleanly', () => {
    const map = new HashMap<number>(16, collide);
    for (let i = 0; i < 5; i++) map.put(`key${i}`, i);
    map.put('key2', 20);
    expect(map.get('key2')).toBe(20);
    expect(map.get('key9')).toBeUndefined();
    for (const victim of [0, 4, 2]) expect(map.delete(`key${victim}`)).toBe(true);
    expect(map.size).toBe(2);
    expect([map.get('key1'), map.get('key3')]).toEqual([1, 3]);
    expect([0, 2, 4].some((i) => map.has(`key${i}`))).toBe(false);
  });

  it('can put a key again after deleting it', () => {
    const map = new HashMap<number>();
    map.put('a', 1);
    map.delete('a');
    map.put('a', 2);
    expect(map.get('a')).toBe(2);
    expect(map.size).toBe(1);
  });

  it('handles a hash that returns negative numbers', () => {
    const map = new HashMap<number>(8, (key) => -1 - key.length);
    for (let i = 0; i < 20; i++) map.put('x'.repeat(i), i);
    for (let i = 0; i < 20; i++) expect(map.get('x'.repeat(i))).toBe(i);
    expect(map.delete('xxx')).toBe(true);
    expect(map.get('xxx')).toBeUndefined();
  });

  it('resizes to keep the load factor at or under 0.75, keeping every key', () => {
    const map = new HashMap<number>(4);
    for (let i = 0; i < 200; i++) {
      map.put(`k${i}`, i);
      expect(map.size / map.capacity).toBeLessThanOrEqual(0.75);
    }
    expect(map.size).toBe(200);
    for (let i = 0; i < 200; i++) expect(map.get(`k${i}`)).toBe(i);
  });

  it('does not grow on overwrites alone', () => {
    const map = new HashMap<number>(4);
    for (let i = 0; i < 50; i++) map.put('a', i);
    expect([map.capacity, map.size]).toEqual([4, 1]);
  });

  it('moves a key to its new bucket on resize', () => {
    const hashes: Record<string, number> = { ada: 17, bob: 6, cy: 13, di: 2 };
    const map = new HashMap<number>(4, (key) => hashes[key]);
    for (const key of Object.keys(hashes)) map.put(key, 0);
    expect(map.capacity).toBe(8);
    for (const key of Object.keys(hashes)) expect(map.has(key)).toBe(true);
  });

  it('doubling keeps total hash calls linear', () => {
    // Mechanism: growing by a constant instead of doubling rehashes
    // everything every few puts, which is quadratic in hash calls.
    let calls = 0;
    const n = 1000;
    const map = new HashMap<number>(8, (key) => {
      calls++;
      return Number(key);
    });
    for (let i = 0; i < n; i++) map.put(String(i), i);
    expect(calls).toBeLessThanOrEqual(4 * n);
  });

  it('matches a Map on random operations', () => {
    for (let seed = 0; seed < 50; seed++) {
      const rng = mulberry32(seed);
      const map = new HashMap<number>(2, (key) => Number(key) * 7 - 50);
      const ref = new Map<string, number>();
      for (let step = 0; step < 120; step++) {
        const key = String(Math.floor(rng() * 16));
        const op = Math.floor(rng() * 3);
        const where = `seed=${seed} step=${step} op=${op} key=${key}`;
        if (op === 0) {
          map.put(key, step);
          ref.set(key, step);
        } else if (op === 1) {
          expect(map.get(key), where).toBe(ref.get(key));
        } else {
          expect(map.delete(key), where).toBe(ref.delete(key));
        }
        expect(map.size, where).toBe(ref.size);
        expect(map.has(key), where).toBe(ref.has(key));
      }
    }
  });
});
