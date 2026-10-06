---
title: Backtracking
summary: Listing every combination of choices that satisfies a rule by walking the tree of choices depth first, undoing each choice on the way back, and skipping branches that can't succeed.
date: 2026-10-05
kind: pattern
template: 2
---

Some problems want every answer, not one: all the subsets of a list, all the
orders to line items up in, all the ways to reach a total. Backtracking is
depth-first search over a tree of choices, where each step makes a choice and
the way back undoes it. You'll write three versions on the values 2, 3 and 5.

## Prerequisites

- [Depth-first search](/dsa/depth-first-search): this is that walk over a tree
  nobody builds. A node is a partial answer, its children are the choices still
  open, and the call stack is the path from the root to where you are.

## The idea

Start with the subsets of `[2, 3, 5]`. Each node of the tree is a partial
answer, and its children are the ways to extend it. To reach every subset
exactly once, only add a value that sits after the last one taken, so `[2, 3]`
can be built and `[3, 2]` can't:

```text
[]
├── [2]
│   ├── [2, 3]
│   │   └── [2, 3, 5]
│   └── [2, 5]
├── [3]
│   └── [3, 5]
└── [5]
```

Every solution makes the same three moves: **choose** a value, **explore** by
recursing on what's still open, and **unchoose** it so the next sibling starts
clean. One list, `chosen`, holds the current path, appended to on the way down
and popped on the way back. Because it keeps changing, you record a copy when a
node is an answer.

Problems differ in two things: which choices are open at a node, and when a
node counts as an answer.

- **Subsets.** Every node is an answer. The open choices are the values after
  the last one taken.
- **Permutations**, every ordering of all the values. Only a node that has
  used every value is an answer. The open choices are the values not yet used,
  so you need a flag per position; a start index can't do it, because after
  taking 3 first, 2 is still open even though it sits earlier.
- **Combination sum.** Given positive candidates and a target, list every
  combination that adds up to the target, where a candidate can be reused. A
  node is an answer when the amount **remaining** (target minus the sum so
  far) is 0. The open choices are the candidates from the last one used
  onward, that one included.

Combination sum is where the tree gets cut. With candidates `[2, 3, 5]` and a
target of 8, the search makes 13 calls:

| Call | Chosen     | `remaining` | What happens            |
| ---- | ---------- | ----------- | ----------------------- |
| 1    | nothing    | 8           | try 2, 3, 5             |
| 2    | 2          | 6           | try 2, 3, 5             |
| 3    | 2, 2       | 4           | try 2, 3 (5 is too big) |
| 4    | 2, 2, 2    | 2           | try 2 (3 is too big)    |
| 5    | 2, 2, 2, 2 | 0           | **answer**              |
| 6    | 2, 2, 3    | 1           | dead end                |
| 7    | 2, 3       | 3           | try 3 (5 is too big)    |
| 8    | 2, 3, 3    | 0           | **answer**              |
| 9    | 2, 5       | 1           | dead end                |
| 10   | 3          | 5           | try 3, 5                |
| 11   | 3, 3       | 2           | dead end                |
| 12   | 3, 5       | 0           | **answer**              |
| 13   | 5          | 3           | dead end                |

The answers are `[2, 2, 2, 2]`, `[2, 3, 3]` and `[3, 5]`. **Pruning** is
refusing to enter a subtree that can't hold an answer; here, any candidate
bigger than `remaining` is skipped, and since the candidates are sorted so is
every candidate after it. The obvious alternative is to generate every list and
filter at the end, but that never notices a doomed partial answer, so it pays
for the whole subtree beneath it.

## When to use it

- The problem says "list all" or "generate every", or "how many" when no
  formula exists, so the answers have to be enumerated.
- The answer is built from a sequence of choices (include this value, put this
  piece here, place a queen in this row), and a rule rejects some combinations.
- A partial answer can be rejected before it's finished, as `remaining` does.
  That's when pruning shrinks the tree a lot.
