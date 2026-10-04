import { describe, expect, it } from 'vitest';
import { TreeNode, buildTree, diameter, pathsWithSum } from './tree-dfs';

// The tree-dfs entry's TypeScript code, checked against brute force. API:
// - `buildTree(values)`: a tree from its level order, null marking a gap.
// - `pathsWithSum(root, target)`: every root-to-leaf path with that sum, as
//   arrays of values, left to right.
// - `diameter(root)`: edges on the longest path between any two nodes.

function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

function randomInt(random: () => number, low: number, high: number): number {
  return low + Math.floor(random() * (high - low + 1));
}

/** A random tree as a level-order list, with null marking missing children. */
function randomLevelOrder(random: () => number, maxNodes: number): (number | null)[] {
  const count = randomInt(random, 0, maxNodes);
  if (count === 0) return [];
  const values: (number | null)[] = [randomInt(random, -5, 9)];
  let waiting = 1;
  let created = 1;
  while (waiting > 0) {
    waiting--;
    for (let side = 0; side < 2; side++) {
      if (created < count && random() < 0.65) {
        values.push(randomInt(random, -5, 9));
        created++;
        waiting++;
      } else {
        values.push(null);
      }
    }
  }
  while (values.length > 0 && values[values.length - 1] === null) values.pop();
  return values;
}

/** Walks with a fresh array per step (no shared state), collecting matching paths. */
function bruteForcePaths(root: TreeNode | null, target: number): number[][] {
  const found: number[][] = [];
  const stack: [TreeNode, number[]][] = root === null ? [] : [[root, [root.value]]];
  while (stack.length > 0) {
    const [node, path] = stack.pop()!;
    if (node.left === null && node.right === null) {
      if (path.reduce((a, b) => a + b, 0) === target) found.push(path);
    }
    for (const child of [node.right, node.left]) {
      if (child !== null) stack.push([child, [...path, child.value]]);
    }
  }
  return found;
}

/** Longest shortest path over all node pairs, by BFS from every node. */
function bruteForceDiameter(root: TreeNode | null): number {
  if (root === null) return 0;
  const ids = new Map<TreeNode, number>();
  const neighbours: number[][] = [];
  const idOf = (node: TreeNode): number => {
    if (!ids.has(node)) {
      ids.set(node, neighbours.length);
      neighbours.push([]);
    }
    return ids.get(node)!;
  };
  const stack = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    for (const child of [node.left, node.right]) {
      if (child !== null) {
        neighbours[idOf(node)].push(idOf(child));
        neighbours[idOf(child)].push(idOf(node));
        stack.push(child);
      }
    }
  }
  idOf(root);
  let longest = 0;
  for (let start = 0; start < neighbours.length; start++) {
    const distance = new Map<number, number>([[start, 0]]);
    const queue = [start];
    for (const current of queue) {
      for (const other of neighbours[current]) {
        if (!distance.has(other)) {
          distance.set(other, distance.get(current)! + 1);
          queue.push(other);
        }
      }
    }
    longest = Math.max(longest, ...distance.values());
  }
  return longest;
}

function chain(length: number, side: 'left' | 'right' = 'left'): TreeNode | null {
  let root: TreeNode | null = null;
  for (let value = 0; value < length; value++) {
    if (side === 'left') root = new TreeNode(value, root, null);
    else root = new TreeNode(value, null, root);
  }
  return root;
}

describe('buildTree (TypeScript)', () => {
  it('reads level order', () => {
    const root = buildTree([1, 2, 3, 4, null, 5, 6, null, 7])!;
    expect(root.value).toBe(1);
    expect(root.left!.value).toBe(2);
    expect(root.right!.value).toBe(3);
    expect(root.left!.left!.value).toBe(4);
    expect(root.left!.right).toBeNull();
    expect(root.left!.left!.right!.value).toBe(7);
    expect(root.right!.left!.value).toBe(5);
    expect(root.right!.right!.value).toBe(6);
    expect(buildTree([])).toBeNull();
    expect(buildTree([null])).toBeNull();
  });
});

