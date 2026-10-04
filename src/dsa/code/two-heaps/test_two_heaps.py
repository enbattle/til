import random

import pytest

from two_heaps import RunningMedian


def sorted_median(values):
    ordered = sorted(values)
    mid = len(ordered) // 2
    if len(ordered) % 2:
        return float(ordered[mid])
    return (ordered[mid - 1] + ordered[mid]) / 2


def test_empty_stream_raises():
    stream = RunningMedian()
    assert len(stream) == 0
    with pytest.raises(ValueError):
        stream.median()


def test_single_element():
    stream = RunningMedian()
    stream.add(7)
    assert len(stream) == 1
    assert stream.median() == 7.0


def test_two_elements_give_the_mean():
    stream = RunningMedian()
    stream.add(1)
    stream.add(2)
    assert stream.median() == 1.5


def test_worked_example():
    stream = RunningMedian()
    medians = []
    for value in [5, 2, 8, 1, 9, 3]:
        stream.add(value)
        medians.append(stream.median())
    assert medians == [5.0, 3.5, 5.0, 3.5, 5.0, 4.0]


def test_sorted_and_reversed_input():
    for values in (list(range(20)), list(range(20, 0, -1))):
        stream = RunningMedian()
        for i, value in enumerate(values):
            stream.add(value)
            assert stream.median() == sorted_median(values[: i + 1])


def test_duplicates():
    stream = RunningMedian()
    for _ in range(5):
        stream.add(4)
        assert stream.median() == 4.0


def test_negatives_and_zero():
    stream = RunningMedian()
    seen = []
    for value in [-5, 0, -3, 0, -10, 2]:
        stream.add(value)
        seen.append(value)
        assert stream.median() == sorted_median(seen)


def test_floats():
    stream = RunningMedian()
    stream.add(0.5)
    stream.add(1.5)
    assert stream.median() == 1.0


def test_matches_sorting_on_many_random_streams():
    for seed in range(50):
        rng = random.Random(seed)
        stream = RunningMedian()
        seen = []
        for _ in range(rng.randint(1, 40)):
            value = rng.randint(-10, 10)
            stream.add(value)
            seen.append(value)
            at = f"seed {seed}: {seen}"
            assert len(stream) == len(seen), at
            assert stream.median() == sorted_median(seen), at
