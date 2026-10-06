---
title: The N+1 Query Problem
summary: Code that runs one query for a list and then one more per row turns a single page view into dozens of database round-trips, and you fix it by fetching the related rows in one or two queries instead.
date: 2026-09-15
---

Say you are building a feed page that shows 50 blog posts, each with its author's name. The posts live in one table and the authors in another, so one query can't give you the posts and their authors unless it joins the two tables. The obvious code asks for the posts first, then goes around the loop for the rest:

```python
posts = db.query("SELECT * FROM posts LIMIT 50")  # 1 query

for post in posts:
    post.author = db.query(
        "SELECT * FROM users WHERE id = ?", post.author_id
    )  # 1 query per post, run 50 times
```

That is 51 queries to render one page. This is the **N+1 query problem**: one query fetches a list of `N` rows, then a loop issues one more query per row to fetch something related to it. The number of queries grows with the size of the list, when it should stay at a small constant.

## Why is 51 queries a problem?

Each query is a **round-trip**: the application sends the request over the network, the database runs it, and the answer travels back. The database's work on a lookup by primary key is tiny. The trip is what costs you, and here the trips happen one after another. If each takes about 1 ms, the page spends roughly 51 ms waiting. With the fix below it spends about 2 ms. Ask for 500 posts and the first version takes ten times longer, while the second barely changes. A related cost is that the queries tie up a [database connection](/systems-and-infrastructure/database-connection-pooling) for the whole loop, so a burst of these pages can use up the pool.

## Why does it survive until production?

In development you have 10 rows of test data, so the page makes 11 queries and feels instant. In production the list has real size and the same code makes thousands. Nothing in the code looks wrong either, because the loop often isn't yours. An **ORM** (object-relational mapper, a library that lets you work with database rows as ordinary objects instead of writing SQL) usually does **lazy loading**: it fetches `post.author` from the database the first time you touch it. So the loop body reads `post.author.name`, a plain attribute access, and a query fires behind it, once per row.

## How do you fix it?

The data fetch has to move out of the loop. There are two ways. Fetch it in the same query with a **join**, which combines rows from two tables on a shared value:

```python
posts = db.query("""
    SELECT posts.*, users.name AS author_name
    FROM posts JOIN users ON users.id = posts.author_id
    LIMIT 50
""")
```

Or run one extra query for all the related rows at once, then match them up in memory:

```python
posts = db.query("SELECT * FROM posts LIMIT 50")
author_ids = {p.author_id for p in posts}
authors = db.query("SELECT * FROM users WHERE id IN (?)", author_ids)
by_id = {a.id: a for a in authors}
```

Which one should you pick? The join is a single trip, but if a post carried many comments, joining comments would repeat each post's columns once per comment. Two queries send each row once and cost one extra trip. Most ORMs offer both under the name **eager loading**, meaning you declare up front which relations you will need. Rails has `eager_load` (join) and `preload` (second query), with `includes` picking one for you; Django has `select_related` (join) and `prefetch_related` (second query); and SQLAlchemy has `joinedload` (join) and `selectinload` (second query). Either way, 51 queries become 1 or 2.

This is the same idea as [batching](/systems-and-infrastructure/batching-and-asynchronous-writes): many small requests become one larger one, so you pay the per-trip cost once.

## How do you catch it before your users do?

Count queries instead of only checking output. A test can assert that rendering the feed issues at most 2 queries, and it fails the day someone adds a lazy relation to the loop. A request trace showing dozens of near-identical statements that differ only in one `WHERE id = ?` value is the usual production signature. During development, turn on the ORM's query log, or use a tool built for this such as Bullet for Rails or `django-debug-toolbar` for Django.

If the page is still slow once the count is down to 2, the problem is something else. Often a query is scanning a whole table because it lacks an [index](/systems-and-infrastructure/database-indexing). Fewer queries and faster queries are separate fixes for a slow page, and it takes a measurement to tell which you need. The loop is also a case where [latency and throughput](/systems-and-infrastructure/latency-vs-throughput) tell different stories: the database is barely loaded, yet the page is slow, because 51 small waits add up one after another.

**Rule of thumb.** If a query sits inside a loop over rows, move it out: fetch everything the loop needs up front in one query with a join, or in one batched query keyed by the collected IDs.

## Where you'll meet this

A chat server loading a conversation hits it when it looks up each message's sender one message at a time instead of fetching the distinct senders together. A news feed or timeline does the same to authors, likes and attachments, so a single page view quietly becomes dozens of queries. In a background job, such as one that builds a notification or email digest, the loop is easy to miss, since nobody is waiting on a page and the job just runs long.
