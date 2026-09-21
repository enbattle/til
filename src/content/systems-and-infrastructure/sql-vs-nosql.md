---
title: SQL vs. NoSQL
summary: What you're actually choosing between isn't old versus new, but a relational model built for joins and transactions versus a model shaped around one access pattern.
date: 2026-09-14
---

**SQL (relational) databases** store data in tables with a fixed schema
and enforce relationships between those tables, queried with SQL, and
typically offering strong consistency along with full transactional
guarantees. **NoSQL** is an umbrella term for everything that isn't
that — document stores, key-value stores, wide-column stores, and graph
databases — generally trading away some of that structure and
consistency in exchange for flexibility or the ability to scale writes
across many machines.

## The real tradeoffs, not "old versus new"

It's tempting to frame this as legacy technology versus something
modern, but the two encode genuinely different answers to real design
questions:

- **Schema.** A relational database enforces its schema on every single
  write, catching malformed data immediately — but that same enforcement
  means changing the schema later requires a coordinated migration across
  every row that already exists. Most document-oriented NoSQL stores let
  each individual record's shape vary, which is flexible during early,
  fast-changing development, but pushes the burden of checking "does this
  record actually look right" onto application code instead of the
  database itself.
- **Relationships.** SQL is built around joining related data across
  tables inside a single query. Most NoSQL stores aren't — related data
  is often deliberately duplicated into a single record specifically to
  avoid needing a join at read time, trading extra storage and the work
  of keeping duplicates in sync for faster reads.
- **Consistency versus horizontal write scale.** This is
  [CAP theorem](/systems-and-infrastructure/cap-theorem) showing up in a
  concrete product decision. Traditional relational databases usually
  favor consistency: a single point of truth for writes, strongly
  consistent, harder to spread across many machines or regions. Some
  NoSQL stores, particularly Dynamo-lineage ones, are built the other way
  around: eventually consistent, but able to accept writes across many
  nodes at once. Cassandra is a genuinely leaderless example — any
  replica can coordinate a quorum read or write for a given key.
  DynamoDB, despite the shared lineage, actually replicates each
  partition through a single leader replica, closer to leader-based than
  fully leaderless — though its default reads are still eventually
  consistent. Others, like MongoDB, still route writes through a single
  primary per shard and
  default to strongly consistent reads against it — "NoSQL" describes a
  break from the relational model, not a single consistency tradeoff
  every store in the category makes the same way.

## The same data, modeled two different ways

```sql
-- SQL: related data stays normalized in separate tables, joined at query time
SELECT orders.id, orders.total, customers.name
FROM orders JOIN customers ON customers.id = orders.customer_id;
```

```json
// Document store: the related data is duplicated directly into the order —
// no join needed to read it, but the customer's name now has to be kept in
// sync everywhere it's been copied to.
{
  "orderId": "o1",
  "total": 42.0,
  "customer": { "id": "c1", "name": "Alex" }
}
```

The SQL version reads related data by joining at the moment it's needed,
paying that join cost on every read but keeping exactly one copy of the
customer's name. The document version pays nothing extra at read time,
but now has to actively manage what happens if that customer's name ever
changes somewhere else.

## What the choice actually turns on

The choice is really about a specific service's access patterns, not a
single winner. A reporting system doing complex, ad-hoc joins across many
tables wants a relational database. A system ingesting a huge, bursty
volume of loosely structured events, where horizontal write scale matters
more than strict consistency, often wants NoSQL instead. Most real
systems that live long enough end up using a mix of both, chosen
per-service or even per data type, rather than committing one database
technology to the entire application: relationships, transactions, and a
fixed shape point toward relational; flexible structure and horizontal
write scale point toward NoSQL.

## Where you'll meet this

Payments and checkout are relational territory: orders, line items, and
balances relate to each other and have to change together, which is what joins,
constraints, and multi-row transactions are for. A news feed often goes the
other way, because its main query is known in advance (a given reader's latest
posts), so a store built around that one access pattern, with the data shaped
and duplicated to match it, can serve it without joins. A URL shortener could
go either way: a lookup from short code to destination is a key-value read with
no joins involved, which suits a key-value NoSQL store, though a plain
relational table works too, and the choice comes down to scale and operations
more than data model.
