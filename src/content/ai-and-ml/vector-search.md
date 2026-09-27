---
title: Vector Search
summary: How finding results by meaning instead of exact match works, and the accuracy-for-speed trade that makes it fast at scale.
date: 2026-09-14
---

A normal database index is built for exact lookups: find the row where
`email` equals precisely this string. **Vector search** solves a
different problem — given a query, find the stored items that are
closest to it in _meaning_, even when nothing matches exactly. It's the
usual retrieval mechanism behind [retrieval-augmented generation](/ai-and-ml/what-is-rag):
it turns "find documents about this topic" from a keyword match into a
search by meaning.

## Turning meaning into something you can measure

The trick starts with **embeddings**: a model converts a piece of text
into a list of numbers (a vector) positioned so that texts with similar
meaning end up close together in that numerical space, and unrelated
texts end up far apart. "Cat" and "kitten" land near each other; "cat"
and "car" don't, despite looking similar as strings. Once every stored
document has been converted into one of these vectors, "find documents
similar in meaning to this query" becomes a geometry problem: convert the
query into a vector the same way, and find the stored vectors closest to
it.

The vectors are long, typically a few hundred to a few thousand numbers,
and no single number means anything you could name. Closeness is usually
measured by **cosine similarity**, which compares the directions two
vectors point in and ignores their lengths, or by the dot product
(multiply the two vectors position by position and add up the results),
which gives the same score once the vectors are scaled to length one, as
many embedding models do. "The same way" matters: vectors from two
different embedding models live in unrelated spaces, so comparing them is
meaningless. Switching models means re-embedding every stored document,
which for a large collection is a batch job worth planning for.

## Why exact nearest-neighbor search doesn't scale

The straightforward way to find the closest vectors is to compare the
query against every stored vector and rank them by distance. The cost
grows directly with how many vectors you have: a million stored vectors
means a million comparisons on every query. Modern hardware gets through a
million in tens to a few hundred milliseconds, depending on vector length
and hardware, which is often fine. At tens of millions
of vectors, or thousands of queries a second, it stops being practical.

## Trading a little accuracy for a lot of speed

Vector search at scale almost always uses **approximate nearest
neighbor (ANN)** search instead of an exact comparison against everything.
The idea is to pre-build an index — a data structure organized so a query
can skip the vast majority of stored vectors and still reliably find
results very close to the true best matches, in a small fraction of the
time an exhaustive comparison would take. A common style of index
organizes vectors into a layered graph: start at a sparse top layer,
navigate greedily toward the query, then drop down into progressively
denser layers to refine the answer, similar to how a highway system lets
you get broadly close to a destination fast before switching to local
roads for the last stretch. The result trades a small, tunable amount of
recall (occasionally missing a result that was technically closer) for
a search that stays fast even as the number of stored vectors grows into
the hundreds of millions.

## Real queries need more than pure similarity

A support-ticket search usually wants the closest matches by meaning, but
only among open tickets from this quarter: similarity plus a structured
condition. Combining the two can be done a few ways: filter the
candidates down first and search only within that smaller set, run
the similarity search over everything and discard mismatches afterward,
or build filtering directly into how the index is traversed. Which works
best depends on how selective the filter is. If it matches very few items,
searching first and filtering afterward can leave almost nothing; if it
matches most of them, filtering first throws away the index's speed.

## Keeping an index useful as the underlying data changes

Adding vectors one at a time works, but costs more than an insert into a
normal database index. Deletes and updates are the harder part: deleted
entries are usually just marked dead and left in the graph, so searches
waste time on them and quality slowly degrades until the index is cleaned
up or rebuilt. Systems with heavy churn handle this by batching
changes: rebuilding the index periodically, queuing updates and merging
them in on a schedule, or keeping a small, fast index for very recent
changes alongside a larger, more static one for everything older, merging
the two periodically. Which strategy makes sense depends on how fresh the
results need to be versus how much update volume the system has to absorb.

## Where the vectors live

A **vector database** is a database built around this kind of index: it
stores each vector alongside its source text and metadata (a category, a
date, an author), keeps the ANN index up to date, and handles the
filtering described above. It isn't the
only option. Many general-purpose databases now offer vector columns and
ANN indexes, built in or as an extension (pgvector for Postgres is a common
one). That keeps vectors next to the rest of your data, so a vector is saved
or rolled back together with the row it describes. In-memory libraries such
as FAISS build and search an index inside your own process with no server
at all, leaving storage of the text and metadata to you. A reasonable
default is the database you already run, if it supports vectors well,
until the vector count or query load outgrows it. A dedicated system is
worth its extra moving part at that point, not before.
