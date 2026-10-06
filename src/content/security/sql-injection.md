---
title: SQL Injection and Parameterized Queries
summary: Why gluing user input into a SQL string lets an attacker rewrite your query, and how parameterized queries close the hole.
date: 2026-09-14
---

Picture a login page. You type an email, and the server looks up your row in
a `users` table. Somewhere in the code, a developer wrote this:

```python
# vulnerable: the input becomes part of the SQL text
query = f"SELECT * FROM users WHERE email = '{email}'"
db.execute(query)
```

For an ordinary email, this works. So what goes wrong when the input isn't
ordinary?

## Input that rewrites the query

The database receives one string of text and has to decide which parts are
the developer's instructions and which are the user's data. It can't tell.
Whatever text arrives gets parsed as SQL.

Say the attacker types `' OR '1'='1` into the email field. After
interpolation, the database sees:

```sql
SELECT * FROM users WHERE email = '' OR '1'='1'
```

The first quote closes the string the developer opened, and the rest becomes
new SQL. `'1'='1'` is true for every row, so the query returns the whole
table. If the code logs in whoever the query returns first, the attacker is
now logged in as someone else, with no password.

Worse input exists. `x'; DROP TABLE users; --` closes the string, ends the
statement with a semicolon, adds a second statement, and uses `--` (the SQL
comment marker) to discard the leftover quote. Many drivers refuse to run
two statements in one call by default, which blunts this particular
trick. Attackers have other routes, such as appending a `UNION SELECT` that
reads a different table and returns it in the page's results. All of them
are the same bug: input that was meant to be a value got to act as code.

This is called **SQL injection**. It has stayed on the **OWASP Top 10**, the
Open Web Application Security Project's periodic ranking of the most
critical web security risks, for years running (lately as part of its
Injection category), because the vulnerable code
looks unremarkable and one missed query is enough.

## Why not just clean the input?

Your first idea is probably to strip or escape the dangerous characters,
like the single quote. It sounds reasonable and it fails in practice. You
have to remember to do it on every query in the codebase, in every place
input enters (form fields, but also URL parameters, headers and cookies), and get the escaping right for your specific database and
character encoding. One forgotten spot is a hole. A fix that depends on
every developer being careful forever will eventually break.

## Keep the data out of the SQL text

The better fix removes the ambiguity. A **parameterized query** (also called
a prepared statement) separates the two parts: you write the SQL with a
placeholder where each value goes, and hand the values over separately.

```python
# safe: the driver handles the value, not your string
query = "SELECT * FROM users WHERE email = ?"
db.execute(query, (email,))
```

Now the database is given the structure of the query first, with the shape
already fixed. The email arrives afterward, and it is only ever treated as a
value to compare against. If an attacker types `' OR '1'='1`, the database
looks for a user whose email is literally that odd string, finds none, and
returns nothing. The quote has no power to close anything. Some drivers
instead quote the value into the SQL text themselves, with escaping written
once and tested for that database; either way, the value can't become SQL.

Placeholder syntax varies (`?`, `$1`, `%s`, `:email`), but every mainstream
driver supports it. So does every **ORM** (object-relational mapper), a
library that lets you work with database rows as objects, such as
`User.find_by(email: email)`, instead of writing SQL yourself. ORMs generally use
parameterized queries underneath, which is why ordinary ORM calls are safe
by default.

## Where parameters can't help

Two gaps remain, and they come up in practice.

A placeholder stands in for a value, not for part of the query's structure.
You can't parameterize a table name or a column name, which matters when a
user picks a sort column, for example. In that case, compare the input
against a fixed list of allowed names in your code and use only a match.

And ORMs usually offer a "raw query" escape hatch for hand-written SQL.
Interpolating input into that string brings the original bug back, ORM or
not. Raw queries take placeholders too, so use them there as well.

The same root cause, untrusted input treated as code, appears outside
databases: command injection builds shell commands from input, and
[cross-site scripting](/security/xss) builds HTML from it. The syntax
differs, the mistake doesn't.

**Rule of thumb.** Never build a SQL string out of user input: write the query with placeholders, pass the values separately, and allowlist anything that must be a name.
