---
title: Backpressure
summary: A mechanism for a slow consumer to tell a fast producer to slow down, instead of letting unconsumed work pile up without limit.
date: 2026-09-15
---

**Backpressure** is a mechanism for a slower consumer to signal a faster
producer to slow down, rather than letting the work it can't keep up
with pile up without limit. Without it, a producer that's faster than
its consumer just keeps handing off work — into a
[queue](/systems-and-infrastructure/message-queues), a buffer, a
socket — that grows unboundedly until something breaks: memory runs
out, or the whole system slows to a crawl trying to manage a backlog
that never stops growing.

## The problem: a producer that outpaces its consumer

Picture a service reading rows from a database and streaming them to a
client over a slow network connection. If the code just reads as fast as
the database can supply rows and pushes them into an output buffer with
no limit on its size, and the network can only carry a fraction of that
rate, the buffer keeps growing for as long as the mismatch lasts —
holding more and more rows in memory that haven't actually reached the
client yet. Nothing here is technically broken; the producer (the
database read) and the consumer (the network send) are each doing
exactly what they were asked to do. The problem is that nothing is
telling the faster side to wait for the slower one.

## The two things backpressure can actually do: block or drop

There are really only two honest responses once a producer is
outpacing its consumer:

- **Apply real backpressure** — block or slow the producer until the
  consumer has caught up enough to accept more. This is backpressure in
  the literal sense: pressure pushed back upstream, keeping the whole
  pipeline running at the speed of its slowest stage.
- **Shed load** — when blocking the producer isn't acceptable (a
  real-time system that can't afford to stall), deliberately drop or
  reject excess work once a buffer fills, rather than letting it grow
  without bound. This is a stated, deliberate tradeoff — accepting that
  some work won't be handled — not a bug.

Silently letting the buffer grow forever is the one option that isn't
actually a choice — it just delays the failure and makes it worse when
it finally arrives.

## A concrete mechanism: bounded buffers and a stop signal

The most familiar example of true backpressure is one almost every
networked application already relies on without thinking about it: TCP's
own flow-control window. A sender only transmits as much data as the
receiver has already said it currently has room to buffer — the receiver
communicates its available buffer space back to the sender with every
ACK as data flows, and the sender throttles itself accordingly, entirely
below the application layer. Neither side has to poll the other; the signal is
built into the protocol itself.

The same idea shows up explicitly at the application layer in reactive
streaming systems, where a consumer doesn't just passively receive
whatever a producer sends — it explicitly requests a specific number of
items it's currently ready to handle, and the producer sends no more
than that until asked for more. It's the same mechanism as TCP's flow
control, just made visible as something application code participates
in directly instead of getting it for free from the network stack.

## Where you'll meet this

A chat server meets this once per connected client: a phone on a weak
connection drains its outbound buffer more slowly than a busy group
conversation fills it, so the server has to choose between waiting,
dropping, or disconnecting that one client instead of holding an
ever-growing pile of messages in memory for it. A notification or email
pipeline has the same mismatch between stages: the step that expands one
broadcast into thousands of per-recipient messages can enqueue far
faster than the sending step can hand them to a mail provider. A bounded
queue between the two forces the fan-out to slow down, or to drop
low-priority sends on purpose, rather than letting the backlog swell.
A UI receiving updates faster than it can render, and a log shipper
reading lines faster than the network carries them, have the same shape.
