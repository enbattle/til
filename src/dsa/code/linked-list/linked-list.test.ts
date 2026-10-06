import { describe, expect, it } from 'vitest';
import { LinkedList, type ListNode } from './linked-list';

// The linked-list entry's TypeScript code. API: `new LinkedList<T>()` with
// `head` and `tail` (nodes or null), `pushFront`, `pushBack`, `popFront`
// (undefined when empty), `remove` (the first occurrence; returns whether it
// was there), `reverse` (in place) and iteration from head to tail.

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

function build<T>(values: T[]): LinkedList<T> {
  const list = new LinkedList<T>();
  for (const value of values) list.pushBack(value);
  return list;
}

function nodes<T>(list: LinkedList<T>): ListNode<T>[] {
  const out: ListNode<T>[] = [];
  for (let node = list.head; node !== null; node = node.next) out.push(node);
  return out;
}

function expectConsistent<T>(list: LinkedList<T>, model: T[], message = ''): void {
  expect([...list], message).toEqual(model);
  const chain = nodes(list);
  if (model.length > 0) {
    expect(list.tail, message).toBe(chain[chain.length - 1]);
    expect(list.tail?.next, message).toBeNull();
  } else {
    expect(list.head, message).toBeNull();
    expect(list.tail, message).toBeNull();
  }
}

describe('LinkedList', () => {
  it('handles the empty list', () => {
    const list = new LinkedList<number>();
    expect(list.popFront()).toBeUndefined();
    expect(list.remove(1)).toBe(false);
    list.reverse();
    expectConsistent(list, []);
  });

  it('makes one node both ends', () => {
    const a = new LinkedList<number>();
    a.pushBack(5);
    const b = new LinkedList<number>();
    b.pushFront(5);
    for (const list of [a, b]) {
      expect(list.head).toBe(list.tail);
      expectConsistent(list, [5]);
    }
  });

  it('orders pushes at both ends', () => {
    const list = build([1, 2, 3]);
    list.pushFront(0);
    list.pushBack(4);
    expectConsistent(list, [0, 1, 2, 3, 4]);
  });

  it('pops to empty, then accepts a push at the back', () => {
    const list = build([1, 2]);
    expect(list.popFront()).toBe(1);
    expect(list.popFront()).toBe(2);
    expectConsistent(list, []);
    list.pushBack(9);
    expectConsistent(list, [9]);
  });

  it('removes the head, middle, tail, only node and a missing value', () => {
    const list = build([1, 2, 3]);
    expect(list.remove(3)).toBe(true);
    list.pushBack(4);
    expectConsistent(list, [1, 2, 4]);
    expect(list.remove(1)).toBe(true);
    expectConsistent(list, [2, 4]);
    expect(list.remove(7)).toBe(false);
    expect(list.remove(2)).toBe(true);
    expect(list.remove(4)).toBe(true);
    expectConsistent(list, []);
    list.pushFront(8);
    expectConsistent(list, [8]);
  });

  it('removes only the first duplicate', () => {
    const list = build([2, 1, 2, 2]);
    expect(list.remove(2)).toBe(true);
    expectConsistent(list, [1, 2, 2]);
  });

  it('reverses empty, single, pair and longer lists', () => {
    for (const values of [[], [1], [1, 2], [1, 2, 3, 4]]) {
      const list = build(values);
      list.reverse();
      expectConsistent(list, [...values].reverse(), values.join());
    }
    const list = build([0, 1, 2]);
    list.reverse();
    list.pushBack(99);
    expectConsistent(list, [2, 1, 0, 99]);
  });

  it('pushes through the tail instead of walking from the head', () => {
    // Cut the chain after the head without touching the tail. A pushBack that
    // walked from head would attach to the head; the tail pointer attaches
    // after the old last node.
    const list = build([1, 2, 3]);
    list.head!.next = null;
    list.pushBack(4);
    expect(list.head!.next).toBeNull();
    expect(list.tail!.value).toBe(4);
  });

  it('reverses by flipping arrows, not by copying nodes', () => {
    const list = build([0, 1, 2, 3, 4, 5]);
    const before = nodes(list);
    list.reverse();
    const after = nodes(list);
    expect(after.length).toBe(before.length);
    after.forEach((node, i) => expect(node).toBe(before[before.length - 1 - i]));
  });

  it('matches an array model over seeded random operations', () => {
    const seed = 11;
    const random = seeded(seed);
    const pick = (n: number) => Math.floor(random() * n);
    const ops = ['front', 'back', 'pop', 'remove', 'reverse'];
    for (let trial = 0; trial < 50; trial++) {
      const list = new LinkedList<number>();
      const model: number[] = [];
      for (let step = 0; step < 30; step++) {
        const op = ops[pick(ops.length)];
        const value = pick(6);
        const where = `seed=${seed} trial=${trial} step=${step}`;
        if (op === 'front') {
          list.pushFront(value);
          model.unshift(value);
        } else if (op === 'back') {
          list.pushBack(value);
          model.push(value);
        } else if (op === 'pop' && model.length > 0) {
          expect(list.popFront(), where).toBe(model.shift());
        } else if (op === 'remove') {
          const at = model.indexOf(value);
          expect(list.remove(value), where).toBe(at >= 0);
          if (at >= 0) model.splice(at, 1);
        } else if (op === 'reverse') {
          list.reverse();
          model.reverse();
        }
        expectConsistent(list, model, where);
      }
    }
  });
});
