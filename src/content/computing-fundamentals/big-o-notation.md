---
title: Big-O Notation
summary: Big-O describes how an algorithm's work grows as its input grows, which is why a method that feels instant on 1,000 items can take over an hour on a million.
date: 2026-10-07
---

Say you have a list of user IDs and want to know whether any ID appears twice. There are three obvious ways to check, and they all work. With 1,000 IDs the first takes about 5 milliseconds. With 1,000,000 IDs it takes about 83 minutes. Big-O is the vocabulary for predicting that jump before you run anything.

This page counts the steps of the first approach, names what that count means, climbs through faster approaches, then covers memory, best and worst cases, and when the count misleads.

## Counting the steps

The first approach is two nested loops that compare every ID against every later one. With n IDs, the first ID is compared with the n − 1 after it, the second with n − 2, and so on down to the last, which is compared with none. The total is n(n − 1) ÷ 2 pairs.

```text
n = 1,000:      1,000 × 999 ÷ 2          = 499,500 ≈ 500,000 comparisons
n = 1,000,000:  1,000,000 × 999,999 ÷ 2  ≈ 5 × 10¹¹ comparisons
```

Assume about 100 million simple operations a second, an order-of-magnitude figure rather than a measurement. Then 500,000 comparisons take 500,000 ÷ 100,000,000 = 0.005 seconds, or 5 milliseconds, and 5 × 10¹¹ take 5,000 seconds, or 83 minutes. The input grew 1,000 times and the work grew a million times.

The exact count matters less than the shape of the growth. Suppose the loops also did 3 bookkeeping steps per ID, for n²/2 + 3n in all. At n = 1,000 that is 500,000 + 3,000 = 503,000, and the extra 3,000 is under 1% of the total.

## What Big-O measures

**Big-O notation** describes how the work an algorithm does grows with the size of its input, written n. It ignores your hardware and language, because those change from machine to machine. It counts steps, then keeps only the term that dominates as n gets large and drops constant factors like the ½. So the nested loops are **O(n²)**, said "order n squared": double the IDs and the work quadruples.

Can we do better than comparing every pair?

## The faster classes

Sort the IDs first, then scan once, because any duplicates now sit next to each other. A good sort, such as merge sort, takes about n × log₂ n comparisons, so this is **O(n log n)**.

A logarithm answers "how many times can I halve n before reaching 1?". Halving 1,000 takes about 10 steps (2¹⁰ = 1,024), so log₂ 1,000 ≈ 10, and log₂ 1,000,000 ≈ 20.

```text
n = 1,000:      1,000 × 10             = 10,000 steps     = 0.1 ms
n = 1,000,000:  1,000,000 × 20         = 20 million steps = 0.2 s
```

Better still, walk the list once and keep a **hash set**, a structure that answers "have I seen this ID?" in roughly constant time. That makes the check **O(n)** on average: about 1,000 steps at n = 1,000, and a million at a million, about 10 milliseconds.

The set's lookup is **O(1)**, meaning the cost doesn't depend on n. It gets there by [hashing](/computing-fundamentals/encoding-hashing-and-encryption) each ID to pick where to look, instead of searching the whole set.

**O(log n)** is what binary search costs on the sorted IDs: compare yours with the middle ID and discard the half that can't hold it. Finding one ID among a million takes about 20 halvings, so about 20 steps.

**O(2ⁿ)**, exponential, is what you'd pay to try every subset of the IDs. At n = 30 that's 2³⁰ ≈ 10⁹ steps, and 10⁹ ÷ 10⁸ = 10 seconds. At n = 60 it's 2⁶⁰ ≈ 1.15 × 10¹⁸ steps, and 1.15 × 10¹⁸ ÷ 10⁸ ≈ 1.15 × 10¹⁰ seconds, roughly 365 years.

The hash set is fastest, but it has to remember the IDs somewhere.

## Time versus space

Big-O describes memory too. The hash set stores up to n IDs, so it uses **O(n) space**. An in-place sort (one that rearranges the list without a second copy) needs little extra memory; merge sort needs O(n). The nested loops need none beyond the list itself. So the alternative someone suggests, "just loop," wins when memory is scarce and n is small. The hash set wins when time matters and you can afford the memory.

That settles the cost on one fixed list. Does the cost stay the same for every list?

## Worst, average and amortized cases

No. If the first two IDs match, the hash set stops after two steps. Big-O usually quotes the **worst case**, here a list with no duplicate, because it's the guarantee. The **average case** is what you expect in practice: a hash lookup is O(1) on average, assuming the hash spreads IDs evenly across the table, but O(n) if many land in the same place. So the hash-set check is O(n) expected and O(n²) in the worst case.

One more case hides in the setup: how did the 1,000 IDs get into the list? Probably one at a time, as users signed up. A list that grows as you add to it is a **dynamic array**. An append is usually one write, but when the array is full it copies everything into a new one twice the size. Start with room for 1 ID and double each time it fills:

```text
copies happen at sizes 1, 2, 4, 8, ..., 512
total copied:  1 + 2 + 4 + ... + 512  = 1,023
per append:    1 write + 1,023 ÷ 1,000 ≈ 1 copy = about 2 steps
```

Appending ID 513 is expensive, O(n) for that one append. Yet over all 1,000 appends the average stays at about 2 steps, a constant. An average taken over a whole sequence of operations is an **amortized** cost, so appending is O(1) amortized. It works because the array grows by a multiple of its size (here, doubling); growing by a fixed 10 slots would make the average climb with n.

## Why constants still matter

If O(n) always beats O(n²), why not always use the hash set? Because Big-O drops constants, and constants decide the winner at small n. Hashing an ID costs more than comparing two numbers, so for a list of 10 IDs the nested loops can be as fast or faster, and simpler. Big-O tells you who wins as n grows, not who wins today. It also hides a factor like our ½ and the cost of memory access, so when two options share a class, measure.

**Rule of thumb.** Estimate how the work grows with n before you write the code, and pick the simplest approach whose growth you can afford at the largest n you expect.
