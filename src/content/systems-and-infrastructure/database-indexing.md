---
title: Database Indexing
summary: How an index turns a full table scan into a fast lookup, what that speedup costs on every write, and why the database sometimes ignores the index you added.
date: 2026-09-14
---

An **index** is an extra data structure a database maintains alongside a
table, built specifically to let it find matching rows without checking
every single one. It trades additional storage and slightly slower writes
for a much faster read on whichever columns it covers.

## What happens without one

Without an index, a query like "find the row where `email` equals this
value" has to check every row in the table one at a time — called a
**sequential scan** or **table scan**. That's fine at a few hundred rows
and increasingly catastrophic as a table grows into the millions, since
the cost grows directly with the table's size. This is the other half of
"why is this query slow," alongside issuing more queries than necessary
in the first place: indexing is about making each individual query fast,
regardless of how many of them get run.

## How an index actually gets there faster

The most common structure behind an index, a **B-tree**, keeps keys
sorted in a shallow, wide tree rather than a flat list, so a lookup takes
a small, roughly-fixed number of comparisons no matter how large the
table gets, instead of a number that grows with every additional row.

```sql
CREATE INDEX idx_users_email ON users (email);
-- without the index: the database checks every row
-- with the index:    the database jumps almost straight to the match
```

A **composite index**, built across multiple columns, is sorted by the
first column, then by the second within ties on the first, and so on —
which is why it only speeds up a query that filters on a matching
left-to-right prefix of those columns. An index on `(a, b)` helps a query
filtering on `a` alone, or on `a` and `b` together, but does nothing for
a query that only filters on `b`.

## Not every index looks like a sorted list

A B-tree handles equality and range queries well (`=`, `<`, sorting), but
it isn't the only shape an index can take:

- A **hash-based index** gives an extremely fast lookup for an exact
  match, but can't serve a range query or a sort at all — a hash has no
  notion of "near," so two keys that are numerically adjacent can hash to
  completely unrelated locations.
- Some databases support indexes purpose-built for values that aren't a
  single, simple field — full-text search, "does this nested document
  contain this key," or geographic data — cases a plain B-tree can't
  represent efficiently at all.

## Clustered versus non-clustered: does the index _contain_ the row, or just point to it?

A **clustered** index determines the actual physical order rows are
stored on disk — there can only be one per table, since rows can only be
physically sorted one way at a time, and it's usually built on the
primary key by default. A **non-clustered** index is a separate
structure entirely: a sorted list of keys, each pointing back to where
its full row actually lives.

That extra pointer-chase is why a non-clustered index lookup is often two
steps rather than one — find the key in the index, then jump to the row
it points at. A **covering index** skips that second step by including
every column a specific query needs directly inside the index itself, so
the database can answer straight from the index without ever touching
the underlying table at all.

## When an index doesn't help, or actively hurts

Every index that speeds up reads on a column also slows down every
`INSERT`, `UPDATE`, or `DELETE` that touches that table, since the index
itself has to be kept up to date on every write. Indexing every column
"just in case" has a real, ongoing cost, not a one-time one. A
low-cardinality column — one with only a couple of distinct values, like
a true/false flag — often doesn't benefit much either, since checking the
index and then jumping to matching rows can end up costing more than
just scanning the table would have.

## Rule of thumb

Index the columns your actual queries filter, sort, or join on — no
more, no less — and use your database's query-plan explainer to confirm
a query is genuinely using the index you expect, rather than assuming it
is just because the index exists.
