import { describe, expect, it } from 'vitest';
import { minPathSum, minPathSumRolling, uniquePaths } from './dp-grids';

type Cell = [number, number];

/** Every right/down path from the top-left to the bottom-right cell. */
function allPaths(grid: number[][]): Cell[][] {
  const rows = grid.length;
  const cols = grid[0].length;
  const out: Cell[][] = [];
  const walk = (r: number, c: number, path: Cell[]) => {
    const next: Cell[] = [...path, [r, c]];
    if (r === rows - 1 && c === cols - 1) {
      out.push(next);
      return;
    }
    if (r + 1 < rows) walk(r + 1, c, next);
    if (c + 1 < cols) walk(r, c + 1, next);
  };
  walk(0, 0, []);
  return out;
}

function bruteUniquePaths(grid: number[][]): number {
  return allPaths(grid).filter((p) => p.every(([r, c]) => grid[r][c] !== 1)).length;
}

function bruteMinPathSum(grid: number[][]): number {
  return Math.min(
    ...allPaths(grid).map((p) => p.reduce((s, [r, c]) => s + grid[r][c], 0)),
  );
}

function makeRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

function randomGrid(random: () => number, low: number, high: number): number[][] {
  const rows = 1 + Math.floor(random() * 5);
  const cols = 1 + Math.floor(random() * 5);
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => low + Math.floor(random() * (high - low + 1))),
  );
}

describe('uniquePaths (TypeScript)', () => {
  it('counts paths with no obstacles', () => {
    expect(uniquePaths(Array.from({ length: 3 }, () => [0, 0, 0]))).toBe(6);
    expect(uniquePaths(Array.from({ length: 3 }, () => new Array(7).fill(0)))).toBe(28);
  });

  it('routes around a centre obstacle', () => {
    expect(
      uniquePaths([
        [0, 0, 0],
        [0, 1, 0],
        [0, 0, 0],
      ]),
    ).toBe(2);
  });

  it('handles a single cell', () => {
    expect(uniquePaths([[0]])).toBe(1);
    expect(uniquePaths([[1]])).toBe(0);
  });

  it('handles a single row and a single column', () => {
    expect(uniquePaths([[0, 0, 0, 0]])).toBe(1);
    expect(uniquePaths([[0], [0], [0]])).toBe(1);
    expect(uniquePaths([[0, 1, 0, 0]])).toBe(0);
    expect(uniquePaths([[0], [0], [1], [0]])).toBe(0);
  });

  it('lets an obstacle in the first row block only the rest of that row', () => {
    expect(
      uniquePaths([
        [0, 1, 0],
        [0, 0, 0],
      ]),
    ).toBe(1);
  });

  it('returns 0 for a blocked start, a blocked end and all obstacles', () => {
    expect(
      uniquePaths([
        [1, 0],
        [0, 0],
      ]),
    ).toBe(0);
    expect(
      uniquePaths([
        [0, 0],
        [0, 1],
      ]),
    ).toBe(0);
    expect(
      uniquePaths([
        [1, 1],
        [1, 1],
      ]),
    ).toBe(0);
  });

  it('returns 0 for an empty grid', () => {
    expect(uniquePaths([])).toBe(0);
    expect(uniquePaths([[]])).toBe(0);
  });

  it('matches brute force on many random grids', () => {
    const random = makeRandom(11);
    for (let n = 0; n < 400; n++) {
      const grid = randomGrid(random, 0, 1);
      expect(uniquePaths(grid)).toBe(bruteUniquePaths(grid));
    }
  });
});

describe.each([
  ['minPathSum', minPathSum],
  ['minPathSumRolling', minPathSumRolling],
])('%s (TypeScript)', (_name, fn) => {
  it('solves small examples', () => {
    expect(
      fn([
        [1, 3, 1],
        [1, 5, 1],
        [4, 2, 1],
      ]),
    ).toBe(7);
    expect(
      fn([
        [1, 2, 3],
        [4, 5, 6],
      ]),
    ).toBe(12);
    expect(fn([[5]])).toBe(5);
    expect(fn([[1, 2, 3, 4]])).toBe(10);
    expect(fn([[1], [2], [3], [4]])).toBe(10);
    expect(
      fn([
        [0, 0],
        [0, 0],
      ]),
    ).toBe(0);
  });

  it('returns 0 for an empty grid', () => {
    expect(fn([])).toBe(0);
    expect(fn([[]])).toBe(0);
  });

  it('matches brute force on many random grids', () => {
    const random = makeRandom(23);
    for (let n = 0; n < 400; n++) {
      const grid = randomGrid(random, 0, 9);
      expect(fn(grid)).toBe(bruteMinPathSum(grid));
    }
  });

  it('handles negative values', () => {
    const random = makeRandom(5);
    for (let n = 0; n < 200; n++) {
      const grid = randomGrid(random, -5, 5);
      expect(fn(grid)).toBe(bruteMinPathSum(grid));
    }
  });

  it('does not change the grid', () => {
    const grid = [
      [1, 3, 1],
      [1, 5, 1],
      [4, 2, 1],
    ];
    fn(grid);
    expect(grid).toEqual([
      [1, 3, 1],
      [1, 5, 1],
      [4, 2, 1],
    ]);
  });
});
