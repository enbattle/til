---
title: Backtracking
summary: Generating every subset, permutation or combination that fits a rule by walking a tree of choices depth first, adding a choice, recursing, then undoing it, and cutting off branches that can no longer succeed.
date: 2026-10-01
kind: pattern
---

Some problems ask for every answer, not one: all the subsets of a list, all the
orders you can line items up in, all the ways to reach a total. **Backtracking**
is the way to write those. It makes one choice at a time, explores everything
that follows from the choice, then undoes it and tries the next. The choices
form a tree, but the program never builds that tree. The recursion walks it,
and the call stack is the path from the root to wherever the walk is now.

## Prerequisites

- [Tree Depth-First Search](/dsa/tree-dfs): its root-to-leaf path search
  already does the three moves used here, appending a value on the way down,
  recursing, and popping it on the way back, and it already explains why the
  recorded path must be a copy. This entry reuses all of that and changes only
  where the children come from.

## The idea

In the tree entry the children of a node were fixed by the data: a left and a
right. Here the children are the **choices still open** at that moment, and
each problem decides which those are. Take the subsets of `[1, 2, 3]`. A
subset is built by deciding, in input order, which values to take. A rule that
makes each subset appear once is to only ever add a value that sits **after**
the last one taken, so that `[1, 3]` can be reached but `[3, 1]` can't. The
tree of partial answers then looks like this, with every node being one
subset:

```text
[]
├── [1]
│   ├── [1, 2]
│   │   └── [1, 2, 3]
│   └── [1, 3]
├── [2]
│   └── [2, 3]
└── [3]
```

Reading the tree top to bottom, left to right is the order in which the code
below returns the answers: `[]`, `[1]`, `[1, 2]`, `[1, 2, 3]`, `[1, 3]`, `[2]`,
`[2, 3]`, `[3]`, eight subsets for three values. That order is fixed, so the
two languages can be checked against each other, and every function in this
entry documents its own.

The same skeleton covers three problems that differ only in which choices are
open and when a node counts as an answer:

- **Subsets of distinct values.** Every node is an answer. The open choices are
  the values after the last one taken.
- **Permutations of distinct values**, meaning every ordering of all of them.
  Only a node that has used every value is an answer. The open choices are the
  values not yet used, so a **used flag** for each position records which those
  are. A start index can't do that job: after taking `2` as the first value,
  `1` is still open even though it sits before it.
- **Combination sum.** Given a list of positive candidate numbers and a
  target, find every combination of candidates adding up to the target, where
  each candidate may be used any number of times. A node is an answer when the
  amount **remaining** (target minus the sum so far) is exactly 0. The open
  choices are the candidates from the last one used onward, and the same one
  stays available, which is what allows repeats.

Take candidates `[2, 3, 5]` and a target of 8. The search makes 13 calls, one
per node of the tree, in this order:

| Call | `remaining` | Chosen so far | What happens                    |
| ---- | ----------- | ------------- | ------------------------------- |
| 1    | 8           | (nothing)     | try 2, then 3, then 5           |
| 2    | 6           | 2             | try 2, 3, 5                     |
| 3    | 4           | 2, 2          | try 2, then 3; 5 is more than 4 |
| 4    | 2           | 2, 2, 2       | try 2; 3 is more than 2, stop   |
| 5    | 0           | 2, 2, 2, 2    | **answer** `[2, 2, 2, 2]`       |
| 6    | 1           | 2, 2, 3       | every candidate exceeds 1, stop |
| 7    | 3           | 2, 3          | try 3; 5 is more than 3         |
| 8    | 0           | 2, 3, 3       | **answer** `[2, 3, 3]`          |
| 9    | 1           | 2, 5          | every candidate exceeds 1, stop |
| 10   | 5           | 3             | try 3, then 5                   |
| 11   | 2           | 3, 3          | every candidate exceeds 2, stop |
| 12   | 0           | 3, 5          | **answer** `[3, 5]`             |
| 13   | 3           | 5             | 5 is more than 3, stop          |

