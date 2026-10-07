---
title: Compilers, Interpreters and JIT Compilation
summary: The code you write has to become CPU instructions somehow, and when that translation happens (before the run, during it, or one line at a time) decides startup time, speed and when type mistakes surface.
date: 2026-10-07
---

Take one small function: it totals the prices in a shopping cart. The idea is two lines long, yet a CPU can't run either of them as written. A CPU only runs **machine code**, numbered instructions it understands directly. Every language is a different answer to how your two lines become those instructions, and who does the translating, and when.

## Layers of abstraction

Machine code is raw numbers. **Assembly** gives each instruction a readable name, and you still choose which **register** (a tiny storage slot inside the CPU) holds each value. Total a cart in assembly and you manage registers by hand.

C hides the registers: you write `total += prices[i]` and the compiler picks them. It still leaves memory to you, so you ask for it and give it back. Java and Go hide that too, since a garbage collector reclaims memory for you (see [stack, heap and garbage collection](/computing-fundamentals/stack-heap-and-garbage-collection)). Python and JavaScript also hide types: you never declare what kind of value a variable holds.

So ask of any layer, "what does it hide from me?" The price of each hidden thing is speed or control, since the layer has to do that work for you.

## Ahead-of-time compilation

A **compiler** translates your whole program into another form before it runs. With **ahead-of-time (AOT)** compilation, the output is machine code, produced once, and the CPU runs it directly. C, Go and Rust work this way.

```c
double cart_total(const double prices[], int n) {
    double total = 0;
    for (int i = 0; i < n; i++) total += prices[i];
    return total;
}
```

The cost is a build step, and one binary per kind of CPU. The benefit is that nothing translates at run time, and the compiler has the whole program to optimize. Hand this function the string `"12.50"` and the compiler flags the call, since a string isn't an array of numbers (modern GCC refuses to build it). That shows up before anyone runs anything.

## Interpretation

What if you skip the build step? An **interpreter** is a program that reads your code and carries out each instruction itself, as it goes. Nothing is produced ahead of time, so you edit and rerun instantly. Here is the cart in Python:

```python
def cart_total(prices):
    total = 0
    for p in prices:
        total += p
    return total
```

The trade-off: every line pays translation cost on every run, including each pass through a loop. A tight loop in a plain interpreter is often many times slower than the same loop in machine code.

## Bytecode and a virtual machine

Reading raw text line by line is slow, so most interpreters do half a compile first. They translate source into **bytecode**, a compact instruction list for an imaginary CPU, then run it on a **virtual machine (VM)**, a program that plays that CPU. CPython, the standard Python, does this, and so does the JVM (Java Virtual Machine) with the bytecode `javac` produces.

Why an imaginary CPU? Portability. The same bytecode runs on any machine that has the VM. The cost is that each bytecode instruction still gets looked up and executed by the VM, so it's slower than native machine code.

## Just-in-time compilation

Could you keep portability and still get speed? A **just-in-time (JIT)** compiler watches the program run, finds the **hot** code (the loop or function that runs thousands of times), and compiles only that to machine code, mid-run. The JVM's HotSpot does this, as do JavaScript engines such as V8 and Python's PyPy.

Run that Python cart on PyPy and it starts out interpreted. After a few thousand orders have called it, the JIT compiles it. It can even optimize for what it has seen, say that `prices` always held numbers, and undo that optimization if a string ever shows up.

The trade: a JIT program starts slowly and **warms up**, since early runs are interpreted and compiling costs time and memory. Once warm, it can approach AOT speed. So a long-running server favors a JIT, while a command-line tool that lives for 50 milliseconds, or a serverless function, favors AOT, which has no warm-up.

## Compiled versus interpreted is about the implementation

Is Python interpreted? CPython runs bytecode on a VM, but PyPy runs the same Python language with a JIT. Java is compiled to bytecode, then interpreted and JIT-compiled, and tools exist that compile it ahead of time too. So "compiled" or "interpreted" describes how a particular implementation runs a language, and a language can have several.

## Static versus dynamic typing

Now hand the cart a price that is a string. The question is when you find out.

A **statically typed** language checks types before the program runs, so Java rejects the bad call at compile time. A **dynamically typed** language checks them when the line executes. Python raises a `TypeError` at `total += p`, but only if that line actually runs with that bad value. JavaScript doesn't even complain: `0 + "12.50"` quietly becomes the text `"012.50"`. That is a separate axis, how willing a language is to convert types for you.

Static catches mistakes early and helps tooling, but costs annotations and rigidity. Dynamic is quicker to write and sketch in, and puts the testing burden on you.

**Gradual typing** splits the difference. TypeScript adds types to JavaScript and checks them at compile time, then erases them, so the running JavaScript has none. Python's type hints are the same idea, but CPython ignores them at run time; a separate tool such as mypy checks them.

**Rule of thumb.** Ask two separate questions. Check types before the run to catch mistakes early. Then choose how the code runs: compile ahead of time for fast starts and steady speed, interpret bytecode when no build step and portability matter more than speed, or let a JIT compile the hot code when the program lives long enough to warm up.