- If you only want a count or the best answer, and different branches reach the
  same sub-problem, [dynamic programming](/dsa/dynamic-programming) beats it.

## Walkthrough

```python
def subsets(values: list[int]) -> list[list[int]]:
    """Every subset of distinct values, each in input order, depth first."""
    result: list[list[int]] = []
    chosen: list[int] = []

    def visit(start: int) -> None:
        # A copy: the pops below empty chosen before the function returns.
        result.append(chosen.copy())
        for i in range(start, len(values)):
            chosen.append(values[i])
            # i + 1, not start + 1: only values after this one may follow,
            # or repeats like [3, 3] and reversals like [5, 3] appear.
            visit(i + 1)
            # Undo, or the next sibling starts from this branch's choice.
            chosen.pop()

    visit(0)
    return result
```

```typescript
/** Every subset of distinct values, each in input order, depth first. */
export function subsets(values: readonly number[]): number[][] {
  const result: number[][] = [];
  const chosen: number[] = [];

  const visit = (start: number): void => {
    // A copy: the pops below empty chosen before the function returns.
    result.push([...chosen]);
    for (let i = start; i < values.length; i++) {
      chosen.push(values[i]);
      // i + 1, not start + 1: only values after this one may follow,
      // or repeats like [3, 3] and reversals like [5, 3] appear.
      visit(i + 1);
      // Undo, or the next sibling starts from this branch's choice.
      chosen.pop();
    }
  };

  visit(0);
  return result;
}
```

`visit(start)` means "`chosen` is a subset; record it, then extend it with any
value from `start` on". Recording comes first because every node is an answer,
so `[]` leads and the order is the tree above read top to bottom. Equal values
count as different choices, so `subsets([1, 1])` returns `[1]` twice.

```python
def permutations(values: list[int]) -> list[list[int]]:
    """Every ordering of distinct values, in itertools.permutations order."""
    result: list[list[int]] = []
    chosen: list[int] = []
    # One flag per position: `values[i] in chosen` rescans the list on every
    # check and mistakes equal values at different positions for each other.
    used = [False] * len(values)

    def visit() -> None:
        if len(chosen) == len(values):
            result.append(chosen.copy())
            return  # Without it, a full path would still loop over the flags.
        for i in range(len(values)):
            if used[i]:
                continue
            used[i] = True
            chosen.append(values[i])
            visit()
            chosen.pop()
            # Undo the flag too, or the first full path leaves every one set.
            used[i] = False

    visit()
    return result
```

```typescript
/** Every ordering of distinct values, in lexicographic order of positions. */
export function permutations(values: readonly number[]): number[][] {
  const result: number[][] = [];
  const chosen: number[] = [];
  // One flag per position: `chosen.includes(values[i])` rescans the list on
  // every check and mistakes equal values at different positions for each other.
  const used: boolean[] = values.map(() => false);

  const visit = (): void => {
    if (chosen.length === values.length) {
      result.push([...chosen]);
      return; // Without it, a full path would still loop over the flags.
    }
    for (let i = 0; i < values.length; i++) {
      if (used[i]) continue;
      used[i] = true;
      chosen.push(values[i]);
      visit();
      chosen.pop();
      // Undo the flag too, or the first full path leaves every one set.
      used[i] = false;
    }
  };

  visit();
  return result;
}
```

The loop restarts at position 0 every time, since any unused value may come
next, and a flag is state like `chosen` is, so it is undone the same way. On
`[2, 3, 5]` it returns `[2, 3, 5]`, `[2, 5, 3]`, `[3, 2, 5]`, `[3, 5, 2]`,
`[5, 2, 3]`, `[5, 3, 2]`: six answers, because nodes shorter than three are
only stops on the way.

