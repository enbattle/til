import { describe, expect, it } from 'vitest';
import { HashMap, hashCode } from './hash-map';

// API: `new HashMap(capacity = 8)` with string keys and number values; `put`,
// `get(key, defaultValue)`, `contains`, `delete`, `size()`, `capacity()`.
// `hashCode(key)` is the hash function.

/** Eight different keys with the same hash: "Aa" and "BB" hash alike. */
function collidingKeys(): string[] {
  let keys = [''];
  for (let round = 0; round < 3; round++) {
    const next: string[] = [];
    for (const k of keys) {
      next.push(k + 'Aa');
      next.push(k + 'BB');
    }
    keys = next;
  }
  return keys;
}

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
  it('has colliding keys that really collide', () => {
    const keys = collidingKeys();
    expect(new Set(keys).size).toBe(8);
    expect(new Set(keys.map(hashCode)).size).toBe(1);
  });

  it('hashes small, stable and order-sensitive', () => {
    expect(hashCode('')).toBe(0);
    expect(hashCode('ab')).toBe(97 * 31 + 98);
    expect(hashCode('ab')).not.toBe(hashCode('ba'));
    expect(hashCode('z'.repeat(500))).toBeGreaterThanOrEqual(0);
  });

  it('starts empty with the capacity it was given', () => {
    const map = new HashMap(4);
    expect(map.size()).toBe(0);
    expect(map.capacity()).toBe(4);
    expect(map.get('a', -1)).toBe(-1);
    expect(map.contains('a')).toBe(false);
    expect(map.delete('a')).toBe(false);
  });

  it('holds one entry', () => {
    const map = new HashMap();
    map.put('only', 1);
    expect([map.size(), map.get('only', -1), map.contains('only')]).toEqual([1, 1, true]);
    expect(map.delete('only')).toBe(true);
    expect([map.size(), map.get('only', -1), map.contains('only')]).toEqual([
      0,
      -1,
      false,
    ]);
  });

  it('returns the default for a missing key', () => {
    const map = new HashMap();
    map.put('present', 1);
    expect(map.get('absent', -1)).toBe(-1);
    expect(map.get('absent', 99)).toBe(99);
    expect(map.contains('absent')).toBe(false);
  });

  it('overwrites an existing key without growing', () => {
    const map = new HashMap();
    map.put('k', 1);
    map.put('k', 2);
    expect(map.get('k', -1)).toBe(2);
    expect(map.size()).toBe(1);
  });

  it('stores zero and the empty-string key', () => {
    const map = new HashMap();
    map.put('', 0);
    map.put('zero', 0);
    expect(map.get('', -1)).toBe(0);
    expect(map.contains('zero')).toBe(true);
    expect(map.size()).toBe(2);
  });

  it('contains sees a value equal to the default', () => {
    const map = new HashMap();
    map.put('k', -1);
    expect(map.get('k', -1)).toBe(map.get('missing', -1));
    expect(map.contains('k')).toBe(true);
    expect(map.contains('missing')).toBe(false);
  });

  it('keeps colliding keys apart and deletes from the chain cleanly', () => {
    const keys = collidingKeys();
    const map = new HashMap(16);
    for (let i = 0; i < keys.length; i++) {
      map.put(keys[i], i);
    }
    map.put(keys[2], 20);
    expect(map.get(keys[2], -1)).toBe(20);
    expect(map.get('Aax', -1)).toBe(-1);
    // First, last (swaps with itself) and middle of the chain.
    for (const victim of [0, 7, 2]) {
      expect(map.delete(keys[victim])).toBe(true);
    }
    expect(map.size()).toBe(5);
    for (const i of [1, 3, 4, 5, 6]) {
      expect(map.get(keys[i], -1)).toBe(i);
    }
    for (const i of [0, 2, 7]) {
      expect(map.contains(keys[i])).toBe(false);
    }
  });

  it('can put a key again after deleting it', () => {
    const map = new HashMap();
    map.put('a', 1);
    map.delete('a');
    map.put('a', 2);
    expect(map.get('a', -1)).toBe(2);
    expect(map.size()).toBe(1);
  });

  it('resizes to keep the load factor at or under 0.75, keeping every key', () => {
    const map = new HashMap(4);
    for (let i = 0; i < 200; i++) {
      map.put('k' + i, i);
      expect(map.size() / map.capacity()).toBeLessThanOrEqual(0.75);
    }
    expect(map.size()).toBe(200);
    for (let i = 0; i < 200; i++) {
      expect(map.get('k' + i, -1)).toBe(i);
    }
  });

  it('does not grow on overwrites alone', () => {
    const map = new HashMap(4);
    for (let i = 0; i < 50; i++) {
      map.put('a', i);
    }
    expect([map.capacity(), map.size()]).toEqual([4, 1]);
  });

  it('doubles the capacity as it grows', () => {
    // Growing by a constant instead of doubling makes the total resize work
    // quadratic; doubling from 8 reaches exactly 2048 for 1000 entries.
    const map = new HashMap(8);
    for (let i = 0; i < 1000; i++) {
      map.put('k' + i, i);
    }
    expect(map.capacity()).toBe(2048);
  });

  it('matches a Map on random operations', () => {
    for (let seed = 0; seed < 50; seed++) {
      const rng = mulberry32(seed);
      const map = new HashMap(2);
      const ref = new Map<string, number>();
      for (let step = 0; step < 120; step++) {
        const key = 'key' + Math.floor(rng() * 16);
        const op = Math.floor(rng() * 3);
        const where = `seed=${seed} step=${step} op=${op} key=${key}`;
        if (op === 0) {
          map.put(key, step);
          ref.set(key, step);
        } else if (op === 1) {
          const expected = ref.has(key) ? ref.get(key) : -1;
          expect(map.get(key, -1), where).toBe(expected);
        } else {
          expect(map.delete(key), where).toBe(ref.delete(key));
        }
        expect(map.size(), where).toBe(ref.size);
        expect(map.contains(key), where).toBe(ref.has(key));
      }
    }
  });
});
