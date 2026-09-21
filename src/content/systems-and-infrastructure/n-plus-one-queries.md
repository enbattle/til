---
title: The N+1 Query Problem
summary: The pattern that fires one query per row inside a loop, why it hides in innocent-looking ORM code, and how eager loading fixes it.
date: 2026-09-15
---

The **N+1 query problem**: code fetches a list of `N` records, then
loops over them making one _additional_ query per record to fetch
related data — one query to get the list, plus `N` more, instead of a
small, constant number of queries regardless of how many rows there are.

## What N+1 looks like in code

Fetching 50 blog posts, then each post's author separately:

```python
posts = db.query("SELECT * FROM posts LIMIT 50")  # 1 query

for post in posts:
    post.author = db.query(
        "SELECT * FROM users WHERE id = ?", post.author_id
    )  # 1 query, run 50 times
```

That's 51 round-trips to the database to render a single page. With a
join, or a batched lookup, it's one or two:

```python
# one query with a join
posts = db.query("""
    SELECT posts.*, users.name AS author_name
    FROM posts JOIN users ON users.id = posts.author_id
    LIMIT 50
""")

# or: one query per *type*, not per row
posts = db.query("SELECT * FROM posts LIMIT 50")
author_ids = [p.author_id for p in posts]
authors = db.query("SELECT * FROM users WHERE id IN (?)", author_ids)
```

## Why it hides until production

It's invisible in development. With 10 rows of test data, 11 queries is
fast enough that nothing looks wrong. In production with 5,000 rows,
it's 5,001 sequential round-trips per request — the classic bug that
only shows up once there's real data to work with, and by then it's
often buried deep inside an **ORM**'s (object-relational mapper — a
library that lets code work with database rows as regular objects
instead of writing SQL by hand) lazy-loading behavior, rather than an
obvious loop sitting in application code.

## Spotting it before your users do

- **Query logging or counting in tests** — assert the number of queries
  a code path issues, not just its final output.
- **Tracing tools** showing a single request that fired dozens of
  near-identical queries, differing only by one `WHERE id = ?` value.
- **ORM debug logs during development** are the cheapest early warning,
  and most ecosystems have a well-known third-party tool built for
  exactly this: Bullet for Rails, django-debug-toolbar or the nplusone
  package for Django.

N+1 is specifically about the _number_ of queries issued; a query
that's still slow even after fixing that is usually a missing
[index](/systems-and-infrastructure/database-indexing) instead — the
other half of "why is this page slow."

## The fix, generalized

Almost every fix reduces to the same move: turn `N` queries into one,
either with a join or by collecting the IDs first and issuing a single
batched `WHERE id IN (...)` query instead of querying inside the loop.
Where the data fetch sits relative to the loop is the entire bug — move
it outside the loop and the N+1 disappears regardless of how it
originally got introduced.

## Where you'll meet this

A chat server loading a conversation hits it when it looks up each message's
sender one message at a time instead of fetching all the distinct senders in
one batched query. A news feed page does the same to authors, counts and
attachments: a lookup inside the loop turns one page view into dozens of
queries. In a background job the same loop is easy to miss, since nobody is
waiting on a page to notice it running long.
