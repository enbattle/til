---
title: Compilers, Interpreters and JIT Compilation
summary: The code you write has to become CPU instructions somehow, and when that translation happens (before the run, during it, or one line at a time) decides startup time, speed and when type mistakes surface.
date: 2026-10-07
---

Take one small function that totals the prices in a shopping cart. The idea fits in two lines, yet a CPU can't run either of them as written. A CPU only runs **machine code**, numbered instructions it understands directly, and `total += price` isn't one. Something has to translate your lines into those instructions, and the choice of who translates, and when, changes how fast the program starts, how fast it runs and when your mistakes show up.

This page follows the cart function through the obvious answer (translate everything first), why people wanted another, the interpreter that translates as it goes, the middle path of bytecode, and the just-in-time compiler that combines them.

## Translate everything before the run

The obvious answer is to translate the whole program once, up front, into machine code. The program that does this is a **compiler**, and doing it before the program ever runs is **ahead-of-time (AOT) compilation**. C, Go and Rust work this way.

```c
double cart_total(const double prices[], int n) {
    double total = 0;
    for (int i = 0; i < n; i++) total += prices[i];
    return total;
}
```

You run the compiler once and get a file of machine code, which the CPU runs directly. Nothing is translated while the cart is being totaled, so the loop is as fast as the CPU can go. The compiler also sees the whole program, so it can rearrange the code to run faster.

It also reads the whole program before anything runs. Pass this function the text `"12.50"` instead of an array of numbers and the compiler flags the call (modern GCC refuses to build it). The mistake surfaces at build time, before a single customer is affected. A language that checks types this way, before the run, is **statically typed**. Static types cost you declaring them and satisfying the checker.

The price is a build step, and the output only works on one kind of CPU. Change one line and you wait for the compiler again. What if you skipped the build?

## Translate as you go

An **interpreter** is a program that reads your code and carries out each instruction itself, one at a time, with no machine-code file produced. Here is the cart in Python:

```python
def cart_total(prices):
    total = 0
    for p in prices:
        total += p
    return total
```

Edit it and rerun it instantly. Because it checks types only when a line executes, this is **dynamically typed**: the bad `"12.50"` raises a `TypeError` at `total += p`, but only on a run that reaches that line with that value. A mistake on a rarely used path can sit unnoticed for months.

Nothing was translated ahead, so every line pays the translation cost every time it runs, including each pass through the loop. A tight loop in a plain interpreter is often many times slower than the same loop in machine code. Can the interpreter do some of the work once?

## Translate halfway

Most interpreters do. They translate the source once into **bytecode**, a compact list of instructions for an imaginary CPU, and then run that on a **virtual machine (VM)**, a program that plays the imaginary CPU. CPython, the standard Python, works this way. So does Java: its compiler produces bytecode, and the JVM (Java Virtual Machine) runs it. Java's compiler still checks types first, as C's does, so the bad string never reaches the JVM.

The VM also manages memory as the program runs, including the garbage collector, the part that frees memory nothing uses any more ([stack, heap and garbage collection](/computing-fundamentals/stack-heap-and-garbage-collection)).

The imaginary CPU buys portability. The same bytecode runs on any machine that has the VM. But the VM still looks up and carries out each bytecode instruction as the program runs, so it stays slower than machine code. The cart loop is still paying for translation on every pass.

## Compile only what is hot

A **just-in-time (JIT)** compiler watches the program run and finds the **hot** code, the loop or function that runs thousands of times. It compiles only that to machine code, mid-run, and leaves the rest as bytecode. The JVM's HotSpot and JavaScript's V8 do this, and so does PyPy, an alternative Python.

Run the Python cart on PyPy and it starts out interpreted. After a few thousand orders have called it, the JIT compiles it. It can even optimize for what it has seen, say that `prices` always held numbers, and undo that if a string ever turns up.

The trade is **warm-up**: early runs are interpreted, and compiling costs time and memory. Once warm, the program can approach AOT speed. A server that runs for weeks gets that back many times over. A command-line tool that lives for 50 milliseconds, or a serverless function started fresh per request, never warms up, so AOT suits it better.

So: AOT translates before the run, an interpreter during it, and a JIT does both for the code that earns it. Do these names describe languages, or the programs that run them?

## A language doesn't have one answer

Is Python interpreted? CPython runs bytecode on a VM, and PyPy runs the same language with a JIT. Java is compiled to bytecode, then interpreted and JIT-compiled, and some tools compile it ahead of time too. "Compiled" or "interpreted" describes how one implementation runs a language, and a language can have several.

Typing is a separate axis from all of this. TypeScript adds types to JavaScript and checks them at build time, so the cart's string bug is caught early, then erases them, and plain JavaScript runs. Python's type hints work the same way, but CPython ignores them at run time and a separate tool such as mypy checks them. This is **gradual typing**: static checking you can add to some of the code and not the rest, on a language that runs dynamically.

**Rule of thumb.** Choose how the code runs by how long it lives: compile ahead of time for fast starts and steady speed, run bytecode on a VM when portability matters more than raw speed, or use a JIT when the program runs long enough to warm up. Choose type checking separately, and check before the run wherever the cart's bad string would be costly.
