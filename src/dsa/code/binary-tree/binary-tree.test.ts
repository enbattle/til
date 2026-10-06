import { describe, expect, it } from 'vitest';
import { TreeNode, buildTree, height, inorder, levelOrder } from './binary-tree';

// The binary-tree entry's TypeScript code. API: `new TreeNode(value, left, right)`;
// `buildTree(values)` from a level-order array where null marks a missing child
// (RangeError when a value has no parent); `height(node)` in edges, -1 for the
// empty tree; `inorder(root)` an array of values; `levelOrder(root)` an array of
// levels.

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

type Shape = [number, Shape, Shape] | null;
type Plain<T> = [T, Plain<T>, Plain<T>] | null;

function shape<T>(node: TreeNode<T> | null): Plain<T> {
  return node === null ? null : [node.value, shape(node.left), shape(node.right)];
}

/** A random tree of `size` nodes with distinct values. */
function randomShape(next: () => number, size: number): Shape {
  let counter = 0;
  const make = (n: number): Shape => {
    if (n === 0) return null;
    const left = Math.floor(next() * n);
    const value = counter++;
    return [value, make(left), make(n - 1 - left)];
  };
  return make(size);
}

function toNodes(t: Shape): TreeNode<number> | null {
  return t === null ? null : new TreeNode(t[0], toNodes(t[1]), toNodes(t[2]));
}

/** The level-order list for a tree, trailing nulls trimmed. */
function toLevelList(t: Shape): (number | null)[] {
  if (t === null) return [];
  const out: (number | null)[] = [t[0]];
  let level: [number, Shape, Shape][] = [t];
  while (level.length > 0) {
    const nxt: [number, Shape, Shape][] = [];
    for (const node of level) {
      for (const c of [node[1], node[2]]) {
        out.push(c === null ? null : c[0]);
        if (c !== null) nxt.push(c);
      }
    }
    level = nxt;
  }
  while (out.length > 0 && out[out.length - 1] === null) out.pop();
  return out;
}

function refInorder(t: Shape): number[] {
  return t === null ? [] : [...refInorder(t[1]), t[0], ...refInorder(t[2])];
}

function refHeight(t: Shape): number {
  return t === null ? -1 : 1 + Math.max(refHeight(t[1]), refHeight(t[2]));
}

function refLevels(t: Shape): number[][] {
  const levels: number[][] = [];
  const walk = (node: Shape, depth: number): void => {
    if (node === null) return;
    (levels[depth] ??= []).push(node[0]);
    walk(node[1], depth + 1);
    walk(node[2], depth + 1);
  };
  walk(t, 0);
  return levels;
}

/** A degenerate tree of n nodes leaning left, built without recursion. */
function chain(n: number): TreeNode<number> | null {
  let root: TreeNode<number> | null = null;
  for (let value = 0; value < n; value++) root = new TreeNode(value, root);
  return root;
}

const EXAMPLE = [1, 2, 3, 4, null, 5, 6, null, 7];
const DEEP = 100_000;

describe('the running example', () => {
  it('has the traversals and heights from the entry', () => {
    const root = buildTree(EXAMPLE)!;
    expect(inorder(root)).toEqual([4, 7, 2, 1, 5, 3, 6]);
    expect(levelOrder(root)).toEqual([[1], [2, 3], [4, 5, 6], [7]]);
    expect(height(root)).toBe(3);
    expect(height(root.left)).toBe(2);
    expect(height(root.right)).toBe(1);
  });
});

describe('small trees', () => {
  it('handles the empty tree', () => {
    expect(buildTree([])).toBeNull();
    expect(buildTree([null])).toBeNull();
    expect(inorder(null)).toEqual([]);
    expect(levelOrder(null)).toEqual([]);
    expect(height(null)).toBe(-1);
  });

  it('handles a single node', () => {
    const root = buildTree([5])!;
    expect([root.value, root.left, root.right]).toEqual([5, null, null]);
    expect(inorder(root)).toEqual([5]);
    expect(levelOrder(root)).toEqual([[5]]);
    expect(height(root)).toBe(0);
  });

  it('keeps gaps and treats a trailing null as optional', () => {
    expect(shape(buildTree([1, 2]))).toEqual([1, [2, null, null], null]);
    expect(shape(buildTree([1, 2, null, null, null]))).toEqual([
      1,
      [2, null, null],
      null,
    ]);
    expect(shape(buildTree([1, null, 2]))).toEqual([1, null, [2, null, null]]);
  });

  it('gives falsy values nodes of their own', () => {
    expect(levelOrder(buildTree([0, '', 0, null, 0]))).toEqual([[0], ['', 0], [0]]);
  });

  it('keeps duplicate values', () => {
    const root = buildTree([1000, 1000, 1000])!;
    expect(inorder(root)).toEqual([1000, 1000, 1000]);
  });

  it('rejects a value with no parent', () => {
    for (const bad of [
      [null, 1],
      [1, null, null, 4],
      [1, null, null, null],
    ]) {
      expect(() => buildTree(bad)).toThrow(RangeError);
    }
  });
});

describe('against references on random trees', () => {
  it('rebuilds the tree it came from', () => {
    const seed = 3;
    const next = seeded(seed);
    for (let trial = 0; trial < 50; trial++) {
      const t = randomShape(next, Math.floor(next() * 13));
      const values = toLevelList(t);
      expect(shape(buildTree(values)), `seed ${seed}, trial ${trial}: ${values}`).toEqual(
        t,
      );
    }
  });

  it('matches the recursive references', () => {
    const seed = 4;
    const next = seeded(seed);
    for (let trial = 0; trial < 50; trial++) {
      const t = randomShape(next, Math.floor(next() * 16));
      const root = toNodes(t);
      const where = `seed ${seed}, trial ${trial}: ${toLevelList(t)}`;
      expect(inorder(root), where).toEqual(refInorder(t));
      expect(levelOrder(root), where).toEqual(refLevels(t));
      expect(height(root), where).toBe(refHeight(t));
    }
  });

  it('creates one node per value', () => {
    const seed = 5;
    const next = seeded(seed);
    for (let trial = 0; trial < 50; trial++) {
      const t = randomShape(next, 1 + Math.floor(next() * 15));
      const values = toLevelList(t);
      const seen = new Set<TreeNode<number>>();
      const walk = (node: TreeNode<number> | null): void => {
        if (node === null) return;
        seen.add(node);
        walk(node.left);
        walk(node.right);
      };
      walk(buildTree(values));
      const want = values.filter((v) => v !== null).length;
      expect(seen.size, `seed ${seed}, trial ${trial}: ${values}`).toBe(want);
    }
  });
});

describe('deep trees', () => {
  it('traverses a chain far deeper than the call stack', () => {
    const root = chain(DEEP);
    expect(inorder(root)).toEqual(Array.from({ length: DEEP }, (_, i) => i));
    const levels = levelOrder(root);
    expect(levels.length).toBe(DEEP);
    expect(levels[0]).toEqual([DEEP - 1]);
    expect(levels[DEEP - 1]).toEqual([0]);
  });

  it('builds a deep chain from its level order', () => {
    const values: (number | null)[] = [0];
    for (let v = 1; v < DEEP; v++) values.push(v, null);
    expect(levelOrder(buildTree(values)).length).toBe(DEEP);
  });

  it('recurses as deep as the tree is tall in height', () => {
    expect(height(chain(500))).toBe(499);
    // Ten times DEEP so the throw holds on any Node version or vitest pool.
    expect(() => height(chain(DEEP * 10))).toThrow(RangeError);
  });
});