describe('pathsWithSum and diameter (TypeScript)', () => {
  it('works the entry example', () => {
    const root = buildTree([5, 4, 8, 11, null, 13, 4, 7, 2, null, null, 5, 1]);
    expect(pathsWithSum(root, 22)).toEqual([
      [5, 4, 11, 2],
      [5, 8, 4, 5],
    ]);
    expect(pathsWithSum(root, 26)).toEqual([[5, 8, 13]]);
    expect(diameter(root)).toBe(6);
  });

  it('handles the empty tree', () => {
    expect(pathsWithSum(null, 0)).toEqual([]);
    expect(diameter(null)).toBe(0);
  });

  it('handles a single node', () => {
    const root = buildTree([7]);
    expect(pathsWithSum(root, 7)).toEqual([[7]]);
    expect(pathsWithSum(root, 6)).toEqual([]);
    expect(diameter(root)).toBe(0);
  });

  it('handles a line leaning either way', () => {
    for (const side of ['left', 'right'] as const) {
      const root = chain(6, side);
      const values = [5, 4, 3, 2, 1, 0];
      expect(pathsWithSum(root, 15)).toEqual([values]);
      expect(pathsWithSum(root, 16)).toEqual([]);
      expect(diameter(root)).toBe(5);
    }
  });

  it('counts only leaves as path ends', () => {
    const root = buildTree([1, 2, null, 5]);
    expect(pathsWithSum(root, 3)).toEqual([]);
    expect(pathsWithSum(root, 8)).toEqual([[1, 2, 5]]);
  });

  it('keeps searching past a negative running sum', () => {
    expect(pathsWithSum(buildTree([1, -2, 3, 4, null, -5]), 3)).toEqual([[1, -2, 4]]);
    expect(pathsWithSum(buildTree([1, -2, 3, 4, null, -5]), -1)).toEqual([[1, 3, -5]]);
    expect(pathsWithSum(buildTree([-3, -4, null, 6]), -1)).toEqual([[-3, -4, 6]]);
  });

  it('gives each path its own array', () => {
    const paths = pathsWithSum(buildTree([2, 1, 1]), 3);
    expect(paths).toEqual([
      [2, 1],
      [2, 1],
    ]);
    expect(paths[0]).not.toBe(paths[1]);
    paths[0].push(99);
    expect(paths[1]).toEqual([2, 1]);
  });

  it('finds a diameter that skips the root', () => {
    const root = buildTree([1, 2, null, 3, 4, 5, null, null, 6]);
    expect(diameter(root)).toBe(4);
    expect(bruteForceDiameter(root)).toBe(4);
  });

  it('agrees with brute-force paths on many random trees', () => {
    const random = seededRandom(11);
    for (let n = 0; n < 50; n++) {
      const values = randomLevelOrder(random, 14);
      const root = buildTree(values);
      for (let target = -12; target <= 24; target++) {
        expect(
          pathsWithSum(root, target),
          `seed 11, trial ${n}: ${JSON.stringify(values)}, target ${target}`,
        ).toEqual(bruteForcePaths(root, target));
      }
    }
  });

  it('agrees with a brute-force diameter on many random trees', () => {
    const random = seededRandom(23);
    for (let n = 0; n < 50; n++) {
      const values = randomLevelOrder(random, 16);
      const root = buildTree(values);
      expect(diameter(root), `seed 23, trial ${n}: ${JSON.stringify(values)}`).toBe(
        bruteForceDiameter(root),
      );
    }
  });

  it('does not change the tree', () => {
    const root = buildTree([3, 1, 4, null, 5, 9]);
    pathsWithSum(root, 9);
    diameter(root);
    expect(pathsWithSum(root, 9)).toEqual(bruteForcePaths(root, 9));
    expect(root!.left!.right!.value).toBe(5);
    expect(root!.right!.left!.value).toBe(9);
  });
});
