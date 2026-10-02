/** Most profit from any number of buy/sell trades, paying `fee` on each sale. */
export function maxProfitWithFee(prices: number[], fee: number): number {
  let holding = -Infinity;
  let free = 0;
  for (const price of prices) {
    const nextHolding = Math.max(holding, free - price);
    const nextFree = Math.max(free, holding + price - fee);
    holding = nextHolding;
    free = nextFree;
  }
  return free;
}

/** Most profit from any number of trades, no buying the day after a sale. */
export function maxProfitWithCooldown(prices: number[]): number {
  let holding = -Infinity;
  let sold = -Infinity;
  let resting = 0;
  for (const price of prices) {
    const nextHolding = Math.max(holding, resting - price);
    const nextSold = holding + price;
    const nextResting = Math.max(resting, sold);
    holding = nextHolding;
    sold = nextSold;
    resting = nextResting;
  }
  return Math.max(sold, resting);
}

/** Most profit from at most `k` buy/sell trades, holding one share at a time. */
export function maxProfitKTransactions(prices: number[], k: number): number {
  k = Math.max(0, Math.min(k, Math.floor(prices.length / 2)));
  const holding: number[] = new Array(k).fill(-Infinity);
  const done: number[] = new Array(k + 1).fill(0);
  for (const price of prices) {
    const oldHolding = [...holding];
    const oldDone = [...done];
    for (let j = 0; j < k; j++) {
      holding[j] = Math.max(oldHolding[j], oldDone[j] - price);
      done[j + 1] = Math.max(oldDone[j + 1], oldHolding[j] + price);
    }
  }
  return done[k];
}
