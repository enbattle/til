---
title: Stack, Heap and Garbage Collection
summary: Where a program keeps its data while it runs, and the four ways languages decide when to free it.
date: 2026-10-07
---

Picture a web server handling thousands of requests a minute. Each request builds an order object (items, customer, total), and when the request ends the order is no longer needed. Two questions follow: where does it live while in use, and who decides it's finished?

This page starts with the two areas of memory a program uses, then four ways of deciding when memory is free: by hand, by counting references, by tracing what is reachable, and by ownership rules.

## The stack and the heap

Start with one function call. While it runs, it needs room for its local variables and a note of where to resume in its caller. The program sets aside a small block of memory for that. A call to another function gets its own block on top; when it returns, its block is thrown away. The blocks pile up and come off in last-in, first-out order, so this area is called the **call stack**, and each block is a **frame**.

Cleanup is nearly free. Memory is a long row of numbered bytes, and a number that says where something sits is an **address**. The program keeps one such number marking the top of the stack. Returning from a function just changes that number to point below the frame, and the space is free for the next call. A variable holding an address is called a **pointer**, so freeing a frame is moving one pointer.

The cost is that a frame dies when its function returns and its size is usually fixed in advance. The order can't live there: its item list has no fixed size, and it may outlast the handler. The stack is also small, often a few megabytes, so a function that calls itself too deeply fills it. That's a **stack overflow**.

The **heap** is the other area. You ask for a block of any size at any time, and it stays until something frees it. That is where the order object goes. The price is that finding a free block takes more work than moving a pointer, and someone must decide when it is free.

## Manual memory management

In C, you ask for heap memory with `malloc` and give it back with `free`. The order is yours until you free it.

This has no extra machinery and gives exact control, but every mistake is yours:

- Forget to free the order after each request and you have a **leak**: memory use climbs until the server dies.
- Free it while another part of the code still holds its address and you get **use-after-free**: reads and writes to memory that may now belong to something else.
- Free it twice and you get a **double free**, which corrupts `malloc`'s records of free blocks.

Every one of those mistakes comes from a human deciding when. What if the program kept count instead?

## Reference counting

Give every object a counter of how many references (pointers to it, held in variables or fields) exist. When a reference is added the count goes up; when one disappears it goes down; at zero, nobody can reach the object, so it's freed on the spot. Swift and CPython (the standard Python) do this.

Your order is freed when the last holder lets go. The cost is bookkeeping on every assignment, and one hole: a **cycle**. If an order points to its customer and the customer points back to the order, both counts stay at one after everything else lets go, and neither is ever freed. Swift leaves this to you, with `weak` references that don't add to the count; CPython adds a second pass that searches for unreachable cycles.

Cycles are the hole. Could the runtime (code the language runs alongside your program) look at what's reachable instead of counting?

## Tracing garbage collection

A **tracing garbage collector** doesn't count anything. Periodically it starts from the **roots** (the variables on the stack, plus globals), follows every reference to find everything reachable, and treats the rest as garbage. Java, Go and JavaScript's engines work this way. Cycles are no problem: an order and customer pointing only at each other are unreachable, so both go.

What does that cost? The collector needs CPU time, and some collectors **pause** your program while they work, which shows up as a latency spike on whatever request is in flight. Many collectors, Java's included, lean on one observation: most objects die young, and your order lives for a single request. A **generational** collector checks recent objects often and long-lived ones rarely, so the common case is a quick sweep of a small area. Others, Go's included, do most of their work alongside your program, so pauses stay short.

## Ownership

One more alternative moves the decision to compile time. By default Rust gives every heap value exactly one **owner**, and frees the value when the owner goes out of scope. The compiler rejects code that could use a value after its owner is gone, or give it two owners. Your order is freed when the handler finishes, and use-after-free and double free can't compile. The price is a learning curve: you must structure code to satisfy the compiler. For shared ownership, Rust offers opt-in reference counting (`Rc`/`Arc`).

## Choosing

Suppose you're picking a language for that server. If a latency spike of a few milliseconds is unacceptable, as in a game loop or a trading system, lean toward manual management or ownership and accept the effort. If developer speed matters most and occasional pauses are fine, a tracing collector is the usual choice. Reference counting sits between: steady small costs, no big pauses. Collectors are part of the runtime; see [compilers, interpreters and JIT](/computing-fundamentals/compilers-interpreters-and-jit).

**Rule of thumb.** Data of a fixed size that dies with its function can live on the stack; anything else goes on the heap, which is where most garbage-collected languages put objects anyway. On the heap you pay for safety with either your own effort or the runtime's time, so spend the one you can afford.
