---
title: Binary Search
summary: Finding the first point where a yes/no question flips by halving the range that could hold it, so a million candidates take about 20 questions.
date: 2026-10-05
kind: algorithm
---

Binary search finds where an answer flips from "no" to "yes" by asking about
the middle of the range that could still hold it and discarding the other
half. You'll write one loop, then use it twice: to find a value in a sorted
array, and to find the smallest truck that can carry a load in time.

## Prerequisites

None. You need arrays, whose elements are numbered from 0, and what sorted
means: each element is at least as large as the one before it.

## The idea

Take the game where someone picks a number from 1 to 100 and answers each guess
with "higher" or "lower". Guessing 50 rules out half the numbers whatever
the reply, so any number falls in at most 7 guesses. Binary search plays that
game against a sorted array.

The question to ask is not "is this the value?" but a yes/no question that
flips exactly once. Run it on `nums = [1, 3, 5, 5, 5, 8]` with the question
"is `nums[i] >= 5`?". Down the array the answers are no, no, yes, yes, yes,
yes, and you want the first yes, index 2. That index is the **lower bound**
of 5: the first position holding a value at least 5, or `len(nums)` if there
is none. It answers more than "is 5 here?":

- The value is present if the index is in range and `nums[i] == 5`.
- It is the index where 5 goes to keep the array sorted, and the count of
  elements smaller than 5.
- For integers, the lower bound of 6 minus the lower bound of 5 counts the
  fives: 5 - 2 = 3.

The search keeps a **half-open range** `[lo, hi)`: it includes `lo`, excludes
`hi`, holds `hi - lo` candidates, and is empty when they meet. The
**invariant**, the fact that stays true after every step, is that every
index before `lo` answers no, and every index from `hi` on answers yes (or
`hi` is the end, standing for "none"). Searching for 5:

| `lo` | `hi` | `mid` | `nums[mid]` | Answer to `>= 5` | Move                   |
| ---- | ---- | ----- | ----------- | ---------------- | ---------------------- |
| 0    | 6    | 3     | 5           | yes              | `hi = 3`: 3 may be it  |
| 0    | 3    | 1     | 3           | no               | `lo = 2`: 1 and 0 lose |
| 2    | 3    | 2     | 5           | yes              | `hi = 2`: 2 may be it  |
| 2    | 2    |       |             |                  | empty: the answer is 2 |

Why not scan from the left? A scan asks up to n questions. Binary search
exploits the single flip: one "no" at `mid` means everything before it is a
"no" too. The rule: when answers to a question are ordered no-then-yes, a
range can be halved by one question.

## When to use it

- The input is sorted, or you can sort it once and answer many queries: find,
  insert position, first or last occurrence, count in a range.
- The statement asks for the smallest or largest value that works ("least
  capacity", "minimum speed", "earliest day") and a bigger value never hurts.
  Then the candidates are the integers themselves, and you search the answer,
  checking each guess with a simulation.
- The limits are too large to try every value (10⁹ candidates) but a check
  costs O(n). The log of the range makes the guesses affordable.
- You can't phrase a yes/no question that flips only once. Then it's the wrong
  tool: scan, or use a [hash map](/dsa/hash-map) when you only need exact-key
  lookup.

Most languages ship the array case. Python's `bisect.bisect_left` and C++'s
`std::lower_bound` are exactly the lower bound; Java's `Arrays.binarySearch`
returns some matching index (not necessarily the first) or a negative number
encoding the insert position; JavaScript has no built-in. A database index is
this idea at scale
([database indexing](/systems-and-infrastructure/database-indexing)).

## Walkthrough

You'll write the loop over any yes/no question first, so a search over an
array and a search over an answer share every line.

```python region=first-true

```

```typescript region=first-true

```

The range starts as every candidate, and the loop runs while one is left.
`mid` rounds down, so it is always at least `lo` and below `hi`, which means
`ok(mid)` is never asked about the excluded end.

```python region=part-2

```

```typescript region=part-2

```

Each branch shrinks the range, so the loop ends, and each keeps the invariant,
so at `lo == hi` that index is the first yes. An empty input falls out for
free: the loop never runs and the answer is `hi`. Now point it at an array.

```python region=lower-bound

```

```typescript region=lower-bound

```

The upper end is `len(nums)`, one past the last index, because "every element
is smaller" is a legal answer. Now the other use: the smallest truck.

```python region=min-capacity

```

```typescript region=min-capacity

```

Take packages `[3, 2, 2, 4, 1, 4]` and 3 days. The range is `[4, 16)`, from the
heaviest package to the total. `mid = 10` is enough (2 days), so `hi = 10`;
7 is enough (3 days), so `hi = 7`; 5 needs 4 days, so `lo = 6`; 6 is enough, so
`hi = 6` and the answer is 6. Capacity grows, so once it's enough, anything
bigger is: the single flip the search needs.

## Complexity

A range of `s` candidates becomes at most `s / 2`, rounded down, on either
branch, so the loop makes at most `floor(log2 n) + 1` questions: 20 for a
million candidates. `lower_bound` is therefore O(log n) time, since each
question reads one element, and O(1) space. `min_capacity` makes O(log S)
questions, where S is the total weight, and each costs an O(n) pass, so it is
O(n log S): about 4 passes for the 12 candidates above, 30 for a range of a
billion.

## Pitfalls

- **`lo = mid` in the else branch.** When the range holds one index, `mid`
  rounds down to `lo`, so the range never changes and the loop never ends.
  Searching `[1]` for 5 hangs at once. `mid + 1` is required.
- **`>` where `>=` belongs.** In `lower_bound`, `nums[i] > target` finds the
  first element above the target, Python's `bisect_right`. On
  `[1, 3, 5, 5, 5, 8]` it returns 5 instead of 2. That is useful on
  purpose and a bug by accident.
- **Starting the answer search too low.** Begin `min_capacity` at 1 and
  `[4, 1]` with 3 days returns 1: the 4 fits no truck of capacity 1, but the
  simulation just starts a new day for it and counts it, so `enough(1)` says
  yes.
- **A question that flips more than once.** Binary search assumes ordered
  answers and returns some flip, silently. In an unsorted array `lower_bound`
  gives a number that means nothing; no error is raised.
