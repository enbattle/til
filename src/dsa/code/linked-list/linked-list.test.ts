import { describe, expect, it } from 'vitest';
import { LinkedList } from './linked-list';

// The linked-list entry's TypeScript code. API: `new LinkedList<T>(values = [])`
// with `pushFront`, `pushBack`, `popFront` (undefined when empty), `find` (the
// first node holding the value, or null), `remove` (the first occurrence;
// returns whether it was there), `reverse` (in place), `size` and iteration.

/** A small seeded generator (mulberry32), so a failing sequence can be replayed. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('LinkedList (TypeScript)', () => {
  it('starts empty', () => {
    const list = new LinkedList<number>();
    expect(list.size).toBe(0);
    expect([...list]).toEqual([]);
    expect(list.find(1)).toBeNull();
  });

  it('builds from an iterable in order', () => {
    const list = new LinkedList([1, 2, 3]);
    expect([...list]).toEqual([1, 2, 3]);
    expect(list.size).toBe(3);
  });

  it('pushes at both ends', () => {
    const list = new LinkedList<number>();
    list.pushBack(2);
    list.pushFront(1);
    list.pushBack(3);
    list.pushFront(0);
    expect([...list]).toEqual([0, 1, 2, 3]);
    expect(list.size).toBe(4);
  });

  it('sets the tail when pushing at the front of an empty list', () => {
    const list = new LinkedList<number>();
    list.pushFront(1);
    list.pushBack(2);
    expect([...list]).toEqual([1, 2]);
  });

  it('pops from the front in order', () => {
    const list = new LinkedList([1, 2, 3]);
    expect(list.popFront()).toBe(1);
    expect(list.popFront()).toBe(2);
    expect([...list]).toEqual([3]);
    expect(list.size).toBe(1);
  });

  it('returns undefined when popping an empty list', () => {
    const list = new LinkedList<number>();
    expect(list.popFront()).toBeUndefined();
    expect(list.size).toBe(0);
  });

  it('clears the tail when popping the last node', () => {
    const list = new LinkedList([1]);
    expect(list.popFront()).toBe(1);
    expect(list.size).toBe(0);
    expect(list.popFront()).toBeUndefined();
    list.pushBack(2);
    list.pushBack(3);
    expect([...list]).toEqual([2, 3]);
  });

  it('finds the first matching node', () => {
    const list = new LinkedList([5, 7, 5]);
    const node = list.find(5);
    expect(node?.value).toBe(5);
    expect(node?.next?.value).toBe(7);
    expect(list.find(9)).toBeNull();
  });

  it('stores falsy values and null', () => {
    const list = new LinkedList<number | string | null>([0, null, '']);
    expect(list.size).toBe(3);
    expect(list.find(null)?.value).toBeNull();
    expect(list.remove(null)).toBe(true);
    expect([...list]).toEqual([0, '']);
  });

  it('removes the head', () => {
    const list = new LinkedList([1, 2, 3]);
    expect(list.remove(1)).toBe(true);
    expect([...list]).toEqual([2, 3]);
    expect(list.size).toBe(2);
  });

  it('removes a middle value', () => {
    const list = new LinkedList([1, 2, 3]);
    expect(list.remove(2)).toBe(true);
    expect([...list]).toEqual([1, 3]);
  });

  it('moves the tail back when removing the tail', () => {
    const list = new LinkedList([1, 2, 3]);
    expect(list.remove(3)).toBe(true);
    list.pushBack(4);
    expect([...list]).toEqual([1, 2, 4]);
    expect(list.size).toBe(3);
  });

  it('empties the list when removing the only node', () => {
    const list = new LinkedList([1]);
    expect(list.remove(1)).toBe(true);
    expect([...list]).toEqual([]);
    expect(list.size).toBe(0);
    list.pushBack(2);
    list.pushFront(1);
    expect([...list]).toEqual([1, 2]);
  });

  it('removes only the first duplicate', () => {
    const list = new LinkedList([4, 1, 4, 4]);
    expect(list.remove(4)).toBe(true);
    expect([...list]).toEqual([1, 4, 4]);
  });

  it('changes nothing when removing an absent value', () => {
    const list = new LinkedList([1, 2, 3]);
    expect(list.remove(9)).toBe(false);
    expect([...list]).toEqual([1, 2, 3]);
    expect(list.size).toBe(3);
    expect(new LinkedList<number>().remove(1)).toBe(false);
    list.pushBack(4);
    expect([...list]).toEqual([1, 2, 3, 4]);
  });

  it.each([0, 1, 2, 3, 5])('reverses a list of %i nodes', (n) => {
    const values = Array.from({ length: n }, (_, i) => i);
    const list = new LinkedList(values);
    list.reverse();
    expect([...list]).toEqual([...values].reverse());
    expect(list.size).toBe(n);
    list.pushBack(99);
    list.pushFront(-1);
    expect([...list]).toEqual([-1, ...[...values].reverse(), 99]);
  });

  it('restores the order when reversed twice', () => {
    const list = new LinkedList([1, 2, 3, 4]);
    list.reverse();
    list.reverse();
    expect([...list]).toEqual([1, 2, 3, 4]);
    expect(list.popFront()).toBe(1);
    list.pushBack(5);
    expect([...list]).toEqual([2, 3, 4, 5]);
  });

  it('matches an array on 50 seeded random operation sequences', () => {
    const ops = ['pushFront', 'pushBack', 'popFront', 'remove', 'find', 'reverse'];
    for (let seed = 0; seed < 50; seed++) {
      const random = seeded(seed);
      const list = new LinkedList<number>();
      const model: number[] = [];
      for (let step = 0; step < 60; step++) {
        const op = ops[Math.floor(random() * ops.length)];
        const value = Math.floor(random() * 6);
        const at = `seed ${seed}, step ${step}: ${op}(${value})`;
        if (op === 'pushFront') {
          list.pushFront(value);
          model.unshift(value);
        } else if (op === 'pushBack') {
          list.pushBack(value);
          model.push(value);
        } else if (op === 'popFront') {
          expect(list.popFront(), at).toBe(model.shift());
        } else if (op === 'remove') {
          const i = model.indexOf(value);
          if (i !== -1) model.splice(i, 1);
          expect(list.remove(value), at).toBe(i !== -1);
        } else if (op === 'find') {
          expect(list.find(value) !== null, at).toBe(model.includes(value));
        } else {
          list.reverse();
          model.reverse();
        }
        expect([...list], at).toEqual(model);
        expect(list.size, at).toBe(model.length);
      }
    }
  });
});
