---
title: Time, Clocks and Time Zones
summary: Store moments as UTC instants, name zones by region rather than offset, time durations with a monotonic clock, and never order events across machines by wall-clock timestamps.
date: 2026-10-07
---

Say you run a service that sends every user a reminder at 9:00 their local time, every day. It logs when each reminder went out and how long each batch took, and it runs on ten machines. Each depends on a different kind of time, and each fails differently. How do you record a moment, schedule one, measure a duration and put events in order without being wrong twice a year?

This page covers how to write down a moment, why a zone is a place and not an offset, the awkward hours daylight saving creates, the two clocks inside one machine, and what goes wrong when machines disagree.

## Timestamps and UTC

First, how do you write down a moment? A **Unix timestamp** is the count of seconds since midnight on 1 January 1970, UTC (Coordinated Universal Time, the world's reference time, which has no daylight saving). It is one number, the same everywhere on Earth, so timestamps compare and subtract with plain arithmetic. That suits your "reminder sent" log.

The count lives in a fixed-width integer (see [data representation](/computing-fundamentals/data-representation)). A signed 32-bit one tops out at 2,147,483,647 seconds:

```text
2,147,483,647 s ÷ 31,556,952 s per year ≈ 68 years
1970 + 68 = 2038
```

One second past that moment the count wraps to a negative number, a date in 1901: the "year 2038 problem". A 64-bit count fixes it for billions of years.

So store and compare **instants** (one exact moment) in UTC, and convert to a user's zone only when you display. Local times lose, because "01:30" alone can mean two moments, as a later section shows. But UTC alone can't tell you when 9:00 is for a user in New York.

## Time zones and daylight saving

A user in New York wants 9:00 local, which is 14:00 UTC in winter and 13:00 UTC in summer. Why not store "UTC-5" for that user and be done? Because an **offset**, the gap between local time and UTC, is not a property of a place. It changes twice a year with daylight saving time (DST), and governments change the rules, sometimes on weeks' notice.

```text
9:00 in New York, winter: 9 + 5 = 14:00 UTC
9:00 in New York, summer: 9 + 4 = 13:00 UTC
```

So you store a zone by region name, like `America/New_York`, from the IANA time zone database, a shared, updated record of every region's rules. Your language's date library uses it to turn "9:00 on this date in this zone" into the right UTC instant. For a future event, such as a meeting a year out, store the local time plus the zone, not the UTC instant: if the law moves the offset before then, the local time is what the person meant.

The library recomputes your reminder's instant every day, so it survives. Other jobs aren't so lucky.

## Gaps and overlaps

DST creates two awkward local times. In the US, clocks jump from 2:00 to 3:00 in spring, so 2:30 AM never happens that night. In fall they go from 2:00 back to 1:00, so 1:30 AM happens twice.

Your 9:00 reminder is safe, because 9:00 exists every day. But take a nightly cleanup "at 2:30 local". In spring a naive scheduler skips it or fires late; in fall one that matches the clock reading can run it twice.

Libraries pick a rule for each case, so know which. Or schedule such jobs in UTC, which has no gaps. A job that must run once per local day should also record "already ran for this date", so a repeat is harmless.

Those are problems with what the clock says. The next one is a problem with how you read it.

## Wall clock vs. monotonic clock

Now the batch duration. The obvious way is to read the time before and after and subtract. That uses the **wall clock**, the one that tells the calendar time. It can jump, because the system corrects it by syncing to a time server. Suppose the batch starts at 14:00:00 and really takes 3 seconds, and midway a correction sets the clock back 2 seconds:

```text
clock at end:  14:00:00 + 3 s - 2 s = 14:00:01
end - start:   14:00:01 - 14:00:00 = 1 s
```

A bigger correction would make it negative.

A **monotonic clock** only counts forward, from an arbitrary starting point, and never jumps when the clock is corrected. It can't tell you the date, but subtraction is all you need (`time.monotonic()` in Python, `performance.now()` in JavaScript). So use the wall clock to say when and the monotonic clock to say how long. [Rate limiters](/systems-and-infrastructure/rate-limiting) and timeouts usually measure with it too.

So one machine needs two clocks. Ten machines bring a worse problem.

## Clock skew between machines

Each machine's clock runs slightly fast or slow. **NTP** (Network Time Protocol) periodically asks a time server for the right time and nudges the local clock, which typically keeps machines within milliseconds to tens of milliseconds of each other.

They are never exactly equal. The difference between two machines' clocks is **skew**.

Suppose machine A logs "sent 14:00:00.004" and machine B logs "retried 14:00:00.002". Which happened first? The timestamps say B, but the 2 ms gap is smaller than the skew, so you can't tell. Sorting by wall-clock timestamps across machines gives a plausible but unreliable order.

The alternative is a counter that doesn't depend on any clock: a database sequence, or a version number that each write increments. Event 41 came before event 42 whatever any clock said, so a counter wins whenever order matters for correctness.

Time-based expiry trusts that machines agree on how much time has passed. Say machine A marks a user's reminder "claimed" for 30 seconds, so a crashed machine can't block it forever, and B retries once the mark expires. If A freezes for 40 seconds, it never notices the mark expired, and both send. A [distributed lock](/systems-and-infrastructure/distributed-locks), a claim that only one machine at a time can hold, has the same trap when it expires on a timer.

**Rule of thumb.** Keep three questions apart: when did something happen (a UTC instant), what did the person mean (local time plus a named zone), and how long did it take (a monotonic clock). When order across machines matters, use a counter, not a timestamp.
