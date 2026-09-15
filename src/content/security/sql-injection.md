---
title: SQL Injection & Parameterized Queries
summary: How unsanitized input becomes executable SQL, and why parameterized queries — not manual escaping — are the fix.
date: 2026-09-14
---

SQL injection happens when a query is built by gluing untrusted input
directly into a string instead of treating that input as data. The
database can't tell "SQL the developer wrote" apart from "SQL an attacker
smuggled in" — it just executes whatever text it's handed.

```python
# vulnerable — user_input becomes part of the SQL itself
query = f"SELECT * FROM users WHERE email = '{user_input}'"
db.execute(query)
```

If `user_input` is `' OR '1'='1`, the query becomes
`WHERE email = '' OR '1'='1'`: true for every row, returning the entire
table. If it's `'; DROP TABLE users; --`, the database may execute that as
a second statement entirely.

## Why this keeps ranking as a top vulnerability

It's consistently one of the most common and most damaging vulnerabilities
in software — a recurring entry on the **OWASP Top 10**, a periodically
updated ranking, published by the Open Web Application Security Project,
of the web's most critical security risks. A successful injection can
read, modify, or delete an entire database, or bypass authentication
outright, and the vulnerable code often looks completely unremarkable
until someone tests it with the right input. It doesn't take a
sophisticated attacker, just one query built the wrong way.

## Separate the data from the code, don't sanitize it

Never build SQL by concatenating or interpolating untrusted input directly
into it. Use parameterized queries (prepared statements), where the query
structure and the data are sent to the database separately: the driver
guarantees the data can never be interpreted as SQL syntax, no matter what
it contains.

```python
# safe — value is passed separately, never interpreted as SQL
query = "SELECT * FROM users WHERE email = ?"
db.execute(query, (user_input,))
```

Every mainstream database driver supports this, as does every **ORM**
(object-relational mapper — a library that lets you work with database
rows as regular objects in your code, e.g. `User.find(id)` instead of
writing SQL by hand; most ORMs use parameterized queries under the hood
even though you never see the query string). There's rarely a good reason
to build a query by string concatenation at all.

The fix is to never let input be interpreted as code in the first place,
not to "sanitize or escape it carefully" after the fact — sanitization
has to be remembered and done correctly on every single query, and one
missed spot is all it takes. Parameterized queries make the safe behavior
the default instead of a discipline every developer has to maintain by
hand.

## The same bug wears different clothes elsewhere

Any code that builds a database query from external input — form fields,
URL parameters, HTTP headers, even values that "shouldn't" contain SQL
syntax (attackers don't respect that assumption) — carries this risk. The
same underlying bug class (untrusted input treated as code) also shows up
as command injection and, in a different form,
[cross-site scripting](/security/xss): different syntax, same root cause.
