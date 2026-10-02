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


def permutations(values: list[int]) -> list[list[int]]:
    """Every ordering of distinct values, in the order itertools.permutations gives."""
    result: list[list[int]] = []
    chosen: list[int] = []
    used = [False] * len(values)

    def visit() -> None:
        if len(chosen) == len(values):
            result.append(chosen.copy())
            return
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


def combination_sum(candidates: list[int], target: int) -> list[list[int]]:
    """Every combination of positive candidates, each reusable, adding to target."""
    options = sorted(set(candidates))
    if options and options[0] <= 0:
        raise ValueError("candidates must be positive")
    result: list[list[int]] = []
    chosen: list[int] = []

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
