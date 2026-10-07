---
title: Big-O Notation
summary: Big-O describes how an algorithm's work grows as its input grows, which is why a method that feels instant on 1,000 items can take over an hour on a million.
date: 2026-10-07
---

Say you have a list of user IDs and want to know whether any ID appears twice. There are three obvious ways to check, and they all work. The difference only shows up when the list gets big, and Big-O is the vocabulary for describing it.

## What Big-O measures

**Big-O notation** describes how the work an algorithm does grows with the size of its input, written n. It deliberately ignores your hardware and language, because those change from machine to machine. Instead it counts steps, then keeps only the term that dominates as n gets large. Doing n²/2 + 3n steps is O(n²): the 3n is swamped at large n, and the ½ is a constant factor, so both get dropped.

Take the first approach to our duplicate check: two nested loops that compare every ID against every later one. That's n(n − 1)/2 pairs, about n²/2, so O(n²). For these timings, assume about 100 million simple operations a second, an order-of-magnitude figure rather than a measurement. At n = 1,000 there are about 500,000 comparisons, roughly 5 milliseconds. At n = 1,000,000 there are about 5 × 10¹¹, roughly 5,000 seconds, or 83 minutes. The input grew 1,000 times and the work grew a million times.

## The common classes

Can we do better than comparing every pair? Sort the IDs first, then scan once, because any duplicates now sit next to each other. A good [sort](/dsa/sorting) takes about n × log₂ n comparisons, so this is **O(n log n)**. A logarithm answers "how many times can I halve n before reaching 1?", so log₂ 1,000,000 is about 20. That's roughly 20 million steps, about 0.2 seconds at a million IDs, and 10,000 steps (0.1 ms) at a thousand.

Better still, walk the list once and keep a **hash set**, a structure that answers "have I seen this ID?" in roughly constant time. That's **O(n)** on average: about 1,000 steps at n = 1,000, and a million at a million, about 10 milliseconds. The set's lookup is **O(1)**, meaning the cost doesn't depend on n. Read about how it manages that in [hash map](/dsa/hash-map).

Two more classes round out the ladder. **O(log n)** is what [binary search](/dsa/binary-search) costs on the sorted IDs: about 20 steps to find one ID among a million. **O(2ⁿ)**, exponential, is what you'd pay to try every subset of the IDs. At n = 30 that's about 10⁹ steps, around 10 seconds. At n = 60 it's about 10¹⁸ steps, roughly 365 years. Exponential algorithms are fine for tiny inputs and useless past a few dozen items.

## Time versus space

Big-O describes memory the same way it describes steps. The hash set stores up to n IDs, so it uses **O(n) space**. Sorting in place needs little extra memory, though that depends on the algorithm and on whether the sort copies the list. The nested loops need none beyond the list itself. So the alternative someone suggests, "just loop," wins when memory is scarce and n is small. The hash set wins when time matters and you can afford the memory.

## Worst, average and amortized cases

Does the duplicate check always cost the full amount? No. If the first two IDs match, the hash set stops after two steps. Big-O usually quotes the **worst case**, here a list with no duplicate, because it's the guarantee. The **average case** is what you expect in practice: a hash lookup is O(1) on average, assuming the hash spreads IDs evenly across the table, but O(n) if many land in the same place. So the hash-set check is O(n) expected and O(n²) in the worst case.

An **amortized** cost spreads an occasional expensive step across the cheap ones. Appending to a [dynamic array](/dsa/arrays-and-strings) is usually one write, but when the array is full it copies everything into one twice as big. That one append is O(n), yet doubling keeps the average over many appends at O(1).

## Why constants still matter

If O(n) always beats O(n²), why not always use the hash set? Because Big-O drops constants, and constants decide the winner at small n. Hashing an ID costs more than comparing two numbers, so for a list of 10 IDs the nested loops can be as fast or faster, and simpler. Big-O tells you who wins as n grows, not who wins today. It also hides a factor like our ½ and the cost of memory access, so when two options share a class, measure.

**Rule of thumb.** Estimate how the work grows with n before you write the code, and pick the simplest approach whose growth you can afford at the largest n you expect.
