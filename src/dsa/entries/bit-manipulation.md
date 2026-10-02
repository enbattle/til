---
title: Bit Manipulation
summary: Treating an integer as a row of on/off switches so that counting bits, spotting powers of two, finding the odd one out and listing every subset each take a few operators instead of a loop over data.
date: 2026-10-01
kind: pattern
---

Bit manipulation means working on the binary digits of an integer directly,
with operators that act on every digit at once. It is a pattern in the same
sense as two pointers: a small set of tricks that recur in problems which look
unrelated. This entry covers three of them: counting the 1s in a number,
finding the one value in a list that has no partner, and listing every subset
of a collection by counting.

## Prerequisites

None. The entry assumes you can read and write whole numbers and know place
value in ordinary decimal (the 3 in 3,408 means three thousands). Binary place
value and the bitwise operators are explained from scratch below.

## The idea

**Binary.** Decimal writes a number with digits 0 to 9, where each place is
worth ten times the one to its right: 408 is 4 x 100 + 0 x 10 + 8 x 1. Binary
uses only the digits 0 and 1, called **bits**, and each place is worth twice
the one to its right: 1, 2, 4, 8, 16 and so on. So 1011 in binary is
1 x 8 + 0 x 4 + 1 x 2 + 1 x 1 = 11. A bit that is 1 is **set**, and a bit that
is 0 is **clear**. Bits are numbered from the right starting at 0, so bit 3 of
1011 is the leftmost one, worth 2 to the power 3 = 8. Every integer is stored
this way; the operators below just give you access to the digits.

**The operators.** Each one lines up two numbers digit by digit. Take 6, which
is 110, and 3, which is 011:

| Operator | Meaning                                      | `6 op 3`   | Result     |
| -------- | -------------------------------------------- | ---------- | ---------- |
| `&`      | AND: 1 only where both bits are 1            | 110 & 011  | 010 = 2    |
| `\|`     | OR: 1 where either bit is 1                  | 110 \| 011 | 111 = 7    |
| `^`      | XOR (exclusive or): 1 where the bits differ  | 110 ^ 011  | 101 = 5    |
| `<<`     | shift left: slide bits left, fill with 0     | 6 << 2     | 11000 = 24 |
| `>>`     | shift right: slide bits right, drop the last | 6 >> 1     | 11 = 3     |
| `~`      | NOT: flip every bit                          | `~5`       | -6         |

Shifting left by k multiplies by 2 to the power k, and shifting right by k
divides by it, rounding down. The result of `~` looks odd because it flips
infinitely many leading zeros too; the section on negative numbers explains
why `~5` is -6 and why the two languages disagree about the details.

**Trick 1: `n & (n - 1)` clears the lowest set bit.** Subtracting 1 from a
number turns its lowest set bit into 0 and every clear bit below it into 1,
and leaves everything above alone. ANDing the result with the original keeps
only the bits that agree, which wipes out the lowest set bit and the changed
bits below it. Counting set bits for 44 (101100 in binary, so 32 + 8 + 4):

| Step | `n`    | `n - 1` | `n & (n - 1)` | Count so far |
| ---- | ------ | ------- | ------------- | ------------ |
| 1    | 101100 | 101011  | 101000 = 40   | 1            |
| 2    | 101000 | 100111  | 100000 = 32   | 2            |
| 3    | 100000 | 011111  | 000000 = 0    | 3            |

Each step removes exactly one set bit, so the number of steps until `n`
reaches 0 is the number of set bits: 3. The same trick answers "is this a power
of two?". A power of two has exactly one set bit (8 is 1000), so clearing its
lowest set bit leaves 0: 1000 & 0111 = 0. Any other positive number has a
second set bit that survives (6 is 110, and 110 & 101 = 100, not 0).

**Trick 2: XOR cancels pairs.** Three facts about `^` do all the work: any
number XOR itself is 0 (`x ^ x = 0`, since every bit matches), any number XOR 0
is itself (`x ^ 0 = x`), and the order doesn't matter, so you can regroup
freely. Suppose every value in a list appears exactly twice except one. XOR
the whole list together: each pair collapses to 0 wherever it sits, and what
is left is the value that had no partner. For `[4, 1, 2, 1, 2]`:

