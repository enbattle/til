import { describe, expect, it } from 'vitest';
import {
  TreeNode,
  buildTree,
  height,
  inorder,
  inorderIterative,
  levelOrder,
  postorder,
  preorder,
  size,
} from './binary-tree';

// The binary-tree entry's TypeScript code. API: `new TreeNode(value, left, right)`;
// `buildTree(values)` from a level-order array where null marks a missing child
// (RangeError when a value has no parent); `preorder`, `inorder`, `postorder`,
// `inorderIterative` (arrays of values), `levelOrder` (an array of levels),
// `height` (edges, -1 for an empty tree) and `size`.

/** A small seeded generator (mulberry32), so a failing tree can be replayed. */
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

type Shape<T> = [T, Shape<T> | null, Shape<T> | null] | null;

/** The tree as nested [value, left, right] arrays, for comparing structure. */
function shape<T>(node: TreeNode<T> | null): Shape<T> {
  return node === null ? null : [node.value, shape(node.left), shape(node.right)];
}

// The worked example in the entry (see the Python test for a drawing).
const EXAMPLE = [1, 2, 3, 4, null, 5, 6, null, 7];

describe('binary tree (TypeScript)', () => {
  it('handles the empty tree', () => {
    expect(buildTree([])).toBeNull();
    expect(buildTree([null])).toBeNull();
    expect(preorder(null)).toEqual([]);
    expect(inorder(null)).toEqual([]);
    expect(postorder(null)).toEqual([]);
    expect(inorderIterative(null)).toEqual([]);
    expect(levelOrder(null)).toEqual([]);
    expect(height(null)).toBe(-1);
    expect(size(null)).toBe(0);
  });

  it('handles one node', () => {
    const root = buildTree([5]);
    expect(shape(root)).toEqual([5, null, null]);
    for (const order of [preorder, inorder, postorder, inorderIterative]) {
      expect(order(root)).toEqual([5]);
    }
    expect(levelOrder(root)).toEqual([[5]]);
    expect(height(root)).toBe(0);
    expect(size(root)).toBe(1);
  });

  it('builds the worked example', () => {
    expect(shape(buildTree(EXAMPLE))).toEqual([
      1,
      [2, [4, null, [7, null, null]], null],
      [3, [5, null, null], [6, null, null]],
    ]);
  });

  it('traverses the worked example', () => {
    const root = buildTree(EXAMPLE);
    expect(preorder(root)).toEqual([1, 2, 4, 7, 3, 5, 6]);
    expect(inorder(root)).toEqual([4, 7, 2, 1, 5, 3, 6]);
    expect(inorderIterative(root)).toEqual([4, 7, 2, 1, 5, 3, 6]);
    expect(postorder(root)).toEqual([7, 4, 2, 5, 6, 3, 1]);
    expect(levelOrder(root)).toEqual([[1], [2, 3], [4, 5, 6], [7]]);
    expect(height(root)).toBe(3);
    expect(size(root)).toBe(7);
  });

  it('handles a left-only chain', () => {
    const root = buildTree([1, 2, null, 3]);
    expect(shape(root)).toEqual([1, [2, [3, null, null], null], null]);
    expect(preorder(root)).toEqual([1, 2, 3]);
    expect(inorder(root)).toEqual([3, 2, 1]);
    expect(inorderIterative(root)).toEqual([3, 2, 1]);
    expect(postorder(root)).toEqual([3, 2, 1]);
    expect(levelOrder(root)).toEqual([[1], [2], [3]]);
    expect(height(root)).toBe(2);
  });

  it('handles a right-only chain', () => {
    const root = buildTree([1, null, 2, null, 3]);
    expect(shape(root)).toEqual([1, null, [2, null, [3, null, null]]]);
    expect(preorder(root)).toEqual([1, 2, 3]);
    expect(inorder(root)).toEqual([1, 2, 3]);
    expect(inorderIterative(root)).toEqual([1, 2, 3]);
    expect(postorder(root)).toEqual([3, 2, 1]);
    expect(levelOrder(root)).toEqual([[1], [2], [3]]);
    expect(height(root)).toBe(2);
  });

  it('gives the next pair of values to the next node that exists', () => {
    expect(shape(buildTree([1, null, 3, 4, 5]))).toEqual([
      1,
      null,
      [3, [4, null, null], [5, null, null]],
    ]);
    expect(shape(buildTree([1, 2, null]))).toEqual(shape(buildTree([1, 2])));
  });

  it('treats falsy values as nodes, not gaps', () => {
    const root = buildTree<number | string | boolean>([0, '', false]);
    expect(shape(root)).toEqual([0, ['', null, null], [false, null, null]]);
    expect(size(root)).toBe(3);
  });

  it('keeps duplicate values', () => {
    const root = buildTree([2, 2, 2, null, 2]);
    expect(preorder(root)).toEqual([2, 2, 2, 2]);
    expect(size(root)).toBe(4);
    expect(height(root)).toBe(2);
  });

  it('works on hand-built nodes', () => {
    const root = new TreeNode('b', new TreeNode('a'), new TreeNode('c'));
    expect(inorder(root)).toEqual(['a', 'b', 'c']);
    expect(levelOrder(root)).toEqual([['b'], ['a', 'c']]);
  });

  it.each([[[1, null, null, 4]], [[null, 1]], [[1, null, null, null]]])(
    'throws when a value has no parent: %j',
    (values) => {
      expect(() => buildTree(values)).toThrow(RangeError);
    },
  );

  it('overflows the call stack on a deep tree, unlike the explicit stack', () => {
    const n = 100_000;
    const values: (number | null)[] = [0];
    for (let i = 1; i < n; i++) values.push(i, null);
    const root = buildTree(values);
    const expected = Array.from({ length: n }, (_, i) => n - 1 - i);
    expect(inorderIterative(root)).toEqual(expected);
    expect(levelOrder(root).length).toBe(n);
    expect(() => inorder(root)).toThrow(RangeError);
  });

  // An independent reference: describe each node by its path from the root, a
  // string of "L" and "R" steps. Every traversal order is then a sort of the paths.
  it('matches the path reference on 50 seeded random trees', () => {
    for (let seed = 0; seed < 50; seed++) {
      const where = `seed ${seed}`;
      const random = seeded(seed);
      const n = Math.floor(random() * 40);
      const tree = new Map<string, number>();
      if (n > 0) tree.set('', Math.floor(random() * 10));
      while (tree.size < n) {
        const paths = [...tree.keys()];
        const child =
          paths[Math.floor(random() * paths.length)] + (random() < 0.5 ? 'L' : 'R');
        if (!tree.has(child)) tree.set(child, Math.floor(random() * 10));
      }

      const byLevel = [...tree.keys()].sort((a, b) =>
        a.length !== b.length ? a.length - b.length : a < b ? -1 : 1,
      );
      const values: (number | null)[] = n > 0 ? [tree.get('') as number] : [];
      for (const path of byLevel) {
        values.push(tree.get(path + 'L') ?? null, tree.get(path + 'R') ?? null);
      }
      while (values.length > 0 && values[values.length - 1] === null) values.pop();
      const root = buildTree(values);

      const found = new Map<string, number>();
      const stack: [string, TreeNode<number> | null][] = [['', root]];
      while (stack.length > 0) {
        const [path, node] = stack.pop() as [string, TreeNode<number> | null];
        if (node === null) continue;
        found.set(path, node.value);
        stack.push([path + 'L', node.left], [path + 'R', node.right]);
      }
      expect(found, where).toEqual(tree);

      const sortBy = (l: string, r: string, end: string) => {
        const key = (p: string) => [...p].map((s) => (s === 'L' ? l : r)).join('') + end;
        return [...tree.keys()]
          .sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0))
          .map((p) => tree.get(p));
      };
      expect(preorder(root), where).toEqual(sortBy('0', '1', ''));
      expect(inorder(root), where).toEqual(sortBy('0', '2', '1'));
      expect(inorderIterative(root), where).toEqual(inorder(root));
      expect(postorder(root), where).toEqual(sortBy('0', '1', '2'));

      const deepest = Math.max(-1, ...[...tree.keys()].map((p) => p.length));
      const levels: number[][] = Array.from({ length: deepest + 1 }, () => []);
      for (const path of byLevel) levels[path.length].push(tree.get(path) as number);
      expect(levelOrder(root), where).toEqual(levels);
      expect(height(root), where).toBe(deepest);
      expect(size(root), where).toBe(tree.size);
    }
  });
});
