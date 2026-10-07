---
title: Processes, Threads and Async I/O
summary: A process has its own memory, a thread shares its process's, and an event loop lets one thread juggle thousands of waiting tasks, so which fits depends on whether the work waits or computes.
date: 2026-10-07
---

Your web server gets 1,000 requests at once. Each one asks a database for data and then waits 200 ms for the answer. How do you serve all of them without making the last user wait 200 seconds? Three tools exist, and they differ in what they share and what they cost.

## Processes

A **process** is a running program with its own private memory, which the operating system (OS) walls off from every other process. One process crashing, or reading garbage, can't corrupt another.

Give each request its own process and you get that isolation for free. The price is weight. Starting a process means setting up a fresh memory space and, for an interpreted language, often loading the interpreter again. If each process used 10 MB, 1,000 of them would use 10 GB, and they would have to send data to each other through the OS (pipes, sockets) because they share nothing.

## Threads

A **thread** is a line of execution inside a process. All the threads of one process share its memory, and each has its own stack, the memory holding its function calls. Creating one is far cheaper than creating a process, and threads can read each other's data directly.

Try a thread per request. If each thread sets aside up to 1 MB for its stack, 1,000 threads set aside about 1 GB, and a waiting thread actually uses only a small part of that, so they need far less real memory than 1,000 processes. The cost of sharing is that two threads touching the same data can interleave badly, which is a [race condition](/systems-and-infrastructure/race-conditions). A process's private memory gave you that safety; threads make you earn it with locks.

## Context switches

You have 1,000 threads but maybe 8 CPU cores. How do they all run? The OS runs a few at a time and swaps the rest in and out, a **context switch**: save one thread's registers (the CPU's working slots) and position, load another's. Each switch costs microseconds, and the CPU's caches (its small, fast copies of recently used memory) go cold for the newcomer. Threads that mostly wait cost little here, because a waiting thread isn't scheduled. Thousands of runnable threads can spend noticeable time just switching.

## Async I/O and the event loop

So is there a way to avoid a thread per waiting request? Look at what a thread does for 200 ms: nothing. It holds a stack and waits. **Asynchronous I/O** (I/O is input and output: disk, network, database) flips the arrangement. A request starts its database call and hands control back instead of waiting. A single thread running an **event loop** takes the next piece of ready work, runs it until it would wait, and moves on. When the database answers, the OS signals the loop, which resumes that request.

One thread can now hold all 1,000 requests, each costing a few kilobytes of state instead of a stack. If the loop never stalls, all 1,000 finish in about 200 ms. The catch is that tasks must give way voluntarily. One blocking call stalls every request on the loop, so the whole program needs async-aware libraries.

## I/O-bound versus CPU-bound

That settles the waiting case. Now change the request: each one resizes an image, using the CPU for 50 ms and waiting on nothing. Work that mostly waits is **I/O-bound**. Work that mostly computes is **CPU-bound**.

Run 1,000 resizes on the event loop and the single thread does 1,000 × 50 ms = 50 seconds of work, one after another, while nothing else gets a turn. The loop was built to overlap waiting, and there's no waiting to overlap. What helps is more cores. With the 8 cores doing the work in parallel, the same 50 seconds of work takes about 6 seconds.

Threads or processes? In the default build of CPython, the standard Python implementation, a global interpreter lock lets only one thread run Python code at a time, so CPU-bound Python threads don't speed up (free-threaded builds remove the lock). Processes sidestep it, each with its own interpreter. In languages without that lock, threads work fine. In practice you cap the count with a [worker pool](/systems-and-infrastructure/worker-pools): a fixed set of workers, about one per core for CPU-bound work, pulling jobs from a queue.

Real servers mix both. The event loop takes the 1,000 waiting requests, and the resizes go to a pool of processes or threads, so the loop keeps answering.

**Rule of thumb.** If the work mostly waits, use an event loop or cheap threads so waiting costs almost nothing; if it mostly computes, use about one worker per core; and when you need isolation more than speed, use separate processes.