| Value | Running XOR (binary) | Running XOR |
| ----- | -------------------- | ----------- |
| start | 000                  | 0           |
| 4     | 100                  | 4           |
| 1     | 101                  | 5           |
| 2     | 111                  | 7           |
| 1     | 110                  | 6           |
| 2     | 100                  | 4           |

The answer is 4. The running value in the middle is meaningless on its own,
which is fine: only the final result matters, and the pairs have cancelled by
then.

**Trick 3: a number as a set.** Take a collection of n items and give each one
a bit position: item 0 is bit 0, item 1 is bit 1, and so on. An n-bit number
then describes a subset, with bit i set meaning "item i is in". A number with
n bits has 2 to the power n values, from 0 (no items) to 2^n - 1 (all n bits
set, every item), and each value is a different subset. So counting from 0 up
to 2^n - 1 visits every subset exactly once. For the items `[a, b, c]`:

| Mask | Binary | Subset      |
| ---- | ------ | ----------- |
| 0    | 000    | `[]`        |
| 1    | 001    | `[a]`       |
| 2    | 010    | `[b]`       |
| 3    | 011    | `[a, b]`    |
| 4    | 100    | `[c]`       |
| 5    | 101    | `[a, c]`    |
| 6    | 110    | `[b, c]`    |
| 7    | 111    | `[a, b, c]` |

The number used this way is called a **bitmask**.

**Negative numbers and the two languages.** Python's integers have no size
limit, and a negative number behaves as if it had infinitely many 1s to the
left: -1 is `...1111`, -8 is `...11000`. This is called two's complement.
Flipping every bit of x gives -x - 1, which is why `~5` is -6 and `~0` is -1,
and why `-1 >> 100` is still -1: the shift drops bits on the right and copies
the sign in on the left. JavaScript, and so TypeScript, is different. Its
numbers are floating point, but every bitwise operator first converts its
operands to **32-bit signed integers**: only the low 32 bits are kept, and bit
31 is the sign. So `1 << 31` is -2147483648, `2 ** 32 | 0` is 0 (the bit that
carries it past 32 bits is dropped) and `(2 ** 32 + 1) | 0` is 1. JavaScript
also has `>>>`, an unsigned right shift that treats the 32 bits as a
non-negative number: `-1 >>> 0` is 4294967295, and `-8 >> 1` is -4 while
`-8 >>> 1` is 2147483644. The code below rejects negative inputs where the
answer would depend on which convention applies, and says so in each case.

## When to use it

A problem statement that mentions "without extra space" about a list where
most values repeat is the XOR cancellation: the one value that appears an odd
number of times, or the one missing from a range when you XOR the range with
the list. A request for a count, parity or position of set bits points at the
first trick. "Power of two" in a problem is a one-line check. A small
collection (up to about 20 items) where you need every subset, or every way of
choosing, can be walked with a bitmask loop, and so can dynamic-programming
states over subsets (which of n items have been used). Bits also compactly store sets of
small integers, such as flags or visited columns.

If the collection is large, the bitmask loop is the wrong tool, since there are
2^n subsets. When the answer depends on choices made one at a time and you
want to prune branches early, recursion fits better; see
[Backtracking](/dsa/backtracking), which builds the same subsets by deciding
item by item.

## Walkthrough

```python
from functools import reduce
from operator import xor


def count_set_bits(n: int) -> int:
    """Number of 1 bits in the binary form of n, for n >= 0."""
    if n < 0:
        raise ValueError("count_set_bits needs a non-negative integer")
    count = 0
    while n:
        n &= n - 1
        count += 1
    return count
```

```typescript
const MAX_UINT32 = 0xffffffff;

/** Number of 1 bits in `n`, an integer from 0 to 2**32 - 1. */
export function countSetBits(n: number): number {
  if (!Number.isInteger(n) || n < 0 || n > MAX_UINT32) {
    throw new RangeError('countSetBits needs an integer from 0 to 2**32 - 1');
  }
  let x = n >>> 0;
  let count = 0;
  while (x !== 0) {
    x = (x & (x - 1)) >>> 0;
    count++;
  }
  return count;
}
```

