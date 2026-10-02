import { describe, expect, it } from 'vitest';
import {
  TreeNode,
  buildTree,
  minDepth,
  rightSideView,
  zigzagLevelOrder,
} from './tree-bfs';

// Tests for tree-bfs: rightSideView, minDepth and zigzagLevelOrder. The random
// tests compare each function with a depth-first brute force on many seeded
// random trees of every shape from a line to a bushy tree.

const EXAMPLE = [1, 2, 3, 4, null, 5, 6, null, 7];

// --- depth-first brute force --------------------------------------------------

/** Values grouped by depth, each level left to right, by preorder. */
function levelsDfs(root: TreeNode | null): number[][] {
  const levels: number[][] = [];
  const visit = (node: TreeNode | null, depth: number): void => {
    if (node === null) return;
    (levels[depth] ??= []).push(node.value);
    visit(node.left, depth + 1);
    visit(node.right, depth + 1);
  };
  visit(root, 0);
  return levels;
}

const rightSideViewDfs = (root: TreeNode | null) =>
  levelsDfs(root).map((l) => l[l.length - 1]);

const zigzagDfs = (root: TreeNode | null) =>
  levelsDfs(root).map((level, depth) => (depth % 2 === 1 ? [...level].reverse() : level));

function minDepthDfs(node: TreeNode | null): number {
  if (node === null) return -1;
  if (node.left === null && node.right === null) return 0;
  if (node.left === null) return 1 + minDepthDfs(node.right);
  if (node.right === null) return 1 + minDepthDfs(node.left);
  return 1 + Math.min(minDepthDfs(node.left), minDepthDfs(node.right));
}

// --- tree generators ------------------------------------------------------------

/** A small seeded generator (mulberry32) returning floats in [0, 1). */
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

/** n nodes with distinct values; chainBias is the odds of extending the newest
 * node, so a high bias gives a long thin tree and 0 a bushy one. */
function randomTree(rand: () => number, n: number, chainBias: number): TreeNode | null {
  if (n === 0) return null;
  const values = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
  const root = new TreeNode(values[0]);
  const nodes = [root];
  for (const value of values.slice(1)) {
    for (;;) {
      const parent =
        rand() < chainBias
          ? nodes[nodes.length - 1]
          : nodes[Math.floor(rand() * nodes.length)];
      const side = rand() < 0.5 ? 'left' : 'right';
      if (parent[side] === null) {
        const child = new TreeNode(value);
        parent[side] = child;
        nodes.push(child);
        break;
      }
    }
  }
  return root;
}

/** A tree of n nodes where each node has only a `side` child. */
function line(n: number, side: 'left' | 'right'): TreeNode | null {
  let root: TreeNode | null = null;
  for (let value = n; value >= 1; value--) {
    root =
      side === 'left' ? new TreeNode(value, root, null) : new TreeNode(value, null, root);
  }
  return root;
}

// --- buildTree --------------------------------------------------------------------

describe('buildTree', () => {
  it('makes the example', () => {
    const root = buildTree(EXAMPLE);
    expect(levelsDfs(root)).toEqual([[1], [2, 3], [4, 5, 6], [7]]);
    expect(root?.left?.left?.right?.value).toBe(7);
  });

  it('keeps a zero value', () => {
    const root = buildTree([1, 0, 2, 3]);
    expect(root?.left?.value).toBe(0);
    expect(root?.left?.left?.value).toBe(3);
  });

  it('rejects a value with no parent', () => {
    expect(() => buildTree([1, null, null, 4])).toThrow(RangeError);
  });

  it('builds nothing from nothing', () => {
    expect(buildTree([])).toBeNull();
    expect(buildTree([null])).toBeNull();
  });
});

// --- rightSideView ----------------------------------------------------------------

describe('rightSideView', () => {
  it('sees the example from the right', () => {
    expect(rightSideView(buildTree(EXAMPLE))).toEqual([1, 3, 6, 7]);
  });

  it('sees a left node when the right side is shorter', () => {
    expect(rightSideView(buildTree([1, 2, 3, 4]))).toEqual([1, 3, 4]);
  });

  it('handles empty and single', () => {
    expect(rightSideView(null)).toEqual([]);
    expect(rightSideView(new TreeNode(9))).toEqual([9]);
  });

  it('handles lines', () => {
    expect(rightSideView(line(4, 'left'))).toEqual([1, 2, 3, 4]);
    expect(rightSideView(line(4, 'right'))).toEqual([1, 2, 3, 4]);
  });
});

// --- minDepth ---------------------------------------------------------------------

describe('minDepth', () => {
  it('finds the nearest leaf of the example', () => {
    expect(minDepth(buildTree(EXAMPLE))).toBe(2);
  });

  it('counts edges for empty and single', () => {
    expect(minDepth(null)).toBe(-1);
    expect(minDepth(new TreeNode(1))).toBe(0);
  });

  it('does not stop at a missing child', () => {
    expect(minDepth(buildTree([1, null, 2, null, 3]))).toBe(2);
  });

  it('equals the height on a line', () => {
    expect(minDepth(line(5, 'left'))).toBe(4);
    expect(minDepth(line(5, 'right'))).toBe(4);
  });

  it('stops at the first leaf', () => {
    expect(minDepth(new TreeNode(0, line(50, 'left'), new TreeNode(-1)))).toBe(1);
  });
});

// --- zigzagLevelOrder -------------------------------------------------------------

describe('zigzagLevelOrder', () => {
  it('zigzags the example', () => {
    expect(zigzagLevelOrder(buildTree(EXAMPLE))).toEqual([[1], [3, 2], [4, 5, 6], [7]]);
  });

  it('flips every other level, not the first two', () => {
    const tree = buildTree(Array.from({ length: 15 }, (_, i) => i + 1));
    expect(zigzagLevelOrder(tree)).toEqual([
      [1],
      [3, 2],
      [4, 5, 6, 7],
      [15, 14, 13, 12, 11, 10, 9, 8],
    ]);
  });

  it('handles empty and single', () => {
    expect(zigzagLevelOrder(null)).toEqual([]);
    expect(zigzagLevelOrder(new TreeNode(7))).toEqual([[7]]);
  });

  it('handles lines', () => {
    expect(zigzagLevelOrder(line(3, 'left'))).toEqual([[1], [2], [3]]);
    expect(zigzagLevelOrder(line(3, 'right'))).toEqual([[1], [2], [3]]);
  });
});

// --- random comparison with the brute force --------------------------------------

describe('random trees', () => {
  it('match the depth-first answers', () => {
    for (let seed = 0; seed < 300; seed++) {
      const rand = seeded(seed);
      const n = Math.floor(rand() * 41);
      const bias = [0, 0.5, 0.9][Math.floor(rand() * 3)];
      const root = randomTree(rand, n, bias);
      expect(rightSideView(root)).toEqual(rightSideViewDfs(root));
      expect(minDepth(root)).toBe(minDepthDfs(root));
      expect(zigzagLevelOrder(root)).toEqual(zigzagDfs(root));
    }
  });
});
