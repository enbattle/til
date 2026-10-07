---
title: Vector Search
summary: Finding stored items by closeness in meaning rather than exact match, and the accuracy-for-speed trade that keeps it fast at scale.
date: 2026-09-14
---

Say you run a support site with a million past tickets, and a customer types "my card keeps getting declined." The ticket that solves their problem is titled "Payment failed at checkout." Those two strings share almost no words, so a [keyword lookup](/ai-and-ml/hybrid-search-and-reranking) misses it. **Vector search** finds stored items that are closest to a query in _meaning_, even when nothing matches exactly. It is the usual retrieval step behind [retrieval-augmented generation](/ai-and-ml/what-is-rag), where a model is handed the best-matching documents before it answers. How do you measure "closest in meaning"?

## Turning meaning into numbers

An **embedding model** converts a piece of text into a list of numbers, called a **vector**. It is trained so that texts with similar meaning get vectors that sit close together, and unrelated texts get vectors far apart. "Declined card" and "payment failed" land near each other. "Declined card" and "card game rules" don't, even though they share a word.

Real vectors are long, often hundreds to a few thousand numbers, and no single number means anything you could name. You embed every ticket once, ahead of time, and store the vectors. At query time you embed the customer's sentence with the same model and look for the stored vectors nearest to it. Two models produce vectors in unrelated spaces, so comparing across them is meaningless. Switching models means re-embedding all million tickets.

"Nearest" needs a distance. The common one is **cosine similarity**, which compares the directions two vectors point in and ignores their lengths. Another is the **dot product**: multiply the two vectors position by position and add the results. If both vectors are scaled to length one, as many embedding models output them, the two give the same ranking.

## Why not compare against everything?

The simplest search compares the query vector to all million stored vectors and keeps the top few. That is exact, and for a million tickets it is often fine. Each vector is, say, 768 numbers, so one query is about 768 million multiply-and-add steps, which a modern processor can do in tens to hundreds of milliseconds, depending on hardware and how well the code is tuned. Storing the vectors takes about 3 GB (768 numbers at 4 bytes each, times a million).

The cost grows in a straight line with the collection. At a hundred million tickets, or thousands of queries a second, scanning everything stops being practical. So what can you give up to go faster?

## Trading a little accuracy for a lot of speed

You give up a guarantee. **Approximate nearest neighbor (ANN)** search builds an **index** ahead of time: a data structure arranged so a query can skip almost all stored vectors and still land on results very close to the true best ones. Occasionally it misses a vector that was truly nearer. The fraction of the true best results it finds is its **recall**, and most indexes let you tune it against speed.

One popular style links each vector to some of its neighbors in a layered graph. A query starts in a sparse top layer, hops greedily toward the query, then drops into denser layers to refine. It works like a highway before local roads: you cover most of the distance fast, then search carefully only near the destination. Another style splits the space into clusters and searches only the few nearest the query. Either way you check a small fraction of the vectors.

## Search plus conditions

Your customer only wants tickets that are open, from this quarter, in their language. That is similarity plus a structured condition, and there are three ways to combine them:

- Filter first, then search only within the survivors.
- Search the whole index, then drop results that fail the condition.
- Check the condition during the index traversal itself.

Which one wins depends on how selective the filter is. If it keeps only a handful of tickets, search-then-filter may return almost nothing, because the top results were all discarded. If the filter keeps most tickets, filter-first throws away the index's speed for little gain.

## When tickets change

New tickets arrive constantly and old ones get edited or deleted. Adding a vector costs more than inserting into an ordinary database index. Deletes are worse: many indexes just mark a deleted entry dead and leave it in place, so searches waste time on it and quality slowly slips until the index is rebuilt. Systems with heavy churn batch the work. They rebuild periodically, or keep a small index for recent changes beside a large stable one and merge them on a schedule. The trade is freshness against how much update volume you can absorb.

## Where to keep the vectors

A **vector database** stores each vector with its source text and metadata (status, date, language), keeps the ANN index current, and handles the filtering above. It isn't the only option. Many general-purpose databases can store vectors and build ANN indexes, either built in or through an extension. That keeps a ticket's vector in the same transaction as the ticket row. A library inside your own process can build and search an index with no server at all.

**Rule of thumb.** Start with exact search while the collection is small, and with the database you already run if it handles vectors well. Move to an ANN index when scans get too slow, and to a dedicated system only when scale or query load outgrows what you have. Whatever you pick, change the embedding model only if you are ready to re-embed everything.
