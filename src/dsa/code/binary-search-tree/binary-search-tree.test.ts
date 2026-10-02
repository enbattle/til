import { describe, expect, it } from 'vitest';
import { BinarySearchTree, TreeNode } from './binary-search-tree';

// The binary-search-tree entry's TypeScript code.
// API: `new BinarySearchTree(keys = [])` with `insert` and `delete` (each returns
// whether the tree changed), `has`, `size`, `min()` and `max()` (undefined when
// empty), iteration in ascending order, `keysBetween(lo, hi)` (inclusive) and
// `height()` (edges on the longest root-to-leaf path, -1 when empty).

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

function rootOf(tree: BinarySearchTree): TreeNode | null {
  return (tree as unknown as { root: TreeNode | null }).root;
}

/** The tree holds exactly `expected` and the BST invariant holds. */
function check(tree: BinarySearchTree, expected: Iterable<number>): void {
  const sorted = [...expected].sort((a, b) => a - b);
  expect([...tree]).toEqual(sorted);
  expect(tree.size).toBe(sorted.length);
  for (const key of sorted) expect(tree.has(key)).toBe(true);
  let nodes = 0;
  const stack: [TreeNode | null, number, number][] = [
    [rootOf(tree), -Infinity, Infinity],
  ];
  while (stack.length > 0) {
    const [node, low, high] = stack.pop()!;
    if (node === null) continue;
    nodes++;
    expect(node.key > low && node.key < high).toBe(true);
    stack.push([node.left, low, node.key], [node.right, node.key, high]);
  }
  expect(nodes).toBe(sorted.length);
}

const EXAMPLE = [50, 30, 70, 20, 40, 60, 80, 65];

