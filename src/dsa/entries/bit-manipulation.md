---
title: Bit Manipulation
summary: Working on an integer's binary digits directly, so that counting bits, spotting powers of two, finding the unpaired value and listing every subset take a few operators.
date: 2026-10-05
kind: pattern
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

```python region=count-set-bits

```

```typescript region=part-1

```

On 44 the loop goes 44, 40, 32, 0 and returns 3. Python 3.10 added
`n.bit_count()`, but the clearing step is the part you reuse, as the next
function does.

```python region=is-power-of-two

```

```typescript region=is-power-of-two

```

Python needs no range guard because its integers never overflow; TypeScript
needs one because of the 32-bit limit. XOR is the second tool.

```python region=single-number

```

```typescript region=single-number

```

XOR on infinite two's complement still cancels equal values, so Python needs no
extra check for negatives. If two values lack a partner, the result is the XOR
of what's there: no error and no meaning. The last tool uses bits as a set.

```python region=subsets

```

```typescript region=subsets

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
