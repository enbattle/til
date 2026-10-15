---
title: CPU Caches
summary: Why memory is a ladder from fast and small to slow and large, and why that makes an array of numbers beat a linked list of the same numbers.
date: 2026-10-07
---

Suppose you have ten million prices and want their sum. You can keep them in an array (values stored side by side) or in a linked list (each value in its own small block that points to the next). Both take time proportional to the number of prices, O(n) in [big-O notation](/computing-fundamentals/big-o-notation), so you'd expect a tie. They aren't close. Why?

This page covers the ladder of memory kinds, how the processor fetches from it a block at a time, and why that block makes the array fast and the list slow. How the operating system hands each program its memory in the first place is the job of [virtual memory](/computing-fundamentals/virtual-memory).

## The memory hierarchy

Why not use one kind of memory? Because faster storage costs more per byte, so less of it fits near the processor. A computer stacks several kinds. At the top are **registers**, a few dozen slots inside the CPU. Just below them, still on the CPU chip, are the **caches**: small, fast memories in levels labelled L1, L2 and L3, with L1 smallest and fastest.

Below the chip sits **RAM**, main memory measured in gigabytes. Below RAM is an **SSD** (solid-state drive), which keeps data when the power is off.

Each step down is larger and slower. The [latency numbers](/engineering-practices/numbers-every-engineer-should-know) give the scale: an L1 reference is around 1 ns and a RAM reference around 100 ns. An addition takes about a nanosecond, so a sum that keeps missing the cache spends most of its time waiting on memory:

```text
10,000,000 prices × 100 ns per RAM read = 1,000,000,000 ns = 1 second
10,000,000 prices × 1 ns per cache read = 10,000,000 ns = 0.01 seconds
```

Your prices sit in RAM, so which of those two lines you get depends on how often the cache already holds the next price.

## Cache lines and locality

When the CPU needs a value, it checks the cache first. Finding it is a **hit**; not finding it is a **miss**, and the CPU waits while the data comes up from a lower level.

A miss doesn't fetch one value. It fetches a whole **cache line**, a block of adjacent memory, typically 64 bytes. That bet pays off because of **locality**, the tendency of programs to reuse what they just touched:

- **Spatial locality**: after you read an address, you probably read its neighbours next, and the line brought them along for free.
- **Temporal locality**: data used a moment ago is likely needed again, so it's worth keeping close.

Stored as 8-byte numbers in an array, your prices fit eight to a line:

```text
64 bytes per line ÷ 8 bytes per price = 8 prices per line
```

One miss serves eight reads, so seven in eight reads hit. The access pattern is also so predictable that the CPU can start fetching upcoming lines before you ask (**prefetching**), which pushes the hit rate higher still. So the array stays near the fast line of the arithmetic above. The list is another story.

## Why the linked list loses

A list node holds a price plus the address of the next node, 16 bytes in a language like C, double the array's 8 per price. The nodes were allocated one at a time and, in a long-running program, can sit anywhere in memory. Reading one tells you nothing about where the next is, so most of each cache line is wasted: you paid for 64 bytes and used 16 of them, and often the other 48 aren't even the prices you need next.

Worse, the CPU can't prefetch. It learns the next address only by finishing the read of the current node, so each step can be a full trip to RAM, the slow line of the arithmetic above.

So both are O(n), but big-O ignores the constant cost per step, and here the constants can differ many times over. That's why an array is the default and a linked list earns its place only when you need cheap insertion in the middle. Measure before you decide.

The list is also bigger, 10,000,000 × 16 bytes = 160 MB against the array's 80 MB. That is trivial on a machine with gigabytes free, and a real problem on one without.

**Rule of thumb.** A read costs more the farther down the ladder it falls, so store data that is used together side by side and read it in order. For ten million prices, that means the array.
