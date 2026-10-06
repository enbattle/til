---
title: Bit Manipulation
summary: Working on an integer's binary digits directly, so that counting bits, spotting powers of two, finding the unpaired value and listing every subset take a few operators.
date: 2026-10-05
kind: pattern
template: 2
---

Bit manipulation means working on the binary digits of an integer with
operators that act on every digit at once. The same few tricks turn up in
problems that look unrelated. You'll meet three: clearing the lowest 1 bit,
cancelling pairs with XOR, and treating a number as a set.

## Prerequisites

None. You need place value in decimal (the 3 in 3,408 is three thousands);
binary is built up below.

## The idea

**Binary.** Decimal places are worth 1, 10, 100, and so on. Binary places are
worth 1, 2, 4, 8, and the only digits are 0 and 1, called **bits**. A 1 is
**set** and a 0 is **clear**. So 101100 is 32 + 8 + 4 = 44, and bit 0 is the
rightmost. The operators work digit by digit: `&` (AND) keeps a 1 where both
bits are 1, `|` (OR) where either is, and `^` (XOR) where they differ, so
110 & 011 = 010, 110 | 011 = 111 and 110 ^ 011 = 101. `<<` and `>>` slide the
bits up or down (6 << 2 = 24, 6 >> 1 = 3), multiplying or dividing by a power
of 2, and `~` flips every bit.

**Trick 1: `n & (n - 1)` clears the lowest set bit.** Subtracting 1 flips the
lowest 1 to 0 and every 0 beneath it to 1, and leaves the bits above alone. The
AND then keeps only the bits that still agree, so the lowest 1 and the flipped
bits below it all become 0. Count the set bits of 44 by clearing one per step:

| Step | `n`    | `n - 1` | `n & (n - 1)` | Count |
| ---- | ------ | ------- | ------------- | ----- |
| 1    | 101100 | 101011  | 101000 = 40   | 1     |
| 2    | 101000 | 100111  | 100000 = 32   | 2     |
| 3    | 100000 | 011111  | 000000 = 0    | 3     |

The loop runs once per set bit, so 44 takes 3 passes. The same expression tests
for a power of two, which has exactly one set bit (8 is 1000), so clearing it
leaves 0. Any other positive number keeps a second bit: 110 & 101 = 100.

**Trick 2: XOR cancels pairs.** Three facts: `x ^ x = 0`, `x ^ 0 = x`, and the
order doesn't matter. If every value in a list appears twice except one, XOR
the whole list together. Each pair collapses to 0 wherever it sits, and the
unpaired value is left. For `[4, 1, 2, 1, 2]`:

| Value | Running XOR | Binary |
| ----- | ----------- | ------ |
| start | 0           | 000    |
| 4     | 4           | 100    |
| 1     | 5           | 101    |
| 2     | 7           | 111    |
| 1     | 6           | 110    |
| 2     | 4           | 100    |

**Trick 3: a number as a set.** Give each of n items a bit position. An n-bit
number is then a subset, with bit i set meaning "item i is in", and counting
from 0 to 2^n - 1 visits every subset once. This is a **bitmask**. For
`[a, b, c]` there are 8 masks: 0 is the empty subset, 5 (101) is `[a, c]` and
7 (111) is all three.

**Where the two languages differ.** Python integers have no size limit, and a
negative one behaves as if it had infinitely many 1s on the left (two's
complement): `-1 >> 100` is still -1, and `~5` is -6. JavaScript, and so
TypeScript, converts the operands of its bitwise operators to **32-bit
signed integers**, keeping the low 32 bits, where bit 31 is the sign. So
`1 << 31` is -2147483648 and `(2 ** 32 + 1) | 0` is 1. Only `>>>` reads its
result as unsigned, which is why `countSetBits` can test its range with it.

## When to use it

- Every value but one repeats and the statement says "without extra space":
  XOR. A missing number in a range works too, by XORing the range with the
  list.
- A count, parity or position of set bits, or "is this a power of two": clear
  the lowest bit.
- Every subset of a small collection (up to about 20 items), or dynamic
  programming over "which of n items are used so far": a bitmask loop.
- A set of small integers (flags, visited columns) packed into one number.
- Not when you must prune early or the collection is large (30 items make over
  a billion subsets): use [Backtracking](/dsa/backtracking), which builds
  subsets one decision at a time.

## Walkthrough

```python
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
```

```typescript
const MAX_UINT32 = 0xffffffff;

/** Number of 1 bits in the binary form of `n`, an integer in 0..2**32 - 1. */
export function countSetBits(n: number): number {
  // Bitwise operators keep only 32 bits, so anything outside this range
  // (a negative, a fraction, 2**32) would be silently truncated. >>> 0 gives
  // back n only for an integer in 0..2**32 - 1.
  if (n >>> 0 !== n) {
    throw new RangeError('countSetBits needs an integer from 0 to 2**32 - 1');
  }
  let x = n;
  let count = 0;
  while (x !== 0) {
    // x - 1 flips the lowest 1 and the 0s beneath it, so the AND clears
    // exactly that one bit. One pass per set bit, not per bit position.
    // (The result is a signed 32-bit value, which still reaches 0.)
    x &= x - 1;
    count++;
  }
  return count;
}
```

