---
title: 'The JavaScript Event Loop: Microtasks vs. Macrotasks'
summary: Why a Promise callback always runs before a setTimeout(fn, 0), and what's actually deciding that order.
date: 2026-09-13
---

JavaScript runs your code on a single thread — it can only do one thing
at a time. And yet it constantly handles things that take time (a network
request, a timer, a file read) without freezing up while it waits. The
mechanism that makes that possible is called the **event loop**, and
understanding it explains a lot of async behavior that otherwise looks
mysterious.

## The pieces involved

- **The call stack** is where your currently-running code lives — the
  chain of functions that called each other to get to this point. When a
  function returns, it comes off the stack.
- **Web APIs / runtime APIs** are provided by the browser or Node.js, not
  by JavaScript itself — things like `setTimeout`, network requests, and
  file access. When you call one of these, it runs _outside_ your
  JavaScript code and reports back later.
- **Task queues** hold the callbacks that are ready to run once that
  outside work finishes — but they can't run immediately; they wait until
  the call stack is completely empty.
- **The event loop** is the process that constantly checks: "is the call
  stack empty? If so, what's next in the queues?"

## Two different queues, not one

This is the part that trips people up: there isn't a single queue of
"things to do next." There are (at least) two, and they're treated very
differently:

- **The microtask queue** holds things like Promise `.then`/`.catch`
  callbacks and `queueMicrotask`.
- **The macrotask queue** (sometimes just called "the task queue") holds
  things like `setTimeout`, `setInterval`, and I/O callbacks.

The rule that matters: **every time the call stack empties, the event
loop fully drains the entire microtask queue — including any new
microtasks added while draining it — before running even one macrotask.**
Only once the microtask queue is completely empty does the next
macrotask get a turn.

## Seeing it in code

```js
console.log('1: start');

setTimeout(() => {
  console.log('2: timeout callback');
}, 0);

Promise.resolve().then(() => {
  console.log('3: promise callback');
});

console.log('4: end');
```

The output is always:

```
1: start
4: end
3: promise callback
2: timeout callback
```

Here's why: the two `console.log` calls in the main script run
immediately, since they're already on the call stack — that explains `1`
and `4` coming first. `setTimeout` and the Promise's `.then` both hand
their callbacks off to be run _later_, once the current script finishes
and the stack is empty. But when the stack does empty, the event loop
checks the microtask queue first — that's where the Promise callback is
waiting — and runs everything there before it even looks at the macrotask
queue, where the timeout callback is waiting. So the promise callback
(`3`) always wins, even though `setTimeout` was called first and even
with a delay of `0`.

## Why this is worth actually knowing

"Just use `async`/`await` and don't worry about it" works most of the
time — but the underlying ordering still applies, since `async`/`await`
is built on top of Promises and therefore the microtask queue. It matters
in practice when:

- **Debugging unexpected ordering.** If a `setTimeout(fn, 0)` runs later
  than you expected relative to some Promise-based code, this is why.
- **Avoiding UI jank.** Because microtasks all run before the browser
  gets a chance to repaint, queuing an unbounded chain of microtasks
  (a Promise that resolves into another Promise that resolves into
  another…) can block rendering in a way that scheduling the same work
  as macrotasks would not.
- **Reasoning about concurrency bugs.** "Which of these two callbacks
  runs first?" is often _not_ about which one was scheduled first, but
  about which queue it landed in.

The event loop isn't a niche implementation detail — it's the actual
mechanism deciding the order your async code runs in, and "microtasks
fully drain before the next macrotask" is the one rule that explains most
of the surprising cases.