```python
def combination_sum(candidates: list[int], target: int) -> list[list[int]]:
    """Every combination of positive candidates, each reusable, adding to target."""
    # A set: a repeated candidate would be two choices and double the answers.
    options = sorted(set(candidates))
    # Zero never shrinks remaining and a negative grows it: no end to the walk.
    if options and options[0] <= 0:
        raise ValueError("candidates must be positive")
    result: list[list[int]] = []
    chosen: list[int] = []

    def visit(start: int, remaining: int) -> None:
        if remaining == 0:
            result.append(chosen.copy())
            return
        for i in range(start, len(options)):
            # break, not continue: sorted, so every later candidate is at
            # least as big and no subtree under any of them can fit.
            if options[i] > remaining:
                break
            chosen.append(options[i])
            # i, not i + 1: the same candidate stays available for reuse.
            visit(i, remaining - options[i])
            chosen.pop()

    visit(0, target)
    return result
```

```typescript
/** Every combination of positive candidates, each reusable, adding to `target`. */
export function combinationSum(
  candidates: readonly number[],
  target: number,
): number[][] {
  // A set: a repeated candidate would be two choices and double the answers.
  const options = [...new Set(candidates)].sort((a, b) => a - b);
  // Zero never shrinks remaining and a negative grows it: no end to the walk.
  if (options.length > 0 && options[0] <= 0) {
    throw new RangeError('candidates must be positive');
  }
  const result: number[][] = [];
  const chosen: number[] = [];

  const visit = (start: number, remaining: number): void => {
    if (remaining === 0) {
      result.push([...chosen]);
      return;
    }
    for (let i = start; i < options.length; i++) {
      // break, not continue: sorted, so every later candidate is at least as
      // big and no subtree under any of them can fit.
      if (options[i] > remaining) break;
      chosen.push(options[i]);
      // i, not i + 1: the same candidate stays available for reuse.
      visit(i, remaining - options[i]);
      chosen.pop();
    }
  };

  visit(0, target);
  return result;
}
```

`remaining` is an argument, so each call has its own copy and nothing needs
undoing; only `chosen` does. On `[2, 3, 5]` and 8 this makes the 13 calls in the
table. A target of 0 returns `[[]]`, the one combination that uses nothing.

## Complexity

The cost is the size of the tree you walk. Subsets have one node per subset,
2^n for n values, because each value is in or out. Permutations have n!
leaves (6 for three values, 3,628,800 for ten) and fewer than 3 · n! nodes in
all. Recording an answer copies up to n values, so the time is O(n · 2^n) for
subsets and O(n · n!) for permutations, and the output alone is that big.
Beyond it, the extra space is O(n): the recursion depth, `chosen` and the
flags. That is why the pattern suits about 20 values for subsets and 10 for
permutations.

Combination sum has no tidy formula, and the tree can be far bigger than the
output. Candidates `[2, 4]` and a target of 81 have no answer, yet the search
makes 441 calls to say so, because pruning can't tell an odd target is
unreachable. With k candidates and depth D (the target divided by the smallest
candidate) there are at most C(D + k, k) calls: polynomial in D, exponential in
k. Raising the target to 161 (twice the depth) takes 441 calls to 1,681.

## Pitfalls

- **Recording `chosen` itself.** `result.append(chosen)` stores the one shared
  list, which is empty by the time the search ends, so the result is a row of
  empty lists. The `.copy()` is what freezes each answer.
- **Forgetting an undo.** Drop `used[i] = False` and the first full path leaves
  every flag set, so `[2, 3, 5]` returns one permutation instead of six.
- **The wrong index in the recursive call.** In `subsets`, `start + 1` adds
  repeats and reversals such as `[3, 3]` and `[5, 3]`, and `i` would take 2
  again forever. In `combination_sum`, `i + 1` forbids reuse, so `[2, 3, 5]`
  with target 8 returns only `[[3, 5]]`.
- **Pruning with `break` on unsorted candidates.** Without the `sorted`, a big
  candidate ahead of a small one ends the loop early: `[8, 3]` with a target of
  3 returns `[]`, though `[3]` fits.
