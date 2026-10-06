---
title: SQL vs. NoSQL
summary: Pick a relational model when your data is connected and must change together, and a model shaped around one access pattern when you know the question you will ask and need to scale it.
date: 2026-09-14
---

Say you are building an online store. You have customers, and each customer places orders. Where does that data live, and in what shape? That one question splits databases into two broad camps.

A **relational (SQL) database** keeps data in **tables** with a fixed set of columns, one row per thing. Customers get a table and orders get a table. An order row holds a `customer_id` that points at a row in the customers table, and you read across the two with **SQL**, the query language, using a **join**, which stitches rows from different tables together at query time. **NoSQL** is the label for everything else: **document stores** (one self-contained record per thing, usually JSON), **key-value stores** (a lookup from a key to a blob), **wide-column stores** (rows with flexible sets of columns, spread across machines) and **graph databases** (built around links between things). They differ a lot from each other, so the useful question is what each trades for what.

## One order, modeled twice

In the relational version, Alex's name is stored once, in the customers table, and every order points at it:

```sql
SELECT orders.id, orders.total, customers.name
FROM orders JOIN customers ON customers.id = orders.customer_id;
```

In a document store, you would more likely store the order as one record with the customer's details copied inside:

```json
{
  "orderId": "o1",
  "total": 42.0,
  "customer": { "id": "c1", "name": "Alex" }
}
```

Reading an order is now one lookup with no join. The cost shows up when Alex changes their name. In the relational version you update one row. In the document version, that name is copied into every order Alex ever placed, so you update them all or accept that old orders show the old name. Sometimes accepting that is correct, since an old receipt should show what it said at the time. Sometimes it is a bug you now own.

## Where the two models pull apart

**Schema** is the declared shape of the data. A relational database checks every write against it, so a malformed order is rejected on the spot. The price is that changing the shape later, say splitting `name` into first and last, means a migration that touches every existing row. Most document stores let each record differ, which is easy while the product is changing weekly, but now your application code has to check that an order looks right, and has to cope with old orders that look different from new ones.

**Transactions** are the next question. A **transaction** groups several changes so they all happen or none do. When Alex checks out, you want to create the order, reduce stock and charge the payment as one unit. Relational databases are built around this. Many NoSQL stores offer atomic changes only within a single record, or a limited form across records, and some now offer fuller transactions at a cost in speed. When a change has to span stores, you coordinate it yourself, for example with a [saga](/systems-and-infrastructure/saga-pattern).

**Scale** is the third. Your store grows, and one machine can no longer take all the writes. A relational database usually sends writes through one primary machine, which keeps a single source of truth but is hard to spread out. You can add [read replicas](/systems-and-infrastructure/read-replicas) for reads, and you can split the data across machines by hand ([sharding](/systems-and-infrastructure/partitioning-vs-sharding)), but joins and transactions across shards get awkward. Some NoSQL stores were designed around spreading data from the start, and that is [CAP theorem](/systems-and-infrastructure/cap-theorem) turning into a product decision. Each piece of data is kept as several **replicas**, copies on different machines. Cassandra lets any node coordinate a write, and settles for eventual consistency by default, meaning replicas can briefly disagree. DynamoDB gives each slice of the data one leader copy that takes its writes, and its default reads are eventually consistent unless you ask for a strongly consistent one. MongoDB sends writes through one primary per shard and reads from that primary by default. So the NoSQL label does not tell you which consistency tradeoff you get; check the product.

## Do the joins really go away?

No, they move. If your reports ask new questions every week ("which customers who bought X in March also bought Y?"), the relational model lets you ask them without redesigning anything, because joins and [indexes](/systems-and-infrastructure/database-indexing) are available for any column. A document store shaped for "show me this order" has an awkward answer to that report at best, and you end up copying data into a second store built for it, or scanning everything.

The reverse also holds. If your hottest query is "show Alex's ten latest orders," and you know it in advance, you can shape the records to answer that query in one read, and spread them across many machines by customer. You gave up flexibility to get predictable speed and scale.

**Rule of thumb.** Start relational when your data is connected and must change together, because it is the most flexible default and a single well-run database goes a long way. Reach for a NoSQL store when you know the access pattern ahead of time and either your write volume has outgrown one machine or your records won't sit still in fixed columns, and expect to use both in one system.

## Where you'll meet this

Payments and checkout lean relational: balances and orders must change together, and a half-finished change is worse than a failed one. A news feed or timeline tends to be read through one known query (a given reader's latest posts), which a store with data shaped and spread around that query can serve at high volume. A notification pipeline often logs a large stream of loosely structured events, where write volume matters more than joining them later, so a store built for fast appends suits it. Real systems commonly mix these, one store per job.
