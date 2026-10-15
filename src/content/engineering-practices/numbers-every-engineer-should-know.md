---
title: Numbers Every Engineer Should Know
summary: A few rough latency, throughput and storage figures let you check on a napkin whether a design is even plausible.
date: 2026-09-14
---

Say you are building a photo-sharing app for 1 million users, and someone sketches a design on a whiteboard. Each profile page makes a few lookups, and the page must load in under 100 ms. How do you know, in thirty seconds, whether the design can work? You carry a handful of rough numbers in your head and do arithmetic with them.

This page gives the cost of one lookup, uses it to reject a design that cannot meet the 100 ms budget, then turns 1 million users into requests per second and into bytes of storage.

## What one lookup costs

A profile page needs a user's row, and the time it takes depends on where the row sits. The time one operation takes from start to finish is its **latency**.

Small times get small units: 1 ms (a millisecond, a thousandth of a second) is 1,000 μs (microseconds), which is 1,000,000 ns (nanoseconds).

| Where the data is                                                                | Approximate latency |
| -------------------------------------------------------------------------------- | ------------------- |
| L1 cache reference (a tiny memory built into the CPU core, the fastest there is) | ~1 ns               |
| Main memory (RAM) reference                                                      | ~100 ns             |
| SSD (solid-state drive) random read                                              | ~100 μs             |
| Round trip within one datacenter (send a request, get the reply)                 | ~0.5 ms             |
| HDD (spinning hard disk) seek                                                    | ~10 ms              |
| Round trip, US coast to coast                                                    | ~50–70 ms           |
| Round trip, across an ocean                                                      | ~70–150 ms          |

Look at the jumps between rows, not the digits. Convert to nanoseconds to compare them:

```text
RAM to SSD:    100 μs = 100,000 ns;     100,000 ÷ 100 = 1,000 times slower
SSD to coast:  50 ms = 50,000 μs;       50,000 ÷ 100 = 500 times slower
RAM to coast:  50 ms = 50,000,000 ns;   50,000,000 ÷ 100 = 500,000 times slower
```

These are orders of magnitude for typical current hardware, not benchmarks. Real values shift with the machine, the network and the year, and can be off by a factor of a few either way. The gaps between rows are what stay stable.

Your user's row might sit in your server's memory, on a database server one hop away, or in a database on the other coast. Those are three very different pages, so which design misses the budget?

## Catching a design that cannot work

Suppose the profile page makes three lookups, one after another: the user, the IDs of their latest photos, then those photos' details. Each needs the answer to the one before it, so their times add up. Try each place the data could live:

```text
In-process cache (RAM):     3 × 100 ns = 300 ns, under a microsecond
Database, same datacenter:  3 × 0.5 ms = 1.5 ms, plus the query work
Database, other coast:      3 × 50 ms  = 150 ms
```

The first two fit inside 100 ms easily. The third is over, but 150 ms is within a factor of ten of the budget, so on its own it is only a warning. A hard floor settles it. Light in fiber travels about 200,000 km/s, and the other coast is about 4,000 km away:

```text
one way:         4,000 km ÷ 200,000 km/s = 0.02 s = 20 ms
there and back:  2 × 20 ms = 40 ms
three lookups:   3 × 40 ms = 120 ms, over 100 ms with perfect hardware
```

Chained lookups add up, and distance sets a floor no tuning removes, so this design fails for certain. That is the payoff: a design that is badly off gets flagged with "that cannot be right" instead of surviving until load testing. It also explains why teams put data close to the code that reads it, and why a call inside a loop hurts so much, since every iteration pays a full round trip.

So a design with nearby data can meet the latency budget. Can it survive the traffic?

## From users to requests per second

Say each of your 1 million users opens the app 5 times a day, one request each. A day has 86,400 seconds (24 × 60 × 60).

```text
requests a day:      1,000,000 × 5 = 5,000,000
average per second:  5,000,000 ÷ 86,400 ≈ 58
```

A handy anchor: 1 million requests a day is 1,000,000 ÷ 86,400 ≈ 12 a second.

Never size for the average, though. Traffic bunches into busy hours, and the **peak** is the busiest stretch, which is what the servers must survive. With no better data, assume a peak of 10 times the average:

```text
peak: 58 × 10 ≈ 580 requests per second
```

A service used steadily through the day, or across time zones, peaks nearer 2 to 3 times the average, and a flash sale has far larger peaks. Use data when you have it.

Can one server take 580 a second? That depends on what each request does.

## Can a server take it?

For simple reads that a [cache](/systems-and-infrastructure/caching) can answer, a single modern server often handles thousands to tens of thousands per second. If each request does real work in a database, hundreds to a few thousand per second is more typical. So the answer is probably yes if a cache answers most requests, and less certain if each one does real database work. 580 is within a factor of ten of either range, so measure.

The database is usually the first limit you hit, which is why [connection pooling](/systems-and-infrastructure/database-connection-pooling) (reusing open database connections instead of opening one per request) and [read replicas](/systems-and-infrastructure/read-replicas) (extra copies that serve reads) come up so often. How latency and throughput trade against each other is covered in [latency vs. throughput](/systems-and-infrastructure/latency-vs-throughput).

That settles time and traffic. The last number is how much data the app keeps.

## From users to storage

A short text row, such as a caption or a comment, is roughly 100 bytes to 1 KB. A compressed photo is roughly 200 KB to 2 MB, and a minute of video is tens of MB. Each unit up (KB, MB, GB, TB) is 1,000 times the one before.

```text
profiles:  1,000,000 users × 1 KB = 1,000,000 KB = 1,000 MB = 1 GB
photos:    1,000,000 users × 1 MB = 1,000,000 MB = 1,000 GB = 1 TB
```

1 GB fits on a single machine many times over. 1 TB is still within reach of one large disk, but it is where the shape of the problem changes: photos belong in dedicated file storage, not in database rows, and you start thinking about copies for durability and about serving them quickly to users far away. The ratio between the two answers, a thousand to one, told you what to build before you wrote any code.

**Rule of thumb.** Before you trust a design, multiply: lookups in a chain times the cost of each, and users times bytes each. Compare the result with the budget, and distrust any answer that lands within a factor of ten of it, since these figures are only good to about that. The exception is a hard floor, such as the speed of light: if even the floor misses the budget, the verdict is certain.