The answers are `[2, 2, 2, 2]`, `[2, 3, 3]` and `[3, 5]`. Calls 6, 9, 11 and 13
are dead ends: the running total is below the target but no candidate fits in
what is left. **Pruning** means skipping part of the tree that cannot contain
an answer. Here it is the rule "stop as soon as a candidate is larger than
`remaining`", and it removes whole subtrees, because every candidate after
that one is at least as large.

## When to use it

Use it when the question is "list every ...", or "how many ..." where no
formula exists and the choices have to be enumerated: all subsets with a given
sum, all ways to arrange items, all ways to split a string so that each piece
satisfies a rule, all valid placements on a board. The pattern also solves
"is there any ..." problems on small inputs, by stopping at the first answer
instead of collecting them all.

The signal is a problem built from a sequence of independent-looking choices
with a rule that rejects some combinations of them. If the rule lets you throw
a partial answer away early, as the target does in combination sum, the search
gets much smaller than the full tree. If the question asks only for the best
answer, or for a count, and overlapping parts of the search repeat the same
work, a [dynamic programming](/dsa/dp-one-dimensional) table usually does
better. Backtracking is the choice when the answers themselves are wanted.

## Walkthrough

```python
def subsets(values: list[int]) -> list[list[int]]:
    """Every subset of distinct values, each in input order, in depth-first order."""
    result: list[list[int]] = []
    chosen: list[int] = []

    def visit(start: int) -> None:
        result.append(chosen.copy())
        for i in range(start, len(values)):
            chosen.append(values[i])
            visit(i + 1)
            chosen.pop()

    visit(0)
    return result
```

```typescript
/** Every subset of distinct values, each in input order, in depth-first order. */
export function subsets(values: readonly number[]): number[][] {
  const result: number[][] = [];
  const chosen: number[] = [];

  const visit = (start: number): void => {
    result.push([...chosen]);
    for (let i = start; i < values.length; i++) {
      chosen.push(values[i]);
      visit(i + 1);
      chosen.pop();
    }
  };

  visit(0);
  return result;
}
```

`chosen` is the path from the root to the current node, the same shared list
the tree entry used, and `visit(start)` means "`chosen` is a subset; record it,
then extend it with any value from position `start` onward". Recording comes
before the loop because every node is an answer, which is why `[]` comes first.
The recursive call passes `i + 1`, not `start + 1` and not `i`. With `i`, the
value just taken could be taken again and `[1, 1]` would appear. With
`start + 1`, every iteration of the loop would hand its child the same start
and go back over values already passed: after taking `3` at position 2 the
child would start at position 1, and `[3, 2]` would be built, a reordering of
`[2, 3]`. The copy at
the top matters for the reason given in the tree entry: the pops will empty
`chosen` by the time the function returns, so recording the list itself would
return `[[], [], ...]`. The `visit(0)` at the end starts the walk, and an empty
input returns `[[]]`, since the empty subset is a subset of everything.

```python
def permutations(values: list[int]) -> list[list[int]]:
    """Every ordering of distinct values, in the order itertools.permutations gives."""
    result: list[list[int]] = []
    chosen: list[int] = []
    used = [False] * len(values)

    def visit() -> None:
        if len(chosen) == len(values):
            result.append(chosen.copy())
            return
```

```typescript
/** Every ordering of distinct values, in lexicographic order of input positions. */
export function permutations(values: readonly number[]): number[][] {
  const result: number[][] = [];
  const chosen: number[] = [];
  const used: boolean[] = values.map(() => false);

  const visit = (): void => {
    if (chosen.length === values.length) {
      result.push([...chosen]);
      return;
    }
```

A permutation uses every value exactly once, so the answers are the nodes at
full length, and nodes shorter than that are only stops on the way. Hence the
check on `chosen`'s length, with a `return` so that a full node doesn't go on
to look for a next value that doesn't exist. `used` has one flag per **position**
in the input, not per value. That keeps the answer right even if two positions
hold equal values, and each check costs one lookup. The obvious alternative,
`if value in chosen`, scans the whole list for every check, which makes each
step cost up to n instead of 1 (n being the number of values), and it
conflates equal values with each other.

