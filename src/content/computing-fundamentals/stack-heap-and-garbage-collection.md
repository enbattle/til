---
title: Stack, Heap and Garbage Collection
summary: Where a program keeps its data while it runs, and the four ways languages decide when to free it.
date: 2026-10-07
---

Picture a web server handling thousands of requests a minute. Each request builds an order object (items, customer, total), and when the request ends the order is no longer needed. Two questions follow: where does it live while in use, and who decides it's finished?

## The stack and the heap

A program's memory has two main areas. The **call stack** holds one **frame** for each function call that hasn't returned yet: that call's local variables and the place to resume in its caller. Calling a function pushes a frame; returning pops it. The cleanup is automatic and nearly free, because freeing a frame just moves one pointer (a variable holding a memory **address**, the number that locates a byte in memory).

The cost is that a frame dies when its function returns, and its size is usually fixed before the program runs. The order can't live there: its item list has no fixed size, and it may need to outlast the handler, say to be queued for shipping. The stack also has a fixed size (often a few megabytes), so a function that recurses too deeply, or forever, fills it. That's a **stack overflow**: some languages crash, others raise an error first (Python raises `RecursionError` at a default depth of about 1,000). If you've seen recursion in [depth-first search](/dsa/depth-first-search), this is its limit.

The **heap** is the other area. You ask for a block of any size at any time, and it stays until something frees it. That is where the order object goes. The price is that finding a free block takes more work than moving a pointer, and someone must decide when the block is free. The rest of this page is four answers to that.

## Manual memory management

In C, you ask for heap memory with `malloc` and give it back with `free`. The order is yours until you free it.

Why want this? There's no runtime machinery, and you control exactly when memory is released. The trade is that every mistake is yours:

- Forget to free the order after each request and you have a **leak**: memory use climbs until the server dies.
- Free it while another part of the code still holds its address and you get **use-after-free**: reads and writes to memory that may now belong to something else.
- Free it twice and you get a **double free**, which corrupts the records `malloc` keeps of which blocks are free.

The last two are a well-known source of security vulnerabilities as well as crashes.

## Reference counting

Give every object a counter of how many references (variables or fields holding its address) point at it. When a reference is added the count goes up; when one disappears it goes down; at zero, nobody can reach the object, so it's freed on the spot. Swift does this (it calls it ARC, automatic reference counting), and CPython, the standard Python implementation, does too.

Your order is freed the moment the last holder lets go, with no `free` call to forget. The cost is bookkeeping on every assignment, and one hole: a **cycle**. If an order points to its customer and the customer points back to the order, both counts stay at one after everything else lets go, and neither is ever freed. Swift leaves this to you, with `weak` references that don't add to the count. CPython adds a second mechanism that periodically searches for unreachable cycles and frees them.

## Tracing garbage collection

A **tracing garbage collector** doesn't count anything. Periodically it starts from the **roots** (the variables on the stack, plus globals), follows every reference to find everything reachable, and treats the rest as garbage. Java, Go and JavaScript's engines work this way. Cycles are no problem: an order and customer pointing only at each other are unreachable, so both go.

What does that cost? The collector needs CPU time, and some collectors **pause** your program while they work, which shows up as a latency spike on whatever request is in flight. Many collectors, Java's included, lean on one observation to keep this cheap: most objects die young. Your order object lives for a single request. A **generational** collector checks recently created objects often and long-lived ones rarely, so the common case is a quick sweep of a small area. Modern collectors also run much of their work alongside your program, which shortens pauses.

## Ownership

One more alternative moves the decision to compile time. Rust gives every heap value exactly one **owner**, and frees the value when the owner goes out of scope. The compiler rejects code that could use a value after its owner is gone, or give it two owners. Your order is freed when the handler finishes, with no counter and no collector, and use-after-free and double free can't compile. The price is a learning curve: you must structure code to satisfy the compiler. For shared ownership, Rust offers opt-in reference counting.

## Choosing

Suppose you're picking a language for that server. If a latency spike of a few milliseconds is unacceptable, as in a game loop or a trading system, lean toward manual management or ownership and accept the effort. If developer speed matters most and the service tolerates occasional pauses, a tracing collector is the usual choice. Reference counting sits between, with steady small costs instead of occasional large ones. Collectors are part of the language's runtime; see [compilers, interpreters and JIT](/computing-fundamentals/compilers-interpreters-and-jit).

**Rule of thumb.** Data of a fixed size that dies with its function can live on the stack; anything else goes on the heap, which is where most garbage-collected languages put objects anyway. On the heap you pay for safety with either your own effort or the runtime's time, so spend the one you can afford.
