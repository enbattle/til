# region count-set-bits
def count_set_bits(n: int) -> int:
    """Number of 1 bits in the binary form of n, for n >= 0."""
    # A negative int has infinitely many leading 1s, so the loop below would
    # never reach 0: -5 becomes -6, -8, -16, -32 and keeps going.
    if n < 0:
        raise ValueError("count_set_bits needs a non-negative integer")
    count = 0
    while n != 0:
        # n - 1 flips the lowest 1 and the 0s beneath it, so the AND clears
        # exactly that one bit. One pass per set bit, not per bit position.
        n = n & (n - 1)
        count += 1
    return count
# endregion


# region is-power-of-two
def is_power_of_two(n: int) -> bool:
    """True when n is 1, 2, 4, 8, ...; zero and negatives are not."""
    # n > 0 first: 0 & -1 is 0, so zero would pass the AND test. Keep the
    # parentheses: in JavaScript, === binds tighter than &.
    return n > 0 and (n & (n - 1)) == 0
# endregion


# region single-number
def single_number(nums: list[int]) -> int:
    """The value that appears once when every other value appears twice."""
    # An empty list has no lone value; returning 0 would look like an answer.
    if len(nums) == 0:
        raise ValueError("single_number needs at least one number")
    # Start at 0 because x ^ 0 == x; each pair cancels wherever it sits.
    result = 0
    for num in nums:
        result = result ^ num
    return result
# endregion


# region subsets
def subsets(items: list[int]) -> list[list[int]]:
    """All 2**len(items) subsets; mask m picks items[i] where bit i of m is 1."""
    result = []
    total = 2 ** len(items)
    for mask in range(total):
        subset = []
        for i in range(len(items)):
            # 1 << i is a number with only bit i set, so the AND is nonzero
            # exactly when bit i of the mask is set.
            if (mask & (1 << i)) != 0:
                subset.append(items[i])
        result.append(subset)
    return result
# endregion
