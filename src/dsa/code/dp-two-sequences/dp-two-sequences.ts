// Strings are compared by code point (Array.from), not by UTF-16 code unit, so an
// emoji counts as one character, as it does in Python.

/** table[i][j] is the length of the longest common subsequence of a[:i], b[:j]. */
export function lcsTable(a: string, b: string): number[][] {
  const x = Array.from(a);
  const y = Array.from(b);
  const table = Array.from({ length: x.length + 1 }, () =>
    new Array<number>(y.length + 1).fill(0),
  );
  for (let i = 1; i <= x.length; i++) {
    for (let j = 1; j <= y.length; j++) {
      if (x[i - 1] === y[j - 1]) {
        table[i][j] = table[i - 1][j - 1] + 1;
      } else {
        table[i][j] = Math.max(table[i - 1][j], table[i][j - 1]);
      }
    }
  }
  return table;
}

/** Length of the longest subsequence that a and b have in common. */
export function lcsLength(a: string, b: string): number {
  const table = lcsTable(a, b);
  return table[table.length - 1][table[0].length - 1];
}

/** One longest common subsequence of a and b, found by walking the table back. */
export function lcs(a: string, b: string): string {
  const x = Array.from(a);
  const y = Array.from(b);
  const table = lcsTable(a, b);
  let i = x.length;
  let j = y.length;
  const picked: string[] = [];
  while (i > 0 && j > 0) {
    if (x[i - 1] === y[j - 1]) {
      picked.push(x[i - 1]);
      i--;
      j--;
    } else if (table[i - 1][j] >= table[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  return picked.reverse().join('');
}

/** Fewest single-character inserts, deletes and replaces that turn a into b. */
export function editDistance(a: string, b: string): number {
  const x = Array.from(a);
  const y = Array.from(b);
  const table = Array.from({ length: x.length + 1 }, () =>
    new Array<number>(y.length + 1).fill(0),
  );
  for (let i = 0; i <= x.length; i++) table[i][0] = i;
  for (let j = 0; j <= y.length; j++) table[0][j] = j;
  for (let i = 1; i <= x.length; i++) {
    for (let j = 1; j <= y.length; j++) {
      if (x[i - 1] === y[j - 1]) {
        table[i][j] = table[i - 1][j - 1];
      } else {
        table[i][j] =
          1 +
          Math.min(
            table[i - 1][j], // delete x[i - 1]
            table[i][j - 1], // insert y[j - 1]
            table[i - 1][j - 1], // replace x[i - 1] with y[j - 1]
          );
      }
    }
  }
  return table[x.length][y.length];
}

/** Same answer as editDistance, keeping one row and one saved diagonal. */
export function editDistanceRolling(a: string, b: string): number {
  const x = Array.from(a);
  const y = Array.from(b);
  const row = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i++) {
    let diagonal = row[0];
    row[0] = i;
    for (let j = 1; j <= y.length; j++) {
      const above = row[j];
      if (x[i - 1] === y[j - 1]) {
        row[j] = diagonal;
      } else {
        row[j] = 1 + Math.min(above, row[j - 1], diagonal);
      }
      diagonal = above;
    }
  }
  return row[y.length];
}
