---
title: CPU Caches and Virtual Memory
summary: Why memory is a ladder from fast and small to slow and large, and how the operating system gives every program a private memory of its own.
date: 2026-10-07
---

Suppose you have ten million prices and want their sum. You can keep them in an array (values stored side by side) or in a linked list (each value in its own small block that points to the next). Both take time proportional to the number of prices, O(n) in [big-O notation](/computing-fundamentals/big-o-notation), so you'd expect a tie. They aren't close. This page explains why, and then what happens when the same program runs on a machine short of memory.

## The memory hierarchy

Why not use one kind of memory? Because faster storage costs more per byte, so less of it fits near the processor. A computer stacks several kinds. From the top: **registers** (a few dozen slots inside the CPU), the **caches** (small, fast memories on the CPU chip, labelled L1, L2 and L3, with L1 smallest and fastest), **RAM** (main memory, gigabytes), then an **SSD** (solid-state drive, which keeps data when the power is off).

Each step down is larger and slower. The [latency numbers](/engineering-practices/numbers-every-engineer-should-know) give the scale: an L1 reference is around 1 ns and a RAM reference around 100 ns. An addition takes about a nanosecond, so a sum that keeps missing the cache spends most of its time waiting on memory.

## Cache lines and locality

When the CPU needs a value, it checks the cache first. Finding it is a **hit**; not finding it is a **miss**, and the CPU waits while the data comes up from a lower level.

A miss doesn't fetch one value. It fetches a whole **cache line**, a block of adjacent memory, typically 64 bytes. That bet pays off because of **locality**, the tendency of programs to reuse what they just touched:

- **Spatial locality**: after you read an address, you probably read its neighbours next, and the line brought them along for free.
- **Temporal locality**: data used a moment ago is likely needed again, so it's worth keeping close.

Stored as 8-byte numbers in an array, your prices fit eight to a line, so one miss serves eight reads. The access pattern is also so predictable that the CPU can start fetching upcoming lines before you ask (**prefetching**). Most reads hit.

## Why the linked list loses

A list node holds a price plus the address of the next node, 16 bytes in a language like C, double the array's 8 per price. The nodes were allocated one at a time and, in a long-running program, can sit anywhere in memory. Reading one tells you nothing about where the next is, so most of each cache line is wasted. And the CPU can't prefetch: it learns the next address only by finishing the read of the current node. Each step can be a full trip to RAM.

So both are O(n), but big-O ignores the constant cost per step, and here the constants can differ many times over. That's why an [array](/dsa/arrays-and-strings) is the default and a [linked list](/dsa/linked-list) earns its place only when you need cheap insertion in the middle. Measure before you decide.

## Virtual memory

Now run the program on a shared machine, where dozens of programs each assume they own all of memory. How?

Each [process](/computing-fundamentals/processes-threads-and-async) gets its own **virtual address space**: a private numbering of memory from zero upward. Every address in your program, including each pointer (a stored address) in the linked list, is virtual. The CPU's **memory management unit** (MMU), a hardware component, translates each one into a location in RAM using a table the operating system (OS) maintains. Memory is divided into **pages**, commonly 4 KB, and the table maps pages, not single bytes. The stack and heap from [stack, heap and garbage collection](/computing-fundamentals/stack-heap-and-garbage-collection) both live in this virtual space.

Two things follow. First, **isolation**: a process can only name addresses its own table maps, so it can't read or overwrite another process's memory. Touching an address the OS never gave it crashes it (a segmentation fault). Second, flexibility: the OS can place pages anywhere in RAM, or hand one out only when it's first touched.

## Page faults and swapping

What if a page your program touches isn't in RAM? The MMU raises a **page fault**: the CPU pauses the program and runs the OS, which finds the data, loads it into a free slot in RAM, updates the table and resumes. Some faults are cheap, like the first touch of a fresh page. The expensive kind needs data from disk, such as a page that was swapped out. In **swapping**, when RAM runs short, the OS writes rarely used pages to disk (swap space) and reads them back on a fault. Your prices take 80 MB as an array and 160 MB as a list, trivial on a machine with gigabytes free. But if your program, or all the programs together, want more than RAM holds, pages are written out and read back constantly. Each fault costs about as much as an SSD read, roughly 1,000 times a RAM access, and more on a spinning disk. A machine that spends most of its time moving pages instead of running code is **thrashing**, which is why running out of memory makes it crawl instead of failing cleanly.

What would someone suggest instead? "Turn swap off." Then the OS has nowhere to put your program's own data and, once RAM fills, kills a process (on Linux, the out-of-memory, or OOM, killer). Swap trades a slowdown for survival; on a server where slow is as bad as down, a fast crash that gets restarted can be the better trade.

**Rule of thumb.** Memory is a ladder and a read costs more the farther down it falls, so keep data that's used together stored together, and keep what you're working on within RAM.
