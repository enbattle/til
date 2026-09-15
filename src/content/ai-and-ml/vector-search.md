---
title: Vector Search
summary: How finding results by meaning instead of exact match actually works, and the accuracy-for-speed trade that makes it fast at scale.
date: 2026-09-14
---

A normal database index is built for exact lookups: find the row where
`email` equals precisely this string. **Vector search** solves a
different problem — given a query, find the stored items that are
closest to it in _meaning_, even when nothing matches exactly. It's the
mechanism that makes [retrieval-augmented generation](/ai-and-ml/what-is-rag)
possible: converting "find documents about this topic" from a keyword
match into a search over meaning itself.

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

## Why exact nearest-neighbor search doesn't scale

The straightforward way to find the closest vectors is to compare the
query against every single stored vector and rank them by distance. That
works, but the cost grows directly with how many vectors you have —
comparing against a million stored vectors means a million comparisons,
every single query. At real-world scale, that's too slow to be usable.

## Trading a little accuracy for a lot of speed

Production vector search almost always uses **approximate nearest
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
the millions.

## Real queries need more than pure similarity

A search rarely needs "closest by meaning" alone — it usually needs
"closest by meaning, but only among items matching some other condition,"
like a specific category or a recency cutoff. Combining a similarity
search with a structured filter like that can be done a few ways: filter
the candidates down first and search only within that smaller set, run
the similarity search over everything and discard mismatches afterward,
or build filtering directly into how the index is traversed. Each has a
different sweet spot depending on how selective the filter is, but the
underlying tension is the same one any index faces: the index has to
actually understand the filter, not just the similarity, or it ends up
doing much more work than necessary.

## Keeping an index useful as the underlying data changes

Unlike a normal database row, a vector index isn't built for frequent,
one-off updates — the graph structure that makes search fast is
relatively expensive to modify piece by piece. In practice, systems
handle this by batching changes rather than applying them one at a time
immediately: rebuilding the index periodically, queuing updates and
merging them in on a schedule, or keeping a small, fast index for very
recent changes alongside a larger, more static one for everything older,
merging the two periodically. Which strategy makes sense depends entirely
on how fresh the results need to be versus how much update volume the
system has to absorb.
