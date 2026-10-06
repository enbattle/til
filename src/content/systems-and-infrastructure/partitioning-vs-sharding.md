---
title: Partitioning vs. Sharding
summary: Partitioning splits a table into pieces, often on one machine, to keep it manageable; sharding puts those pieces on different machines to get more capacity.
date: 2026-09-15
---

Your online shop has an `orders` table, and it is getting big: 10 million new
rows a month, so about 600 million after five years. Queries slow down, and
deleting old rows takes hours. You have two ways to split the table, and the
words for them get used interchangeably even though they solve different
problems.

**Partitioning** means dividing one logical table into smaller physical pieces
by a rule, so queries still see a single table. **Sharding** is partitioning
where the pieces live on different database servers, and usually the
application has to route each query to the right one. Every shard is a
partition, but a partition is a shard only if it sits on a different server
from the others.

## What does partitioning fix?

Start with the cheaper option. Most relational databases can split a table
inside one server and hide the split from queries. Here `orders` is split by
month:

```sql
CREATE TABLE orders (
  id bigint,
  customer_id bigint,
  created_at timestamp
) PARTITION BY RANGE (created_at);

CREATE TABLE orders_2026_06 PARTITION OF orders
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
```

After five years there are 60 monthly partitions of about 10 million rows each.
A query for June's orders gets **pruned**: the database sees from the filter
that only `orders_2026_06` can match and never reads the other 59. And
retiring a five-year-old month means dropping one partition, which takes
moments, instead of deleting 10 million rows one by one.

What partitioning does not do by itself is add capacity. All 60 partitions share the same
CPU, memory and disk, so if the one server is out of room or throughput, you
have reorganized the problem without solving it.

## When do you need sharding?

When one machine is the limit: the data will not fit on its disk, or
the write rate is more than it can sustain. Then you move pieces onto separate
servers, each called a **shard**, and every row has to be sent to the right
one. The rule that decides is the **shard key**, a column whose value picks the
shard. For `orders` the candidate is `customer_id`. There are three common
ways to turn a key into a shard:

- **Range.** Customers 1 to 1,000,000 on shard A, the next million on shard B.
  Range queries stay on one shard, but new customers all have the highest IDs,
  so one shard takes every new signup.
- **Hash.** Run the key through a hash function and use the result to choose a
  shard. Load spreads evenly, but a query over a range of keys must ask every
  shard.
- **Directory.** A lookup table records which shard holds each key. You can
  move one customer at a time, but the table is now a service that must stay
  up and fast, and each query pays an extra lookup.

Say you hash `customer_id` across 4 shards. A customer's orders now live
together, so "show me my orders" asks one shard. But "all orders from June"
has no customer in it, so it goes to all 4 shards and the results are merged.
A shard key makes the queries that filter by it cheap and the rest expensive,
and no key serves every query. Pick the one your most common queries already
filter by.

## What gets harder once you shard?

Three things, and each is a cost partitioning never charged you.

**Joins and transactions that span shards.** Placing an order that decrements
a product's stock touches the customer's shard and wherever the product
lives. A single database would make that atomic for free. Across shards you
need extra machinery, such as two-phase commit (every shard promises it can commit, then all
commit together) or a design that
avoids the situation.

**Hot shards.** Hashing evens out keys, not traffic. If one customer is a
reseller placing a thousand times more orders than average, their shard is
busy however well the others are balanced. You can add a random suffix to
that customer's key so their rows spread out (at the price of reading all the
suffixes back), move them to a shard of their own, or cache their reads.

**Changing the shard count.** With a plain `hash(key) % 4`, going to 5 shards
changes the answer for most keys. A key keeps its shard only when the hash
gives the same remainder for 4 and for 5, which is true for 1 hash value in
5, so about 80% of rows have to move. [Consistent
hashing](/systems-and-infrastructure/consistent-hashing) is built to avoid
this: adding a shard moves only about 1/5 of the keys, the ones the new shard
takes over.

## Do you have to choose?

No, and large systems usually do both. Each of the 4 shards can hold its own
`orders` table partitioned by month, so each shard prunes queries and drops old
months quickly, and the shards provide the capacity.

**Rule of thumb.** Partition first: it keeps a big table fast and easy to
maintain on one server. Shard when a single machine's storage or write
throughput is the limit, because it adds capacity and also adds cross-shard
queries and transactions.

## Where you'll meet this

A notification or email pipeline keeps a delivery log that is written
constantly and kept only for a while, which suits date partitions on one
database long before it needs more machines: old months are dropped whole. A
URL shortener's hot path is a lookup by one short code, so hashing that code
across shards costs that lookup nothing. Payments and
checkout are where sharding hurts: a transfer between two accounts held on
different shards is the cross-shard transaction that a single database
handles with an ordinary transaction.
