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