On 44 the loop goes 44, 40, 32, 0 and returns 3. Python 3.10 added
`n.bit_count()`, but the clearing step is the part you reuse, as the next
function does.

```python
def is_power_of_two(n: int) -> bool:
    """True when n is 1, 2, 4, 8, ...; zero and negatives are not."""
    # n > 0 first: 0 & -1 is 0, so zero would pass the AND test. The
    # parentheses are optional in Python but required in JavaScript, where
    # === binds tighter than &; keep them in both.
    return n > 0 and (n & (n - 1)) == 0
```

```typescript
/** True when `n` is 1, 2, 4, 8, ...; zero and negatives are not. Max 2**32 - 1. */
export function isPowerOfTwo(n: number): boolean {
  // 2**32 + 1 would be truncated to 1 and reported as a power of two.
  if (!Number.isInteger(n) || n > MAX_UINT32) {
    throw new RangeError('isPowerOfTwo needs an integer up to 2**32 - 1');
  }
  // n > 0 first: 0 & -1 is 0, so zero would pass the AND test. The
  // parentheses are required here: === binds tighter than &, so
  // n & (n - 1) === 0 would mean n & ((n - 1) === 0).
  return n > 0 && (n & (n - 1)) === 0;
}
```

Python needs no range guard because its integers never overflow; TypeScript
needs one because of the 32-bit limit. XOR is the second tool.

```python
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
```

```typescript
/** The value that appears once when every other value appears twice. */
export function singleNumber(nums: number[]): number {
  // An empty list has no lone value; returning 0 would look like an answer.
  if (nums.length === 0) throw new RangeError('singleNumber needs a number');
  // Start at 0 because x ^ 0 === x; each pair cancels wherever it sits.
  let result = 0;
  for (const num of nums) {
    // ^ works on 32-bit signed ints: 2**31 would wrap to -2**31 and a
    // fraction would be truncated, both without an error.
    if ((num | 0) !== num) throw new RangeError('singleNumber needs int32 values');
    result ^= num;
  }
  return result;
}
```

XOR on infinite two's complement still cancels equal values, so Python needs no
extra check for negatives. If two values lack a partner, the result is the XOR
of what's there: no error and no meaning. The last tool uses bits as a set.

```python
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
```

```typescript
/** All 2**n subsets; mask m picks items[i] where bit i of m is 1. */
export function subsets<T>(items: T[]): T[][] {
  const result: T[][] = [];
  // 2 ** n, not 1 << n: 1 << 31 is negative, so the loop would never run.
  for (let mask = 0; mask < 2 ** items.length; mask++) {
    const subset: T[] = [];
    // rest & -rest isolates the lowest set bit; clz32 turns it into its
    // position. Looping over set bits skips the items that are out.
    for (let rest = mask; rest !== 0; rest &= rest - 1) {
      subset.push(items[31 - Math.clz32(rest & -rest)]);
    }
    result.push(subset);
  }
  return result;
}
```

Mask 6 is 110: its lowest set bit is 2 (bit 1, so `b`), and clearing it
leaves 100 (bit 2, so `c`), giving `[b, c]`. The inner loop runs once per item
that's in; TypeScript steps with Trick 1, Python XORs the isolated bit away.
The empty list gives `[[]]`, one subset.

## Complexity

With a fixed word size, `count_set_bits` takes O(k) steps for k set bits (44
has 3, in 6 bit positions) and `is_power_of_two` is O(1). Python's integers
grow, so each step also touches every digit of `n`: O(k log n) and O(log n).
Both use O(1) space. `single_number` reads n values once: O(n) time and O(1)
space, against O(n) space for counting in a [hash map](/dsa/hash-map) and
O(n log n) time for sorting first. `subsets` makes 2^n masks, and across them
each of the n items is in half, so n * 2^(n - 1) steps: O(n * 2^n) time, and
the same for the output. For n = 20 that's over a million subsets. Neither version caps the item count:
memory runs out at about 25 items, long before the 32-bit limit matters.

## Pitfalls

- **Missing parentheses in `(n & (n - 1)) === 0`.** In JavaScript, `===` binds
  tighter than `&`, so without them 8 computes `8 & false`, which is 0, and
  every power of two but 1 is reported as not one; TypeScript refuses to
  compile it. Python's `&` binds tighter than `==`, so the bare line works
  there, which makes the bug easy to bring over when you port the code.
- **Dropping `n > 0`.** `0 & -1` is 0, so zero is reported as a power of two.
- **Running `n &= n - 1` on a negative Python integer.** `-5` becomes -6, -8,
  -16 and never reaches 0, so the `n < 0` check is what stops a hang. Mask
  first (`n & 0xFFFFFFFF` gives the 32-bit pattern) to count a negative's bits.
- **Treating JavaScript numbers as unbounded.** `1 << n` goes negative at 31,
  so `subsets` uses `2 ** n`, and the guards (`n >>> 0 !== n`, `num | 0`) exist
  because a value past 32 bits is truncated without an error. Use `BigInt` for
  wider values.
