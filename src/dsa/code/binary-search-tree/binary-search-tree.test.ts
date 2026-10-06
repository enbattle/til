import { describe, expect, it } from 'vitest';
import {
  Node,
  contains,
  find,
  inOrder,
  insert,
  isValid,
  remove,
} from './binary-search-tree';

// The binary-search-tree entry's TypeScript code. API: `new Node(key)` with
// `left` and `right`; `insert(root, key)` and `remove(root, key)` return the
// (possibly new) root; `contains(root, key)`; `find(root, key)` returns
// [parent, node]; `inOrder(root)` yields keys ascending; `isValid(root)`
// checks the ordering rule against every ancestor.

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

const EXAMPLE = [50, 30, 70, 20, 40, 60, 80, 65];

type Shape = [number, Shape, Shape] | null;

function build(keys: number[]): Node | null {
  let root: Node | null = null;
  for (const key of keys) root = insert(root, key);
  return root;
}

const keysOf = (root: Node | null) => [...inOrder(root)];

function height(root: Node | null): number {
  let level = root === null ? [] : [root];
  let edges = -1;
  while (level.length > 0) {
    edges++;
    level = level.flatMap((n) => [n.left, n.right]).filter((c): c is Node => c !== null);
  }
  return edges;
}

function shape(node: Node | null): Shape {
  return node === null ? null : [node.key, shape(node.left), shape(node.right)];
}

const leaf = (k: number): Shape => [k, null, null];

describe('binary search tree', () => {
  it('handles the empty tree', () => {
    expect(keysOf(null)).toEqual([]);
    expect(contains(null, 5)).toBe(false);
    expect(remove(null, 5)).toBeNull();
    expect(isValid(null)).toBe(true);
    expect(find(null, 5)).toEqual([null, null]);
    expect(height(null)).toBe(-1);
  });

  it('handles a single node', () => {
    const root = insert(null, 7);
    expect(shape(root)).toEqual(leaf(7));
    expect(contains(root, 7)).toBe(true);
    expect(contains(root, 6)).toBe(false);
    expect(remove(root, 6)).toBe(root);
    expect(remove(root, 7)).toBeNull();
  });

  it('builds the running example', () => {
    const root = build(EXAMPLE);
    expect(shape(root)).toEqual([
      50,
      [30, leaf(20), leaf(40)],
      [70, [60, null, leaf(65)], leaf(80)],
    ]);
    expect(keysOf(root)).toEqual([20, 30, 40, 50, 60, 65, 70, 80]);
    expect(height(root)).toBe(3);
  });

  it('makes a chain from the same keys in sorted order', () => {
    const root = build([...EXAMPLE].sort((a, b) => a - b));
    expect(height(root)).toBe(EXAMPLE.length - 1);
  });

  it('find returns the parent', () => {
    const root = build(EXAMPLE);
    const [parent, node] = find(root, 65);
    expect([parent?.key, node?.key]).toEqual([60, 65]);
    expect(find(root, 50)[0]).toBeNull();
    const [p2, n2] = find(root, 66);
    expect([p2?.key, n2]).toEqual([65, null]);
  });

  it('finds present keys and misses absent ones', () => {
    const root = build(EXAMPLE);
    for (const key of EXAMPLE) expect(contains(root, key)).toBe(true);
    for (const key of [0, 25, 66, 100]) expect(contains(root, key)).toBe(false);
  });

  it('ignores a duplicate insert', () => {
    const root = build(EXAMPLE);
    const before = shape(root);
    expect(insert(root, 40)).toBe(root);
    expect(insert(root, 50)).toBe(root);
    expect(shape(root)).toEqual(before);
  });

  it('handles negative and zero keys', () => {
    const root = build([0, -5, 5, -10, 10]);
    expect(keysOf(root)).toEqual([-10, -5, 0, 5, 10]);
  });

  it('removes a leaf', () => {
    const root = remove(build(EXAMPLE), 20);
    expect(keysOf(root)).toEqual([30, 40, 50, 60, 65, 70, 80]);
    expect(root?.left?.left).toBeNull();
  });

  it('removes a node with one child', () => {
    const root = remove(build(EXAMPLE), 60);
    expect(keysOf(root)).toEqual([20, 30, 40, 50, 65, 70, 80]);
    expect(root?.right?.left?.key).toBe(65);
  });

  it('removes a node with two children using the successor', () => {
    const root = remove(build(EXAMPLE), 50);
    expect(shape(root)).toEqual([60, [30, leaf(20), leaf(40)], [70, leaf(65), leaf(80)]]);
  });

  it('removes when the successor is the right child', () => {
    const root = remove(build([50, 30, 70, 80]), 50);
    expect(shape(root)).toEqual([70, leaf(30), leaf(80)]);
  });

  it('removes a root with one child and ignores missing keys', () => {
    let root = build([10, 20]);
    expect(remove(root, 99)).toBe(root);
    root = remove(root, 10);
    expect(shape(root)).toEqual(leaf(20));
  });

  it('empties the tree one key at a time', () => {
    let root = build(EXAMPLE);
    for (const key of EXAMPLE) {
      root = remove(root, key);
      expect(isValid(root)).toBe(true);
    }
    expect(root).toBeNull();
  });

  it('survives a long chain without overflowing the stack', () => {
    const keys = Array.from({ length: 20000 }, (_, i) => i);
    let root: Node | null = null;
    // Building by repeated insert is quadratic; link the chain directly.
    let tail: Node | null = null;
    for (const key of keys) {
      const node = new Node(key);
      if (tail === null) root = node;
      else tail.right = node;
      tail = node;
    }
    expect(keysOf(root)).toEqual(keys);
    expect(isValid(root)).toBe(true);
  });

  it('isValid rejects a far-ancestor violation', () => {
    const root = new Node(50);
    root.left = new Node(30);
    root.left.right = new Node(60);
    expect(isValid(root)).toBe(false);
    root.left.right = new Node(40);
    expect(isValid(root)).toBe(true);
  });

  it('isValid rejects equal keys and swapped children', () => {
    let root = new Node(5);
    root.right = new Node(5);
    expect(isValid(root)).toBe(false);
    root = new Node(5);
    root.left = new Node(8);
    root.right = new Node(2);
    expect(isValid(root)).toBe(false);
  });

  it('matches a set under random inserts and removes', () => {
    const seed = 11;
    const next = rng(seed);
    for (let trial = 0; trial < 50; trial++) {
      let root: Node | null = null;
      const model = new Set<number>();
      for (let step = 0; step < 40; step++) {
        const key = Math.floor(next() * 26);
        if (next() < 0.6) {
          root = insert(root, key);
          model.add(key);
        } else {
          root = remove(root, key);
          model.delete(key);
        }
        const where = `seed=${seed} trial=${trial} step=${step} key=${key}`;
        expect(keysOf(root), where).toEqual([...model].sort((a, b) => a - b));
        expect(isValid(root), where).toBe(true);
        expect(contains(root, key), where).toBe(model.has(key));
      }
    }
  });
});