describe('BinarySearchTree (TypeScript)', () => {
  it('handles the empty tree', () => {
    const tree = new BinarySearchTree();
    expect(tree.size).toBe(0);
    expect([...tree]).toEqual([]);
    expect(tree.has(5)).toBe(false);
    expect(tree.keysBetween(0, 10)).toEqual([]);
    expect(tree.height()).toBe(-1);
    expect(tree.delete(5)).toBe(false);
    expect(tree.min()).toBeUndefined();
    expect(tree.max()).toBeUndefined();
  });

  it('inserts, finds and iterates in sorted order', () => {
    const tree = new BinarySearchTree(EXAMPLE);
    check(tree, EXAMPLE);
    expect(tree.has(45)).toBe(false);
    expect(tree.min()).toBe(20);
    expect(tree.max()).toBe(80);
    expect(tree.height()).toBe(3);
  });

  it('ignores duplicate inserts', () => {
    const tree = new BinarySearchTree();
    expect(tree.insert(7)).toBe(true);
    expect(tree.insert(7)).toBe(false);
    expect(tree.insert(3)).toBe(true);
    expect(tree.insert(3)).toBe(false);
    check(tree, [3, 7]);
  });

  it('empties the tree by deleting its only node', () => {
    const tree = new BinarySearchTree([1]);
    expect(tree.delete(1)).toBe(true);
    check(tree, []);
    expect(tree.height()).toBe(-1);
    expect(tree.insert(2)).toBe(true);
    check(tree, [2]);
  });

  it('deletes a leaf', () => {
    const tree = new BinarySearchTree([50, 30, 70, 20]);
    expect(tree.delete(20)).toBe(true);
    check(tree, [50, 30, 70]);
  });

  it.each([
    [[50, 30, 20], 30],
    [[50, 30, 40], 30],
    [[50, 70, 60], 70],
    [[50, 70, 80], 70],
    [[50, 30], 50],
    [[50, 70], 50],
  ])('deletes a node with one child (%j, delete %i)', (keys, victim) => {
    const tree = new BinarySearchTree(keys);
    expect(tree.delete(victim)).toBe(true);
    check(
      tree,
      keys.filter((k) => k !== victim),
    );
  });

  it('deletes the root when it has two children', () => {
    const tree = new BinarySearchTree(EXAMPLE);
    expect(tree.delete(50)).toBe(true);
    check(
      tree,
      EXAMPLE.filter((k) => k !== 50),
    );
    expect(rootOf(tree)?.key).toBe(60);
    expect(rootOf(tree)?.right?.left?.key).toBe(65);
  });

  it('deletes a two-child node whose successor is its right child', () => {
    const tree = new BinarySearchTree([50, 30, 70, 20, 40, 80]);
    expect(tree.delete(50)).toBe(true);
    check(tree, [30, 70, 20, 40, 80]);
    expect(rootOf(tree)?.key).toBe(70);
    expect(rootOf(tree)?.right?.key).toBe(80);
  });

  it('deletes an inner node with two children', () => {
    const keys = [50, 30, 70, 20, 40, 35, 45, 36];
    const tree = new BinarySearchTree(keys);
    expect(tree.delete(30)).toBe(true);
    check(
      tree,
      keys.filter((k) => k !== 30),
    );
    expect(rootOf(tree)?.left?.key).toBe(35);
  });

  it('reports an absent key on delete', () => {
    const tree = new BinarySearchTree([2, 1, 3]);
    expect(tree.delete(4)).toBe(false);
    expect(tree.delete(0)).toBe(false);
    expect(tree.delete(2)).toBe(true);
    expect(tree.delete(2)).toBe(false);
    check(tree, [1, 3]);
  });

  it('returns an inclusive range of keys', () => {
    const tree = new BinarySearchTree(EXAMPLE);
    expect(tree.keysBetween(30, 65)).toEqual([30, 40, 50, 60, 65]);
    expect(tree.keysBetween(31, 64)).toEqual([40, 50, 60]);
    expect(tree.keysBetween(0, 100)).toEqual([20, 30, 40, 50, 60, 65, 70, 80]);
    expect(tree.keysBetween(65, 65)).toEqual([65]);
    expect(tree.keysBetween(66, 69)).toEqual([]);
    expect(tree.keysBetween(81, 90)).toEqual([]);
    expect(tree.keysBetween(0, 19)).toEqual([]);
    expect(tree.keysBetween(60, 40)).toEqual([]);
  });

  it('becomes a path of height n - 1 under sorted inserts', () => {
    const n = 3000;
    const keys = Array.from({ length: n }, (_, i) => i);
    const tree = new BinarySearchTree(keys);
    expect(tree.height()).toBe(n - 1);
    check(tree, keys);
    expect(tree.keysBetween(n - 3, n + 5)).toEqual([n - 3, n - 2, n - 1]);
    for (let key = 0; key < n; key += 2) expect(tree.delete(key)).toBe(true);
    check(
      tree,
      keys.filter((k) => k % 2 === 1),
    );
    const descending = new BinarySearchTree([...keys].reverse());
    expect(descending.height()).toBe(n - 1);
    expect(descending.min()).toBe(0);
  });

  it('stays shallow under random inserts', () => {
    const random = seeded(1);
    const keys = Array.from({ length: 1023 }, (_, i) => i);
    for (let i = keys.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [keys[i], keys[j]] = [keys[j], keys[i]];
    }
    expect(new BinarySearchTree(keys).height()).toBeLessThan(40);
  });

  it('matches a sorted set on 200 seeded random operation sequences', () => {
    const ops = ['insert', 'insert', 'delete', 'delete', 'has', 'range'];
    for (let seed = 0; seed < 200; seed++) {
      const random = seeded(seed);
      const tree = new BinarySearchTree();
      const model = new Set<number>();
      for (let step = 0; step < 80; step++) {
        const op = ops[Math.floor(random() * ops.length)];
        const key = Math.floor(random() * 31);
        if (op === 'insert') {
          expect(tree.insert(key)).toBe(!model.has(key));
          model.add(key);
        } else if (op === 'delete') {
          expect(tree.delete(key)).toBe(model.has(key));
          model.delete(key);
        } else if (op === 'has') {
          expect(tree.has(key)).toBe(model.has(key));
        } else {
          const hi = Math.floor(random() * 35) - 2;
          const expected = [...model]
            .filter((k) => key <= k && k <= hi)
            .sort((a, b) => a - b);
          expect(tree.keysBetween(key, hi)).toEqual(expected);
        }
        const sorted = [...model].sort((a, b) => a - b);
        expect([...tree]).toEqual(sorted);
        expect(tree.size).toBe(model.size);
        expect(tree.min()).toBe(sorted[0]);
        expect(tree.max()).toBe(sorted[sorted.length - 1]);
      }
      check(tree, model);
    }
  });
});