```python
        for i in range(len(values)):
            if used[i]:
                continue
            used[i] = True
            chosen.append(values[i])
            visit()
            chosen.pop()
            used[i] = False

    visit()
    return result
```

```typescript
    for (let i = 0; i < values.length; i++) {
      if (used[i]) continue;
      used[i] = true;
      chosen.push(values[i]);
      visit();
      chosen.pop();
      used[i] = false;
    }
  };

  visit();
  return result;
}
```

The loop always starts at position 0 and skips the positions in use, because
any unused value may come next. Marking a position as used is a choice like
appending to `chosen`, so it has to be undone the same way, on the way back
out. Forget the `used[i] = False` and the first complete branch leaves every
flag set: the search would find `[1, 2, 3]` and then see no open position
anywhere, so a three-value input would return one answer instead of six. The
loop takes positions in increasing order, so the answers come out in
lexicographic order of positions, which is the order Python's
`itertools.permutations` produces, and the tests compare against it directly.
The result for `[1, 2, 3]` is `[1, 2, 3]`, `[1, 3, 2]`, `[2, 1, 3]`,
`[2, 3, 1]`, `[3, 1, 2]`, `[3, 2, 1]`.

```python
def combination_sum(candidates: list[int], target: int) -> list[list[int]]:
    """Every combination of positive candidates, each reusable, adding to target."""
    options = sorted(set(candidates))
    if options and options[0] <= 0:
        raise ValueError("candidates must be positive")
    result: list[list[int]] = []
    chosen: list[int] = []
```

```typescript
/** Every combination of positive candidates, each reusable, adding to `target`. */
export function combinationSum(
  candidates: readonly number[],
  target: number,
): number[][] {
  const options = [...new Set(candidates)].sort((a, b) => a - b);
  if (options.length > 0 && options[0] <= 0) {
    throw new RangeError('candidates must be positive');
  }
  const result: number[][] = [];
  const chosen: number[] = [];
```

Three decisions are made before the search starts. `set` removes repeated
candidates: with `[3, 3]` in the input, the loop would treat the two 3s as
different choices and return every answer twice. Sorting puts the candidates in
increasing order, which gives the answers a fixed order, each combination
ascending and the combinations compared like words in a dictionary, and also
lets the search stop early, as the next chunk shows. And the check rejects zero
and negative candidates, because the whole argument rests on every choice
shrinking `remaining`. With a candidate of 0, the call that picks it passes the
same `remaining` and the same start to its child, and the recursion never ends;
with a negative one, `remaining` can grow, so there is no point at which a
branch can be declared hopeless.

```python
    def visit(start: int, remaining: int) -> None:
        if remaining == 0:
            result.append(chosen.copy())
            return
        for i in range(start, len(options)):
            if options[i] > remaining:
                break
            chosen.append(options[i])
            visit(i, remaining - options[i])
            chosen.pop()

    visit(0, target)
    return result
```

```typescript
  const visit = (start: number, remaining: number): void => {
    if (remaining === 0) {
      result.push([...chosen]);
      return;
    }
    for (let i = start; i < options.length; i++) {
      if (options[i] > remaining) break;
      chosen.push(options[i]);
      visit(i, remaining - options[i]);
      chosen.pop();
    }
  };

  visit(0, target);
  return result;
}
```

Here `remaining` is a number passed down as an argument, so it needs no undoing,
exactly like the tree entry's `remaining`; `chosen` is the shared list that
does. Two lines carry the pattern. The recursive call passes `i`, not
`i + 1`, which keeps the candidate just used available again. Replace it with
`i + 1` and each candidate is used at most once, so `[2, 3, 6, 7]` with a
target of 7 returns only `[[7]]` and loses `[2, 2, 3]`. And the loop starts at
`start`, not 0, which is what keeps one combination from being reported in
several orders. Without it, candidates `[2, 3]` and a target of 5 return both
`[2, 3]` and `[3, 2]`. The `break` is the pruning, and it is a `break` and not
a `continue` only because the candidates are sorted: the first candidate that
exceeds `remaining` is followed by candidates at least as large, so none of
them can fit either. On unsorted input the same line would be wrong, since a
smaller candidate later in the list could still fit. A target of 0 returns
`[[]]`, the one combination that uses nothing, because the check at the top
fires on the first call. A target with no answer returns `[]`.

