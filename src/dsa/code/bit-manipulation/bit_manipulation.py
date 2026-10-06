def count_set_bits(n: int) -> int:
    """Number of 1 bits in the binary form of n, for n >= 0."""
    # A negative int has infinitely many leading 1s, so the loop below would
    # never reach 0: -5 becomes -6, -8, -16, -32 and keeps going.
    if n < 0:
        raise ValueError("count_set_bits needs a non-negative integer")
    count = 0
    while n:
        # n - 1 flips the lowest 1 and the 0s beneath it, so the AND clears
        # exactly that one bit. One pass per set bit, not per bit position.
        n &= n - 1
        count += 1
    return count


def is_power_of_two(n: int) -> bool:
    """True when n is 1, 2, 4, 8, ...; zero and negatives are not."""
    # n > 0 first: 0 & -1 is 0, so zero would pass the AND test. The
    # parentheses are optional in Python but required in JavaScript, where
    # === binds tighter than &; keep them in both.
    return n > 0 and (n & (n - 1)) == 0


def single_number(nums: list[int]) -> int:
    """The value that appears once when every other value appears twice."""
    # An empty list has no lone value; returning 0 would look like an answer.
    if not nums:
        raise ValueError("single_number needs at least one number")
    # Start at 0 because x ^ 0 == x; each pair cancels wherever it sits.
    result = 0
    for num in nums:
        result ^= num
    return result


def subsets(items: list[int]) -> list[list[int]]:
    """All 2**len(items) subsets; mask m picks items[i] where bit i of m is 1."""
    result = []
    for mask in range(1 << len(items)):
        subset = []
        rest = mask
        while rest:
            # rest & -rest isolates the lowest set bit; its position is the
            # item. Looping over set bits skips the items that are out.
            low = rest & -rest
            subset.append(items[low.bit_length() - 1])
            rest ^= low
        result.append(subset)
    return result