/** Replaces every key in the tree with a getter that logs which node was read. */
function spyOn(root: Node | null, reads: Set<Node>): void {
  if (root === null) return;
  let key = root.key;
  Object.defineProperty(root, 'key', {
    get() {
      reads.add(root);
      return key;
    },
    set(value: number) {
      key = value;
    },
  });
  spyOn(root.left, reads);
  spyOn(root.right, reads);
}

function perfectTree(): { root: Node; reads: Set<Node> } {
  const root = build([8, 4, 12, 2, 6, 10, 14, 1, 3, 5, 7, 9, 11, 13, 15]) as Node;
  expect(height(root)).toBe(3);
  const reads = new Set<Node>();
  spyOn(root, reads);
  return { root, reads };
}

describe('binary search tree mechanism', () => {
  it('a lookup visits only the nodes on one path', () => {
    const { root, reads } = perfectTree();
    // Exactly depth + 1: more means it wandered, fewer means it didn't search.
    const depths: Record<number, number> = {
      8: 0,
      4: 1,
      12: 1,
      2: 2,
      10: 2,
      1: 3,
      7: 3,
      15: 3,
    };
    for (const [key, depth] of Object.entries(depths)) {
      reads.clear();
      contains(root, Number(key));
      expect(reads.size, `key ${key}`).toBe(depth + 1);
    }
    for (const key of [0, 16]) {
      reads.clear();
      contains(root, key);
      expect(reads.size, `key ${key}`).toBe(4);
    }
  });

  it('insert stays on one path', () => {
    const { root, reads } = perfectTree();
    insert(root, 16);
    expect(reads.size).toBe(4);
  });

  it('remove stays on one path', () => {
    for (const key of [1, 8, 12]) {
      const { root, reads } = perfectTree();
      remove(root, key);
      expect(reads.size, `key ${key}`).toBeLessThanOrEqual(4);
    }
  });

  it('inOrder visits every node once', () => {
    const { root, reads } = perfectTree();
    expect(keysOf(root)).toHaveLength(15);
    expect(reads.size).toBe(15);
  });
});