## Complexity

The cost of backtracking is the size of the tree it walks, and for the first
two problems that is the size of the output. The tree for subsets has one node
per subset, 2^n of them for n values, because each value is either in or out.
The tree for permutations has n! leaves, the number of orderings (3 values
give 6; 10 give 3,628,800; 20 give about 2.4 × 10^18), and the whole tree
including the partial nodes has about e · n! nodes, so n! is the right order
of magnitude, not a loose bound.

Each recorded answer is also copied, which costs its length. Subsets add up to
n · 2^(n-1) stored values in total, since each value appears in half of the
subsets, and permutations to n · n!. So the time is O(n · 2^n) for subsets and
O(n · n!) for permutations, and the space is the same, because the answer is
held in memory. The recursion's own space is only O(n), the depth of the tree
plus the one shared `chosen` list and the used flags.

No algorithm can do better than producing the output. The task is to return
2^n subsets, and writing them down takes at least that long, whatever the
method. The only way to be cheaper is to not return everything: count the
subsets, or ask for one with a given property. With 20 values the subsets
already number 1,048,576 and the permutations 20! ≈ 2.4 × 10^18, which no
machine can list, so the pattern is for small inputs, in practice up to about
20 values for subsets and 10 for permutations.

Combination sum has no tidy formula. The output can be large: the candidates
1 to 50 and a target of 50 give 204,226 combinations, one for each way to write
50 as a sum of positive integers. But the tree can also be larger than the
output, because dead ends cost calls without producing an answer. Candidates
`[2, 4]` with an odd target of 81 have no answer at all, yet the search makes
441 calls before it can say so. The pruning cuts branches once a candidate is
too big, but it can't tell that an odd target is unreachable. In the worst case
the cost grows exponentially with `target` divided by the smallest candidate,
the depth of the deepest branch.

## Pitfalls

- **Recording the shared list instead of a copy.** Every answer then points at
  the one `chosen` list, which is empty when the search ends, so the result is
  a row of empty lists. Copy at the moment of recording.
- **Forgetting to undo a choice.** A `pop` without the matching
  `used[i] = False`, or a flag set and never cleared, leaves state from one
  branch inside the next. The symptom is missing answers, as with permutations
  returning one answer instead of six.
- **Recursing with `start + 1` or `i` where `i + 1` is meant** in subsets, or
  `i + 1` where `i` is meant in combination sum. The first produces
  reorderings or repeats, the second forbids reuse.
- **No start index in combination sum.** Every combination appears once per
  ordering of its values: `[2, 3]` and `[3, 2]`.
- **Using `break` on unsorted candidates.** The early exit needs the sort.
  Without it, a large candidate ends the loop and hides smaller ones after it.
- **Duplicate values in the input.** The code treats equal values at different
  positions as different choices. `permutations([1, 1])` returns `[1, 1]`
  twice, and `subsets([1, 1])` returns `[1]` twice, as itertools does. Handling
  true duplicates means sorting and skipping a value equal to the one just
  tried at the same level, which this entry's functions don't do. Only
  `combination_sum` removes repeats, because there reuse is the point.
- **Candidates of zero or less.** Zero loops forever and negatives defeat the
  pruning, which is why the function raises an error instead.
- **Deep recursion and huge outputs.** Python stops at about a thousand active
  calls by default. Combination sum with the candidate `[1]` and a target of
  2,000 goes 2,000 calls deep and fails, although its answer is a single
  list. And a request for all permutations of 15 values would try to hold
  over 1.3 × 10^12 lists in memory.
