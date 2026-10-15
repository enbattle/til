---
title: Vector Search
summary: Finding stored items by closeness in meaning rather than exact match, and the accuracy-for-speed trade that keeps it fast at scale.
date: 2026-09-14
---

Say you run a support site with a million past tickets, and a customer types "my card keeps getting declined." The ticket that solves their problem is titled "Payment failed at checkout." Those two strings share almost no words, so a [keyword lookup](/ai-and-ml/hybrid-search-and-reranking) misses it. **Vector search** finds stored items that are closest to a query in _meaning_, even when nothing matches exactly. It is the usual retrieval step behind [retrieval-augmented generation](/ai-and-ml/what-is-rag), where a model is handed the best-matching documents before it answers.

This page goes from numbers to indexes to filters and updates. How do you find the nearest tickets without comparing every one?

## Turning meaning into numbers

An **embedding model** converts a piece of text into a list of numbers, called a **vector**. It is trained so similar meanings get vectors that sit close together and unrelated ones sit far apart. "Declined card" and "payment failed" land near each other; "declined card" and "card game rules" don't, despite the shared word.

Real vectors hold hundreds of numbers or more. You embed every ticket once, ahead of time, and store the vectors. At query time you embed the customer's sentence with the same model and look for the nearest stored vectors. Two models produce unrelated spaces, so switching models means re-embedding all million tickets.

"Nearest" needs a distance. The common one is **cosine similarity**, which compares the directions two vectors point in and ignores their lengths.

## Why not compare against everything?

The simplest search compares the query to all million vectors and keeps the top few. That is exact. Each vector is, say, 768 numbers of 4 bytes each:

```text
768 numbers × 1,000,000 vectors = 768 million steps per query, one per number
768 × 4 bytes × 1,000,000 ≈ 3 GB to store the vectors
```

That takes tens to hundreds of milliseconds, fine at a million tickets, but the cost grows in a straight line with the collection. At a hundred million tickets, or thousands of queries a second, scanning everything stops being practical. What can you give up to go faster?

## Trading a little accuracy for a lot of speed

You give up a guarantee. An **index** is a structure built ahead of time so a query can skip most stored vectors. An **approximate nearest neighbor (ANN)** index returns results very close to the true best, but occasionally misses a vector that was truly nearer. How would you build one?

The first idea is to sort tickets into piles. Group the vectors by closeness into 1,000 piles of about 1,000 tickets, and record each pile's center. A query is compared to the 1,000 centers, then only to the tickets in the nearest pile:

```text
1,000 centers + 1,000 tickets in the pile = 2,000 comparisons
1,000,000 ÷ 2,000 = 500 times fewer than scanning everything
```

The catch is a query near the edge between two piles. Its best match may sit across the border, in the pile you skipped. Checking the 3 nearest piles costs 1,000 + 3,000 = 4,000 comparisons, still 250 times fewer, and misses less. The share of the true best results an index finds is its **recall**.

A second idea links tickets directly. Give each ticket a short list of its closest neighbors, say 16, so the tickets form a web of links, a **graph**. To search, start at any ticket and look at its 16 neighbors. Step to whichever is closest to the query, and repeat. Stop when no neighbor beats the current ticket. Taking the best step you can see, without planning ahead, is a **greedy** walk.

On a million tickets this has two problems. Every link is short, so a walk from a far-away start needs a great many hops. And a walk can stop at a ticket that beats all its neighbors but is not the best overall.

The fix borrows from road maps. Pick a sample of tickets, say 1 in 100 (1,000,000 ÷ 100 = 10,000), and link those to each other as a second, sparser graph. Those tickets are far apart, so one hop covers a lot of ground. A search first walks this sparse **layer** to land near the query, then drops to the full graph underneath. There it keeps a short list of the best candidates found so far, not just one, and keeps walking from the closest unexplored one; a longer list raises recall at the cost of speed. Real indexes stack several layers, each a thinner sample of the one below: a **layered graph**. It is the highway before the local roads.

So piles and graphs both skip most tickets, paying with a little recall. But real searches also come with conditions.

## Search plus conditions

Your customer only wants tickets that are open and in their language. There are three ways to combine similarity with that condition: filter first and search only the survivors, search everything and then drop failures, or check the condition during the index walk itself. If the filter keeps a handful of tickets, search-then-filter may return almost nothing, because the top results were all discarded. If it keeps most, filter-first wastes the index's speed. And tickets do not sit still.

## When tickets change

New tickets arrive constantly and old ones get edited or deleted. Adding a vector costs more than inserting into an ordinary database index, and many indexes just mark a deleted entry dead, so searches waste time on it until the index is rebuilt. Heavy-churn systems rebuild periodically, or keep a small index of recent changes beside a large stable one and merge them on a schedule. Either way, the vectors have to live somewhere.

## Where to keep the vectors

A **vector database** stores each vector with its text and metadata, keeps the index current, and handles the filtering above. Many general-purpose databases can do this too.

**Rule of thumb.** Start with exact search while the collection is small, and with the database you already run if it handles vectors well, since the vector stays consistent with its ticket and there is one system to run. Move to an ANN index when scans get too slow, and to a dedicated system only when scale or query load outgrows what you have. Change the embedding model only if you are ready to re-embed everything.
