---
title: Processes, Threads and Async I/O
summary: A process has its own memory, a thread shares its process's, and an event loop lets one thread juggle thousands of waiting tasks, so which fits depends on whether the work waits or computes.
date: 2026-10-07
---

Your web server gets 1,000 requests at once. Each one asks a database for data and then waits 200 ms for the answer. Handled one after another, the last user waits 1,000 × 200 ms = 200 seconds. How do you serve all of them at once?

This page tries three answers in turn: a process per request, a thread per request, and one thread that never sits idle. Then it changes the requests from waiting to computing, and ends on one language runtime that bends the picture.

## One process per request

A **process** is a running program with its own private memory, which the operating system (OS) walls off from every other process. One process crashing, or reading garbage, can't corrupt another.

Give each request its own process and you get that isolation for free. The price is weight. Starting a process means setting up a fresh memory space and, for an interpreted language, often loading the interpreter again: the program that reads and runs the code ([compilers, interpreters and JIT](/computing-fundamentals/compilers-interpreters-and-jit)). Say each process uses 10 MB:

```text
1,000 processes × 10 MB = 10,000 MB = 10 GB
```

And because they share nothing, they can only pass data to each other through the OS, with pipes or sockets. Is there something lighter that still lets requests run side by side?

## One thread per request

A **thread** is a line of execution inside a process. All the threads of one process share its memory, so they can read each other's data directly. Each has its own stack, the memory holding its function calls. Creating a thread is far cheaper than creating a process.

Try a thread per request. If each thread sets aside up to 1 MB for its stack:

```text
1,000 threads × 1 MB = 1,000 MB = 1 GB
```

A waiting thread touches only a small part of that, so real memory use is lower still. That is far less than the 10 GB for processes. The cost of sharing is that two threads touching the same data can interleave badly, which is a [race condition](/systems-and-infrastructure/race-conditions). A process's private memory gave you that safety; threads make you earn it with locks.

So threads fix the memory bill. Do they fix the machine?

## Context switches

You have 1,000 threads but maybe 8 CPU cores, the units that each run one thread at a time. The OS runs a few threads at a time and swaps the rest in and out. Each swap is a **context switch**: save one thread's position and working data, then load another's.

A switch costs microseconds, and the CPU's caches, its small, fast copies of recently used memory, go cold for the newcomer.

Threads that mostly wait cost little here, because the OS doesn't schedule a waiting thread. Thousands of runnable threads can spend noticeable time just switching. But look at what your 1,000 threads do for those 200 ms: nothing. Each holds a stack and waits. Can you avoid paying for that?

## One thread and an event loop

**Asynchronous I/O** flips the arrangement. (I/O is input and output: disk, network, database.) A request starts its database call and hands control back instead of waiting.

A single thread runs an **event loop**: it takes the next piece of ready work, runs it until it would wait, and moves on. When the database answers, the OS signals the loop, which resumes that request.

One thread now holds all 1,000 requests, each costing a few kilobytes of state instead of a stack. If the loop never stalls, all 1,000 finish in about 200 ms, not 200 seconds.

The catch is that tasks must give way voluntarily. One blocking call stalls every request on the loop, so the whole program needs async-aware libraries.

So the event loop wins when requests wait. Change the requests and see.

## When the work computes

Now each request resizes an image, using the CPU for 50 ms and waiting on nothing. Work that mostly waits is **I/O-bound**. Work that mostly computes is **CPU-bound**.

Run 1,000 resizes on the event loop and the single thread does the work one after another, while nothing else gets a turn:

```text
1,000 × 50 ms = 50,000 ms = 50 seconds
```

The loop was built to overlap waiting, and there is no waiting to overlap. What helps is more cores. Spread across 8 cores working in parallel:

```text
50 seconds ÷ 8 cores = about 6 seconds
```

So CPU-bound work needs parallel workers, not cleverer waiting. You cap them with a [worker pool](/systems-and-infrastructure/worker-pools): a fixed set of workers, about one per core, pulling jobs from a queue. Real servers mix both. The event loop takes the 1,000 waiting requests, and the resizes go to a pool of processes or threads, so the loop keeps answering.

Threads or processes for that pool? Mostly a matter of isolation versus weight, as above. But one runtime changes the answer.

## One runtime's constraint

Python's standard implementation, CPython, has a global interpreter lock (GIL) that lets only one thread run Python code at a time. Threads still help while waiting, since a waiting thread lets go of the lock.

If the resize runs as Python code, CPU-bound threads don't speed up: your 8 threads would still take about 50 seconds. Libraries that do the work in C, such as Pillow, release the lock and do speed up. Processes sidestep the lock, each with its own interpreter. A newer free-threaded build of CPython, one compiled without the lock, removes the limit.

This is that runtime's rule, not one of computing in general. In languages without such a lock, threads run CPU-bound work in parallel and the 6-second figure holds. Check what your runtime allows before choosing.

**Rule of thumb.** If the work mostly waits, use an event loop or cheap threads so waiting costs almost nothing; if it mostly computes, use about one worker per core; and when you need isolation more than speed, use separate processes.
