---
title: CAP Theorem
summary: When the network splits a replicated database in two, it must either refuse some requests or risk stale answers and conflicting writes.
date: 2026-09-14
---

Say you run a shop with one pair of sneakers left in stock. To survive a
crash, you keep the stock count on two servers, one in an East data center
and one in a West one. Each server holds a **replica**, a copy of the same
data, and every write is sent to both. (A [read replica](/systems-and-infrastructure/read-replicas)
is the same idea in a lopsided form.) A system that keeps data on more than
one machine like this is a **distributed system**.

Now the cable between East and West gets cut. Both servers are still up and
both still have customers, but neither can reach the other. That is a
**network partition**: a period when some machines can't talk to some
others, from a severed link, dropped packets or a crashed router. A customer
in the East buys the last pair, and East records the stock as zero. West
never hears about it. What should West do when a customer there asks for the
same pair?

## Two bad options

West can answer from what it knows: "one left, go ahead." That keeps the
shop **available**, meaning every request that reaches a working server gets
a real answer. But the answer may be wrong, and two customers have now
bought one pair of sneakers.

Or West can refuse: "I can't confirm the stock right now, try again later."
That keeps the data **consistent**, meaning a read returns the latest write
or an error, never an older value. But a customer at a working server got
nothing, which looks like an outage.

There is no third option. West can't know what East did without reaching it,
and reaching it is exactly what the partition prevents. That is the **CAP
theorem**: during a partition, a replicated system can guarantee
Consistency or Availability, but not both. The name comes from Consistency,
Availability and Partition tolerance.

## Why partition tolerance isn't optional

CAP is often phrased as "pick two of three." That makes it sound like you
could skip partition tolerance and keep C and A. You can't, for a system that
spans machines: partitions happen whether you planned for them or not. So the
decision is only what to do while the partition lasts, and the two answers
have names.

A **CP** system, consistent over available, would have West refuse the sale.
Systems that need a majority of nodes to agree before they confirm anything
behave this way, such as a coordination service that stores cluster
configuration. An
**AP** system, available over consistent, has West sell the pair anyway and
sort out the conflict once the link heals, perhaps by apologizing to the
second customer. DNS works like this: servers keep answering from cached
records, even stale ones, when they can't reach the source.

The choice is per operation, not per product: a shop can be AP when showing
a product page and CP when charging a card.

## The cost when nothing is broken

CAP says nothing about the rest of the time, when the cable is fine.
But the same tension shows up there as speed. Suppose West wants every read
to reflect the very latest write. Then East must wait for West to confirm
each write before telling the customer it worked, and that wait is a
cross-country round trip. Alternatively, East confirms as soon as its own
copy is updated and ships the change to West in the background. Writes
return faster, but for a short while a read from West can still show the
old stock.

This extension is called **PACELC**: if there is a Partition, choose
Availability or Consistency; Else, choose Latency or Consistency. So "we're AP"
is an incomplete description: two systems can both stay up during a
partition, and only one pays the latency of agreement on every write.
[Latency vs. throughput](/systems-and-infrastructure/latency-vs-throughput)
covers what that waiting costs.

## Choosing the side

So how do you decide for the sneaker count? Ask what a wrong answer costs.
An oversold pair means an apology and a refund, which many shops absorb
rather than turn customers away. A bank balance is different: a double-spent withdrawal
is hard to undo, so refusing is often the lesser harm. When you do take the AP
side, you need a plan for repair, such as the compensating steps in the
[saga pattern](/systems-and-infrastructure/saga-pattern). The same trade
shows up in how any replicated store is configured, relational or
[NoSQL](/systems-and-infrastructure/sql-vs-nosql): whether a write waits for
other copies, and whether a read may come from one that lags. Any
[cache](/systems-and-infrastructure/caching) makes it too, as a deliberately
possibly-stale copy.

**Rule of thumb.** Decide at design time what each piece of data does during a partition: refuse the request when a stale answer is expensive to undo, answer when the stale answer is cheap and a refusal is not.

## Where you'll meet this

In payments and checkout, the sneaker question comes back as a stock count
or an account balance, and the answer often leans consistent for the
money itself, with the cheaper surrounding data (a product page, a review
count) allowed to be stale. A news feed or timeline usually sits on the
availability side: a post that shows up a few seconds late costs a reader
almost nothing, while an error page is a visible failure. Chat mostly leans
the same way for delivery, since a message that arrives late beats a send
that errors out; what it gives up is every device seeing the same messages
in the same order while the partition lasts.
