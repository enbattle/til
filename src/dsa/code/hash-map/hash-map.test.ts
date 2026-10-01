import { describe, expect, it } from 'vitest';
import { HashMap } from './hash-map';

// docs/specs/dsa-tab.md, criterion 12: the hash-map entry's TypeScript code.
// API: `new HashMap<V>(capacity = 8, hash = <default string hash>)` with
// string keys; `put`, `get`, `has`, `delete`, `size`, `capacity`.

/** A hash that sends every key to the same bucket. */
const collide = () => 0;

describe('HashMap (TypeScript)', () => {
  it('starts empty with the capacity it was given', () => {
    const map = new HashMap<number>(4);
    expect(map.size).toBe(0);
    expect(map.capacity).toBe(4);
    expect(map.get('a')).toBeUndefined();
    expect(map.has('a')).toBe(false);
  });

  it('defaults to a positive capacity', () => {
    expect(new HashMap<number>().capacity).toBeGreaterThan(0);
  });

  it('puts and gets values', () => {
    const map = new HashMap<number>();
    map.put('one', 1);
    map.put('two', 2);
    expect(map.get('one')).toBe(1);
    expect(map.get('two')).toBe(2);
    expect(map.has('one')).toBe(true);
    expect(map.size).toBe(2);
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

  it('stores falsy values and the empty-string key', () => {
    const map = new HashMap<number | null>();
    map.put('', 0);
    map.put('zero', 0);
    map.put('null', null);
    expect(map.get('')).toBe(0);
    expect(map.has('')).toBe(true);
    expect(map.get('zero')).toBe(0);
    expect(map.get('null')).toBeNull();
    expect(map.has('null')).toBe(true);
    expect(map.size).toBe(3);
  });

  it('keeps colliding keys apart in one bucket', () => {
    const map = new HashMap<number>(8, collide);
    for (let i = 0; i < 5; i++) map.put(`key${i}`, i);
    for (let i = 0; i < 5; i++) expect(map.get(`key${i}`)).toBe(i);
    expect(map.get('key9')).toBeUndefined();
    map.put('key2', 20);
    expect(map.get('key2')).toBe(20);
    expect(map.size).toBe(5);
  });

  it('deletes a key and reports whether it was there', () => {
    const map = new HashMap<number>();
    map.put('a', 1);
    map.put('b', 2);
    expect(map.delete('a')).toBe(true);
    expect(map.get('a')).toBeUndefined();
    expect(map.has('a')).toBe(false);
    expect(map.get('b')).toBe(2);
    expect(map.size).toBe(1);
    expect(map.delete('a')).toBe(false);
    expect(map.delete('never')).toBe(false);
    expect(map.size).toBe(1);
  });

  it.each([0, 2, 4])(
    'deletes entry %i of a five-key collision chain and keeps the rest',
    (victim) => {
      const map = new HashMap<number>(16, collide);
      for (let i = 0; i < 5; i++) map.put(`key${i}`, i);
      expect(map.delete(`key${victim}`)).toBe(true);
      expect(map.size).toBe(4);
      for (let i = 0; i < 5; i++) {
        expect(map.get(`key${i}`)).toBe(i === victim ? undefined : i);
      }
    },
  );

  it('can put a key again after deleting it', () => {
    const map = new HashMap<number>();
    map.put('a', 1);
    map.delete('a');
    map.put('a', 2);
    expect(map.get('a')).toBe(2);
    expect(map.size).toBe(1);
  });

  it('resizes to keep the load factor at or under 0.75, keeping every key', () => {
    const map = new HashMap<number>(4);
    for (let i = 0; i < 200; i++) {
      map.put(`k${i}`, i);
      expect(map.size / map.capacity).toBeLessThanOrEqual(0.75);
    }
    expect(map.capacity).toBeGreaterThan(4);
    expect(map.size).toBe(200);
    for (let i = 0; i < 200; i++) expect(map.get(`k${i}`)).toBe(i);
  });

  it('rehashes into the new buckets on resize (a custom hash still finds keys)', () => {
    const map = new HashMap<number>(2, (key) => key.length * 7919);
    const keys = ['a', 'bb', 'ccc', 'dddd', 'eeeee', 'ffffff', 'ggggggg', 'hh'];
    keys.forEach((k, i) => map.put(k, i));
    expect(map.capacity).toBeGreaterThan(2);
    keys.forEach((k, i) => expect(map.get(k)).toBe(i));
  });

  it('handles a hash that returns negative numbers', () => {
    const map = new HashMap<number>(8, (key) => -1 - key.length);
    for (let i = 0; i < 20; i++) map.put('x'.repeat(i), i);
    for (let i = 0; i < 20; i++) expect(map.get('x'.repeat(i))).toBe(i);
    expect(map.delete('xxx')).toBe(true);
    expect(map.get('xxx')).toBeUndefined();
  });

  it('does not grow on overwrites alone', () => {
    const map = new HashMap<number>(4);
    map.put('a', 1);
    for (let i = 0; i < 50; i++) map.put('a', i);
    expect(map.capacity).toBe(4);
    expect(map.size).toBe(1);
  });
});
