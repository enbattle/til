/** Best total value of items (each used at most once) weighing at most `capacity`. */
export function knapsackTable(
  weights: number[],
  values: number[],
  capacity: number,
): number {
  const n = weights.length;
  const table: number[][] = Array.from({ length: n + 1 }, () =>
    new Array(capacity + 1).fill(0),
  );
  for (let i = 1; i <= n; i++) {
    const weight = weights[i - 1];
    const value = values[i - 1];
    for (let c = 0; c <= capacity; c++) {
      table[i][c] = table[i - 1][c];
      if (weight <= c) {
        table[i][c] = Math.max(table[i][c], table[i - 1][c - weight] + value);
      }
    }
  }
  return table[n][capacity];
}

/** The same answer as `knapsackTable`, keeping one row of capacities. */
export function knapsack01(
  weights: number[],
  values: number[],
  capacity: number,
): number {
  const best: number[] = new Array(capacity + 1).fill(0);
  weights.forEach((weight, i) => {
    for (let c = capacity; c >= weight; c--) {
      best[c] = Math.max(best[c], best[c - weight] + values[i]);
    }
  });
  return best[capacity];
}

/** Best total value when every item may be used any number of times. */
export function unboundedKnapsack(
  weights: number[],
  values: number[],
  capacity: number,
): number {
  const best: number[] = new Array(capacity + 1).fill(0);
  weights.forEach((weight, i) => {
    for (let c = weight; c <= capacity; c++) {
      best[c] = Math.max(best[c], best[c - weight] + values[i]);
    }
  });
  return best[capacity];
}

/** Fewest coins (each reusable) that sum to `amount`, or -1 if impossible. */
export function minCoins(coins: number[], amount: number): number {
  const unreachable = amount + 1;
  const fewest: number[] = new Array(amount + 1).fill(unreachable);
  fewest[0] = 0;
  for (let a = 1; a <= amount; a++) {
    for (const coin of coins) {
      if (coin <= a) fewest[a] = Math.min(fewest[a], fewest[a - coin] + 1);
    }
  }
  return fewest[amount] < unreachable ? fewest[amount] : -1;
}

/** Ways to make `amount` where the order of the coins does not matter. */
export function countCombinations(coins: number[], amount: number): number {
  const ways: number[] = new Array(amount + 1).fill(0);
  ways[0] = 1;
  for (const coin of coins) {
    for (let a = coin; a <= amount; a++) ways[a] += ways[a - coin];
  }
  return ways[amount];
}

/** Ways to make `amount` where 1 + 2 and 2 + 1 count as different. */
export function countOrderings(coins: number[], amount: number): number {
  const ways: number[] = new Array(amount + 1).fill(0);
  ways[0] = 1;
  for (let a = 1; a <= amount; a++) {
    for (const coin of coins) {
      if (coin <= a) ways[a] += ways[a - coin];
    }
  }
  return ways[amount];
}
