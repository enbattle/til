---
title: Backpressure
summary: When a consumer can't keep up with a producer, the fix is to make the producer wait or shed work on purpose, because an unbounded buffer only delays the crash.
date: 2026-09-15
---

Say you run a service that exports a customer's order history. It reads rows
from a database and streams them to a browser. The database can hand over a
million rows a second. The customer's hotel Wi-Fi can carry a hundredth of
that. What happens to the other 99% of the rows?

If the code reads as fast as the database allows and drops each row into an
output buffer with no size limit, they pile up in memory. The buffer grows for
as long as the mismatch lasts, holding more and more rows that haven't reached
the browser. Nothing is broken: the reader and the sender are each doing
exactly what they were told. But the process eventually runs out of memory, or
spends so long managing the backlog that everything else on it slows down.

The problem is that nothing tells the fast side to wait for the slow side. A
mechanism that does is called **backpressure**: the slower stage (the
**consumer**, here the sender to the browser) signals back upstream to the
faster one (the **producer**, here the database read), so the whole pipeline runs at the speed of its slowest part.

## What can you do when the buffer fills?

First, put a limit on it. A **bounded buffer** holds at most some fixed number
of rows, say 1,000. Once it is full, you have two real options, plus the one
people fall into by default:

- **Block the producer.** The database read pauses until the sender has made
  room. No row is lost and memory stays flat, but the producer is stalled
  while it waits. For an export, that is exactly what you want.
- **Shed load.** Drop or reject the excess on purpose. This suits a system
  that can't afford to stall, such as a live dashboard where a stale row is
  worthless by the time it arrives: drop the oldest rows.
  Some work goes unhandled, and you accepted that in advance.
- **Let it grow.** This is the unbounded buffer from the start of the page. It
  isn't a third strategy, only the first two with the decision postponed until
  the machine makes it for you, at the worst moment.

How do you choose between blocking and shedding? Ask whether the work is still
worth doing late. An export is, so block. A cursor position or a price tick
usually isn't, so drop it and send the newest value.

## How does the producer find out?

Someone has to say "wait" without the producer polling for it. You already
rely on one such signal, in TCP. A receiver tells the sender how much buffer
space it has left (the **receive window**) in every acknowledgement, and the
sender never has more unacknowledged data in flight than that. When the
receiving application reads slowly, the window shrinks to zero and the sender
stops. When the network itself is the slow part, as with hotel Wi-Fi, TCP's
congestion control limits the sender instead, paced by acknowledgements (the
receiver's "got it" replies) that arrive slowly. Either way the socket's send
buffer fills and your export service's write stops accepting data: the slow
connection has travelled back to your process.

Your code needs a way to hear that signal, and most streaming libraries have
one. In Node.js, `write()` on a stream returns `false` once its internal
buffer passes a threshold, and the producer is meant to wait for a `drain`
event before writing again. Reactive streaming libraries make the same idea
explicit: the consumer asks for a specific number of items ("send me 100"),
and the producer sends no more until asked again. It is TCP's window, applied
to your own code.

The usual way to get backpressure wrong is to cut the chain. If your service
copies each row into an unbounded in-memory queue, or hands each one to its own
background task, the signal stops at that queue and the producer never feels
it. Every hop between producer and consumer needs a bound, or the one without
a bound is where the pile forms.

Can the same idea work between separate services, where there is no shared
protocol? Yes, though you build it yourself. A bounded
[queue](/systems-and-infrastructure/message-queues) between two services makes
a full queue the signal, and the sender sees it as a rejected or delayed
enqueue. Capping how much work each caller may submit
([rate limiting](/systems-and-infrastructure/rate-limiting)) pushes the limit
back to the edge, and a fixed set of
[workers](/systems-and-infrastructure/worker-pools) pulling jobs from a queue
bounds how much runs at once.

**Rule of thumb.** Put a bound on every buffer between a fast stage and a slow
one, and decide in advance what happens when it fills: block the producer if
the work is still worth doing late, drop it if it isn't.

## Where you'll meet this

A chat server meets this once per connected client: a phone on a weak
connection drains its outbound buffer more slowly than a busy group
conversation fills it, so the server has to choose between waiting, dropping,
or disconnecting that one client instead of holding an ever-growing pile of
messages in memory for it. A notification or email pipeline has the same
mismatch between stages: the step that expands one broadcast into thousands of
per-recipient messages can enqueue far faster than the sending step can hand
them to a mail provider, so a bounded queue between the two forces the fan-out
to slow down, or to drop low-priority sends on purpose. A news feed shows both
choices on one screen: new posts are buffered behind a "new posts" button
rather than dropped, while live like and view counts keep only the newest value.
