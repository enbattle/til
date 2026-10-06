import random

import pytest

from monotonic_stack import days_until_warmer, largest_rectangle, next_greater


def brute_next_greater(nums):
    return [
        next((j for j in range(i + 1, len(nums)) if nums[j] > nums[i]), -1)
        for i in range(len(nums))
    ]


def brute_days(temps):
    return [0 if j == -1 else j - i for i, j in enumerate(brute_next_greater(temps))]


def brute_rectangle(heights):
    best = 0
    for lo in range(len(heights)):
        for hi in range(lo, len(heights)):
            best = max(best, min(heights[lo : hi + 1]) * (hi - lo + 1))
    return best


class Counting(list):
    """A list that counts every element read, by index, slice or iteration."""

    reads = 0

    def __getitem__(self, index):
        if isinstance(index, slice):
            self.reads += len(range(*index.indices(len(self))))
        else:
            self.reads += 1
        return super().__getitem__(index)

    def __iter__(self):
        for k in range(len(self)):
            self.reads += 1
            yield super().__getitem__(k)


@pytest.mark.parametrize(
    ("given", "expected"),
    [
        ([], []),
        ([5], [-1]),
        ([1, 2, 3], [1, 2, -1]),
        ([3, 2, 1], [-1, -1, -1]),
        ([2, 1, 2, 4, 3], [3, 2, 3, -1, -1]),
        ([2, 2, 2], [-1, -1, -1]),
        ([2, 2, 3], [2, 2, -1]),
        ([-3, -5, -1, -1, 0], [2, 2, 4, 4, -1]),
    ],
)
def test_next_greater(given, expected):
    assert next_greater(given) == expected


def test_next_greater_equal_values_built_at_runtime():
    big = int("1000")
    assert next_greater([big, int("1000"), big + 1]) == [2, 2, -1]


def test_next_greater_does_not_change_the_input():
    nums = [4, 1, 5]
    next_greater(nums)
    assert nums == [4, 1, 5]


@pytest.mark.parametrize(
    ("given", "expected"),
    [
        ([], []),
        ([70], [0]),
        ([2, 1, 2, 4, 3], [3, 1, 1, 0, 0]),
        ([73, 74, 75, 71, 69, 72, 76, 73], [1, 1, 4, 2, 1, 1, 0, 0]),
        ([60, 50, 40, 30], [0, 0, 0, 0]),
        ([50, 50, 51], [2, 1, 0]),
    ],
)
def test_days_until_warmer(given, expected):
    assert days_until_warmer(given) == expected


@pytest.mark.parametrize(
    ("given", "expected"),
    [
        ([], 0),
        ([0], 0),
        ([7], 7),
        ([2, 1, 2, 4, 3], 6),
        ([2, 1, 5, 6, 2, 3], 10),
        ([2, 2, 2], 6),
        ([1, 2, 3, 4], 6),
        ([4, 3, 2, 1], 6),
        ([0, 0, 0], 0),
        ([3, 0, 3], 3),
    ],
)
def test_largest_rectangle(given, expected):
    assert largest_rectangle(given) == expected


def test_largest_rectangle_does_not_change_the_input():
    heights = [2, 1, 2]
    largest_rectangle(heights)
    assert heights == [2, 1, 2]


def test_next_greater_agrees_with_brute_force_on_duplicates():
    rng = random.Random(11)
    for trial in range(50):
        nums = [rng.randint(0, 4) for _ in range(rng.randint(0, 12))]
        at = f"seed 11, trial {trial}: {nums}"
        assert next_greater(nums) == brute_next_greater(nums), at
        assert days_until_warmer(nums) == brute_days(nums), at


def test_next_greater_agrees_with_brute_force_on_wide_values():
    rng = random.Random(12)
    for trial in range(50):
        nums = [rng.randint(-50, 50) for _ in range(rng.randint(0, 30))]
        assert next_greater(nums) == brute_next_greater(nums), (
            f"seed 12, trial {trial}: {nums}"
        )


def test_largest_rectangle_agrees_with_brute_force():
    rng = random.Random(13)
    for trial in range(50):
        heights = [rng.randint(0, 6) for _ in range(rng.randint(0, 14))]
        assert largest_rectangle(heights) == brute_rectangle(heights), (
            f"seed 13, trial {trial}: {heights}"
        )


@pytest.mark.parametrize("shape", ["decreasing", "increasing", "equal"])
def test_one_pass_reads_each_value_a_constant_number_of_times(shape):
    n = 500
    values = {
        "decreasing": list(range(n, 0, -1)),
        "increasing": list(range(n)),
        "equal": [7] * n,
    }[shape]
    nums = Counting(values)
    next_greater(nums)
    # A rescan from every position reads about n * n / 2 on these inputs.
    assert n <= nums.reads <= 4 * n, f"next_greater, {shape}: {nums.reads} reads"
    heights = Counting(values)
    largest_rectangle(heights)
    assert n <= heights.reads <= 6 * n, f"rectangle, {shape}: {heights.reads} reads"
