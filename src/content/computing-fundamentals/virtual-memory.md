---
title: Virtual Memory
summary: How the operating system gives every program a private memory of its own, and what happens when the programs together want more memory than the machine has.
date: 2026-10-14
---

Suppose two copies of the price-summing program run on the same machine, each holding ten million prices in an 80 MB array. Each program was written as if it owned all of memory, and each one stores its array starting at the same address, 4,000,000. Both can't really live at address 4,000,000 in the same RAM, yet neither crashes. How?

This page covers the private address space each program gets, how the machine translates it to real memory and keeps programs apart, and what happens when real memory runs out. Why a read is faster or slower once it gets there is the job of [CPU caches](/computing-fundamentals/cpu-caches).

## A private numbering

Every [process](/computing-fundamentals/processes-threads-and-async), a running program, is given its own **virtual address space**: a private numbering of memory from zero upward. The 4,000,000 in your program is a **virtual address**. The other copy uses the same virtual address in its own space, and the two are translated to different places in RAM.

Something must turn each virtual address into a place in the real RAM chips. That job belongs to the CPU's **memory management unit** (MMU), a hardware component, working from a table the operating system (OS) maintains. The next question is how big that table is.

## Pages and the page table

A table with one entry per byte would be bigger than the memory it describes. So memory is divided into **pages**, commonly 4 KB, and the **page table** maps whole pages, not single bytes:

```text
80 MB array ÷ 4 KB per page ≈ 20,000 pages
```

The OS can place those pages anywhere in RAM, and they don't have to sit side by side. Your program sees one unbroken array, and the other copy's array lands in entirely different pages of the same RAM.

So the table lets many programs share one RAM. It does something more useful too.

## Isolation

A process can only name addresses its own table maps. It can't read or overwrite another process's memory, because no address in its space leads there. Touching an address the OS never gave it, such as a stray pointer (a stored address gone wrong), crashes the program with a **segmentation fault**.

The same table gives the OS flexibility. It can hand out a page only when the program first touches it, so a program that reserves a big array but uses a small part of it costs little RAM. All of this works while the pages fit. What if they don't?

## Page faults and swapping

Say the machine has 400 MB of RAM free for programs. Five copies of the program take 5 × 80 MB = 400 MB and just fit. A sixth brings the total to 480 MB, which is 80 MB too many.

What happens when a page your program touches isn't in RAM? The MMU raises a **page fault**: the CPU pauses the program and runs the OS, which finds the data, loads it into a free slot in RAM, updates the table and resumes. Some faults are cheap, like the first touch of a fresh page. The expensive kind needs data from disk.

That is **swapping**. When RAM runs short, the OS writes rarely used pages to a reserved area of disk, the **swap space**, and reads them back on a fault. Each such fault costs about as much as an SSD read, roughly 1,000 times a RAM access, and more on a spinning disk:

```text
100 ns per RAM access × 1,000 = 100 µs per fault
pages that don't fit = 80 MB ÷ 4 KB ≈ 20,000
one pass over the prices = 20,000 faults × 100 µs = 2 seconds
```

The whole sum takes at most 1 second even when every read misses the cache ([CPU caches](/computing-fundamentals/cpu-caches) works it out), so 2 seconds of faults per pass at least triples it, and the programs keep needing pages that were just pushed out. A machine that spends most of its time moving pages instead of running code is **thrashing**, which is why running out of memory makes it crawl instead of failing cleanly.

What would someone suggest instead? "Turn swap off." Then the OS has nowhere to put the programs' own data (it can still drop file-backed pages such as program code, which it rereads from disk), and once RAM fills it kills a process (on Linux, the out-of-memory, or OOM, killer). Swap trades a slowdown for survival. On a server where slow is as bad as down, a fast crash that gets restarted can be the better trade.

**Rule of thumb.** Each program sees a private memory that the OS and MMU map onto shared RAM, so size the programs' combined memory to fit in RAM. Once it doesn't, the cost shows up as slowness first and as killed processes after. In the example, five 80 MB programs fit in 400 MB, and a sixth doesn't.
