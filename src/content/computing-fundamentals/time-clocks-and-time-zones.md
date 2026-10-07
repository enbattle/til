---
title: Time, Clocks and Time Zones
summary: Store moments as UTC instants, name zones by region rather than offset, time durations with a monotonic clock, and never order events across machines by wall-clock timestamps.
date: 2026-10-07
---

Say you run a service that sends every user a reminder at 9:00 their local time, every day. It logs when each reminder went out and how long each batch took. Two kinds of clocks, several machines' worth of disagreement and one pile of zone rules are hiding in that sentence, and each fails differently.

## Timestamps and UTC

First, how do you write down a moment? A **Unix timestamp** is the count of seconds since midnight on 1 January 1970, UTC (Coordinated Universal Time, the world's reference time, which has no daylight saving). It is one number, the same everywhere on Earth, so two timestamps compare and subtract with plain arithmetic. That makes it the right thing to put in your "reminder sent" log.

A timestamp is stored in a fixed-width integer (see [data representation](/computing-fundamentals/data-representation)). A signed 32-bit count tops out at 2,147,483,647 seconds, which is 03:14:07 UTC on 19 January 2038. One second later it wraps to a date in 1901. That is the "year 2038 problem", and the fix is a 64-bit count, which lasts for billions of years.

The rule that follows: store and compare **instants** (one exact moment) in UTC, and convert to a user's zone only when you display. The alternative is storing local times, and it loses because "01:30" alone doesn't say which of two moments you mean, as the next sections show.

## Time zones and daylight saving

Now the 9:00 part. A user in New York wants 9:00 local, which is 14:00 UTC in winter and 13:00 UTC in summer. Why not store "UTC-5" for that user and be done? Because an **offset**, the gap between local time and UTC, is not a property of a place. It changes twice a year with daylight saving time (DST), and governments also change the rules, sometimes with a few weeks' notice.

So you store a zone by region name, like `America/New_York`, from the IANA time zone database, a shared, regularly updated record of every region's past and present rules. Your language's date library uses it to turn "9:00 on this date in this zone" into the right UTC instant.

One more consequence: for a future event, such as a meeting a year out at 9:00 local, store the local time plus the zone, not the UTC instant. If the law moves the offset before then, the local time is what the person meant.

## Gaps and overlaps

DST creates two awkward local times. In the US, clocks jump from 2:00 to 3:00 in spring, so 2:30 AM never happens that night. In fall they go from 2:00 back to 1:00, so 1:30 AM happens twice.

Your 9:00 reminder is safe, because 9:00 exists every day. But suppose you also run a nightly cleanup "at 2:30 local". In spring, a naive scheduler either skips it or fires late, at 3:00 or 3:30. In fall, a scheduler that matches the clock reading can run it twice. Libraries pick a rule for each case, and you should know which. The alternatives are to schedule such jobs in UTC, which has no gaps, or to avoid the 1:00 to 3:00 window. A job that must run once per local day should also record "already ran for this date", so a repeat is harmless.

## Wall clock vs. monotonic clock

Now the batch duration. The obvious way is to read the time before and after and subtract. That uses the **wall clock**, the one that tells the calendar time. It can jump, because the system corrects it by syncing to a time server, and an operator can change it too. If it jumps back mid-batch, your batch took negative time.

A **monotonic clock** only counts forward, from an arbitrary starting point, and never jumps when the clock is corrected. It can't tell you the date, but subtraction is exactly what you need: `time.monotonic()` in Python, `performance.now()` in JavaScript, `System.nanoTime()` in Java. Rule: wall clock to say when, monotonic clock to say how long. [Rate limiters](/systems-and-infrastructure/rate-limiting) and timeouts usually measure with it too.

## Clock skew between machines

Last, you run the reminder service on ten machines, each logging its own timestamps. Each machine has its own quartz oscillator that drifts. **NTP** (Network Time Protocol) periodically asks a time server for the right time and nudges the local clock, which typically keeps machines within milliseconds to tens of milliseconds of each other, not exactly equal. The difference between two machines' clocks is **skew**.

So suppose machine A logs "sent 14:00:00.004" and machine B logs "retried 14:00:00.002". Which happened first? You can't tell, because the gap is smaller than the skew. Sorting events by wall-clock timestamps across machines gives a plausible but unreliable order. The alternative is a counter that doesn't depend on any clock: a database sequence, or a version number that each write increments. It wins whenever order matters for correctness.

Time-based expiry has the same weakness. A [distributed lock](/systems-and-infrastructure/distributed-locks) with a lease depends on the lock server and the holder agreeing about how much time has passed, and a skewed or paused holder breaks that.

**Rule of thumb.** Keep three questions apart: when did something happen (a UTC instant), what did the person mean (local time plus a named zone), and how long did it take (a monotonic clock). When order across machines matters, use a counter, not a timestamp.