The loop runs once per set bit, not once per bit position, so 2**31 takes one
pass and 2**31 - 1 takes 31. Negatives are rejected because they have no
finite bit pattern in Python: `bin(-5)` is `-0b101`, which is the sign
followed by the bits of 5, and `(-5).bit_count()` is 2, the count for 5. The
two's-complement pattern `...11111011` has infinitely many 1s. If the loop ran
on a negative `n` it would never reach 0, because `n & (n - 1)` on a negative
number stays negative. In TypeScript the guard is wider: besides non-integers
(`1.5 & 1` would quietly truncate to 1) it refuses anything above 2**32 - 1,
because the operators would silently keep only the low 32 bits. The
`>>> 0` turns the result back into an unsigned number: for 2**32 - 1,
`x & (x - 1)` on its own comes out as -2, because bit 31 is the sign. The loop
would still stop on `!== 0`, but keeping `x` unsigned means every value in it
is the plain number a reader expects. Python 3.10 added `n.bit_count()`, which
does the same job in
C; the loop is here because it teaches the trick.

```python
def is_power_of_two(n: int) -> bool:
    """True when n is 1, 2, 4, 8, ...; zero and negatives are not."""
    return n > 0 and n & (n - 1) == 0
```

```typescript
/** True when `n` is 1, 2, 4, 8, ...; zero and negatives are not. Limit 2**32 - 1. */
export function isPowerOfTwo(n: number): boolean {
  if (!Number.isInteger(n) || n > MAX_UINT32) {
    throw new RangeError('isPowerOfTwo needs an integer up to 2**32 - 1');
  }
  return n > 0 && (n & (n - 1)) === 0;
}
```

The `n > 0` is needed because 0 satisfies the arithmetic: `0 & -1` is 0, so
without the guard zero would be reported as a power of two, though it has no
set bit at all. Negative numbers are simply answered False, so no error is
needed here. The parentheses in the TypeScript version matter, and the
difference between the languages is real: in Python comparisons bind more
loosely than `&`, so `n & (n - 1) == 0` means `(n & (n - 1)) == 0`. In
JavaScript `===` binds more tightly, so `n & (n - 1) === 0` is
`n & ((n - 1) === 0)`, which for `n = 8` is `8 & false`, that is 0. In plain
JavaScript the test then quietly gives the wrong answer; TypeScript's type
checker refuses to compile it, because `&` can't take a boolean. The upper limit exists because
`(2 ** 32 + 1) | 0` is 1, so 2**32 + 1 would be converted to the number 1 and
reported as a power of two.

```python
def single_number(nums: list[int]) -> int:
    """The value that appears once when every other value appears exactly twice."""
    if not nums:
        raise ValueError("single_number needs at least one number")
    return reduce(xor, nums, 0)
```

```typescript
/** The value that appears once when every other appears exactly twice (32-bit ints). */
export function singleNumber(nums: number[]): number {
  if (nums.length === 0) throw new RangeError('singleNumber needs at least one number');
  let result = 0;
  for (const num of nums) {
    if (!Number.isInteger(num) || num !== (num | 0)) {
      throw new RangeError('singleNumber needs 32-bit signed integers');
    }
    result ^= num;
  }
  return result;
}
```

`reduce(xor, nums, 0)` folds the list with `^`, starting from 0 because
`x ^ 0 = x`: the start value changes nothing, and it means a one-element list
returns that element. The two imports at the top of the Python file are
`reduce` and the function form of `^`. The same code is right for negatives in
Python, since XOR on infinite two's complement still cancels equal values bit
by bit. In TypeScript the check `num !== (num | 0)` rejects any value that
the 32-bit conversion would change, such as 2**31, which would otherwise wrap
to -2**31 and make `[2 ** 31, 1, 2 ** 31]` return a wrong answer instead of
failing. Within 32-bit signed range, `^=` gives exactly the right result,
negative values included. If the precondition doesn't hold (two lone values, or
a value that appears three times), the function returns the XOR of what's
there, which is not an error and not meaningful; the trick can't detect this.
An empty list is rejected, since there is no lone value to return.

```python
def subsets(items: list[int]) -> list[list[int]]:
    """All 2**len(items) subsets; mask m picks items[i] where bit i of m is 1."""
    n = len(items)
    return [[items[i] for i in range(n) if mask >> i & 1] for mask in range(1 << n)]
```

