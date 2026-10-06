---
title: Database Indexing
summary: How an index turns a scan of every row into a handful of lookups, what it costs on every write, and why the database sometimes ignores the one you built.
date: 2026-09-14
---

Picture an `orders` table with 10 million rows, and one query you run all day: show customer 4217's ten most recent orders. How does the database find them?

With nothing to help it, it reads every row and keeps the ones where `customer_id` is 4217. That is a **sequential scan** (or table scan), and its cost grows in step with the table. At a few hundred rows nobody notices. At 10 million, every page load pays for reading all 10 million rows to return a few dozen.

An **index** fixes this. It is an extra structure the database maintains next to the table, built so it can find matching rows without checking each one. You pay for it in storage and in slower writes, and you get fast reads on the columns it covers.

## How does an index find rows so fast?

The usual structure is a **B-tree**: the keys, sorted, in a shallow tree where each node is a disk page holding hundreds of keys. A lookup starts at the top page, picks the child whose range contains your key, and repeats until it reaches the entry you want.

How deep can that get? If a page holds around 300 keys, three levels reach 300 × 300 × 300 = 27 million entries, enough for our 10 million orders. Finding customer 4217 takes about three page reads to reach the first entry, instead of scanning every page of the table, and the depth grows only by one level each time the table grows a few hundred times over.

```sql
CREATE INDEX idx_orders_customer ON orders (customer_id);
```

Because the keys are sorted, a B-tree also answers range queries (`created_at > '2026-01-01'`) and returns rows in order without a separate sort. A **hash index**, by contrast, hashes the key to a location. Exact-match lookups are very fast, but two adjacent values land in unrelated places, so it can't serve a range or an ordering. Databases also offer specialised structures for full-text search, nested documents and geographic data, which a plain B-tree can't represent well.

## What if the query filters on two things?

Your real query is "customer 4217, newest first", which touches two columns. A **composite index** covers both: `(customer_id, created_at)` is sorted by customer, and within one customer by time.

```sql
CREATE INDEX idx_orders_customer_time ON orders (customer_id, created_at);
```

The database jumps to customer 4217's entries, which already sit in time order, and reads the last ten. No sort step, and no touching the other customers' rows.

Because of that sort order, a composite index helps queries that filter on a **left-to-right prefix** of its columns. Filtering on `customer_id` alone works, and so does `customer_id` plus `created_at`. Filtering on `created_at` alone mostly doesn't, because one date's entries are scattered across every customer's section. (A few databases can skip through such an index, at a cost.) Column order is therefore a design decision: put the column you always filter on by equality first.

## Does the index hold the row, or point to it?

A **clustered** index stores the table's rows themselves in the index's order, so the lookup lands directly on the row. A table can have only one, since rows sit in one physical order. MySQL's InnoDB always clusters on the primary key, and SQL Server clusters on it by default. Postgres keeps no clustered index: its `CLUSTER` command reorders the table once and doesn't maintain that order afterwards.

A **non-clustered** index, which is every index on our `customer_id` column, holds keys plus a pointer to the row, so a lookup is two steps: find the entry, then fetch the row it points to. If the query needs only columns stored in the index, the second step can be skipped. Selecting just `customer_id` and `created_at` for those ten orders can be answered from the index alone. Such an index is called a **covering index**, and you can make one cover more by adding columns to it, at the price of a bigger index.

## Why not index every column?

Because every index has to be updated on every insert, and on every update that changes a column it covers. If `orders` carries five indexes, each insert writes the row plus five index entries, six places instead of one. A table taking a steady stream of new orders feels that, and an index no query uses is pure cost.

Indexes also get ignored. Say `status` has four values, and 90% of orders are `delivered`. For `WHERE status = 'delivered'`, the index would send the database to fetch about 9 million scattered rows one pointer at a time, which loses to reading the table straight through, so the planner scans. For `status = 'pending'`, matching perhaps 10,000 rows, the index wins. The same column can be a good index or a useless one depending on the value asked for. A function wrapped around the column, as in `WHERE lower(email) = ...`, also usually stops a plain index on `email` from being used.

How do you know which case you're in? Ask the database. Every major one has an `EXPLAIN` command that prints the plan it chose, including whether it used an index or scanned.

**Rule of thumb.** Index the columns your real queries filter, join and sort on, put the column you filter by equality first in a composite index, and run `EXPLAIN` to confirm the index is used instead of assuming it is.

## Where you'll meet this

A URL shortener looks up every redirect by short code, so that column is indexed, usually as the primary key. A unique index also rejects a second row with the same code, which makes it the guard against two links minting the same short URL, not only a speed-up. A chat app loading a conversation's latest messages is the composite case again, on `(conversation_id, sent_at)`, and it is why the newest page of a long conversation loads as fast as a short one. In checkout, orders and payments are written constantly and read by several different keys, which is where choosing three indexes over eight matters.
