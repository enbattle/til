import { describe, expect, it } from 'vitest';
import { ListNode, cycleStart, hasCycle, middleNode } from './fast-slow-pointers';

// Lists are built by `build(n, cycleTo)`: n nodes with values 0..n-1, whose last
// node links back to node `cycleTo` (or ends the list when it is null).
function build(n: number, cycleTo: number | null = null): ListNode[] {
  const nodes = Array.from({ length: n }, (_, i) => new ListNode(i));
  for (let i = 0; i + 1 < n; i++) nodes[i].next = nodes[i + 1];
  if (n > 0 && cycleTo !== null) nodes[n - 1].next = nodes[cycleTo];
  return nodes;
}

const headOf = (nodes: ListNode[]): ListNode | null => nodes[0] ?? null;

function referenceCycleStart(head: ListNode | null): ListNode | null {
  const seen = new Set<ListNode>();
  for (let node = head; node !== null; node = node.next) {
    if (seen.has(node)) return node;
    seen.add(node);
  }
  return null;
}

describe('middleNode (TypeScript)', () => {
  it('returns the middle of odd and even lists', () => {
    expect(middleNode(headOf(build(5)))!.val).toBe(2);
    expect(middleNode(headOf(build(4)))!.val).toBe(2);
    expect(middleNode(headOf(build(2)))!.val).toBe(1);
  });

  it('handles an empty list and a single node', () => {
    expect(middleNode(null)).toBeNull();
    const nodes = build(1);
    expect(middleNode(nodes[0])).toBe(nodes[0]);
  });
});

describe('hasCycle and cycleStart (TypeScript)', () => {
  it('finds no cycle in a list that ends', () => {
    expect(hasCycle(null)).toBe(false);
    expect(cycleStart(null)).toBeNull();
    for (let n = 1; n < 8; n++) {
      const head = headOf(build(n));
      expect(hasCycle(head)).toBe(false);
      expect(cycleStart(head)).toBeNull();
    }
  });

  it('handles a self-loop on a single node', () => {
    const nodes = build(1, 0);
    expect(hasCycle(nodes[0])).toBe(true);
    expect(cycleStart(nodes[0])).toBe(nodes[0]);
  });

  it('handles a cycle through the whole list', () => {
    const nodes = build(5, 0);
    expect(hasCycle(nodes[0])).toBe(true);
    expect(cycleStart(nodes[0])).toBe(nodes[0]);
  });

  it('handles a cycle only at the last node', () => {
    const nodes = build(6, 5);
    expect(cycleStart(nodes[0])).toBe(nodes[5]);
  });

  it('matches the worked example from the entry', () => {
    const nodes = build(7, 2);
    expect(hasCycle(nodes[0])).toBe(true);
    expect(cycleStart(nodes[0])).toBe(nodes[2]);
  });

  it('handles a two-node cycle after a tail', () => {
    const nodes = build(4, 2);
    expect(cycleStart(nodes[0])).toBe(nodes[2]);
  });

  it('works for every cycle position in every length', () => {
    for (let n = 1; n < 12; n++) {
      for (let k = 0; k < n; k++) {
        const nodes = build(n, k);
        expect(hasCycle(nodes[0])).toBe(true);
        expect(cycleStart(nodes[0])).toBe(nodes[k]);
      }
    }
  });

  it('agrees with a visited set on many seeded random lists', () => {
    let seed = 11;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let round = 0; round < 50; round++) {
      const n = Math.floor(random() * 16);
      const cycleTo = n > 0 && random() < 0.6 ? Math.floor(random() * n) : null;
      const at = `seed 11, trial ${round}: build(${n}, ${cycleTo})`;
      const nodes = build(n, cycleTo);
      const head = headOf(nodes);
      const expected = referenceCycleStart(head);
      expect(cycleStart(head), at).toBe(expected);
      expect(hasCycle(head), at).toBe(expected !== null);
      if (cycleTo === null) {
        expect(middleNode(head), at).toBe(n > 0 ? nodes[Math.floor(n / 2)] : null);
      }
    }
  });
});
