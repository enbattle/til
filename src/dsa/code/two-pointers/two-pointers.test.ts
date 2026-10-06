import { describe, expect, it } from 'vitest';
import { ListNode, hasCycle, pairWithSum } from './two-pointers';

// The two-pointers entry's TypeScript code. API: `pairWithSum(nums, target)`
// returns indices [i, j], i < j, of two values in sorted `nums` that add up to
// `target`, or null; `hasCycle(head)` says whether a ListNode chain loops back
// on itself.

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

/** Nodes holding `values`, linked in order; the last links to nodes[loopTo]. */
function chain(values: number[], loopTo?: number): ListNode[] {
  const nodes = values.map((v) => new ListNode(v));
  nodes.forEach((node, i) => {
    if (i + 1 < nodes.length) node.next = nodes[i + 1];
  });
  if (loopTo !== undefined) nodes[nodes.length - 1].next = nodes[loopTo];
  return nodes;
}

const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i);

function hasPair(nums: number[], target: number): boolean {
  for (let i = 0; i < nums.length; i++)
    for (let j = i + 1; j < nums.length; j++)
      if (nums[i] + nums[j] === target) return true;
  return false;
}

/** Counts reads by index. */
function counted(items: number[]): { nums: number[]; reads: () => number } {
  let reads = 0;
  const nums = new Proxy(items, {
    get(target, key, receiver) {
      if (typeof key === 'string' && /^\d+$/.test(key)) reads++;
      return Reflect.get(target, key, receiver);
    },
  });
  return { nums, reads: () => reads };
}

describe('pairWithSum (TypeScript)', () => {
  it('finds the running example pair', () => {
    const nums = [1, 3, 4, 6, 8, 11];
    expect(pairWithSum(nums, 10)).toEqual([2, 3]);
    expect(pairWithSum(nums, 12)).toEqual([0, 5]);
    expect(pairWithSum(nums, 100)).toBeNull();
  });

  it('has no pair in an empty or one-element array', () => {
    expect(pairWithSum([], 0)).toBeNull();
    expect(pairWithSum([3], 6)).toBeNull();
    expect(pairWithSum([3], 3)).toBeNull();
  });

  it('handles two elements', () => {
    expect(pairWithSum([1, 2], 3)).toEqual([0, 1]);
    expect(pairWithSum([1, 2], 4)).toBeNull();
  });

  it('pairs duplicates at two different positions', () => {
    expect(pairWithSum([2, 2], 4)).toEqual([0, 1]);
    expect(pairWithSum([1, 2, 2, 5], 4)).toEqual([1, 2]);
    expect(pairWithSum([2, 3], 4)).toBeNull();
  });

  it('handles negative numbers and zero', () => {
    expect(pairWithSum([-5, -2, 0, 3, 7], 5)).toEqual([1, 4]);
    expect(pairWithSum([-3, 0, 3], 0)).toEqual([0, 2]);
  });

  it('matches brute force on 50 seeded arrays', () => {
    const seed = 11;
    const random = rng(seed);
    for (let trial = 0; trial < 50; trial++) {
      const length = Math.floor(random() * 10);
      const nums = Array.from({ length }, () => Math.floor(random() * 17) - 8).sort(
        (a, b) => a - b,
      );
      const target = Math.floor(random() * 25) - 12;
      const got = pairWithSum(nums, target);
      const where = `seed ${seed}, trial ${trial}: ${JSON.stringify(nums)} target ${target} -> ${got}`;
      if (hasPair(nums, target)) {
        expect(got, where).not.toBeNull();
        const [i, j] = got!;
        expect(0 <= i && i < j && j < nums.length, where).toBe(true);
        expect(nums[i] + nums[j], where).toBe(target);
      } else {
        expect(got, where).toBeNull();
      }
    }
  });

  it('reads two values per pass, one pass per element dropped', () => {
    // Trying every pair would read about n * n times.
    const high = counted(range(1000));
    expect(pairWithSum(high.nums, 1e6)).toBeNull();
    expect(high.reads()).toBe(2 * 999);
    const low = counted(range(1000));
    expect(pairWithSum(low.nums, -1)).toBeNull();
    expect(low.reads()).toBe(2 * 999);
  });
});

describe('hasCycle (TypeScript)', () => {
  it('handles small cases', () => {
    expect(hasCycle(null)).toBe(false);
    expect(hasCycle(chain([1])[0])).toBe(false);
    expect(hasCycle(chain([1], 0)[0])).toBe(true);
    expect(hasCycle(chain([1, 2])[0])).toBe(false);
    expect(hasCycle(chain([1, 2], 0)[0])).toBe(true);
    expect(hasCycle(chain([1, 2], 1)[0])).toBe(true);
  });

  it('handles the running example', () => {
    // Seven nodes, the last linking back to node 2: a tail of 2, a cycle of 5.
    expect(hasCycle(chain(range(7), 2)[0])).toBe(true);
    expect(hasCycle(chain(range(7))[0])).toBe(false);
  });

  it('ends on odd and even lengths without a cycle', () => {
    for (let n = 1; n < 12; n++) expect(hasCycle(chain(range(n))[0]), `${n}`).toBe(false);
  });

  it('finds a cycle that is the whole list', () => {
    for (let n = 1; n < 12; n++)
      expect(hasCycle(chain(range(n), 0)[0]), `${n}`).toBe(true);
  });

  it('compares nodes, not values', () => {
    const same = chain([1000, 1000, 1000, 1000, 1000]);
    expect(hasCycle(same[0])).toBe(false);
    same[4].next = same[1];
    expect(hasCycle(same[0])).toBe(true);
  });

  it('matches the known shape on 50 seeded lists', () => {
    const seed = 12;
    const random = rng(seed);
    for (let trial = 0; trial < 50; trial++) {
      const n = 1 + Math.floor(random() * 14);
      const pick = Math.floor(random() * (n + 1));
      const loopTo = pick === n ? undefined : pick;
      const values = Array.from({ length: n }, () => Math.floor(random() * 3));
      expect(
        hasCycle(chain(values, loopTo)[0]),
        `seed ${seed}, trial ${trial}: ${n} ${loopTo}`,
      ).toBe(loopTo !== undefined);
    }
  });

  it('follows only a few links per node', () => {
    const n = 1000;
    const nodes = chain(range(n), 1);
    let follows = 0;
    nodes.forEach((node) => {
      let link = node.next;
      Object.defineProperty(node, 'next', {
        get() {
          follows++;
          return link;
        },
        set(value) {
          link = value;
        },
      });
    });
    expect(hasCycle(nodes[0])).toBe(true);
    // A tail of 1 and a cycle of n - 1: slow and fast meet on step n - 1, and
    // each step follows at least 3 links (fast.next twice over, slow.next).
    // A one-pass visited set follows at most 2 per node, 2n + 2 in all.
    expect(follows, `follows=${follows}`).toBeGreaterThanOrEqual(3 * (n - 1));
    expect(follows, `follows=${follows}`).toBeLessThanOrEqual(6 * n);
  });
});
