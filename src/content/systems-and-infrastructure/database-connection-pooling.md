---
title: Database Connection Pooling
summary: Why opening a database connection per request is wasteful, and how a pool of already-open connections avoids paying that cost every time.
date: 2026-09-15
---

Opening a database connection isn't free: it takes a network handshake,
often a TLS handshake on top of that, and then the database's own
authentication step — all before a single query actually runs. **Connection
pooling** avoids paying that cost on every request by keeping a set of
already-open connections around and handing them out to whoever needs
one, instead of opening a fresh connection and tearing it down every
time.

## What actually makes opening a connection expensive

Each of those setup steps costs real, measurable time — often single-digit
to tens of milliseconds combined, small next to a whole request's
budget, but not free. An application handling a modest number of
requests per second, opening and closing a connection for each one,
spends a meaningful slice of its total time on connection setup that has
nothing to do with the actual query. Reusing an already-open connection
skips all of that: the handshake and authentication happened once, and
every subsequent query on that connection is pure query time.

## How a pool actually works: checkout and checkin

A connection pool maintains a set of open connections — somewhere
between a configured minimum and maximum — and lends them out on
demand. A request **checks out** a connection from the pool, uses it to
run its queries, and **checks it back in** when it's done, at which
point the pool can hand that same connection to the next request. If
every connection in the pool is currently checked out when a new request
needs one, the pool either makes the request wait until one frees up, or
rejects it outright, depending on how it's configured.

## Sizing the pool is a real design decision, not "as big as possible"

It's tempting to think a bigger pool just means more capacity, but each
open connection costs the _database_ memory and bookkeeping too, not
just the application — a database server has its own real limit on how
many concurrent connections it can hold open at all. A common, expensive
mistake is scaling out an application to many instances, each with a
generously sized pool, without realizing that the _total_ connection
count across every instance can exceed what the database itself can
handle — a **connection storm** that can bring a database to its knees
even while the application servers themselves are nowhere near
overloaded. Pool size has to be reasoned about across the whole fleet,
not tuned per instance in isolation.

## What happens when the pool runs dry

A pool that's fully checked out doesn't fail cleanly on its own — new
requests queue up waiting for a connection to be returned, which shows
up as latency, not an obvious error, until the queue itself grows long
enough to time out. This is a common, easy-to-miss cause of a
production incident: a single slow query — or a connection leaked by
code that forgot to check it back in — can hold a connection out of the
pool far longer than intended, and if that happens repeatedly it
gradually starves every other request in the same application of a
connection to work with, even though the database itself is healthy.

## Where you'll meet this

A URL shortener serves a very high rate of very small queries, where opening
a connection per redirect would often cost more than the lookup itself; a small
shared pool spares the application and the database that handshake on every
redirect. Scaling out the web tier of a feed or chat app is where the
connection storm tends to appear: each new application server brings its own
pool, so adding servers to absorb a traffic spike multiplies the total
connections against the same database, and the extra servers can end up
overloading it instead of relieving anything.
