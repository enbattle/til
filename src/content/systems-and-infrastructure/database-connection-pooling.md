---
title: Database Connection Pooling
summary: A pool keeps a small set of database connections open and lends them out, so each request skips the setup cost, and its size has to fit the database's limit across every app instance.
date: 2026-09-15
---

Say you run a storefront API: four application servers in front of one PostgreSQL database. Each request needs one query, a lookup that takes about 2 ms. Your first version opens a connection, runs the query and closes the connection. Why is that a problem?

Because a **connection** is not free to create. The application opens a network link to the database (a TCP handshake), usually negotiates encryption on top of it (a TLS handshake), and then the database checks the credentials. Only then can a query run. Depending on distance and configuration, that setup can plausibly take anywhere from a few milliseconds to tens of milliseconds. Take 20 ms as our figure. Each request now costs 20 ms of setup plus 2 ms of query, so about 90% of its database time is spent on a handshake that does no useful work.

## The fix: open once, lend out

A **connection pool** is a set of connections opened ahead of time and kept open. A request **checks out** one, runs its queries, and **checks it back in**, and the pool lends the same connection to the next request. The 20 ms setup is paid once per connection, not once per request, so a request's database time falls to roughly the 2 ms query.

How many connections should the pool hold? Less than you might guess. If each query holds a connection for 2 ms and the API handles 500 requests per second, then on average 500 x 0.002 = 1 connection is busy at any moment. Bursts and slower queries raise that, but a pool of 10 per server already leaves a wide margin. Spare capacity is not free, though, as the next section shows.

## Why a bigger pool can hurt

The database pays for every open connection too. PostgreSQL, for instance, runs a separate server process for each connection, and each one uses memory whether or not it is running a query. So a database has a ceiling on concurrent connections (PostgreSQL's default is 100).

Here is where fleets get into trouble. Suppose each of your four servers has a pool of up to 20 connections. That is 4 x 20 = 80, under the limit of 100. Then a traffic spike arrives and you scale out to ten servers. Now the worst case is 10 x 20 = 200 connections against a ceiling of 100. Some servers get refused when they try to connect, or the database slows down under the load of serving all those connections. This is a **connection storm**, and it arrives at the moment you added servers to help. The pool size is a fleet-wide budget: divide the database's limit, minus headroom for admin and migration connections, by the largest number of servers you will run. Some teams instead put a shared pooler (PgBouncer is a common one for PostgreSQL) between the servers and the database, so the database sees one modest set of connections however many servers there are.

## What happens when the pool runs dry

Back on one server with a pool of 10. A new request arrives and all 10 connections are checked out. What does it do? Most pools make it wait until one is returned, and fail it only after a timeout, if one is set; some wait forever by default. (Some can be configured to reject immediately.) The first symptom is therefore rising latency, not errors, which is why this failure is easy to miss.

Two things usually cause it. The first is a slow query. If one query suddenly takes 2 seconds, say after an [index](/systems-and-infrastructure/database-indexing) is dropped, it holds its connection 1,000 times longer than the usual 2 ms. Ten of those in flight, which takes only five slow requests a second, and the pool is empty, even though the database is healthy for every other query.

The second is a **leak**: code that checks a connection out and never returns it, often because an error path skips the return. Each leak removes one connection for good. With a pool of 10, ten leaked connections leave every later request waiting until it times out. The usual defence is to return the connection in a `finally` block or a language's equivalent, so it goes back even when the query throws.

Waiting for a connection is also a good reason to set a short timeout on the wait itself. A request that fails fast with a clear "pool exhausted" error tells you what is wrong. A request that hangs for thirty seconds just looks like a slow database.

**Rule of thumb.** Open connections once and reuse them, and size the pool from the database's limit divided across every instance you might run, not from what one instance could use. Return every connection in a `finally` block, and put a short timeout on waiting for one.

## Where you'll meet this

A URL shortener serves a huge volume of tiny lookups, so the handshake can cost many times more than the query it precedes, and its servers all share one small pool budget against the database. A chat or news feed backend scales its web tier out and back with load, which makes the total number of connections a number that moves with traffic, and the thing to watch when autoscaling. Payments and checkout code often holds a connection open across several statements in one transaction, so a slow step inside it keeps that connection unavailable to everyone else for the whole time.