```typescript
/** All 2**n subsets; the subset for mask m holds items[i] where bit i of m is 1. */
export function subsets<T>(items: T[]): T[][] {
  const n = items.length;
  if (n > 30) throw new RangeError('subsets supports at most 30 items');
  const result: T[][] = [];
  for (let mask = 0; mask < 1 << n; mask++) {
    const subset: T[] = [];
    for (let i = 0; i < n; i++) {
      if ((mask >> i) & 1) subset.push(items[i]);
    }
    result.push(subset);
  }
  return result;
}
```

`1 << n` is 2 to the power n, the first mask that is out of range, so
`range(1 << n)` and `mask < 1 << n` visit 0 through 2^n - 1. For each mask,
`mask >> i & 1` moves bit i down to the lowest place and keeps just that bit:
1 means item i is in. Python's shift binds tighter than `&`, so this reads as
`(mask >> i) & 1`; the TypeScript version spells the parentheses out. The
TypeScript limit of 30 items is `1 << n` again: `1 << 31` is negative, so for 31
items the loop condition `mask < 1 << n` would be false from the start and the
function would silently return no subsets at all (for 32 items `1 << 32` is 1
and it would return just one); 2^30 subsets is already over a
billion, far beyond what fits in memory, so the limit costs nothing. A list
of n items always gives 2^n subsets, so the empty list gives `[[]]`: one
subset, the empty one.

## Complexity

`count_set_bits` takes O(k) steps for a fixed word size, where k is the number
of set bits (with Python's growing integers each step also costs O(log n), the
same caveat as below), at most
the number of bits in `n`, which is about log2(n) (for 44, that is 6 bits, 3
set). `is_power_of_two` is O(1) for a fixed word size, since it is one
subtraction, one AND and one comparison; in Python, whose integers can grow,
each of those costs time proportional to the number's length, so strictly
O(log n). Both use O(1) extra space. `single_number` reads each of the n
values once, O(n) time and O(1) space, where the alternative of counting each
value in a hash map is O(n) time but O(n) space (see
[Hash map](/dsa/hash-map)), and sorting first is O(n log n). `subsets` makes 2^n
masks and each one tests n bits, so O(n x 2^n) time; the output itself holds
about n x 2^n / 2 items in total (each item sits in half of the subsets), so
O(n x 2^n) space is unavoidable if you return them all. For n = 20 that is
over a million subsets (1,048,576) and about twenty million bit tests.

## Pitfalls

- **Operator precedence.** In JavaScript `n & (n - 1) === 0` compares first
  and ANDs second, so it is wrong for every power of two from 2 up, exactly
  the inputs the test exists to find (TypeScript rejects the line at compile
  time). In Python the equivalent line is fine, which makes this an easy bug
  when moving code between the two.
  Parenthesise every bitwise operation inside a comparison.
- **Treating JavaScript numbers as unbounded.** The operators work on 32-bit
  signed integers: `1 << 31` is negative, `1 << 32` is 1 (the shift count
  wraps modulo 32), and `2 ** 32 | 0` is 0. A bitmask over more than 30 items,
  or a hash built with `<<`, goes wrong without any error. Use `>>> 0` to
  read a result back as unsigned, or `BigInt` when you need more than 32 bits.
- **Negative numbers.** `bin(-5)` and `(-5).toString(2)` give `-0b101` and
  `-101`: a sign and the bits of 5, not the stored pattern. The clear-lowest-bit loop on
  a negative Python integer never ends (-5 becomes -6, -8, -16, -32 and keeps
  going), so reject or mask first (`n & 0xFFFFFFFF`
  gives the 32-bit pattern of any Python integer).
- **Expecting the XOR trick to detect bad input.** If a value appears three
  times, or two values have no partner, `single_number` still returns
  something. The trick answers only when its precondition holds.
- **Zero in the power-of-two test.** `n & (n - 1) == 0` is true for 0. Forgetting
  `n > 0` reports 0 as a power of two.
- **Using it where it hurts readability.** A bitmask over a small set earns its
  place; `x << 1` for `x * 2` in ordinary arithmetic rarely does.
