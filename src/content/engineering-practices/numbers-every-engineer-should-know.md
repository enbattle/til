---
title: Numbers Every Engineer Should Know
summary: A few rough latency, throughput and storage figures let you check on a napkin whether a design is even plausible.
date: 2026-09-14
---

Say you are building a photo-sharing app for 1 million users, and someone proposes a design on a whiteboard. How do you know, in thirty seconds, whether it can work? You carry a handful of rough numbers in your head and do arithmetic with them. **Latency** is how long one operation takes from start to finish; every figure below is a latency or a size.

These are orders of magnitude for typical current hardware, not benchmarks. Real values shift with the machine, the network and the year, and they can be off by a factor of a few in either direction. What stays stable is how big the gaps between rows are.

## What one lookup costs

Your profile page needs a user's row from somewhere. Where it comes from decides how long the page takes.

| Operation                                                                                                 | Approximate latency |
| --------------------------------------------------------------------------------------------------------- | ------------------- |
| L1 cache reference (a tiny pool of memory built into the CPU core, the fastest storage a program touches) | ~1 ns               |
| Main memory (RAM) reference                                                                               | ~100 ns             |
| SSD (solid-state drive) random read                                                                       | ~100 μs             |
| Round trip within one datacenter (send a request, get the reply)                                          | ~0.5 ms             |
| HDD (spinning hard-disk drive) seek                                                                       | ~10 ms              |
| Round trip, US coast to coast                                                                             | ~50–70 ms           |
| Round trip, across an ocean                                                                               | ~70–150 ms          |

Look at the jumps, not the digits. RAM to an SSD read is about 1,000 times slower. An SSD read to a coast-to-coast round trip is another 500 times (100 μs to 50 ms). So a cross-country round trip costs about 500,000 times a memory reference (100 ns to 50 ms). The long-distance rows have a floor that no hardware removes: light in fiber travels roughly 200,000 km/s, and 4,000 km each way is already about 40 ms there and back.

Your user's row might sit in your server's memory, on its database server's SSD one hop away, or in a database on the other coast. Those are three very different pages.

## Catching a design that cannot work

Suppose the profile page needs three lookups, one after another: the user, the IDs of their latest photos, then those photos' metadata. Each needs the answer to the one before it, and the budget is 100 ms.

- Served from an in-process [cache](/systems-and-infrastructure/caching): 3 × 100 ns is under a microsecond.
- Database in the same datacenter: 3 × 0.5 ms = 1.5 ms of network, plus the query work, comfortably inside the budget.
- Database on the other coast: 3 × 50 ms = 150 ms. That alone is near the budget, so on its own it would only be a warning. But the speed of light sets a floor: 3 × 40 ms = 120 ms is already over 100 ms with perfect hardware, so the design fails for certain, and no tuning of the query fixes it.

That is the payoff. A design that is off by a factor of 1,000 gets flagged with "that cannot be right" instead of surviving until load testing. It also explains why teams put data close to the code that reads it, and why a call made in a loop hurts so much: each iteration pays a full round trip.

## From users to requests per second

Now size the traffic. Say each of your 1 million users opens the app 5 times a day, one request each: 5 million requests a day. A day has 86,400 seconds, so the average is 5,000,000 / 86,400 ≈ 58 requests per second. A handy anchor: 1 million requests a day is about 12 a second.

Never size for the average, though. Traffic bunches into busy hours, so a **peak** of about 10 times the average is a common assumption when you have no better data: here, about 580 requests per second. A service used steadily through the day or across time zones peaks at 2–3x, and a flash sale has much larger ones. Use data when you have it.

Can one server take 580 a second? For simple reads that a cache can answer, a single modern server often handles thousands to tens of thousands per second. If each request does real work in a database, hundreds to a few thousand per second is more typical. So the answer is probably yes if a cache answers most requests, and less certain if each one does real database work. The database is usually the first limit you hit, which is why [connection pooling](/systems-and-infrastructure/database-connection-pooling) (reusing open database connections instead of paying to open one per request) and [read replicas](/systems-and-infrastructure/read-replicas) (extra copies that serve reads) come up so often. How latency and throughput trade against each other is covered in [latency vs. throughput](/systems-and-infrastructure/latency-vs-throughput).

## From users to storage

Last, size the data. A short text row, such as a caption or a comment, is roughly 100 bytes to 1 KB. A compressed photo is roughly 200 KB to 2 MB, and a minute of video is tens of MB.

For your app: 1 million users × 1 KB of profile data is 1 GB, which fits on a single machine many times over. The same users with one 1 MB photo each is 1 TB. That is still within reach of one large disk, but it is where the shape of the problem changes: photos belong in dedicated file storage, not in database rows, and you start thinking about copies for durability and about serving them quickly to users far away. The ratio between the two answers, a thousand to one, told you what to build before you wrote any code.

**Rule of thumb.** Before you trust a design, multiply: lookups in a chain times the cost of each, and users times bytes each. Compare the result with the budget, and distrust any answer that lands within a factor of ten of it, since these figures are only good to about that. The exception is a hard floor, such as the speed of light: if even the floor misses the budget, the verdict is certain.
