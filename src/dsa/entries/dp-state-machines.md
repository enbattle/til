---
title: 'Dynamic Programming: State Machines'
summary: Solving step-by-step problems where the best move depends on which situation you are in, by keeping one best value per situation and writing down how each situation turns into the next, shown on buying and selling a stock with a fee, a cooldown, or a limit on trades.
date: 2026-10-01
kind: pattern
---

Some dynamic programming problems cannot be described by one best value per
step, because what you may do next depends on a condition you are in: holding a
share or not, resting after a sale or free to buy. The fix is to keep one best
value for each condition and write a rule for how each condition on one step
turns into the conditions on the next. A set of conditions with such rules is
called a **state machine**; each condition is a **state** and each rule a
**transition**. The standard worked family is stock trading: you are given the
price of one share on each day, you may hold at most one share at a time, and
you want the most profit. This entry solves three variants, with a fee on every
sale, with a one-day wait after every sale, and with a cap on the number of
trades.

## Prerequisites

- [Dynamic Programming: One Dimension](/dsa/dp-one-dimensional): the idea of a
  recurrence (an answer built from answers to smaller versions) and of keeping
  only a few variables instead of a whole table. House robber there is already
  a two-state machine: `best` is the best total so far (which may include the
  previous house, so the current one can't be added to it) and `skipped` is
  the best one house back (the only total the current house may be added to),
  and each step computes both new
  values from both old ones. Everything below is that shape with more
  vocabulary.

## The idea

**One value per state.** Take the simplest variant: any number of trades, a
**fee** paid on each sale. After each day you are in exactly one of two states.
In **holding**, you own a share. In **free**, you do not. The value stored for a
state is the most cash you can have at the end of the day while in that state,
counting everything you have spent and earned so far, starting from 0 cash.
So `holding` is usually negative: you paid for the share and have not sold it
yet. Each day, a state can be reached in two ways, and you keep the better:

```text
holding_today = max(holding_yesterday, free_yesterday - price)
free_today    = max(free_yesterday,    holding_yesterday + price - fee)
```

You are holding today either because you already were (do nothing) or because
you bought today out of the free state, paying `price`. You are free today
either because you already were or because you sold today out of the holding
state, receiving `price` and paying the fee. Both right-hand sides read
yesterday's values. At the end you can be holding a share only by having failed
to sell it at a profit, so the answer is `free`.

Here is that for prices `[1, 3, 2, 8, 4, 9]` and a fee of 2, with `holding`
starting at minus infinity (explained next):

| Day | Price | `holding` | `free` |
| --- | ----- | --------- | ------ |
| 0   | 1     | -1        | 0      |
| 1   | 3     | -1        | 0      |
| 2   | 2     | -1        | 0      |
| 3   | 8     | -1        | 5      |
| 4   | 4     | 1         | 5      |
| 5   | 9     | 1         | 8      |

On day 3, `free` becomes max(0, -1 + 8 - 2) = 5: buy at 1, sell at 8, pay 2. On
day 4, `holding` becomes max(-1, 5 - 4) = 1: with 5 in hand, buying at 4 leaves
1, which beats the -1 from owning the share bought at 1. On day 5, `free` is
max(5, 1 + 9 - 2) = 8. The answer is 8: 5 from the first trade, 3 from buying
at 4 and selling at 9. The first trade did not stop at day 1, where selling at
3 would have given 0 after the fee.

**The starting value of `holding`.** Before day 0 you own nothing, so the
state "holding" is unreachable, and the honest value for an unreachable state
is minus infinity: no plan ends there, so `max` never picks it. Day 0 then
turns it into `-price` through the buy transition, and the table above shows
-1. Starting `holding` at 0 instead says you begin the day owning a share you
paid nothing for. With prices `[5, 4]` and a fee of 1, the correct answer is 0,
since the price only falls. With `holding = 0` the code sells that free share on
day 0 for 5 - 1 = 4. The alternative to minus infinity is to start `holding` at
`-prices[0]` and loop from day 1; that works for the same reason but needs the
empty list handled separately.

**A third state for the cooldown.** Now remove the fee and add a rule: after
selling on a day, you cannot buy on the next day. "Free" now hides two
different situations, because a day just after a sale looks different from a
quiet day later. So there are three states: **holding**, **sold** (you sold
today) and **resting** (not holding, and not having sold today, so free to buy
tomorrow). The transitions:

```text
            buy                      sell
resting ----------> holding ------------------> sold
  ^  |                 ^  |                        |
  |  +-- wait          +--+ wait                   |
  |                                                |
  +------------------------------------------------+
             next day, no choice (the cooldown)
```

A buy is only drawn out of `resting`, never out of `sold`, which is how the
cooldown is enforced. The three new values are:

```text
holding_today = max(holding_yesterday, resting_yesterday - price)
sold_today    = holding_yesterday + price
resting_today = max(resting_yesterday, sold_yesterday)
```

The answer is the larger of `sold` and `resting`, because the last day may be
a sale day. For prices `[1, 2, 3, 0, 2]`, with `-inf` for the unreachable
start:

| Day | Price | `holding` | `sold` | `resting` |
| --- | ----- | --------- | ------ | --------- |
| 0   | 1     | -1        | -inf   | 0         |
| 1   | 2     | -1        | 1      | 0         |
| 2   | 3     | -1        | 2      | 1         |
| 3   | 0     | 1         | -1     | 2         |
| 4   | 2     | 1         | 3      | 2         |

The answer is max(3, 2) = 3: buy at 1, sell at 2 on day 1, rest on day 2, buy at
0 on day 3, sell at 2 on day 4. The tempting alternative is to hold on and sell
at 3 on day 2, which makes `sold` 2, but day 3 is then the cooldown day and the
buy at 0 is not allowed. The table shows how the machine refuses it: `holding`
on day 3 is `resting` from day 2 minus the price, 1 - 0 = 1, and `resting`
on day 2 is 1, the day-1 sale having moved across a day. The 2 from selling on
day 2 sits in `sold` and is not available to a buy until day 4.

**At most k trades.** Counting trades means the state has to say how many
trades are used, so the machine grows: for each trade number there is a
holding state and a done state. A trade is counted when it begins. `done[j]` is
the best cash with `j` trades finished and no share in hand, and `holding[j]`
the best cash while holding the share of trade number `j + 1`. Then:

```text
holding[j]   = max(holding[j], done[j] - price)
done[j + 1]  = max(done[j + 1], holding[j] + price)
```

That is 2k + 1 states: k of `holding` and k + 1 of `done` (`done[0]` never
changes, so 2k of them move). Every `done[j]` starts
at 0, which makes `done[j]` mean "at most `j` trades finished", so the answer is
`done[k]` and a plan that uses fewer trades is allowed. For prices
`[3, 2, 6, 5, 0, 3]` and k = 2:

| Day | Price | `holding[0]` | `holding[1]` | `done[1]` | `done[2]` |
| --- | ----- | ------------ | ------------ | --------- | --------- |
| 0   | 3     | -3           | -3           | 0         | 0         |
| 1   | 2     | -2           | -2           | 0         | 0         |
| 2   | 6     | -2           | -2           | 4         | 4         |
| 3   | 5     | -2           | -1           | 4         | 4         |
| 4   | 0     | 0            | 4            | 4         | 4         |
| 5   | 3     | 0            | 4            | 4         | 7         |

(`done[0]` is 0 on every day and is left out.) On day 4, `holding[1]` is
max(-1, `done[1]` - 0) = 4: the first trade (buy at 2, sell at 6) banked 4, and
the second buy at 0 leaves that 4 in hand. On day 5, `done[2]` is
`holding[1]` + 3 = 7, the answer: 4 from the first trade, 3 from the second.

**Reading yesterday's values.** Each state today is computed from the states
yesterday. If you update one state first and then read it while computing
another, a day is allowed to do two things. In the cooldown machine this is a
real bug: computing `resting` first and then `holding` from the new `resting`
lets a share be bought the day after a sale. For `[11, 6, 2, 2, 3, 0, 1]` that
gives 2 (buy at 2 and sell at 3 on day 4, buy at 0 on day 5, sell at 1), where
the true answer is 1. In the other two machines the same slip is harmless by
construction: all it adds is a buy and a sell on the same day, which changes
cash by 0 (or loses the fee), so it can never raise a `max`, and the extra
trade it spends is still within "at most `j`". Reading yesterday's values
everywhere is still the safer habit, since the next machine may have a
cooldown.

## When to use it

Reach for a state machine when a one-dimensional recurrence needs a flag: a
yes/no condition that changes what the next step may do, or a small counter.
The signs in a problem statement are "at most k", "you cannot do X right after
Y", "you must", "while you hold", or a cost that applies only on a particular
move. Stock trading is the textbook case, but the same shape appears in
house robber (took the last house or did not), in painting a row of houses so
that neighbours differ (the state is the colour of the last house), and in
counting binary strings with no two consecutive 1s (the state is the last
digit).

It fits when the number of states is small and fixed, so each step does a
constant amount of work per state. When the state would need to be a whole
subset or position, it is the wrong tool, and a table over two indices or a
different method is needed. When the rule is simply
"take every profitable rise", as with unlimited trades and no fee, a one-line
greedy sum does the job and a machine is more than needed.

## Walkthrough

```python
from math import inf


def max_profit_with_fee(prices: list[int], fee: int) -> int:
    """Most profit from any number of buy/sell trades, paying fee on each sale."""
    holding, free = -inf, 0
```

```typescript
/** Most profit from any number of buy/sell trades, paying `fee` on each sale. */
export function maxProfitWithFee(prices: number[], fee: number): number {
  let holding = -Infinity;
  let free = 0;
```

`holding` starts at minus infinity because before the first day you cannot be
holding anything, and `free` at 0 because you have made no money and spent
none. `-inf` works in arithmetic: `-inf + price` is still `-inf`, and
`max(-inf, x)` is `x`, so no special case is needed for the first day. The
empty list leaves both values untouched and returns 0. Starting `holding` at 0
would let day 0 sell a share nobody bought, as in the `[5, 4]` example above.

```python
    for price in prices:
        holding, free = max(holding, free - price), max(free, holding + price - fee)
    return free
```

```typescript
  for (const price of prices) {
    const nextHolding = Math.max(holding, free - price);
    const nextFree = Math.max(free, holding + price - fee);
    holding = nextHolding;
    free = nextFree;
  }
  return free;
}
```

Both new values are computed from both old values before either variable is
overwritten. Python's tuple assignment evaluates the whole right side first,
so one line is enough; TypeScript needs the two `next` constants to get the
same effect. Returning `free` and not `max(holding, free)` is deliberate: a
final `holding` is a share bought and never sold, which is never worth more
than not buying it, as long as prices are not negative.

```python
def max_profit_with_cooldown(prices: list[int]) -> int:
    """Most profit from any number of trades, no buying the day after a sale."""
    holding, sold, resting = -inf, -inf, 0
```

```typescript
/** Most profit from any number of trades, no buying the day after a sale. */
export function maxProfitWithCooldown(prices: number[]): number {
  let holding = -Infinity;
  let sold = -Infinity;
  let resting = 0;
```

Two states start unreachable. `sold` is minus infinity too, because on no day
before the first have you sold anything. Here the choice happens not to matter,
since `resting` already starts at 0 and `max(resting, sold)` keeps it there
either way, but minus infinity says what is meant. The state that must not
start at 0 is `holding`, for the reason given under the fee version.

```python
    for price in prices:
        holding, sold, resting = (
            max(holding, resting - price),
            holding + price,
            max(resting, sold),
        )
    return max(sold, resting)
```

```typescript
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
```

The three lines are the three transitions from the diagram. The cooldown lives
in one place: the buy reads `resting`, and a sale only reaches `resting` a day
later, through `max(resting, sold)`. Replacing `resting - price` with
`max(resting, sold) - price`, which is what updating `resting` first amounts
to, lets a buy follow a sale straight away, and the brute-force test catches
it. `sold = holding + price` has no `max` because there is only one way to have
sold today: be holding yesterday. The final `max` is needed since the best plan
may end with a sale on the last day or any time before it.

```python
def max_profit_k_transactions(prices: list[int], k: int) -> int:
    """Most profit from at most k buy/sell trades, holding one share at a time."""
    k = max(0, min(k, len(prices) // 2))
    holding = [-inf] * k
    done = [0] * (k + 1)
```

```typescript
/** Most profit from at most `k` buy/sell trades, holding one share at a time. */
export function maxProfitKTransactions(prices: number[], k: number): number {
  k = Math.max(0, Math.min(k, Math.floor(prices.length / 2)));
  const holding: number[] = new Array(k).fill(-Infinity);
  const done: number[] = new Array(k + 1).fill(0);
```

The first line clamps `k` to between 0 and half the number of days. A trade
needs a buy day and a later sell day, one action per day, so `n` days hold at
most `n // 2` trades, and a larger `k` changes nothing. Without the cap,
`k = 1_000_000_000` would build lists of a billion entries; with it, the lists
never exceed `n // 2`. A negative `k` becomes 0 and gives an empty `holding`.
`done` has `k + 1` entries because `done[0]`, the zero-trades state, is always
0, and the rest start at 0 so that unused trades cost nothing.

```python
    for price in prices:
        old_holding, old_done = holding[:], done[:]
        for j in range(k):
            holding[j] = max(old_holding[j], old_done[j] - price)
            done[j + 1] = max(old_done[j + 1], old_holding[j] + price)
    return done[k]
```

```typescript
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
```

Each day starts by copying yesterday's lists, and every right-hand side reads
the copies. Without them, `done[j + 1]` would read the `holding[j]` just
written, a buy and a sell on the same day. That adds nothing here, so the
answer would not change; the copies keep the code matching the transitions,
so that the rule "read yesterday" has no exceptions to remember. The copy costs
O(k) per day, the same as the loop. The inner loop covers both transitions for
trade `j`: buy it out of `done[j]` (j trades finished), and finish it out of
`holding[j]`. Returning `done[k]` and not `done[-1]`, or a `max` over all of
`done`, is the same value, because every `done` entry started at 0 and so
already counts plans that use fewer trades.

## Complexity

The fee and cooldown versions make one pass over the `n` prices with a fixed
number of states, so O(n) time and O(1) extra space. The k version does O(k)
work per day, after the clamp k is at most n / 2, so it is O(nk) time, which is
O(n²) when k is large, and O(k) space for the two lists. For 1,000 days and
k = 100 the inner loop runs 100,000 times. Using the unlimited-trades version
instead is O(n) and is the right answer when k is at least n / 2, since the cap
is never reached.

The brute force the tests use tries every sequence of buy, sell or do nothing
on each day, 3^n sequences: 6,561 for 8 days and about 3.5 billion for 20. That
is why the tests keep prices to at most 8 days, and why the DP exists.

## Pitfalls

- **Initialising the holding state to 0.** It means "I own a share I did not
  pay for", and the code sells it. Use minus infinity, or `-prices[0]` and
  start the loop on day 1. With `[5, 4]` and a fee of 1 the answer is 0, and
  `holding = 0` returns 4.
- **Using a state's new value inside the same day.** In the cooldown machine
  this lets a buy follow a sale straight away; compute every new value from
  yesterday's, with a tuple assignment, temporaries or copied lists.
- **Charging the cooldown to the wrong state.** The buy must read `resting`,
  not `sold` and not "any not-holding state". Merging `sold` and `resting` into
  one `free` state gives the answer of the fee-free unlimited problem.
- **Counting the trade on both ends in the k version.** A trade is counted
  once, when the buy moves from `done[j]` to `holding[j]`. Counting it again on
  the sale would use up trades twice as fast.
- **Returning the wrong state.** The answer is a state with no share in hand:
  `free`, the larger of `sold` and `resting`, or `done[k]`. A `holding` value
  is never the answer.
- **Forgetting that `k` can be huge or zero.** Without the clamp, a large `k`
  allocates `k` entries per list; with `k = 0` the loops run zero times and the
  answer is 0, which is correct and worth a test.
- **Charging the fee on the wrong move.** The fee here is paid once per trade,
  on the sale. Subtracting it in the buy transition as well makes every trade
  cost twice as much, and `[1, 5]` with a fee of 3 would show 0 instead of 1.
